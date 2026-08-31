// ============================================================
// pesquisas.unit.mjs — Gauntlet "Pesquisa vs IA Xingú", peça P1 (db/48).
// Prova, contra o banco descartável da suíte:
//   1. as 9 tabelas existem com RLS ENABLE+FORCE e policy dupla (USING e
//      WITH CHECK), e itmt_app tem SELECT+INSERT mas NUNCA UPDATE/DELETE
//      (pesquisa concluída é imutável por grant);
//   2. INSERT como itmt_app SEM contexto tenant é negado (fail-closed) e
//      COM contexto plataforma funciona;
//   3. o CHECK pesquisasugestao_origem_obrigatoria veta sugestão órfã
//      (sem FK de dado-origem) por SQL direto;
//   4. roundtrip gravar→reabrir POR SQL DIRETO (INSERTs + SELECTs) sobre o
//      snapshot sintético (indicador 1, municípios do seed): a estrutura
//      persistida devolve exatamente o que entrou.
// DECISÃO DOCUMENTADA: o roundtrip via PesquisasService (TypeScript
// compilado) não é exercitado aqui — importar dist/ em .mjs acoplaria o
// teste ao build do Nest; a integração service+controller será coberta no
// e2e da P4 (que sobe a API real). Este arquivo prova o CONTRATO DE BANCO,
// que é o que a migração 48 entrega.
// ============================================================
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';

const TENANT = '00000000-0000-4000-8000-000000000001'; // plataforma (db/25)
const ORG = '00000000-0000-4000-8000-000000000002';

const TABELAS = [
  'Pesquisa', 'PesquisaIndicador', 'PesquisaIndicadorMunicipio',
  'PesquisaSerieHistorica', 'PesquisaCausa', 'PesquisaDashboard',
  'PesquisaSugestao', 'PesquisaFonte', 'PesquisaExecucaoAgente',
];

let owner; // dono (DATABASE_URL da suíte) — verificação de catálogo e limpeza
let app;   // itmt_app — o papel real da API, sujeito a RLS e grants
let pesquisaId; // criada no roundtrip; limpa no after()

async function contexto(cliente, fn) {
  await cliente.query('BEGIN');
  try {
    await cliente.query(
      `SELECT set_config('app.tenant_id',$1,true), set_config('app.organization_id',$2,true)`,
      [TENANT, ORG],
    );
    const resultado = await fn();
    await cliente.query('COMMIT');
    return resultado;
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  }
}

before(async () => {
  owner = new pg.Client({ connectionString: process.env.DATABASE_URL });
  const appUrl = new URL(process.env.DATABASE_URL);
  appUrl.username = 'itmt_app';
  appUrl.password = 'itmt_app';
  app = new pg.Client({ connectionString: appUrl.toString() });
  await owner.connect();
  await app.connect();
});

after(async () => {
  // Banco compartilhado pelas 29 suítes: remove o que este arquivo criou
  // (owner é superuser no descartável; CASCADE limpa as filhas).
  if (pesquisaId) await owner.query(`DELETE FROM "Pesquisa" WHERE "Pesquisa_Id" = $1`, [pesquisaId]);
  await app?.end();
  await owner?.end();
});

test('db/48: as 9 tabelas existem com RLS FORCE, policy USING+WITH CHECK e grants imutáveis', async () => {
  for (const t of TABELAS) {
    const r = await owner.query(
      `SELECT c.relrowsecurity AS rls, c.relforcerowsecurity AS force_rls,
              (SELECT count(*)::int FROM pg_policies
                WHERE schemaname='public' AND tablename=$1
                  AND qual IS NOT NULL AND with_check IS NOT NULL) AS policies_completas,
              has_table_privilege('itmt_app', format('%I', $1), 'SELECT') AS pode_select,
              has_table_privilege('itmt_app', format('%I', $1), 'INSERT') AS pode_insert,
              has_table_privilege('itmt_app', format('%I', $1), 'UPDATE') AS pode_update,
              has_table_privilege('itmt_app', format('%I', $1), 'DELETE') AS pode_delete
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = $1`,
      [t],
    );
    assert.equal(r.rows.length, 1, `tabela "${t}" não existe`);
    assert.deepEqual(
      r.rows[0],
      { rls: true, force_rls: true, policies_completas: 1,
        pode_select: true, pode_insert: true, pode_update: false, pode_delete: false },
      `contrato de segurança violado em "${t}"`,
    );
  }
});

