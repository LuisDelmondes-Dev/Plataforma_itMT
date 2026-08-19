import {
  BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable,
  NotFoundException, UnauthorizedException,
} from '@nestjs/common';
import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';
import { DatabaseService, TenantContext } from '../database/database.service';
import { AuditoriaService } from '../auditoria/auditoria.service';

export const ESCOPOS_API = ['catalogo:ler', 'indicadores:ler'] as const;
export type EscopoApi = typeof ESCOPOS_API[number];

const scrypt = promisify(scryptCallback);

export interface ApiClienteAutenticado {
  id: string;
  proprietario: string;
  nome: string;
  prefixo: string;
  escopos: string[];
  quota_minuto: number;
  quota_dia: number;
  restante_minuto: number;
  restante_dia: number;
}

@Injectable()
export class ApiKeysService {
  constructor(private readonly db: DatabaseService, private readonly trilha: AuditoriaService) {}

  private async hash(chave: string) {
    const pepper = process.env.API_KEY_PEPPER
      ?? (process.env.NODE_ENV === 'production' ? '' : 'itmt-api-key-pepper-apenas-desenvolvimento');
    if (pepper.length < 32) throw new Error('API_KEY_PEPPER ausente ou curto demais.');
    const derivada = await scrypt(chave, pepper, 32) as Buffer;
    return derivada.toString('hex');
  }

  async criar(
    proprietario: string,
    dto: { nome?: string; escopos?: string[]; quota_minuto?: number; quota_dia?: number; expira_em?: string },
    contexto: TenantContext,
  ) {
    const nome = dto.nome?.trim() ?? '';
    if (nome.length < 3 || nome.length > 100)
      throw new BadRequestException('nome deve ter entre 3 e 100 caracteres.');
    const escopos = [...new Set(dto.escopos === undefined ? ESCOPOS_API : dto.escopos)];
    if (escopos.length === 0) throw new BadRequestException('Selecione ao menos um escopo.');
    if (escopos.some((e) => !ESCOPOS_API.includes(e as EscopoApi)))
      throw new BadRequestException(`escopos permitidos: ${ESCOPOS_API.join(', ')}.`);
    const quotaMinuto = Number(dto.quota_minuto ?? 60);
    const quotaDia = Number(dto.quota_dia ?? 5000);
    if (!Number.isInteger(quotaMinuto) || quotaMinuto < 1 || quotaMinuto > 600)
      throw new BadRequestException('quota_minuto deve ser um inteiro entre 1 e 600.');
    if (!Number.isInteger(quotaDia) || quotaDia < quotaMinuto || quotaDia > 100000)
      throw new BadRequestException('quota_dia deve ser inteira, maior ou igual à quota por minuto e no máximo 100000.');
    let expiraEm: string | null = null;
    if (dto.expira_em) {
      const data = new Date(dto.expira_em);
      if (!Number.isFinite(data.getTime()) || data.getTime() <= Date.now())
        throw new BadRequestException('expira_em deve ser uma data futura válida.');
      expiraEm = data.toISOString();
    }

    const prefixo = randomBytes(6).toString('hex');
    const chave = `itmt_live_${prefixo}_${randomBytes(32).toString('base64url')}`;
    const hashChave = await this.hash(chave);
    const r = await this.db.withTenantTransaction(contexto, () => this.db.query<{ id: string; criada_em: string }>(
      `INSERT INTO "ApiCliente"
        ("ApiCliente_Proprietario","ApiCliente_Nome","ApiCliente_Prefixo","ApiCliente_HashChave",
         "ApiCliente_Escopos","ApiCliente_QuotaMinuto","ApiCliente_QuotaDia","ApiCliente_ExpiraEm")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING "ApiCliente_Id"::text AS id, "ApiCliente_CriadaEm"::text AS criada_em`,
      [proprietario, nome, prefixo, hashChave, escopos, quotaMinuto, quotaDia, expiraEm],
    ));
    await this.trilha.registrar(proprietario, 'CRIACAO_CHAVE_API', 'ApiCliente', r.rows[0].id, {
      nome, prefixo, escopos, quota_minuto: quotaMinuto, quota_dia: quotaDia, expira_em: expiraEm,
    }, contexto);
    return {
      ...r.rows[0], nome, prefixo, chave, escopos,
      quota_minuto: quotaMinuto, quota_dia: quotaDia, expira_em: expiraEm,
      aviso: 'Copie agora: a chave completa não será exibida novamente.',
    };
  }

  async listar(proprietario: string, contexto: TenantContext) {
    const r = await this.db.withTenantTransaction(contexto, () => this.db.query(
      `SELECT c."ApiCliente_Id"::text AS id, c."ApiCliente_Nome" AS nome,
              c."ApiCliente_Prefixo" AS prefixo, c."ApiCliente_Escopos" AS escopos,
              c."ApiCliente_QuotaMinuto" AS quota_minuto, c."ApiCliente_QuotaDia" AS quota_dia,
              c."ApiCliente_Status" AS status, c."ApiCliente_CriadaEm"::text AS criada_em,
              c."ApiCliente_ExpiraEm"::text AS expira_em,
              c."ApiCliente_UltimoUsoEm"::text AS ultimo_uso_em,
              COALESCE((SELECT sum(j."ApiConsumoJanela_Total")::int FROM "ApiConsumoJanela" j
                         WHERE j."ApiConsumoJanela_ClienteId" = c."ApiCliente_Id"
                           AND j."ApiConsumoJanela_Tipo" = 'DIA'
                           AND j."ApiConsumoJanela_Inicio" = date_trunc('day', now())), 0) AS consumo_hoje
         FROM "ApiCliente" c
        WHERE c."ApiCliente_Proprietario" = $1
        ORDER BY c."ApiCliente_CriadaEm" DESC`,
      [proprietario],
    ));
    return r.rows;
  }

