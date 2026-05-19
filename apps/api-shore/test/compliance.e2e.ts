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
  await prisma.tenant.create({ data: { id: tenantId, name: 'compliance-api-test' } });
  await prisma.vessel.create({
    data: { id: vesselId, tenantId, name: 'MV Compliance Test', imoNumber: '9955001' },
  });
  await prisma.user.create({
    data: {
      id: userId,
      tenantId,
      vesselId,
      email: 'compliance@test.shore',
      username: 'complianceuser',
      passwordHash: hash,
      role: 'TENANT_ADMIN',
    },
  });

  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ tenantId, identifier: 'compliance@test.shore', password: 'TestP@ss!1' });
  token = (res.body as { access_token: string }).access_token;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.vessel.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.tenant.deleteMany({ where: { id: tenantId } }).catch(() => null);
  await app.close();
});

describe('DNV CG-0339 Type-Approval Report', () => {
  it('returns a structured report with all required checks', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/compliance/dnv-type-approval/${vesselId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.standard).toBe('DNV CG-0339');
    expect(res.body.systemName).toBe('FleetOps');
    expect(res.body.vessel.id).toBe(vesselId);
    expect(Array.isArray(res.body.checks)).toBe(true);
    expect(res.body.checks.length).toBeGreaterThanOrEqual(7);
    expect(typeof res.body.complianceScore).toBe('number');
    expect(res.body.complianceScore).toBeGreaterThanOrEqual(0);
    expect(res.body.complianceScore).toBeLessThanOrEqual(100);
  });

  it('includes an immutability trigger check that PASSES', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/compliance/dnv-type-approval/${vesselId}`)
      .set('Authorization', `Bearer ${token}`);

    const trigger = (res.body.checks as { requirement: string; status: string }[]).find((c) =>
      c.requirement.includes('immutability'),
    );
    expect(trigger).toBeDefined();
    // The trigger should exist from the P1-1 migration
    expect(trigger!.status).toBe('PASS');
  });

  it('includes RLS check that PASSES', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/compliance/dnv-type-approval/${vesselId}`)
      .set('Authorization', `Bearer ${token}`);

    const rlsCheck = (res.body.checks as { requirement: string; status: string }[]).find((c) =>
      c.requirement.includes('row-level security'),
    );
    expect(rlsCheck).toBeDefined();
    expect(rlsCheck!.status).toBe('PASS');
  });

  it('check evidence arrays are non-empty', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/compliance/dnv-type-approval/${vesselId}`)
      .set('Authorization', `Bearer ${token}`);

    for (const check of res.body.checks as { evidence: string[] }[]) {
      expect(check.evidence.length).toBeGreaterThan(0);
    }
  });

  it('returns 404 for non-existent vessel', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/compliance/dnv-type-approval/${ulid()}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('export endpoint returns downloadable JSON', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/compliance/dnv-type-approval/${vesselId}/export`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.header['content-type']).toMatch(/application\/json/);
    expect(res.header['content-disposition']).toContain('dnv-cg-0339');
    expect(res.body.standard).toBe('DNV CG-0339');
  });
});

describe('ISO 27001:2022 Readiness Assessment', () => {
  it('returns a structured assessment with controls', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/compliance/iso27001-readiness')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.standard).toBe('ISO/IEC 27001:2022');
    expect(Array.isArray(res.body.controls)).toBe(true);
    expect(res.body.controls.length).toBeGreaterThanOrEqual(15);
    expect(typeof res.body.summary.score).toBe('number');
    expect(res.body.summary.score).toBeGreaterThan(50); // well-implemented system
  });

  it('all controls have required fields', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/compliance/iso27001-readiness')
      .set('Authorization', `Bearer ${token}`);

    for (const ctrl of res.body.controls as {
      id: string;
      title: string;
      category: string;
      status: string;
      evidence: string[];
    }[]) {
      expect(ctrl.id).toBeTruthy();
      expect(ctrl.title).toBeTruthy();
      expect(['Organizational', 'People', 'Physical', 'Technological']).toContain(ctrl.category);
      expect(['IMPLEMENTED', 'PARTIAL', 'GAP', 'NOT_APPLICABLE']).toContain(ctrl.status);
      expect(ctrl.evidence.length).toBeGreaterThan(0);
    }
  });

  it('A.8.5 (authentication) is IMPLEMENTED', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/compliance/iso27001-readiness')
      .set('Authorization', `Bearer ${token}`);

    const auth = (res.body.controls as { id: string; status: string }[]).find(
      (c) => c.id === 'A.8.5',
    );
    expect(auth).toBeDefined();
    expect(auth!.status).toBe('IMPLEMENTED');
  });

  it('A.8.3 (access restriction) is IMPLEMENTED', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/compliance/iso27001-readiness')
      .set('Authorization', `Bearer ${token}`);

    const ctrl = (res.body.controls as { id: string; status: string }[]).find(
      (c) => c.id === 'A.8.3',
    );
    expect(ctrl!.status).toBe('IMPLEMENTED');
  });

  it('summary score and counts are consistent', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/compliance/iso27001-readiness')
      .set('Authorization', `Bearer ${token}`);

    const { summary, controls } = res.body as {
      summary: {
        total: number;
        implemented: number;
        partial: number;
        gaps: number;
        notApplicable: number;
      };
      controls: { status: string }[];
    };

    expect(summary.total).toBe(controls.length);
    expect(summary.implemented).toBe(controls.filter((c) => c.status === 'IMPLEMENTED').length);
    expect(summary.partial).toBe(controls.filter((c) => c.status === 'PARTIAL').length);
    expect(summary.gaps).toBe(controls.filter((c) => c.status === 'GAP').length);
  });

  it('export endpoint returns downloadable JSON', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/compliance/iso27001-readiness/export')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.header['content-type']).toMatch(/application\/json/);
    expect(res.header['content-disposition']).toContain('iso27001');
  });
});

describe('Compliance Status Summary', () => {
  it('returns combined status for a vessel', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/compliance/status/${vesselId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.vesselId).toBe(vesselId);
    expect(res.body.dnv).toBeDefined();
    expect(res.body.iso27001).toBeDefined();
    expect(typeof res.body.dnv.score).toBe('number');
    expect(typeof res.body.iso27001.score).toBe('number');
  });
});
