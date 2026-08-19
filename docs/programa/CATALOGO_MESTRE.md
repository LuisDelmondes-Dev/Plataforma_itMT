# Catálogo mestre de dados e fontes

## Contrato obrigatório

Cada dataset deve registrar: identificador, tema/subtema, Data Owner, órgão,
URL oficial, base legal, licença, periodicidade, cobertura territorial/temporal,
dicionário, metodologia, versão, hash, qualidade, SLA, classificação, retenção,
conector, contingência e data da última validação.

## Prioridades do primeiro lançamento

| Tema | Dataset mínimo | Situação inicial | Trabalho obrigatório |
|---|---|---|---|
| Demografia | população e composição | população disponível | validar séries e adicionar segundo indicador |
| Saúde | leitos e estabelecimentos | leitos de internação parciais | cobertura dos pilotos e CNES automatizado |
| Educação | matrículas e escolas | indicador sem observações | carga INEP oficial e reconciliação |
| Agronegócio | área plantada e rebanho | séries IBGE disponíveis | validar status e cobertura dos pilotos |
| Economia Privada | PIB e PIB per capita | PIB disponível | implementar cálculo/consulta per capita |
| Infraestrutura Macro | estradas vicinais e pontes | ausente | definir fonte, método, unidade e coleta |

## Critérios de publicação

- Fonte oficial/licenciada e Data Owner identificado.
- Cobertura e lacunas declaradas; ausência nunca vira zero.
- Validação de esquema, domínio, duplicidade, atualidade e reconciliação.
- Indicador aprovado por parecer técnico e metodologia acessível.
- Rollback para a versão anterior e trilha até o Bronze.

Dados demonstrativos são permitidos somente em desenvolvimento/teste e devem ser
marcados como `DEMONSTRACAO`. Nunca podem aparecer em endpoint público de produção.

