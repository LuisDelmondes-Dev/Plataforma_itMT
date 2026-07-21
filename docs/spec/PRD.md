# PRD — Plataforma SaaS Inteligente com Orquestrador Multiagente
## Plataforma ITMT — Inteligência Territorial de Mato Grosso

> **Versão:** 1.0 — Documento de Requisitos de Produto (PRD)
> **Produto:** Plataforma ITMT (web + apps) orquestrada pela IA Xingú
> **Proponente identificada nos documentos:** QXT Tecnologia (startup mato-grossense de TI) — *Processo INPP nº 01246.000159/2026-51*
> **Domínios citados:** itmt.com.br / mtpainel.com — **Parceiro citado:** SECITECI
> **Escopo geográfico:** Estado de Mato Grosso (142 municípios)

**Legenda de marcação de origem (conforme solicitado):**
- ✅ **Extraído dos documentos** — afirmação fundamentada diretamente no material anexo.
- 🧩 **Proposta complementar** — recomendação técnica/estratégica acrescentada por não constar nos documentos.
- ⚠️ **Ponto a validar** — informação incerta, ambígua ou que depende de decisão de negócio.

---

## Sumário

1. Resumo Executivo
2. Visão do Produto
3. Problema a ser Resolvido
4. Público-Alvo
5. Personas
6. Objetivos do Produto
7. Escopo do Produto
8. Funcionalidades Principais
9. Módulos do Sistema
10. Orquestrador de Agentes (IA Xingú)
11. Agentes Especialistas
12. Fluxos de Usuário
13. Regras de Negócio
14. Requisitos Funcionais
15. Requisitos Não Funcionais
16. Arquitetura Técnica Sugerida
17. Modelo de Dados Inicial
18. APIs e Integrações
19. Segurança, LGPD e Governança
20. Monetização SaaS
21. MVP
22. Roadmap por Fases
23. Telas Necessárias
24. Critérios de Aceite Gerais
25. Riscos e Mitigações
26. Perguntas em Aberto
27. Entregáveis para Desenvolvimento (.md)

---

## 1. Resumo Executivo

A **Plataforma ITMT (Inteligência Territorial de Mato Grosso)** é um SaaS de inteligência territorial que reúne, atualiza, interpreta e entrega — de forma simples e acessível ao público — todos os dados e indicadores socioeconômicos disponíveis sobre o Estado de Mato Grosso, seus 142 municípios e suas instituições públicas e privadas.

✅ **Extraído dos documentos:** o conceito central é a *inteligência territorial* — a ciência que capacita uma sociedade a produzir, interpretar e usar informações sobre si mesma para orientar decisões coletivas e promover desenvolvimento sustentável, combinando indicadores de múltiplas fontes com sensoriamento remoto, GIS, análise preditiva e visualização interativa.

O cérebro da plataforma é a **IA Xingú**, descrita nos documentos como uma Inteligência Artificial própria, em tecnologia de código aberto, que atua como **Orquestradora Central de um Sistema Multiagente**. Ela coordena, gerencia, compila, armazena, acessa, interpreta e entrega os dados ao usuário final, acionando múltiplos **Agentes de IA** especialistas (interligados e independentes) que otimizam os workflows necessários.

O usuário interage por **navegador (desktop/smartphone)**, por **aplicativos nativos (iOS/Android)** e por **IA conversacional em texto e áudio**. ✅ Um exemplo concreto consta nos documentos: o usuário pergunta *"Quantos km de estrada vicinal existem em Mato Grosso?"* e a IA responde com o número e oferece, proativamente, um relatório detalhado por município.

🧩 **Proposta complementar:** embora os documentos tratem a Xingú como uma IA própria a ser desenvolvida, este PRD recomenda implementá-la como um **orquestrador agnóstico de modelos** (gateway de IA), capaz de rotear cada subtarefa para o modelo/IA mais adequado segundo critérios de tipo de tarefa, custo, velocidade, precisão e privacidade — o que reduz risco, custo e dependência de um único fornecedor.

**Diferenciais centrais:**
- Cobertura **exaustiva e atualizada** de dados de MT (conteúdo de terceiros + conteúdo próprio).
- **Mapeamento digital presencial** do Estado (drone/VANT, Street View 360º 8K, registro cinegráfico, mapeamento estatístico).
- **Acesso gratuito** ao banco de dados como meta estratégica ✅, com camadas pagas de valor agregado 🧩.
- **Resposta inteligente, rastreável e em múltiplos formatos** (texto, dashboard, relatório, mapa, PDF, planilha).

---

## 2. Visão do Produto

✅ **Missão (extraída):** criar o maior, mais completo, atualizado e tecnologicamente avançado **Banco de Dados sobre Mato Grosso**, seus municípios e suas instituições públicas e privadas.

✅ **Visão (extraída):**
- Tornar a plataforma uma ferramenta indispensável para quem se dedica a pesquisa, planejamento e gestão de instituições públicas e privadas de MT.
- Permitir que o Brasil e o mundo analisem MT e identifiquem potencialidades.
- Tornar-se, em 1 ano, um dos 10 endereços virtuais mais acessados do Estado.

✅ **Valores (extraídos):** ser socialmente relevante; ser dinâmico sem perder a essência; ser abrangente sem perder o foco; avançar tecnologicamente sem perder a humanidade; ser audaz sem perder a humildade; abraçar a modernidade sem soltar a mão dos princípios consagrados.

**Visão sintetizada do produto:** uma plataforma onde *qualquer pessoa* — do gestor público ao cidadão — formula uma pergunta em linguagem natural sobre o território de MT e recebe, em segundos, uma resposta confiável, com fonte citada, no formato mais útil (texto, mapa, gráfico, relatório ou planilha), graças a um orquestrador de IA que decompõe a demanda e aciona agentes e modelos especializados.

---

## 3. Problema a ser Resolvido

Problemas identificados a partir dos documentos e do contexto:

1. ✅ **Dados dispersos e fragmentados:** os indicadores de MT estão espalhados em diversos bancos de dados governamentais, privados, institucionais e acadêmicos, sem consolidação. Os documentos posicionam a plataforma como agregadora dessas múltiplas fontes.
2. ✅ **Dados brutos e não acionáveis:** falta a transformação de "dados brutos e dispersos em planejamento estratégico" (essência da inteligência territorial).
3. ✅ **Defasagem e ausência de atualização contínua:** os documentos enfatizam *manter atualizada* toda a série histórica, indicando que hoje os dados não são mantidos de forma contínua.
4. ✅ **Lacunas de mapeamento físico/digital:** apenas 39 dos 142 municípios possuem ruas mapeadas no Street View; faltam dados topográficos precisos, curvas de nível e modelos 3D atualizados de todas as cidades.
5. ✅ **Barreira de acesso à informação:** a meta de "acesso gratuito ao banco de dados" indica que hoje a informação é de difícil acesso para o cidadão comum.
6. 🧩 **Complexidade de consulta:** mesmo onde os dados existem, exigem conhecimento técnico (planilhas, portais, GIS). Falta uma camada de linguagem natural que democratize a consulta.
7. 🧩 **Falta de rastreabilidade e confiança:** decisões públicas e privadas precisam de dados com fonte citada e auditável — algo que portais isolados raramente oferecem.

---

## 4. Público-Alvo

Tipos de usuários identificados/derivados dos documentos:

- ✅ **Gestores públicos** (prefeituras, secretarias, consórcios municipais) — planejamento e gestão.
- ✅ **Pesquisadores e universidades** — os documentos citam áreas de PD&I (Arquitetura e Urbanismo, Assistência Social, Economia, Engenharias, Geologia, História, Saúde Coletiva, Estatística, Geografia/geoprocessamento, TI).
- ✅ **Instituições públicas e privadas** que necessitam de base de dados confiável e atualizada.
- ✅ **Cidadãos** (acesso gratuito ao banco de dados) — incluindo consulta por voz/texto.
- ✅ **Investidores nacionais e internacionais** ("Brasil e o mundo" analisando potencialidades de MT).
- 🧩 **Empresas privadas** (agronegócio, indústria, comércio, serviços) buscando inteligência de mercado regional.
- 🧩 **Consultores e escritórios técnicos** (engenharia, urbanismo, ambiental).
- 🧩 **Jornalistas e imprensa** (dados oficiais e séries históricas).
- 🧩 **Administradores da plataforma e equipe interna de análise de dados**.
- 🧩 **Agentes comunitários de saúde** (papel ativo na coleta — pesquisa domiciliar).

---

## 5. Personas

🧩 **Proposta complementar** (personas construídas a partir dos públicos extraídos):

### Persona 1 — Carla, Secretária de Planejamento Municipal
- **Perfil:** 42 anos, gestora pública de um município de médio porte do interior de MT.
- **Necessidades:** dados consolidados de infraestrutura, economia e demografia para elaborar PPA, captar emendas e justificar projetos.
- **Dores:** dados espalhados em portais diferentes, defasados; depende de terceiros para gerar relatórios; prazos curtos.
- **Como usará:** pedirá relatórios prontos por município/tema ("relatório de infraestrutura urbana de [município]") e dashboards comparativos com municípios vizinhos.
- **Funcionalidades-chave:** relatórios em PDF, dashboards, consulta por localidade, mapas, citação de fontes.

