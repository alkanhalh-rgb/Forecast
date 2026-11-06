import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { loadConfig } from './config';

async function main() {
  const cfg = loadConfig();
  const app = await NestFactory.create(AppModule, { logger: ['log', 'warn', 'error'] });
  configureApp(app);
  await app.listen(cfg.API_PORT, '0.0.0.0');
  console.log(`API listening on :${cfg.API_PORT} (role=${cfg.API_ROLE})`);
}
main();