  async revogar(id: number, proprietario: string, contexto: TenantContext) {
    const r = await this.db.withTenantTransaction(contexto, () => this.db.query<{ id: string; prefixo: string }>(
      `UPDATE "ApiCliente" SET "ApiCliente_Status"='REVOGADA', "ApiCliente_RevogadaEm"=now()
        WHERE "ApiCliente_Id"=$1 AND "ApiCliente_Proprietario"=$2 AND "ApiCliente_Status"='ATIVA'
        RETURNING "ApiCliente_Id"::text AS id, "ApiCliente_Prefixo" AS prefixo`,
      [id, proprietario],
    ));
    if (!r.rows[0]) throw new NotFoundException('Chave não encontrada ou já revogada.');
    await this.trilha.registrar(proprietario, 'REVOGACAO_CHAVE_API', 'ApiCliente', r.rows[0].id, {
      prefixo: r.rows[0].prefixo,
    }, contexto);
    return { id: r.rows[0].id, status: 'REVOGADA' };
  }

  async consumir(chave: string, escoposExigidos: string[]): Promise<ApiClienteAutenticado> {
    if (!chave || chave.length > 160) throw new UnauthorizedException('Chave de API ausente ou inválida.');
    const hash = await this.hash(chave);
    const envelope = await this.db.query<{ cliente_id: string; tenant_id: string; organizacao_id: string }>(
      `SELECT cliente_id::text,tenant_id::text,organizacao_id::text FROM "ResolverApiClientePorHash"($1)`, [hash],
    );
    const resolvido = envelope.rows[0];
    if (!resolvido) throw new UnauthorizedException('Chave de API inválida, expirada ou revogada.');
    return this.db.withTenantTransaction(
      { tenantId: resolvido.tenant_id, organizationId: resolvido.organizacao_id },
      async (client) => {
        const r = await client.query<{
          id: string; proprietario: string; nome: string; prefixo: string; escopos: string[];
          quota_minuto: number; quota_dia: number;
        }>(
          `SELECT "ApiCliente_Id"::text AS id, "ApiCliente_Proprietario" AS proprietario,
                  "ApiCliente_Nome" AS nome, "ApiCliente_Prefixo" AS prefixo,
                  "ApiCliente_Escopos" AS escopos, "ApiCliente_QuotaMinuto" AS quota_minuto,
                  "ApiCliente_QuotaDia" AS quota_dia
             FROM "ApiCliente"
            WHERE "ApiCliente_HashChave"=$1 AND "ApiCliente_Status"='ATIVA'
              AND ("ApiCliente_ExpiraEm" IS NULL OR "ApiCliente_ExpiraEm" > now())
            FOR UPDATE`,
          [hash],
        );
        const api = r.rows[0];
        if (!api) throw new UnauthorizedException('Chave de API inválida, expirada ou revogada.');
        if (escoposExigidos.some((e) => !api.escopos.includes(e)))
          throw new ForbiddenException(`A chave não possui o escopo exigido: ${escoposExigidos.join(', ')}.`);

        const janela = async (tipo: 'MINUTO' | 'DIA', limite: number) => {
          const unidade = tipo === 'MINUTO' ? 'minute' : 'day';
          const consumo = await client.query<{ total: number }>(
            `INSERT INTO "ApiConsumoJanela"
               ("ApiConsumoJanela_ClienteId","ApiConsumoJanela_Tipo","ApiConsumoJanela_Inicio","ApiConsumoJanela_Total")
             VALUES ($1,$2,date_trunc('${unidade}', now()),1)
             ON CONFLICT ("ApiConsumoJanela_ClienteId","ApiConsumoJanela_Tipo","ApiConsumoJanela_Inicio")
             DO UPDATE SET "ApiConsumoJanela_Total"="ApiConsumoJanela"."ApiConsumoJanela_Total"+1,
                           "ApiConsumoJanela_AtualizadaEm"=now()
             RETURNING "ApiConsumoJanela_Total" AS total`,
            [api.id, tipo],
          );
          const total = consumo.rows[0].total;
          if (total > limite)
            throw new HttpException(`Quota ${tipo.toLowerCase()} excedida.`, HttpStatus.TOO_MANY_REQUESTS);
          return limite - total;
        };
        const restanteMinuto = await janela('MINUTO', api.quota_minuto);
        const restanteDia = await janela('DIA', api.quota_dia);
        await client.query(
          `UPDATE "ApiCliente" SET "ApiCliente_UltimoUsoEm"=now() WHERE "ApiCliente_Id"=$1`, [api.id],
        );
        return { ...api, restante_minuto: restanteMinuto, restante_dia: restanteDia };
      },
    );
  }
}