### Persona 2 — Prof. Renato, Pesquisador Universitário (Geografia/Geoprocessamento)
- **Perfil:** 38 anos, docente/pesquisador, lida com dados georreferenciados e séries históricas.
- **Necessidades:** acesso a dados brutos, camadas GIS, censos IBGE (1990/2000/2010/2022), ortomosaicos e nuvens de pontos.
- **Dores:** dificuldade de obter dados em formato reaproveitável; falta de metadados e fontes; ausência de API.
- **Como usará:** download de datasets, consulta via API, visualização de camadas de mapa, exportação de planilhas.
- **Funcionalidades-chave:** API, exportação CSV/GeoJSON, módulo de mapas/GIS, rastreabilidade de fonte.

### Persona 3 — Marina, Analista de Expansão (Empresa Privada / Agronegócio)
- **Perfil:** 34 anos, analista de uma empresa avaliando novas regiões para investimento.
- **Necessidades:** inteligência de mercado regional — área plantada, armazenagem, logística (rodovias, portos, intermodais), economia privada.
- **Dores:** sem visão integrada de potencial econômico por região; pesquisa manual e lenta.
- **Como usará:** consultas por região/consórcio e tema "Agronegócio" e "Infraestrutura Macro"; relatórios de oportunidade.
- **Funcionalidades-chave:** consulta por região, dashboards econômicos, mapas, relatórios, planos pagos avançados.

### Persona 4 — Seu João, Cidadão / Liderança Comunitária
- **Perfil:** 55 anos, morador, baixa familiaridade técnica.
- **Necessidades:** saber o que existe e o que falta em sua cidade (saúde, educação, saneamento).
- **Dores:** não sabe navegar em portais oficiais; precisa de respostas simples.
- **Como usará:** chat por voz/áudio em linguagem natural; respostas faladas e textuais.
- **Funcionalidades-chave:** IA conversacional por áudio, respostas simples, acesso gratuito.

### Persona 5 — Tiago, Administrador da Plataforma (QXT/Operação)
- **Perfil:** 30 anos, engenheiro de dados/plataforma.
- **Necessidades:** monitorar ingestão de dados, custo de IA, qualidade das respostas, auditoria, gestão de tenants e planos.
- **Dores:** controlar custo de modelos, evitar alucinações, garantir LGPD e rastreabilidade.
- **Como usará:** painel administrativo, gestão de agentes/IAs, logs de execução, auditoria.
- **Funcionalidades-chave:** módulo administrativo, gestão de IAs, observabilidade, auditoria.

### Persona 6 — Ana, Agente Comunitária de Saúde (Coletora de Dados)
- **Perfil:** 29 anos, agente de saúde — ✅ os documentos citam 5.107 agentes comunitários de saúde e 2.041 de combate a endemias em MT.
- **Necessidades:** aplicar questionário domiciliar resumido via app, de forma rápida, durante visitas.
- **Dores:** formulários longos, conectividade ruim no campo.
- **Como usará:** app de coleta com questionário curto, modo offline, recompensa financeira por participação ✅.
- **Funcionalidades-chave:** app de coleta domiciliar, modo offline, formulários gerados por IA.

---

## 6. Objetivos do Produto

### Objetivos Estratégicos
- ✅ Tornar-se, em 1 ano, um dos 10 endereços virtuais mais acessados de MT.
- ✅ Criar o maior e mais completo banco de dados sobre Mato Grosso.
- ✅ Assegurar acesso gratuito ao banco de dados de informações estratégicas.

### Objetivos Operacionais
- ✅ Coletar e compilar todos os dados socioeconômicos disponíveis (fontes governamentais, privadas, institucionais e acadêmicas).
- ✅ Realizar presencialmente o mapeamento digital de todos os 142 municípios.
- ✅ Manter a série histórica continuamente atualizada via parcerias, convênios e prospecção digital.
- 🧩 Atingir cobertura de Street View 360º/8K nos 103 municípios ainda não mapeados (142 − 39).

### Objetivos Técnicos
- ✅ Operar como SaaS multitenant na nuvem.
- ✅ Orquestrar um sistema multiagente (IA Xingú) para coleta, armazenamento, interpretação e entrega de dados.
- 🧩 Implementar gateway de IA agnóstico, banco vetorial para busca semântica (RAG) e pipeline de ingestão contínua.
- 🧩 Garantir rastreabilidade ponta a ponta (cada resposta com fonte e log de execução).

### Objetivos de Negócio
- 🧩 Monetizar via planos (gratuito, profissional, institucional, governo/enterprise) e serviços de dados/mapeamento.
- 🧩 Estabelecer parcerias com prefeituras, consórcios e instituições (SECITECI já citado como parceiro).

### Objetivos de Experiência do Usuário
- ✅ Permitir consulta por texto, áudio e interface visual com respostas em linguagem natural.
- ✅ Entregar respostas proativas (ex.: oferecer relatório por município após uma resposta agregada).
- 🧩 Garantir que um leigo obtenha resposta útil em ≤ 3 interações.

---

## 7. Escopo do Produto

### 7.1. Dentro do escopo
- ✅ Interface web (browser) para desktop e smartphone.
- ✅ Aplicativos nativos iOS e Android.
- ✅ IA conversacional por texto e áudio.
- ✅ Pesquisa por **localidade**: todo o Estado; por município (1 dos 142); regiões geográficas intermediárias (Barra do Garças, Cáceres, Cuiabá, Rondonópolis, Sinop); regiões geográficas imediatas (18 subdivisões IBGE); consórcio municipal de Infraestrutura e Desenvolvimento; consórcio municipal de Saúde (16 consórcios).
- ✅ Pesquisa por **tema** (17 temas) e subtemas detalhados (taxonomia completa — ver Seção 13/Anexo de taxonomia).
- ✅ Banco de dados consolidado de indicadores socioeconômicos de MT.
- ✅ Orquestrador multiagente (IA Xingú) + agentes especialistas de IA.
- ✅ Mapeamento digital: geoprocessamento/GIS, VANT/drone (ortomosaico, MDS, MDT, 3D), Street View 360º 8K, registro cinegráfico/fotojornalístico, mapeamento estatístico.
- ✅ Banco de imagens/vídeos (app "MT Imagens"), incluindo contribuição da população.
- ✅ Geração de saídas em texto, dashboard, relatório, mapa, PDF e planilha.
- ✅ Pesquisa domiciliar via app de agentes de saúde (2º ano).
- 🧩 Gestão de usuários, organizações/tenants, papéis e permissões.
- 🧩 APIs públicas e privadas, auditoria, planos e assinaturas.

### 7.2. Fora do escopo (inicial)
- 🧩 Cobertura geográfica fora de Mato Grosso.
- 🧩 Marketplace aberto de agentes de terceiros (previsto apenas em fase de escala).
- 🧩 Treinamento de modelo fundacional próprio do zero (recomenda-se usar modelos abertos/comerciais + fine-tuning leve no início).
- 🧩 Transações financeiras/pagamentos de serviços públicos (não é objetivo da plataforma).
- ⚠️ Dados em tempo real de sensores IoT (não citado — a validar).
- ⚠️ Atos de gestão de RH na imprensa oficial — ✅ os documentos excluem explicitamente "atos de gestão de RH" das publicações; portanto, fora do escopo de indexação.

---

## 8. Funcionalidades Principais

Para cada funcionalidade: Descrição · Usuários · Entrada · Processamento · Saída · Regras · Critérios de aceite · Prioridade · Fase.

### F1 — Consulta Inteligente por Linguagem Natural (Chat Xingú)
- **Descrição:** ✅ usuário pergunta por texto ou áudio e recebe resposta em texto e áudio; a IA pode oferecer aprofundamento (ex.: relatório por município).
- **Usuários:** todos.
- **Entrada:** texto/áudio em linguagem natural.
- **Processamento:** transcrição (se áudio) → interpretação de intenção → classificação → decomposição → seleção de agentes/IAs → execução → validação → consolidação.
- **Saída:** resposta em texto e áudio, com fonte citada e oferta de próximos passos.
- **Regras:** sempre citar fonte; nunca inventar dado ausente; oferecer formato alternativo.
- **Critérios de aceite:** responde corretamente ao exemplo "Quantos km de estrada vicinal existem em MT?" com valor + fonte + oferta de relatório por município.
- **Prioridade:** Alta · **Fase:** MVP.

### F2 — Pesquisa por Localidade (multinível)
- **Descrição:** ✅ filtro por Estado, município (142), regiões intermediárias (5), imediatas (18), consórcio de infraestrutura, consórcio de saúde (16).
- **Usuários:** todos.
- **Entrada:** seleção de nível e local.
- **Processamento:** resolução geográfica → filtro de dados por recorte.
- **Saída:** conjunto de indicadores/relatório do recorte.
- **Regras:** apenas 1 município por vez (✅ "01 dos 142 município de cada vez"); recortes regionais agregam municípios componentes.
- **Critérios de aceite:** todos os 6 níveis de recorte disponíveis e consistentes.
- **Prioridade:** Alta · **Fase:** MVP.

