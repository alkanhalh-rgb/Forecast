import { Body, Controller, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { z } from 'zod';
import type { User } from '@app/db';
import { attestationSchema, questionInputSchema, TemplateKey, TEMPLATES } from '@app/shared';
import { CurrentUser, Roles, STAFF } from '../common/decorators';
import { PrismaService } from '../common/prisma.service';
import { parse } from '../common/zod';
import { AdminQuestionsService } from './admin-questions.service';

const noteSchema = z.object({ note: z.string().trim().min(2).max(1000) });
const templateSchema = z.object({ params: z.record(z.string()) });

@Controller('admin')
@Roles(...STAFF)
export class AdminController {
  constructor(private svc: AdminQuestionsService, private prisma: PrismaService) {}

  @Get('questions')
  list(@Query('status') status?: string) {
    return this.svc.list(status || undefined);
  }

  @Get('questions/:id')
  get(@Param('id') id: string) {
    return this.svc.get(id);
  }

  @Roles('EDITOR', 'ADMIN')
  @Post('questions')
  create(@CurrentUser() u: User, @Body() body: unknown) {
    return this.svc.create(u, parse(questionInputSchema, body));
  }

  @Roles('EDITOR', 'ADMIN')
  @Put('questions/:id')
  update(@CurrentUser() u: User, @Param('id') id: string, @Body() body: unknown) {
    return this.svc.update(u, id, parse(questionInputSchema, body));
  }

  @Roles('EDITOR', 'ADMIN')
  @Post('questions/:id/submit')
  @HttpCode(200)
  submit(@CurrentUser() u: User, @Param('id') id: string, @Body() body: unknown) {
    return this.svc.submit(u, id, parse(attestationSchema.partial(), body));
  }

  @Roles('REVIEWER', 'ADMIN')
  @Post('questions/:id/approve')
  @HttpCode(200)
  approve(@CurrentUser() u: User, @Param('id') id: string, @Body() body: unknown) {
    return this.svc.approve(u, id, parse(attestationSchema.partial(), body));
  }

  @Roles('REVIEWER', 'ADMIN')
  @Post('questions/:id/reject')
  @HttpCode(200)
  reject(@CurrentUser() u: User, @Param('id') id: string, @Body() body: unknown) {
    return this.svc.reject(u, id, parse(noteSchema, body).note);
  }

  @Get('templates')
  templates() {
    return TEMPLATES;
  }

  @Roles('EDITOR', 'ADMIN')
  @Post('templates/:key')
  fromTemplate(@CurrentUser() u: User, @Param('key') key: string, @Body() body: unknown) {
    return this.svc.createFromTemplate(u, key as TemplateKey, parse(templateSchema, body).params);
  }

  @Get('audit')
  audit(@Query('entityId') entityId?: string) {
    return this.prisma.auditLog.findMany({ where: entityId ? { entityId } : {}, orderBy: { createdAt: 'desc' }, take: 200 });
  }
}
