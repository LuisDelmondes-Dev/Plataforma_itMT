import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('v1'); // RF-API-001: versionamento por caminho
  app.enableCors();
  await app.listen(process.env.PORT ? Number(process.env.PORT) : 3001);
}
bootstrap();
