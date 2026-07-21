# AI_ORCHESTRATOR.md — IA Xingú (Orquestrador Central)

> ✅ A Xingú é a Orquestradora Central de um sistema multiagente. Frentes descritas nos documentos: prospecção/coleta (leitura, OCR, compilação, geração de formulários), armazenamento (caracterização e agrupamento por natureza), manipulação de nuvem de pontos, interpretação de dados e "outras" (aprende continuamente).

## 1. Pipeline de orquestração

```
Entrada (texto/áudio/visual)
   │
   ▼
[1] Recebimento + normalização (STT se áudio)
   │
   ▼
[2] Interpretação de intenção (NLU): intenção, entidades, formato de saída
   │
   ▼
[3] Classificação da tarefa (factual / estatística / geoespacial / documental / relatório / web / complexa)
   │
   ▼
[4] Decomposição em subtarefas (grafo com dependências)
   │
   ▼
[5] Seleção de agentes (por subtarefa)
   │
   ▼
[6] Seleção de IAs/modelos (gateway de IA)
   │
   ▼
[7] Execução do workflow (sequencial/paralelo + fila)
   │
   ├─► [8] Tratamento de erros (retry, fallback, confirmação ao usuário)
   │
   ▼
[9] Registro de logs (AgentExecution)
   │
   ▼
[10] Validação (Validação Técnica + Qualidade da Informação)
   │
   ▼
[11] Consolidação + entrega no formato adequado (texto/áudio/dashboard/relatório/mapa/PDF/planilha)
```

## 2. Etapas detalhadas

1. **Recebimento:** normaliza entrada; áudio → STT. Captura canal, usuário/tenant, recorte e tema (se vierem de filtros visuais).
2. **Interpretação (NLU):** identifica intenção (consulta factual, relatório, comparação, mapa…), entidades (município, tema, período) e formato desejado.
3. **Classificação:** rotula o tipo da tarefa para guiar decomposição e roteamento.
4. **Decomposição:** gera plano (grafo) com dependências e paralelismo.
5. **Seleção de agentes:** mapeia cada subtarefa ao(s) agente(s) do catálogo ([AGENTS.md](./AGENTS.md)).
6. **Seleção de IAs:** o gateway escolhe o modelo (ver §3).
7. **Execução:** sequencial/paralela; jobs pesados vão à fila assíncrona.
8. **Erros:** retry com backoff; fallback de modelo; se ambíguo/custoso/incompleto → pergunta ao usuário (ex.: ✅ "Você deseja um relatório por município?").
9. **Logs:** cada passo grava `AgentExecution` (input, modelo, custo, tempo, fontes, output).
10. **Validação:** consistência, fontes e anti-alucinação; baixa confiança → revisão humana.
11. **Entrega:** consolida e formata; sempre com fontes e data (RN03).

## 3. Política de seleção de IAs (roteamento)

✅ Critérios exigidos · 🧩 política proposta.

| Critério | Influência na escolha |
|----------|------------------------|
| Tipo da tarefa | OCR → visão; raciocínio → LLM reasoning; busca → embeddings+RAG |
| Custo | tarefa simples → modelo barato/local; complexa → premium |
| Velocidade | chat → modelo rápido; lote → assíncrono |
| Precisão | dado crítico (saúde/economia) → maior acurácia + validação |
| Privacidade | dado sensível → modelo local/on-premise, sem terceiros |
| Complexidade | multi-etapa → planner + multiagente |
| Formato entrada/saída | imagem/áudio/planilha → modelo multimodal específico |
| Necessidade de raciocínio | alta → reasoning; baixa → modelo leve |
| Consulta externa | dado ausente → agente de Pesquisa Web |
| Validação humana | baixa confiança → fila de revisão |

**Pseudo-regra de roteamento:**
```
se privacidade == alta: usar modelo local
senão se tarefa == OCR: usar modelo de visão/OCR
senão se tarefa == busca_conhecimento: embeddings + RAG
senão se complexidade == alta ou raciocinio == alto: LLM reasoning premium
senão: LLM leve/barato
sempre: registrar custo e fonte; se confianca < limiar -> revisão humana
```

## 4. Tratamento de dados incompletos e conflitantes

- **Incompletos (RN11):** declarar a lacuna; nunca preencher por suposição.
- **Conflitantes (RN12):** apresentar fontes divergentes; padrão = mais recente; sinalizar conflito.

## 5. Exemplos de fluxo

**A — Pergunta factual (✅ do documento):**
> "Quantos km de estrada vicinal existem em Mato Grosso?"
1. STT → 2. NLU (factual, Infra Macro/Estradas Vicinais, Estado) → 3. Dados e Indicadores consulta base → 4. Qualidade valida fonte → 5. resposta texto+áudio com valor e fonte → 6. oferta: "Deseja relatório por município?".

**B — Relatório complexo:**
> "Quero um relatório completo sobre infraestrutura urbana do município X."
1. NLU + decomposição → 2. Dados coleta subtemas (vias pavimentadas, esgoto, água, ETA/ETE, drenagem, aterro, cemitérios) → 3. GIS gera mapa → 4. Visualização cria gráficos → 5. Validação confere → 6. Relatórios/PDF montam documento → 7. entrega com fontes e data.

**C — Upload de documento:**
> usuário envia PDF → Análise de Documentos (OCR + extração) → confirmação do que foi entendido → indexação (DocumentChunk) → disponível para consulta via RAG.

## 6. Implementação recomendada

⚠️ **ADR-001:** começar com a Xingú como **orquestrador sobre modelos abertos/comerciais** (não treinar modelo do zero). ✅ Os documentos preveem tecnologia de código aberto — compatível com modelos abertos (Llama, Mistral, etc.) sob um gateway agnóstico.

Framework sugerido 🧩: LangGraph/CrewAI ou motor próprio para o grafo de tarefas; gateway de IA (LiteLLM/próprio) para o roteamento multimodelo.
