import { Global, Module } from '@nestjs/common';
import { QueueService } from './queue.service';
import { SweeperService } from './sweeper.service';

@Global()
@Module({ providers: [QueueService, SweeperService], exports: [QueueService, SweeperService] })
export class JobsModule {}
