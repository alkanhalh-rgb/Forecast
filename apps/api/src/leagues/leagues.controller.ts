import { Controller, Get, Param, Req } from '@nestjs/common';
import type { User } from '@app/db';
import { CurrentUser, Public } from '../common/decorators';
import { LeaderboardsService } from './leaderboards.service';
import { LeaguesService } from './leagues.service';

@Controller()
export class LeaguesController {
  constructor(private leagues: LeaguesService, private boards: LeaderboardsService) {}

  @Get('leagues/me')
  me(@CurrentUser() u: User) {
    return this.leagues.myLeague(u.id);
  }

  @Public()
  @Get('leaderboards/week')
  week(@Req() req: { user?: User }) {
    return this.boards.week(req.user?.id ?? null);
  }

  @Public()
  @Get('leaderboards/season')
  season(@Req() req: { user?: User }) {
    return this.boards.season(req.user?.id ?? null);
  }

  @Public()
  @Get('leaderboards/category/:slug')
  category(@Param('slug') slug: string, @Req() req: { user?: User }) {
    return this.boards.category(slug, req.user?.id ?? null);
  }

  @Get('leaderboards/friends')
  friends(@CurrentUser() u: User) {
    return this.boards.friends(u.id);
  }
}
