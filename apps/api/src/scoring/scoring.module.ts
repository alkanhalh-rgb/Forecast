import { Global, Module } from '@nestjs/common';
import { DisputesService } from './disputes.service';
import { ResolutionService } from './resolution.service';
import { ScoringController } from './scoring.controller';
import { ScoringService } from './scoring.service';

@Global()
@Module({ controllers: [ScoringController], providers: [ScoringService, ResolutionService, DisputesService], exports: [ScoringService, ResolutionService] })
export class ScoringModule {}
