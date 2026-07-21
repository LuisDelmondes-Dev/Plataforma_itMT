import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface RegistroExecucao {
  agente: string;
  entrada?: unknown;
  saida?: unknown;
  modelo?: string;
  provedor?: string;
  tokensEntrada?: number;
  tokensSaida?: number;
  duracaoMs?: number;
  fontes?: unknown;
  ok?: boolean;
}

/**
 * Registry de execução de agentes (RF004): log operacional plugável que os
 * agentes (F5, Xingú) alimentam. MUTÁVEL e consultável — distinto da cadeia
 * imutável de auditoria. Nunca derruba o chamador: falha ao registrar é só log.
 */
@Injectable()
export class AgentExecutionService {
  private readonly log = new Logger('Registry');
  constructor(private readonly db: DatabaseService) {}

  async registrar(reg: RegistroExecucao): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO "AgentExecution"
           ("AgentExecution_Agente","AgentExecution_Entrada","AgentExecution_Saida",
            "AgentExecution_Modelo","AgentExecution_Provedor","AgentExecution_TokensEntrada",
            "AgentExecution_TokensSaida","AgentExecution_DuracaoMs","AgentExecution_Fontes","AgentExecution_Ok")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          reg.agente,
          reg.entrada != null ? JSON.stringify(reg.entrada) : null,
          reg.saida != null ? JSON.stringify(reg.saida) : null,
          reg.modelo ?? null,
          reg.provedor ?? null,
          reg.tokensEntrada ?? 0,
          reg.tokensSaida ?? 0,
          reg.duracaoMs ?? 0,
          reg.fontes != null ? JSON.stringify(reg.fontes) : null,
          reg.ok ?? true,
        ],
      );
    } catch (e) {
      this.log.warn(`falha ao registrar execução (${reg.agente}): ${(e as Error).message}`);
    }
  }

  async recentes(limite = 100) {
    const r = await this.db.query(
      `SELECT "AgentExecution_Id" AS id, "AgentExecution_Quando"::text AS quando,
              "AgentExecution_Agente" AS agente, "AgentExecution_Modelo" AS modelo,
              "AgentExecution_Provedor" AS provedor,
              "AgentExecution_TokensEntrada" AS tokens_entrada,
              "AgentExecution_TokensSaida" AS tokens_saida,
              "AgentExecution_DuracaoMs" AS duracao_ms, "AgentExecution_Ok" AS ok
         FROM "AgentExecution" ORDER BY "AgentExecution_Id" DESC LIMIT $1`,
      [Math.min(Math.max(1, limite), 500)],
    );
    return r.rows;
  }
}
