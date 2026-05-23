import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { IngestionModule } from './ingestion/ingestion.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule, IngestionModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
