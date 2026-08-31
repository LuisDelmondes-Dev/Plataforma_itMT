-- ============================================================
-- 58-catalogo-fontes-parceiras-f4.sql (Evolução E5 · fontes parceiras F4)
--
-- ADR-010, evolução E5: o catálogo "FonteConector" (db/55/56) incorpora a
-- Fase 4 EXTERNA — a matriz de fontes PARCEIRAS entregue pela curadoria em
-- 28/08/2026 ("ITMT_Fase4_Matriz_Fontes_Parceiras_Refinada.csv": 42 fontes/
-- famílias F4S01–F4S42, com instituição, área, URL, forma de integração
-- prevista e status). O próprio pacote da F4 avisa, com todas as letras:
-- «"candidato" não significa que já exista convênio». Este arquivo registra
-- exatamente isso — o horizonte de parcerias, nunca uma promessa de dado.
--
-- HONESTIDADE DE SITUAÇÃO (a régua desta migração): dado conveniado NUNCA
-- nasce EXECUTAVEL. Regras de mapeamento aplicadas linha a linha, derivadas
-- da coluna "Forma de integração prevista" da matriz:
--   · "Convênio ..." sem parte pública declarada ("Convênio", "Convênio /
--     relatórios", "Convênio / dados agregados", "Convênios individuais",
--     "Convênios com agregação e sigilo", famílias de fontes)
--       ⇒ BLOQUEADA_EXTERNA, com _MotivoBloqueio único:
--       'Convênio não firmado — candidato F4 (dado privado/institucional;
--        publicação depende de acordo)'.
--   · Forma que declara uma parte PÚBLICA coletável ("Publicações +
--     convênio", "Portal + convênio", "Pesquisas + convênio", "Publicações
--     + convênio/API se pactuada", "Convênio + relatórios públicos",
--     "Convênio + dados públicos")
--       ⇒ PLANEJADA: relatórios/índices/pesquisas PUBLICADOS são coletáveis
--       por crawler (classe E) sem convênio — coletor ainda não construído,
--       trabalho futuro nosso. O convênio AMPLIA o escopo (dado bruto,
--       séries internas), mas não condiciona a parte pública; PLANEJADA não
--       carrega motivo de bloqueio (CHECK de db/55), então esse registro
--       vive aqui e nos comentários dos INSERTs. A distinção honesta é a da
--       própria matriz: "relatórios públicos" ≠ "relatórios" (só via acordo).
--   · Contagem resultante: 12 PLANEJADA + 30 BLOQUEADA_EXTERNA = 42.
--
-- CLASSE A–E (seção 41 da pesquisa):
--   · D (convênio institucional) para TODAS as bloqueadas — o acesso é o
--     acordo; _Tipo operacional 'ARQUIVO_AUTORIZADO' (vocabulário de db/41).
--   · E (crawler/publicações) para as planejadas — a parte pública são
--     páginas/relatórios/PDF sem API; _Tipo 'DOWNLOAD'. Exceção única:
--     sebrae-mt é B ("Portal + convênio": observatorio.sebrae.com.br é
--     portal de dados estruturado, painéis com exportação — não crawler de
--     publicação avulsa); _Tipo 'DOWNLOAD' (mapa B→DOWNLOAD de db/56).
--
-- DEMAIS COLUNAS:
--   · _Fase = 4 (matriz F4). O CHECK herdado de db/56 aceitava só (1,2) e é
--     recriado dinamicamente (padrão db/54/56) para IN (1,2,3,4): a Fase 3
--     externa não trouxe conectores-fonte próprios (o harvester municipal
--     virá como fonte própria quando existir), mas o 3 já fica válido.
--   · _Area = coluna "Área" da matriz, verbatim.
--   · _UrlOficial = coluna "URL"; famílias de fontes sem URL ficam NULL
--     (12 linhas — não se inventa portal para "bancos parceiros").
--   · _Prioridade: Status "Candidato prioritário" → P0 (13 linhas); demais
--     ("Candidato", "Família de fontes") → P1 (29).
--   · _Dificuldade: 'Alta' para tudo que depende de convênio (as 30
--     bloqueadas — negociar acordo, agregação e sigilo é o trabalho duro);
--     'Media' para publicações públicas estruturadas (as 12 planejadas —
--     crawler de relatório publicado é esforço conhecido).
--   · Periodicidade: a matriz F4 NÃO declara periodicidade — todas entram
--     como EVENTUAL/180 (vocabulário "variável/sob demanda" de db/56);
--     ajustar é UPDATE de curadoria quando a parceria definir o ritmo.
--   · Nenhuma linha carrega _Comando ou _ConfigIngestao: não há coletor.
--
-- SLUGS: kebab-case derivado do código/nome da matriz (F4S01 → 'imea',
-- F4S04 → 'fiemt-observatorio', F4S25 → 'nova-rota-oeste', F4S26 →
-- 'rumo-logistica', F4S32 → 'bancos-parceiros'...). Colisão única: F4S22
-- (Energisa) bateria em 'energisa-mt', que já existe desde db/56 como a
-- linha F2 de convênio (BLOQUEADA_EXTERNA, classe D). A linha F4 é a faixa
-- COMPLEMENTAR — "Convênio + relatórios públicos", a parte publicada — e
-- entra como 'energisa-mt-relatorios' (PLANEJADA, classe E). As duas
-- coexistem de propósito: uma espera o acordo, a outra espera o crawler.
--
-- PROMOÇÃO (RG-09 vale para fonte também): promover qualquer linha desta
-- migração a EXECUTAVEL exige (a) coletor construído e (b), para as
-- bloqueadas, convênio FORMAL firmado e registrado — e a promoção é UPDATE
-- de curadoria por migração, ato humano rastreável, nunca automático.
--
-- Idempotente: CHECK recriado só quando ainda não aceita a fase 4
-- (descoberta dinâmica em pg_constraint, como db/54/56); seed com ON
-- CONFLICT DO NOTHING por slug (o mesmo "só insere se não existe" de
-- db/55/56). Curadoria por migração: itmt_app segue só com SELECT (grant de
-- db/55; nada novo na catraca de menor privilégio).
-- ============================================================

