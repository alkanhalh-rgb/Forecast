import { Global, Module } from '@nestjs/common';
import { AdminController } from '../admin/admin.controller';
import { AdminQuestionsService } from '../admin/admin-questions.service';
import { ForecastsController } from '../forecasts/forecasts.controller';
import { ForecastsService } from '../forecasts/forecasts.service';
import { CrowdService } from './crowd.service';
import { LifecycleService } from './lifecycle.service';
import { QuestionsController } from './questions.controller';
import { QuestionsService } from './questions.service';

@Global()
@Module({
  controllers: [QuestionsController, ForecastsController, AdminController],
  providers: [QuestionsService, CrowdService, LifecycleService, ForecastsService, AdminQuestionsService],
  exports: [QuestionsService, CrowdService, LifecycleService, ForecastsService],
})
export class QuestionsModule {}
