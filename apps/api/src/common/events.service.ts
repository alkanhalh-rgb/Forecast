import { Injectable, Logger } from '@nestjs/common';

export interface DomainEventMap {
  /** a forecast was stored (first time or changed) */
  'forecast.saved': { userId: string; questionId: string; at: Date; first: boolean };
  /** scores were written/changed for a question */
  'question.scored': { questionId: string; reason: 'RESOLVED' | 'CORRECTED' | 'VOIDED' };
  'duel.decided': { duelId: string };
}

type Handler<K extends keyof DomainEventMap> = (e: DomainEventMap[K]) => Promise<unknown> | unknown;

/** In-process domain events. Handlers run sequentially and are awaited, so jobs stay consistent. */
@Injectable()
export class DomainEvents {
  private log = new Logger('Events');
  private handlers = new Map<string, Handler<any>[]>();

  on<K extends keyof DomainEventMap>(name: K, h: Handler<K>) {
    this.handlers.set(name, [...(this.handlers.get(name) ?? []), h]);
  }

  async emit<K extends keyof DomainEventMap>(name: K, e: DomainEventMap[K]) {
    for (const h of this.handlers.get(name) ?? []) {
      try {
        await h(e);
      } catch (err) {
        this.log.error(`${name} handler failed: ${(err as Error).stack}`);
      }
    }
  }
}
