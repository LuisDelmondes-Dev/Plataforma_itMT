# Runbook — game days

Os cenários automatizados em `api/test/game-days.unit.mjs` entram na regressão padrão:

- banco fora: liveness permanece e readiness falha;
- storage fora: resposta recuperável e outbox preservada;
- fila congestionada: backpressure antes da inserção;
- IA fora: fallback léxico;
- GIS externo fora: OGC/GeoJSON/download local preservados;
- credencial comprometida: rotação invalida a sessão.

Em staging, cada exercício deve registrar participantes, alerta, detecção, recuperação, perda observada e ação corretiva. Fixtures não são prova operacional.
