import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import type { User } from '@app/db';
import { correctionSchema, disputeDecisionSchema, disputeSchema, resolveSchema, voidSchema } from '@app/shared';
import { CurrentUser, RateLimit, Roles, STAFF } from '../common/decorators';
import { parse } from '../common/zod';
import { DisputesService } from './disputes.service';
import { ResolutionService } from './resolution.service';
import { ScoringService } from './scoring.service';

@Controller()
export class ScoringController {
  constructor(private res: ResolutionService, private disputes: DisputesService, private scoring: ScoringService) {}

  @Roles('EDITOR', 'ADMIN')
  @Post('admin/questions/:id/resolve')
  @HttpCode(200)
  propose(@CurrentUser() u: User, @Param('id') id: string, @Body() body: unknown) {
    return this.res.propose(u, id, parse(resolveSchema, body));
  }

  @Roles(...STAFF)
  @Post('admin/questions/:id/confirm')
  @HttpCode(200)
  confirm(@CurrentUser() u: User, @Param('id') id: string) {
    return this.res.confirm(u, id);
  }

  @Roles('EDITOR', 'ADMIN')
  @Post('admin/questions/:id/void')
  @HttpCode(200)
  void(@CurrentUser() u: User, @Param('id') id: string, @Body() body: unknown) {
    const { reason, note } = parse(voidSchema, body);
    return this.res.void(u, id, reason, note);
  }

  @Roles('ADMIN')
  @Post('admin/questions/:id/correct')
  @HttpCode(200)
  correct(@CurrentUser() u: User, @Param('id') id: string, @Body() body: unknown) {
    return this.res.correct(u, id, parse(correctionSchema, body));
  }

  @Roles(...STAFF)
  @Get('admin/disputes')
  list(@Query('status') status?: string) {
    return this.disputes.list(status || undefined);
  }

  @Roles('ADMIN', 'REVIEWER')
  @Post('admin/disputes/:id/decide')
  @HttpCode(200)
  decide(@CurrentUser() u: User, @Param('id') id: string, @Body() body: unknown) {
    const { decision, note } = parse(disputeDecisionSchema, body);
    return this.disputes.decide(u, id, decision, note);
  }

  @Post('questions/:id/disputes')
  @RateLimit({ name: 'dispute', limit: 10, windowSec: 3600 })
  report(@CurrentUser() u: User, @Param('id') id: string, @Body() body: unknown) {
    return this.disputes.report(u, id, parse(disputeSchema, body));
  }

  @Get('me/stats')
  stats(@CurrentUser() u: User) {
    return this.scoring.stats(u.id);
  }
}
