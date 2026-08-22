/**
 * Inventário de fixtures demonstrativas/de teste (RG: "produção nunca exibe
 * dado DEMO como oficial", AGENTS.md).
 *
 * Vive fora do `main.ts` para ser **testável**: o guard de bootstrap e a suíte
 * de regressão executam exatamente a mesma consulta, então a prova não apodrece
 * em relação ao que roda de verdade.
 *
 * Regra ao estender: toda tabela cujo conteúdo o portal público serve precisa
 * de uma linha aqui. `Indicador` e `Direito` foram acrescentados em
 * EV-20260822-046 — antes disso, um banco de produção que herdasse fixtures de
 * suíte (como o banco dev herdou) subia sem reclamar e servia
 * "Indicador de teste …"/"Direito íntegro F4" como dado oficial.
 */

/**
 * Padrão de nome que denuncia artefato de teste/demonstração.
 *
 * PONTO CEGO CONHECIDO (EV-20260822-046): heurística por nome só pega fixture
 * que **se declara**. Uma fixture de nome inocente passa — o banco dev tem
 * exatamente esse caso, `Direito íntegro F4` (produzido por `test/f4.e2e.mjs`),
 * que nenhum regex razoável distingue de dado real. A defesa de verdade é não
 * apontar suíte para banco não-descartável: `scripts/test-e2e.mjs` recusa alvo
 * cujo nome não termine em `_test`/`_teste`. Este inventário é a segunda linha,
 * não a primeira.
 */
const PADRAO_TESTE = `'(^|[^[:alnum:]])(demo|teste|test)([^[:alnum:]]|$)'`;

export const SQL_INVENTARIO_DEMO = `
    SELECT categoria, total::text FROM (
      SELECT 'fontes demonstrativas' AS categoria, count(*) AS total
        FROM "Fonte"
       WHERE lower("Fonte_Nome") ~ '(^|[^[:alnum:]])demo([^[:alnum:]]|$)'
          OR lower("Fonte_Origem") ~ '(^|[^[:alnum:]])demo([^[:alnum:]]|$)'
      UNION ALL
      SELECT 'cargas demonstrativas', count(*)
        FROM "Carga"
       WHERE "Carga_CaminhoBronze" ILIKE '%/demo/%' OR "Carga_CaminhoBronze" LIKE 's3://t/%'
      UNION ALL
      SELECT 'consorcios demonstrativos', count(*)
        FROM "Consorcio"
       WHERE "Consorcio_Status" = 'DEMONSTRACAO'
      UNION ALL
      SELECT 'midias demonstrativas publicadas', count(*)
        FROM "AtivoMidia"
       WHERE "AtivoMidia_StatusPublicacao" = 'PUBLICADO'
         AND ("AtivoMidia_CaminhoObjeto" ILIKE '%/demo/%' OR "AtivoMidia_CaminhoObjeto" LIKE 's3://t/%')
      UNION ALL
      SELECT 'produtos GIS demonstrativos publicados', count(*)
        FROM "ProdutoGeografico"
       WHERE "ProdutoGeografico_StatusPublicacao" = 'PUBLICADO'
         AND ("ProdutoGeografico_CaminhoObjeto" ILIKE '%/demo/%' OR "ProdutoGeografico_CaminhoObjeto" LIKE 's3://t/%')
      UNION ALL
      -- Catálogo: indicador APROVADO é servido ao público (RG-09 já passou).
      SELECT 'indicadores de teste aprovados', count(*)
        FROM "Indicador"
       WHERE "Indicador_StatusValidacao" = 'APROVADO'
         AND lower("Indicador_Nome") ~ ${PADRAO_TESTE}
      UNION ALL
      -- Mapa de Direitos: PUBLICADO é servido ao público (vetos F4 já passaram).
      SELECT 'direitos de teste publicados', count(*)
        FROM "Direito"
       WHERE "Direito_Status" = 'PUBLICADO'
         AND lower("Direito_Nome") ~ ${PADRAO_TESTE}
    ) inventario WHERE total > 0
`;

export function mensagemInventarioDemo(rows: { categoria: string; total: string }[]): string {
  const inventario = rows.map((x) => `${x.categoria}: ${x.total}`).join('; ');
  return (
    `Publicacao bloqueada: o banco contem fixtures demonstrativas (${inventario}). ` +
    'Carregue fontes oficiais e remova as fixtures antes de iniciar em producao.'
  );
}
