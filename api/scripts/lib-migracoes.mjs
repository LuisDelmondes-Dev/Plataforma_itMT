// ============================================================
// lib-migracoes.mjs — descoberta das migrações de db/ (D-01 da
// fotografia de dívida). O regex aceita dois dígitos OU MAIS e a
// ordem é NUMÉRICA pelo prefixo: com sort() lexicográfico, a
// migração "100-" seria aplicada antes da "99-". O desempate por
// nome completo é só estabilidade — dois arquivos com o mesmo
// número já são proibidos pela regra "nunca renumere/remova um
// .sql aplicado" (CLAUDE.md).
// ============================================================
import { readdirSync } from 'node:fs';

export function descobrirMigracoes(dir) {
  return readdirSync(dir)
    .filter((f) => /^\d{2,}-.*\.sql$/.test(f))
    .sort((a, b) => parseInt(a, 10) - parseInt(b, 10) || a.localeCompare(b));
}
