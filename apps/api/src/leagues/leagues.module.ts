import { Global, Module } from '@nestjs/common';
import { LeaderboardsService } from './leaderboards.service';
import { LeaguesController } from './leagues.controller';
import { LeaguesService } from './leagues.service';

@Global()
@Module({ controllers: [LeaguesController], providers: [LeaguesService, LeaderboardsService], exports: [LeaguesService, LeaderboardsService] })
export class LeaguesModule {}
