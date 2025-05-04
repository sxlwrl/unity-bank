import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  Inject,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { RegisterDto, LoginDto } from './dto';
import { RedisService } from '../redis';
import { PrismaService } from '../prisma';
import { randomUUID } from 'crypto';
import { ClientProxy } from '@nestjs/microservices';
import * as bcrypt from 'bcryptjs';
import * as speakeasy from 'speakeasy';

@Injectable()
export class AuthService {
  constructor(
    @Inject('USER_SERVICE') private readonly userClient: ClientProxy,
    private readonly redisService: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  async register(dto: RegisterDto) {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.userClient
      .send(
        { cmd: 'create-user' },
        {
          email: dto.email,
          phone: dto.phone,
          fullName: dto.fullName,
          passwordHash,
          dateOfBirth: dto.dateOfBirth,
          createdAt: new Date(),
          updatedAt: new Date(),
          status: 'unverified',
        },
      )
      .toPromise();
    return { id: user.id, email: user.email, phone: user.phone };
  }

  async login(dto: LoginDto) {
    const user = await this.userClient
      .send(
        { cmd: 'find-user' },
        {
          phone: dto.phone,
        },
      )
      .toPromise();

    if (!user) throw new UnauthorizedException('User not found');

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) throw new UnauthorizedException('Invalid credentials');

    // 2FA check
    const tfa = await this.prisma.twoFactorSecret.findFirst({
      where: { userId: user.id, enabled: true },
    });
    if (tfa) {
      return { require2fa: true };
    }

    const sessionId = randomUUID();
    await this.redisService.setSession(sessionId, { userId: user.id });
    return { sessionId };
  }

  // --- 2FA ---
  async setup2fa(userId: string) {
    await this.prisma.twoFactorSecret.deleteMany({ where: { userId } });

    const secret = speakeasy.generateSecret();
    await this.prisma.twoFactorSecret.create({
      data: { userId, secret: secret.base32, enabled: false },
    });
    return { otpauth_url: secret.otpauth_url, secret: secret.base32 };
  }

  async enable2fa(userId: string, code: string) {
    const tfa = await this.prisma.twoFactorSecret.findFirst({
      where: { userId, enabled: false },
    });
    if (!tfa) throw new NotFoundException('2FA setup not found');
    const verified = speakeasy.totp.verify({
      secret: tfa.secret,
      encoding: 'base32',
      token: code,
    });
    if (!verified) throw new ForbiddenException('Invalid 2FA code');
    await this.prisma.twoFactorSecret.update({
      where: { id: tfa.id },
      data: { enabled: true },
    });
    await this.userClient.send({ cmd: 'enable-2fa' }, { userId }).toPromise();
    return { success: true };
  }

  async verify2fa(userId: string, code: string) {
    const tfa = await this.prisma.twoFactorSecret.findFirst({
      where: { userId, enabled: true },
    });
    if (!tfa) throw new NotFoundException('2FA not enabled');
    const verified = speakeasy.totp.verify({
      secret: tfa.secret,
      encoding: 'base32',
      token: code,
    });

    if (!verified) throw new ForbiddenException('Invalid 2FA code');

    const sessionId = randomUUID();
    await this.redisService.setSession(sessionId, { userId });
    return { sessionId };
  }

  async disable2fa(userId: string) {
    const tfa = await this.prisma.twoFactorSecret.findFirst({
      where: { userId, enabled: true },
    });
    if (!tfa) throw new NotFoundException('2FA not enabled');
    await this.prisma.twoFactorSecret.deleteMany({ where: { userId } });
    await this.userClient.send({ cmd: 'disable-2fa' }, { userId }).toPromise();
    return { success: true };
  }

  // --- Password Reset ---
  async requestPasswordReset(email: string) {
    const user = await this.userClient
      .send({ cmd: 'find-user' }, { email })
      .toPromise();
    if (!user) throw new NotFoundException('User not found');
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 15); // 15 minutes
    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt },
    });
    // TODO: send email with token
    return { token, expiresAt };
  }

  async resetPassword(token: string, newPassword: string) {
    const prt = await this.prisma.passwordResetToken.findUnique({
      where: { token },
    });
    if (!prt || prt.used || prt.expiresAt < new Date()) {
      await this.prisma.passwordResetToken
        .delete({ where: { token } })
        .catch(() => {});
      throw new BadRequestException('Invalid or expired token');
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.userClient
      .send(
        { cmd: 'update-user-password' },
        { userId: prt.userId, passwordHash },
      )
      .toPromise();
    await this.prisma.passwordResetToken.delete({ where: { token } });
    return { success: true };
  }

  async logout(sessionId: string) {
    if (!sessionId) throw new BadRequestException('No sessionId provided');
    await this.redisService.deleteSession(sessionId);
    return { success: true };
  }

  async logoutAll(userId: string) {
    const sessions = await this.redisService.getSessionsByUserId(userId);

    if (!sessions || sessions.length === 0) {
      return { success: true, message: 'No sessions found for this user' };
    }

    await this.redisService.deleteAllUserSessions(userId);
    return { success: true };
  }
}

// go register
// go login
// if 2fa is not enabled, u can login and cookies are set up
// if 2fa is enabled, u have to verify 2fa code and then cookies are set up on /verify

// to enable 2fa u have to go /2fa/setup
// then u have to scan qr code with authenticator app and enter code from app to /2fa/enable
// after that u can login with 2fa

// to disable 2fa u have to go /2fa/disable
