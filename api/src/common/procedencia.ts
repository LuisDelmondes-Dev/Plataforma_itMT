/**
 * Quinteto de procedência (PRD §12.1).
 * Um número sem procedência não é publicável — é um bug, não uma limitação.
 */
export interface Procedencia {
  fonte: string;
  url: string | null;
  data_referencia: string;
  data_extracao: string;
  licenca: string;
  hash: string;
}

export interface ValorComProcedencia {
  valor: number;
  unidade: string;
  indicador: string;
  recorte: string;
  local: string;
  agregacao: string;
  municipios_agregados?: number;
  procedencia: Procedencia[];
}
