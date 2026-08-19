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
