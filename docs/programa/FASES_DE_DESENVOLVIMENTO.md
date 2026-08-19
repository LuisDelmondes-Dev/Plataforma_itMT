# Fases propostas para o desenvolvimento da Plataforma ITMT

> Documento consolidado das fases propostas para o desenvolvimento da plataforma.
> O roadmap original previa as fases F0 a F4. O Plano Diretor de 36 meses ampliou
> o programa com as fases F5 a F7 e passou a ser a referência vigente.

## Visão geral

| Fase | Período | Resultado principal | Gate de encerramento |
|---|---:|---|---|
| F0 — Recuperação e fundação | Meses 0–2 | Engenharia confiável e governança ativa | Testes em banco isolado; catálogo e arquitetura aprovados |
| F1 — MVP público confiável | Meses 2–6 | Portal com 6 temas e 10 municípios | 12 indicadores reais; caso de estradas vicinais; WCAG AA |
| F2 — Plataforma de dados | Meses 5–12 | Ingestão, OCR, RAG, catálogo e API | 8 temas com dados; 50 indicadores; OCR/RAG avaliados |
| F3 — Inteligência e pilotos | Meses 9–18 | Xingú multiagente, PWA e campo piloto | 100 indicadores; 10 pacotes GIS/audiovisual |
| F4 — Escala SaaS | Meses 15–24 | Alta disponibilidade e aplicativos nativos | 99,9% de disponibilidade; 60 municípios; 200 indicadores |
| F5 — Mapeamento estadual | Meses 18–30 | Operação GIS, 360° e audiovisual estadual | 142 municípios com situação auditável |
| F6 — Ecossistema científico | Meses 24–33 | Dados abertos, pesquisa e participação | Metodologias independentes e dados reproduzíveis |
| F7 — Consolidação | Meses 30–36 | Operação sustentável e auditada | 300 indicadores; recuperação de desastre comprovada; auditoria integral |

As fases podem se sobrepor por equipe, mas cada recurso só pode ser considerado
entregue após passar pelo respectivo gate.

## F0 — Recuperação e fundação

**Período:** meses 0–2.

**Objetivo:** estabelecer uma base técnica, documental e de governança confiável
para o restante do programa.

**Escopo e entregáveis:**

- consolidar o PRD, a arquitetura-alvo, os ADRs e a modelagem de dados;
- manter testes em banco isolado, com criação e remoção automáticas e suítes
  serializadas;
- garantir integridade territorial e separar explicitamente dados demonstrativos
  de dados oficiais;
- impedir a exibição de dados de demonstração em produção;
- configurar CI/CD, observabilidade, auditoria de dependências, SBOM, varredura
  de segredos e análise de código;
- aprovar o catálogo mestre, o catálogo de agentes, a política de roteamento de IA
  e o plano inicial de aquisições e convênios;
- instituir comitês, matriz RACI e matriz de evidências;
- definir nuvem em região brasileira, portabilidade e cópia soberana dos ativos.

**Gate:** engenharia confiável e governança ativa, com testes isolados, catálogo
e arquitetura formalmente aprovados.

## F1 — MVP público confiável

**Período:** meses 2–6.

**Objetivo:** provar a proposta de valor central com dados reais, fontes visíveis
e uma experiência pública acessível.

**Escopo e entregáveis:**

- lançar os seis temas iniciais: Demografia, Saúde, Educação, Agronegócio,
  Economia Privada e Infraestrutura Macro;
- cobrir os dez municípios piloto: Cuiabá, Várzea Grande, Rondonópolis, Sinop,
  Sorriso, Cáceres, Barra do Garças, Tangará da Serra, Alta Floresta e Primavera
  do Leste;
- disponibilizar dois indicadores reais por tema, totalizando ao menos 12;
- oferecer seis recortes territoriais sem opções vazias;
- implementar login, identidade pública e OIDC/MFA para administração;
- permitir upload de documentos com OCR;
- disponibilizar a Xingú por texto e áudio, com orquestração e agentes essenciais;
- implantar a base inicial, RAG, mapas básicos, relatórios em PDF/planilha e
  rastreabilidade;
- concluir o caso de referência de estradas vicinais, da ingestão ao relatório
  municipal e à resposta da Xingú;
- exibir fonte, metodologia, qualidade e cobertura junto de cada resultado;
- atender ao nível WCAG AA.

**Gate:** 12 indicadores oficiais, dez municípios piloto cobertos, caso de
estradas vicinais completo e acessibilidade WCAG AA.

## F2 — Plataforma de dados

**Período:** meses 5–12.

**Objetivo:** transformar o MVP em uma plataforma operacional de dados,
integrada, observável e reutilizável por parceiros.

**Escopo e entregáveis:**

- ampliar a taxonomia até os 17 temas previstos;
- operar pipelines Bronze, Prata e Ouro com monitoramento;
- automatizar a ingestão contínua e as integrações com fontes externas;
- disponibilizar catálogo público de dados;
- concluir o fluxo seguro de upload, quarentena, OCR, revisão humana, vetores e
  busca híbrida;
- avaliar objetivamente OCR e RAG;
- oferecer dashboards e mapas/GIS avançados;
- disponibilizar portal e API para parceiros, com chaves, escopos, quotas,
  revogação e contrato OpenAPI;
- adotar padrões interoperáveis OGC para dados geoespaciais;
- evoluir auditoria, gestão de usuários, organizações e tenants;
- ampliar a coordenação multiagente.

