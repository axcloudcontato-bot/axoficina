import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { initSentry } from './shared/observability/sentry';

async function bootstrap() {
  initSentry();
  // bodyParser desligado no create() porque o parser automático do Nest só é
  // anexado ao Express DEPOIS dos app.use() chamados em configureApp() —
  // sem isso, snakeToCamelMiddleware via req.body sempre `undefined`.
  // configureApp() registra json/urlencoded manualmente antes do middleware
  // de conversão, garantindo a ordem correta.
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  // Feature 2 (IAM) introduz autenticação — CORS agora restrito a uma lista
  // explícita de origens em vez de wildcard.
  const corsOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim());
  app.enableCors({ origin: corsOrigins });

  configureApp(app);

  const port = process.env.BACKEND_PORT ?? 3001;
  await app.listen(port);
}

bootstrap();
