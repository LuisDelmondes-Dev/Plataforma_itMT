import { Module } from '@nestjs/common';
import { ConformidadeController } from './conformidade.controller';
@Module({ controllers: [ConformidadeController] })
export class ConformidadeModule {}
