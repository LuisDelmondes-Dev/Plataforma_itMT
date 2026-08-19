-- Fase 0 do Plano Diretor: integridade territorial e separacao explicita
-- entre catalogo oficial e fixtures demonstrativas.

ALTER TABLE "Consorcio"
  ADD COLUMN IF NOT EXISTS "Consorcio_Status" text NOT NULL DEFAULT 'ATIVO',
  ADD COLUMN IF NOT EXISTS "Consorcio_FonteUrl" text,
  ADD COLUMN IF NOT EXISTS "Consorcio_VerificadoEm" date;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ck_consorcio_status'
  ) THEN
    ALTER TABLE "Consorcio" ADD CONSTRAINT ck_consorcio_status
      CHECK ("Consorcio_Status" IN ('ATIVO','INATIVO','EM_VALIDACAO','DEMONSTRACAO'));
  END IF;
END $$;

UPDATE "Consorcio"
   SET "Consorcio_Status" = 'DEMONSTRACAO'
 WHERE "Consorcio_Nome" ILIKE '%demo%';

CREATE INDEX IF NOT EXISTS idx_consorcio_status
  ON "Consorcio" ("Consorcio_Status", "Consorcio_Tipo");

-- A carga oficial do IBGE usa codigos 510001..510018. Seeds antigos
-- deixavam regioes ilustrativas sem municipio depois da carga canonica.
DELETE FROM "RegiaoImediata" r
 WHERE NOT EXISTS (
   SELECT 1 FROM "Municipio" m
    WHERE m."Municipio_CodigoRgi" = r."RegiaoImediata_Codigo"
 );

CREATE OR REPLACE FUNCTION validar_coerencia_regional_municipio()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "RegiaoImediata" r
     WHERE r."RegiaoImediata_Codigo" = NEW."Municipio_CodigoRgi"
       AND r."RegiaoImediata_CodigoRgint" = NEW."Municipio_CodigoRgint"
  ) THEN
    RAISE EXCEPTION
      'RGI % nao pertence a RGInt % para o municipio %',
      NEW."Municipio_CodigoRgi", NEW."Municipio_CodigoRgint", NEW."Municipio_CodigoIbge";
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_municipio_coerencia_regional ON "Municipio";
CREATE TRIGGER trg_municipio_coerencia_regional
BEFORE INSERT OR UPDATE OF "Municipio_CodigoRgi", "Municipio_CodigoRgint"
ON "Municipio"
FOR EACH ROW EXECUTE FUNCTION validar_coerencia_regional_municipio();

