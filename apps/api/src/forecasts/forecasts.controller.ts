import { Body, Controller, Get, HttpCode, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { User } from '@app/db';
import { forecastSchema } from '@app/shared';
import { CurrentUser, RateLimit } from '../common/decorators';
import { PrismaService } from '../common/prisma.service';
import { parse } from '../common/zod';
import { ForecastsService } from './forecasts.service';

@Controller('forecasts')
export class ForecastsController {
  constructor(private forecasts: ForecastsService, private prisma: PrismaService) {}

  @Post()
  @HttpCode(200)
  @RateLimit({ name: 'forecast', limit: 30, windowSec: 60 })
  async create(@CurrentUser() user: User, @Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const input = parse(forecastSchema, body);
    const out = await this.forecasts.submit(user, input);
    if (out.status === 'queued') res.status(202);
    return out;
  }

  /** My forecasts with their scores, newest first. */
  @Get('mine')
  async mine(@CurrentUser() user: User) {
    const rows = await this.prisma.forecast.findMany({
      where: { userId: user.id },
      include: { question: { include: { category: true, resolution: true } }, score: true },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });
    return rows.map((f) => ({
      questionId: f.questionId,
      textAr: f.question.textAr,
      textEn: f.question.textEn,
      status: f.question.status,
      optionId: f.optionId,
      options: f.question.options,
      confidence: f.confidence,
      points: f.score?.points ?? null,
      correct: f.score?.correct ?? null,
      updatedAt: f.updatedAt,
    }));
  }
}
