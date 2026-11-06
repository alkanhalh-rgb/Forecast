import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ConsoleSmsProvider } from './sms/console.provider';
import { SMS_PROVIDER } from './sms/sms.provider';

@Module({
  controllers: [AuthController],
  providers: [AuthService, { provide: SMS_PROVIDER, useClass: ConsoleSmsProvider }],
  exports: [SMS_PROVIDER],
})
export class AuthModule {}