-- ------------------------------------------------------------
-- 1) _Fase aceita 3 e 4 (CHECK inline de db/56 tinha nome autogerado —
--    descoberta dinâmica, padrão db/54/56).
-- ------------------------------------------------------------
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT conname
      FROM pg_constraint
     WHERE contype = 'c'
       AND conrelid = '"FonteConector"'::regclass
       AND pg_get_constraintdef(oid) LIKE '%FonteConector\_Fase%' ESCAPE '\'
       AND pg_get_constraintdef(oid) NOT LIKE '%4%'
  LOOP
    EXECUTE format('ALTER TABLE "FonteConector" DROP CONSTRAINT %I', c.conname);
    RAISE NOTICE 'db/58: CHECK % de "FonteConector" recriado com as fases 3 e 4', c.conname;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fonteconector_fase_check') THEN
    ALTER TABLE "FonteConector" ADD CONSTRAINT fonteconector_fase_check
      CHECK ("FonteConector_Fase" IN (1,2,3,4));
  END IF;
END $$;

-- ------------------------------------------------------------
-- 2) SEED das 42 fontes parceiras F4 (ordem = sequência F4S01–F4S42 da
--    matriz, continuando a numeração canônica a partir de 750).
--    30 BLOQUEADA_EXTERNA (motivo único de convênio) + 12 PLANEJADA
--    (parte pública coletável; o convênio amplia — ver cabeçalho).
-- ------------------------------------------------------------
INSERT INTO "FonteConector"
  ("FonteConector_Slug","FonteConector_Nome","FonteConector_Origem",
   "FonteConector_ClasseIntegracao","FonteConector_Tipo",
   "FonteConector_Periodicidade","FonteConector_IntervaloDias",
   "FonteConector_Situacao","FonteConector_MotivoBloqueio",
   "FonteConector_Comando","FonteConector_ConfigIngestao","FonteConector_Ordem",
   "FonteConector_Fase","FonteConector_Area","FonteConector_UrlOficial",
   "FonteConector_Prioridade","FonteConector_Dificuldade")
