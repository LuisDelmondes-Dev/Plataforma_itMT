# BACKLOG.md — Épicos e Histórias

> Backlog inicial priorizado, mapeado aos requisitos funcionais (RF) do PRD §14. Prioridade: 🔴 Alta · 🟡 Média · 🟢 Baixa. Fase: MVP / F2 / F3 / F4.

## Épico E1 — Identidade e Acesso
- [ ] **H1.1** Como usuário, quero me cadastrar e fazer login (RF012). 🔴 MVP
- [ ] **H1.2** Como usuário, quero recuperar senha. 🔴 MVP
- [ ] **H1.3** Como admin, quero gerir papéis e permissões (RBAC). 🟡 MVP
- [ ] **H1.4** Como org, quero isolamento multitenant (RF014). 🟡 F2
- [ ] **H1.5** Como usuário, quero entrar via SSO. 🟢 F2

## Épico E2 — Chat Inteligente (Xingú)
- [ ] **H2.1** Como usuário, quero perguntar por texto e receber resposta com fonte (RF001/RF008). 🔴 MVP
- [ ] **H2.2** Como usuário, quero perguntar por áudio e ouvir a resposta (RF001). 🔴 MVP
- [ ] **H2.3** Como usuário, quero que a IA me ofereça aprofundamento (RF009). 🟡 MVP
- [ ] **H2.4** Como usuário, quero que a IA peça confirmação quando ambíguo (RF017). 🟡 MVP

## Épico E3 — Orquestrador e Agentes
- [ ] **H3.1** Como sistema, quero interpretar intenção e decompor a tarefa (RF002). 🔴 MVP
- [ ] **H3.2** Como sistema, quero selecionar agentes e modelos por tarefa (RF004). 🔴 MVP
- [ ] **H3.3** Como sistema, quero validar a resposta e detectar inconsistências (RF016). 🔴 MVP
- [ ] **H3.4** Como admin, quero gerir catálogo de agentes e modelos (RF019). 🟡 F2
- [ ] **H3.5** Como sistema, quero orquestração multiagente em paralelo. 🟡 F2

## Épico E4 — Base de Dados e RAG
- [ ] **H4.1** Como sistema, quero base consolidada + banco vetorial (RF013). 🔴 MVP
- [ ] **H4.2** Como sistema, quero busca semântica com citação de fonte (RF008/RF013). 🔴 MVP
- [ ] **H4.3** Como sistema, quero ingestão contínua automatizada (RF... §F10). 🟡 F2

## Épico E5 — Documentos e OCR
- [ ] **H5.1** Como usuário, quero subir documentos com OCR e extração (RF007). 🔴 MVP
- [ ] **H5.2** Como usuário, quero revisar o que foi extraído. 🟡 MVP

## Épico E6 — Consulta por Localidade e Tema
- [ ] **H6.1** Como usuário, quero filtrar por Estado/município/região/consórcio (RF006). 🔴 MVP
- [ ] **H6.2** Como usuário, quero navegar pelos 17 temas e subtemas (RF003). 🔴 MVP (subset) / F2 (completo)
- [ ] **H6.3** Como usuário, quero consultar indicadores por recorte (RF003). 🔴 MVP

## Épico E7 — Relatórios e Saídas
- [ ] **H7.1** Como usuário, quero gerar relatório em PDF (RF005). 🔴 MVP
- [ ] **H7.2** Como usuário, quero exportar planilha (RF005). 🟡 MVP
- [ ] **H7.3** Como usuário, quero dashboards interativos (RF015). 🟡 F2

## Épico E8 — Mapas e GIS
- [ ] **H8.1** Como usuário, quero ver mapa do recorte (RF010). 🔴 MVP (básico)
- [ ] **H8.2** Como usuário, quero camadas (relevo, hidrografia, infra). 🟡 F2
- [ ] **H8.3** Como usuário, quero Street View e 3D (ortomosaico/MDS/MDT). 🟢 F3

## Épico E9 — Rastreabilidade e Auditoria
- [ ] **H9.1** Como sistema, quero registrar log de cada execução (RF011). 🔴 MVP
- [ ] **H9.2** Como auditor, quero consultar a trilha de auditoria. 🟡 F2

## Épico E10 — Segurança e LGPD
- [ ] **H10.1** Como sistema, quero mascarar/anonimizar dados sensíveis. 🔴 MVP
- [ ] **H10.2** Como titular, quero exercer direitos LGPD. 🟡 F2

## Épico E11 — APIs e Integrações
- [ ] **H11.1** Como dev, quero API de consulta e exportação (RF018). 🟡 F2
- [ ] **H11.2** Como sistema, quero integrar IBGE e imprensa oficial. 🟡 F2

## Épico E12 — Mídia (MT Imagens)
- [ ] **H12.1** Como usuário, quero navegar o acervo de imagens/vídeos (RF020). 🟢 F2/F3
- [ ] **H12.2** Como cidadão, quero contribuir com imagens. 🟢 F3

## Épico E13 — Coleta de Campo
- [ ] **H13.1** Como agente de saúde, quero aplicar questionário offline (RF021). 🟢 F3

## Épico E14 — Monetização
- [ ] **H14.1** Como org, quero assinar um plano e ter limites aplicados (RF022). 🟢 F4
- [ ] **H14.2** Como admin, quero gerir billing. 🟢 F4
