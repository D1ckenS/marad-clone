import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ulid } from 'ulidx';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { StorageService } from '../src/storage/storage.service';

let app: INestApplication;
let prisma: PrismaService;
let token: string;

const tenantId = ulid();
const vesselId = ulid();
const userId = ulid();

const storageStub = { putJobHistoryPhoto: async () => 'stub/key', put: async () => 'stub/key' };

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(StorageService)
    .useValue(storageStub)
    .compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  prisma = moduleRef.get(PrismaService);

  const hash = await bcrypt.hash('TestP@ss!1', 12);
  await prisma.tenant.create({ data: { id: tenantId, name: 'deferred-stubs-test' } });
  await prisma.withTenant(tenantId, async (tx) => {
    await tx.vessel.create({ data: { id: vesselId, tenantId, name: 'MV Stubs' } });
    await tx.user.create({
      data: {
        id: userId,
        tenantId,
        vesselId,
        email: 'stubs@test.local',
        passwordHash: hash,
        role: 'TENANT_ADMIN',
      },
    });
  });

  const loginRes = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ tenantId, identifier: 'stubs@test.local', password: 'TestP@ss!1' });
  token = (loginRes.body as { access_token: string }).access_token;
});

afterAll(async () => {
  await prisma
    .withTenant(tenantId, async (tx) => {
      await tx.survey.deleteMany({ where: { tenantId } });
      await tx.conditionOfClass.deleteMany({ where: { tenantId } });
      await tx.inspection.deleteMany({ where: { tenantId } });
      await tx.jha.deleteMany({ where: { tenantId } });
      await tx.safetyEquipment.deleteMany({ where: { tenantId } });
      await tx.qhseObjective.deleteMany({ where: { tenantId } });
      await tx.auditFinding.deleteMany({ where: { tenantId } });
      await tx.audit.deleteMany({ where: { tenantId } });
      await tx.voyageLeg.deleteMany({ where: { tenantId } });
      await tx.dischargeLog.deleteMany({ where: { tenantId } });
      await tx.drybmsElement.deleteMany({ where: { tenantId } });
      await tx.managementReview.deleteMany({ where: { tenantId } });
      await tx.user.deleteMany({ where: { tenantId } });
      await tx.vessel.deleteMany({ where: { tenantId } });
    })
    .catch(() => null);
  await prisma.tenant.deleteMany({ where: { id: tenantId } }).catch(() => null);
  await app.close();
});

const auth = (req: request.Test) => req.set('Authorization', `Bearer ${token}`);

async function crud(
  path: string,
  createBody: Record<string, unknown>,
  updateBody: Record<string, unknown>,
) {
  const created = await auth(request(app.getHttpServer()).post(`/api/v1/${path}`).send(createBody));
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  const id = (created.body as { id: string }).id;

  const list = await auth(request(app.getHttpServer()).get(`/api/v1/${path}`));
  expect(list.status).toBe(200);
  expect(Array.isArray(list.body)).toBe(true);
  expect((list.body as { id: string }[]).some((r) => r.id === id)).toBe(true);

  const fetched = await auth(request(app.getHttpServer()).get(`/api/v1/${path}/${id}`));
  expect(fetched.status).toBe(200);

  const patched = await auth(
    request(app.getHttpServer()).patch(`/api/v1/${path}/${id}`).send(updateBody),
  );
  expect(patched.status).toBe(200);

  const removed = await auth(request(app.getHttpServer()).delete(`/api/v1/${path}/${id}`));
  expect(removed.status).toBe(204);

  const afterDelete = await auth(request(app.getHttpServer()).get(`/api/v1/${path}/${id}`));
  expect(afterDelete.status).toBe(404);

  return id;
}

