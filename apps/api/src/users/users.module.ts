import { Module } from '@nestjs/common';
import { PrivacyController } from './privacy.controller';
import { PrivacyService } from './privacy.service';
import { UsersController } from './users.controller';

@Module({ controllers: [UsersController, PrivacyController], providers: [PrivacyService] })
export class UsersModule {}
