import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { validateEnvOrExit } from './env-validation';

async function bootstrap() {
  // First statement, before any DB/Redis connection or listening socket is
  // opened by NestFactory.create() — a misconfigured secret must never
  // reach a running server. (Import statements above are hoisted by the
  // module system regardless of source order, so this can't be "above the
  // imports" — it just needs to run before NestFactory.create(), which it
  // does.)
  validateEnvOrExit();

  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  app.use(cookieParser());

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS
  app.enableCors({
    origin: process.env.WEB_ORIGIN || 'http://localhost:3000',
    credentials: true,
  });

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Vaqt.me API')
    .setDescription('بازار دقیقه‌های انسانی')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT ? Number(process.env.PORT) : 3001;
  await app.listen(port);

  console.log(`🚀 API running on http://localhost:${String(port)}`);
  console.log(`📚 Docs available at http://localhost:${String(port)}/docs`);
}

void bootstrap();