describe('Deferred-stub schemas — CRUD via shore HTTP', () => {
  it('surveys: create / list / get / patch / soft-delete', async () => {
    await crud(
      'surveys',
      {
        vesselId,
        scheduledAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
        kind: 'Annual',
        scope: 'Hull',
        surveyor: 'DNV',
        location: 'Rotterdam',
      },
      { status: 'IN_PROGRESS', notes: 'underway' },
    );
  });

  it('conditions-of-class: create / list / get / patch / soft-delete', async () => {
    await crud(
      'conditions-of-class',
      {
        vesselId,
        severity: 'CONDITION',
        title: 'Cracked plate frame 42',
        detail: 'Cracking observed in EBT',
        raisedAt: new Date().toISOString(),
        openedAt: new Date().toISOString(),
      },
      { severity: 'CLOSED', closedAt: new Date().toISOString() },
    );
  });

  it('inspections: create / list / get / patch / soft-delete', async () => {
    await crud(
      'inspections',
      {
        vesselId,
        inspectedAt: new Date().toISOString(),
        kind: 'PSC',
        port: 'Singapore',
        inspector: 'MPA',
        deficiencies: 2,
        detained: false,
        status: 'Closed',
      },
      { deficiencies: 1, findings: 'Lifejacket light replaced' },
    );
  });

  it('jhas: create / list / get / patch / soft-delete', async () => {
    await crud(
      'jhas',
      {
        ref: 'JHA-0001',
        title: 'Working aloft',
        hazards: ['fall', 'dropped object'],
        controls: ['harness', 'exclusion zone'],
        residualL: 2,
        residualS: 3,
      },
      { title: 'Working aloft (revised)' },
    );
  });

  it('safety-equipment: create / list / get / patch / soft-delete', async () => {
    await crud(
      'safety-equipment',
      {
        vesselId,
        category: 'FFA',
        name: 'Foam extinguisher 9L',
        location: 'Engine room fwd',
        quantity: '4',
        status: 'GREEN',
      },
      { status: 'AMBER', flag: 'inspection due' },
    );
  });

  it('qhse-objectives: create / list / get / patch / soft-delete', async () => {
    await crud(
      'qhse-objectives',
      {
        category: 'S',
        label: 'LTI rate',
        target: '0',
        actual: '0',
        unit: 'per 1M hours',
        status: 'GREEN',
        trend: [0, 0, 0, 0, 0],
      },
      { actual: '1', status: 'AMBER' },
    );
  });

  it('audits + audit-findings: create / list / get / patch / soft-delete', async () => {
    const auditCreate = await auth(
      request(app.getHttpServer()).post('/api/v1/audits').send({
        vesselId,
        kind: 'INTERNAL',
        scope: 'PMS module',
        scheduledAt: new Date().toISOString(),
        auditor: 'M. Smith',
      }),
    );
    expect(auditCreate.status).toBe(201);
    const auditId = (auditCreate.body as { id: string }).id;

    await crud(
      'audit-findings',
      {
        vesselId,
        auditId,
        classification: 'Minor NC',
        title: 'Missing maintenance signature',
        openedAt: new Date().toISOString(),
        dueAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      },
      { closedAt: new Date().toISOString() },
    );

    const auditDelete = await auth(
      request(app.getHttpServer()).delete(`/api/v1/audits/${auditId}`),
    );
    expect(auditDelete.status).toBe(204);
  });

  it('voyage-legs: create / list / get / patch / soft-delete', async () => {
    await crud(
      'voyage-legs',
      {
        vesselId,
        route: 'RTM → SIN',
        departureAt: new Date().toISOString(),
        arrivalAt: new Date(Date.now() + 21 * 86_400_000).toISOString(),
        nm: '8500.50',
        fuelTonnes: '1280.000',
        co2Tonnes: '4000.000',
        soxTonnes: '12.000',
        noxTonnes: '64.000',
        hours: '480.00',
        mode: 'LADEN',
      },
      { cargo: 'Containers' },
    );
  });

  it('discharge-logs: create / list / get / patch / soft-delete', async () => {
    await crud(
      'discharge-logs',
      {
        vesselId,
        kind: 'Garbage',
        occurredAt: new Date().toISOString(),
        location: 'Port reception facility, RTM',
        volume: '0.5 m³',
        compliant: true,
      },
      { notes: 'Receipt #12345' },
    );
  });

  it('drybms-elements: create / list / get / patch / soft-delete', async () => {
    await crud(
      'drybms-elements',
      {
        chapter: '1',
        chapterTitle: 'Leadership',
        name: 'Senior management commitment',
        score: 3,
      },
      { score: 4, stage: 'Resilient' },
    );
  });

  it('management-reviews: create / list / get / patch / soft-delete', async () => {
    await crud(
      'management-reviews',
      {
        kind: 'Annual',
        scheduledAt: new Date(Date.now() + 60 * 86_400_000).toISOString(),
        chair: 'CEO',
        attendees: 8,
        actionsTotal: 5,
        actionsDone: 0,
      },
      { status: 'CLOSED', actionsDone: 5, summary: 'All actions complete' },
    );
  });

  // ── derivation invariants ───────────────────────────────────────────
  // Regression suite for the audit-finding-count + requisition-line
  // derivation fixes. `Audit.findings` is no longer a writable DTO
  // field; it's recomputed from `audit_findings` row count on every
  // AuditFinding mutation. Same principle as PR #53's totalAmount fix.

  it('Audit.findings: ignored on create, then recomputed when findings are added', async () => {
    const createRes = await auth(
      request(app.getHttpServer()).post('/api/v1/audits').send({
        vesselId,
        kind: 'CLASS',
        scope: 'derivation test',
        scheduledAt: new Date().toISOString(),
        auditor: 'Inspector A',
        findings: 999, // ← should be ignored (whitelist strips)
      }),
    );
    expect(createRes.status).toBe(201);
    expect(createRes.body.findings).toBe(0);
    const auditId = createRes.body.id as string;

    // Add two findings → parent count becomes 2.
    for (let i = 0; i < 2; i++) {
      await auth(
        request(app.getHttpServer())
          .post('/api/v1/audit-findings')
          .send({
            vesselId,
            auditId,
            classification: 'Minor NC',
            title: `Finding ${i + 1}`,
            openedAt: new Date().toISOString(),
          }),
      );
    }
    const afterAdd = await auth(request(app.getHttpServer()).get(`/api/v1/audits/${auditId}`));
    expect(afterAdd.body.findings).toBe(2);

    // Soft-delete one → count drops to 1.
    const listFindings = await auth(
      request(app.getHttpServer()).get(`/api/v1/audit-findings?auditId=${auditId}`),
    );
    const firstFindingId = (listFindings.body as { id: string }[])[0]!.id;
    await auth(request(app.getHttpServer()).delete(`/api/v1/audit-findings/${firstFindingId}`));

    const afterDelete = await auth(request(app.getHttpServer()).get(`/api/v1/audits/${auditId}`));
    expect(afterDelete.body.findings).toBe(1);
  });

  it('Audit.findings: PATCH with client-supplied findings is silently ignored', async () => {
    const createRes = await auth(
      request(app.getHttpServer()).post('/api/v1/audits').send({
        vesselId,
        kind: 'INTERNAL',
        scope: 'patch-ignore test',
        scheduledAt: new Date().toISOString(),
        auditor: 'Inspector B',
      }),
    );
    const auditId = createRes.body.id as string;
    await auth(
      request(app.getHttpServer()).post('/api/v1/audit-findings').send({
        vesselId,
        auditId,
        classification: 'Major NC',
        title: 'Real one',
        openedAt: new Date().toISOString(),
      }),
    );
    await auth(
      request(app.getHttpServer())
        .patch(`/api/v1/audits/${auditId}`)
        .send({ findings: 9999, notes: 'updated' }),
    );
    const after = await auth(request(app.getHttpServer()).get(`/api/v1/audits/${auditId}`));
    expect(after.body.findings).toBe(1);
    expect(after.body.notes).toBe('updated');
  });

  it('Requisition.removeLine: recomputes the parent totalAmount', async () => {
    // The DRAFT-status check is the only gate on removeLine; no approval
    // flow needed for this regression.
    const reqRes = await auth(
      request(app.getHttpServer()).post('/api/v1/requisitions').send({
        title: 'removeLine recompute test',
        currency: 'USD',
        requestedAt: new Date().toISOString(),
      }),
    );
    const reqId = reqRes.body.id as string;

    const lineARes = await auth(
      request(app.getHttpServer()).post(`/api/v1/requisitions/${reqId}/lines`).send({
        description: 'A',
        quantity: '1',
        estimatedUnitPrice: '100',
        estimatedTotalPrice: '100',
      }),
    );
    await auth(
      request(app.getHttpServer()).post(`/api/v1/requisitions/${reqId}/lines`).send({
        description: 'B',
        quantity: '1',
        estimatedUnitPrice: '200',
        estimatedTotalPrice: '200',
      }),
    );
    const total1 = await auth(request(app.getHttpServer()).get(`/api/v1/requisitions/${reqId}`));
    expect(parseFloat(total1.body.totalAmount)).toBe(300);

    // Remove line A → total drops to 200.
    await auth(
      request(app.getHttpServer()).delete(
        `/api/v1/requisitions/${reqId}/lines/${lineARes.body.id}`,
      ),
    );
    const total2 = await auth(request(app.getHttpServer()).get(`/api/v1/requisitions/${reqId}`));
    expect(parseFloat(total2.body.totalAmount)).toBe(200);
  });

  // M6: MARPOL non-compliant discharge wiring — AuditEvent on
  // non-compliant create + PATCH true→false; YTD widget endpoint;
  // IOPP-style CSV export.
  it('discharge-logs: compliant=false on create emits MARPOL_NON_COMPLIANT_DISCHARGE AuditEvent', async () => {
    const created = await auth(
      request(app.getHttpServer()).post('/api/v1/discharge-logs').send({
        vesselId,
        kind: 'Oil',
        occurredAt: new Date().toISOString(),
        location: 'Engine room bilge (M6 test)',
        volume: '0.2 m³',
        compliant: false,
      }),
    );
    expect(created.status).toBe(201);
    const dischargeId = (created.body as { id: string }).id;

    // Audit log is fire-and-forget; allow it to settle before query.
    await new Promise((r) => setTimeout(r, 50));
    const audit = await auth(
      request(app.getHttpServer()).get(
        '/api/v1/audit-events?action=MARPOL_NON_COMPLIANT_DISCHARGE',
      ),
    );
    expect(audit.status).toBe(200);
    const events = audit.body as { entityId: string; action: string; metadata: unknown }[];
    expect(events.some((e) => e.entityId === dischargeId)).toBe(true);
  });

  it('discharge-logs: PATCH compliant true→false also fires the AuditEvent', async () => {
    const created = await auth(
      request(app.getHttpServer()).post('/api/v1/discharge-logs').send({
        vesselId,
        kind: 'Garbage',
        occurredAt: new Date().toISOString(),
        location: 'Port reception (transition test)',
        volume: '0.1 m³',
        compliant: true,
      }),
    );
    const id = (created.body as { id: string }).id;

    await auth(
      request(app.getHttpServer()).patch(`/api/v1/discharge-logs/${id}`).send({ compliant: false }),
    );
    await new Promise((r) => setTimeout(r, 50));
    const audit = await auth(
      request(app.getHttpServer()).get(
        `/api/v1/audit-events?action=MARPOL_NON_COMPLIANT_DISCHARGE`,
      ),
    );
    const events = audit.body as { entityId: string; metadata: { transition?: string } | null }[];
    expect(
      events.some(
        (e) => e.entityId === id && e.metadata?.transition === 'patch-compliant-to-non-compliant',
      ),
    ).toBe(true);
  });

  it('discharge-logs: GET /non-compliant-ytd returns per-vessel breakdown', async () => {
    const res = await auth(
      request(app.getHttpServer()).get('/api/v1/discharge-logs/non-compliant-ytd'),
    );
    expect(res.status).toBe(200);
    const body = res.body as {
      year: number;
      total: number;
      byVessel: { vesselId: string; count: number }[];
    };
    expect(body.year).toBe(new Date().getUTCFullYear());
    expect(body.total).toBeGreaterThanOrEqual(2); // From the two prior tests
    expect(body.byVessel.some((v) => v.vesselId === vesselId)).toBe(true);
  });

  it('discharge-logs: GET /export.csv returns IOPP-style CSV', async () => {
    const res = await auth(
      request(app.getHttpServer()).get(`/api/v1/discharge-logs/export.csv?vesselId=${vesselId}`),
    );
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    const csv = res.text;
    expect(csv).toMatch(/^"Date","Vessel ID","Kind","Location","Volume","Compliant","Notes"\n/);
    // At least one of the rows we created above should appear
    expect(csv).toMatch(/"Engine room bilge \(M6 test\)"/);
  });

  it('RLS policies exist for all 12 new tables', async () => {
    const tables = [
      'surveys',
      'conditions_of_class',
      'inspections',
      'jhas',
      'safety_equipment',
      'qhse_objectives',
      'audits',
      'audit_findings',
      'voyage_legs',
      'discharge_logs',
      'drybms_elements',
      'management_reviews',
    ];
    for (const t of tables) {
      const rows = (await prisma.$queryRawUnsafe(
        `SELECT policyname FROM pg_policies WHERE tablename = $1`,
        t,
      )) as { policyname: string }[];
      expect(rows.length, `${t} missing RLS policy`).toBeGreaterThan(0);
    }
  });
});
