# SECURITY_LGPD.md — Segurança, LGPD e Governança

> Políticas de segurança e conformidade. Itens ⚠️ dependem de decisão jurídica/negócio.

## 1. Controle de acesso
- **RBAC/ABAC** com princípio do menor privilégio.
- Perfis: **cidadão** (consulta), **pesquisador** (download/API), **gestor** (relatórios), **admin** (gestão), **auditor** (auditoria).
- Isolamento por tenant (`organization_id` + RLS no PostgreSQL).

## 2. Criptografia
- **Em trânsito:** TLS 1.2+.
- **Em repouso:** AES-256.
- **Segredos:** cofre (Vault/Secrets Manager); sem segredos em código.

## 3. LGPD
- **Base legal:** definir por categoria de dado ⚠️.
- **Consentimento:** obrigatório na pesquisa domiciliar (✅ moradores) e em contribuições de mídia (MT Imagens).
- **Anonimização/pseudonimização:** dados pessoais anonimizados em análises agregadas.
- **Mascaramento por perfil:** dados sensíveis exibidos conforme permissão.
- **Política de retenção:** prazos por categoria; expurgo automático.
- **Direitos do titular:** acesso, correção, exclusão, portabilidade.
- **DPO:** designar encarregado.
- **Território do dado:** ⚠️ validar exigência de hospedagem nacional.

## 4. Logs e auditoria
- **AuditLog** append-only: quem acessou o quê, quando; quem gerou qual relatório.
- **AgentExecution:** rastreia respostas de IA (modelo, fontes, custo) — suporta contestação e combate à alucinação.

## 5. Governança de dados
- Distinguir dado **público**, **cedido sob convênio** (com restrição de uso) e **próprio** (mapeamento).
- Respeitar **licenças de uso** das fontes.
- ✅ Excluir **atos de gestão de RH** da indexação da imprensa oficial.
- **Versionamento** de datasets/relatórios (RN13).
- **Conflitos** entre fontes: registrar todas, padrão = mais recente, sinalizar divergência (RN12).
- **Dados incompletos:** declarar lacuna; nunca supor (RN11).

## 6. Segurança de IA
- **Anti-alucinação:** RAG com citação obrigatória; agente de Qualidade da Informação; "não sei" quando faltar dado.
- **Prompt injection:** sanitização de entradas e de conteúdo de documentos; isolamento de instruções.
- **Privacidade no roteamento:** dados sensíveis processados em modelo local/on-premise, sem envio a terceiros.
- **Revisão humana:** obrigatória para dados sensíveis e respostas de baixa confiança.

## 7. Segurança de aplicação
- Rate limiting; proteção contra brute force; MFA opcional.
- Validação de upload (tipo/tamanho/antivírus).
- OWASP Top 10; testes de segurança no CI.

## 8. Continuidade
- Backups diários; **RPO ≤ 24h / RTO ≤ 4h** ⚠️.
- Plano de recuperação testado periodicamente.
