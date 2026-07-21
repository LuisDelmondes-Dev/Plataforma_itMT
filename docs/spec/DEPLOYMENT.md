# DEPLOYMENT.md — Infraestrutura, CI/CD e Operação

> Proposta de implantação 🧩. ✅ O modelo SaaS na nuvem vem dos documentos. Stack é exemplo; evitar lock-in.

## 1. Ambientes
- **dev** — desenvolvimento, dados sintéticos.
- **staging** — homologação, dados de teste anonimizados.
- **prod** — produção.

## 2. Infraestrutura
- **Containers:** Docker.
- **Orquestração:** Kubernetes (autoscaling por CPU/fila).
- **IaC:** Terraform (provisionamento reproduzível).
- **Nuvem:** ⚠️ definir provedor; validar exigência de **dado em território nacional** (LGPD).
- **Componentes gerenciados sugeridos:** PostgreSQL (+PostGIS), Redis, object storage S3-compatível, fila (Kafka/RabbitMQ), banco vetorial (pgvector/Qdrant), CDN para mídia/tiles.

## 3. CI/CD
- **CI:** lint, testes (unitário/integração), scan de segurança (SAST/dependências), build de imagem.
- **CD:** deploy automatizado para staging; aprovação manual para prod.
- **Estratégia:** blue-green ou canary; migrações de banco versionadas e reversíveis.
- **Artefatos:** imagens versionadas em registry.

## 4. Configuração e segredos
- Variáveis por ambiente; segredos em cofre (Vault/Secrets Manager).
- Sem segredos em repositório.

## 5. Observabilidade
- **Métricas:** Prometheus + Grafana (latência, throughput, erro, custo de IA por execução).
- **Logs:** centralizados (Loki/ELK).
- **Tracing:** OpenTelemetry (rastreio entre orquestrador e agentes).
- **Alertas:** SLO de latência/disponibilidade; custo de IA acima do limite; falha de ingestão.

## 6. Escalabilidade
- Workers assíncronos escalam por tamanho de fila (OCR, relatórios, GIS).
- Cache (Redis) para respostas frequentes e tiles.
- CDN para mídia (MT Imagens) e mapas.
- Meta de alto tráfego (top 10 sites do Estado ✅) → testes de carga antes do lançamento.

## 7. Backup e recuperação
- Backups diários automatizados (banco + storage).
- **RPO ≤ 24h / RTO ≤ 4h** ⚠️.
- Restauração testada periodicamente; runbook de incidente.

## 8. Segurança operacional
- WAF + rate limiting no gateway.
- Rotação de credenciais; least privilege em IAM.
- Patching automatizado; scans periódicos.

## 9. Custos de IA
- Painel de custo por modelo/execução.
- Roteamento por custo (modelos abertos/locais quando possível ✅ — Xingú em código aberto).
- Cache de respostas; limites por plano.

## 10. Runbooks (a criar)
- Incidente de indisponibilidade.
- Falha de provedor de IA (fallback de modelo).
- Falha de ingestão de fonte de dados.
- Restauração de backup.
