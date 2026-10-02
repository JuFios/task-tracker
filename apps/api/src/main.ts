import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppConfig } from './config/configuration';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: false,
  });
  const config = app.get(AppConfig);

  app.setGlobalPrefix('api');
  // Behind nginx (docker) X-Forwarded-For carries the real client IP; without
  // this every request shares the proxy's IP and the /auth/login rate limit
  // becomes global. One hop = exactly our single nginx proxy.
  app.set('trust proxy', 1);
  app.use(helmet());
  app.enableCors({
    origin: config.corsOrigins,
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Task Tracker API')
    .setDescription(
      'Task Tracker — workspaces, projects, Kanban tasks with realtime collaboration.'
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Task Tracker API Docs',
  });

  await app.listen(config.port);
  console.log(`API listening on http://localhost:${config.port}/api`);
  console.log(`Swagger docs:  http://localhost:${config.port}/api/docs`);
}

void bootstrap();
