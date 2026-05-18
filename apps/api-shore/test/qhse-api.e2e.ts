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
  await prisma.tenant.create({ data: { id: tenantId, name: 'qhse-api-shore-test' } });
  await prisma.vessel.create({ data: { id: vesselId, tenantId, name: 'MV QHSE Shore' } });
  await prisma.user.create({
    data: {
      id: userId,
      tenantId,
      vesselId,
      email: 'qhse@shore.test',
      passwordHash: hash,
      role: 'CHIEF_ENGINEER',
    },
  });

  const loginRes = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ tenantId, identifier: 'qhse@shore.test', password: 'TestP@ss!1' });
  token = (loginRes.body as { access_token: string }).access_token;
});

afterAll(async () => {
  await prisma.capa.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.finding.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.checklistInstance.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.checklistTemplate.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.documentRevision.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.qhseDocument.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.user.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.vessel.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.tenant.deleteMany({ where: { id: tenantId } }).catch(() => null);
  await app.close();
});

describe('P2-3 QHSE API — shore', () => {
  let documentId: string;
  let revisionId: string;
  let templateId: string;
  let instanceId: string;
  let findingId: string;
  let capaId: string;

  // ── Document control ───────────────────────────────────────────────────────

  it('creates a QhseDocument', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/qhse-documents')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Safety Manual Rev.1', category: 'SMS', isControlled: true });
    expect(res.status).toBe(201);
    documentId = (res.body as { id: string }).id;
    expect(typeof documentId).toBe('string');
    expect((res.body as { isControlled: boolean }).isControlled).toBe(true);
  });

  it('adds a revision to the document', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/qhse-documents/${documentId}/revisions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ s3Key: 'docs/safety-manual-v1.pdf', summary: 'Initial release' });
    expect(res.status).toBe(201);
    revisionId = (res.body as { id: string }).id;
    expect((res.body as { revisionNumber: number }).revisionNumber).toBe(1);
  });

  it('adding a second revision increments revision number', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/qhse-documents/${documentId}/revisions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ s3Key: 'docs/safety-manual-v2.pdf', summary: 'Updated section 4' });
    expect(res.status).toBe(201);
    expect((res.body as { revisionNumber: number }).revisionNumber).toBe(2);
  });

  it('lists revision history — old revisions remain accessible', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/qhse-documents/${documentId}/revisions`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const revisions = res.body as Array<{ revisionNumber: number }>;
    expect(revisions.length).toBe(2);
    expect(revisions.at(0)?.revisionNumber).toBe(2);
    expect(revisions.at(1)?.revisionNumber).toBe(1);
  });

  it('approves a revision', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/qhse-documents/revisions/${revisionId}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send({ approvedByUserId: userId });
    expect(res.status).toBe(201);
    expect((res.body as { approvedAt: string }).approvedAt).toBeTruthy();
  });

  it('currentRevisionId updated to latest revision', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/qhse-documents/${documentId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect((res.body as { currentRevisionId: string | null }).currentRevisionId).toBeTruthy();
  });

  // ── Checklist template ─────────────────────────────────────────────────────

  it('creates a ChecklistTemplate', async () => {
    const items = JSON.stringify([
      { id: 'item-1', text: 'PPE checked', required: true },
      { id: 'item-2', text: 'Area barricaded', required: true },
    ]);
    const res = await request(app.getHttpServer())
      .post('/api/v1/checklist-templates')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Pre-Work Inspection', itemsJson: items });
    expect(res.status).toBe(201);
    templateId = (res.body as { id: string }).id;
    expect(typeof templateId).toBe('string');
  });

  // ── Checklist instance (instant-sign) ──────────────────────────────────────

  it('creates a ChecklistInstance from template', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/checklist-instances')
      .set('Authorization', `Bearer ${token}`)
      .send({ vesselId, templateId, title: 'Pre-Work Inspection #001' });
    expect(res.status).toBe(201);
    instanceId = (res.body as { id: string }).id;
    expect((res.body as { status: string }).status).toBe('IN_PROGRESS');
  });

  it('signs a checklist item with signature (instant-sign)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/checklist-instances/${instanceId}/sign-item`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        itemId: 'item-1',
        signedByUserId: userId,
        signedAt: new Date().toISOString(),
        signatureKey: 'sigs/user-123.png',
        checked: true,
      });
    expect(res.status).toBe(201);
    const responses = JSON.parse((res.body as { responsesJson: string }).responsesJson) as Array<{
      itemId: string;
      signedByUserId: string;
    }>;
    expect(responses.at(0)?.itemId).toBe('item-1');
    expect(responses.at(0)?.signedByUserId).toBe(userId);
  });

  it('completes a checklist instance', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/checklist-instances/${instanceId}/complete`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(201);
    expect((res.body as { status: string }).status).toBe('COMPLETED');
    expect((res.body as { completedAt: string }).completedAt).toBeTruthy();
  });

  it('cannot sign item on completed checklist', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/checklist-instances/${instanceId}/sign-item`)
      .set('Authorization', `Bearer ${token}`)
      .send({ itemId: 'item-2', signedByUserId: userId, signedAt: new Date().toISOString() });
    expect(res.status).toBe(400);
  });

  // ── Finding ────────────────────────────────────────────────────────────────

  it('creates a Finding (near-miss)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/findings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        vesselId,
        kind: 'NEAR_MISS',
        title: 'Slippery deck near gangway',
        raisedByUserId: userId,
        raisedAt: new Date().toISOString(),
      });
    expect(res.status).toBe(201);
    findingId = (res.body as { id: string }).id;
    expect((res.body as { status: string }).status).toBe('OPEN');
    expect((res.body as { kind: string }).kind).toBe('NEAR_MISS');
  });

  it('lists findings filtered by kind', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/findings?vesselId=${vesselId}&kind=NEAR_MISS`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect((res.body as unknown[]).length).toBeGreaterThan(0);
  });

  it('closes a finding', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/findings/${findingId}/close`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(201);
    expect((res.body as { status: string }).status).toBe('CLOSED');
    expect((res.body as { closedAt: string }).closedAt).toBeTruthy();
  });

  // ── CAPA ───────────────────────────────────────────────────────────────────

  it('creates a CAPA linked to a finding', async () => {
    const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const res = await request(app.getHttpServer())
      .post('/api/v1/capas')
      .set('Authorization', `Bearer ${token}`)
      .send({
        vesselId,
        findingId,
        type: 'CORRECTIVE',
        description: 'Install anti-slip matting at gangway',
        ownerUserId: userId,
        dueDate,
      });
    expect(res.status).toBe(201);
    capaId = (res.body as { id: string }).id;
    expect((res.body as { status: string }).status).toBe('OPEN');
    expect((res.body as { ownerUserId: string }).ownerUserId).toBe(userId);
    expect((res.body as { dueDate: string }).dueDate).toBeTruthy();
  });

  it('updates CAPA status to IN_PROGRESS', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/capas/${capaId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'IN_PROGRESS' });
    expect(res.status).toBe(200);
    expect((res.body as { status: string }).status).toBe('IN_PROGRESS');
  });

  it('verifies a CAPA', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/capas/${capaId}/verify`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(201);
    expect((res.body as { status: string }).status).toBe('VERIFIED');
    expect((res.body as { verifiedAt: string }).verifiedAt).toBeTruthy();
  });

  it('closes a CAPA', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/capas/${capaId}/close`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(201);
    expect((res.body as { status: string }).status).toBe('CLOSED');
  });

  it('lists CAPAs filtered by findingId', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/capas?findingId=${findingId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect((res.body as unknown[]).length).toBe(1);
  });

  it('verifies RLS policy exists on qhse_documents', async () => {
    const row = await prisma.$queryRaw<Array<{ policyname: string }>>`
      SELECT policyname FROM pg_policies WHERE tablename = 'qhse_documents'
    `;
    expect(row.some((r) => r.policyname === 'qhse_documents_tenant_isolation')).toBe(true);
  });
});
