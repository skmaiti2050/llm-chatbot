import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './filters/http-exception.filter';
import { loadConfig } from './config/app.config';

async function bootstrap() {
  const config = loadConfig();
  const app = await NestFactory.create(AppModule);

  app.enableCors({ origin: config.corsOrigins, methods: ['GET', 'POST', 'PATCH', 'DELETE'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());

  const swagger = new DocumentBuilder()
    .setTitle('LLM Chatbot API')
    .setDescription('Chatbot with inference logging and ingestion pipeline')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, swagger);
  SwaggerModule.setup('docs', app, document);

  await app.listen(config.port);
}
bootstrap();
