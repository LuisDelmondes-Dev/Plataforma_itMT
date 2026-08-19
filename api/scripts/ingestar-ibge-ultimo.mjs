import { spawn } from 'node:child_process';

const alvo = process.argv[2];
const configuracoes = {
  populacao: { agregado: '6579', script: 'scripts/ingestar-ibge-populacao.mjs' },
  pib: { agregado: '5938', script: 'scripts/ingestar-ibge-agregado.mjs', preset: 'pib' },
};
const cfg = configuracoes[alvo];
if (!cfg) throw new Error(`uso: node scripts/ingestar-ibge-ultimo.mjs <${Object.keys(configuracoes).join('|')}>`);

const resposta = await fetch(`https://servicodados.ibge.gov.br/api/v3/agregados/${cfg.agregado}/periodos`, {
  headers: { accept: 'application/json' }, signal: AbortSignal.timeout(120000),
});
if (!resposta.ok) throw new Error(`IBGE períodos: HTTP ${resposta.status}`);
const periodos = await resposta.json();
const ano = periodos.map((p) => String(p.id)).filter((p) => /^\d{4}$/.test(p)).sort().at(-1);
if (!ano) throw new Error(`IBGE não retornou período anual para o agregado ${cfg.agregado}`);
console.log(`[ibge-ultimo] ${alvo}: período mais recente publicado = ${ano}`);

const argumentos = cfg.preset ? [cfg.script, cfg.preset, ano] : [cfg.script, ano];
const codigo = await new Promise((resolve, reject) => {
  const filho = spawn(process.execPath, argumentos, { cwd: process.cwd(), env: process.env, stdio: 'inherit' });
  filho.on('error', reject);
  filho.on('close', resolve);
});
process.exit(Number(codigo ?? 1));
