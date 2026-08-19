import { Module } from '@nestjs/common';
import { TaxonomiaController } from './taxonomia.controller';
import { TaxonomiaService } from './taxonomia.service';

@Module({ controllers: [TaxonomiaController], providers: [TaxonomiaService], exports: [TaxonomiaService] })
export class TaxonomiaModule {}
