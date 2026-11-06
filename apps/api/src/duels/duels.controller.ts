import { Body, Controller, Get, HttpCode, Param, Post, Req } from '@nestjs/common';
import type { User } from '@app/db';
import { duelAcceptSchema, duelAnswerSchema, duelCreateSchema } from '@app/shared';
import { CurrentUser, Public, RateLimit } from '../common/decorators';
import { parse } from '../common/zod';
import { DuelsService } from './duels.service';

@Controller('duels')
export class DuelsController {
  constructor(private duels: DuelsService) {}

  @Post()
  @RateLimit({ name: 'duel-create', limit: 10, windowSec: 3600 })
  create(@CurrentUser() u: User, @Body() body: unknown) {
    return this.duels.create(u, parse(duelCreateSchema, body));
  }

  @Get()
  mine(@CurrentUser() u: User) {
    return this.duels.mine(u.id);
  }

  @Get('rating/me')
  rating(@CurrentUser() u: User) {
    return this.duels.myRating(u.id);
  }

  /** Shared links can be opened before signing in. */
  @Public()
  @Get(':id')
  view(@Param('id') id: string, @Req() req: { user?: User }) {
    return this.duels.view(id, req.user?.id ?? null);
  }

  @Post(':id/accept')
  @HttpCode(200)
  @RateLimit({ name: 'duel-accept', limit: 20, windowSec: 3600 })
  accept(@CurrentUser() u: User, @Param('id') id: string, @Body() body: unknown) {
    return this.duels.accept(u, id, parse(duelAcceptSchema, body));
  }

  @Post(':id/answer')
  @HttpCode(200)
  answer(@CurrentUser() u: User, @Param('id') id: string, @Body() body: unknown) {
    return this.duels.answer(u, id, parse(duelAnswerSchema, body));
  }
}
