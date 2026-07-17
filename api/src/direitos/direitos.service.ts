import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

/**
 * F4 — Mapa de Direitos. O serviço é 100% determinístico: o motor
 * "Descubra seus direitos" (§8 do prompt mestre) só afirma o que as
 * regras de banco permitem afirmar. Renda, perícia e condições
 * específicas NUNCA são decididas aqui (F4-RG-06): viram sempre
 * "precisa de avaliação", com o motivo explicitado.
 */

export interface PerfilCidadao {
  idade?: number;
  cadunico?: boolean;
  contribuinte_inss?: boolean;
  deficiencia?: boolean;
  doenca_grave?: boolean;
  gestante?: boolean;
  estudante?: boolean;
  desempregado?: boolean;
  zona_rural?: boolean;
  cuidador?: boolean;
  trabalhador_formal?: boolean;
  recebe?: number[]; // ids de direitos/benefícios já recebidos
}

interface Regra {
  direito_id: number;
  fator: string;
  valor: number | null;
  efeito: 'REQUISITO' | 'AVALIACAO';
  descricao: string;
}

const AVISO_LEGAL =
  'Orientação geral, não substitui atendimento jurídico, médico, previdenciário ou social individualizado. ' +
  'Diagnóstico não significa automaticamente incapacidade; doença não significa automaticamente deficiência; ' +
  'deficiência não significa automaticamente benefício financeiro. Limites de renda e valores mudam ' +
  'periodicamente — confirme sempre no órgão responsável.';

@Injectable()
export class DireitosService {
  constructor(private readonly db: DatabaseService) {}

  async listar(f: { area?: string; publico?: string; confianca?: string; q?: string; pouco_conhecidos?: boolean }) {
    const cond: string[] = [`d."Direito_Status" = 'PUBLICADO'`];
    const par: unknown[] = [];
    if (f.area) { par.push(f.area); cond.push(`d."Direito_Area" = $${par.length}`); }
    if (f.confianca) { par.push(f.confianca); cond.push(`d."Direito_Confianca" = $${par.length}`); }
    if (f.q) { par.push(`%${f.q}%`); cond.push(`(unaccent(d."Direito_Nome") ILIKE unaccent($${par.length}) OR unaccent(d."Direito_Resumo") ILIKE unaccent($${par.length}))`); }
    if (f.pouco_conhecidos) cond.push(`d."Direito_PoucoConhecido"`);
    if (f.publico) {
      par.push(f.publico);
      cond.push(`EXISTS (SELECT 1 FROM "DireitoPublico" dp JOIN "PublicoAlvo" p ON p."PublicoAlvo_Id"=dp."DireitoPublico_PublicoId"
                  WHERE dp."DireitoPublico_DireitoId"=d."Direito_Id" AND p."PublicoAlvo_Slug"=$${par.length})`);
    }
    const r = await this.db.query(
      `SELECT d."Direito_Id" AS id, d."Direito_Nome" AS nome, d."Direito_Area" AS area,
              d."Direito_Resumo" AS resumo, d."Direito_Gratuidade" AS gratuidade,
              d."Direito_Abrangencia" AS abrangencia, d."Direito_Confianca" AS confianca,
              d."Direito_ExigeContribuicaoInss" AS exige_inss,
              (d."Direito_CriterioRenda" IS NOT NULL) AS depende_de_renda,
              d."Direito_Automatico" AS automatico, d."Direito_PoucoConhecido" AS pouco_conhecido,
              d."Direito_DataVerificacao"::text AS data_verificacao
         FROM "Direito" d
        WHERE ${cond.join(' AND ')}
        ORDER BY d."Direito_Area", d."Direito_Nome"`, par);
    return r.rows;
  }

  async areas() {
    const r = await this.db.query(
      `SELECT "Direito_Area" AS area, count(*)::int AS direitos
         FROM "Direito" WHERE "Direito_Status"='PUBLICADO' GROUP BY 1 ORDER BY 1`);
    return r.rows;
  }

  async publicos() {
    const r = await this.db.query(
      `SELECT p."PublicoAlvo_Slug" AS slug, p."PublicoAlvo_Nome" AS nome,
              count(dp.*)::int AS direitos
         FROM "PublicoAlvo" p
         LEFT JOIN "DireitoPublico" dp ON dp."DireitoPublico_PublicoId" = p."PublicoAlvo_Id"
         LEFT JOIN "Direito" d ON d."Direito_Id" = dp."DireitoPublico_DireitoId" AND d."Direito_Status"='PUBLICADO'
        GROUP BY 1,2 ORDER BY p."PublicoAlvo_Nome"`);
    return r.rows;
  }

