-- ============================================================
-- db/65 — Corrige o hash canônico da configuração de ingestão (E17/db/62)
--
-- DEFEITO: o hash era calculado com `(<jsonb>)::text::bytea`. Esse cast NÃO
-- converte texto em bytes UTF-8 — ele LÊ o texto no formato de ENTRADA de
-- bytea, onde a barra invertida é caractere de escape. Consequência: toda
-- configuração cujo texto jsonb contenha uma barra invertida (uma aspa
-- escapada `\"` dentro de uma string, um `\n`) faz o INSERT levantar
-- `sintaxe de entrada inválida para o tipo de dados bytea` — e a versão
-- simplesmente não entra no catálogo.
--
-- É exatamente o defeito que o AuditoriaService já documentava e evitava
-- (api/src/auditoria/auditoria.service.ts), e cuja cura não havia chegado nem
-- aqui nem ao lib-ingest — este último corrigido no db/63.
--
-- CURA: `convert_to(<texto>, 'UTF8')`, que gera os bytes UTF-8 de verdade.
--
-- POR QUE ISTO É COMPATÍVEL COM O QUE JÁ FOI GRAVADO: para texto SEM barra
-- invertida os dois caminhos produzem exatamente os mesmos bytes, logo o
-- mesmo SHA-256 — verificado em PostgreSQL 18. As 12 configurações vigentes
-- não contêm barra invertida, então nenhum hash existente muda. O bloco de
-- verificação ao final PROVA isso nesta instalação em vez de supor.
--
-- Nada é recalculado à força: se algum hash divergisse, a migração falharia
-- alto em vez de reescrever silenciosamente o catálogo.
--
-- ADR-010 / E17. Migração db/62 já aplicada não pode ser editada (um banco
-- que a aplicou pularia o substituto em silêncio) — por isso a correção vem
-- em arquivo novo, substituindo a função do trigger.
-- ============================================================

CREATE OR REPLACE FUNCTION e17_config_ingestao_hash() RETURNS trigger AS $$
BEGIN
  NEW."FonteConectorConfiguracao_HashSha256" :=
    encode(sha256(convert_to((NEW."FonteConectorConfiguracao_Conteudo")::text, 'UTF8')), 'hex');
  RETURN NEW;
END $$ LANGUAGE plpgsql;

COMMENT ON FUNCTION e17_config_ingestao_hash() IS
'Hash canônico da configuração de ingestão: sha256 dos bytes UTF-8 de (conteúdo)::text. Usa convert_to e NUNCA o cast text::bytea, que rejeita barra invertida (db/65).';

-- Prova, nesta instalação, que a troca não invalidou nenhum hash gravado.
DO $$
DECLARE divergentes int;
BEGIN
  SELECT count(*) INTO divergentes
    FROM "FonteConectorConfiguracao"
   WHERE "FonteConectorConfiguracao_HashSha256"
         <> encode(sha256(convert_to(("FonteConectorConfiguracao_Conteudo")::text, 'UTF8')), 'hex');

  IF divergentes > 0 THEN
    RAISE EXCEPTION
      'db/65: % configuracao(oes) tem hash que nao bate com a forma canonica corrigida. '
      'Isso significaria conteudo com barra invertida gravado antes desta correcao. '
      'Investigue antes de prosseguir — nao reescreva o catalogo automaticamente.',
      divergentes;
  END IF;

  RAISE NOTICE 'db/65: hash de todas as configuracoes vigentes conferido — nenhuma divergencia.';
END $$;
