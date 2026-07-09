import { Module } from '@nestjs/common';
import { TerritorioController } from './territorio.controller';
import { TerritorioService } from './territorio.service';

@Module({
  controllers: [TerritorioController],
  providers: [TerritorioService],
  exports: [TerritorioService],
})
export class TerritorioModule {}
