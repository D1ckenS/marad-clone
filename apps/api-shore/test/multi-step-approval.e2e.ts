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
let adminToken: string;
let masterToken: string;
let pmToken: string;

const tenantId = ulid();
const vesselId = ulid();
const adminId = ulid();
const masterId = ulid();
const pmId = ulid();
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
  await prisma.tenant.create({ data: { id: tenantId, name: 'multistep-approval-test' } });
  await prisma.vessel.create({
    data: { id: vesselId, tenantId, name: 'MV Approval', imoNumber: '9999002' },
  });
  await prisma.user.createMany({
    data: [
      {
        id: adminId,
        tenantId,
        vesselId,
        email: 'admin@msa.test',
        username: 'msa-admin',
        passwordHash: hash,
        role: 'TENANT_ADMIN',
      },
      {
        id: masterId,
        tenantId,
        vesselId,
        email: 'master@msa.test',
        username: 'msa-master',
        passwordHash: hash,
        role: 'MASTER',
      },
      {
        id: pmId,
        tenantId,
        vesselId,
        email: 'pm@msa.test',
        username: 'msa-pm',
        passwordHash: hash,
        role: 'PURCHASE_MANAGER',
      },
    ],
  });

  const login = async (identifier: string) => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ tenantId, identifier, password: 'TestP@ss!1' });
    return (res.body as { access_token: string }).access_token;
  };

  adminToken = await login('admin@msa.test');
  masterToken = await login('master@msa.test');
  pmToken = await login('pm@msa.test');
});

afterAll(async () => {
  await prisma.requisitionLine.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.requisition.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.approvalStep.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.approvalFlow.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.user.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.vessel.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.tenant.deleteMany({ where: { id: tenantId } }).catch(() => null);
  await app.close();
});

describe('P3-3 Multi-step approval flows e2e', () => {
  let flowId: string;
  let reqId: string;

  it('creates a 2-step approval flow (MASTER → PURCHASE_MANAGER)', async () => {
    const flowRes = await request(app.getHttpServer())
      .post('/api/v1/approval-flows')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Two-step approval' })
      .expect(201);
    flowId = flowRes.body.id as string;

    await request(app.getHttpServer())
      .post(`/api/v1/approval-flows/${flowId}/steps`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ stepOrder: 1, approverRole: 'MASTER' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/approval-flows/${flowId}/steps`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ stepOrder: 2, approverRole: 'PURCHASE_MANAGER' })
      .expect(201);
  });

  it('creates and submits a requisition — currentStepOrder set to 1', async () => {
    const reqRes = await request(app.getHttpServer())
      .post('/api/v1/requisitions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        vesselId,
        title: 'Multi-step requisition',
        totalAmount: '5000',
        currency: 'USD',
        requestedAt: new Date().toISOString(),
        approvalFlowId: flowId,
      })
      .expect(201);
    reqId = reqRes.body.id as string;

    const submitRes = await request(app.getHttpServer())
      .post(`/api/v1/requisitions/${reqId}/submit`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(submitRes.body.status).toBe('SUBMITTED');
    expect(submitRes.body.currentStepOrder).toBe(1);
  });

  it('wrong role (PURCHASE_MANAGER) cannot approve step 1 → 403', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/requisitions/${reqId}/approve`)
      .set('Authorization', `Bearer ${pmToken}`)
      .expect(403);
  });

  it('MASTER approves step 1 → advances to step 2, stays SUBMITTED', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/requisitions/${reqId}/approve`)
      .set('Authorization', `Bearer ${masterToken}`)
      .expect(200);
    expect(res.body.status).toBe('SUBMITTED');
    expect(res.body.currentStepOrder).toBe(2);
  });

  it('PURCHASE_MANAGER approves step 2 → APPROVED', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/requisitions/${reqId}/approve`)
      .set('Authorization', `Bearer ${pmToken}`)
      .expect(200);
    expect(res.body.status).toBe('APPROVED');
  });
});
