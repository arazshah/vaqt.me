import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { createOriginCheckMiddleware } from './common/middleware/origin-check.middleware';
import { validateEnvOrExit } from './env-validation';

async function bootstrap() {
  // First statement, before any DB/Redis connection or listening socket is
  // opened by NestFactory.create() — a misconfigured secret must never
  // reach a running server. (Import statements above are hoisted by the
  // module system regardless of source order, so this can't be "above the
  // imports" — it just needs to run before NestFactory.create(), which it
  // does.)
  validateEnvOrExit();

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableShutdownHooks();

  // Explicit, not relying on Nest's default — ConversationsGateway
  // (conversations.gateway.ts) needs Socket.IO attached to this same HTTP
  // server so the WS upgrade shares the port the REST API already listens
  // on, rather than assuming an implicit default that could change.
  app.useWebSocketAdapter(new IoAdapter(app));

  app.use(cookieParser());

  // CSP is off — this is a JSON/WebSocket API with no server-rendered HTML
  // of its own (Swagger UI, the one exception, is dev-only below and ships
  // its own CSP-safe inline assets that a strict default policy would
  // block). crossOriginResourcePolicy is relaxed to cross-origin because
  // apps/web (a different origin/port) loads avatar images directly from
  // this server's /uploads static route.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  const webOrigin = process.env.WEB_ORIGIN || 'http://localhost:3000';
  app.use(createOriginCheckMiddleware(webOrigin));

  // فقط برای LocalDiskAdapter در dev — در production آواتارها از S3/Arvan سرو می‌شوند
  if ((process.env.STORAGE_PROVIDER ?? 'local') === 'local') {
    const uploadsRoot =
      process.env.LOCAL_STORAGE_DIR || join(process.cwd(), 'uploads');
    app.useStaticAssets(uploadsRoot, { prefix: '/uploads' });
  }

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // No global ValidationPipe here — every route validates explicitly.
  // AuthController is the one holdout still using class-validator DTOs
  // (from before the phase-3 move to zod), so it carries its own
  // controller-scoped ValidationPipe (see auth.controller.ts). Every other
  // controller uses nestjs-zod's createZodDto() + an explicit per-route
  // @UsePipes(new ZodValidationPipe(...)) (see CLAUDE.md bond 30). A
  // class-validator ValidationPipe applied globally would run against
  // those zod DTOs too — with whitelist+forbidNonWhitelisted, it strips
  // every property that has no class-validator decorator (which is all of
  // them, by design) and rejects the request. That's only reachable by
  // actually booting the app and hitting a zod-DTO route over real HTTP;
  // every existing controller test calls the controller method directly
  // and never exercises this pipe at all, which is how it went unnoticed
  // until the phase-5 requests endpoints were curl-tested live.

  // CORS
  app.enableCors({
    origin: process.env.WEB_ORIGIN || 'http://localhost:3000',
    credentials: true,
  });

  // Swagger documentation — dev/staging only. Exposing the full API schema
  // (every route, DTO shape, auth requirement) at a public, unauthenticated
  // URL in production is unnecessary information disclosure.
  const swaggerEnabled = process.env.NODE_ENV !== 'production';
  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('Vaqt.me API')
      .setDescription('بازار دقیقه‌های انسانی')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  const port = process.env.PORT ? Number(process.env.PORT) : 3001;
  await app.listen(port);

  console.log(`🚀 API running on http://localhost:${String(port)}`);
  if (swaggerEnabled) {
    console.log(`📚 Docs available at http://localhost:${String(port)}/docs`);
  }
}

void bootstrap();