test('db/48: INSERT sem contexto tenant é negado (fail-closed); com contexto plataforma funciona', async () => {
  const inserir = (cliente) => cliente.query(
    `INSERT INTO "Pesquisa"
       ("Pesquisa_TenantId","Pesquisa_OrganizacaoId","Pesquisa_Modo","Pesquisa_Pergunta",
        "Pesquisa_Recorte","Pesquisa_Estado","Pesquisa_VersaoMotor","Pesquisa_Hash")
     VALUES ($1,$2,'pesquisa','fail-closed?','ESTADO','RESPONDIDA','teste/0','${'0'.repeat(64)}')
     RETURNING "Pesquisa_Id" AS id`,
    [TENANT, ORG],
  );
  // Sem set_config: "ContextoTenant_Id"() é NULL, o WITH CHECK reprova.
  // A mensagem do Postgres é localizada (pt-BR nesta máquina); o SQLSTATE
  // 42501 (insufficient_privilege) é o contrato estável do veto RLS.
  await assert.rejects(inserir(app), (e) => e.code === '42501', 'INSERT sem contexto deveria ser vetado pelo RLS');
  await app.query('ROLLBACK').catch(() => {}); // limpa a transação abortada implícita, se houver

  const r = await contexto(app, () => inserir(app));
  assert.match(r.rows[0].id, /^[0-9a-f-]{36}$/);
  await owner.query(`DELETE FROM "Pesquisa" WHERE "Pesquisa_Id" = $1`, [r.rows[0].id]);
});

test('db/48: sugestão sem nenhuma FK de dado-origem é impossível por CHECK', async () => {
  await contexto(app, async () => {
    const p = await app.query(
      `INSERT INTO "Pesquisa"
         ("Pesquisa_TenantId","Pesquisa_OrganizacaoId","Pesquisa_Modo","Pesquisa_Pergunta",
          "Pesquisa_Recorte","Pesquisa_Estado","Pesquisa_VersaoMotor","Pesquisa_Hash")
       VALUES ($1,$2,'xingu','sugestão órfã?','ESTADO','RESPONDIDA','teste/0','${'1'.repeat(64)}')
       RETURNING "Pesquisa_Id" AS id`,
      [TENANT, ORG],
    );
    await assert.rejects(
      app.query(
        `INSERT INTO "PesquisaSugestao"
           ("PesquisaSugestao_TenantId","PesquisaSugestao_OrganizacaoId","PesquisaSugestao_PesquisaId",
            "PesquisaSugestao_Texto","PesquisaSugestao_PraticaCitada","PesquisaSugestao_Agente")
         VALUES ($1,$2,$3,'sem origem','prática qualquer','a16-sugestoes')`,
        [TENANT, ORG, p.rows[0].id],
      ),
      /pesquisasugestao_origem_obrigatoria/,
      'CHECK de origem obrigatória não vetou sugestão órfã',
    );
    // o rejects deixou a transação abortada; o helper dá ROLLBACK ao propagar
    throw new Error('rollback-intencional');
  }).catch((e) => { if (e.message !== 'rollback-intencional') throw e; });
});

