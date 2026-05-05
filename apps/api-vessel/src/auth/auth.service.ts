import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserService } from '../user/user.service';

export type JwtPayload = {
  sub: string;
  tenantId: string;
  email: string;
  role: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UserService,
    private readonly jwt: JwtService,
  ) {}

  async login(
    tenantId: string,
    email: string,
    password: string,
  ): Promise<{ access_token: string }> {
    let user;
    try {
      user = this.users.findByEmail(tenantId, email);
    } catch {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException('This account uses SSO — password login not allowed');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const payload: JwtPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
    };

    return { access_token: this.jwt.sign(payload) };
  }
}
