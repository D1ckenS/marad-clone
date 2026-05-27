import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { assertProductionEnv } from './config/production-env';

async function bootstrap() {
  // Fail loudly before any module loads if a required prod secret is missing
  // or still equal to a known dev default (H2).
  assertProductionEnv();

  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.use(helmet());

  // H3: CORS gated by an explicit allowlist. CORS_ORIGINS is a
  // comma-separated list (e.g. "https://app.fleetops.com,https://staging.fleetops.com").
  // Empty / unset means no cross-origin requests are allowed, which is
  // what you want for a backend behind the SPA's same-origin reverse proxy.
  // Local dev sets it to the Vite origin (http://localhost:5342).
  const corsOrigins = (process.env['CORS_ORIGINS'] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (corsOrigins.length > 0) {
    app.enableCors({
      origin: corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    });
  }

  app.useLogger(app.get(Logger));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix('api/v1');

  const port = process.env['PORT'] ?? 3000;
  await app.listen(port);
}

bootstrap();
