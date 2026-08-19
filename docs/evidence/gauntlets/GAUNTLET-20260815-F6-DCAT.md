# Gauntlet F6 — DCAT e reprodução

Data: 15/08/2026  
Resultado: `PASS_TECHNICAL_PARTIAL_SCOPE`

## Ataques executados

1. catálogo sem dataset publicado: contrato permanece válido com lista vazia;
2. fonte ou caminho marcado como demo: dataset não entra no catálogo;
3. indicador sem aprovação RG-09: dataset não entra no catálogo;
4. dataset publicado: licença e distribuições CSV/XLSX/PDF são obrigatórias;
5. manifesto: cadeia ordenada e hash SHA-256 com 64 caracteres.

## Evidência

`TEST_FILES=test/interoperabilidade.e2e.mjs npm test` executou oito testes e passou `8/8`. O build Next.js gerou `/ciencia` entre 16 páginas. O teste cria sua própria fonte oficial determinística no banco descartável e não transforma as fixtures demo em evidência operacional.

## Limite da conclusão

O teste prova o contrato e a filtragem local. Não prova DOI, preservação de ambiente, revisão jurídica, avaliação científica independente nem operação pública homologada.
