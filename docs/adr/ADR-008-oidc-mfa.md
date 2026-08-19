# ADR-008 — IdP OIDC institucional e MFA

**Status:** Proposta — IdP institucional pendente  
**Data:** 15/08/2026

## Contexto

Senha local e sessão HMAC suportam desenvolvimento e pilotos, mas administração
de produção exige identidade institucional, MFA, revogação e ciclo de vida.

## Decisão proposta

Integrar OIDC Authorization Code com PKCE. Papéis administrativos são mapeados por
claims allowlisted; MFA é exigido no IdP; sessão curta e revogável; contas de
serviço usam client credentials separadas e escopo mínimo.

## Alternativas

Token estático foi rejeitado em produção e já é recusado pelos guards. O provedor
específico permanece decisão institucional.

## Consequências e riscos

Exige discovery/JWKS resiliente, rotação, validação de issuer/audience/nonce,
break-glass auditado e testes contra confusão de token.

