import { Controller } from '@nestjs/common';
import {
  MessagePattern,
  Payload,
} from '@nestjs/microservices';
import { UserService } from './user.service';

@Controller()
export class UserEventsController {
  constructor(private readonly userService: UserService) {}

  @MessagePattern({ cmd: 'create-user' })
  async createUser(@Payload() data: any) {
    return this.userService.create(data);
  }

  @MessagePattern({ cmd: 'find-user' })
  async findUser(@Payload() data: { email?: string; phone?: string }) {
    if (data.email) {
      return this.userService.findByEmail(data.email);
    }
    if (data.phone) {
      return this.userService.findByPhone(data.phone);
    }
    return null;
  }

  @MessagePattern({ cmd: 'update-user-password' })
  async updateUserPassword(
    @Payload() data: { userId: string; passwordHash: string },
  ) {
    return this.userService.updatePassword(data.userId, data.passwordHash);
  }

  @MessagePattern({ cmd: 'enable-2fa' })
  async enable2FA(@Payload() data: { userId: string }) {
    return this.userService.enable2FA(data.userId);
  }

  @MessagePattern({ cmd: 'disable-2fa' })
  async disable2FA(@Payload() data: { userId: string }) {
    return this.userService.disable2FA(data.userId);
  }
}