**Gate:** pelo menos oito temas abastecidos, 50 indicadores, OCR/RAG avaliados e
operações de dados e API homologadas.

## F3 — Inteligência e pilotos

**Período:** meses 9–18.

**Objetivo:** adicionar inteligência avançada e validar a geração de dados
próprios em pilotos de campo.

**Escopo e entregáveis:**

- implantar gateway de IA multiprovedor, com fallback determinístico;
- evoluir a Xingú para operação multiagente, com avaliações contínuas e contratos
  claros entre agentes;
- adicionar análise preditiva, voz aprimorada, workflows automatizados e agentes
  autônomos;
- gerar relatórios avançados e realizar validação cruzada;
- entregar PWA offline e formulários versionados;
- executar piloto de pesquisa domiciliar e coleta de campo;
- estruturar o banco MT Imagens com armazenamento e mídias derivadas;
- iniciar levantamentos VANT, Street View 360°/8K e experiências Cesium/3D Tiles;
- formar os primeiros pacotes municipais GIS e audiovisuais.

**Gate:** 100 indicadores e dez pacotes GIS/audiovisuais, com Xingú, PWA e coleta
de campo validadas em piloto.

## F4 — Escala SaaS

**Período:** meses 15–24.

**Objetivo:** preparar a plataforma para escala comercial, operação enterprise e
ampliação territorial.

**Escopo e entregáveis:**

- concluir multitenancy e isolamento entre organizações;
- implantar planos, limites, billing e gestão de assinaturas;
- disponibilizar aplicativos nativos após a consolidação da PWA;
- alcançar alta disponibilidade, observabilidade avançada e suporte operacional;
- implantar práticas de FinOps e controle de custos de IA e infraestrutura;
- ampliar cobertura, fontes, integrações e parcerias;
- preparar marketplace de agentes plugáveis;
- operar 200 indicadores com cobertura de 60 municípios.

**Gate:** disponibilidade de 99,9%, 200 indicadores e 60 municípios cobertos.

## F5 — Mapeamento estadual

**Período:** meses 18–30.

**Objetivo:** ampliar a operação geoespacial e audiovisual para todo o estado de
Mato Grosso.

**Escopo e entregáveis:**

- instituir escritório e governança de campo;
- contratar e executar levantamentos por lotes;
- expandir GIS, VANT, imagens 360°/8K e acervo audiovisual;
- priorizar municípios sem cobertura equivalente de Street View;
- produzir portfólios e pacotes de evidência municipais;
- registrar situação, data, origem, licença, qualidade e cobertura de cada ativo;
- alcançar todos os 142 municípios com situação verificável, inclusive quando um
  levantamento estiver pendente ou indisponível.

**Gate:** 142 municípios com situação de mapeamento auditável.

## F6 — Ecossistema científico

**Período:** meses 24–33.

**Objetivo:** tornar os dados reproduzíveis e fortalecer pesquisa, transparência
e participação social.

**Escopo e entregáveis:**

- implantar portal científico e catálogo de dados abertos baseado em DCAT;
- publicar metodologias, versões, proveniência, licenças e artefatos de
  reprodução;
- estabelecer parcerias com universidades e instituições de pesquisa;
- permitir avaliações e metodologias independentes;
- criar mecanismos de participação cidadã e devolutiva;
- implantar observatório de impacto e acompanhar o uso público dos dados;
- ampliar APIs, downloads e documentação para pesquisadores e parceiros.

**Gate:** metodologias avaliáveis de forma independente e conjuntos de dados
reproduzíveis.

## F7 — Consolidação

**Período:** meses 30–36.

**Objetivo:** consolidar a sustentabilidade técnica, institucional e operacional
da plataforma.

**Escopo e entregáveis:**

- atingir e sustentar 300 indicadores;
- concluir auditoria integral do programa e tratar não conformidades;
- comprovar plano de continuidade e recuperação de desastre;
- implantar preservação digital e política de retenção dos ativos;
- consolidar operação, suporte, segurança, FinOps e acordos de nível de serviço;
- definir modelo permanente de financiamento, governança e atualização;
- parametrizar a plataforma para possível adoção por outras unidades da
  federação;
- publicar balanço final de evidências, itens entregues e pendências remanescentes.

**Gate:** 300 indicadores sustentados, recuperação de desastre comprovada,
auditoria integral concluída e operação permanente aprovada.

## Regras comuns de aceite

Um recurso somente deve ser anunciado como entregue quando houver:

1. código integrado e revisado;
2. dados oficiais, licenciados e identificados;
3. operação monitorada;
4. testes e critérios de aceite aprovados;
5. responsável nominal e plano de sustentação;
6. evidências de fonte, referência, extração, licença e hash para valores factuais.

## Dependências críticas

- disponibilidade e formalização de convênios para fontes de dados;
- definição e manutenção da arquitetura da Xingú e do gateway multiprovedor;
- conformidade com a LGPD, especialmente na coleta domiciliar e em dados cedidos;
- orçamento, equipe permanente e capacidade de contratação de campo;
- infraestrutura em região brasileira, portabilidade e soberania dos ativos;
- validação institucional dos gates e indicação de responsáveis nominais.

## Documentos de origem

- [Plano Diretor ITMT — 36 meses](PLANO_DIRETOR_36_MESES.md)
- [Roadmap original por fases](../spec/ROADMAP.md)
- [PRD da Plataforma ITMT](../spec/PRD.md)
- [Matriz de evidências](MATRIZ_EVIDENCIAS.md)
- [Governança e RACI](GOVERNANCA_RACI.md)

