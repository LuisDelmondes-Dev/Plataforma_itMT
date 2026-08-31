// ============================================================
// malha.unit.mjs — Evolução E4 (ADR-010, adendo Fase 3): malha territorial
// COMPLETA dos 142 municípios de MT como migração-snapshot (db/57).
//
// PADRÃO: banco-direto, como ranking.unit.mjs — node:test + pg.Pool no
// DATABASE_URL de um banco DESCARTÁVEL migrado. NUNCA o banco dev `itmt`.
// Esta suíte roda ANTES de ranking.unit.mjs no runner: os municípios
// sintéticos 5199xxx ("Zz …") daquela suíte ainda não existem, então as
// contagens aqui são as da malha canônica pura.
//
// Invariantes cobertas:
//   (a) 142 municípios, todos com RGI e RGInt oficiais e COERENTES
//       (RGI pertence à RGInt declarada); 18 RGIs; 5 RGInts; nenhuma RGI
//       ilustrativa do seed (5101xx) sobrevive;
//   (b) Boa Esperança do Norte (5101837) presente, RGI 510008 (Sorriso),
//       com DataInstalacao 2025-01-01 — e SEM observação SIM/SINASC
//       2019–2024 (município não existia: ausência, nunca zero — RN-005);
//   (c) os 17 consórcios conhecidos (16 SES-MT/PAICI + CINCOP-MT) existem
//       com ZERO vínculos em "ConsorcioMunicipio" (vínculo só por ato
//       oficial, nunca inferido);
//   (d) o motor agrega recorte ESTADO sobre a malha nova sem erro.
// ============================================================
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { IndicadoresService } from '../dist/indicadores/indicadores.service.js';
import { TerritorioService } from '../dist/territorio/territorio.service.js';
import { AuditoriaService } from '../dist/auditoria/auditoria.service.js';

let pool;
let svc;

before(() => {
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const db = {
    query: (sql, params = []) => pool.query(sql, params),
    currentTransactionClient: () => undefined,
    withClient: async (fn) => {
      const client = await pool.connect();
      try {
        return await fn(client);
      } finally {
        client.release();
      }
    },
  };
  const territorio = new TerritorioService(db);
  const auditoria = new AuditoriaService(db);
  const agentes = { garantirParaIndicador: async () => false }; // malha não vai à internet
  svc = new IndicadoresService(db, territorio, auditoria, agentes);
});

after(async () => {
  await pool.end();
});

test('(a) malha completa: 142 municípios, hierarquia oficial coerente, 18 RGIs, 5 RGInts', async () => {
  const r = await pool.query(
    `SELECT count(*)::int AS municipios,
            count(*) FILTER (
              WHERE EXISTS (
                SELECT 1 FROM "RegiaoImediata" ri
                 WHERE ri."RegiaoImediata_Codigo" = m."Municipio_CodigoRgi"
                   AND ri."RegiaoImediata_CodigoRgint" = m."Municipio_CodigoRgint"))::int AS coerentes,
            count(*) FILTER (WHERE m."Municipio_CodigoRgi" BETWEEN '510001' AND '510018')::int AS rgi_oficial
       FROM "Municipio" m`,
  );
  assert.equal(r.rows[0].municipios, 142, 'malha E4: 142 municípios de MT');
  assert.equal(r.rows[0].coerentes, 142, 'todo município deve ter RGI pertencente à sua RGInt');
  assert.equal(r.rows[0].rgi_oficial, 142, 'todo município deve apontar para RGI oficial 510001..510018');

  const regioes = await pool.query(
    `SELECT (SELECT count(*)::int FROM "RegiaoImediata") AS rgis,
            (SELECT count(*)::int FROM "RegiaoIntermediaria") AS rgints,
            (SELECT count(*)::int FROM "RegiaoImediata"
              WHERE "RegiaoImediata_Codigo" NOT BETWEEN '510001' AND '510018') AS ilustrativas`,
  );
  assert.equal(regioes.rows[0].rgis, 18, 'MT tem 18 Regiões Imediatas oficiais');
  assert.equal(regioes.rows[0].rgints, 5, 'MT tem 5 Regiões Intermediárias oficiais');
  assert.equal(regioes.rows[0].ilustrativas, 0, 'RGIs ilustrativas do seed devem ter sido removidas');

  // nomes oficiais das RGInts — o seed trazia 5102..5105 com nomes trocados
  const nomes = await pool.query(
    `SELECT "RegiaoIntermediaria_Codigo" AS c, "RegiaoIntermediaria_Nome" AS n
       FROM "RegiaoIntermediaria" ORDER BY 1`,
  );
  assert.deepEqual(
    nomes.rows,
    [
      { c: '5101', n: 'Cuiabá' },
      { c: '5102', n: 'Cáceres' },
      { c: '5103', n: 'Sinop' },
      { c: '5104', n: 'Barra do Garças' },
      { c: '5105', n: 'Rondonópolis' },
    ],
    'nomes oficiais do IBGE (db/57 corrige os ilustrativos do seed)',
  );
});