### F3 — Pesquisa por Tema e Subtema
- **Descrição:** ✅ 17 temas (Saúde, Segurança Pública, Educação, Meio Ambiente, Assistência Social, Mercado de Trabalho, Agronegócio, Imprensa Oficial, Economia Setor Público, Economia Setor Privado, Instituições, Demografia, Geografia, Infraestrutura Macro, Infraestrutura Urbana, Registros Históricos, Outros) com subtemas detalhados.
- **Usuários:** todos.
- **Entrada:** tema + subtemas + recorte de localidade.
- **Processamento:** filtragem na base + composição de resposta.
- **Saída:** indicadores, listas, mapas e relatórios.
- **Critérios de aceite:** taxonomia completa navegável (ver Seção 13).
- **Prioridade:** Alta · **Fase:** MVP (subconjunto) → Fase 2 (completo).

### F4 — Geração de Relatórios (PDF/planilha)
- **Descrição:** relatórios completos por município/região/tema (ex.: "relatório completo sobre infraestrutura urbana do município X").
- **Usuários:** gestores, pesquisadores, empresas.
- **Entrada:** parâmetros de recorte e tema.
- **Processamento:** coleta de dados → agente de relatórios → renderização PDF/planilha.
- **Saída:** PDF, XLSX/CSV.
- **Regras:** incluir fontes, data de atualização e marca d'água de versão.
- **Critérios de aceite:** relatório gerado em ≤ 60s com fontes citadas.
- **Prioridade:** Alta · **Fase:** MVP (simples) → Fase 2/3 (avançado).

### F5 — Dashboards Interativos
- **Descrição:** painéis com indicadores e comparativos.
- **Usuários:** gestores, empresas, pesquisadores.
- **Saída:** gráficos, KPIs, comparativos entre localidades.
- **Prioridade:** Média · **Fase:** Fase 2.

### F6 — Mapas e Camadas GIS
- **Descrição:** ✅ visualização georreferenciada; camadas de relevo, hidrografia, infraestrutura; ortomosaico/MDS/MDT renderizáveis em 3D; integração com Street View no Google Maps.
- **Usuários:** pesquisadores, gestores, empresas.
- **Prioridade:** Alta (visualização básica no MVP) · **Fase:** MVP → Fase 2/3.

### F7 — Upload e Análise de Documentos
- **Descrição:** ✅ Xingú faz leitura/interpretação de dados e **OCR** de arquivos, compilação de dados e geração de formulários.
- **Usuários:** equipe interna, instituições parceiras, usuários avançados.
- **Saída:** dados extraídos, estruturados e indexados.
- **Prioridade:** Alta · **Fase:** MVP.

### F8 — Banco de Imagens e Vídeos ("MT Imagens")
- **Descrição:** ✅ acervo de fotos/vídeos (inclusive 3D/360º 8K), vídeos institucionais de 15–20 min por município; contribuição da população e instituições.
- **Prioridade:** Média · **Fase:** Fase 2/3.

### F9 — Coleta Estatística Domiciliar (App de Agentes de Saúde)
- **Descrição:** ✅ app para agentes de saúde aplicarem questionário resumido em visitas; recompensa financeira; 2º ano.
- **Prioridade:** Média · **Fase:** Fase 3.

### F10 — Ingestão e Atualização Contínua de Dados (Prospecção)
- **Descrição:** ✅ coleta por parcerias/convênios/mineração digital; compilação e parametrização geridas pela Xingú.
- **Prioridade:** Alta · **Fase:** Fase 0/1 (fundação) → contínuo.

### F11 — Rastreabilidade e Citação de Fontes
- **Descrição:** 🧩 cada resposta exibe fontes, data e nível de confiança; log de execução do orquestrador.
- **Prioridade:** Alta · **Fase:** MVP.

### F12 — Gestão de Usuários, Tenants e Planos
- **Descrição:** 🧩 autenticação, organizações, papéis/permissões, assinaturas.
- **Prioridade:** Alta (auth no MVP) · **Fase:** MVP → Fase 2/4.

---

## 9. Módulos do Sistema

| # | Módulo | Função principal | Fase |
|---|--------|------------------|------|
| M1 | Autenticação e Usuários | Login, cadastro, perfis, recuperação de senha, SSO | MVP |
| M2 | Organizações/Tenants | Isolamento multitenant, gestão de organizações | Fase 2 (base no MVP) |
| M3 | Chat Inteligente | Interface conversacional texto/áudio | MVP |
| M4 | Agente Orquestrador (Xingú) | Interpretar, decompor, rotear, validar, consolidar | MVP |
| M5 | Agentes Especialistas | Catálogo e execução de agentes de IA | MVP (núcleo) |
| M6 | Gestão de IAs/Modelos | Gateway de IA, registro de modelos, roteamento | MVP (básico) |
| M7 | Documentos | Upload, OCR, extração, indexação | MVP |
| M8 | Base de Dados | Repositório de indicadores + banco vetorial (RAG) | MVP |
| M9 | Relatórios | Geração de PDF/planilha | MVP (simples) |
| M10 | Dashboards | Painéis e KPIs | Fase 2 |
| M11 | Mapas/GIS | Camadas, ortomosaico, Street View, 3D | MVP (básico) → Fase 2/3 |
| M12 | APIs e Integrações | APIs internas/externas, conectores de fontes | Fase 2 |
| M13 | Auditoria | Logs de execução, trilha de auditoria | MVP (básico) → Fase 2 |
| M14 | Administrativo | Gestão da plataforma, agentes, custos | Fase 2 |
| M15 | Assinaturas e Planos | Billing, limites, upgrade | Fase 4 |
| M16 | Banco de Imagens/Vídeos | Acervo MT Imagens, contribuições | Fase 2/3 |
| M17 | Coleta de Campo | App de mapeamento estatístico domiciliar | Fase 3 |

---

## 10. Orquestrador de Agentes (IA Xingú)

✅ **Base nos documentos:** a Xingú é a Orquestradora Central de um sistema multiagente, composta por múltiplos Agentes de IA "interligados e independentes", que otimizam os workflows. Suas frentes de atuação descritas são: (1) prospecção e coleta de dados (leitura/interpretação, OCR, compilação, geração de formulários); (2) armazenamento (caracterização e agrupamento por natureza: texto, planilha, mapa, gráfico, imagem, vídeo); (3) manipulação de nuvem de pontos (mapas, maquetes, imagens, vídeos, medições); (4) interpretação de dados (combinações conforme demanda); (5) outras (a IA "cresce e aprende").

🧩 **Detalhamento operacional proposto:**

**1. Recebimento da solicitação** — entrada por texto, áudio (transcrição via STT) ou seleção visual (filtros de localidade/tema). Normalização da requisição.

**2. Interpretação da intenção** — modelo de NLU identifica intenção (ex.: consulta factual, geração de relatório, comparação, mapa), entidades (município, tema, período) e formato de saída desejado.

**3. Classificação da tarefa** — categoriza em tipos: *factual simples*, *agregação/estatística*, *geoespacial*, *documental/OCR*, *relatório*, *pesquisa web*, *multiagente complexa*.

**4. Decomposição em subtarefas** — gera um plano (grafo de tarefas) com dependências. Ex.: "relatório de infraestrutura urbana do município X" → [resolver município] → [coletar subtemas de infra urbana] → [validar consistência] → [gerar gráficos] → [montar PDF].

**5. Seleção de agentes** — para cada subtarefa, escolhe o(s) agente(s) especialista(s) do catálogo (Seção 11).

**6. Seleção de IAs/modelos** — o gateway de IA escolhe o modelo por critérios: tipo da tarefa, custo, velocidade, precisão, privacidade, complexidade, formato de entrada/saída, necessidade de raciocínio, consulta externa e validação humana. *(Critérios ✅ exigidos pelo prompt; política de roteamento 🧩.)*

**7. Controle do workflow** — orquestra execução sequencial/paralela, com fila de processamento e timeouts.

**8. Tratamento de erros** — retry com backoff, fallback de modelo, e — quando incerto — solicita confirmação ao usuário (ex.: ✅ "Você deseja um relatório por município?").

**9. Pedido de confirmação** — quando a intenção é ambígua, o custo é alto, ou os dados estão incompletos/conflitantes, a Xingú pergunta antes de prosseguir.

**10. Registro de logs** — cada passo gera `AgentExecution` com inputs, modelo usado, custo, tempo, fontes e resultado (rastreabilidade).

**11. Validação do resultado** — agente de validação técnica/qualidade confere consistência, fontes e ausência de alucinação; pode disparar revisão humana.

**12. Entrega final** — consolida no formato adequado (texto, áudio, dashboard, relatório, mapa, PDF, planilha) com fontes e data de atualização.

### Política de Seleção de IAs (roteamento) 🧩

