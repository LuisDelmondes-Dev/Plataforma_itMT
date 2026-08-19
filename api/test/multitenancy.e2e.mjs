import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';

const TENANT_A = '10000000-0000-4000-8000-000000000001';
const TENANT_B = '10000000-0000-4000-8000-000000000002';
const ORG_A = '20000000-0000-4000-8000-000000000001';
const ORG_B = '20000000-0000-4000-8000-000000000002';
let owner;
let app;

async function contexto(cliente, tenantId, organizacaoId, fn) {
  await cliente.query('BEGIN');
  try {
    await cliente.query(`SELECT set_config('app.tenant_id',$1,true), set_config('app.organization_id',$2,true)`, [tenantId, organizacaoId]);
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
  await owner.query(
    `INSERT INTO "Tenant" ("Tenant_Id","Tenant_Slug","Tenant_Nome") VALUES
       ($1,'tenant-a-teste','Tenant A Teste'),($2,'tenant-b-teste','Tenant B Teste')
     ON CONFLICT ("Tenant_Id") DO NOTHING`,
    [TENANT_A, TENANT_B],
  );
  await owner.query(
    `INSERT INTO "Organizacao" ("Organizacao_Id","Organizacao_TenantId","Organizacao_Slug","Organizacao_Nome") VALUES
       ($1,$2,'org-a-teste','Organização A Teste'),($3,$4,'org-b-teste','Organização B Teste')
     ON CONFLICT ("Organizacao_Id") DO NOTHING`,
    [ORG_A, TENANT_A, ORG_B, TENANT_B],
  );
  await owner.query(
    `INSERT INTO "OrganizacaoConfiguracao"
       ("OrganizacaoConfiguracao_TenantId","OrganizacaoConfiguracao_OrganizacaoId","OrganizacaoConfiguracao_Chave","OrganizacaoConfiguracao_Valor")
     VALUES ($1,$2,'segredo','\"valor-a\"'::jsonb),($3,$4,'segredo','\"valor-b\"'::jsonb)
     ON CONFLICT DO NOTHING`,
    [TENANT_A, ORG_A, TENANT_B, ORG_B],
  );
});

after(async () => {
  await app?.end();
  await owner?.end();
});

test('RLS é FORCE, itmt_app não é owner/BYPASSRLS e policy possui USING+WITH CHECK', async () => {
  const r = await owner.query(
    `SELECT c.relrowsecurity AS rls, c.relforcerowsecurity AS force_rls,
            pg_get_userbyid(c.relowner) AS owner,
            (SELECT rolbypassrls FROM pg_roles WHERE rolname='itmt_app') AS bypass,
            (SELECT count(*)::int FROM pg_policies WHERE schemaname='public' AND tablename='OrganizacaoConfiguracao'
              AND qual IS NOT NULL AND with_check IS NOT NULL) AS policies_completas
       FROM pg_class c WHERE c.oid='"OrganizacaoConfiguracao"'::regclass`,
  );
  assert.deepEqual(r.rows[0], {
    rls: true, force_rls: true, owner: 'itmt', bypass: false, policies_completas: 1,
  });
});

test('sem contexto, leitura retorna zero e escrita é negada', async () => {
  assert.equal((await app.query(`SELECT * FROM "OrganizacaoConfiguracao"`)).rowCount, 0);
  await assert.rejects(
    () => app.query(
      `INSERT INTO "OrganizacaoConfiguracao" VALUES ($1,$2,'x','\"y\"'::jsonb,now())`,
      [TENANT_A, ORG_A],
    ),
    (erro) => erro.code === '42501',
  );
});

