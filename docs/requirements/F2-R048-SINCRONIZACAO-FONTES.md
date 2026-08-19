# F2-R048 — Sincronização incremental de fontes oficiais

## Requisito

O banco local deve manter os dados municipais das fontes oficiais configuradas,
verificando cada fonte conforme sua periodicidade declarada, sem downloads
desnecessários, concorrência duplicada ou preenchimento artificial de ausências.

## Contrato

- execução diária seleciona somente fontes cuja próxima verificação venceu;
- fontes mensais: janela de 35 dias; anuais: 400 dias;
- falha é retentada em até 7 dias;
- `pg_try_advisory_lock` garante uma única sincronização por banco;
- conectores rodam sequencialmente e o pool de controle tem no máximo 2 conexões;
- downloads anuais grandes usam cache versionado local;
- Bronze, SHA-256, Prata, quarentena, Ouro e RG-09 permanecem obrigatórios;
- município desconhecido aborta a carga; aliases são explícitos, nunca fuzzy;
- dado indisponível não é estimado nem substituído por fixture;
- dependência de autorização/arquivo oficial recebe `BLOQUEADA_EXTERNA`.
- cargas oficiais incorporadas ao baseline são versionadas em SQL reaplicável,
  resolvendo fonte, indicador e município por chaves naturais, sem IDs locais,
  usuários, credenciais ou eventos privados.

## Fontes cobertas

IBGE (território, população, PIB, F1 e F2), CNES/DATASUS (internação,
estabelecimentos e UTI), INEP (matrículas públicas e escolas), INPE (focos de
queimada) e MapBiomas (cobertura vegetal nativa). SESP-MT e estradas vicinais
permanecem bloqueadas até o fornecimento institucional do arquivo autorizado.

## Aceite

O gate técnico exige migração limpa, testes de contrato/normalização, regressão
integral, execução local das fontes públicas e consulta subsequente sem downloads
quando todas estiverem dentro da janela. O snapshot SQL deve aplicar em banco
descartável desde a migração 01 e preservar a regressão integral.
