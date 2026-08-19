import { Module } from '@nestjs/common';
import { ParticipacaoAdminController, ParticipacaoPublicaController } from './participacao.controller';
@Module({ controllers:[ParticipacaoPublicaController,ParticipacaoAdminController] })
export class ParticipacaoModule {}
