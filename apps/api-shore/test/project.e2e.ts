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
  await prisma.tenant.create({ data: { id: tenantId, name: 'project-api-test' } });
  await prisma.vessel.create({
    data: { id: vesselId, tenantId, name: 'MV Test', imoNumber: '9999001' },
  });
  await prisma.user.create({
    data: {
      id: userId,
      tenantId,
      vesselId,
      email: 'project@test.shore',
      username: 'projuser',
      passwordHash: hash,
      role: 'CHIEF_ENGINEER',
    },
  });

  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ tenantId, identifier: 'project@test.shore', password: 'TestP@ss!1' });
  token = (res.body as { access_token: string }).access_token;
});

afterAll(async () => {
  await prisma.projectTask.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.project.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.user.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.vessel.deleteMany({ where: { tenantId } }).catch(() => null);
  await prisma.tenant.deleteMany({ where: { id: tenantId } }).catch(() => null);
  await app.close();
});

describe('P3-2 Project planning e2e (shore)', () => {
  let projectId: string;
  let taskId: string;

  it('POST /projects creates a project', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({
        vesselId,
        title: 'Annual Dry Dock 2026',
        startDate: '2026-06-01',
        endDate: '2026-06-21',
      })
      .expect(201);
    projectId = res.body.id as string;
    expect(res.body.title).toBe('Annual Dry Dock 2026');
    expect(res.body.status).toBe('PLANNING');
    expect(res.body.tasks).toEqual([]);
  });

  it('GET /projects lists projects', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/projects')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.some((p: { id: string }) => p.id === projectId)).toBe(true);
  });

  it('PATCH /projects/:id updates status to ACTIVE', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/projects/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'ACTIVE' })
      .expect(200);
    expect(res.body.status).toBe('ACTIVE');
  });

  it('POST /projects/:id/tasks creates a task', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Hull cleaning',
        startDate: '2026-06-01',
        endDate: '2026-06-05',
        plannedDays: 5,
        assignedToRole: 'CHIEF_ENGINEER',
      })
      .expect(201);
    taskId = res.body.id as string;
    expect(res.body.title).toBe('Hull cleaning');
    expect(res.body.status).toBe('TODO');
    expect(res.body.plannedDays).toBe(5);
  });

  it('GET /projects/:id/tasks lists tasks', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].title).toBe('Hull cleaning');
  });

  it('PATCH /projects/:id/tasks/:taskId updates task to IN_PROGRESS', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/projects/${projectId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'IN_PROGRESS' })
      .expect(200);
    expect(res.body.status).toBe('IN_PROGRESS');
  });

  it('GET /projects/:id includes tasks array', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/projects/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.tasks).toBeDefined();
    expect(res.body.tasks.length).toBeGreaterThan(0);
  });

  it('DELETE /projects/:id/tasks/:taskId soft-deletes task', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/projects/${projectId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);
    const res = await request(app.getHttpServer())
      .get(`/api/v1/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.every((t: { id: string }) => t.id !== taskId)).toBe(true);
  });
});
