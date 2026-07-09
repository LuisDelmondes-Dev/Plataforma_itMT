import { Module } from '@nestjs/common';
import { TransparenciaController } from './transparencia.controller';

@Module({ controllers: [TransparenciaController] })
export class TransparenciaModule {}
