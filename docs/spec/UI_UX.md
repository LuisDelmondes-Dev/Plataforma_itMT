# UI_UX.md — Telas, Componentes e Design

> Telas derivadas do PRD §23. ✅ Chat texto/áudio, consulta por tema/localidade e mapas vêm dos documentos.

## 1. Princípios de design
- **Linguagem natural primeiro:** chat (texto/voz) como porta de entrada.
- **Acesso a leigos:** resposta útil em ≤ 3 interações; voz favorece inclusão.
- **Confiança visível:** toda resposta mostra fonte e data.
- **Acessibilidade:** WCAG 2.1 AA; suporte a áudio.
- **Responsivo:** desktop e mobile; apps nativos iOS/Android.

## 2. Telas

| Tela | Objetivo | Componentes principais | Ações | Dados exibidos | Permissão |
|------|----------|------------------------|-------|----------------|-----------|
| **Landing** | Apresentar e converter | Hero, busca rápida, exemplos | Pesquisar, criar conta | Destaques de MT | Pública |
| **Login** | Autenticar | Form, SSO | Entrar, recuperar senha | — | Pública |
| **Cadastro** | Criar conta | Form, tipo de usuário | Registrar | — | Pública |
| **Dashboard inicial** | Visão geral | Atalhos, últimas consultas, KPIs | Navegar | Indicadores em destaque | Autenticado |
| **Chat com IA (Xingú)** ✅ | Conversar texto/áudio | Campo texto, microfone, histórico, player de áudio, fontes | Perguntar, ouvir, exportar | Resposta + fontes + sugestões | Pública/Autenticado |
| **Upload de documentos** | Enviar/processar | Dropzone, status OCR | Enviar, revisar extração | Dados extraídos | Autenticado |
| **Consulta por tema** ✅ | Navegar 17 temas | Menu de temas, filtros | Filtrar | Indicadores/listas | Pública |
| **Consulta por localidade** ✅ | Escolher recorte | Mapa, seletor (Estado/município/região/consórcio) | Selecionar | Dados do recorte | Pública |
| **Relatórios** | Gerar/baixar | Configurador, lista | Gerar PDF/planilha | Relatórios gerados | Autenticado |
| **Mapas** ✅ | Camadas GIS/Street View/3D | Visualizador, camadas | Explorar | Camadas geoespaciais | Pública/Autenticado |
| **Administração** | Gerir plataforma | Painéis status/custo | Configurar | Métricas | Admin |
| **Gestão de agentes** | Configurar agentes | Lista, toggles | Habilitar/configurar | Catálogo de agentes | Admin |
| **Gestão de IAs** | Registrar modelos | Lista, política de roteamento | Configurar | Modelos/custos | Admin |
| **Histórico de execuções** | Ver execuções | Timeline, detalhes | Inspecionar | Workflows/execuções | Autenticado/Admin |
| **Auditoria** | Trilha de ações | Tabela, filtros | Consultar | Logs | Admin/Auditor |
| **Planos e assinatura** | Gerir plano | Cards de plano, billing | Assinar/upgrade | Planos/limites | Autenticado/Admin |

## 3. Componentes-chave
- **Bloco de resposta da IA:** texto + áudio + chips de fonte + botões de ação (exportar, detalhar, ver no mapa).
- **Seletor de recorte:** Estado / município (1 de 142) / região intermediária (5) / imediata (18) / consórcio infra / consórcio saúde (16) ✅.
- **Navegador de temas:** 17 temas → subtemas (TAXONOMY.md).
- **Visualizador de mapa:** camadas, Street View embutido, 3D (Cesium/MapLibre).
- **Indicador de confiança/atualização:** selo com data e origem (próprio/terceiro).

## 4. Tom e voz
- Direto, claro, sem jargão para o cidadão.
- Respostas proativas (ofertar próximo passo) ✅.
- Sempre transparente sobre lacunas ("não há dado para X").

## 5. Design system (recomendação 🧩)
- Tokens de cor/tipografia consistentes; identidade ITMT.
- Biblioteca de componentes reutilizável (web + mobile).
- Modo de alto contraste e suporte a leitor de tela.