VALUES
  -- F4S01 · "Publicações + convênio/API se pactuada" → parte pública coletável.
  ('imea','IMEA — publicações de mercado agropecuário (preços, custos, safra)',
   'Instituto Mato-grossense de Economia Agropecuária',
   'E','DOWNLOAD','EVENTUAL',180,'PLANEJADA',NULL,NULL,NULL,750,
   4,'Agro / inteligência de mercado','https://www.imea.com.br/','P0','Media'),
  -- F4S02 · "Convênio / relatórios / pesquisas" → só via acordo.
  ('famato','FAMATO — pesquisas e indicadores setoriais do agro',
   'Federação da Agricultura e Pecuária de Mato Grosso',
   'D','ARQUIVO_AUTORIZADO','EVENTUAL',180,'BLOQUEADA_EXTERNA',
   'Convênio não firmado — candidato F4 (dado privado/institucional; publicação depende de acordo)',
   NULL,NULL,760,
   4,'Agro / representação','https://sistemafamato.org.br/','P0','Alta'),
  -- F4S03 · "Convênio / relatórios".
  ('senar-mt','SENAR-MT — capacitação e assistência técnica rural',
   'Serviço Nacional de Aprendizagem Rural de Mato Grosso',
   'D','ARQUIVO_AUTORIZADO','EVENTUAL',180,'BLOQUEADA_EXTERNA',
   'Convênio não firmado — candidato F4 (dado privado/institucional; publicação depende de acordo)',
   NULL,NULL,770,
   4,'Capacitação rural','https://sistemafamato.org.br/senarmt/','P0','Alta'),
  -- F4S04 · "Publicações + convênio" → boletins do Observatório são públicos.
  ('fiemt-observatorio','FIEMT — Observatório de Mato Grosso (indicadores industriais)',
   'Sistema FIEMT - Observatório de Mato Grosso',
   'E','DOWNLOAD','EVENTUAL',180,'PLANEJADA',NULL,NULL,NULL,780,
   4,'Indústria / economia','https://fiemt.ind.br/','P0','Media'),
  -- F4S05 · "Convênio / relatórios".
  ('sesi-mt','SESI-MT — saúde e segurança no trabalho','SESI Mato Grosso',
   'D','ARQUIVO_AUTORIZADO','EVENTUAL',180,'BLOQUEADA_EXTERNA',
   'Convênio não firmado — candidato F4 (dado privado/institucional; publicação depende de acordo)',
   NULL,NULL,790,
   4,'Indústria / saúde e trabalho','https://www.sesimt.ind.br/','P1','Alta'),
  -- F4S06 · "Convênio / relatórios".
  ('senai-mt','SENAI-MT — educação profissional da indústria','SENAI Mato Grosso',
   'D','ARQUIVO_AUTORIZADO','EVENTUAL',180,'BLOQUEADA_EXTERNA',
   'Convênio não firmado — candidato F4 (dado privado/institucional; publicação depende de acordo)',
   NULL,NULL,800,
   4,'Educação profissional / indústria','https://www.senaimt.ind.br/','P1','Alta'),
  -- F4S07 · "Convênio / relatórios".
  ('iel-mt','IEL-MT — estágios, talentos e inovação empresarial','IEL Mato Grosso',
   'D','ARQUIVO_AUTORIZADO','EVENTUAL',180,'BLOQUEADA_EXTERNA',
   'Convênio não firmado — candidato F4 (dado privado/institucional; publicação depende de acordo)',
   NULL,NULL,810,
   4,'Talentos / inovação','https://ielmt.ind.br/','P1','Alta'),
  -- F4S08 · "Publicações + convênio" → ICF/ICEC/cesta básica são publicados.
  ('fecomercio-mt','Fecomércio-MT / IPF — ICF, ICEC e cesta básica',
   'Fecomércio Mato Grosso / IPF-MT',
   'E','DOWNLOAD','EVENTUAL',180,'PLANEJADA',NULL,NULL,NULL,820,
   4,'Comércio / serviços / consumo','https://fecomerciomt.org.br/','P0','Media'),
  -- F4S09 · "Convênio / relatórios".
  ('sesc-mt','SESC-MT — atendimentos, cultura, lazer e turismo social','SESC Mato Grosso',
   'D','ARQUIVO_AUTORIZADO','EVENTUAL',180,'BLOQUEADA_EXTERNA',
   'Convênio não firmado — candidato F4 (dado privado/institucional; publicação depende de acordo)',
   NULL,NULL,830,
   4,'Serviços sociais / turismo','https://www.sescmt.com.br/','P1','Alta'),
  -- F4S10 · "Convênio / relatórios".
  ('senac-mt','SENAC-MT — qualificação do setor terciário','SENAC Mato Grosso',
   'D','ARQUIVO_AUTORIZADO','EVENTUAL',180,'BLOQUEADA_EXTERNA',
   'Convênio não firmado — candidato F4 (dado privado/institucional; publicação depende de acordo)',
   NULL,NULL,840,
   4,'Educação profissional / comércio','https://www.mt.senac.br/','P1','Alta'),
  -- F4S11 · "Portal + convênio" → observatorio.sebrae.com.br é portal de
  -- dados estruturado (painéis com exportação) ⇒ classe B, não crawler E.
  ('sebrae-mt','Sebrae-MT — Observatório Setorial Territorial',
   'Sebrae Mato Grosso / Observatório Setorial Territorial',
   'B','DOWNLOAD','EVENTUAL',180,'PLANEJADA',NULL,NULL,NULL,850,
   4,'Pequenos negócios','https://observatorio.sebrae.com.br/','P0','Media'),
  -- F4S12 · "Publicações + convênio" → anuários do cooperativismo são públicos.
  ('ocb-mt','Sistema OCB/MT — Observatório do Cooperativismo',
   'Sistema OCB/MT / Observatório do Cooperativismo',
   'E','DOWNLOAD','EVENTUAL',180,'PLANEJADA',NULL,NULL,NULL,860,
   4,'Cooperativismo','https://www.ocbmt.coop.br/','P0','Media'),
  -- F4S13 · "Convênio / dados agregados".
  ('sicredi-mt','Sicredi em MT — crédito cooperativo agregado',
   'Cooperativas Sicredi com atuação em MT',
   'D','ARQUIVO_AUTORIZADO','EVENTUAL',180,'BLOQUEADA_EXTERNA',
   'Convênio não firmado — candidato F4 (dado privado/institucional; publicação depende de acordo)',
   NULL,NULL,870,
   4,'Crédito cooperativo','https://www.sicredi.com.br/','P1','Alta'),
  -- F4S14 · "Convênio / dados agregados".
  ('sicoob-mt','Sicoob em MT — crédito cooperativo agregado',
   'Cooperativas Sicoob com atuação em MT',
   'D','ARQUIVO_AUTORIZADO','EVENTUAL',180,'BLOQUEADA_EXTERNA',
   'Convênio não firmado — candidato F4 (dado privado/institucional; publicação depende de acordo)',
   NULL,NULL,880,
   4,'Crédito cooperativo','https://www.sicoob.com.br/','P1','Alta'),
  -- F4S15 · "Publicações + convênio" → pesquisas de safra publicadas.
  ('aprosoja-mt','Aprosoja-MT — pesquisas de safra, custos e logística',
   'Associação dos Produtores de Soja e Milho de Mato Grosso',
   'E','DOWNLOAD','EVENTUAL',180,'PLANEJADA',NULL,NULL,NULL,890,
   4,'Agro / soja e milho','https://www.aprosoja.com.br/','P0','Media'),
  -- F4S16 · "Publicações + convênio".
  ('acrimat','Acrimat — pesquisas regionais e perfil da pecuária de corte',
   'Associação dos Criadores de Mato Grosso',
   'E','DOWNLOAD','EVENTUAL',180,'PLANEJADA',NULL,NULL,NULL,900,
   4,'Pecuária de corte','https://acrimat.org.br/','P1','Media'),
  -- F4S17 · "Convênio" puro.
  ('sindifrigo-mt','Sindifrigo-MT — capacidade e abate agregado da indústria frigorífica',
   'Sindicato das Indústrias Frigoríficas de Mato Grosso',
   'D','ARQUIVO_AUTORIZADO','EVENTUAL',180,'BLOQUEADA_EXTERNA',
   'Convênio não firmado — candidato F4 (dado privado/institucional; publicação depende de acordo)',
   NULL,NULL,910,
   4,'Indústria frigorífica','https://sindifrigo.com.br/','P1','Alta'),
  -- F4S18 · "Convênio / publicações" — a ordem da matriz põe o acordo na frente.
  ('ampa-imamt','AMPA / IMAmt — algodão (produção, qualidade e pesquisa)',
   'AMPA / Instituto Mato-grossense do Algodão',
   'D','ARQUIVO_AUTORIZADO','EVENTUAL',180,'BLOQUEADA_EXTERNA',
   'Convênio não firmado — candidato F4 (dado privado/institucional; publicação depende de acordo)',
   NULL,NULL,920,
   4,'Algodão / pesquisa','https://ampa.com.br/','P1','Alta'),
  -- F4S19 · "Convênio" puro.
  ('aprosmat','Aprosmat — produção e comercialização de sementes',
   'Associação dos Produtores de Sementes de Mato Grosso',
   'D','ARQUIVO_AUTORIZADO','EVENTUAL',180,'BLOQUEADA_EXTERNA',
   'Convênio não firmado — candidato F4 (dado privado/institucional; publicação depende de acordo)',
   NULL,NULL,930,
   4,'Sementes','https://aprosmat.com.br/','P1','Alta'),
  -- F4S20 · "Convênio / publicações".
  ('cipem','CIPEM — indústria de base florestal (produção e exportação)',
   'Centro das Indústrias Produtoras e Exportadoras de Madeira de MT',
   'D','ARQUIVO_AUTORIZADO','EVENTUAL',180,'BLOQUEADA_EXTERNA',
   'Convênio não firmado — candidato F4 (dado privado/institucional; publicação depende de acordo)',
   NULL,NULL,940,
   4,'Base florestal','https://www.cipem.org.br/','P1','Alta'),
  -- F4S21 · "Publicações + convênio" → CUB é publicado mensalmente.
  ('sinduscon-mt','Sinduscon-MT — CUB e indicadores da construção civil',
   'Sindicato das Indústrias da Construção de Mato Grosso',
   'E','DOWNLOAD','EVENTUAL',180,'PLANEJADA',NULL,NULL,NULL,950,
   4,'Construção civil','https://www.sindusconmt.org.br/','P0','Media'),
  -- F4S22 · "Convênio + relatórios públicos" → a parte PÚBLICA. Slug
  -- 'energisa-mt' já existe (db/56, faixa F2 de convênio, BLOQUEADA_EXTERNA);
  -- esta é a faixa complementar dos relatórios publicados — ver cabeçalho.
  ('energisa-mt-relatorios','Energisa MT — relatórios públicos (rede, interrupções, investimentos)',
   'Energisa Mato Grosso',
   'E','DOWNLOAD','EVENTUAL',180,'PLANEJADA',NULL,NULL,NULL,960,
   4,'Energia elétrica','https://www.energisa.com.br/regioes/mato-grosso','P0','Media'),
  -- F4S23 · "Convênio + relatórios" (sem "públicos" — só via acordo).
  ('aguas-cuiaba','Águas Cuiabá / Iguá — saneamento da capital','Águas Cuiabá / Iguá',
   'D','ARQUIVO_AUTORIZADO','EVENTUAL',180,'BLOQUEADA_EXTERNA',
   'Convênio não firmado — candidato F4 (dado privado/institucional; publicação depende de acordo)',
   NULL,NULL,970,
   4,'Saneamento','https://igua.com.br/cuiaba/','P0','Alta'),
  -- F4S24 · família de fontes, "Convênios individuais"; sem URL.
  ('concessionarias-saneamento-mt','Concessionárias privadas de saneamento em MT (família de fontes)',
   'Prestadores/concessionárias privadas de saneamento em MT',
   'D','ARQUIVO_AUTORIZADO','EVENTUAL',180,'BLOQUEADA_EXTERNA',
   'Convênio não firmado — candidato F4 (dado privado/institucional; publicação depende de acordo)',
   NULL,NULL,980,
   4,'Saneamento',NULL,'P1','Alta'),
  -- F4S25 · "Convênio + dados públicos" → boletins de tráfego/acidentes públicos.
  ('nova-rota-oeste','Nova Rota do Oeste — rodovias concedidas (tráfego, acidentes, obras)',
   'Nova Rota do Oeste',
   'E','DOWNLOAD','EVENTUAL',180,'PLANEJADA',NULL,NULL,NULL,990,
   4,'Rodovias concedidas','https://novarotadooeste.com.br/','P0','Media'),
  -- F4S26 · "Convênio + relatórios públicos" → relatórios operacionais/RI públicos.
  ('rumo-logistica','Rumo — ferrovia em MT (movimentação, terminais, obras)',
   'Rumo Logística / Ferrovia de Mato Grosso',
   'E','DOWNLOAD','EVENTUAL',180,'PLANEJADA',NULL,NULL,NULL,1000,
   4,'Ferrovia / logística','https://www.rumolog.com/','P0','Media'),
  -- F4S27 · família de fontes, "Convênios individuais"; sem URL.
  ('terminais-privados-mt','Terminais multimodais e armazéns privados em MT (família de fontes)',
   'Terminais multimodais, armazéns e operadores privados',
   'D','ARQUIVO_AUTORIZADO','EVENTUAL',180,'BLOQUEADA_EXTERNA',
   'Convênio não firmado — candidato F4 (dado privado/institucional; publicação depende de acordo)',
   NULL,NULL,1010,
   4,'Logística',NULL,'P1','Alta'),
  -- F4S28 · "Convênio / mapas e dados agregados".
  ('vivo-mt','Vivo em MT — cobertura, qualidade e infraestrutura',
   'Vivo / Telefônica Brasil em Mato Grosso',
   'D','ARQUIVO_AUTORIZADO','EVENTUAL',180,'BLOQUEADA_EXTERNA',
   'Convênio não firmado — candidato F4 (dado privado/institucional; publicação depende de acordo)',
   NULL,NULL,1020,
   4,'Telecom','https://www.vivo.com.br/','P1','Alta'),
  -- F4S29 · "Convênio / mapas e dados agregados".
  ('tim-mt','TIM em MT — cobertura, qualidade e infraestrutura','TIM Brasil em Mato Grosso',
   'D','ARQUIVO_AUTORIZADO','EVENTUAL',180,'BLOQUEADA_EXTERNA',
   'Convênio não firmado — candidato F4 (dado privado/institucional; publicação depende de acordo)',
   NULL,NULL,1030,
   4,'Telecom','https://www.tim.com.br/','P1','Alta'),
  -- F4S30 · "Convênio / mapas e dados agregados".
  ('claro-mt','Claro em MT — cobertura, qualidade e infraestrutura','Claro em Mato Grosso',
   'D','ARQUIVO_AUTORIZADO','EVENTUAL',180,'BLOQUEADA_EXTERNA',
   'Convênio não firmado — candidato F4 (dado privado/institucional; publicação depende de acordo)',
   NULL,NULL,1040,
   4,'Telecom','https://www.claro.com.br/','P1','Alta'),
  -- F4S31 · família de fontes, "Convênios individuais"; sem URL.
  ('isps-regionais-mt','Provedores regionais de internet/fibra em MT (família de fontes)',
   'Provedores regionais de internet/fibra',
   'D','ARQUIVO_AUTORIZADO','EVENTUAL',180,'BLOQUEADA_EXTERNA',
   'Convênio não firmado — candidato F4 (dado privado/institucional; publicação depende de acordo)',
   NULL,NULL,1050,
   4,'Telecom',NULL,'P1','Alta'),
  -- F4S32 · família de fontes, "Convênios com agregação e sigilo"; sem URL.
  ('bancos-parceiros','Bancos e instituições financeiras parceiras (família de fontes)',
   'Bancos e instituições financeiras parceiras',
   'D','ARQUIVO_AUTORIZADO','EVENTUAL',180,'BLOQUEADA_EXTERNA',
   'Convênio não firmado — candidato F4 (dado privado/institucional; publicação depende de acordo)',
   NULL,NULL,1060,
   4,'Crédito / investimento',NULL,'P1','Alta'),
  -- F4S33 · família de fontes, "Convênios com agregação e sigilo"; sem URL.
  ('seguradoras-agro','Seguradoras e resseguradoras com carteira agro em MT (família de fontes)',
   'Seguradoras e resseguradoras com carteira agro em MT',
   'D','ARQUIVO_AUTORIZADO','EVENTUAL',180,'BLOQUEADA_EXTERNA',
   'Convênio não firmado — candidato F4 (dado privado/institucional; publicação depende de acordo)',
   NULL,NULL,1070,
   4,'Seguro / risco',NULL,'P1','Alta'),
  -- F4S34 · "Convênio" puro.
  ('fcdl-cdl-mt','FCDL/MT e CDLs — movimento varejista e inadimplência agregada',
   'FCDL/MT e CDLs locais',
   'D','ARQUIVO_AUTORIZADO','EVENTUAL',180,'BLOQUEADA_EXTERNA',
   'Convênio não firmado — candidato F4 (dado privado/institucional; publicação depende de acordo)',
   NULL,NULL,1080,
   4,'Varejo / crédito','https://fcdlmt.org.br/','P1','Alta'),
  -- F4S35 · "Pesquisas + convênio" → pesquisas setoriais publicadas.
  ('abrasel-mt','Abrasel-MT — pesquisas de alimentação fora do lar','Abrasel em Mato Grosso',
   'E','DOWNLOAD','EVENTUAL',180,'PLANEJADA',NULL,NULL,NULL,1090,
   4,'Alimentação fora do lar','https://abrasel.com.br/','P1','Media'),
  -- F4S36 · família de fontes, "Convênios com entidades e empresas"; sem URL.
  ('abih-trade-mt','Hotelaria e trade turístico de MT (família de fontes)',
   'Hotelaria e trade turístico de Mato Grosso',
   'D','ARQUIVO_AUTORIZADO','EVENTUAL',180,'BLOQUEADA_EXTERNA',
   'Convênio não firmado — candidato F4 (dado privado/institucional; publicação depende de acordo)',
   NULL,NULL,1100,
   4,'Turismo',NULL,'P1','Alta'),
  -- F4S37 · família de fontes, "Convênios individuais"; sem URL.
  ('associacoes-comerciais','Associações comerciais e empresariais municipais (família de fontes)',
   'Associações comerciais e empresariais municipais',
   'D','ARQUIVO_AUTORIZADO','EVENTUAL',180,'BLOQUEADA_EXTERNA',
   'Convênio não firmado — candidato F4 (dado privado/institucional; publicação depende de acordo)',
   NULL,NULL,1110,
   4,'Economia local',NULL,'P1','Alta'),
  -- F4S38 · família de fontes, "Convênios restritos/agregados"; sem URL.
  ('saude-privada-mt','Hospitais, clínicas e laboratórios privados parceiros (família de fontes)',
   'Hospitais, clínicas e laboratórios privados parceiros',
   'D','ARQUIVO_AUTORIZADO','EVENTUAL',180,'BLOQUEADA_EXTERNA',
   'Convênio não firmado — candidato F4 (dado privado/institucional; publicação depende de acordo)',
   NULL,NULL,1120,
   4,'Saúde privada',NULL,'P1','Alta'),
  -- F4S39 · família de fontes, "Convênios agregados"; sem URL.
  ('educacao-privada-mt','Instituições privadas de ensino e capacitação parceiras (família de fontes)',
   'Instituições privadas de ensino e capacitação parceiras',
   'D','ARQUIVO_AUTORIZADO','EVENTUAL',180,'BLOQUEADA_EXTERNA',
   'Convênio não firmado — candidato F4 (dado privado/institucional; publicação depende de acordo)',
   NULL,NULL,1130,
   4,'Educação',NULL,'P1','Alta'),
  -- F4S40 · família de fontes, "Convênios empresariais"; sem URL.
  ('grandes-empresas-mt','Grandes empresas e grupos econômicos instalados em MT (família de fontes)',
   'Grandes empresas e grupos econômicos instalados em MT',
   'D','ARQUIVO_AUTORIZADO','EVENTUAL',180,'BLOQUEADA_EXTERNA',
   'Convênio não firmado — candidato F4 (dado privado/institucional; publicação depende de acordo)',
   NULL,NULL,1140,
   4,'Investimento privado',NULL,'P1','Alta'),
  -- F4S41 · família de fontes, "Convênios institucionais"; sem URL.
  ('parques-distritos-industriais','Parques, condomínios e distritos industriais (família de fontes)',
   'Parques, condomínios e distritos industriais',
   'D','ARQUIVO_AUTORIZADO','EVENTUAL',180,'BLOQUEADA_EXTERNA',
   'Convênio não firmado — candidato F4 (dado privado/institucional; publicação depende de acordo)',
   NULL,NULL,1150,
   4,'Indústria / território',NULL,'P1','Alta'),
  -- F4S42 · família de fontes, "Convênios institucionais"; sem URL.
  ('ecossistema-inovacao-mt','ICTs, hubs, aceleradoras e ambientes de inovação (família de fontes)',
   'ICTs, hubs, aceleradoras e ambientes de inovação',
   'D','ARQUIVO_AUTORIZADO','EVENTUAL',180,'BLOQUEADA_EXTERNA',
   'Convênio não firmado — candidato F4 (dado privado/institucional; publicação depende de acordo)',
   NULL,NULL,1160,
   4,'Inovação',NULL,'P1','Alta')
ON CONFLICT ("FonteConector_Slug") DO NOTHING;

COMMENT ON TABLE "FonteConector" IS
  'Evolução E2/E2b/E5 (ADR-010): catálogo curado do registro de conectores de fontes — o recorte executável de db/55, o programa completo das matrizes F1/F2 (db/56) e as 42 fontes/famílias PARCEIRAS da Fase 4 externa (db/58, matriz de 28/08/2026). "Candidato" não significa convênio: dado conveniado nasce BLOQUEADA_EXTERNA; parte pública publicada nasce PLANEJADA. Promover a EXECUTAVEL exige coletor + (bloqueadas) convênio formal — UPDATE de curadoria, ato humano (RG-09 vale para fonte também).';
