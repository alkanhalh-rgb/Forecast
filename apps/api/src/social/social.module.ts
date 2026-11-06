import { Global, Module } from '@nestjs/common';
import { AchievementsService } from './achievements.service';
import { FriendsService } from './friends.service';
import { NotificationsService } from './notifications.service';
import { ShareCardsService } from './share-cards.service';
import { SocialController } from './social.controller';

@Global()
@Module({
  controllers: [SocialController],
  providers: [AchievementsService, FriendsService, NotificationsService, ShareCardsService],
  exports: [AchievementsService, NotificationsService, ShareCardsService],
})
export class SocialModule {}
