// F2 — quarentena, revisão humana, embeddings e busca citável.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 3907;
const BASE = `http://127.0.0.1:${PORT}/v1`;
const ADMIN = { Authorization: 'Bearer itmt-admin-dev' };
const storage = mkdtempSync(join(tmpdir(), 'itmt-documentos-'));
let api;
let documentoId;
let versaoId;

function multipart(campos, arquivo) {
  const limite = `----itmt-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const partes = [];
  for (const [nome, valor] of Object.entries(campos)) {
    partes.push(Buffer.from(`--${limite}\r\nContent-Disposition: form-data; name="${nome}"\r\n\r\n${valor}\r\n`));
  }
  partes.push(Buffer.from(
    `--${limite}\r\nContent-Disposition: form-data; name="arquivo"; filename="${arquivo.nome}"\r\n` +
    `Content-Type: ${arquivo.tipo}\r\n\r\n`,
  ));
  partes.push(Buffer.from(arquivo.conteudo));
  partes.push(Buffer.from(`\r\n--${limite}--\r\n`));
  return {
    body: Buffer.concat(partes),
    headers: { 'Content-Type': `multipart/form-data; boundary=${limite}` },
  };
}

before(async () => {
  api = spawn('node', ['dist/main.js'], {
    env: {
      ...process.env, PORT: String(PORT), AGENTES_AUTO: '0', DOCUMENTOS_STORAGE_ROOT: storage,
      ANTIVIRUS_MODE: 'mock', EMBEDDINGS_PROVIDER: 'hash-test', DOCUMENTOS_WORKER: '0',
    },
    stdio: 'ignore',
  });
  for (let i = 0; i < 40; i++) {
    try {
      const resposta = await fetch(`${BASE}/temas`);
      await resposta.arrayBuffer();
      if (resposta.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('API não subiu para os testes documentais.');
});

after(() => {
  api?.kill();
  rmSync(storage, { recursive: true, force: true });
});

test('upload anônimo é bloqueado', async () => {
  // Sem corpo: o guard deve encerrar a requisição antes de o parser multipart atuar.
  const r = await fetch(`${BASE}/documentos/upload`, { method: 'POST' });
  assert.equal(r.status, 403);
});

test('upload entra em quarentena e não executa extração na requisição', async () => {
  const form = multipart({
    titulo: 'Plano territorial de estradas vicinais',
    descricao: 'Documento de teste da biblioteca territorial.',
    orgao: 'Instituto Territorial de Mato Grosso', tipo: 'PLANO', licenca: 'CC BY 4.0',
    fonte_url: 'https://example.test/plano',
  }, {
    nome: 'plano-vicinais.txt', tipo: 'text/plain',
    conteudo: 'O plano territorial estabelece manutenção das estradas vicinais e pontes rurais.\n\n' +
      'A priorização considera extensão, tráfego e acesso das comunidades aos serviços públicos.',
  });
  const r = await fetch(`${BASE}/documentos/upload`, {
    method: 'POST', headers: { ...ADMIN, ...form.headers }, body: form.body,
  });
  assert.equal(r.status, 201);
  const d = await r.json();
  assert.equal(d.status, 'EM_ANALISE');
  assert.equal(d.seguranca, 'PENDENTE');
  assert.equal(d.extracao, 'PENDENTE');
  assert.equal(d.processamento, 'ASSINCRONO');
  documentoId = d.id;
  versaoId = d.versao_id;

  const catalogo = await (await fetch(`${BASE}/documentos`)).json();
  assert.ok(!catalogo.some((x) => x.id === documentoId));
  assert.equal((await fetch(`${BASE}/documentos/versoes/${versaoId}/arquivo`)).status, 404);
});

test('curadoria não aprova antes do antivírus e da extração', async () => {
  const fila = await (await fetch(`${BASE}/admin/documentos/pendentes`, { headers: ADMIN })).json();
  const item = fila.find((x) => x.versao_id === versaoId);
  assert.equal(item?.seguranca, 'PENDENTE');
  const invalido = await fetch(`${BASE}/admin/documentos/versoes/${versaoId}/revisao`, {
    method: 'POST', headers: { ...ADMIN, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      decisao: 'APROVADO',
      justificativa: 'Tentativa de aprovação antes do processamento seguro.',
      texto_revisado: 'Texto suficiente, porém o antivírus ainda não liberou o arquivo.',
    }),
  });
  assert.equal(invalido.status, 400);
});

test('worker reivindica a fila, verifica antivírus e extrai o texto', async () => {
  const r = await fetch(`${BASE}/admin/documentos/processar-fila`, {
    method: 'POST', headers: { ...ADMIN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ limite: 1 }),
  });
  assert.equal(r.status, 201);
  assert.equal((await r.json()).processadas, 1);
  const fila = await (await fetch(`${BASE}/admin/documentos/pendentes`, { headers: ADMIN })).json();
  const item = fila.find((x) => x.versao_id === versaoId);
  assert.equal(item?.seguranca, 'LIMPO');
  assert.equal(item?.extracao, 'PROCESSADO');
  assert.equal(item?.antivirus, 'mock-test');
});

test('aprovação publica e a tarefa seguinte gera embeddings versionados', async () => {
  const revisao = await fetch(`${BASE}/admin/documentos/versoes/${versaoId}/revisao`, {
    method: 'POST', headers: { ...ADMIN, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      decisao: 'APROVADO',
      justificativa: 'Fonte, licença e conteúdo foram conferidos pela curadoria.',
    }),
  });
  assert.equal(revisao.status, 201);
  const aprovado = await revisao.json();
  assert.equal(aprovado.status, 'APROVADO');
  assert.ok(aprovado.trechos > 0);

  const worker = await fetch(`${BASE}/admin/documentos/processar-fila`, {
    method: 'POST', headers: { ...ADMIN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ limite: 5 }),
  });
  assert.equal(worker.status, 201);
  const operacao = await (await fetch(`${BASE}/admin/documentos/operacao`, { headers: ADMIN })).json();
  assert.ok(operacao.embeddings_indexados > 0);

  const busca = await (await fetch(`${BASE}/documentos/busca?q=estradas%20vicinais`)).json();
  const achado = busca.resultados.find((x) => x.documento_id === documentoId);
  assert.ok(achado);
  assert.equal(achado.versao_id, versaoId);
  assert.match(achado.hash, /^[0-9a-f]{64}$/);
  assert.equal(achado.licenca, 'CC BY 4.0');
  assert.equal(busca.modo, 'LEXICAL');
  assert.equal(busca.motivo_fallback, 'PGVECTOR_INDISPONIVEL');

  const arquivo = await fetch(`${BASE}/documentos/versoes/${versaoId}/arquivo`);
  assert.equal(arquivo.status, 200);
  assert.match(await arquivo.text(), /estradas vicinais/);
});

test('arquivo detectado pelo antivírus é rejeitado e nunca entra no catálogo', async () => {
  const form = multipart({
    titulo: 'Arquivo de teste antivírus', orgao: 'Equipe de segurança',
    tipo: 'OUTRO', licenca: 'Uso restrito a teste',
  }, {
    nome: 'infectado-mock.txt', tipo: 'text/plain', conteudo: 'ITMT-MOCK-MALWARE-SENTINEL',
  });
  const envio = await fetch(`${BASE}/documentos/upload`, {
    method: 'POST', headers: { ...ADMIN, ...form.headers }, body: form.body,
  });
  assert.equal(envio.status, 201);
  const infectado = await envio.json();
  const worker = await fetch(`${BASE}/admin/documentos/processar-fila`, {
    method: 'POST', headers: { ...ADMIN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ limite: 1 }),
  });
  assert.equal(worker.status, 201);
  const pendentes = await (await fetch(`${BASE}/admin/documentos/pendentes`, { headers: ADMIN })).json();
  assert.ok(!pendentes.some((x) => x.id === infectado.id));
  const catalogo = await (await fetch(`${BASE}/documentos`)).json();
  assert.ok(!catalogo.some((x) => x.id === infectado.id));
  const operacao = await (await fetch(`${BASE}/admin/documentos/operacao`, { headers: ADMIN })).json();
  assert.ok(operacao.versoes.some((x) => x.seguranca === 'INFECTADO' && x.total >= 1));
});

test('uma versão só pode receber uma decisão humana', async () => {
  const r = await fetch(`${BASE}/admin/documentos/versoes/${versaoId}/revisao`, {
    method: 'POST', headers: { ...ADMIN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ decisao: 'REJEITADO', justificativa: 'Tentativa de reescrever a decisão anterior.' }),
  });
  assert.equal(r.status, 404);
});
