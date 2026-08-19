import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { FONTES, proximaVerificacao } from './fontes-registry.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const api = join(raiz, 'api');
const alvo = process.argv.includes('--fonte') ? process.argv[process.argv.indexOf('--fonte') + 1] : null;
const force = process.argv.includes('--force');
const databaseUrl = process.env.DATABASE_URL ?? 'postgres://itmt:itmt@localhost:5432/itmt';
const python = [join(raiz, 'coletores', '.venv', 'Scripts', 'python.exe'), join(raiz, 'coletores', '.venv', 'bin', 'python')]
  .find(existsSync) ?? process.env.PYTHON ?? 'python3';
const db = new pg.Pool({ connectionString: databaseUrl, max: 2 });

function executar(comando) {
  const [bin, ...args] = comando;
  const executavel = bin === 'python' ? python : bin;
  return new Promise((resolve, reject) => {
    const filho = spawn(executavel, args, {
      cwd: bin === 'python' ? raiz : api,
      env: { ...process.env, DATABASE_URL: databaseUrl, NODE_USE_SYSTEM_CA: '1' },
      stdio: 'inherit',
    });
    const timer = setTimeout(() => { filho.kill(); reject(new Error('tempo limite de 45 minutos excedido')); }, 45 * 60 * 1000);
    filho.on('error', reject);
    filho.on('close', (codigo) => {
      clearTimeout(timer);
      codigo === 0 ? resolve() : reject(new Error(`processo terminou com código ${codigo}`));
    });
  });
}

async function salvar(f, status, proxima, detalhes, sucesso = false) {
  await db.query(`UPDATE "FonteSincronizacao" SET
    "FonteSincronizacao_Status"=$2,
    "FonteSincronizacao_UltimaVerificacao"=now(),
    "FonteSincronizacao_UltimoSucesso"=CASE WHEN $5 THEN now() ELSE "FonteSincronizacao_UltimoSucesso" END,
    "FonteSincronizacao_ProximaVerificacao"=$3,
    "FonteSincronizacao_Detalhes"=$4::jsonb,
    "FonteSincronizacao_AtualizadoEm"=now()
    WHERE "FonteSincronizacao_Slug"=$1`, [f.slug, status, proxima, JSON.stringify(detalhes), sucesso]);
}

async function main() {
  const cliente = await db.connect();
  const trava = await cliente.query(`SELECT pg_try_advisory_lock(hashtext('itmt:sincronizar-fontes')) AS ok`);
  if (!trava.rows[0].ok) { console.log('[fontes] outra sincronização está em execução; encerrando sem conflito.'); cliente.release(); return; }
  try {
    for (const f of FONTES) {
      await cliente.query(`INSERT INTO "FonteSincronizacao"
        ("FonteSincronizacao_Slug","FonteSincronizacao_Nome","FonteSincronizacao_Tipo","FonteSincronizacao_Periodicidade","FonteSincronizacao_IntervaloDias","FonteSincronizacao_Status","FonteSincronizacao_ProximaVerificacao","FonteSincronizacao_Detalhes")
        VALUES ($1,$2,$3,$4,$5,$6,now(),$7::jsonb)
        ON CONFLICT ("FonteSincronizacao_Slug") DO UPDATE SET
          "FonteSincronizacao_Nome"=EXCLUDED."FonteSincronizacao_Nome",
          "FonteSincronizacao_Tipo"=EXCLUDED."FonteSincronizacao_Tipo",
          "FonteSincronizacao_Periodicidade"=EXCLUDED."FonteSincronizacao_Periodicidade",
          "FonteSincronizacao_IntervaloDias"=EXCLUDED."FonteSincronizacao_IntervaloDias"`,
      [f.slug, f.nome, f.tipo, f.periodicidade, f.dias, f.bloqueio ? 'BLOQUEADA_EXTERNA' : 'PENDENTE', JSON.stringify(f.bloqueio ? { motivo: f.bloqueio } : {})]);
    }
    const { rows } = await cliente.query(`SELECT "FonteSincronizacao_Slug" slug,
      "FonteSincronizacao_ProximaVerificacao" proxima FROM "FonteSincronizacao"`);
    const estado = new Map(rows.map((r) => [r.slug, r]));
    const selecionadas = FONTES.filter((f) => (!alvo || f.slug === alvo) && (force || new Date(estado.get(f.slug).proxima) <= new Date()));
    if (alvo && !FONTES.some((f) => f.slug === alvo)) throw new Error(`fonte desconhecida: ${alvo}`);
    if (!selecionadas.length) { console.log('[fontes] todas as fontes estão dentro da janela de atualização.'); return; }
    for (const f of selecionadas) { // sequencial por projeto: não satura rede, CPU nem PostgreSQL
      if (f.bloqueio) {
        await salvar(f, 'BLOQUEADA_EXTERNA', proximaVerificacao(new Date(), f.dias), { motivo: f.bloqueio });
        console.warn(`[fontes] ${f.slug}: BLOQUEADA_EXTERNA — ${f.bloqueio}`);
        continue;
      }
      console.log(`[fontes] verificando ${f.slug}…`);
      await salvar(f, 'EM_EXECUCAO', new Date(), { inicio: new Date().toISOString() });
      try {
        await executar(f.comando);
        await salvar(f, 'ATUALIZADA', proximaVerificacao(new Date(), f.dias), { resultado: 'conector concluído; carga idempotente' }, true);
      } catch (e) {
        await salvar(f, 'FALHA', proximaVerificacao(new Date(), f.dias, false), { erro: String(e.message).slice(0, 1000) });
        console.error(`[fontes] ${f.slug}: ${e.message}`);
        process.exitCode = 1;
      }
    }
  } finally {
    await cliente.query(`SELECT pg_advisory_unlock(hashtext('itmt:sincronizar-fontes'))`);
    cliente.release();
  }
}

await main().finally(() => db.end());
