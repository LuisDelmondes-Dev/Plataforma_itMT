import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class TaxonomiaService {
  constructor(private readonly db: DatabaseService) {}

  temas() {
    // RN-004: taxonomia é dado, não código
    return this.db
      .query(
        `SELECT t."TemaConsulta_Id" AS id, t."TemaConsulta_Nome" AS nome, t."TemaConsulta_Ordem" AS ordem,
                count(s.*) FILTER (WHERE s."SubtemaConsulta_Status" = 'DISPONIVEL') AS subtemas_disponiveis,
                count(s.*) AS subtemas_total
           FROM "TemaConsulta" t
           LEFT JOIN "SubtemaConsulta" s ON s."SubtemaConsulta_TemaId" = t."TemaConsulta_Id"
          GROUP BY 1,2,3 ORDER BY t."TemaConsulta_Ordem"`,
      )
      .then((r) => r.rows);
  }

  subtemas(temaId: number) {
    // RN-004: a UI nunca oferece subtema SEM_FONTE como disponível —
    // por isso o status viaja no payload.
    return this.db
      .query(
        `SELECT "SubtemaConsulta_Id" AS id, "SubtemaConsulta_Nome" AS nome, "SubtemaConsulta_Status" AS status
           FROM "SubtemaConsulta" WHERE "SubtemaConsulta_TemaId" = $1 ORDER BY nome`,
        [temaId],
      )
      .then((r) => r.rows);
  }

  indicadoresDoSubtema(subtemaId: number) {
    return this.db
      .query(
        `SELECT "Indicador_Id" AS id, "Indicador_Nome" AS nome, "Indicador_Unidade" AS unidade,
                "Indicador_TipoAgregacao" AS tipo_agregacao
           FROM "Indicador"
          WHERE "Indicador_SubtemaId" = $1
            AND "Indicador_StatusValidacao" = 'APROVADO'   -- RG-09: só o que tem parecer
          ORDER BY nome`,
        [subtemaId],
      )
      .then((r) => r.rows);
  }
}
