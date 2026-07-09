import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export type Recorte = 'ESTADO' | 'MUNICIPIO' | 'RGINT' | 'RGI' | 'CONSORCIO';

/**
 * Resolvedor Territorial (agente A02, camada determinística).
 * Todo recorte agregado é resolvido para um conjunto de codigo_ibge (RN-001);
 * consórcios são resolvidos NA DATA DE REFERÊNCIA do indicador (RN-002).
 */
@Injectable()
export class TerritorioService {
  constructor(private readonly db: DatabaseService) {}

  listarMunicipios(q?: string) {
    if (q) {
      return this.db
        .query(
          `SELECT "Municipio_CodigoIbge" AS codigo_ibge, "Municipio_Nome" AS nome,
                  "Municipio_CodigoRgi" AS codigo_rgi, "Municipio_CodigoRgint" AS codigo_rgint,
                  "Municipio_AreaKm2" AS area_km2
             FROM "Municipio"
            WHERE unaccent(lower("Municipio_Nome")) LIKE unaccent(lower($1)) || '%'
               OR lower("Municipio_Nome") LIKE lower($1) || '%'
            ORDER BY "Municipio_Nome"`,
          [q],
        )
        .then((r) => r.rows)
        .catch(() =>
          // fallback quando a extensão unaccent não está instalada
          this.db
            .query(
              `SELECT "Municipio_CodigoIbge" AS codigo_ibge, "Municipio_Nome" AS nome,
                      "Municipio_CodigoRgi" AS codigo_rgi, "Municipio_CodigoRgint" AS codigo_rgint,
                      "Municipio_AreaKm2" AS area_km2
                 FROM "Municipio"
                WHERE lower("Municipio_Nome") LIKE lower($1) || '%'
                ORDER BY "Municipio_Nome"`,
              [q],
            )
            .then((r) => r.rows),
        );
    }
    return this.db
      .query(
        `SELECT "Municipio_CodigoIbge" AS codigo_ibge, "Municipio_Nome" AS nome,
                "Municipio_CodigoRgi" AS codigo_rgi, "Municipio_CodigoRgint" AS codigo_rgint,
                "Municipio_AreaKm2" AS area_km2
           FROM "Municipio" ORDER BY "Municipio_Nome"`,
      )
      .then((r) => r.rows);
  }

  async obterMunicipio(codigoIbge: string) {
    const r = await this.db.query(
      `SELECT m."Municipio_CodigoIbge" AS codigo_ibge, m."Municipio_Nome" AS nome,
              m."Municipio_AreaKm2" AS area_km2,
              rgi."RegiaoImediata_Nome" AS regiao_imediata,
              rgint."RegiaoIntermediaria_Nome" AS regiao_intermediaria
         FROM "Municipio" m
         JOIN "RegiaoImediata" rgi ON rgi."RegiaoImediata_Codigo" = m."Municipio_CodigoRgi"
         JOIN "RegiaoIntermediaria" rgint ON rgint."RegiaoIntermediaria_Codigo" = m."Municipio_CodigoRgint"
        WHERE m."Municipio_CodigoIbge" = $1`,
      [codigoIbge],
    );
    if (!r.rows[0]) throw new NotFoundException(`Município ${codigoIbge} não encontrado.`);
    return r.rows[0];
  }

  listarRegioes() {
    return Promise.all([
      this.db.query(
        `SELECT "RegiaoIntermediaria_Codigo" AS codigo, "RegiaoIntermediaria_Nome" AS nome FROM "RegiaoIntermediaria" ORDER BY 2`,
      ),
      this.db.query(
        `SELECT "RegiaoImediata_Codigo" AS codigo, "RegiaoImediata_Nome" AS nome, "RegiaoImediata_CodigoRgint" AS codigo_rgint FROM "RegiaoImediata" ORDER BY 2`,
      ),
    ]).then(([rgint, rgi]) => ({ intermediarias: rgint.rows, imediatas: rgi.rows }));
  }

  listarConsorcios() {
    return this.db
      .query(
        `SELECT "Consorcio_Id" AS id, "Consorcio_Nome" AS nome, "Consorcio_Tipo" AS tipo FROM "Consorcio" ORDER BY 2`,
      )
      .then((r) => r.rows);
  }

  /**
   * Resolve um recorte para o conjunto de municípios que o compõe.
   * @param dataReferencia usada APENAS para consórcio (RN-002).
   */
  async resolverRecorte(
    recorte: Recorte,
    codigo: string | null,
    dataReferencia: string,
  ): Promise<{ codigos: string[]; rotulo: string }> {
    switch (recorte) {
      case 'ESTADO': {
        const r = await this.db.query<{ c: string }>(
          `SELECT "Municipio_CodigoIbge" AS c FROM "Municipio"`,
        );
        return { codigos: r.rows.map((x) => x.c), rotulo: 'Mato Grosso' };
      }
      case 'MUNICIPIO': {
        const m = await this.obterMunicipio(codigo!);
        return { codigos: [codigo!], rotulo: m.nome };
      }
      case 'RGINT': {
        const r = await this.db.query<{ c: string; n: string }>(
          `SELECT m."Municipio_CodigoIbge" AS c, rg."RegiaoIntermediaria_Nome" AS n
             FROM "Municipio" m
             JOIN "RegiaoIntermediaria" rg ON rg."RegiaoIntermediaria_Codigo" = m."Municipio_CodigoRgint"
            WHERE m."Municipio_CodigoRgint" = $1`,
          [codigo],
        );
        if (!r.rows.length) throw new NotFoundException(`RGInt ${codigo} não encontrada.`);
        return { codigos: r.rows.map((x) => x.c), rotulo: `RGInt ${r.rows[0].n}` };
      }
      case 'RGI': {
        const r = await this.db.query<{ c: string; n: string }>(
          `SELECT m."Municipio_CodigoIbge" AS c, rg."RegiaoImediata_Nome" AS n
             FROM "Municipio" m
             JOIN "RegiaoImediata" rg ON rg."RegiaoImediata_Codigo" = m."Municipio_CodigoRgi"
            WHERE m."Municipio_CodigoRgi" = $1`,
          [codigo],
        );
        if (!r.rows.length) throw new NotFoundException(`RGI ${codigo} não encontrada.`);
        return { codigos: r.rows.map((x) => x.c), rotulo: `RGI ${r.rows[0].n}` };
      }
      case 'CONSORCIO': {
        // RN-002: composição resolvida na data de referência do indicador
        const r = await this.db.query<{ c: string; n: string }>(
          `SELECT cm."ConsorcioMunicipio_CodigoIbge" AS c, co."Consorcio_Nome" AS n
             FROM "ConsorcioMunicipio" cm
             JOIN "Consorcio" co ON co."Consorcio_Id" = cm."ConsorcioMunicipio_ConsorcioId"
            WHERE cm."ConsorcioMunicipio_ConsorcioId" = $1
              AND cm."ConsorcioMunicipio_DataInicio" <= $2::date
              AND (cm."ConsorcioMunicipio_DataFim" IS NULL OR cm."ConsorcioMunicipio_DataFim" >= $2::date)`,
          [codigo, dataReferencia],
        );
        if (!r.rows.length)
          throw new NotFoundException(
            `Consórcio ${codigo} sem membros na data de referência ${dataReferencia}.`,
          );
        return { codigos: r.rows.map((x) => x.c), rotulo: r.rows[0].n };
      }
    }
  }
}
