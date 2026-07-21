// ============================================================
// refrescar-fontes.mjs — atualização PROATIVA das fontes (B2).
// Percorre os agentes de fonte do tipo API e, para os que estão
// vencidos/vazios, dispara a pesquisa oficial — reusando TODA a
// lógica do serviço F5 (validade, cascata de período, mutex,
// auditoria) pela própria API. Transforma "banco primeiro" em
// "banco sempre fresco", sem esperar a consulta do usuário.
//
// Uso: node scripts/refrescar-fontes.mjs   (API_URL ou :3001)
// No serviço 'rotinas' (produção): roda 1×/dia.
// ============================================================
const BASE = process.env.API_URL ?? 'http://localhost:3001';

async function main() {
  let agentes;
  try {
    const r = await fetch(`${BASE}/v1/agentes/fontes`, { signal: AbortSignal.timeout(10_000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    agentes = await r.json();
  } catch (e) {
    // Sem API no ar não há o que refrescar — não derruba o loop de rotinas.
    console.error(`[refrescar] API indisponível em ${BASE} (${e.message}); nada a fazer.`);
    return;
  }

  const api = agentes.filter((a) => a.tipo === 'API');
  let atualizados = 0;
  let jaEmDia = 0;
  let falhas = 0;

  for (const a of api) {
    if (a.situacao?.atualizado) {
      jaEmDia++;
      console.log(`✓ ${a.slug} já em dia — ${a.situacao.motivo}`);
      continue;
    }
    try {
      const r = await fetch(`${BASE}/v1/agentes/fontes/${a.slug}/pesquisar`, {
        method: 'POST', signal: AbortSignal.timeout(180_000),
      });
      const corpo = await r.json().catch(() => ({}));
      if (corpo.origem === 'INTERNET' && corpo.sucesso) {
        atualizados++;
        console.log(`→ ${a.slug}: buscado na fonte oficial (${corpo.situacao?.motivo ?? 'ok'})`);
      } else {
        falhas++;
        console.log(`✗ ${a.slug}: ${corpo.origem ?? 'sem resposta'} — ${corpo.situacao?.motivo ?? ''}`);
      }
    } catch (e) {
      falhas++;
      console.error(`✗ ${a.slug}: ${e.message}`);
    }
  }

  console.log(`[refrescar] ${atualizados} atualizado(s), ${jaEmDia} já em dia, ${falhas} falha(s).`);
  // ARQUIVO (CNES/INEP/SESP) seguem manuais por natureza — não são tocados aqui.
}

main();
