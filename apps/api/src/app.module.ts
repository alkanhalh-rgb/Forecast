import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { CategoriesModule } from './categories/categories.controller';
import { AppGuard } from './common/app.guard';
import { CommonModule } from './common/common.module';
import { HealthController } from './health.controller';
import { JobsModule } from './jobs/jobs.module';
import { UsersModule } from './users/users.module';
import { QuestionsModule } from './questions/questions.module';
import { RealtimeModule } from './realtime/realtime.module';
import { ScoringModule } from './scoring/scoring.module';
import { LeaguesModule } from './leagues/leagues.module';
import { TestRoutesModule } from './test-routes/test-routes.module';

@Module({
  imports: [CommonModule, JobsModule, RealtimeModule, AuthModule, QuestionsModule, ScoringModule, LeaguesModule, UsersModule, CategoriesModule, TestRoutesModule.register()],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: AppGuard }],
})
export class AppModule {}
