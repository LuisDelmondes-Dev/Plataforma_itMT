-- Remove o legado de db/08: nenhuma tabela futura recebe DML automaticamente.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE INSERT,UPDATE,DELETE ON TABLES FROM itmt_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE USAGE,SELECT ON SEQUENCES FROM itmt_app;
REVOKE INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public FROM itmt_app;
REVOKE USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public FROM itmt_app;

-- Identidade, catálogo curado e auditoria.
GRANT INSERT,UPDATE ON "Usuario" TO itmt_app;
GRANT INSERT ON "EventoAuditoria" TO itmt_app;
GRANT INSERT,UPDATE ON "Indicador" TO itmt_app;
GRANT INSERT ON "ParecerValidacao","Autorizacao" TO itmt_app;
GRANT INSERT,UPDATE ON "Direito" TO itmt_app;

-- Control plane.
GRANT INSERT,UPDATE ON "OrganizacaoConfiguracao","TenantJob" TO itmt_app;

-- Documentos/RAG.
GRANT INSERT,UPDATE ON "Documento","DocumentoVersao","DocumentoTarefa","DocumentoEmbedding" TO itmt_app;
GRANT INSERT,DELETE ON "DocumentoTrecho" TO itmt_app;
GRANT INSERT ON "DocumentoRevisao" TO itmt_app;

-- Parceiros, IA e custo.
GRANT INSERT,UPDATE ON "ApiCliente","ApiConsumoJanela","ContribuicaoDado" TO itmt_app;
GRANT INSERT ON "AgentExecution","ConsumoLlm" TO itmt_app;

-- GIS, mídia e campo.
GRANT INSERT,UPDATE ON "ProjetoLevantamento","ProdutoGeografico","CapturaImagemRua","ProjetoEstruturante",
  "TermoConsentimento","AtivoMidia","MissaoCampo","MissaoAutorizacao","CapturaCampo" TO itmt_app;

-- Somente sequences usadas pelas bordas de escrita acima.
GRANT USAGE,SELECT ON SEQUENCE
  "Usuario_Usuario_Id_seq","EventoAuditoria_EventoAuditoria_Id_seq","Indicador_Indicador_Id_seq",
  "ParecerValidacao_ParecerValidacao_Id_seq","Autorizacao_Autorizacao_Id_seq","Direito_Direito_Id_seq",
  "Documento_Documento_Id_seq","DocumentoVersao_DocumentoVersao_Id_seq","DocumentoTrecho_DocumentoTrecho_Id_seq",
  "DocumentoRevisao_DocumentoRevisao_Id_seq","DocumentoTarefa_DocumentoTarefa_Id_seq",
  "DocumentoEmbedding_DocumentoEmbedding_Id_seq","ApiCliente_ApiCliente_Id_seq",
  "ContribuicaoDado_ContribuicaoDado_Id_seq","AgentExecution_AgentExecution_Id_seq","ConsumoLlm_ConsumoLlm_Id_seq",
  "ProjetoLevantamento_ProjetoLevantamento_Id_seq","ProdutoGeografico_ProdutoGeografico_Id_seq",
  "CapturaImagemRua_CapturaImagemRua_Id_seq","ProjetoEstruturante_ProjetoEstruturante_Id_seq",
  "TermoConsentimento_TermoConsentimento_Id_seq","AtivoMidia_AtivoMidia_Id_seq",
  "MissaoCampo_MissaoCampo_Id_seq","CapturaCampo_CapturaCampo_Id_seq" TO itmt_app;

-- Auditoria continua materialmente append-only.
REVOKE UPDATE,DELETE,TRUNCATE ON "EventoAuditoria" FROM itmt_app;

