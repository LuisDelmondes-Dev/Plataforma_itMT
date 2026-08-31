/**
 * Fase de homologação do dado NA FONTE (E3/ADR-010, "Observacao_StatusDado",
 * db/60). Ausente/undefined = desconhecido: a fonte não documenta a fase e o
 * motor omite o campo em vez de chutar (ausência honesta, irmã da RN-005).
 */
export type StatusDado = 'PRELIMINAR' | 'CONSOLIDADO' | 'REVISADO';

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
  /** E3: presente só quando a fase de homologação é conhecida (não-NULL no banco). */
  status_dado?: StatusDado;
}

export interface ValorComProcedencia {
  valor: number;
  unidade: string;
  indicador: string;
  recorte: string;
  local: string;
  agregacao: string;
  municipios_agregados?: number;
  /**
   * E3: status agregado das parcelas que formaram o valor — o PIOR vence
   * (PRELIMINAR contamina); parcela de status desconhecido impede afirmar
   * CONSOLIDADO/REVISADO (campo omitido: não se afirma o que não se sabe).
   */
  status_dado?: StatusDado;
  procedencia: Procedencia[];
}
