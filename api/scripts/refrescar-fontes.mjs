// Atualização proativa e observável das fontes oficiais do tipo API.
// Uso: node scripts/refrescar-fontes.mjs (API_URL ou :3001)
import { writeFileSync, renameSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export async function refrescarFontes({
  base = process.env.API_URL ?? 'http://localhost:3001',
  fetchImpl = fetch,
  log = console,
} = {}) {
  let agentes;
  try {
    const resposta = await fetchImpl(`${base}/v1/agentes/fontes`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    agentes = await resposta.json();
    if (!Array.isArray(agentes)) throw new Error('resposta não contém uma lista de agentes');
  } catch (erro) {
    log.error(`[refrescar] API indisponível em ${base} (${erro.message}).`);
    return {
      ok: false,
      motivo: 'API_INDISPONIVEL',
      atualizados: 0,
      ja_em_dia: 0,
      falhas: 1,
      fontes_com_falha: [],
      concluido_em: new Date().toISOString(),
    };
  }

  const agentesApi = agentes.filter((agente) => agente.tipo === 'API');
  let atualizados = 0;
  let jaEmDia = 0;
  let falhas = 0;
  const fontesComFalha = [];

  for (const agente of agentesApi) {
    if (agente.situacao?.atualizado) {
      jaEmDia++;
      log.log(`✓ ${agente.slug} já em dia — ${agente.situacao.motivo}`);
      continue;
    }

    try {
      const resposta = await fetchImpl(`${base}/v1/agentes/fontes/${agente.slug}/pesquisar`, {
        method: 'POST',
        signal: AbortSignal.timeout(180_000),
      });
      const corpo = await resposta.json().catch(() => ({}));
      if (resposta.ok && corpo.origem === 'INTERNET' && corpo.sucesso) {
        atualizados++;
        log.log(`→ ${agente.slug}: buscado na fonte oficial (${corpo.situacao?.motivo ?? 'ok'})`);
      } else {
        falhas++;
        fontesComFalha.push(agente.slug);
        log.error(`✗ ${agente.slug}: ${corpo.origem ?? `HTTP ${resposta.status}`} — ${corpo.situacao?.motivo ?? ''}`);
      }
    } catch (erro) {
      falhas++;
      fontesComFalha.push(agente.slug);
      log.error(`✗ ${agente.slug}: ${erro.message}`);
    }
  }

  log.log(`[refrescar] ${atualizados} atualizado(s), ${jaEmDia} já em dia, ${falhas} falha(s).`);
  return {
    ok: falhas === 0,
    motivo: falhas === 0 ? 'CONCLUIDO' : 'FALHAS_DE_ATUALIZACAO',
    atualizados,
    ja_em_dia: jaEmDia,
    falhas,
    fontes_com_falha: fontesComFalha,
    concluido_em: new Date().toISOString(),
  };
}

function persistirStatus(caminho, resultado) {
  const temporario = `${caminho}.tmp`;
  writeFileSync(temporario, `${JSON.stringify(resultado, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporario, caminho);
}

async function main() {
  const resultado = await refrescarFontes();
  if (process.env.REFRESH_STATUS_FILE) {
    persistirStatus(process.env.REFRESH_STATUS_FILE, resultado);
  }
  console.log(JSON.stringify(resultado));
  if (!resultado.ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
