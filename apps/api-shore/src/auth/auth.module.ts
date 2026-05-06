import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { UserModule } from '../user/user.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { OidcController } from './oidc.controller';
import { OidcService } from './oidc.service';

function loadKey(envVar: 'JWT_PRIVATE_KEY_PATH' | 'JWT_PUBLIC_KEY_PATH'): string {
  const p = process.env[envVar];
  if (p === undefined || p.trim() === '') {
    throw new Error(`${envVar} is required (run pnpm -w run gen:jwt-keys for dev)`);
  }
  return readFileSync(resolve(process.cwd(), p), 'utf-8');
}

const ACCESS_TTL_MS = Number(process.env['JWT_ACCESS_TTL_MS'] ?? 24 * 60 * 60 * 1000);

@Module({
  imports: [
    UserModule,
    JwtModule.registerAsync({
      useFactory: () => ({
        privateKey: loadKey('JWT_PRIVATE_KEY_PATH'),
        publicKey: loadKey('JWT_PUBLIC_KEY_PATH'),
        signOptions: {
          algorithm: 'RS256',
          expiresIn: Math.floor(ACCESS_TTL_MS / 1000),
          issuer: 'marad-shore',
        },
        verifyOptions: {
          algorithms: ['RS256'],
          issuer: 'marad-shore',
        },
      }),
    }),
  ],
  providers: [AuthService, OidcService],
  controllers: [AuthController, OidcController],
  exports: [AuthService, OidcService],
})
export class AuthModule {}