test('Tenant A lê A, não enumera B e não consegue inserir recurso de B', async () => {
  await contexto(app, TENANT_A, ORG_A, async () => {
    const proprio = await app.query(`SELECT "OrganizacaoConfiguracao_Valor" AS valor FROM "OrganizacaoConfiguracao"`);
    assert.deepEqual(proprio.rows, [{ valor: 'valor-a' }]);
    const cruzado = await app.query(
      `SELECT 1 FROM "OrganizacaoConfiguracao" WHERE "OrganizacaoConfiguracao_OrganizacaoId"=$1`, [ORG_B],
    );
    assert.equal(cruzado.rowCount, 0);
    await assert.rejects(
      () => app.query(
        `INSERT INTO "OrganizacaoConfiguracao"
           ("OrganizacaoConfiguracao_TenantId","OrganizacaoConfiguracao_OrganizacaoId","OrganizacaoConfiguracao_Chave","OrganizacaoConfiguracao_Valor")
         VALUES ($1,$2,'ataque','\"negado\"'::jsonb)`,
        [TENANT_B, ORG_B],
      ),
      (erro) => erro.code === '42501',
    );
  });
});

test('SET LOCAL não vaza contexto entre transações reutilizando a mesma conexão', async () => {
  await contexto(app, TENANT_A, ORG_A, async () => {
    assert.equal((await app.query(`SELECT count(*)::int AS n FROM "OrganizacaoConfiguracao"`)).rows[0].n, 1);
  });
  assert.equal((await app.query(`SELECT count(*)::int AS n FROM "OrganizacaoConfiguracao"`)).rows[0].n, 0);
  await contexto(app, TENANT_B, ORG_B, async () => {
    assert.equal((await app.query(`SELECT count(*)::int AS n FROM "OrganizacaoConfiguracao"`)).rows[0].n, 1);
  });
});

test('FK composta impede organização de outro tenant mesmo para o owner', async () => {
  await assert.rejects(
    () => owner.query(
      `INSERT INTO "OrganizacaoConfiguracao"
         ("OrganizacaoConfiguracao_TenantId","OrganizacaoConfiguracao_OrganizacaoId","OrganizacaoConfiguracao_Chave","OrganizacaoConfiguracao_Valor")
       VALUES ($1,$2,'fk-ataque','\"negado\"'::jsonb)`,
      [TENANT_A, ORG_B],
    ),
    (erro) => erro.code === '23503',
  );
});

test('Documentos/RAG falha fechado sem contexto e nega documento A→B', async () => {
  let documentoA;
  await contexto(app, TENANT_A, ORG_A, async () => {
    const criado = await app.query(
      `INSERT INTO "Documento"
         ("Documento_Titulo","Documento_Orgao","Documento_Tipo","Documento_Licenca","Documento_CriadoPor")
       VALUES ('Documento privado A','Órgão A','ESTUDO','restrita','teste-a')
       RETURNING "Documento_Id" AS id,"Documento_TenantId" AS tid,"Documento_OrganizacaoId" AS oid`,
    );
    documentoA = criado.rows[0].id;
    assert.equal(criado.rows[0].tid, TENANT_A);
    assert.equal(criado.rows[0].oid, ORG_A);
    assert.equal((await app.query(`SELECT 1 FROM "Documento" WHERE "Documento_Id"=$1`, [documentoA])).rowCount, 1);
  });

  assert.equal((await app.query(`SELECT 1 FROM "Documento" WHERE "Documento_Id"=$1`, [documentoA])).rowCount, 0);
  await contexto(app, TENANT_B, ORG_B, async () => {
    assert.equal((await app.query(`SELECT 1 FROM "Documento" WHERE "Documento_Id"=$1`, [documentoA])).rowCount, 0);
    await assert.rejects(
      () => app.query(
        `INSERT INTO "DocumentoVersao"
          ("DocumentoVersao_DocumentoId","DocumentoVersao_Numero","DocumentoVersao_NomeArquivo",
           "DocumentoVersao_Mime","DocumentoVersao_TamanhoBytes","DocumentoVersao_HashSha256",
           "DocumentoVersao_CaminhoObjeto")
         VALUES ($1,1,'ataque.txt','text/plain',1,$2,'ataque')`,
        [documentoA, 'b'.repeat(64)],
      ),
      (erro) => erro.code === '23503' || erro.code === '42501',
    );
  });
});

