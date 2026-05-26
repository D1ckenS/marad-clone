import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { assertProductionEnv } from './config/production-env';

async function bootstrap() {
  // Fail loudly before any module loads if a required prod secret is missing
  // or still equal to a known dev default (H2).
  assertProductionEnv();

  const t0 = Date.now();

  // Suppress NestJS DI startup noise; pino logger is swapped in after bootstrap.
  // On a 45-module app this saves ~200-400 ms of logger-chain initialization.
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    logger: ['error', 'warn'],
  });

  app.useLogger(app.get(Logger));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix('api/v1');

  // Translates SIGINT / SIGTERM into Nest lifecycle hooks so DrizzleService.onModuleDestroy
  // runs PRAGMA wal_checkpoint(TRUNCATE) before the SQLite file handle closes — critical
  // on vessels where abrupt power loss is common (B11).
  app.enableShutdownHooks();

  const port = process.env['PORT'] ?? 3001;
  await app.listen(port);

  app.get(Logger).log(`Vessel API ready on :${port} in ${Date.now() - t0} ms`);
}

bootstrap();
