import { Controller, Get, Module } from '@nestjs/common';
import { Public } from '../common/decorators';
import { PrismaService } from '../common/prisma.service';

@Controller('categories')
export class CategoriesController {
  constructor(private prisma: PrismaService) {}

  @Public()
  @Get()
  list() {
    return this.prisma.category.findMany({ orderBy: { slug: 'asc' } });
  }
}

@Module({ controllers: [CategoriesController] })
export class CategoriesModule {}
