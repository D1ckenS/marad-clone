import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { StorageService } from '../src/storage/storage.service';

let app: INestApplication;
let token = '';
const ctx = { tenantId: '', vesselId: '', userId: '' };

const VALID_HOURS = JSON.stringify(Array.from({ length: 24 }, (_, i) => i < 13));
const OVERWORKED_HOURS = JSON.stringify(Array.from({ length: 24 }, (_, i) => i < 15));

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(StorageService)
    .useValue({ putJobHistoryPhoto: async () => 'stub/key', put: async () => 'stub/key' })
    .compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();

  const tenantRes = await request(app.getHttpServer())
    .post('/api/v1/tenants')
    .send({
      name: 'crewing-api-vessel',
      admin: { email: 'admin@crew-vessel.test', password: 'AdminP@ss1' },
    });
  ctx.tenantId = (tenantRes.body as { tenant: { id: string } }).tenant.id;

  const adminLogin = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ tenantId: ctx.tenantId, email: 'admin@crew-vessel.test', password: 'AdminP@ss1' });
  const adminToken = (adminLogin.body as { access_token: string }).access_token;

  const vesselRes = await request(app.getHttpServer())
    .post('/api/v1/vessels')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'MV Crewing Vessel' });
  ctx.vesselId = (vesselRes.body as { id: string }).id;

  const userRes = await request(app.getHttpServer())
    .post('/api/v1/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      email: 'officer@crew-vessel.test',
      password: 'TestP@ss!1',
      role: 'OFFICER',
      vesselId: ctx.vesselId,
    });
  ctx.userId = (userRes.body as { id: string }).id;

  const login = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ tenantId: ctx.tenantId, email: 'officer@crew-vessel.test', password: 'TestP@ss!1' });
  token = (login.body as { access_token: string }).access_token;
});

afterAll(async () => {
  await app.close();
});

describe('P2-4 Crewing API — vessel', () => {
  let crewMemberId: string;

  it('creates a CrewMember', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/crew-members')
      .set('Authorization', `Bearer ${token}`)
      .send({
        vesselId: ctx.vesselId,
        firstName: 'Piet',
        lastName: 'de Vries',
        rank: 'Bosun',
        nationality: 'NL',
      });
    expect(res.status).toBe(201);
    crewMemberId = (res.body as { id: string }).id;
    expect(typeof crewMemberId).toBe('string');
  });

  it('crew member creation writes outbox entry', async () => {
    const { DrizzleService } = await import('../src/db/drizzle.service');
    const { outbox } = await import('../src/db/schema');
    const { eq } = await import('drizzle-orm');
    const drizzle = app.get(DrizzleService);
    const entries = drizzle.db
      .select()
      .from(outbox)
      .where(eq(outbox.entityType, 'CrewMember'))
      .all();
    expect(entries.length).toBeGreaterThan(0);
  });

  it('creates a Rotation', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/rotations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        vesselId: ctx.vesselId,
        crewMemberId,
        plannedSignOn: new Date().toISOString(),
        plannedSignOff: new Date(Date.now() + 60 * 86400000).toISOString(),
      });
    expect(res.status).toBe(201);
    expect((res.body as { status: string }).status).toBe('PLANNED');
  });

  it('accepts compliant rest-hour entry', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/rest-hour-entries')
      .set('Authorization', `Bearer ${token}`)
      .send({
        vesselId: ctx.vesselId,
        crewMemberId,
        date: '2026-02-01',
        hoursWorkedJson: VALID_HOURS,
      });
    expect(res.status).toBe(201);
    expect((res.body as { mlcValid: boolean }).mlcValid).toBe(true);
  });

  it('rest-hour entry creates outbox entry', async () => {
    const { DrizzleService } = await import('../src/db/drizzle.service');
    const { outbox } = await import('../src/db/schema');
    const { eq } = await import('drizzle-orm');
    const drizzle = app.get(DrizzleService);
    const entries = drizzle.db
      .select()
      .from(outbox)
      .where(eq(outbox.entityType, 'RestHourEntry'))
      .all();
    expect(entries.length).toBeGreaterThan(0);
  });

  it('rejects MLC-violating entry (15h worked = 9h rest)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/rest-hour-entries')
      .set('Authorization', `Bearer ${token}`)
      .send({
        vesselId: ctx.vesselId,
        crewMemberId,
        date: '2026-02-02',
        hoursWorkedJson: OVERWORKED_HOURS,
      });
    expect(res.status).toBe(400);
    const body = res.body as { violations: Array<{ type: string }> };
    expect(body.violations.some((v) => v.type === 'DAILY_REST')).toBe(true);
  });

  it('creates a CrewCertificate', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/crew-certificates')
      .set('Authorization', `Bearer ${token}`)
      .send({
        vesselId: ctx.vesselId,
        crewMemberId,
        certificateType: 'Basic Safety Training',
        expiresAt: '2028-01-01T00:00:00Z',
      });
    expect(res.status).toBe(201);
    expect((res.body as { certificateType: string }).certificateType).toBe('Basic Safety Training');
  });

  it('crew certificate creates outbox entry', async () => {
    const { DrizzleService } = await import('../src/db/drizzle.service');
    const { outbox } = await import('../src/db/schema');
    const { eq } = await import('drizzle-orm');
    const drizzle = app.get(DrizzleService);
    const entries = drizzle.db
      .select()
      .from(outbox)
      .where(eq(outbox.entityType, 'CrewCertificate'))
      .all();
    expect(entries.length).toBeGreaterThan(0);
  });
});
