# Execução completa do protocolo mestre — F0 a F7

Atualizado em 15/08/2026. Este documento é a fonte executiva para “o que foi feito e o que falta”. Ele separa conclusão de software de homologação operacional; fixtures nunca substituem evidência real.

| Fase | Concluído no repositório | Única fronteira ainda aberta | Gate |
|---|---|---|---|
| F0 | arquitetura, ADRs, topologia segura, migrator, CI, health, métricas protegidas e bloqueio de demo | staging/IdP/WAF/KMS e aceites institucionais | técnico `PASS`; operacional externo |
| F1 | MVP, 12 indicadores, procedência, exportações, curadoria e testes | pareceres humanos restantes, fonte oficial de estradas e WCAG formal | externo |
| F2 | documentos, OCR/extração, RAG, avaliação adversarial, API parceiros e multiprovedor | corpus oficial homologado e curadoria real | externo |
| F3 | agentes do pipeline, PWA/offline cifrado, formulário/idempotência, S3, GIS/Cesium e vetos | campanhas/equipamentos/autorizações e ativos reais | externo |
| F4 | multitenancy integral dos domínios privados, RLS/least privilege, UI, cache, jobs e planos | OIDC/billing/SLA e escala real | externo |
| F5 | plataforma de campo/mídia/GIS e contrato unificado de ativos | operação estadual, VANT/360°/8K e cobertura real | externo |
| F6 | ciência aberta/DCAT/reprodução e participação com devolutiva | DOI, convênios e avaliação independente | externo |
| F7 | regressão, restore, game days, não conformidades, observabilidade e portabilidade regional | failover multirregional, auditoria externa e operação permanente | externo |

## Resultado técnico final

- `40/40` migrações aplicadas em banco novo;
- `129/129` testes aprovados;
- cadeia de auditoria íntegra com `124` eventos no encerramento da suíte;
- API NestJS 11 compilada;
- Web Next.js 16 compilado, TypeScript aprovado e `17` páginas geradas;
- backup/restore real aprovado em bancos descartáveis;
- API e Web com `0` vulnerabilidades de dependências de produção no `npm audit`;
- F0 fitness gate aprovado, com somente Caddy publicando 80/443;
- participação pública validada em navegador real, sem erro de console.

## O que impede declarar o programa 100% operacional

Os itens restantes exigem atos que o código não pode simular: contratar e provisionar nuvem brasileira, IdP, WAF/KMS/object lock e billing; obter dados oficiais e pareceres humanos; executar campanhas com equipe/equipamentos/autorizações; medir SLA em operação prolongada; realizar failover regional; obter auditoria, validação científica e aceites institucionais.

Portanto, o **software local implementável está concluído e verde**, enquanto o programa administrativo-operacional permanece `BLOCKED_EXTERNAL`. Cada detalhe e responsável esperado consta nos gates `docs/gates/F0.md` a `F7.md` e no ledger `docs/evidence/ledger.md`.
