import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { DatabaseService, TenantContext } from '../database/database.service';

@Injectable()
export class OrganizacoesService {
  constructor(private readonly db: DatabaseService) {}

  listarPlanos() {
    return this.db.query(
      `SELECT "PlanoComercial_Codigo" AS codigo,"PlanoComercial_Nome" AS nome,
              "PlanoComercial_Limites" AS limites,"PlanoComercial_PrecoCentavo" AS preco_centavo
         FROM "PlanoComercial" WHERE "PlanoComercial_Ativo" ORDER BY "PlanoComercial_PrecoCentavo"`,
    ).then((r) => r.rows);
  }

  obterAssinatura(contexto: TenantContext) {
    return this.db.withTenantTransaction(contexto, async (client) => {
      const r = await client.query(
        `SELECT a."Assinatura_Id"::text AS id,a."Assinatura_Status" AS status,
                a."Assinatura_InicioEm"::text AS inicio_em,a."Assinatura_FimEm"::text AS fim_em,
                a."Assinatura_TrialFimEm"::text AS trial_fim_em,a."Assinatura_Versao"::int AS versao,
                p."PlanoComercial_Codigo" AS plano_codigo,p."PlanoComercial_Nome" AS plano_nome,
                p."PlanoComercial_Limites" AS limites,p."PlanoComercial_PrecoCentavo" AS preco_centavo
           FROM "Assinatura" a JOIN "PlanoComercial" p ON p."PlanoComercial_Id"=a."Assinatura_PlanoId"
          WHERE a."Assinatura_TenantId"=$1 AND a."Assinatura_OrganizacaoId"=$2`,
        [contexto.tenantId, contexto.organizationId],
      );
      return r.rows[0] ?? null;
    });
  }

  async alterarAssinatura(contexto: TenantContext & { membershipPapel: string }, planoCodigo: string) {
    if (!['OWNER', 'ADMIN'].includes(contexto.membershipPapel))
      throw new ForbiddenException('Apenas OWNER ou ADMIN pode alterar a assinatura.');
    if (!/^[A-Z][A-Z0-9_]{2,31}$/.test(planoCodigo)) throw new BadRequestException('Plano inválido.');
    await this.db.withTenantTransaction(contexto, async (client) => {
      const plano = await client.query<{ id: string }>(
        `SELECT "PlanoComercial_Id"::text AS id FROM "PlanoComercial"
          WHERE "PlanoComercial_Codigo"=$1 AND "PlanoComercial_Ativo"`, [planoCodigo],
      );
      if (!plano.rows[0]) throw new BadRequestException('Plano indisponível.');
      await client.query(
        `INSERT INTO "Assinatura" ("Assinatura_TenantId","Assinatura_OrganizacaoId","Assinatura_PlanoId",
          "Assinatura_Status","Assinatura_TrialFimEm") VALUES ($1,$2,$3,'TRIAL',now()+interval '14 days')
         ON CONFLICT ("Assinatura_TenantId","Assinatura_OrganizacaoId") DO UPDATE SET
          "Assinatura_PlanoId"=EXCLUDED."Assinatura_PlanoId","Assinatura_Status"='TRIAL',
          "Assinatura_TrialFimEm"=now()+interval '14 days',"Assinatura_FimEm"=NULL,
          "Assinatura_Versao"="Assinatura"."Assinatura_Versao"+1,"Assinatura_AtualizadaEm"=now()`,
        [contexto.tenantId, contexto.organizationId, plano.rows[0].id],
      );
    });
    return this.obterAssinatura(contexto);
  }

  obterUso(contexto: TenantContext) {
    return this.db.withTenantTransaction(contexto, async (client) => {
      const r = await client.query(
        `SELECT "UsoPlano_Metrica" AS metrica,"UsoPlano_Periodo"::text AS periodo,
                "UsoPlano_Quantidade"::text AS quantidade
           FROM "UsoPlano" WHERE "UsoPlano_TenantId"=$1 AND "UsoPlano_OrganizacaoId"=$2
          ORDER BY "UsoPlano_Periodo" DESC,"UsoPlano_Metrica"`,
        [contexto.tenantId, contexto.organizationId],
      );
      return r.rows;
    });
  }

  listarConfiguracoes(contexto: TenantContext) {
    return this.db.withTenantTransaction(contexto, async (client) => {
      const r = await client.query(
        `SELECT "OrganizacaoConfiguracao_Chave" AS chave,
                "OrganizacaoConfiguracao_Valor" AS valor,
                "OrganizacaoConfiguracao_AtualizadaEm"::text AS atualizada_em
           FROM "OrganizacaoConfiguracao"
          WHERE "OrganizacaoConfiguracao_TenantId"=$1
            AND "OrganizacaoConfiguracao_OrganizacaoId"=$2
          ORDER BY "OrganizacaoConfiguracao_Chave"`,
        [contexto.tenantId, contexto.organizationId],
      );
      return r.rows;
    });
  }

  salvarConfiguracao(
    contexto: TenantContext & { membershipPapel: string },
    chave: string,
    valor: unknown,
  ) {
    if (!['OWNER', 'ADMIN'].includes(contexto.membershipPapel))
      throw new ForbiddenException('Apenas OWNER ou ADMIN da organização pode alterar configurações.');
    if (!/^[a-z][a-z0-9_.-]{0,99}$/i.test(chave)) throw new BadRequestException('Chave de configuração inválida.');
    const serializado = JSON.stringify(valor);
    if (serializado === undefined || Buffer.byteLength(serializado) > 32_768)
      throw new BadRequestException('Valor de configuração inválido ou maior que 32 KiB.');
    return this.db.withTenantTransaction(contexto, async (client) => {
      const r = await client.query(
        `INSERT INTO "OrganizacaoConfiguracao"
           ("OrganizacaoConfiguracao_TenantId","OrganizacaoConfiguracao_OrganizacaoId",
            "OrganizacaoConfiguracao_Chave","OrganizacaoConfiguracao_Valor")
         VALUES ($1,$2,$3,$4::jsonb)
         ON CONFLICT ("OrganizacaoConfiguracao_TenantId","OrganizacaoConfiguracao_OrganizacaoId","OrganizacaoConfiguracao_Chave")
         DO UPDATE SET "OrganizacaoConfiguracao_Valor"=EXCLUDED."OrganizacaoConfiguracao_Valor",
                       "OrganizacaoConfiguracao_AtualizadaEm"=now()
         RETURNING "OrganizacaoConfiguracao_Chave" AS chave,
                   "OrganizacaoConfiguracao_Valor" AS valor`,
        [contexto.tenantId, contexto.organizationId, chave, serializado],
      );
      return r.rows[0];
    });
  }
}
