import { Injectable } from '@nestjs/common';
import { loadConfig } from '../config';

/**
 * Single source of "now" for domain code. The offset can only be changed when test routes
 * are enabled (never in production), so e2e tests can move time past lockAt or the dispute window.
 */
@Injectable()
export class ClockService {
  private offsetMs = 0;

  now(): Date {
    return new Date(Date.now() + this.offsetMs);
  }

  setOffset(ms: number) {
    if (!loadConfig().testRoutes) throw new Error('clock offset is disabled');
    this.offsetMs = ms;
  }

  advance(ms: number) {
    this.setOffset(this.offsetMs + ms);
  }

  getOffset() {
    return this.offsetMs;
  }
}