test('API key pertence à organização e a resolução pré-contexto não enumera clientes', async () => {
  const hash = 'c'.repeat(64);
  let clienteA;
  await contexto(app, TENANT_A, ORG_A, async () => {
    const criado = await app.query(
      `INSERT INTO "ApiCliente"
        ("ApiCliente_Proprietario","ApiCliente_Nome","ApiCliente_Prefixo","ApiCliente_HashChave")
       VALUES ('a@teste.local','Cliente privado A','prefixo-a-tenant',$1)
       RETURNING "ApiCliente_Id" AS id`, [hash],
    );
    clienteA = criado.rows[0].id;
  });
  assert.equal((await app.query(`SELECT 1 FROM "ApiCliente" WHERE "ApiCliente_Id"=$1`, [clienteA])).rowCount, 0);
  assert.equal((await app.query(`SELECT * FROM "ResolverApiClientePorHash"($1)`, ['d'.repeat(64)])).rowCount, 0);
  const envelope = await app.query(`SELECT tenant_id::text AS tid,organizacao_id::text AS oid FROM "ResolverApiClientePorHash"($1)`, [hash]);
  assert.deepEqual(envelope.rows[0], { tid: TENANT_A, oid: ORG_A });
  await contexto(app, TENANT_B, ORG_B, async () => {
    assert.equal((await app.query(`SELECT 1 FROM "ApiCliente" WHERE "ApiCliente_Id"=$1`, [clienteA])).rowCount, 0);
    await assert.rejects(
      () => app.query(
        `INSERT INTO "ApiConsumoJanela"
          ("ApiConsumoJanela_ClienteId","ApiConsumoJanela_Tipo","ApiConsumoJanela_Inicio","ApiConsumoJanela_Total")
         VALUES ($1,'DIA',date_trunc('day',now()),1)`, [clienteA],
      ),
      (erro) => erro.code === '23503' || erro.code === '42501',
    );
  });
});

test('campo, mídia e GIS privados negam leitura e filhos A→B', async () => {
  let missaoA;
  await contexto(app, TENANT_A, ORG_A, async () => {
    const missao = await app.query(
      `INSERT INTO "MissaoCampo"
        ("MissaoCampo_CodigoIbge","MissaoCampo_Frente","MissaoCampo_ProdutoEsperado","MissaoCampo_Equipe",
         "MissaoCampo_JanelaInicio","MissaoCampo_JanelaFim")
       VALUES ('5103403','GEO','Produto privado A','Equipe A',current_date,current_date+1)
       RETURNING "MissaoCampo_Id" AS id`,
    );
    missaoA = missao.rows[0].id;
    await app.query(
      `INSERT INTO "AtivoMidia"
        ("AtivoMidia_CodigoIbge","AtivoMidia_Tipo","AtivoMidia_Titulo","AtivoMidia_Autor","AtivoMidia_CaminhoObjeto")
       VALUES ('5103403','FOTO','Ativo privado A','Equipe A','privado/a.jpg')`,
    );
  });
  assert.equal((await app.query(`SELECT 1 FROM "MissaoCampo" WHERE "MissaoCampo_Id"=$1`, [missaoA])).rowCount, 0);
  assert.equal((await app.query(`SELECT 1 FROM "AtivoMidia" WHERE "AtivoMidia_Titulo"='Ativo privado A'`)).rowCount, 0);
  await contexto(app, TENANT_B, ORG_B, async () => {
    assert.equal((await app.query(`SELECT 1 FROM "MissaoCampo" WHERE "MissaoCampo_Id"=$1`, [missaoA])).rowCount, 0);
    await assert.rejects(
      () => app.query(
        `INSERT INTO "CapturaCampo"
          ("CapturaCampo_MissaoId","CapturaCampo_Operador","CapturaCampo_CaminhoObjeto","CapturaCampo_CapturadoEm",
           "CapturaCampo_IdempotencyKey","CapturaCampo_FormularioVersao","CapturaCampo_PayloadHash")
         VALUES ($1,'ataque-b','privado/b.jpg',now(),'00000000-0000-4000-8000-0000000000ab','campo-v1',$2)`,
        [missaoA, 'b'.repeat(64)],
      ),
      (erro) => erro.code === '23503' || erro.code === '42501',
    );
  });
});
