import { DynamicModule, Module } from '@nestjs/common';
import { loadConfig } from '../config';
import { AuthModule } from '../auth/auth.module';
import { TestRoutesController } from './test-routes.controller';

@Module({})
export class TestRoutesModule {
  static register(): DynamicModule {
    const enabled = loadConfig().testRoutes;
    return { module: TestRoutesModule, imports: [AuthModule], controllers: enabled ? [TestRoutesController] : [] };
  }
}