| Critério | Como influencia a escolha |
|----------|---------------------------|
| Tipo da tarefa | OCR → modelo de visão; raciocínio → LLM de raciocínio; busca → embeddings + RAG |
| Custo | tarefas simples → modelos baratos/locais; complexas → modelos premium |
| Velocidade | respostas de chat → modelo rápido; relatórios em lote → assíncrono |
| Precisão | dados críticos (saúde/economia) → modelo de maior acurácia + validação |
| Privacidade | dados sensíveis/LGPD → modelo on-premise/local, sem envio a terceiros |
| Complexidade | multi-etapa → orquestração com agente de planejamento |
| Formato entrada/saída | imagem/áudio/planilha → modelos multimodais específicos |
| Necessidade de raciocínio | alta → LLM de reasoning; baixa → modelo leve |
| Consulta externa | quando dado não está na base → agente de pesquisa web |
| Validação humana | resultado de baixa confiança → fila de revisão humana |

### Exemplos de Fluxo (orquestração)

**Exemplo A — pergunta factual (✅ do documento):**
> Usuário (áudio): "Quantos km de estrada vicinal existem em Mato Grosso?"
1. STT transcreve → 2. NLU: intenção=factual, tema=Infra Macro/Estradas Vicinais, recorte=Estado → 3. Agente de Dados consulta base → 4. Agente de Qualidade valida fonte → 5. Xingú responde em texto+áudio com valor e fonte → 6. Oferta proativa: "Deseja um relatório por município?".

**Exemplo B — relatório complexo:**
> "Quero um relatório completo sobre infraestrutura urbana do município X."
1. NLU+decomposição → 2. Agente de Dados coleta subtemas (vias pavimentadas, rede de esgoto/água, ETA/ETE, drenagem, aterro, cemitérios) → 3. Agente GIS gera mapa do município → 4. Agente de Visualização cria gráficos → 5. Agente de Validação confere → 6. Agente de Relatórios monta PDF → 7. entrega com fontes e data.

---

## 11. Agentes Especialistas

🧩 Catálogo proposto (alinhado às frentes da Xingú ✅ e à taxonomia ITMT). "P-MVP" = prioridade para o MVP.

| Agente | Função | Quando é acionado | Entrada | Processamento | Saída | IAs/Ferramentas | P-MVP |
|--------|--------|-------------------|---------|---------------|-------|-----------------|:-----:|
| Orquestrador (Xingú) | Planejar, rotear, validar, consolidar | Toda requisição | Solicitação do usuário | Decomposição + roteamento | Resposta final consolidada | LLM de raciocínio + planner | ✅ Alta |
| Agente Conversacional | Diálogo texto/áudio, esclarecimento | Interação com usuário | Texto/áudio | NLU + STT/TTS | Resposta em linguagem natural | LLM + STT + TTS | ✅ Alta |
| Agente de Dados e Indicadores | Consultar/agregar indicadores | Consulta factual/estatística | Tema+recorte | Query SQL/analítica | Tabelas, números, séries | LLM + SQL + lib estatística | ✅ Alta |
| Agente de Análise de Documentos | Ler/interpretar docs, OCR | Upload ou ingestão | PDF/imagem/planilha | OCR + extração + estruturação | Dados estruturados, índice | OCR + LLM multimodal | ✅ Alta |
| Agente de Busca Semântica (RAG) | Recuperar contexto da base | Consultas que exigem conhecimento da base | Pergunta | Embeddings + vetor | Trechos relevantes + fontes | Embeddings + banco vetorial | ✅ Alta |
| Agente de Geoprocessamento/GIS | Mapas, camadas, nuvem de pontos | Demanda geoespacial | Recorte + camadas | Processamento GIS/3D | Mapas, ortomosaico, medições | GIS engine + visão computacional | ✅ Alta |
| Agente de Relatórios | Montar relatórios | Pedido de relatório | Dados + template | Composição + render | PDF/planilha | LLM + gerador de PDF/XLSX | ✅ Alta |
| Agente de Visualização de Dados | Gráficos e dashboards | Saída visual | Dados | Geração de charts | Gráficos/painéis | Lib de visualização | Média |
| Agente de Pesquisa Web | Buscar dado externo ausente | Dado não está na base | Consulta | Busca + extração + verificação | Dado + fonte externa | LLM + web search | Média |
| Agente de Validação Técnica | Conferir consistência/lógica | Antes da entrega | Resultado parcial | Checagem de regras | Aprovação/rejeição | LLM + regras | ✅ Alta |
| Agente de Qualidade da Informação | Citar fonte, medir confiança, anti-alucinação | Toda resposta | Resposta + fontes | Verificação de fonte | Score + citações | LLM + verificador | ✅ Alta |
| Agente de Geração de PDF | Renderizar documento final | Saída em PDF | Conteúdo estruturado | Renderização | PDF | Gerador de PDF | ✅ Alta |
| Agente de Auditoria e Rastreabilidade | Registrar logs de execução | Toda execução | Eventos | Log estruturado | Trilha de auditoria | Logging + storage | ✅ Alta |
| Agente de Segurança e LGPD | Mascarar/anonimizar, checar permissões | Dados sensíveis | Dados + perfil | Mascaramento + ACL | Dados conformes | Regras + classificador | ✅ Alta |
| Agente de Integração com APIs | Conectar fontes externas | Ingestão/consulta externa | Endpoint+credenciais | Chamada + normalização | Dados normalizados | Conectores | Média |
| Agente de Coleta de Campo | Gerar/aplicar questionário domiciliar | Pesquisa estatística (2º ano) | Parâmetros | Geração de formulário | Dados de campo | LLM + app móvel | Baixa |


---

## 12. Fluxos de Usuário

🧩 (fluxos derivados; o exemplo de consulta por áudio é ✅).

**12.1. Cadastro e Login**
Acessa landing → "Criar conta" → e-mail/SSO → verificação → onboarding (tipo de usuário) → dashboard inicial. *(Acesso de consulta básica pode ser anônimo/gratuito ✅; recursos avançados exigem login.)*

**12.2. Envio de pergunta ao sistema**
Abre chat → digita/fala a pergunta → Xingú interpreta → (se ambíguo) pergunta de volta → executa → entrega resposta com fonte → oferece próximo passo.

**12.3. Upload de documento**
Chat/Documentos → envia arquivo → OCR/extração → confirmação do que foi entendido → dado indexado → disponível para consulta.

**12.4. Pedido de relatório**
Seleciona localidade + tema → "Gerar relatório" → escolhe formato (PDF/planilha) → processamento assíncrono → notificação → download com fontes/data.

**12.5. Consulta por município/região/tema**
Seleciona nível de recorte (Estado/município/região/consórcio) → tema → subtemas → visualiza resultados (lista, mapa, gráfico) → exporta.

**12.6. Geração de dashboard**
Escolhe indicadores + recorte + comparativos → dashboard renderizado → salva/compartilha.

**12.7. Geração de PDF**
A partir de qualquer resultado → "Exportar PDF" → agente de PDF compõe → download.

**12.8. Uso de comando por áudio** ✅
Toca no microfone → fala → STT → resposta em texto e áudio (TTS) → oferta proativa de aprofundamento.

**12.9. Consulta com múltiplos agentes**
Pergunta complexa → Xingú decompõe → executa agentes em paralelo (dados + GIS + visualização) → consolida → entrega unificada.

**12.10. Validação e revisão humana**
Resultado de baixa confiança → fila de revisão → revisor humano aprova/corrige → resposta liberada → log registrado.

---

## 13. Regras de Negócio

✅ **RN baseadas/derivadas dos documentos:**
- **RN01 — Acesso gratuito ao banco:** o acesso ao banco de dados estratégico deve ser gratuito ao público (meta estratégica). 🧩 Camadas de valor agregado podem ser pagas.
- **RN02 — Recorte de localidade:** consulta por município é feita "1 de 142 por vez"; recortes regionais agregam municípios componentes (5 intermediárias, 18 imediatas, consórcios de infra, 16 de saúde).
- **RN03 — Citação de fonte:** toda resposta gerada por IA deve indicar a(s) fonte(s) e a data de atualização.
- **RN04 — Gestão de dados pela Xingú:** compilação, parametrização e geração de novos dados são parametrizadas e geridas pela IA Xingú.
- **RN05 — Atualização contínua:** a série histórica deve ser mantida atualizada via parcerias/convênios/prospecção.
- **RN06 — Exclusão de RH na imprensa oficial:** publicações de imprensa oficial indexam atos administrativos, **exceto atos de gestão de RH**.
- **RN07 — Conteúdo próprio x terceiros:** distinguir e marcar a origem do dado (próprio/mapeamento vs. terceiros/preexistente).
- **RN08 — Cobertura de mapeamento:** Street View 360º/8K deve cobrir os 142 municípios (priorizar os 103 ainda sem cobertura).

🧩 **RN complementares propostas:**
- **RN09 — Quem pode acessar:** consulta básica é pública; download em massa, API e relatórios avançados exigem conta/plano.
- **RN10 — Dados públicos x privados:** dados oficiais e abertos são públicos; dados cedidos sob convênio podem ter restrição de uso conforme acordo.
- **RN11 — Dados incompletos:** quando faltar dado, a IA deve declarar a lacuna explicitamente — nunca preencher por suposição.
- **RN12 — Dados conflitantes:** havendo divergência entre fontes, apresentar ambas com a fonte e a mais recente como padrão, sinalizando o conflito.
- **RN13 — Versionamento:** todo dataset e relatório tem versão e data; alterações são auditáveis.
- **RN14 — Auditoria:** toda execução de agente e geração de resposta é registrada (quem, quando, qual modelo, quais fontes, custo).
- **RN15 — Revisão humana:** dados sensíveis ou de baixa confiança passam por revisão antes de publicação.

