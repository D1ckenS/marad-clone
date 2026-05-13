import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { UserModule } from '../user/user.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './jwt-auth.guard';

/**
 * Vessel-side JWT module.
 *
 * The vessel never signs shore-issued tokens (it has no private key),
 * so the public key is loaded into both the `privateKey` and the
 * `publicKey` slot — `privateKey` is never used in practice (`AuthService`
 * does not call `jwt.sign(...)` for shore tokens), but `@nestjs/jwt`'s
 * factory shape requires both fields to be defined.
 *
 * For the vessel's own LOCAL password login (legacy path retained for
 * dev convenience), we still need a self-signing capability. We use the
 * vessel-local secret in `JWT_SECRET` for that, registered as a separate
 * provider so neither path can spoof the other.
 */
function loadPublicKey(): string {
  const p = process.env['JWT_PUBLIC_KEY_PATH'];
  if (p === undefined || p.trim() === '') {
    throw new Error('JWT_PUBLIC_KEY_PATH is required (provision from shore via gen:jwt-keys)');
  }
  return readFileSync(resolve(process.cwd(), p), 'utf-8');
}

@Global()
@Module({
  imports: [
    UserModule,
    JwtModule.registerAsync({
      useFactory: () => ({
        publicKey: loadPublicKey(),
        // No `privateKey` — vessel cannot sign shore-shaped tokens. Local
        // password login uses a separate vessel-local HS256 secret in
        // AuthService directly, kept distinct so the two surfaces cannot
        // be confused.
        verifyOptions: {
          algorithms: ['RS256'],
          issuer: 'fleetops-shore',
        },
      }),
    }),
  ],
  providers: [AuthService, JwtAuthGuard],
  controllers: [AuthController],
  exports: [AuthService, JwtAuthGuard, JwtModule],
})
export class AuthModule {}
