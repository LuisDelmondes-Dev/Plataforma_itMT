DO $$ DECLARE c text; BEGIN
  SELECT conname INTO c FROM pg_constraint WHERE conrelid='"ProdutoGeografico"'::regclass AND contype='c'
    AND pg_get_constraintdef(oid) ILIKE '%ProdutoGeografico_Tipo%';
  IF c IS NOT NULL THEN EXECUTE format('ALTER TABLE "ProdutoGeografico" DROP CONSTRAINT %I',c); END IF;
END $$;
ALTER TABLE "ProdutoGeografico" ADD CONSTRAINT "ProdutoGeografico_Tipo_check" CHECK
  ("ProdutoGeografico_Tipo" IN ('ORTOMOSAICO','MDS','MDT','CURVA_NIVEL','NUVEM_PONTOS','TILES_3D'));
ALTER TABLE "ProdutoGeografico"
  ADD COLUMN IF NOT EXISTS "ProdutoGeografico_TilesetUrl" text,
  ADD COLUMN IF NOT EXISTS "ProdutoGeografico_BoundsWgs84" jsonb,
  ADD COLUMN IF NOT EXISTS "ProdutoGeografico_CrsOrigem" text,
  ADD COLUMN IF NOT EXISTS "ProdutoGeografico_HashSha256" char(64);
ALTER TABLE "ProdutoGeografico" ADD CONSTRAINT "ProdutoGeografico_tiles3d_metadata_check" CHECK (
  "ProdutoGeografico_Tipo"<>'TILES_3D' OR (
    "ProdutoGeografico_TilesetUrl" ~ '^https?://' AND jsonb_typeof("ProdutoGeografico_BoundsWgs84")='array'
    AND jsonb_array_length("ProdutoGeografico_BoundsWgs84")=4 AND "ProdutoGeografico_CrsOrigem" IS NOT NULL
    AND "ProdutoGeografico_HashSha256" ~ '^[0-9a-f]{64}$'));