---

## 14. Requisitos Funcionais

Formato: Código · Descrição · Prioridade · Dependência · Critério de aceite.

| Código | Descrição | Prioridade | Dependência | Critério de aceite |
|--------|-----------|:----------:|-------------|--------------------|
| RF001 | O sistema deve permitir consulta por texto e por áudio em linguagem natural. | Alta | — | Pergunta em áudio é transcrita e respondida em texto+áudio. |
| RF002 | O sistema deve interpretar a intenção e decompor a solicitação em subtarefas. | Alta | RF001 | Plano de execução gerado e registrado. |
| RF003 | O sistema deve consultar a base de dados de indicadores por tema e localidade. | Alta | RF013 | Retorna indicador correto para recorte selecionado. |
| RF004 | O sistema deve selecionar agentes especialistas e modelos de IA por tarefa. | Alta | RF002 | Log mostra agente/modelo escolhido e critério. |
| RF005 | O sistema deve gerar relatórios em PDF e planilha. | Alta | RF003 | PDF/XLSX gerado com fontes e data. |
| RF006 | O sistema deve permitir filtro por Estado, município, região intermediária/imediata e consórcios. | Alta | RF013 | Os 6 níveis de recorte funcionam. |
| RF007 | O sistema deve permitir upload de documentos com OCR e extração de dados. | Alta | — | Texto/dados extraídos e indexados. |
| RF008 | O sistema deve citar fontes e data de atualização em toda resposta. | Alta | RF003 | Resposta sem fonte é bloqueada/sinalizada. |
| RF009 | O sistema deve oferecer respostas proativas de aprofundamento. | Média | RF001 | Após resposta agregada, oferece detalhamento. |
| RF010 | O sistema deve exibir mapas e camadas GIS por recorte. | Alta | RF013 | Mapa do recorte renderizado. |
| RF011 | O sistema deve registrar logs de execução (auditoria/rastreabilidade). | Alta | RF004 | Cada execução gera registro completo. |
| RF012 | O sistema deve permitir cadastro, login e gestão de perfis. | Alta | — | Usuário cria conta e autentica. |
| RF013 | O sistema deve manter base de dados consolidada com banco vetorial (RAG). | Alta | — | Busca semântica retorna trechos com fonte. |
| RF014 | O sistema deve suportar múltiplos tenants/organizações. | Média | RF012 | Dados isolados por tenant. |
| RF015 | O sistema deve gerar dashboards interativos. | Média | RF003 | Painel com KPIs e comparativos. |
| RF016 | O sistema deve validar a qualidade da resposta e detectar inconsistências. | Alta | RF004 | Resposta de baixa confiança vai para revisão. |
| RF017 | O sistema deve permitir confirmação do usuário em casos ambíguos. | Média | RF002 | IA pergunta antes de executar tarefa custosa/ambígua. |
| RF018 | O sistema deve expor APIs para consulta e exportação de dados. | Média | RF013 | Endpoint autenticado retorna dados. |
| RF019 | O sistema deve gerenciar catálogo de agentes e modelos de IA. | Média | RF004 | Admin habilita/desabilita agentes/modelos. |
| RF020 | O sistema deve disponibilizar banco de imagens/vídeos (MT Imagens). | Baixa | — | Acervo navegável com contribuição de usuários. |
| RF021 | O sistema deve oferecer app de coleta domiciliar para agentes de saúde. | Baixa | RF013 | Questionário aplicado e sincronizado (offline). |
| RF022 | O sistema deve gerenciar planos e limites de uso (billing). | Baixa | RF012 | Limites por plano aplicados. |

---

## 15. Requisitos Não Funcionais

🧩 (metas quantitativas a validar ⚠️)

- **Segurança:** criptografia em trânsito (TLS 1.2+) e em repouso (AES-256); gestão de segredos; controle de acesso por papel (RBAC); proteção contra injeção e prompt injection.
- **LGPD:** base legal definida; consentimento quando aplicável; anonimização/mascaramento de dados pessoais; política de retenção; atendimento a direitos do titular; DPO designado.
- **Performance:** resposta de chat factual em ≤ 5s (P95) ⚠️; relatório complexo assíncrono em ≤ 2 min ⚠️.
- **Escalabilidade:** arquitetura horizontalmente escalável; filas para picos de processamento; suportar milhares de usuários simultâneos (meta: top 10 sites do Estado ✅).
- **Disponibilidade:** SLA ≥ 99,5% ⚠️; degradação graciosa quando um modelo de IA estiver indisponível (fallback).
- **Observabilidade:** métricas, tracing distribuído e logs centralizados; painel de custo de IA por execução.
- **Auditabilidade:** trilha imutável de execuções e respostas geradas por IA.
- **Usabilidade:** linguagem natural; ≤ 3 interações para resposta útil; suporte a leigos.
- **Acessibilidade:** WCAG 2.1 AA; suporte a áudio (voz) favorece inclusão.
- **Manutenibilidade:** arquitetura modular; agentes plugáveis; testes automatizados.
- **Custo operacional:** roteamento de IA por custo; cache de respostas; uso de modelos abertos/locais quando possível (✅ a Xingú é prevista em código aberto).
- **Tempo de resposta:** monitorado por tipo de tarefa com alertas.
- **Backup e recuperação:** backups diários; RPO ≤ 24h e RTO ≤ 4h ⚠️.
- **Portabilidade/independência de stack:** evitar lock-in; abstrações para banco, storage e provedores de IA.

---

## 16. Arquitetura Técnica Sugerida

🧩 (proposta agnóstica — tecnologias são exemplos, não obrigatórias; ✅ o modelo SaaS na nuvem e a orquestração multiagente vêm dos documentos)

```
┌──────────────────────────────────────────────────────────────────┐
│                          CLIENTES (Front-end)                       │
│  Web (browser desktop/mobile)  │  App iOS  │  App Android  │ Voz    │
└───────────────┬────────────────┴───────────┴──────────────┴────────┘
                │ HTTPS / WebSocket
        ┌───────▼────────┐
        │  API Gateway   │  (auth, rate limit, roteamento)
        └───────┬────────┘
                │
   ┌────────────▼─────────────┐     ┌──────────────────────────┐
   │  Serviço de Aplicação    │◄────┤  Auth & Permissões (RBAC) │
   │  (BFF / API REST/GraphQL)│     └──────────────────────────┘
   └────────────┬─────────────┘
                │
        ┌───────▼─────────────────────────────────────────┐
        │       MOTOR DE AGENTES — IA XINGÚ                 │
        │  Orquestrador + Catálogo de Agentes + Planner     │
        └───────┬───────────────┬───────────────┬──────────┘
                │               │               │
        ┌───────▼──────┐ ┌──────▼───────┐ ┌─────▼─────────┐
        │ GATEWAY DE IA│ │ Fila/Workers │ │ Agentes       │
        │ (roteamento  │ │ (async jobs) │ │ Especialistas │
        │  multimodelo)│ └──────────────┘ └───────────────┘
        └───────┬──────┘
                │   (modelos abertos/locais + comerciais; STT/TTS; OCR; visão)
   ┌────────────┼───────────────────────────────────────────────┐
   │            │                                                 │
┌──▼───────┐ ┌──▼────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ Banco    │ │ Banco     │ │ Object   │ │ GIS /    │ │ Cache    │
│ Relacion.│ │ Vetorial  │ │ Storage  │ │ Tiles 3D │ │ (Redis)  │
│(Postgres)│ │ (pgvector/│ │(arquivos,│ │(GeoServer│ │          │
│          │ │ Qdrant)   │ │ imagens, │ │ /PostGIS)│ │          │
│          │ │           │ │ vídeos)  │ │          │ │          │
└──────────┘ └───────────┘ └──────────┘ └──────────┘ └──────────┘
        │
┌───────▼───────────────────────────────────────────────────────┐
│ INTEGRAÇÕES EXTERNAS: IBGE, fontes oficiais, imprensa oficial,  │
│ APIs governamentais, Google Maps/Street View, parceiros          │
└────────────────────────────────────────────────────────────────┘
        │
┌───────▼───────────────────────────────────────────────────────┐
│ OBSERVABILIDADE & SEGURANÇA: logs, tracing, métricas, custo IA, │
│ auditoria, gestão de segredos, backup                            │
└────────────────────────────────────────────────────────────────┘
```

