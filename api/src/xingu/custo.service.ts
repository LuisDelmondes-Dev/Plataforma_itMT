import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

/**
 * A15 — Custo. Governador de gasto do LLM: registra o consumo de tokens
 * por borda/provedor e aplica tetos diário/mensal. Estourou o teto ⇒
 * `dentroDoOrcamento()` = false ⇒ a Xingú usa o léxico (RG-05, mesmo
 * caminho de degradação já existente). Tetos por env:
 *   XINGU_TETO_TOKENS_DIA (default 500000), XINGU_TETO_TOKENS_MES (5000000).
 * Teto 0 = ilimitado.
 */
@Injectable()
export class CustoService {
  private readonly log = new Logger('Xingu.A15');
  private readonly tetoDia = CustoService.teto('XINGU_TETO_TOKENS_DIA', 500_000);
  private readonly tetoMes = CustoService.teto('XINGU_TETO_TOKENS_MES', 5_000_000);

  /**
   * Leitura defensiva do teto (EV-20260822-053). `Number('500k')` é `NaN`, e
   * `NaN` é *falsy* — com o cast cru, `if (this.tetoDia && ...)` era pulado e o
   * teto do dia ficava **silenciosamente desligado**: um typo no env desarmava
   * o governador de gasto sem nenhum sinal. Governador de custo tem de falhar
   * seguro, então valor inválido cai no padrão e grita no log. `0` continua
   * significando ilimitado — é semântica documentada, não erro.
   */
  private static teto(variavel: string, padrao: number): number {
    const bruto = process.env[variavel];
    if (bruto === undefined || bruto === '') return padrao;
    const n = Number(bruto);
    if (!Number.isFinite(n) || n < 0) {
      new Logger('Xingu.A15').error(
        `${variavel}="${bruto}" não é um número válido — usando o padrão ${padrao}. ` +
          'Corrija o env: teto inválido não pode virar gasto ilimitado.',
      );
      return padrao;
    }
    return n;
  }
  // Cache curto para não somar o banco a cada pergunta.
  private cache: { quando: number; dia: number; mes: number } | null = null;
  private static readonly CACHE_MS = 30_000;

  constructor(private readonly db: DatabaseService) {}

  private async consumo(): Promise<{ dia: number; mes: number }> {
    const agora = Date.now();
    if (this.cache && agora - this.cache.quando < CustoService.CACHE_MS) {
      return { dia: this.cache.dia, mes: this.cache.mes };
    }
    const r = await this.db.query<{ dia: string; mes: string }>(
      `SELECT
         coalesce(sum("ConsumoLlm_TokensEntrada" + "ConsumoLlm_TokensSaida")
           FILTER (WHERE "ConsumoLlm_Quando" >= date_trunc('day', now())), 0) AS dia,
         coalesce(sum("ConsumoLlm_TokensEntrada" + "ConsumoLlm_TokensSaida")
           FILTER (WHERE "ConsumoLlm_Quando" >= date_trunc('month', now())), 0) AS mes
       FROM "ConsumoLlm"`,
    );
    const dia = Number(r.rows[0]?.dia ?? 0);
    const mes = Number(r.rows[0]?.mes ?? 0);
    this.cache = { quando: agora, dia, mes };
    return { dia, mes };
  }

  /** True se ainda há orçamento; sempre true se os tetos forem 0 (ilimitado). */
  async dentroDoOrcamento(): Promise<boolean> {
    if (!this.tetoDia && !this.tetoMes) return true;
    const c = await this.consumo();
    if (this.tetoDia && c.dia >= this.tetoDia) return false;
    if (this.tetoMes && c.mes >= this.tetoMes) return false;
    return true;
  }

  /** Registra um consumo e invalida o cache. */
  async registrar(borda: 'A01' | 'A05' | 'SITUACAO', provedor: string, entrada = 0, saida = 0): Promise<void> {
    if (!entrada && !saida) return; // léxico ou sem usage — nada a registrar
    try {
      await this.db.query(
        `INSERT INTO "ConsumoLlm"
           ("ConsumoLlm_Provedor","ConsumoLlm_Borda","ConsumoLlm_TokensEntrada","ConsumoLlm_TokensSaida")
         VALUES ($1,$2,$3,$4)`,
        [provedor, borda, entrada, saida],
      );
      this.cache = null;
    } catch (e) {
      this.log.warn(`falha ao registrar consumo: ${(e as Error).message}`);
    }
  }

  /** Resumo para o endpoint /xingu/custo e para o /situacao. */
  async resumo() {
    const c = await this.consumo();
    return {
      tokens_dia: c.dia,
      tokens_mes: c.mes,
      teto_dia: this.tetoDia || null,
      teto_mes: this.tetoMes || null,
      dentro_do_orcamento: await this.dentroDoOrcamento(),
    };
  }
}