test('(b) Boa Esperança do Norte: instalado 2025-01-01, sem dado SIM/SINASC 2019–2024', async () => {
  const m = await pool.query(
    `SELECT "Municipio_Nome" AS nome, "Municipio_CodigoRgi" AS rgi,
            "Municipio_DataInstalacao"::text AS instalacao
       FROM "Municipio" WHERE "Municipio_CodigoIbge"='5101837'`,
  );
  assert.equal(m.rows.length, 1, '5101837 deve existir na malha E4');
  assert.equal(m.rows[0].nome, 'Boa Esperança do Norte');
  assert.equal(m.rows[0].rgi, '510008'); // RGI Sorriso (API de Localidades do IBGE)
  assert.equal(m.rows[0].instalacao, '2025-01-01');

  // Guarda de instalação do db/57: nenhum zero fabricado antes de existir
  const o = await pool.query(
    `SELECT count(*)::int AS n FROM "Observacao"
      WHERE "Observacao_CodigoIbge"='5101837' AND "Observacao_DataReferencia" < '2025-01-01'`,
  );
  assert.equal(o.rows[0].n, 0, 'município instalado em 2025 não pode ter observação anterior (RN-005)');
});

test('(c) 17 consórcios conhecidos, ZERO memberships inferidos', async () => {
  const CONHECIDOS = [
    'Vale do Rio Cuiabá', 'Araguaia Xingu', 'Garças Araguaia', 'Médio Araguaia',
    'Araguaia', 'Centro Norte', 'Médio Norte Matogrossense', 'Vale do Juruena',
    'Região Alto Tapajós', 'Região Norte Matogrossense', 'Vale do Teles Pires',
    'Vale do Peixoto', 'Vale do Arinos', 'Oeste Matogrossense', 'Vale do Guaporé',
    'Regional Sul de Mato Grosso', 'CINCOP-MT',
  ];
  const r = await pool.query(
    `SELECT c."Consorcio_Nome" AS nome, c."Consorcio_Tipo" AS tipo,
            c."Consorcio_Status" AS status,
            (SELECT count(*)::int FROM "ConsorcioMunicipio" cm
              WHERE cm."ConsorcioMunicipio_ConsorcioId" = c."Consorcio_Id") AS membros
       FROM "Consorcio" c WHERE c."Consorcio_Nome" = ANY($1)`,
    [CONHECIDOS],
  );
  assert.equal(r.rows.length, 17, 'os 17 consórcios do CSV curado devem existir');
  for (const c of r.rows) {
    assert.equal(c.membros, 0, `${c.nome}: membership só por ato oficial — deve nascer vazio`);
    assert.equal(c.status, 'EM_VALIDACAO', `${c.nome}: promover a ATIVO é ato humano de curadoria`);
    assert.equal(
      c.tipo,
      c.nome === 'CINCOP-MT' ? 'INFRA_DESENVOLVIMENTO' : 'SAUDE',
      `${c.nome}: tipo divergente do CSV curado`,
    );
  }
});

test('(d) motor agrega recorte ESTADO sobre a malha nova sem erro', async () => {
  // Indicador 1 (seed, APROVADO): a SOMA estadual roda sobre a malha de 142
  // sem erro — municípios sem observação são ausência, nunca zero (RN-005).
  const d = await svc.consultar({
    indicadorId: 1, recorte: 'ESTADO', codigo: null, dataReferencia: '2025-12-31',
  });
  assert.equal(d.agregacao, 'SOMA');
  assert.ok(Number.isFinite(d.valor) && d.valor > 0, 'SOMA estadual deve produzir valor');
  assert.ok(d.procedencia.length >= 1, 'valor sem procedência');
});
