import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function executarAvaliador(corpus) {
  const dir = mkdtempSync(join(tmpdir(), 'itmt-f2-eval-'));
  const entrada = join(dir, 'corpus.json');
  const saida = join(dir, 'resultado.json');
  writeFileSync(entrada, JSON.stringify(corpus));
  const r = spawnSync(process.execPath, [
    'scripts/avaliar-corpus-documental-f2.mjs', entrada, '--saida', saida,
  ], { cwd: process.cwd(), encoding: 'utf8' });
  rmSync(dir, { recursive: true, force: true });
  return r;
}

test('avaliador F2 aprova somente corpus homologado com amostra e métricas mínimas', () => {
  const documentos = Array.from({ length: 20 }, (_, i) => ({
    id: `doc-${i + 1}`, texto_referencia: `texto territorial oficial número ${i + 1}`,
    texto_extraido: `texto territorial oficial número ${i + 1}`,
  }));
  const consultas = Array.from({ length: 30 }, (_, i) => ({
    id: `q-${i + 1}`,
    relevantes: Array.from({ length: 5 }, (_, j) => `doc-${((i + j) % 20) + 1}`),
    recuperados: Array.from({ length: 5 }, (_, j) => `doc-${((i + j) % 20) + 1}`),
    afirmacoes: [{
      texto: `afirmação territorial ${i + 1}`,
      suportada: true,
      fontes_suporte: [`doc-${(i % 20) + 1}`],
      citacoes: [`doc-${(i % 20) + 1}`],
    }],
  }));
  const r = executarAvaliador({
    nome: 'corpus controlado do teste', homologado_por: 'QA automatizado',
    homologado_em: '2026-08-12', documentos, consultas,
  });
  assert.equal(r.status, 0, r.stderr);
  const d = JSON.parse(r.stdout);
  assert.equal(d.aprovado, true);
  assert.equal(d.metricas.cer, 0);
  assert.equal(d.metricas.wer, 0);
  assert.equal(d.metricas.recall_5, 1);
  assert.equal(d.metricas.precision_5, 1);
  assert.equal(d.metricas.ndcg_5, 1);
  assert.equal(d.metricas.faithfulness, 1);
  assert.equal(d.metricas.groundedness, 1);
  assert.equal(d.metricas.citation_correctness, 1);
});

test('avaliador F2 reprova baixa precision@5 mesmo se o corpus tentar afrouxar o limiar', () => {
  const documentos = Array.from({ length: 20 }, (_, i) => ({
    id: `doc-${i + 1}`, texto_referencia: `texto ${i + 1}`, texto_extraido: `texto ${i + 1}`,
  }));
  const consultas = Array.from({ length: 30 }, (_, i) => ({
    id: `q-${i + 1}`, relevantes: ['doc-1'],
    recuperados: ['doc-1', 'doc-2', 'doc-3', 'doc-4', 'doc-5'],
    afirmacoes: [{
      texto: `afirmação sustentada ${i + 1}`, suportada: true,
      fontes_suporte: ['doc-1'], citacoes: ['doc-1'],
    }],
  }));
  const r = executarAvaliador({
    nome: 'corpus de baixa precisão', homologado_por: 'QA automatizado',
    homologado_em: '2026-08-15', documentos, consultas,
    limiares: { precision_5_min: 0 },
  });
  assert.equal(r.status, 1);
  const d = JSON.parse(r.stdout);
  assert.ok(Math.abs(d.metricas.precision_5 - 0.2) < Number.EPSILON * 10);
  assert.equal(d.limiares.precision_5_min, 0.8);
  assert.equal(d.aprovado, false);
});

test('avaliador F2 rejeita alucinação, contexto sem suporte e citação incorreta', () => {
  const documentos = Array.from({ length: 20 }, (_, i) => ({
    id: `doc-${i + 1}`, texto_referencia: `texto ${i + 1}`, texto_extraido: `texto ${i + 1}`,
  }));
  const consultas = Array.from({ length: 30 }, (_, i) => ({
    id: `q-${i + 1}`, relevantes: ['doc-1'], recuperados: ['doc-1'],
    afirmacoes: [{
      texto: 'número inventado sem apoio documental', suportada: false,
      fontes_suporte: ['doc-2'], citacoes: ['doc-3'],
    }],
  }));
  const r = executarAvaliador({
    nome: 'corpus adversarial', homologado_por: 'QA automatizado',
    homologado_em: '2026-08-15', documentos, consultas,
  });
  assert.equal(r.status, 1);
  const d = JSON.parse(r.stdout);
  assert.equal(d.metricas.faithfulness, 0);
  assert.equal(d.metricas.groundedness, 0);
  assert.equal(d.metricas.citation_correctness, 0);
});

test('avaliador F2 rejeita corpus pequeno ou de baixa qualidade', () => {
  const r = executarAvaliador({
    nome: 'corpus insuficiente', homologado_por: 'QA automatizado',
    homologado_em: '2026-08-12',
    documentos: [{ id: 'doc-1', texto_referencia: 'conteúdo correto', texto_extraido: 'erro total' }],
    consultas: [{ id: 'q-1', relevantes: ['doc-1'], recuperados: ['doc-2'] }],
  });
  assert.equal(r.status, 1);
  assert.equal(JSON.parse(r.stdout).aprovado, false);
});

test('gate F2 não libera fixtures nem ausência de homologação', () => {
  const r = spawnSync(process.execPath, ['scripts/auditar-f2.mjs', '--gate'], {
    cwd: process.cwd(), env: process.env, encoding: 'utf8',
  });
  assert.equal(r.status, 1);
  const d = JSON.parse(r.stdout);
  assert.equal(d.gate.dados_publicados, false);
  assert.equal(d.gate.ocr_rag_avaliados, false);
  assert.equal(d.gate.operacao_homologada, false);
});
