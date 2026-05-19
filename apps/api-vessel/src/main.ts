import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
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

  const port = process.env['PORT'] ?? 3001;
  await app.listen(port);

  app.get(Logger).log(`Vessel API ready on :${port} in ${Date.now() - t0} ms`);
}

bootstrap();
