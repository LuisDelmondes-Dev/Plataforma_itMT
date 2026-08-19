# Metodologia — pacote mínimo de 12 indicadores da Fase 1

## Regra comum

Cada valor deve registrar fonte oficial, URL, licença/base legal, data de referência,
data de extração, versão da carga e SHA-256 do arquivo bruto. O pacote somente vence o
gate quando a referência mais recente de cada indicador cobre os dez municípios piloto,
passa nas verificações automáticas e recebe parecer humano favorável.

Símbolos de ausência da fonte não são convertidos em zero. A única exceção é `-` na
simbologia oficial do SIDRA, que significa zero absoluto. Valores `...` permanecem
`SEM_DADO` e seguem para quarentena.

## Demografia

- **População residente — Censo 2022:** SIDRA 4714, variável 93, pessoas, referência
  01/08/2022. É estoque e pode ser somada entre municípios sem sobreposição.
- **Densidade demográfica:** SIDRA 4714, variável 614, hab./km². Não é somável; para
  recortes maiores deve ser recalculada com população e área.

## Saúde

- **Leitos de internação:** CNES/TabNet, estoque mensal de leitos existentes. Não
  representa ocupação, disponibilidade imediata nem especificamente UTI.
- **Estabelecimentos de saúde ativos:** CNES, contagem de estabelecimentos ativos por
  município gestor e competência. Mudanças cadastrais podem gerar revisões.

## Educação

- **Taxa de frequência escolar bruta — 6 a 14 anos:** Censo 2022/SIDRA 10056,
  variável 3795, categoria de idade 31615, sexo e cor ou raça no total. É percentual
  e não pode ser somada entre municípios.
- **Pessoas de 6 a 17 anos que frequentavam escola:** Censo 2022/SIDRA 10058,
  variável 13283, com nível de ensino, idade, sexo e cor ou raça no total. Mede
  pessoas, não matrículas, e pode ser somada em recortes municipais sem sobreposição.

Matrículas da rede pública e escolas ativas permanecem como indicadores
complementares do Censo Escolar/Inep. A ingestão anual deles não bloqueia o pacote
mínimo enquanto depender do download integral da Sinopse/Microdados; quando publicados,
devem preservar série, metodologia e procedência próprias.

## Agronegócio

- **Área plantada:** PAM/SIDRA 5457, variável 8331, total dos produtos, hectares.
  Cultivos sucessivos ou simultâneos podem fazer a soma exceder a área territorial.
- **Valor da produção agrícola:** PAM/SIDRA 5457, variável 215, total, em mil reais
  correntes do ano. Comparações reais exigem deflator.

## Economia privada

- **Unidades locais:** CEMPRE/SIDRA 1685, variável 706. A série municipal usada termina
  em 2021 e deve aparecer como `DEFASADO`, nunca como retrato corrente.
- **Pessoal ocupado assalariado:** CEMPRE/SIDRA 1685, variável 708. Mesma referência e
  ressalva de atualidade das unidades locais.

## Infraestrutura macro

- **Domicílios ligados à rede geral de água:** Censo 2022/SIDRA 6803, variável percentual
  1000381, categoria 72144. Mede domicílios ligados e que usam a rede como fonte principal.
- **Domicílios com esgotamento ligado à rede:** Censo 2022/SIDRA 6805, variável percentual
  1000381, categoria 46290. Inclui rede geral/pluvial ou fossa ligada à rede.

Os dois indicadores de infraestrutura são baseline censitário. Atualizações do SINISA
devem entrar como nova série/fonte após conciliação metodológica, sem sobrescrever 2022.
