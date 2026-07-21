import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * Hash de senha com scrypt. Formato serializado: `scrypt$<sal_b64>$<hash_b64>`.
 * O sal é aleatório por senha; a verificação é em tempo constante. Nunca
 * gravamos a senha em claro — só este hash (db/11-auth.sql).
 */
const N = 16384, r = 8, p = 1, LEN = 32;
const MAXMEM = 64 * 1024 * 1024; // scrypt N=16384 estoura o default de 32MB

export function gerarHashSenha(senha: string): string {
  const sal = randomBytes(16);
  const hash = scryptSync(senha, sal, LEN, { N, r, p, maxmem: MAXMEM });
  return `scrypt$${sal.toString('base64')}$${hash.toString('base64')}`;
}

export function conferirSenha(senha: string, serializado: string): boolean {
  const partes = serializado.split('$');
  if (partes.length !== 3 || partes[0] !== 'scrypt') return false;
  const sal = Buffer.from(partes[1], 'base64');
  const esperado = Buffer.from(partes[2], 'base64');
  const calculado = scryptSync(senha, sal, esperado.length, { N, r, p, maxmem: MAXMEM });
  return esperado.length === calculado.length && timingSafeEqual(esperado, calculado);
}
