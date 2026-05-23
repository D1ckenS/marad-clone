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
