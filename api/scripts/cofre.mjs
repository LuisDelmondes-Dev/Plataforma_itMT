// ============================================================
// cofre.mjs — cofre local de segredos (AES-256-GCM + scrypt).
// O segredo NUNCA é gravado em texto claro: só o envelope
// criptografado vai para .cofre/<nome>.json. A senha-mestra vem
// de ITMT_COFRE_SENHA (ou --senha) e vive fora do repositório.
//
// Uso:
//   node scripts/cofre.mjs guardar <nome> <segredo> [--senha <mestra>]
//   node scripts/cofre.mjs ler <nome> [--senha <mestra>]      # diagnóstico
//   node scripts/cofre.mjs gerar-senha                        # sugestão de mestra
// ============================================================
import {
  createCipheriv, createDecipheriv, randomBytes, scryptSync, timingSafeEqual,
} from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(process.cwd(), '.cofre');
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function senhaMestra() {
  const i = process.argv.indexOf('--senha');
  const senha = i > -1 ? process.argv[i + 1] : process.env.ITMT_COFRE_SENHA;
  if (!senha || senha.length < 16) {
    console.error('Senha-mestra ausente ou curta (mínimo 16 caracteres). Use ITMT_COFRE_SENHA ou --senha.');
    process.exit(1);
  }
  return senha;
}

function guardar(nome, segredo) {
  const senha = senhaMestra();
  const sal = randomBytes(32);
  const chave = scryptSync(senha, sal, 32, SCRYPT);
  const iv = randomBytes(12);
  const cifra = createCipheriv('aes-256-gcm', chave, iv);
  const dados = Buffer.concat([cifra.update(segredo, 'utf8'), cifra.final()]);
  const envelope = {
    v: 1, alg: 'aes-256-gcm', kdf: 'scrypt', ...SCRYPT,
    sal: sal.toString('base64'), iv: iv.toString('base64'),
    tag: cifra.getAuthTag().toString('base64'), dados: dados.toString('base64'),
  };
  mkdirSync(DIR, { recursive: true });
  writeFileSync(join(DIR, `${nome}.json`), JSON.stringify(envelope, null, 2));
  console.log(`✓ Segredo "${nome}" guardado em .cofre/${nome}.json (AES-256-GCM, scrypt N=${SCRYPT.N}).`);
  console.log('  O arquivo cifrado e a senha-mestra estão fora do controle de versão (.gitignore).');
}

export function abrir(nome, senha) {
  const env = JSON.parse(readFileSync(join(DIR, `${nome}.json`), 'utf8'));
  const chave = scryptSync(senha, Buffer.from(env.sal, 'base64'), 32, { N: env.N, r: env.r, p: env.p, maxmem: 64 * 1024 * 1024 });
  const decifra = createDecipheriv('aes-256-gcm', chave, Buffer.from(env.iv, 'base64'));
  decifra.setAuthTag(Buffer.from(env.tag, 'base64'));
  return Buffer.concat([decifra.update(Buffer.from(env.dados, 'base64')), decifra.final()]).toString('utf8');
}

const [, , acao, nome, segredo] = process.argv;
if (acao === 'guardar') {
  if (!nome || !segredo) { console.error('Uso: cofre.mjs guardar <nome> <segredo>'); process.exit(1); }
  guardar(nome, segredo);
} else if (acao === 'ler') {
  try {
    const s = abrir(nome, senhaMestra());
    console.log(`✓ "${nome}" decifrado (${s.length} caracteres, prefixo ${s.slice(0, 10)}…).`);
  } catch { console.error('✗ Falha ao decifrar — senha errada ou arquivo corrompido.'); process.exit(1); }
} else if (acao === 'gerar-senha') {
  console.log(randomBytes(32).toString('base64url'));
} else {
  console.log('Uso: node scripts/cofre.mjs guardar|ler <nome> [segredo] [--senha <mestra>] | gerar-senha');
}