**Componentes e tecnologias sugeridas (exemplos):**
- **Front-end web:** React/Next.js ou similar; design responsivo.
- **Apps mobile:** React Native ou Flutter (código compartilhado iOS/Android).
- **Back-end:** Python (FastAPI) e/ou Node.js; microsserviços ou modular monólito no início.
- **Banco relacional:** PostgreSQL (+ PostGIS para geoespacial).
- **Banco vetorial:** pgvector, Qdrant ou Weaviate (RAG/busca semântica).
- **Storage de arquivos:** S3-compatível (MinIO/AWS S3) para docs, imagens, vídeos, ortomosaicos.
- **Fila de processamento:** RabbitMQ/Kafka/Redis Queue para jobs assíncronos.
- **Motor de agentes:** framework de orquestração de agentes (LangGraph, CrewAI ou próprio).
- **Gateway de IA:** camada de roteamento multimodelo (LiteLLM/próprio) com modelos abertos (Llama, Mistral, etc.) e comerciais; OCR (Tesseract/PaddleOCR) e visão computacional.
- **GIS/3D:** PostGIS, GeoServer, MapLibre/Cesium; pipeline de fotogrametria (ortomosaico/MDS/MDT) e nuvens de pontos.
- **Permissões:** RBAC/ABAC + multitenancy.
- **Observabilidade:** OpenTelemetry, Grafana/Prometheus, ELK/Loki.
- **Infra em nuvem:** containers (Docker) + Kubernetes; IaC (Terraform); CI/CD.

⚠️ **Ponto a validar:** os documentos citam a Xingú como "IA própria em código aberto". É preciso definir se será (a) um orquestrador sobre modelos abertos existentes (recomendado para o MVP) ou (b) um modelo treinado do zero (alto custo/risco). Recomendação 🧩: começar com (a).

---

## 17. Modelo de Dados Inicial

🧩 Entidades e principais campos (proposta):

- **User:** id, nome, email, senha_hash, telefone, tipo_usuario, organization_id, status, criado_em.
- **Organization (Tenant):** id, nome, tipo (pública/privada/acadêmica), cnpj, plano_id, status, criado_em.
- **Role:** id, nome, descrição.
- **Permission:** id, código, descrição.
- **RolePermission:** role_id, permission_id.
- **Municipality:** id, nome, codigo_ibge, regiao_intermediaria, regiao_imediata, consorcio_infra_id, consorcio_saude_id, geometria (PostGIS).
- **Region:** id, tipo (intermediaria/imediata), nome, geometria.
- **Consortium:** id, tipo (infraestrutura/saúde), nome, municipios[].
- **Theme:** id, nome (1 dos 17 temas), descrição.
- **Subtheme:** id, theme_id, nome.
- **Indicator:** id, subtheme_id, nome, unidade, descrição, fonte_padrao.
- **IndicatorValue:** id, indicator_id, municipality_id/region_id, valor, periodo, fonte_id, data_atualizacao, versao, origem (próprio/terceiro), confianca.
- **DataSource:** id, nome, tipo (gov/privada/acadêmica/própria), url, contato, licenca_uso, ultima_coleta.
- **Document:** id, organization_id, nome, tipo_arquivo, storage_path, status_ocr, criado_em.
- **DocumentChunk (vetorial):** id, document_id, texto, embedding (vector), metadados, fonte.
- **Dataset:** id, nome, tema, descrição, formato, versao, fonte_id.
- **Agent:** id, nome, função, status, config (json).
- **AgentExecution:** id, request_id, agent_id, ai_model_id, input, output, fontes[], custo, tokens, tempo_ms, status, criado_em.
- **AIModel:** id, nome, provedor, tipo (texto/visão/ocr/embedding/stt/tts), custo_token, latencia_media, privacidade (local/externo), ativo.
- **Workflow:** id, request_id, plano (grafo de tarefas), status, criado_em.
- **Task:** id, workflow_id, tipo, status, dependencias[], agent_id.
- **Request (Consulta):** id, user_id, canal (texto/áudio/visual), conteudo, intencao, recorte, tema, criado_em.
- **Report:** id, request_id, tipo, recorte, tema, formato (pdf/xlsx), storage_path, fontes[], versao, criado_em.
- **Dashboard:** id, organization_id, nome, config (json), criado_em.
- **MapLayer:** id, nome, tipo (relevo/hidrografia/infra/ortomosaico/streetview), municipality_id/region_id, storage_path, formato.
- **MediaAsset (MT Imagens):** id, tipo (foto/vídeo/360/3D), municipality_id, autor, fonte (própria/contribuição), storage_path, criado_em.
- **AuditLog:** id, actor (user/agent), acao, entidade, entidade_id, detalhes (json), criado_em.
- **SubscriptionPlan:** id, nome, preco, limites (json), recursos[].
- **Subscription:** id, organization_id, plan_id, status, inicio, fim.
- **FieldSurvey (coleta domiciliar):** id, agente_saude_id, municipality_id, respostas (json), localizacao, sincronizado_em.

---

## 18. APIs e Integrações

Formato: Nome · Objetivo · Entrada · Saída · Autenticação · Prioridade · Riscos.

**APIs internas (expostas pela plataforma):**

| Nome | Objetivo | Entrada | Saída | Auth | Prioridade | Riscos |
|------|----------|---------|-------|------|:----------:|--------|
| /query | Consulta em linguagem natural | texto/áudio + recorte | resposta + fontes | Token/Anon | Alta | alucinação, custo |
| /indicators | Buscar indicadores por tema/recorte | filtros | JSON de valores | Token | Alta | dado defasado |
| /reports | Gerar/baixar relatório | params | PDF/XLSX | Token | Alta | tempo de geração |
| /documents | Upload + OCR | arquivo | dados extraídos | Token | Alta | qualidade OCR |
| /maps | Camadas e tiles GIS | recorte/camada | GeoJSON/tiles | Token/Anon | Alta | volume de dados |
| /media | Acervo MT Imagens | filtros | URLs de mídia | Token/Anon | Média | direitos de imagem |
| /admin/agents | Gerir agentes/modelos | config | status | Admin | Média | erro de config |
| /auth | Login/registro | credenciais | token | — | Alta | segurança |

**Integrações externas (consumidas):**

| Nome | Objetivo | Entrada | Saída | Auth | Prioridade | Riscos |
|------|----------|---------|-------|------|:----------:|--------|
| IBGE | Censos 1990/2000/2010/2022, geografia | consulta | dados demográficos/geo | Pública | Alta | formato/limites |
| Imprensa Oficial MT | Publicações diárias (✅ exceto RH) | datas/termos | atos administrativos | Pública | Alta | parsing/volume |
| Fontes governamentais (economia pública) | Arrecadação, repasses, obras, etc. | consulta | indicadores | Convênio | Alta | acesso/atualização |
| Google Maps / Street View | Mapas e cobertura de ruas | coords | tiles/imagens | API key | Alta | custo/quota |
| Provedores de IA (LLM/OCR/STT/TTS) | Modelos de IA | prompt/arquivo | resultado | API key | Alta | custo/privacidade |
| Parceiros institucionais | Cessão de dados (convênios) | — | datasets | Convênio | Média | disponibilidade |

⚠️ **A validar:** quais fontes oficiais já possuem API pública vs. exigirão convênio ou scraping (✅ os documentos preveem "mineração por meios digitais" e "parcerias/convênios").

---

## 19. Segurança, LGPD e Governança

- **Controle de acesso:** RBAC/ABAC; princípio do menor privilégio; isolamento por tenant.
- **Criptografia:** TLS em trânsito; AES-256 em repouso; cofre de segredos.
- **Logs:** logs de acesso e de execução de IA; trilha imutável.
- **Consentimento:** coleta domiciliar (✅ pesquisa com moradores) exige consentimento informado e base legal LGPD.
- **Política de retenção:** prazos definidos por categoria de dado; expurgo automático.
- **Anonimização/Mascaramento:** dados pessoais anonimizados em análises agregadas; mascaramento por perfil.
- **Permissões por perfil:** cidadão (consulta), pesquisador (download/API), gestor (relatórios), admin (gestão).
- **Auditoria de ações:** quem acessou o quê, quando; quem gerou qual relatório.
- **Rastreamento de respostas de IA:** cada resposta liga-se ao `AgentExecution` (modelo, fontes, custo) — combate à alucinação e suporta contestação.
- **Revisão humana:** obrigatória para dados sensíveis e respostas de baixa confiança.
- **Governança de dados:** distinguir dado público, cedido sob convênio e próprio; respeitar licenças de uso; ✅ excluir atos de RH da imprensa oficial.

---

## 20. Monetização SaaS

🧩 (preços sugeridos a validar ⚠️; ✅ o acesso básico ao banco deve ser gratuito)

| Plano | Público | Funcionalidades | Limites | Preço sugerido (⚠️) | Diferenciais |
|-------|---------|-----------------|---------|---------------------|--------------|
| **Gratuito** | Cidadãos, estudantes | Consulta por texto/áudio, indicadores básicos, mapas públicos | Nº de consultas/dia; sem API; relatórios limitados | R$ 0 | Cumpre a meta de acesso gratuito ✅; gera tráfego/engajamento |
| **Profissional** | Pesquisadores, consultores, PMEs | Tudo do Gratuito + relatórios avançados, exportação CSV/GeoJSON, dashboards, API básica | Cotas maiores | R$ 99–299/mês | API, exportação, prioridade de processamento |
| **Institucional** | Universidades, ONGs, associações | Multiusuário, datasets completos, API ampliada, suporte | Por assentos | R$ 1.000–3.000/mês | Acesso acadêmico, séries históricas completas |
| **Governo/Enterprise** | Prefeituras, secretarias, consórcios, grandes empresas | Tudo + integrações dedicadas, SLA, dados sob convênio, on-premise/local, suporte premium | Sob contrato | Sob consulta | SLA, LGPD reforçada, dados privados, mapeamento sob demanda |

