import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import pg from 'pg';

const PORT = Number(process.env.TEST_PORT ?? 20_000 + (process.pid % 20_000));
const BASE = `http://127.0.0.1:${PORT}/v1`;
let api;
let db;

before(async () => {
  db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const fonte = await db.query(
    `INSERT INTO "Fonte" ("Fonte_Nome","Fonte_Origem","Fonte_Url","Fonte_BaseLegal","Fonte_Licenca","Fonte_Periodicidade")
     VALUES ('Fonte oficial teste DCAT','Órgão público','https://dados.gov.br/','DADO_ABERTO','CC-BY-4.0','ANUAL')
     ON CONFLICT ("Fonte_Nome") DO UPDATE SET
       "Fonte_Url"=EXCLUDED."Fonte_Url",
       "Fonte_Licenca"=EXCLUDED."Fonte_Licenca"
     RETURNING "Fonte_Id" AS id`,
  );
  const carga = await db.query(
    `INSERT INTO "Carga" ("Carga_FonteId","Carga_DataExtracao","Carga_HashSha256","Carga_CaminhoBronze","Carga_Status","Carga_LinhasLidas")
     VALUES ($1,now(),$2,'bronze/oficial/dcat.csv','PROMOVIDA',1)
     RETURNING "Carga_Id" AS id`,
    [fonte.rows[0].id, 'a'.repeat(64)],
  );
  await db.query(
    `INSERT INTO "Observacao"
       ("Observacao_IndicadorId","Observacao_CodigoIbge","Observacao_DataReferencia","Observacao_Valor","Observacao_FonteId","Observacao_CargaId")
     VALUES (1,'5103403','2024-12-31',42,$1,$2)
     ON CONFLICT DO NOTHING`,
    [fonte.rows[0].id, carga.rows[0].id],
  );
  api = spawn('node', ['dist/main.js'], {
    env: { ...process.env, PORT: String(PORT), AGENTES_AUTO: '0', DOCUMENTOS_WORKER: '0' },
    stdio: process.env.TEST_DEBUG === '1' ? 'inherit' : 'ignore',
  });
  for (let i = 0; i < 40; i++) {
    if (api.exitCode !== null) throw new Error(`API encerrou prematuramente (exit ${api.exitCode}).`);
    try { if ((await fetch(`${BASE}/ogc`)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('API não subiu para os testes de interoperabilidade.');
});

after(async () => {
  api?.kill();
  await db?.end();
});

test('separa liveness de readiness', async () => {
  const live = await fetch(`${BASE}/saude/live`);
  assert.equal(live.status, 200);
  assert.deepEqual(await live.json(), { ok: true, processo: 'vivo' });
  const ready = await fetch(`${BASE}/saude/ready`);
  assert.equal(ready.status, 200);
  assert.deepEqual(await ready.json(), { ok: true, pronto: true, banco: 'ok' });
});

test('publica contrato OpenAPI 3.1 com autenticação da API de parceiros', async () => {
  const r = await fetch(`${BASE}/openapi.json`);
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.equal(d.openapi, '3.1.0');
  assert.equal(d.components.securitySchemes.apiKey.name, 'X-API-Key');
  assert.ok(d.paths['/ogc/collections/{collectionId}/items']);
});

test('OGC API Features declara core, contrato de serviço e GeoJSON', async () => {
  const landing = await (await fetch(`${BASE}/ogc`)).json();
  assert.ok(landing.links.some((x) => x.rel === 'service-desc'));
  const conf = await (await fetch(`${BASE}/ogc/conformance`)).json();
  assert.ok(conf.conformsTo.some((x) => x.endsWith('/conf/core')));
  assert.ok(conf.conformsTo.some((x) => x.endsWith('/conf/geojson')));
});

test('coleção OGC retorna FeatureCollection GeoJSON e limita paginação', async () => {
  const r = await fetch(`${BASE}/ogc/collections/projetos-estruturantes/items?limit=2`);
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type') ?? '', /application\/geo\+json/);
  const d = await r.json();
  assert.equal(d.type, 'FeatureCollection');
  assert.ok(d.numberReturned <= 2);
  for (const f of d.features) {
    assert.equal(f.type, 'Feature');
    assert.equal(f.geometry.type, 'Point');
    assert.equal(f.geometry.coordinates.length, 2);
  }
});

test('coleção OGC desconhecida retorna 404', async () => {
  assert.equal((await fetch(`${BASE}/ogc/collections/inexistente/items`)).status, 404);
});

test('exporta métricas operacionais no formato Prometheus', async () => {
  const r = await fetch(`${BASE}/metrics`);
  assert.equal(r.status, 200);
  const body = await r.text();
  assert.match(body, /itmt_cargas_total \d+/);
  assert.match(body, /itmt_documentos_fila_pendente \d+/);
  assert.match(body, /itmt_api_chaves_ativas \d+/);
  assert.match(body, /itmt_http_requests_total \d+/);
  assert.match(body, /itmt_http_request_duration_ms_total \d+/);
  assert.match(body, /itmt_http_errors_total \d+/);
});

test('catálogo DCAT publica somente datasets aprovados com licença e distribuições', async () => {
  const r = await fetch(`${BASE}/dcat`);
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type') ?? '', /application\/ld\+json/);
  const d = await r.json();
  assert.equal(d['@type'], 'dcat:Catalog');
  assert.ok(d['dcat:dataset'].length > 0);
  for (const dataset of d['dcat:dataset']) {
    assert.equal(dataset['@type'], 'dcat:Dataset');
    assert.ok(dataset['dct:license'].length > 0);
    assert.deepEqual(dataset['dcat:distribution'].map((x) => x['dct:format']), [
      'text/csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/pdf',
    ]);
  }
});

test('manifesto de reprodução encadeia fonte, versão, transformação, código e publicação', async () => {
  const catalogo = await (await fetch(`${BASE}/dcat`)).json();
  const id = Number(catalogo['dcat:dataset'][0]['dct:identifier'].replace('indicador-', ''));
  const r = await fetch(`${BASE}/dcat/datasets/${id}/reproducao`);
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.equal(d.dataset.indicador_id, id);
  assert.equal(d.cadeia.map((x) => x.etapa).join('→'), 'SOURCE→VERSION→TRANSFORMATION→CODE→DATASET→INDICATOR→PUBLICATION');
  assert.ok(d.fontes.length > 0);
  assert.ok(d.fontes.every((x) => /^[0-9a-f]{64}$/.test(x.sha256)));
  assert.equal(d.regras.publicacao_humana, 'RG-09');
});
