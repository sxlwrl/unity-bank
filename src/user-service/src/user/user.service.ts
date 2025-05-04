import {
  Injectable,
  Inject,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma';
import { UserStatus } from '../../common/types/user-status';
import { RpcException } from '@nestjs/microservices';
import * as bcrypt from 'bcryptjs';
import { UpdateProfileDto } from './dto';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('AUTH_SERVICE') private readonly authClient: ClientProxy,
  ) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findByPhone(phone: string) {
    return this.prisma.user.findUnique({ where: { phone } });
  }

  async create(data: any) {
    const exists = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: data.email }, { phone: data.phone }],
      },
    });

    if (exists)
      throw new RpcException({
        status: 409,
        message: 'User with this email or phone already exists',
      });

    if (data.dateOfBirth) data.dateOfBirth = new Date(data.dateOfBirth);

    const VALID_STATUSES: UserStatus[] = ['active', 'blocked', 'unverified'];

    if (data.status) {
      if (!VALID_STATUSES.includes(data.status)) {
        throw new BadRequestException('Invalid status value');
      }
    } else {
      data.status = 'unverified';
    }

    return this.prisma.user.create({ data });
  }

  async delete(id: string) {
    return this.prisma.user.delete({ where: { id } });
  }

  async updatePassword(userId: string, passwordHash: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }

  async updateProfile(id: string, data: UpdateProfileDto) {
    const updateData: any = {};
    console.log('updateProfile payload:', data);
    if (data.email) updateData.email = data.email;
    if (data.phone) updateData.phone = data.phone;
    if (data.password)
      updateData.passwordHash = await bcrypt.hash(data.password, 10);

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('No data to update');
    }
    return this.prisma.user.update({ where: { id }, data: updateData });
  }

  async enable2FA(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true },
    });
  }

  async disable2FA(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false },
    });
  }
}