🧩 **Receitas complementares:** serviços de mapeamento sob demanda (drone/Street View), produção de portfólios institucionais (vídeos de 15–20 min ✅), licenciamento do banco de imagens (MT Imagens), e projetos de PD&I.

---

## 21. MVP

**Objetivo do MVP:** provar a proposta de valor central — *perguntar em linguagem natural sobre MT e receber resposta confiável, com fonte, no formato útil* — sobre um subconjunto de temas e localidades.

**O que entra no MVP:**
- ✅ Chat inteligente (texto + áudio) com a Xingú.
- ✅ Orquestrador básico (interpretação → decomposição → roteamento → validação → entrega).
- ✅ Pesquisa por localidade (Estado, município, regiões) e por tema (subconjunto: ex. Infraestrutura Urbana, Infraestrutura Macro, Saúde, Demografia).
- ✅ Base de dados inicial + banco vetorial (RAG) com fontes citadas.
- ✅ Upload de documentos com OCR.
- ✅ Relatórios simples em PDF/planilha.
- ✅ Mapas básicos por recorte.
- ✅ Login/cadastro + rastreabilidade/auditoria básica.

**Agentes essenciais (MVP):** Orquestrador (Xingú), Conversacional, Dados e Indicadores, Análise de Documentos (OCR), Busca Semântica (RAG), Geoprocessamento (básico), Relatórios, Validação Técnica, Qualidade da Informação, Auditoria, Segurança/LGPD.

**Telas essenciais (MVP):** Landing, Login/Cadastro, Chat com IA, Consulta por localidade/tema, Visualização de resultado (lista/mapa/relatório), Histórico de execuções.

**Dados necessários (MVP):** carga inicial de IBGE (demografia/geografia), dados de infraestrutura (incl. estradas vicinais — base do exemplo ✅), e ingestão de documentos via OCR.

**O que fica fora do MVP:** dashboards avançados, multiagente complexo em larga escala, app de coleta domiciliar, banco de imagens completo, marketplace, billing.

**Critérios de sucesso do MVP:**
- Responde corretamente ao exemplo de referência ✅ (km de estrada vicinal) com fonte + oferta de relatório por município.
- ≥ 80% das respostas factuais com fonte citada e validadas como corretas em amostra ⚠️.
- Tempo de resposta de chat factual ≤ 5s (P95) ⚠️.
- Geração de relatório simples funcional para ao menos 1 tema completo.

**Tempo estimado:** 🧩 ~3 a 5 meses ⚠️ (depende de disponibilidade de dados e equipe).

**Equipe mínima:** 🧩 1 PM/PO, 1 tech lead, 2 devs back-end, 1 dev front-end, 1 eng. de dados/IA (ML/LLMops), 1 designer UX, apoio de especialista GIS (parcial). ⚠️

---

## 22. Roadmap por Fases

### Fase 0 — Planejamento e Fundação
- ✅/🧩 Documentação (este PRD + docs técnicos), protótipo, definição de arquitetura, modelagem de dados, ambiente (CI/CD, nuvem), definição do catálogo de agentes, política de roteamento de IA, mapeamento de fontes de dados e convênios iniciais.

### Fase 1 — MVP
- Login; upload de documentos com OCR; chat inteligente (texto/áudio); orquestrador básico; agentes essenciais; relatórios simples; base de dados inicial + RAG; mapas básicos; rastreabilidade.

### Fase 2 — Plataforma Operacional
- Dashboards; mapas/GIS avançados; APIs e integrações com fontes externas; multiagente avançado; auditoria completa; gestão de usuários/tenants; ingestão contínua automatizada; ampliação da taxonomia (17 temas completos).

### Fase 3 — Inteligência Avançada
- IA preditiva (análise preditiva ✅); voz aprimorada; automação de workflows; agentes autônomos; geração avançada de relatórios; validação cruzada; banco de imagens MT Imagens; pesquisa domiciliar (app de agentes de saúde) ✅; Street View 360º/8K dos municípios faltantes.

### Fase 4 — Escala SaaS
- Marketplace de agentes; gestão de planos/billing; multitenant completo; alta disponibilidade; observabilidade avançada; operação enterprise; expansão de cobertura e parcerias.

---

## 23. Telas Necessárias

🧩 (objetivo · componentes · ações · dados exibidos · permissões)

1. **Landing page** — apresentar a plataforma e CTA. Componentes: hero, busca rápida, exemplos. Ações: pesquisar, criar conta. Dados: destaques de MT. Permissão: pública.
2. **Login** — autenticar. Componentes: form, SSO. Ações: entrar, recuperar senha. Permissão: pública.
3. **Cadastro** — criar conta. Componentes: form, tipo de usuário. Ações: registrar. Permissão: pública.
4. **Dashboard inicial** — visão geral pós-login. Componentes: atalhos, últimas consultas, indicadores em destaque. Permissão: autenticado.
5. **Chat com IA (Xingú)** ✅ — conversar por texto/áudio. Componentes: campo de texto, microfone, histórico, player de áudio, fontes citadas. Ações: perguntar, ouvir, exportar. Permissão: pública/autenticado.
6. **Upload de documentos** — enviar e processar arquivos. Componentes: dropzone, status OCR. Ações: enviar, revisar extração. Permissão: autenticado.
7. **Consulta por tema** ✅ — navegar 17 temas e subtemas. Componentes: menu de temas, filtros. Permissão: pública.
8. **Consulta por localidade** ✅ — escolher recorte (Estado/município/região/consórcio). Componentes: mapa, seletor. Permissão: pública.
9. **Relatórios** — gerar/baixar. Componentes: configurador, lista de relatórios. Ações: gerar PDF/planilha. Permissão: autenticado.
10. **Mapas** ✅ — camadas GIS, Street View, 3D. Componentes: visualizador de mapa, camadas. Permissão: pública/autenticado.
11. **Administração** — gestão da plataforma. Componentes: painéis de status/custo. Permissão: admin.
12. **Gestão de agentes** — habilitar/configurar agentes. Permissão: admin.
13. **Gestão de IAs** — registrar modelos e política de roteamento. Permissão: admin.
14. **Histórico de execuções** — ver execuções e workflows. Componentes: timeline, detalhes. Permissão: autenticado/admin.
15. **Auditoria** — trilha de ações e respostas de IA. Permissão: admin/auditor.
16. **Planos e assinatura** — escolher/gerir plano. Permissão: autenticado/admin.

---

## 24. Critérios de Aceite Gerais

O produto é considerado pronto para uso quando:
- Responde corretamente ao caso de referência ✅ (estrada vicinal) com fonte e oferta de aprofundamento.
- Todas as respostas factuais exibem fonte e data de atualização (RN03).
- Os 6 níveis de recorte de localidade funcionam corretamente (✅).
- O orquestrador registra log de execução completo para cada requisição (rastreabilidade).
- Relatórios em PDF/planilha são gerados com fontes e versão.
- OCR de documentos extrai e indexa dados corretamente em amostra de validação.
- Mapas exibem o recorte selecionado.
- Autenticação, perfis e permissões operam conforme RBAC.
- Conformidade LGPD verificada (consentimento, mascaramento, retenção).
- Respostas de baixa confiança são roteadas para revisão humana.
- Metas de performance e disponibilidade atingidas (⚠️ valores a validar).

---

## 25. Riscos e Mitigações

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Dados desatualizados | Decisões erradas, perda de confiança | Ingestão contínua, data de atualização visível, convênios de atualização (✅ RN05) |
| Alucinação da IA | Informação falsa | RAG com citação obrigatória, agente de qualidade, validação técnica, revisão humana, "não sei" quando faltar dado (RN11) |
| Alto custo com modelos de IA | Inviabilidade financeira | Gateway de roteamento por custo, cache, modelos abertos/locais (✅ Xingú open source), monitoramento de custo por execução |
| Baixa qualidade dos documentos | Extração ruim | Pré-processamento, OCR robusto, validação e correção humana |
| Falhas de OCR | Dados incorretos | Múltiplos motores de OCR, confiança mínima, revisão |
| Problemas de integração com fontes | Lacunas de dados | Conectores resilientes, retries, convênios, fallback para fontes alternativas |
| LGPD / dados pessoais | Sanções legais | Anonimização, consentimento, política de retenção, DPO, auditoria |
| Escalabilidade (meta top 10 sites ✅) | Indisponibilidade em pico | Arquitetura horizontal, filas, autoscaling, CDN |
| Dependência de fornecedores externos | Lock-in/custo | Abstração multiprovedor, modelos abertos, contratos diversificados |
| Disponibilidade/atraso de mapeamento físico | Atraso de entregas próprias | Faseamento (cidades → rotas → campo), priorização dos 103 municípios sem Street View |
| Conflito entre fontes | Inconsistência | Regra de divergência (RN12), exibir fontes e mais recente |
| Adoção baixa por leigos | Baixo tráfego | UX por voz, linguagem natural, respostas proativas |