  async condicoes() {
    const r = await this.db.query(
      `SELECT c."CondicaoSaude_Slug" AS slug, c."CondicaoSaude_Nome" AS nome, c."CondicaoSaude_Tipo" AS tipo,
              count(dc.*)::int AS direitos_associados
         FROM "CondicaoSaude" c
         LEFT JOIN "DireitoCondicao" dc ON dc."DireitoCondicao_CondicaoId" = c."CondicaoSaude_Id"
        GROUP BY 1,2,3 ORDER BY c."CondicaoSaude_Nome"`);
    return r.rows;
  }

  async ficha(id: number) {
    const r = await this.db.query(
      `SELECT * FROM "Direito" WHERE "Direito_Id"=$1 AND "Direito_Status"='PUBLICADO'`, [id]);
    if (!r.rows[0]) throw new NotFoundException('Direito não encontrado ou não publicado.');
    const d = r.rows[0] as Record<string, unknown>;

    const [publicos, condicoes, regras, incompat] = await Promise.all([
      this.db.query(
        `SELECT p."PublicoAlvo_Slug" AS slug, p."PublicoAlvo_Nome" AS nome
           FROM "DireitoPublico" dp JOIN "PublicoAlvo" p ON p."PublicoAlvo_Id"=dp."DireitoPublico_PublicoId"
          WHERE dp."DireitoPublico_DireitoId"=$1 ORDER BY p."PublicoAlvo_Nome"`, [id]),
      this.db.query(
        `SELECT c."CondicaoSaude_Nome" AS nome, c."CondicaoSaude_Tipo" AS tipo,
                dc."DireitoCondicao_Observacao" AS observacao
           FROM "DireitoCondicao" dc JOIN "CondicaoSaude" c ON c."CondicaoSaude_Id"=dc."DireitoCondicao_CondicaoId"
          WHERE dc."DireitoCondicao_DireitoId"=$1 ORDER BY c."CondicaoSaude_Nome"`, [id]),
      this.db.query(
        `SELECT "RegraElegibilidade_Fator" AS fator, "RegraElegibilidade_ValorNumerico" AS valor,
                "RegraElegibilidade_Efeito" AS efeito, "RegraElegibilidade_Descricao" AS descricao
           FROM "RegraElegibilidade" WHERE "RegraElegibilidade_DireitoId"=$1
          ORDER BY "RegraElegibilidade_Efeito", "RegraElegibilidade_Id"`, [id]),
      this.db.query(
        `SELECT CASE WHEN i."IncompatibilidadeBeneficio_DireitoA"=$1
                     THEN i."IncompatibilidadeBeneficio_DireitoB" ELSE i."IncompatibilidadeBeneficio_DireitoA" END AS direito_id,
                d."Direito_Nome" AS nome, i."IncompatibilidadeBeneficio_Descricao" AS descricao
           FROM "IncompatibilidadeBeneficio" i
           JOIN "Direito" d ON d."Direito_Id" = CASE WHEN i."IncompatibilidadeBeneficio_DireitoA"=$1
                     THEN i."IncompatibilidadeBeneficio_DireitoB" ELSE i."IncompatibilidadeBeneficio_DireitoA" END
          WHERE $1 IN (i."IncompatibilidadeBeneficio_DireitoA", i."IncompatibilidadeBeneficio_DireitoB")`, [id]),
    ]);

    // §2.13 — sinalizar desatualização: verificação com mais de 180 dias
    const dataVerif = d['Direito_DataVerificacao'] as Date | null;
    const desatualizada = dataVerif
      ? (Date.now() - new Date(dataVerif).getTime()) / 86400000 > 180
      : true;

    const ficha: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(d)) ficha[k.replace('Direito_', '').toLowerCase()] = v;
    const isoData = (v: Date) =>
      `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
    return {
      ...ficha,
      data_verificacao: dataVerif ? isoData(new Date(dataVerif)) : null,
      verificacao_desatualizada: desatualizada,
      publicos: publicos.rows,
      condicoes: condicoes.rows,
      regras: regras.rows,
      incompatibilidades: incompat.rows,
      aviso_legal: AVISO_LEGAL,
    };
  }

  /**
   * §8 — "Descubra todos os seus direitos". Motor determinístico:
   * REQUISITO não atendido       → não elegível, com o motivo;
   * REQUISITO com dado ausente   → precisa de avaliação ("informe X");
   * qualquer regra AVALIACAO     → precisa de avaliação, com o critério;
   * todos os REQUISITOs atendidos e nenhuma AVALIACAO → provável.
   * Direitos já recebidos geram alerta de incompatibilidade.
   */
  async descubra(perfil: PerfilCidadao) {
    const direitos = await this.listar({});
    const rs = await this.db.query(
      `SELECT "RegraElegibilidade_DireitoId" AS direito_id, "RegraElegibilidade_Fator" AS fator,
              "RegraElegibilidade_ValorNumerico" AS valor, "RegraElegibilidade_Efeito" AS efeito,
              "RegraElegibilidade_Descricao" AS descricao
         FROM "RegraElegibilidade" ORDER BY "RegraElegibilidade_Id"`);
    const regras = rs.rows as Regra[];

    const provaveis: unknown[] = [];
    const precisamAvaliacao: unknown[] = [];
    const naoElegiveis: unknown[] = [];

    for (const d of direitos as { id: number; nome: string; area: string }[]) {
      const doDireito = regras.filter((r) => r.direito_id === d.id);
      const motivosAvaliacao: string[] = [];
      const motivosExclusao: string[] = [];

      for (const r of doDireito) {
        const res = this.avaliar(r, perfil);
        if (res === 'NAO_ATENDE') motivosExclusao.push(r.descricao);
        else if (res === 'AVALIACAO') motivosAvaliacao.push(r.descricao);
      }

      if (motivosExclusao.length) naoElegiveis.push({ ...d, motivos: motivosExclusao });
      else if (motivosAvaliacao.length) precisamAvaliacao.push({ ...d, criterios_a_verificar: motivosAvaliacao });
      else provaveis.push(d);
    }

    // Incompatibilidades com o que a pessoa declara já receber
    const incompativeis: unknown[] = [];
    if (perfil.recebe?.length) {
      const inc = await this.db.query(
        `SELECT i."IncompatibilidadeBeneficio_DireitoA" AS a, i."IncompatibilidadeBeneficio_DireitoB" AS b,
                da."Direito_Nome" AS nome_a, db."Direito_Nome" AS nome_b,
                i."IncompatibilidadeBeneficio_Descricao" AS descricao
           FROM "IncompatibilidadeBeneficio" i
           JOIN "Direito" da ON da."Direito_Id"=i."IncompatibilidadeBeneficio_DireitoA"
           JOIN "Direito" db ON db."Direito_Id"=i."IncompatibilidadeBeneficio_DireitoB"
          WHERE i."IncompatibilidadeBeneficio_DireitoA" = ANY($1::int[])
             OR i."IncompatibilidadeBeneficio_DireitoB" = ANY($1::int[])`, [perfil.recebe]);
      for (const row of inc.rows as { a: number; b: number; nome_a: string; nome_b: string; descricao: string }[]) {
        const recebido = perfil.recebe.includes(row.a) ? row.a : row.b;
        const outro = recebido === row.a ? { id: row.b, nome: row.nome_b } : { id: row.a, nome: row.nome_a };
        incompativeis.push({ recebe: recebido, incompativel_com: outro, descricao: row.descricao });
      }
    }

    return {
      provaveis,
      precisam_avaliacao: precisamAvaliacao,
      nao_elegiveis: naoElegiveis,
      incompatibilidades: incompativeis,
      fatores_informados: Object.keys(perfil).filter((k) => (perfil as Record<string, unknown>)[k] !== undefined),
      aviso_legal: AVISO_LEGAL,
    };
  }

  private avaliar(r: Regra, p: PerfilCidadao): 'ATENDE' | 'NAO_ATENDE' | 'AVALIACAO' {
    if (r.efeito === 'AVALIACAO') return 'AVALIACAO'; // F4-RG-06: o motor nunca decide renda/perícia/condição específica
    const bool = (v: boolean | undefined) =>
      v === undefined ? 'AVALIACAO' : v ? 'ATENDE' : 'NAO_ATENDE';
    switch (r.fator) {
      case 'IDADE_MIN':
        return p.idade === undefined ? 'AVALIACAO' : p.idade >= Number(r.valor) ? 'ATENDE' : 'NAO_ATENDE';
      case 'IDADE_MAX':
        return p.idade === undefined ? 'AVALIACAO' : p.idade <= Number(r.valor) ? 'ATENDE' : 'NAO_ATENDE';
      case 'CADUNICO': return bool(p.cadunico);
      case 'CONTRIBUINTE_INSS': return bool(p.contribuinte_inss);
      case 'DEFICIENCIA': return bool(p.deficiencia);
      case 'DOENCA_GRAVE': return bool(p.doenca_grave);
      case 'GESTANTE': return bool(p.gestante);
      case 'ESTUDANTE': return bool(p.estudante);
      case 'DESEMPREGADO': return bool(p.desempregado);
      case 'ZONA_RURAL': return bool(p.zona_rural);
      case 'CUIDADOR': return bool(p.cuidador);
      case 'TRABALHADOR_FORMAL': return bool(p.trabalhador_formal);
      default: return 'AVALIACAO';
    }
  }
}