test('db/48: roundtrip por SQL direto — snapshot completo entra e sai idêntico das 9 tabelas', async () => {
  const snapshot = {
    pergunta: 'Quais municípios têm mais leitos de UTI?',
    municipios: [
      { cod: '5103403', valor: '120', posicao: 1, topN: true, delta: '35.5' },
      { cod: '5108402', valor: '45', posicao: 2, topN: true, delta: '-39.5' },
    ],
  };

  pesquisaId = await contexto(app, async () => {
    const p = await app.query(
      `INSERT INTO "Pesquisa"
         ("Pesquisa_TenantId","Pesquisa_OrganizacaoId","Pesquisa_Modo","Pesquisa_Pergunta","Pesquisa_Area",
          "Pesquisa_Recorte","Pesquisa_Estado","Pesquisa_VersaoMotor","Pesquisa_Hash")
       VALUES ($1,$2,'xingu',$3,'Saúde','ESTADO','RESPONDIDA','itmt-api/0.1.0','${'a'.repeat(64)}')
       RETURNING "Pesquisa_Id" AS id`,
      [TENANT, ORG, snapshot.pergunta],
    );
    const pid = p.rows[0].id;

    const ind = await app.query(
      `INSERT INTO "PesquisaIndicador"
         ("PesquisaIndicador_TenantId","PesquisaIndicador_OrganizacaoId","PesquisaIndicador_PesquisaId",
          "PesquisaIndicador_IndicadorId","PesquisaIndicador_Nome","PesquisaIndicador_Valor",
          "PesquisaIndicador_Unidade","PesquisaIndicador_DataReferencia","PesquisaIndicador_Agregacao",
          "PesquisaIndicador_MunicipiosAgregados")
       VALUES ($1,$2,$3,1,'Leitos de UTI',165,'leitos','2025-12-31','SOMA',2)
       RETURNING "PesquisaIndicador_Id" AS id`,
      [TENANT, ORG, pid],
    );
    const indId = ind.rows[0].id;

    let primeiroMunicipioId = null;
    for (const m of snapshot.municipios) {
      const rm = await app.query(
        `INSERT INTO "PesquisaIndicadorMunicipio"
           ("PesquisaIndicadorMunicipio_TenantId","PesquisaIndicadorMunicipio_OrganizacaoId",
            "PesquisaIndicadorMunicipio_PesquisaIndicadorId","PesquisaIndicadorMunicipio_CodigoIbge",
            "PesquisaIndicadorMunicipio_Valor","PesquisaIndicadorMunicipio_Posicao",
            "PesquisaIndicadorMunicipio_TopN","PesquisaIndicadorMunicipio_DeltaMediaEstadual")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING "PesquisaIndicadorMunicipio_Id" AS id`,
        [TENANT, ORG, indId, m.cod, m.valor, m.posicao, m.topN, m.delta],
      );
      primeiroMunicipioId = primeiroMunicipioId ?? rm.rows[0].id;
    }

    await app.query(
      `INSERT INTO "PesquisaSerieHistorica"
         ("PesquisaSerieHistorica_TenantId","PesquisaSerieHistorica_OrganizacaoId",
          "PesquisaSerieHistorica_PesquisaIndicadorId","PesquisaSerieHistorica_Ano",
          "PesquisaSerieHistorica_Valor","PesquisaSerieHistorica_Categoria")
       VALUES ($1,$2,$3,2024,150,'OBSERVADO'),($1,$2,$3,2025,165,'OBSERVADO'),($1,$2,$3,2026,171,'PROJECAO')`,
      [TENANT, ORG, indId],
    );

    await app.query(
      `INSERT INTO "PesquisaCausa"
         ("PesquisaCausa_TenantId","PesquisaCausa_OrganizacaoId","PesquisaCausa_PesquisaIndicadorId",
          "PesquisaCausa_CodigoIbge","PesquisaCausa_Dimensao","PesquisaCausa_Categoria",
          "PesquisaCausa_Periodo","PesquisaCausa_Valor")
       VALUES ($1,$2,$3,'5103403','COMPONENTE','neonatal precoce','2025',12)`,
      [TENANT, ORG, indId],
    );

    await app.query(
      `INSERT INTO "PesquisaDashboard"
         ("PesquisaDashboard_TenantId","PesquisaDashboard_OrganizacaoId","PesquisaDashboard_PesquisaId",
          "PesquisaDashboard_Tipo","PesquisaDashboard_Configuracao","PesquisaDashboard_Ordem","PesquisaDashboard_Modo")
       VALUES ($1,$2,$3,'BARRAS','{"topN":5,"indicador":1}'::jsonb,1,'xingu'),
              ($1,$2,$3,'TABELA','{"colunas":["municipio","valor"]}'::jsonb,2,'xingu')`,
      [TENANT, ORG, pid],
    );

    // duas origens válidas: via linha-município e via linha-indicador
    await app.query(
      `INSERT INTO "PesquisaSugestao"
         ("PesquisaSugestao_TenantId","PesquisaSugestao_OrganizacaoId","PesquisaSugestao_PesquisaId",
          "PesquisaSugestao_Texto","PesquisaSugestao_PraticaCitada",
          "PesquisaSugestao_PesquisaIndicadorMunicipioId","PesquisaSugestao_PesquisaIndicadorId","PesquisaSugestao_Agente")
       VALUES ($1,$2,$3,'Priorizar regulação de leitos','Regulação regional de leitos',$4,NULL,'a16-sugestoes'),
              ($1,$2,$3,'Ampliar contratualização','Contratualização hospitalar',NULL,$5,'a16-sugestoes')`,
      [TENANT, ORG, pid, primeiroMunicipioId, indId],
    );

    await app.query(
      `INSERT INTO "PesquisaFonte"
         ("PesquisaFonte_TenantId","PesquisaFonte_OrganizacaoId","PesquisaFonte_PesquisaId",
          "PesquisaFonte_FonteId","PesquisaFonte_CargaId","PesquisaFonte_HashSha256",
          "PesquisaFonte_Url","PesquisaFonte_DataExtracao")
       VALUES ($1,$2,$3,1,1,'${'b'.repeat(64)}','https://itmt.mt.gov.br/demo','2026-03-12T10:00:00Z')`,
      [TENANT, ORG, pid],
    );

    await app.query(
      `INSERT INTO "PesquisaExecucaoAgente"
         ("PesquisaExecucaoAgente_TenantId","PesquisaExecucaoAgente_OrganizacaoId",
          "PesquisaExecucaoAgente_PesquisaId","PesquisaExecucaoAgente_Agente",
          "PesquisaExecucaoAgente_Entrada","PesquisaExecucaoAgente_Saida",
          "PesquisaExecucaoAgente_DuracaoMs","PesquisaExecucaoAgente_Ok")
       VALUES ($1,$2,$3,'A01','{"pergunta":"leitos"}'::jsonb,'{"plano":"ok"}'::jsonb,42,true)`,
      [TENANT, ORG, pid],
    );

    return pid;
  });

  // ---- reabertura: SÓ SELECTs, nada de motor/LLM ----
  await contexto(app, async () => {
    const cab = await app.query(
      `SELECT "Pesquisa_Modo" AS modo,"Pesquisa_Pergunta" AS pergunta,"Pesquisa_Area" AS area,
              "Pesquisa_Recorte" AS recorte,"Pesquisa_Estado" AS estado,"Pesquisa_Hash" AS hash
         FROM "Pesquisa" WHERE "Pesquisa_Id" = $1`,
      [pesquisaId],
    );
    assert.deepEqual(cab.rows[0], {
      modo: 'xingu', pergunta: snapshot.pergunta, area: 'Saúde',
      recorte: 'ESTADO', estado: 'RESPONDIDA', hash: 'a'.repeat(64),
    });

    const munis = await app.query(
      `SELECT m."PesquisaIndicadorMunicipio_CodigoIbge" AS cod,
              m."PesquisaIndicadorMunicipio_Valor"::text AS valor,
              m."PesquisaIndicadorMunicipio_Posicao" AS posicao,
              m."PesquisaIndicadorMunicipio_TopN" AS topn,
              m."PesquisaIndicadorMunicipio_DeltaMediaEstadual"::text AS delta
         FROM "PesquisaIndicadorMunicipio" m
         JOIN "PesquisaIndicador" i ON i."PesquisaIndicador_Id" = m."PesquisaIndicadorMunicipio_PesquisaIndicadorId"
        WHERE i."PesquisaIndicador_PesquisaId" = $1
        ORDER BY m."PesquisaIndicadorMunicipio_Posicao"`,
      [pesquisaId],
    );
    assert.deepEqual(
      munis.rows,
      snapshot.municipios.map((m) => ({ cod: m.cod, valor: m.valor, posicao: m.posicao, topn: m.topN, delta: m.delta })),
    );

    const contagens = await app.query(
      `SELECT
         (SELECT count(*)::int FROM "PesquisaSerieHistorica" s
            JOIN "PesquisaIndicador" i ON i."PesquisaIndicador_Id" = s."PesquisaSerieHistorica_PesquisaIndicadorId"
           WHERE i."PesquisaIndicador_PesquisaId" = $1) AS serie,
         (SELECT count(*)::int FROM "PesquisaCausa" c
            JOIN "PesquisaIndicador" i ON i."PesquisaIndicador_Id" = c."PesquisaCausa_PesquisaIndicadorId"
           WHERE i."PesquisaIndicador_PesquisaId" = $1) AS causas,
         (SELECT count(*)::int FROM "PesquisaDashboard" WHERE "PesquisaDashboard_PesquisaId" = $1) AS dashboards,
         (SELECT count(*)::int FROM "PesquisaSugestao" WHERE "PesquisaSugestao_PesquisaId" = $1) AS sugestoes,
         (SELECT count(*)::int FROM "PesquisaFonte" WHERE "PesquisaFonte_PesquisaId" = $1) AS fontes,
         (SELECT count(*)::int FROM "PesquisaExecucaoAgente" WHERE "PesquisaExecucaoAgente_PesquisaId" = $1) AS execucoes`,
      [pesquisaId],
    );
    assert.deepEqual(contagens.rows[0], { serie: 3, causas: 1, dashboards: 2, sugestoes: 2, fontes: 1, execucoes: 1 });

    // nenhuma sugestão órfã: toda linha aponta pelo menos uma origem
    const orfas = await app.query(
      `SELECT count(*)::int AS n FROM "PesquisaSugestao"
        WHERE "PesquisaSugestao_PesquisaId" = $1
          AND "PesquisaSugestao_PesquisaIndicadorMunicipioId" IS NULL
          AND "PesquisaSugestao_PesquisaIndicadorId" IS NULL`,
      [pesquisaId],
    );
    assert.equal(orfas.rows[0].n, 0);
  });
});
