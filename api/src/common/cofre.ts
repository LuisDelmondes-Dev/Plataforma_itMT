import { createDecipheriv, scryptSync } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Cofre de segredos (par do scripts/cofre.mjs): o segredo fica em
 * .cofre/<nome>.json cifrado com AES-256-GCM (chave derivada por
 * scrypt da senha-mestra ITMT_COFRE_SENHA). Nem o repositório nem o
 * disco carregam a chave em texto claro; a decifragem acontece só em
 * memória, no bootstrap.
 */

/** Carrega api/.env (KEY=VALUE, sem expandir) para variáveis ausentes. */
function carregarDotEnv() {
  const arq = join(process.cwd(), '.env');
  if (!existsSync(arq)) return;
  for (const linha of readFileSync(arq, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(linha);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

function abrirCofre(nome: string, senha: string): string {
  const env = JSON.parse(readFileSync(join(process.cwd(), '.cofre', `${nome}.json`), 'utf8'));
  const chave = scryptSync(senha, Buffer.from(env.sal, 'base64'), 32, { N: env.N, r: env.r, p: env.p, maxmem: 64 * 1024 * 1024 });
  const decifra = createDecipheriv('aes-256-gcm', chave, Buffer.from(env.iv, 'base64'));
  decifra.setAuthTag(Buffer.from(env.tag, 'base64'));
  return Buffer.concat([decifra.update(Buffer.from(env.dados, 'base64')), decifra.final()]).toString('utf8');
}

/**
 * Chamado no início do bootstrap: resolve segredos do cofre para o
 * process.env ANTES de qualquer módulo consumi-los. Ordem de
 * precedência: variável de ambiente explícita > cofre > ausente.
 */
export function carregarSegredos(): void {
  carregarDotEnv();
  const senha = process.env.ITMT_COFRE_SENHA;
  if (!senha) return; // sem senha-mestra, o cofre fica fechado (RG-05: nada quebra)
  for (const [nome, variavel] of [
    ['anthropic', 'ANTHROPIC_API_KEY'],
    ['openai', 'OPENAI_API_KEY'],
  ] as const) {
    if (process.env[variavel]) continue;
    const arquivo = join(process.cwd(), '.cofre', `${nome}.json`);
    if (!existsSync(arquivo)) continue;
    try {
      process.env[variavel] = abrirCofre(nome, senha);
      console.log(`[cofre] segredo "${nome}" decifrado em memória → ${variavel}.`);
    } catch {
      console.error(`[cofre] FALHA ao decifrar "${nome}" — senha-mestra incorreta ou arquivo corrompido.`);
    }
  }
}
