export const FONTES = Object.freeze([
  { slug: 'ibge-territorio', nome: 'IBGE — Malha municipal', tipo: 'API', periodicidade: 'ANUAL', dias: 400,
    comando: ['node', 'scripts/ingestar-ibge-territorio.mjs'] },
  { slug: 'ibge-populacao', nome: 'IBGE — População estimada', tipo: 'API', periodicidade: 'ANUAL', dias: 400,
    comando: ['node', 'scripts/ingestar-ibge-ultimo.mjs', 'populacao'] },
  { slug: 'ibge-pib', nome: 'IBGE/SIDRA — PIB municipal', tipo: 'API', periodicidade: 'ANUAL', dias: 400,
    comando: ['node', 'scripts/ingestar-ibge-ultimo.mjs', 'pib'] },
  { slug: 'ibge-f1', nome: 'IBGE — Pacote territorial F1', tipo: 'API', periodicidade: 'ANUAL', dias: 400,
    comando: ['node', 'scripts/ingestar-pacote-f1-ibge.mjs'] },
  { slug: 'ibge-f2', nome: 'IBGE — Pacote temático F2', tipo: 'API', periodicidade: 'ANUAL', dias: 400,
    comando: ['node', 'scripts/ingestar-pacote-f2-ibge.mjs'] },
  { slug: 'cnes', nome: 'CNES/DATASUS — leitos e estabelecimentos', tipo: 'API', periodicidade: 'MENSAL', dias: 35,
    comando: ['python', '-m', 'coletores.coletar_fontes', '--grupo', 'cnes'] },
  { slug: 'inep', nome: 'INEP — Censo Escolar', tipo: 'DOWNLOAD', periodicidade: 'ANUAL', dias: 400,
    comando: ['python', '-m', 'coletores.coletar_fontes', '--grupo', 'inep'] },
  { slug: 'inpe', nome: 'INPE — focos de queimadas', tipo: 'DOWNLOAD', periodicidade: 'ANUAL', dias: 400,
    comando: ['python', '-m', 'coletores.coletar_fontes', '--fonte', 'inpe'] },
  { slug: 'mapbiomas', nome: 'MapBiomas — cobertura vegetal', tipo: 'DOWNLOAD', periodicidade: 'ANUAL', dias: 400,
    comando: ['python', '-m', 'coletores.coletar_fontes', '--fonte', 'mapbiomas'] },
  { slug: 'sesp-mt', nome: 'SESP-MT — ocorrências criminais', tipo: 'ARQUIVO_AUTORIZADO', periodicidade: 'MENSAL', dias: 35,
    bloqueio: 'Exige autorização formal e arquivo oficial da SESP-MT.' },
  { slug: 'sinfra-estradas', nome: 'SINFRA/municípios — estradas vicinais', tipo: 'ARQUIVO_AUTORIZADO', periodicidade: 'ANUAL', dias: 400,
    bloqueio: 'Não há API pública municipal completa; exige arquivo validado pelo órgão responsável.' },
]);

export function proximaVerificacao(agora, dias, sucesso = true) {
  const atrasoFalha = Math.min(dias, 7);
  return new Date(agora.getTime() + (sucesso ? dias : atrasoFalha) * 86400000);
}
