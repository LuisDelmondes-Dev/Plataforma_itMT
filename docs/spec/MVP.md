# MVP.md — Produto Mínimo Viável

> **Objetivo:** provar a proposta de valor central — perguntar em linguagem natural sobre MT e receber resposta confiável, com fonte, no formato útil — sobre um subconjunto de temas e localidades.

## 1. Dentro do MVP
- ✅ Chat inteligente (texto + áudio) com a Xingú.
- ✅ Orquestrador básico (interpretação → decomposição → roteamento → validação → entrega).
- ✅ Pesquisa por localidade (Estado, município, regiões) e por tema (subconjunto: Infraestrutura Urbana, Infraestrutura Macro, Saúde, Demografia).
- ✅ Base de dados inicial + banco vetorial (RAG) com fontes citadas.
- ✅ Upload de documentos com OCR.
- ✅ Relatórios simples em PDF/planilha.
- ✅ Mapas básicos por recorte.
- ✅ Login/cadastro + rastreabilidade/auditoria básica.

## 2. Agentes essenciais
Orquestrador (Xingú), Conversacional, Dados e Indicadores, Análise de Documentos (OCR), Busca Semântica (RAG), Geoprocessamento (básico), Relatórios, Validação Técnica, Qualidade da Informação, Auditoria, Segurança/LGPD.

## 3. Telas essenciais
Landing, Login/Cadastro, Chat com IA, Consulta por localidade/tema, Visualização de resultado (lista/mapa/relatório), Histórico de execuções.

## 4. Dados necessários
- IBGE (demografia/geografia).
- Infraestrutura, incluindo **estradas vicinais** (base do caso de referência ✅).
- Ingestão de documentos via OCR.

## 5. Fora do MVP
Dashboards avançados, multiagente complexo em larga escala, app de coleta domiciliar, banco de imagens completo, marketplace, billing.

## 6. Critérios de sucesso
- Responde corretamente ao caso de referência ✅ (km de estrada vicinal) com fonte + oferta de relatório por município.
- ≥ 80% das respostas factuais com fonte citada e validadas como corretas em amostra ⚠️.
- Tempo de resposta de chat factual ≤ 5s (P95) ⚠️.
- Geração de relatório simples funcional para ao menos 1 tema completo.

## 7. Estimativas (a validar ⚠️)
- **Tempo:** ~3 a 5 meses.
- **Equipe mínima:** 1 PM/PO, 1 tech lead, 2 devs back-end, 1 dev front-end, 1 eng. de dados/IA (LLMops), 1 designer UX, apoio GIS (parcial).

## 8. Plano de validação
- Conjunto de perguntas-teste por tema (gabarito com fonte).
- Medir taxa de acerto, presença de fonte, latência e custo por consulta.
- Teste de usabilidade com leigos (meta: resposta útil em ≤ 3 interações).
