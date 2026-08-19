import { Module } from '@nestjs/common';
import { InteroperabilidadeController } from './interoperabilidade.controller';

@Module({ controllers: [InteroperabilidadeController] })
export class InteroperabilidadeModule {}
