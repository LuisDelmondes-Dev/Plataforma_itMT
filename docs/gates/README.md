# Gates do Programa F0–F7

Resultados permitidos: `PASS`, `FAIL` e `BLOCKED_EXTERNAL` (`AGENTS.md`).

Esta tabela é **derivada** dos arquivos `F0.md`–`F7.md` — ela resume, não decide.
Em caso de divergência, o arquivo da fase prevalece. Alguns arquivos qualificam o
`PASS` pelo escopo efetivamente implementado (`PASS_IMPLEMENTED_SCOPE`,
`PASS_PARTIAL_SCOPE`); a coluna abaixo mantém o vocabulário de três valores e traz
a qualificação em texto.

| Fase | Gate técnico | Gate operacional | Decisão | Maior gap |
|---|---|---|---|---|
| F0 | `PASS` | `BLOCKED_EXTERNAL` | `PHASE_NOT_APPROVED_EXTERNAL` | smoke deploy no ambiente contratado, OIDC/MFA, WAF/KMS/Object Lock e aceite formal dos ADRs |
| F1 | `PASS` no pacote de dados (12/12) e na publicação local (12/12 pareceres, EV-20260822-042); acessibilidade ainda parcial | `BLOCKED_EXTERNAL` | `PHASE_NOT_APPROVED` | fonte oficial de estradas vicinais, auditoria WCAG formal e OIDC/MFA |
| F2 | `PASS` no escopo implementado (+ Gauntlet R048) | `BLOCKED_EXTERNAL` | `PHASE_NOT_APPROVED` | corpus real de 20 documentos/30 perguntas e 50 indicadores publicados em oito temas |
| F3 | `PASS` no escopo implementado | `BLOCKED_EXTERNAL` | `PHASE_NOT_APPROVED_EXTERNAL` | campanhas reais, VANT/360°/8K com RT e autorizações, dez pacotes municipais |
| F4 | `PASS` (isolamento, menor privilégio e núcleo comercial) | `BLOCKED_EXTERNAL` | `PHASE_NOT_APPROVED_EXTERNAL` | IdP OIDC/MFA, provedor de cobrança e SLA 99,9% observado em operação |
| F5 | `PASS` no escopo implementado | `BLOCKED_EXTERNAL` | `PHASE_NOT_APPROVED_EXTERNAL` | operação estadual de campo, equipamentos/equipes e acervo real homologado |
| F6 | `PASS` (DCAT, reprodução e participação) | `BLOCKED_EXTERNAL` | `PHASE_NOT_APPROVED_EXTERNAL` | DOI por instituição depositária, parecer jurídico e avaliação científica independente |
| F7 | `PASS` local (restore, game days, portabilidade) | `BLOCKED_EXTERNAL` | `PHASE_NOT_APPROVED_EXTERNAL` | failover multirregional, auditoria independente e operação permanente com SLA |

**Nenhuma decisão `PHASE_APPROVED` foi emitida.** Nenhuma fase está travada por
pendência técnica de código: o que resta em todas são atos que o repositório não
pode simular — contratação de infraestrutura, decisão humana de publicação,
operação de campo, convênios e aceites institucionais. Fixture demonstrativa não
conta como evidência para fechar gate (`AGENTS.md`).

## Verificação de regressão

Última execução local — **22/08/2026**, banco descartável criado do zero:

```text
45 migrações aplicadas · 132/132 testes · cadeia de auditoria íntegra (133 eventos) · exit 0
```

Comando: `cd api && DATABASE_URL=postgres://itmt:itmt@localhost:5432/postgres npm test`

## Histórico desta tabela

- **22/08/2026** — tabela reconciliada com os arquivos de fase. A versão anterior
  registrava `FAIL` técnico para F0, F3, F4 e F7: era um retrato anterior às
  evidências `EV-20260815-024`–`036` e não acompanhou a atualização dos próprios
  arquivos de gate. As decisões finais por fase **não mudaram** — todas seguem não
  aprovadas por bloqueio externo.
