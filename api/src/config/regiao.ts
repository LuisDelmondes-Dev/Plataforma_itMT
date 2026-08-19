export interface ConfiguracaoRegional {
  nome: string;
  sigla: string;
  codigoUfIbge: string;
  municipiosEsperados: number;
  aliases: string[];
}

export function carregarConfiguracaoRegional(env: NodeJS.ProcessEnv = process.env): ConfiguracaoRegional {
  const nome = env.REGIAO_NOME?.trim() || 'Mato Grosso';
  const sigla = (env.REGIAO_SIGLA?.trim() || 'MT').toUpperCase();
  const codigoUfIbge = env.REGIAO_CODIGO_UF_IBGE?.trim() || '51';
  const municipiosEsperados = Number(env.REGIAO_MUNICIPIOS_ESPERADOS ?? 142);
  if (!/^[A-Z]{2}$/.test(sigla)) throw new Error('REGIAO_SIGLA deve ter duas letras.');
  if (!/^\d{2}$/.test(codigoUfIbge)) throw new Error('REGIAO_CODIGO_UF_IBGE deve ter dois dígitos.');
  if (!Number.isInteger(municipiosEsperados) || municipiosEsperados < 1)
    throw new Error('REGIAO_MUNICIPIOS_ESPERADOS deve ser inteiro positivo.');
  const aliases = [nome, sigla, ...(env.REGIAO_ALIASES ?? '').split(',')]
    .map((item) => item.trim()).filter(Boolean);
  return { nome, sigla, codigoUfIbge, municipiosEsperados, aliases: [...new Set(aliases)] };
}

export const REGIAO = carregarConfiguracaoRegional();
