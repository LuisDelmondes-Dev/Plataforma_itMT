// Gate objetivo dos 12 indicadores do primeiro lançamento.
// Por padrão, exit 0 somente quando dados, procedência, cobertura e aprovação
// humana estão completos. --somente-dados valida o gate técnico sem publicar.
import { pool } from './lib-ingest.mjs';

const somenteDados = process.argv.includes('--somente-dados');
const db = pool();
try {
  const r = await db.query(`SELECT * FROM "vw_ProntidaoLancamentoF1" ORDER BY ordem`);
  const resumo = r.rows.map((x) => ({
    ordem: x.ordem,
    tema: x.tema,
    indicador: x.indicador,
    referencia: x.referencia?.toISOString?.().slice(0, 10) ?? x.referencia ?? null,
    municipios: x.municipios_piloto,
    cobertura: `${x.cobertura_pct}%`,
    procedencia: x.procedencia_ok ? 'OK' : 'FALHA',
    dados: x.pronto_dados ? 'PRONTO' : 'BLOQUEADO',
    validacao: x.status_validacao,
    publicacao: x.pronto_publicacao ? 'PRONTO' : 'BLOQUEADO',
  }));
  console.table(resumo);
  const prontosDados = r.rows.filter((x) => x.pronto_dados).length;
  const prontosPublicacao = r.rows.filter((x) => x.pronto_publicacao).length;
  console.log(`Gate técnico F1: ${prontosDados}/12 com dados, procedência e cobertura completos.`);
  console.log(`Gate de publicação F1: ${prontosPublicacao}/12 com parecer humano favorável.`);
  const prontosExigidos = somenteDados ? prontosDados : prontosPublicacao;
  if (r.rows.length !== 12 || prontosExigidos !== 12) process.exitCode = 1;
} catch (e) {
  console.error(`Gate F1 indisponível: ${e.message}`);
  process.exitCode = 1;
} finally {
  await db.end();
}
