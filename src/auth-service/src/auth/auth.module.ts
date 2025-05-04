import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { RedisService } from '../redis';
import { SessionGuard } from '../../common/guards';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { AuthEventsController } from './auth.events';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'USER_SERVICE',
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [configService.get<string>('RABBITMQ_URL')],
            queue: configService.get<string>('RABBITMQ_QUEUE_USER'),
            queueOptions: { durable: true },
          },
        }),
      },
    ]),
  ],
  controllers: [AuthController, AuthEventsController],
  providers: [AuthService, RedisService, SessionGuard],
  exports: [AuthService],
})
export class AuthModule {}
