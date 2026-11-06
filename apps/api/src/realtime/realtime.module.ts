import { Global, Module } from '@nestjs/common';
import { loadConfig } from '../config';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';

@Global()
@Module({
  providers: loadConfig().API_ROLE === 'worker' ? [RealtimeService] : [RealtimeService, RealtimeGateway],
  exports: [RealtimeService],
})
export class RealtimeModule {}
