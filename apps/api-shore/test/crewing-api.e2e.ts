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

// 11 rest hours per day (13 worked) = 77h weekly — just within MLC limit
const VALID_HOURS = JSON.stringify(Array.from({ length: 24 }, (_, i) => i < 13));
// 15 worked hours = 9 rest — DAILY violation
const OVERWORKED_HOURS = JSON.stringify(Array.from({ length: 24 }, (_, i) => i < 15));

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
  await prisma.tenant.create({ data: { id: tenantId, name: 'crewing-api-shore-test' } });
  await prisma.vessel.create({ data: { id: vesselId, tenantId, name: 'MV Crewing Shore' } });
  await prisma.user.create({
    data: {
      id: userId,
      tenantId,
      vesselId,
      email: 'crew@shore.test',
      passwordHash: hash,
      role: 'OFFICER',
    },
  });

  const loginRes = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ tenantId, identifier: 'crew@shore.test', password: 'TestP@ss!1' });
  token = (loginRes.body as { access_token: string }).access_token;
});

afterAll(async () => {
  await prisma.crewCertificate.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.restHourEntry.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.rotation.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.crewMember.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.user.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.vessel.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.tenant.deleteMany({ where: { id: tenantId } }).catch(() => null);
  await app.close();
});

describe('P2-4 Crewing API — shore', () => {
  let crewMemberId: string;
  let rotationId: string;
  let certId: string;

  // ── CrewMember ─────────────────────────────────────────────────────────────

  it('creates a CrewMember', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/crew-members')
      .set('Authorization', `Bearer ${token}`)
      .send({
        vesselId,
        firstName: 'Jan',
        lastName: 'Visser',
        rank: 'Chief Engineer',
        nationality: 'NL',
      });
    expect(res.status).toBe(201);
    crewMemberId = (res.body as { id: string }).id;
    expect((res.body as { rank: string }).rank).toBe('Chief Engineer');
  });

  it('lists crew members on the vessel', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/crew-members?vesselId=${vesselId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect((res.body as unknown[]).length).toBeGreaterThan(0);
  });

  it('updates crew member status to ON_LEAVE', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/crew-members/${crewMemberId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'ON_LEAVE' });
    expect(res.status).toBe(200);
    expect((res.body as { status: string }).status).toBe('ON_LEAVE');
  });

  // ── Rotation ───────────────────────────────────────────────────────────────

  it('creates a Rotation for the crew member', async () => {
    const now = new Date().toISOString();
    const end = new Date(Date.now() + 90 * 86400000).toISOString();
    const res = await request(app.getHttpServer())
      .post('/api/v1/rotations')
      .set('Authorization', `Bearer ${token}`)
      .send({ vesselId, crewMemberId, plannedSignOn: now, plannedSignOff: end });
    expect(res.status).toBe(201);
    rotationId = (res.body as { id: string }).id;
    expect((res.body as { status: string }).status).toBe('PLANNED');
  });

  it('updates rotation status to ACTIVE', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/rotations/${rotationId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'ACTIVE', actualSignOn: new Date().toISOString() });
    expect(res.status).toBe(200);
    expect((res.body as { status: string }).status).toBe('ACTIVE');
  });

  // ── Rest hours — MLC 2006 ──────────────────────────────────────────────────

  it('accepts a compliant rest-hour entry (13h worked = 11h rest)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/rest-hour-entries')
      .set('Authorization', `Bearer ${token}`)
      .send({ vesselId, crewMemberId, date: '2026-01-01', hoursWorkedJson: VALID_HOURS });
    expect(res.status).toBe(201);
    expect((res.body as { mlcValid: boolean }).mlcValid).toBe(true);
  });

  it('rejects an MLC-violating entry (15h worked = 9h rest < 10h daily minimum)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/rest-hour-entries')
      .set('Authorization', `Bearer ${token}`)
      .send({ vesselId, crewMemberId, date: '2026-01-02', hoursWorkedJson: OVERWORKED_HOURS });
    expect(res.status).toBe(400);
    const body = res.body as { violations: Array<{ type: string }> };
    expect(body.violations.some((v) => v.type === 'DAILY_REST')).toBe(true);
  });

  it('7 days at 13h worked triggers weekly check pass (77h rest exactly)', async () => {
    const dates = [
      '2026-01-03',
      '2026-01-04',
      '2026-01-05',
      '2026-01-06',
      '2026-01-07',
      '2026-01-08',
    ];
    for (const date of dates) {
      const res = await request(app.getHttpServer())
        .post('/api/v1/rest-hour-entries')
        .set('Authorization', `Bearer ${token}`)
        .send({ vesselId, crewMemberId, date, hoursWorkedJson: VALID_HOURS });
      expect(res.status).toBe(201);
    }
    const listRes = await request(app.getHttpServer())
      .get(`/api/v1/rest-hour-entries?crewMemberId=${crewMemberId}`)
      .set('Authorization', `Bearer ${token}`);
    expect((listRes.body as unknown[]).length).toBe(7);
  });

  // ── CrewCertificate ────────────────────────────────────────────────────────

  it('creates a CrewCertificate (STCW II/1)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/crew-certificates')
      .set('Authorization', `Bearer ${token}`)
      .send({
        vesselId,
        crewMemberId,
        certificateType: 'STCW II/1',
        number: 'NL-12345',
        issuedAt: '2024-01-01T00:00:00Z',
        expiresAt: '2029-01-01T00:00:00Z',
        issuedBy: 'Netherlands Coastguard',
      });
    expect(res.status).toBe(201);
    certId = (res.body as { id: string }).id;
    expect((res.body as { certificateType: string }).certificateType).toBe('STCW II/1');
  });

  it('lists certificates for crew member', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/crew-certificates?crewMemberId=${crewMemberId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect((res.body as unknown[]).length).toBe(1);
  });

  it('updates certificate expiry', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/crew-certificates/${certId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ expiresAt: '2030-06-30T00:00:00Z' });
    expect(res.status).toBe(200);
    expect((res.body as { expiresAt: string }).expiresAt).toContain('2030');
  });

  it('verifies RLS policy on crew_members', async () => {
    const row = await prisma.$queryRaw<Array<{ policyname: string }>>`
      SELECT policyname FROM pg_policies WHERE tablename = 'crew_members'
    `;
    expect(row.some((r) => r.policyname === 'crew_members_tenant_isolation')).toBe(true);
  });
});
