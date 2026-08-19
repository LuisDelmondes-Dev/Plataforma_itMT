const numero = Number(process.env.NEXT_PUBLIC_REGIAO_MUNICIPIOS_ESPERADOS ?? 142);

export const REGIAO = Object.freeze({
  nome: process.env.NEXT_PUBLIC_REGIAO_NOME?.trim() || 'Mato Grosso',
  sigla: (process.env.NEXT_PUBLIC_REGIAO_SIGLA?.trim() || 'MT').toUpperCase(),
  codigoUfIbge: process.env.NEXT_PUBLIC_REGIAO_CODIGO_UF_IBGE?.trim() || '51',
  municipiosEsperados: Number.isInteger(numero) && numero > 0 ? numero : 142,
});
