export function carregarConfiguracaoRegional(env = process.env) {
  const nome = env.REGIAO_NOME?.trim() || 'Mato Grosso';
  const sigla = (env.REGIAO_SIGLA?.trim() || 'MT').toUpperCase();
  const codigoUfIbge = env.REGIAO_CODIGO_UF_IBGE?.trim() || '51';
  const municipiosEsperados = Number(env.REGIAO_MUNICIPIOS_ESPERADOS ?? 142);
  if (!/^[A-Z]{2}$/.test(sigla) || !/^\d{2}$/.test(codigoUfIbge) || !Number.isInteger(municipiosEsperados) || municipiosEsperados < 1)
    throw new Error('Configuração regional inválida.');
  return { nome, sigla, codigoUfIbge, municipiosEsperados };
}
