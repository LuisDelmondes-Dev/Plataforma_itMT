import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { salvarBronze } from '../scripts/lib-ingest.mjs';

test('Bronze restringe destino, tamanho e preserva imutabilidade sem check-then-write', async () => {
  const raiz = await mkdtemp(join(tmpdir(), 'itmt-bronze-test-'));
  const anteriorDir = process.env.BRONZE_DIR;
  const anteriorLimite = process.env.BRONZE_MAX_BYTES;
  process.env.BRONZE_DIR = raiz;
  process.env.BRONZE_MAX_BYTES = '32';
  try {
    assert.throws(() => salvarBronze('../fora.json', '{}'), /nome de arquivo Bronze inválido/i);
    assert.throws(() => salvarBronze('grande.json', 'x'.repeat(33)), /excede o limite/i);

    const primeira = salvarBronze('oficial-2026.json', '{"oficial":true}');
    const repetida = salvarBronze('oficial-2026.json', '{"oficial":true}');
    assert.equal(repetida.caminho, primeira.caminho);
    assert.equal(repetida.hash, primeira.hash);
    assert.throws(
      () => salvarBronze('oficial-2026.json', '{"oficial":false}'),
      /Bronze imutável/i,
    );
  } finally {
    if (anteriorDir === undefined) delete process.env.BRONZE_DIR;
    else process.env.BRONZE_DIR = anteriorDir;
    if (anteriorLimite === undefined) delete process.env.BRONZE_MAX_BYTES;
    else process.env.BRONZE_MAX_BYTES = anteriorLimite;
    await rm(raiz, { recursive: true, force: true });
  }
});

// EV-20260822-054: BLOQUEADA_DRIFT era um beco sem saída — nem o aceite
// consciente (--aceitar-esquema) nem o esquema voltar a casar limpavam o
// status, e o dedup por hash de registrarCarga devolvia a mesma carga
// bloqueada em toda reexecução. Caso real: PIB municipal ficou 1 mês
// publicado com 141 observações de carga bloqueada (carga 14 do dev).
test('verificarEsquema desbloqueia a carga quando o esquema é aceito ou volta a casar', async () => {
  const { verificarEsquema, fingerprintDe } = await import('../scripts/lib-ingest.mjs');
  const amostra = { codigo: '5103403', valor: 1 };
  const fp = fingerprintDe(amostra);

  function bancoFalso({ fpArmazenado, statusCarga }) {
    const chamadas = [];
    const clienteAuditoria = {
      query: async (sql, params) => { chamadas.push(String(params?.[1] ?? sql)); return { rows: [] }; },
      release() {},
    };
    return {
      chamadas,
      estado: { status: statusCarga },
      connect: async () => clienteAuditoria, // auditar() abre cliente próprio
      query(sql, params) {
        chamadas.push(sql);
        if (sql.includes('FROM "EsquemaFonte"'))
          return { rows: fpArmazenado ? [{ fp: fpArmazenado }] : [] };
        if (sql.includes(`SET "Carga_Status" = 'PROMOVIDA'`)) {
          if (this.estado.status !== 'BLOQUEADA_DRIFT') return { rows: [] }; // WHERE não casa
          this.estado.status = 'PROMOVIDA';
          return { rows: [{ Carga_Id: params[0] }] };
        }
        return { rows: [] };
      },
    };
  }

  // 1) esquema volta a casar com o contrato → desbloqueia
  const casa = bancoFalso({ fpArmazenado: fp, statusCarga: 'BLOQUEADA_DRIFT' });
  await verificarEsquema(casa, { fonteId: 1, cargaId: 14, amostra, aceitarNovo: false });
  assert.equal(casa.estado.status, 'PROMOVIDA', 'esquema conforme deveria desbloquear a carga');

  // 2) aceite consciente de esquema novo → desbloqueia
  const aceita = bancoFalso({ fpArmazenado: 'outro-fingerprint', statusCarga: 'BLOQUEADA_DRIFT' });
  await verificarEsquema(aceita, { fonteId: 1, cargaId: 14, amostra, aceitarNovo: true });
  assert.equal(aceita.estado.status, 'PROMOVIDA', '--aceitar-esquema deveria desbloquear a carga');

  // 3) drift SEM aceite → continua lançando e a carga fica bloqueada
  const drift = bancoFalso({ fpArmazenado: 'outro-fingerprint', statusCarga: 'PROMOVIDA' });
  await assert.rejects(
    () => verificarEsquema(drift, { fonteId: 1, cargaId: 99, amostra, aceitarNovo: false }),
    /RF-INGEST-005/,
    'drift sem aceite precisa continuar bloqueando',
  );

  // 4) carga já promovida não gera evento de desbloqueio espúrio
  const jaOk = bancoFalso({ fpArmazenado: fp, statusCarga: 'PROMOVIDA' });
  await verificarEsquema(jaOk, { fonteId: 1, cargaId: 14, amostra, aceitarNovo: false });
  assert.ok(!jaOk.chamadas.some((s) => s.includes('CARGA_DESBLOQUEADA')),
    'sem bloqueio prévio, não deve auditar desbloqueio');
});