---

## 26. Perguntas em Aberto

⚠️ A validar antes do desenvolvimento:
1. A Xingú será orquestrador sobre modelos abertos (recomendado) ou modelo treinado do zero? Qual orçamento de IA?
2. Quais fontes oficiais já têm API pública e quais exigem convênio/scraping? Há convênios firmados (SECITECI? prefeituras?)?
3. Qual a base legal LGPD para a pesquisa domiciliar e para dados cedidos por instituições?
4. Quais os 17 temas e subtemas terão dados disponíveis no MVP? Há fonte para "estradas vicinais"?
5. Acesso gratuito: quais limites de uso para o plano gratuito sem inviabilizar custo de IA?
6. Quem mantém/atualiza o banco e com qual periodicidade (SLA de atualização por tema)?
7. Modelo de hospedagem: nuvem pública, privada ou híbrida? Há exigência de dado em território nacional?
8. Direitos de imagem do banco MT Imagens (contribuições da população) — termos de uso?
9. Metas quantitativas de performance/disponibilidade (SLA, P95, RPO/RTO).
10. Relação contratual/comercial com SECITECI e demais parceiros — papéis e responsabilidades.
11. Idiomas além do português (atendimento "ao Brasil e ao mundo" ✅ sugere multilíngue?).
12. Orçamento e cronograma oficiais; tamanho real da equipe.

---

## 27. Entregáveis para Desenvolvimento (.md)

🧩 Arquivos Markdown recomendados para orientar o desenvolvimento:

- **README.md** — visão geral, como rodar, stack, contribuição.
- **PRD.md** — este documento (requisitos de produto).
- **ARCHITECTURE.md** — arquitetura técnica, diagramas, decisões (ADR).
- **DATABASE.md** — modelo de dados, entidades, migrações, índices.
- **AGENTS.md** — catálogo de agentes, contratos de entrada/saída, critérios.
- **AI_ORCHESTRATOR.md** — lógica da Xingú, decomposição, política de roteamento de IA, tratamento de erros.
- **API.md** — especificação de APIs internas/externas (OpenAPI).
- **USER_FLOWS.md** — fluxos detalhados e diagramas de jornada.
- **ROADMAP.md** — fases, marcos e dependências.
- **MVP.md** — escopo, critérios de sucesso, plano de validação.
- **SECURITY_LGPD.md** — políticas de segurança, LGPD e governança de dados.
- **UI_UX.md** — telas, componentes, design system, acessibilidade.
- **BACKLOG.md** — épicos, histórias e tarefas priorizadas.
- **ACCEPTANCE_CRITERIA.md** — critérios de aceite por funcionalidade.
- **DEPLOYMENT.md** — infraestrutura, CI/CD, ambientes, observabilidade, backup.

🧩 Sugeridos adicionais: **DATA_SOURCES.md** (catálogo de fontes/convênios e SLA de atualização), **TAXONOMY.md** (17 temas e subtemas completos extraídos do documento INTERFACE), **GIS_PIPELINE.md** (drone/ortomosaico/Street View/3D).

---

> **Nota final:** este PRD extrai o máximo do material anexo (conceito de inteligência territorial, IA Xingú orquestradora multiagente, taxonomia de localidades e temas, frentes de mapeamento, missão/visão/valores e o caso de uso de referência) e complementa com decisões técnicas de produto onde os documentos eram silenciosos. Os pontos marcados com ⚠️ devem ser resolvidos com os proponentes (QXT Tecnologia / parceiros) antes do início do desenvolvimento.

---

## Anexo A — Taxonomia Completa de Pesquisa (✅ Extraída do documento INTERFACE ITMT)

### Recortes de Localidade
1. Todo o Estado de Mato Grosso.
2. Por Município (1 dos 142 por vez).
3. Regiões Geográficas Intermediárias: Barra do Garças, Cáceres, Cuiabá, Rondonópolis, Sinop.
4. Regiões Geográficas Imediatas: 18 subdivisões (critério IBGE).
5. Consórcio Municipal de Infraestrutura e Desenvolvimento.
6. Consórcio Municipal de Saúde (16 consórcios).

### 17 Temas de Pesquisa
Saúde · Segurança Pública · Educação · Meio Ambiente · Assistência Social · Mercado de Trabalho · Agronegócio · Imprensa Oficial · Economia do Setor Público · Economia do Setor Privado · Instituições Públicas e Privadas · Demografia · Geografia · Infraestrutura Macro · Infraestrutura Urbana · Registros Históricos · Outros Indicadores.

### Subtemas por Tema

**Saúde Pública:** Unidades de Saúde (clínicas, hospitais, UPAs, postos, maternidades — redes pública e privada); especialidades; leitos/UTI; cobertura vacinal/desnutrição; natalidade e mortalidade (causa/faixa etária); bancos de sangue/hemodiálise; casas de acolhimento; diagnóstico por imagem/labs; centros cirúrgicos/fisioterapia/reabilitação; farmácias populares; clínicas dentárias públicas; recuperação de dependentes químicos; saúde indígena; outros.

**Segurança Pública:** delegacias; penitenciárias/reformatórios; quartéis PM; quartéis bombeiros; brigadas de incêndio; Forças Armadas; PRF; barreira sanitária (saúde animal); posto fiscal; polícia técnica/IML; centro de detenção juvenil; outros.

**Educação:** censo/indicadores educacionais; redes pública e privada (escolas, faculdades, universidades); rede rural/indígena; transporte escolar; ensino profissionalizante; EJA; equipamentos de esporte; equipamentos de cultura; bibliotecas/auditórios; cinema/teatro; outros.

**Imprensa Oficial (publicações diárias):** editais de licitações; concursos; portarias; decretos; leis; leis orçamentárias; prestação de contas; julgamento de prestação de contas; chamamentos públicos; convênios; termos de fomento; dispensa de licitações; atas de registro de preço; contratos; homologações; adjudicações; outros atos administrativos — **exceto atos de gestão de RH**.

**Economia – Setor Público:** arrecadação própria; repasse estadual/federal/convênios; emendas parlamentares; despesas liquidadas/pagas; folha de pessoal; obras (iniciadas/concluídas/paralisadas/em andamento/retomadas); licitações em curso; orçamento anual; empenhos; restos a pagar; status de adimplência; grau de endividamento; previdência local; relação com INSS; outros.

**Economia – Setor Privado:** indústria; comércio; serviços; agricultura; pecuária; pesca; suinocultura; avicultura; construção civil; madeira; metalurgia; mineração; turismo; extrativismo; empregos; balança comercial; outros.

**Agronegócio:** tipos de cultivo; tipos de criação de gado; área plantada; área agricultável; área de pasto; unidades de armazenamento; agricultura familiar; assentamentos rurais; beneficiamento da lavoura; cooperativas agrícolas; plantas de abate; tanques de piscicultura; associações de produtores; parques de exposição; serrarias/madeireiras.

**Instituições Públicas e Privadas (por localidade):** Poder Executivo/Legislativo/Judiciário; Ministério Público; órgãos de controle; cartórios; concessionárias de serviços públicos; Detran/Ciretran; bancos/cooperativas de crédito; conselhos regionais profissionais; sucursais (CREA, OAB, etc.); grandes empresas; outros.

**Demografia (IBGE):** Censos 1990, 2000, 2010, 2022 (classificados por sexo, idade, classe social, renda, etnia, etc.); outros.

**Geografia:** área total; área plantada; potencial agricultável; área de pastos; mapas; relevo; hidrografia; dados de clima; pluviometria; jazidas; outros.

**Infraestrutura Macro:** rodovias/pedágios; centrais intermodais; portos; estradas vicinais; pontes; PCHs; rede de transmissão de energia; central de rebaixamento; usinas fotovoltaicas; eletrificação rural; telefonia fixa/móvel; indústrias/usinas; internet/fibra; depósito de combustível; armazenamento de grãos; frigorífico; ZPE; outros.

**Infraestrutura Urbana:** vias pavimentadas; vias sem pavimentação; rede de esgoto; rede de água; ETAs/ETEs; rede de drenagem; aterro sanitário; cemitérios/crematórios; outros.

**Assistência Social:** unidades assistenciais; creches (vagas); insegurança alimentar; população em situação de rua; CRAS; conselhos regionais/municipais setoriais; ONGs (OSCs, associações, fundações); igrejas/templos/centros religiosos; outros.

**Registros Históricos:** narrações artísticas de contextos históricos; eventos culturais/políticos/religiosos históricos; patrimônio histórico; criação dos municípios; administrações municipais; ciclos econômicos; acervos midiáticos históricos.

**Outros Indicadores:** déficit habitacional; imóveis regularizados/a regularizar; patrimônio tombado; pontos turísticos; rede hoteleira; rede de apoio ao turismo; população indígena (quantificação/etnias); quilombolas; migrantes; população urbana/rural; eleitores ativos; outros.

**Meio Ambiente / Mercado de Trabalho:** ⚠️ temas listados no menu principal, porém sem slide de subtemas detalhado no documento — subtemas a definir.
