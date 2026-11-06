import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import type { User } from '@app/db';
import { AllowIncomplete, Public } from '../common/decorators';
import { QuestionsService } from './questions.service';

@Controller('questions')
export class QuestionsController {
  constructor(private qs: QuestionsService) {}

  /** Public feed (signed-out visitors can browse; forecasting needs an account). */
  @Public()
  @Get()
  feed(@Req() req: { user?: User }, @Query('category') category?: string) {
    return this.qs.feed(req.user ?? null, category || undefined);
  }

  @AllowIncomplete()
  @Get('warmup')
  warmup(@Req() req: { user: User }) {
    return this.qs.warmup(req.user);
  }

  @Public()
  @Get(':id')
  detail(@Param('id') id: string, @Req() req: { user?: User }) {
    return this.qs.detail(id, req.user ?? null);
  }
}
