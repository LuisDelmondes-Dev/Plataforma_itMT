# Runbook — object storage S3

Produção exige `OBJECT_STORAGE_DRIVER=s3` e bucket privado. A API grava sob `tenants/{tid}/organizations/{oid}/`, valida SHA-256, solicita AES-256 ou KMS e limita URLs assinadas a 15 minutos.

Configure `OBJECT_STORAGE_BUCKET`, `OBJECT_STORAGE_REGION`, endpoint/path-style quando aplicável, `OBJECT_STORAGE_KMS_KEY` e credenciais de curta duração. Nunca conceda listagem global ao runtime.

Antes do go-live, provar bucket privado, IAM mínimo, KMS, versionamento/Object Lock, lifecycle, URL expirada, restauração e negação A→B.
