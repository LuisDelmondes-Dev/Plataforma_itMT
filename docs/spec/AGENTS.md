# AGENTS.md — Catálogo de Agentes Especialistas

> ✅ A IA Xingú é composta por múltiplos agentes interligados e independentes. Catálogo 🧩 alinhado às frentes da Xingú (prospecção/coleta, armazenamento, manipulação de nuvem de pontos, interpretação) e à taxonomia ITMT.

## 1. Contrato comum de agente

Todo agente expõe:
- **input** (jsonb): payload da subtarefa.
- **output** (jsonb): resultado estruturado.
- **fontes** (lista): referências usadas (obrigatório para agentes de dados).
- **confianca** (0–1): autoavaliação.
- **logs**: registrados em `AgentExecution`.
- **config**: parâmetros e modelos permitidos.

## 2. Catálogo

P-MVP = prioridade para o MVP.

| Agente | Função | Quando é acionado | Entrada | Processamento | Saída | IAs/Ferramentas | P-MVP |
|--------|--------|-------------------|---------|---------------|-------|-----------------|:-----:|
| **Orquestrador (Xingú)** | Planejar, rotear, validar, consolidar | Toda requisição | Solicitação do usuário | Decomposição + roteamento | Resposta final consolidada | LLM de raciocínio + planner | ✅ Alta |
| **Conversacional** | Diálogo texto/áudio, esclarecimento | Interação com usuário | Texto/áudio | NLU + STT/TTS | Resposta em linguagem natural | LLM + STT + TTS | ✅ Alta |
| **Dados e Indicadores** | Consultar/agregar indicadores | Consulta factual/estatística | Tema + recorte | Query SQL/analítica | Tabelas, números, séries | LLM + SQL + lib estatística | ✅ Alta |
| **Análise de Documentos** | Ler/interpretar docs, OCR | Upload ou ingestão | PDF/imagem/planilha | OCR + extração + estruturação | Dados estruturados, índice | OCR + LLM multimodal | ✅ Alta |
| **Busca Semântica (RAG)** | Recuperar contexto da base | Consultas baseadas em conhecimento | Pergunta | Embeddings + busca vetorial | Trechos relevantes + fontes | Embeddings + banco vetorial | ✅ Alta |
| **Geoprocessamento/GIS** | Mapas, camadas, nuvem de pontos | Demanda geoespacial | Recorte + camadas | Processamento GIS/3D | Mapas, ortomosaico, medições | GIS engine + visão computacional | ✅ Alta |
| **Relatórios** | Montar relatórios | Pedido de relatório | Dados + template | Composição + render | PDF/planilha | LLM + gerador PDF/XLSX | ✅ Alta |
| **Visualização de Dados** | Gráficos e dashboards | Saída visual | Dados | Geração de charts | Gráficos/painéis | Lib de visualização | Média |
| **Pesquisa Web** | Buscar dado externo ausente | Dado não está na base | Consulta | Busca + extração + verificação | Dado + fonte externa | LLM + web search | Média |
| **Validação Técnica** | Conferir consistência/lógica | Antes da entrega | Resultado parcial | Checagem de regras | Aprovação/rejeição | LLM + regras | ✅ Alta |
| **Qualidade da Informação** | Citar fonte, medir confiança, anti-alucinação | Toda resposta | Resposta + fontes | Verificação de fonte | Score + citações | LLM + verificador | ✅ Alta |
| **Geração de PDF** | Renderizar documento final | Saída em PDF | Conteúdo estruturado | Renderização | PDF | Gerador de PDF | ✅ Alta |
| **Auditoria e Rastreabilidade** | Registrar logs de execução | Toda execução | Eventos | Log estruturado | Trilha de auditoria | Logging + storage | ✅ Alta |
| **Segurança e LGPD** | Mascarar/anonimizar, checar permissões | Dados sensíveis | Dados + perfil | Mascaramento + ACL | Dados conformes | Regras + classificador | ✅ Alta |
| **Integração com APIs** | Conectar fontes externas | Ingestão/consulta externa | Endpoint + credenciais | Chamada + normalização | Dados normalizados | Conectores | Média |
| **Coleta de Campo** | Gerar/aplicar questionário domiciliar | Pesquisa estatística (2º ano) | Parâmetros | Geração de formulário | Dados de campo | LLM + app móvel | Baixa |

## 3. Critérios de validação por agente

- **Dados e Indicadores:** valor dentro de faixa plausível; fonte presente; data de atualização; recorte correto.
- **Análise de Documentos:** confiança de OCR ≥ limiar; campos obrigatórios extraídos; revisão humana se abaixo do limiar.
- **Busca Semântica:** relevância mínima dos trechos; fonte rastreável.
- **GIS:** geometria válida; CRS correto; precisão declarada.
- **Qualidade da Informação:** toda afirmação tem fonte; sem dado inventado (RN11); divergências sinalizadas (RN12).
- **Validação Técnica:** consistência lógica entre subtarefas; unidades coerentes.

## 4. Agentes do MVP

Orquestrador, Conversacional, Dados e Indicadores, Análise de Documentos (OCR), Busca Semântica (RAG), Geoprocessamento (básico), Relatórios, Validação Técnica, Qualidade da Informação, Auditoria, Segurança/LGPD.

## 5. Extensibilidade

Agentes são plugáveis (config em `Agent.config`). Novos agentes registram-se no catálogo e ficam disponíveis ao orquestrador. Na Fase 4, prevê-se **marketplace de agentes** 🧩.
