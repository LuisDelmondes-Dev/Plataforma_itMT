import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

/**
 * RF-ADMIN-007: área pública de transparência do próprio sistema —
 * inventário de bases (fontes), com base legal e licença.
 */
@Controller()
export class TransparenciaController {
  constructor(private readonly db: DatabaseService) {}

  @Get('fontes')
  async fontes() {
    const r = await this.db.query(
      `SELECT f."Fonte_Id" AS id, f."Fonte_Nome" AS nome, f."Fonte_Origem" AS origem,
              f."Fonte_Url" AS url, f."Fonte_BaseLegal" AS base_legal, f."Fonte_Licenca" AS licenca,
              f."Fonte_Periodicidade" AS periodicidade,
              max(c."Carga_DataExtracao")::text AS ultima_carga,
              count(c.*)::int AS cargas
         FROM "Fonte" f LEFT JOIN "Carga" c ON c."Carga_FonteId" = f."Fonte_Id"
        GROUP BY 1,2,3,4,5,6,7 ORDER BY f."Fonte_Id"`,
    );
    return r.rows;
  }
}
