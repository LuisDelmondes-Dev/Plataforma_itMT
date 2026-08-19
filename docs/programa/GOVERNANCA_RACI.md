# Governança e RACI do programa ITMT

## Fóruns e cadência

| Fórum | Cadência | Decide | Evidência obrigatória |
|---|---|---|---|
| Comitê de Produto | quinzenal | prioridade, escopo e aceite | roadmap, métricas e termo de aceite |
| Comitê de Dados | semanal | fontes, qualidade e publicação | dossiê do dataset e parecer |
| Comitê Científico | mensal | metodologia, amostragem e limitações | nota técnica versionada |
| Segurança e LGPD | mensal e por incidente | classificação, base legal e risco | RIPD/registro de decisão |
| Operação de Campo | semanal durante campanhas | lote, autorização e segurança | plano de missão e checklist |
| Arquitetura | quinzenal | ADRs e exceções técnicas | ADR aprovado e plano de reversão |

## Papéis

- **Patrocinador:** orçamento, convênios e impasses institucionais.
- **PO do programa:** valor, prioridade e aceite final.
- **Data Owner:** significado, licença, periodicidade e autorização da fonte.
- **Data Steward:** qualidade, dicionário, linhagem e incidentes de dados.
- **Tech Lead/Arquitetura:** contratos, ADRs, segurança por desenho e evolução.
- **Líder Científico:** metodologia, amostragem, reprodutibilidade e vieses.
- **DPO/Segurança:** LGPD, risco, incidentes, retenção e terceiros.
- **Líder de Campo:** autorização, logística, equipamentos e cadeia de custódia.
- **QA/Release Manager:** gates, evidências, rollback e liberação.

## RACI mínimo

| Entrega | A | R | C | I |
|---|---|---|---|---|
| Publicar indicador | Data Owner | Data Steward | Científico, DPO | Produto |
| Alterar contrato de API | Tech Lead | Squad responsável | Produto, parceiros | QA |
| Trocar modelo de IA | Tech Lead | Squad IA | DPO, FinOps, QA | Produto |
| Iniciar missão de campo | Líder de Campo | Coordenador do lote | DPO, RT, município | Produto |
| Publicar mídia | Data Owner | Curadoria | Jurídico/DPO | Comunicação |
| Liberar produção | PO | Release Manager | Tech Lead, Segurança | Comitês |

## Regras de decisão

- Aprovação em quatro olhos para dados, modelos, mídia e mudanças de acesso.
- Exceções têm prazo, responsável, risco aceito e data de revisão.
- Incidente crítico suspende publicação do ativo afetado até revalidação.
- Toda fase encerra com relatório do gate e itens explicitamente não atendidos.

