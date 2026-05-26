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
  app.useLogger(app.get(Logger));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix('api/v1');

  const port = process.env['PORT'] ?? 3000;
  await app.listen(port);
}

bootstrap();
