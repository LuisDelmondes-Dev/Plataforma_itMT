// ============================================================
// coletar-fontes.mjs — dispara o coletor Python (CNES, INEP) a partir
// do backend Node, para entrar no loop diário do serviço `rotinas`.
//
// O Python só baixa/normaliza; a IMPORTAÇÃO é feita pelo conector
// auditado (ingestar-csv.mjs), idempotente — grava só o que falta. Este
// wrapper resolve o venv, degrada com elegância (sem Python instalado,
// avisa e sai 0, não derruba o loop de rotinas) e é desligável por
// COLETORES_AUTO=0.
// ============================================================
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..'); // raiz do repo
const coletores = join(raiz, 'coletores');

if (process.env.COLETORES_AUTO === '0') {
  console.log('[coletar-fontes] desligado (COLETORES_AUTO=0).');
  process.exit(0);
}

// Prefere o Python do venv; cai para o do PATH.
const candidatos = [
  join(coletores, '.venv', 'Scripts', 'python.exe'), // Windows
  join(coletores, '.venv', 'bin', 'python'), // POSIX
];
const python = candidatos.find(existsSync) ?? process.env.PYTHON ?? 'python3';

if (!existsSync(coletores)) {
  console.warn('[coletar-fontes] pasta coletores/ ausente — nada a fazer.');
  process.exit(0);
}

console.log(`[coletar-fontes] ${new Date().toISOString()} usando ${python}`);
const filho = spawn(python, ['-m', 'coletores.coletar_fontes'], {
  cwd: raiz, // -m precisa da raiz no sys.path
  stdio: 'inherit',
  env: process.env, // herda DATABASE_URL (dono do banco, como as demais rotinas)
});

filho.on('error', (e) => {
  // Python indisponível no ambiente (ex.: imagem sem Python): avisa e não falha o loop.
  console.warn(`[coletar-fontes] Python indisponível (${e.message}) — coleta pulada.`);
  process.exit(0);
});
filho.on('close', (codigo) => {
  if (codigo) console.warn(`[coletar-fontes] coletor terminou com código ${codigo}.`);
  process.exit(codigo ?? 0);
});
