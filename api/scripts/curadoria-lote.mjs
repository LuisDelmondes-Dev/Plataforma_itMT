#!/usr/bin/env node
/**
 * Curadoria em lote com base no dossiê (RF-ADMIN-003/004).
 *
 * Para cada indicador EM_ANALISE: busca o dossiê da Validação Técnica e,
 * quando TODAS as checagens passam (6/6), registra parecer APROVADO em nome
 * do parecerista informado — a decisão continua humana (RG-09): este script
 * só executa uma diretiva expressa do curador, e a identidade de quem decide
 * vai por --parecerista para a trilha imutável. Indicador com checagem
 * reprovada NÃO recebe parecer automático: fica EM_ANALISE e é listado com o
 * motivo, porque rejeitar exige juízo de domínio, não script.
 *
 * Uso:
 *   API_URL=http://localhost:3001 ADMIN_TOKEN=... \
 *     node scripts/curadoria-lote.mjs --parecerista "Nome do curador" [--dry-run]
 *
 * --dry-run mostra o que seria aprovado/retido sem emitir nenhum parecer.
 */

const API = process.env.API_URL ?? 'http://localhost:3001';
const TOKEN = process.env.ADMIN_TOKEN ?? 'itmt-admin-dev';
const AUTH = { Authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' };

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const iP = args.indexOf('--parecerista');
const parecerista = iP >= 0 ? args[iP + 1] : null;
if (!parecerista) {
  console.error('Obrigatório: --parecerista "Nome" — o parecer é ato humano (RG-09); a identidade vai para a trilha.');
  process.exit(1);
}

async function obter(caminho) {
  const r = await fetch(`${API}/v1${caminho}`, { headers: AUTH });
  if (!r.ok) throw new Error(`GET ${caminho} → HTTP ${r.status}`);
  return r.json();
}

const pendentes = await obter('/admin/indicadores/pendentes');
console.log(`[curadoria] ${pendentes.length} indicador(es) EM_ANALISE${dryRun ? ' (dry-run: nada será gravado)' : ''}`);

const aprovados = [];
const retidos = [];
const erros = [];

for (const p of pendentes) {
  try {
    const d = await obter(`/admin/indicadores/${p.id}/dossie`);
    if (!d.aprovado_tecnicamente) {
      retidos.push({
        id: p.id,
        nome: p.nome,
        falhas: d.checagens.filter((c) => !c.ok).map((c) => `${c.nome}: ${c.detalhe}`),
      });
      continue;
    }
    const cobertura = d.checagens.find((c) => c.nome === 'Cobertura territorial')?.detalhe ?? '';
    const referencia = d.checagens.find((c) => c.nome.startsWith('Data de refer'))?.detalhe ?? '';
    const fontes = (d.fontes ?? []).map((f) => `${f.nome} (${f.base_legal}, ${f.licenca})`).join('; ');
    const justificativa =
      `Parecer favorável com base no dossiê RF-ADMIN-003: validação técnica 6/6 aprovada. ` +
      `Cobertura ${cobertura} ${referencia} Fonte(s): ${fontes}. ` +
      `Cargas: ${(d.cargas_status ?? []).join(', ')}. Decisão humana registrada por diretiva expressa do parecerista (RG-09).`;
    if (!dryRun) {
      const r = await fetch(`${API}/v1/admin/indicadores/${p.id}/parecer`, {
        method: 'POST',
        headers: AUTH,
        body: JSON.stringify({ parecerista, decisao: 'APROVADO', justificativa }),
      });
      if (!r.ok) throw new Error(`parecer → HTTP ${r.status}: ${await r.text()}`);
    }
    aprovados.push({ id: p.id, nome: p.nome, fontes: (d.fontes ?? []).map((f) => f.nome) });
    console.log(`${dryRun ? 'APROVARIA' : 'APROVADO '} ${String(p.id).padStart(3)}  ${p.nome}`);
  } catch (e) {
    erros.push({ id: p.id, nome: p.nome, erro: e.message });
    console.error(`ERRO      ${String(p.id).padStart(3)}  ${p.nome}: ${e.message}`);
  }
}

console.log(`\n[curadoria] resumo: aprovados=${aprovados.length} retidos=${retidos.length} erros=${erros.length}`);
for (const r of retidos) console.log(`  RETIDO ${r.id} ${r.nome} → ${r.falhas.join(' | ')}`);
for (const e of erros) console.log(`  ERRO   ${e.id} ${e.nome} → ${e.erro}`);

console.log('\n[curadoria] fontes por indicador aprovado (insumo p/ revisão de duplicatas):');
for (const a of aprovados) console.log(`  ${a.id}\t${a.nome}\t${a.fontes.join(' + ')}`);

process.exit(erros.length ? 1 : 0);
