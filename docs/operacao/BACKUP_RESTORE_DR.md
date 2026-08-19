# Runbook — backup, restore e DR

## Prova local automatizada

```bash
cd api
npm run test:restore
```

O script cria dois bancos terminados em `_test`, aplica todas as migrações, gera backup custom, restaura, compara contagens e valida a cadeia de auditoria. Bancos e arquivo temporário são removidos ao final.

Última evidência: `PASS`; backup `0,654 s`; restore `4,164 s`; total `11,803 s`; 66 tabelas, 13 municípios, 21 indicadores, 72 observações e 1 evento de auditoria preservados.

## Produção

1. Ativar versionamento, KMS e Object Lock no bucket privado.
2. Manter cópia offsite/imutável em região brasileira secundária.
3. Executar restore trimestral em ambiente isolado.
4. Verificar banco, hashes dos objetos, auditoria e smoke tests.
5. Registrar tempos, RPO/RTO, incidente e responsável no ledger.

Failover regional e prova offsite dependem da infraestrutura contratada.
