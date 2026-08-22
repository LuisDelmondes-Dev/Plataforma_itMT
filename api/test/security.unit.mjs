import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { AdminGuard } from '../dist/admin/admin.controller.js';
import { AuthService } from '../dist/auth/auth.service.js';
import { InteroperabilidadeController } from '../dist/interoperabilidade/interoperabilidade.controller.js';

function contexto(token) {
  const req = { headers: { authorization: `Bearer ${token}` } };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  };
}

test('ADMIN_TOKEN estático é aceito em teste, mas recusado em produção', () => {
  const anteriorNodeEnv = process.env.NODE_ENV;
  const anteriorToken = process.env.ADMIN_TOKEN;
  process.env.ADMIN_TOKEN = 'token-estatico-comprido-de-teste';
  try {
    process.env.NODE_ENV = 'test';
    assert.equal(new AdminGuard().canActivate(contexto(process.env.ADMIN_TOKEN)), true);
    process.env.NODE_ENV = 'production';
    assert.equal(new AdminGuard().canActivate(contexto(process.env.ADMIN_TOKEN)), false);
  } finally {
    if (anteriorNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = anteriorNodeEnv;
    if (anteriorToken === undefined) delete process.env.ADMIN_TOKEN;
    else process.env.ADMIN_TOKEN = anteriorToken;
  }
});

test('bootstrap de identidade falha fechado em produção', async () => {
  const anterior = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  const falha = new Error('schema de identidade indisponível');
  const auth = new AuthService({ query: async () => { throw falha; } });
  try {
    await assert.rejects(() => auth.onModuleInit(), falha);
  } finally {
    if (anterior === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = anterior;
  }
});

test('métricas exigem token dedicado em produção', async () => {
  const anteriorNodeEnv = process.env.NODE_ENV;
  const anteriorToken = process.env.METRICS_TOKEN;
  process.env.NODE_ENV = 'production';
  process.env.METRICS_TOKEN = 'metrics-token-dedicado-com-mais-de-32-caracteres';
  let enviado = '';
  const resposta = { type() { return this; }, send(valor) { enviado = valor; return this; } };
  const controller = new InteroperabilidadeController(
    { query: async () => ({ rows: [{ metrica: 'itmt_teste', valor: '1' }] }) },
    { prometheus: () => 'itmt_http_requests_total 1' },
  );
  try {
    await assert.rejects(() => controller.metrics({ headers: {} }, resposta), /Credencial/);
    await controller.metrics(
      { headers: { authorization: `Bearer ${process.env.METRICS_TOKEN}` } },
      resposta,
    );
    assert.match(enviado, /itmt_teste 1/);
  } finally {
    if (anteriorNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = anteriorNodeEnv;
    if (anteriorToken === undefined) delete process.env.METRICS_TOKEN;
    else process.env.METRICS_TOKEN = anteriorToken;
  }
});

test('service worker ignora PURGE_PRIVATE de origem externa', async () => {
  const codigo = await readFile('../web/public/sw.js', 'utf8');
  const listeners = new Map();
  const caches = {
    open: async () => ({ keys: async () => [], delete: async () => true }),
    keys: async () => [],
    match: async () => undefined,
  };
  const self = {
    location: { origin: 'https://itmt.mt.gov.br' },
    clients: { claim: async () => undefined },
    skipWaiting() {},
    addEventListener(tipo, handler) { listeners.set(tipo, handler); },
  };
  runInNewContext(codigo, { self, caches, URL, fetch: async () => ({ ok: true, clone() { return this; } }) });

  let aguardas = 0;
  const mensagem = listeners.get('message');
  mensagem({ origin: 'https://malicioso.example', data: { type: 'PURGE_PRIVATE' }, waitUntil() { aguardas++; } });
  assert.equal(aguardas, 0);
  mensagem({ origin: self.location.origin, data: { type: 'PURGE_PRIVATE' }, waitUntil() { aguardas++; } });
  assert.equal(aguardas, 1);
});

// Regressão EV-20260822-046: o inventário de fixtures precisa cobrir TUDO que o
// portal público serve. Antes, `Indicador` e `Direito` ficavam de fora — um banco
// de produção que herdasse fixtures de suíte subia sem reclamar e servia
// "Indicador de teste …" / "Direito íntegro F4" como dado oficial.
test('inventário de produção pega indicador e direito de teste publicados', async () => {
  const { SQL_INVENTARIO_DEMO } = await import('../dist/common/inventario-demo.js');
  const { default: pg } = await import('pg');
  const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const limpo = await db.query(SQL_INVENTARIO_DEMO);
    const antes = new Map(limpo.rows.map((r) => [r.categoria, Number(r.total)]));

    await db.query('BEGIN');
    // Fixtures hostis: nomes no padrão que as suítes realmente produzem.
    await db.query(
      `INSERT INTO "Indicador" ("Indicador_SubtemaId","Indicador_Nome","Indicador_Unidade",
         "Indicador_TipoAgregacao","Indicador_StatusValidacao")
       SELECT "SubtemaConsulta_Id", 'Indicador de teste 123456', 'unid.', 'SOMA', 'APROVADO'
         FROM "SubtemaConsulta" LIMIT 1`,
    );
    await db.query(
      `INSERT INTO "Direito" ("Direito_Nome","Direito_Area","Direito_Resumo","Direito_QuemPodeUsar",
         "Direito_Abrangencia","Direito_OrgaoGestor","Direito_NaturezaNorma",
         "Direito_BaseLegal","Direito_LinkOficial","Direito_DataVerificacao","Direito_Confianca","Direito_Status")
       VALUES ('Direito de teste F4', (SELECT "Direito_Area" FROM "Direito" LIMIT 1),
               'fixture de regressão','qualquer pessoa',
               (SELECT "Direito_Abrangencia" FROM "Direito" LIMIT 1),'Órgão de teste','LEI',
               'Lei 1/2000','https://www.gov.br/x', CURRENT_DATE, 'CONFIRMADA','PUBLICADO')`,
    );

    const sujo = await db.query(SQL_INVENTARIO_DEMO);
    const depois = new Map(sujo.rows.map((r) => [r.categoria, Number(r.total)]));
    for (const categoria of ['indicadores de teste aprovados', 'direitos de teste publicados']) {
      assert.equal(
        (depois.get(categoria) ?? 0) - (antes.get(categoria) ?? 0), 1,
        `inventário não contou "${categoria}" — produção subiria servindo fixture como oficial`,
      );
    }
  } finally {
    await db.query('ROLLBACK').catch(() => {});
    await db.end();
  }
});
