-- ============================================================
-- 07-seed-f4.sql — Carga inicial CURADA do Mapa de Direitos.
-- ⚠️ Fichas curadas a partir de fontes oficiais federais na data
-- de verificação indicada em cada registro. Valores monetários
-- são expressos pela FÓRMULA LEGAL (ex.: "um salário mínimo"),
-- nunca por cifras que expiram (§2.11 do prompt mestre).
-- A pesquisa contínua (federal → estadual → municipal) segue a
-- metodologia de docs/F4-PROMPT-MESTRE.md; ficha nova entra como
-- RASCUNHO e só publica passando pelos vetos F4-RG-01..05.
-- ============================================================

INSERT INTO "PublicoAlvo" ("PublicoAlvo_Slug","PublicoAlvo_Nome") VALUES
 ('criancas','Crianças'),
 ('adolescentes','Adolescentes'),
 ('jovens','Jovens'),
 ('estudantes','Estudantes'),
 ('idosos','Pessoas idosas'),
 ('gestantes','Gestantes'),
 ('familias-baixa-renda','Famílias de baixa renda'),
 ('desempregados','Pessoas desempregadas'),
 ('trabalhadores-formais','Trabalhadores formais'),
 ('trabalhadores-rurais','Trabalhadores rurais e agricultores familiares'),
 ('pcd','Pessoas com deficiência'),
 ('pacientes','Pacientes com doenças graves ou crônicas'),
 ('cuidadores','Cuidadores e responsáveis'),
 ('mulheres','Mulheres'),
 ('populacao-rua','Pessoas em situação de rua'),
 ('povos-tradicionais','Povos indígenas, quilombolas e comunidades tradicionais'),
 ('migrantes-refugiados','Migrantes, refugiados e apátridas'),
 ('toda-populacao','Toda a população');

INSERT INTO "CondicaoSaude" ("CondicaoSaude_Slug","CondicaoSaude_Nome","CondicaoSaude_Tipo") VALUES
 ('tea','Transtorno do espectro autista','NEURODESENVOLVIMENTO'),
 ('sindrome-down','Síndrome de Down','NEURODESENVOLVIMENTO'),
 ('paralisia-cerebral','Paralisia cerebral','NEURODESENVOLVIMENTO'),
 ('deficiencia-fisica','Deficiência física','DEFICIENCIA'),
 ('deficiencia-auditiva','Deficiência auditiva','DEFICIENCIA'),
 ('deficiencia-visual','Deficiência visual','DEFICIENCIA'),
 ('deficiencia-intelectual','Deficiência intelectual','DEFICIENCIA'),
 ('visao-monocular','Visão monocular','DEFICIENCIA'),
 ('cancer','Câncer (neoplasia maligna)','DOENCA'),
 ('cardiopatia-grave','Cardiopatia grave','DOENCA'),
 ('nefropatia-grave','Nefropatia grave','DOENCA'),
 ('parkinson','Doença de Parkinson','DOENCA'),
 ('esclerose-multipla','Esclerose múltipla','DOENCA'),
 ('ela','Esclerose lateral amiotrófica','DOENCA'),
 ('alzheimer','Doença de Alzheimer (alienação mental)','DOENCA'),
 ('hiv','HIV/aids','DOENCA'),
 ('hanseniase','Hanseníase','DOENCA'),
 ('tuberculose-ativa','Tuberculose ativa','DOENCA'),
 ('cegueira','Cegueira','DEFICIENCIA'),
 ('sequela-avc','Sequelas de AVC','SEQUELA');

-- ------------------------------------------------------------
-- Fichas (§6). Uma por INSERT para leitura e revisão campo a campo.
-- ------------------------------------------------------------

-- 1. Registro civil gratuito
INSERT INTO "Direito" ("Direito_Nome","Direito_Area","Direito_Resumo","Direito_QuemPodeUsar",
 "Direito_Gratuidade","Direito_Abrangencia","Direito_OrgaoGestor","Direito_OrgaoExecutor",
 "Direito_BaseLegal","Direito_NaturezaNorma","Direito_Requisitos","Direito_Documentos",
 "Direito_ComoSolicitar","Direito_OndeSolicitar","Direito_LinkOficial","Direito_PrazoEstimado",
 "Direito_Acumulacao","Direito_ComoRecorrer","Direito_CanaisReclamacao","Direito_Observacoes",
 "Direito_Confianca","Direito_Automatico","Direito_DataVerificacao","Direito_Status") VALUES
 ('Certidão de nascimento e de óbito gratuitas (primeira via)','DOCUMENTACAO',
  'O registro civil de nascimento e de óbito e a primeira certidão são gratuitos para todas as pessoas, em qualquer cartório do país.',
  'Toda a população. Pessoas reconhecidamente pobres têm gratuidade também nas demais certidões do registro civil.',
  'GRATUITO','FEDERAL','Conselho Nacional de Justiça (regulação dos serviços extrajudiciais)','Cartórios de Registro Civil das Pessoas Naturais',
  'Lei nº 9.534/1997; Lei nº 6.015/1973 (Lei de Registros Públicos), art. 30','LEI',
  'Nenhum requisito de renda para a primeira via de nascimento e óbito.',
  'Declaração de Nascido Vivo (DNV) para nascimento; Declaração de Óbito (DO) para óbito; documento do declarante.',
  'Comparecer ao cartório de registro civil; muitas maternidades possuem posto de registro.',
  'Cartório de Registro Civil do local do nascimento ou da residência dos pais.',
  'https://www.gov.br/pt-br/servicos-estaduais/registro-civil-de-nascimento','Emissão imediata na maioria dos casos.',
  'Não interfere em nenhum outro direito ou benefício.',
  'Recusa de gratuidade pode ser levada à corregedoria do tribunal de justiça do estado.',
  'Corregedoria-Geral de Justiça do estado; CNJ; Defensoria Pública.',
  'Segunda via gratuita depende de hipossuficiência declarada ou de previsão estadual — regra varia localmente.',
  'CONFIRMADA',true,'2026-07-17','PUBLICADO');

-- 2. Bolsa Família
INSERT INTO "Direito" ("Direito_Nome","Direito_Area","Direito_Resumo","Direito_QuemPodeUsar",
 "Direito_QuemNaoSeEnquadra","Direito_Gratuidade","Direito_Abrangencia","Direito_OrgaoGestor",
 "Direito_OrgaoExecutor","Direito_BaseLegal","Direito_NaturezaNorma","Direito_Requisitos",
 "Direito_CriterioRenda","Direito_Documentos","Direito_ComoSolicitar","Direito_OndeSolicitar",
 "Direito_LinkOficial","Direito_ValidadeRenovacao","Direito_ValorCobertura","Direito_Acumulacao",
 "Direito_MotivosNegativa","Direito_ComoRecorrer","Direito_CanaisReclamacao","Direito_Observacoes",
 "Direito_Confianca","Direito_DataVerificacao","Direito_Status") VALUES
 ('Programa Bolsa Família','RENDA',
  'Transferência mensal de renda para famílias em situação de pobreza, com compromissos de saúde e educação (vacinação, pré-natal e frequência escolar).',
  'Famílias inscritas no Cadastro Único cuja renda por pessoa esteja dentro do limite legal de pobreza.',
  'Famílias com renda por pessoa acima do limite vigente; a seleção é da gestão federal — a inscrição no Cadastro Único não garante a concessão.',
  'GRATUITO','FEDERAL','Ministério do Desenvolvimento e Assistência Social, Família e Combate à Fome','Caixa Econômica Federal (pagamento); municípios via CRAS (cadastro)',
  'Lei nº 14.601/2023','LEI',
  'Inscrição no Cadastro Único atualizada (menos de 2 anos) e renda familiar por pessoa dentro do limite do programa.',
  'Renda familiar mensal por pessoa até o limite fixado pela Lei nº 14.601/2023 e regulamentos — o valor é atualizado periodicamente: confirme o limite vigente no site oficial.',
  'CPF ou título de eleitor do responsável familiar; documentos de todos os membros da família.',
  'Inscrever-se no Cadastro Único no CRAS do município; a seleção e concessão são automáticas a partir da base cadastral.',
  'CRAS do município; app Cadastro Único; app Bolsa Família; Central 121.',
  'https://www.gov.br/mds/pt-br/acoes-e-programas/bolsa-familia','Cadastro deve ser atualizado a cada 2 anos ou quando a família mudar.',
  'Valor por família conforme a composição (benefícios por criança, gestante e nutriz previstos em lei) — consulte os valores vigentes no site oficial.',
  'Regra de proteção permite permanência temporária com renda ampliada; recebimento de BPC na família entra no cálculo da renda.',
  'Renda acima do limite; cadastro desatualizado; inconsistências na averiguação cadastral.',
  'Procurar o CRAS para atualização e revisão; contestação na gestão municipal do Cadastro Único.',
  'Central 121 (MDS); ouvidoria do MDS; Defensoria Pública.',
  'Bloqueio, suspensão e cancelamento seguem as regras de averiguação e revisão cadastral — manter o cadastro atualizado é a principal proteção.',
  'CONFIRMADA','2026-07-17','PUBLICADO');

-- 3. BPC — Benefício de Prestação Continuada
INSERT INTO "Direito" ("Direito_Nome","Direito_Area","Direito_Resumo","Direito_QuemPodeUsar",
 "Direito_QuemNaoSeEnquadra","Direito_Gratuidade","Direito_Abrangencia","Direito_OrgaoGestor",
 "Direito_OrgaoExecutor","Direito_BaseLegal","Direito_NaturezaNorma","Direito_Requisitos",
 "Direito_CriterioRenda","Direito_ExigeContribuicaoInss","Direito_Documentos","Direito_LaudoPericia",
 "Direito_ComoSolicitar","Direito_OndeSolicitar","Direito_LinkOficial","Direito_PrazoEstimado",
 "Direito_ValidadeRenovacao","Direito_ValorCobertura","Direito_Acumulacao","Direito_MotivosNegativa",
 "Direito_ComoRecorrer","Direito_CanaisReclamacao","Direito_Observacoes","Direito_Confianca",
 "Direito_DataVerificacao","Direito_Status") VALUES
 ('Benefício de Prestação Continuada (BPC/LOAS)','ASSISTENCIA_SOCIAL',
  'Um salário mínimo por mês para a pessoa idosa (65 anos ou mais) ou para a pessoa com deficiência de qualquer idade que comprove não ter meios de se manter. NÃO exige contribuição ao INSS e NÃO é aposentadoria.',
  'Pessoa idosa a partir de 65 anos, ou pessoa com deficiência com impedimento de longo prazo, com renda familiar por pessoa dentro do limite legal e inscrição no Cadastro Único.',
  'Quem recebe outro benefício da seguridade social (ex.: aposentadoria, pensão por morte), salvo os de natureza indenizatória e a assistência médica.',
  'GRATUITO','FEDERAL','Ministério do Desenvolvimento e Assistência Social, Família e Combate à Fome','INSS (operacionalização e perícia)',
  'Constituição Federal, art. 203, V; Lei nº 8.742/1993 (LOAS), art. 20','LEI',
  'Idade 65+ OU deficiência confirmada por avaliação biopsicossocial; renda familiar por pessoa de até 1/4 do salário mínimo (com hipóteses legais de flexibilização); Cadastro Único atualizado; CPF regular.',
  'Renda familiar mensal por pessoa de até 1/4 do salário mínimo (LOAS, art. 20, §3º); hipóteses de elastecimento a 1/2 salário mínimo mediante avaliação (art. 20-B).',
  false,
  'CPF de todos os membros da família; comprovante de inscrição no Cadastro Único; documentos médicos, no caso de deficiência.',
  'Para pessoa com deficiência: avaliação médica e social (biopsicossocial) realizada pelo INSS — laudo particular instrui o pedido, mas não substitui a avaliação oficial.',
  'Pedido pelo Meu INSS (site ou app) ou Central 135; acompanhar o andamento pelo mesmo canal.',
  'Meu INSS (meu.inss.gov.br); Central 135; agências do INSS.',
  'https://www.gov.br/inss/pt-br/assuntos/beneficio-de-prestacao-continuada-bpc',
  'Prazo administrativo de análise conforme regulamento e acordos judiciais vigentes — acompanhe pelo Meu INSS.',
  'Revisão periódica prevista em lei; manter Cadastro Único atualizado a cada 2 anos.',
  'Um salário mínimo mensal. Não gera 13º salário nem pensão por morte.',
  'NÃO acumula com aposentadoria ou pensão de qualquer regime (salvo indenizatórias). O ingresso no trabalho formal da pessoa com deficiência pode dar direito ao Auxílio-Inclusão em vez do BPC.',
  'Renda familiar acima do limite; avaliação que não reconhece o impedimento de longo prazo; cadastro desatualizado.',
  'Recurso à Junta de Recursos do CRPS em até 30 dias pelo Meu INSS; após esgotada a via administrativa, ação no Juizado Especial Federal (gratuito até 60 salários mínimos, sem advogado obrigatório).',
  'Ouvidoria do INSS (Central 135); Defensoria Pública da União; Ministério Público Federal.',
  'Diagnóstico médico NÃO é automaticamente deficiência: o que se avalia é o impedimento de longo prazo em interação com barreiras (avaliação biopsicossocial). Decisões judiciais flexibilizam o critério de renda em casos concretos.',
  'CONDICIONADA_AVALIACAO','2026-07-17','PUBLICADO');

-- 4. Tarifa Social de Energia Elétrica
INSERT INTO "Direito" ("Direito_Nome","Direito_Area","Direito_Resumo","Direito_QuemPodeUsar",
 "Direito_Gratuidade","Direito_Abrangencia","Direito_OrgaoGestor","Direito_OrgaoExecutor",
 "Direito_BaseLegal","Direito_NaturezaNorma","Direito_Requisitos","Direito_CriterioRenda",
 "Direito_Documentos","Direito_ComoSolicitar","Direito_OndeSolicitar","Direito_LinkOficial",
 "Direito_ValorCobertura","Direito_MotivosNegativa","Direito_ComoRecorrer","Direito_CanaisReclamacao",
 "Direito_Observacoes","Direito_Confianca","Direito_Automatico","Direito_PoucoConhecido",
 "Direito_DataVerificacao","Direito_Status") VALUES
 ('Tarifa Social de Energia Elétrica','SERVICOS_ESSENCIAIS',
  'Desconto na conta de luz para famílias de baixa renda. Desde 2022 a concessão é AUTOMÁTICA para quem está no Cadastro Único — não é preciso pedir.',
  'Famílias no Cadastro Único com renda por pessoa de até meio salário mínimo; pessoa que recebe BPC; famílias com pessoa em tratamento de saúde domiciliar que use equipamentos elétricos (regra própria); indígenas e quilombolas têm desconto ampliado.',
  'SUBSIDIADO','FEDERAL','Ministério de Minas e Energia / ANEEL','Distribuidoras de energia elétrica',
  'Lei nº 12.212/2010; Lei nº 14.203/2021 (concessão automática)','LEI',
  'Inscrição atualizada no Cadastro Único ou recebimento de BPC; a unidade consumidora deve estar vinculada à família.',
  'Renda familiar mensal por pessoa de até 1/2 salário mínimo (ou BPC, sem exigência adicional de renda).',
  'Nenhum documento é exigido quando a concessão automática funciona; se não aplicada, apresentar NIS e conta de luz à distribuidora.',
  'Automático a partir do cruzamento Cadastro Único × distribuidora. Se o desconto não aparecer na conta, contatar a distribuidora com o NIS.',
  'Distribuidora de energia do estado; CRAS para atualizar o Cadastro Único.',
  'https://www.gov.br/aneel/pt-br/assuntos/tarifas/tarifa-social',
  'Descontos escalonados por faixa de consumo, definidos em lei e resoluções da ANEEL.',
  'Cadastro Único desatualizado; unidade consumidora não vinculada ao NIS da família.',
  'Reclamar à ouvidoria da distribuidora; persistindo, à ANEEL (Central 167).',
  'ANEEL — Central 167; ouvidoria da distribuidora; Procon.',
  'A automatização depende do cruzamento de bases: manter o Cadastro Único atualizado é o que garante o desconto.',
  'CONFIRMADA',true,true,'2026-07-17','PUBLICADO');

-- 5. Farmácia Popular
INSERT INTO "Direito" ("Direito_Nome","Direito_Area","Direito_Resumo","Direito_QuemPodeUsar",
 "Direito_Gratuidade","Direito_Abrangencia","Direito_OrgaoGestor","Direito_OrgaoExecutor",
 "Direito_BaseLegal","Direito_NaturezaNorma","Direito_Requisitos","Direito_Documentos",
 "Direito_ComoSolicitar","Direito_OndeSolicitar","Direito_LinkOficial","Direito_ValorCobertura",
 "Direito_CanaisReclamacao","Direito_Observacoes","Direito_Confianca","Direito_DataVerificacao",
 "Direito_Status") VALUES
 ('Programa Farmácia Popular','SAUDE',
  'Medicamentos gratuitos ou com grande desconto em farmácias credenciadas: hipertensão, diabetes, asma, colesterol, osteoporose, entre outros, além de fraldas geriátricas para públicos definidos.',
  'Qualquer pessoa com receita médica válida (SUS ou particular) para os itens do elenco; alguns itens têm público definido em norma.',
  'GRATUITO','FEDERAL','Ministério da Saúde','Farmácias privadas credenciadas',
  'Lei nº 10.858/2004; Decreto nº 5.090/2004 e portarias do Ministério da Saúde','LEI',
  'Receita médica ou odontológica válida (prazo conforme o item), documento com foto e CPF.',
  'Documento com foto, CPF e receita dentro do prazo de validade.',
  'Ir a uma farmácia credenciada com receita e documentos — não há cadastro prévio.',
  'Farmácias com o selo "Aqui tem Farmácia Popular"; lista no site do Ministério da Saúde.',
  'https://www.gov.br/saude/pt-br/composicao/sectics/farmacia-popular',
  'Elenco de medicamentos e itens definido em portaria — o rol e as gratuidades são atualizados periodicamente.',
  'Ouvidoria-Geral do SUS — Disque 136; Anvisa para desvios de farmácia.',
  'O elenco coberto muda por portaria: confirme o item no site oficial antes de se deslocar.',
  'CONFIRMADA','2026-07-17','PUBLICADO');

-- 6. Passe Livre interestadual (pessoa com deficiência)
INSERT INTO "Direito" ("Direito_Nome","Direito_Area","Direito_Resumo","Direito_QuemPodeUsar",
 "Direito_QuemNaoSeEnquadra","Direito_Gratuidade","Direito_Abrangencia","Direito_OrgaoGestor",
 "Direito_OrgaoExecutor","Direito_BaseLegal","Direito_NaturezaNorma","Direito_Requisitos",
 "Direito_CriterioRenda","Direito_Documentos","Direito_LaudoPericia","Direito_ComoSolicitar",
 "Direito_OndeSolicitar","Direito_LinkOficial","Direito_ValidadeRenovacao","Direito_MotivosNegativa",
 "Direito_ComoRecorrer","Direito_CanaisReclamacao","Direito_Observacoes","Direito_Confianca",
 "Direito_PoucoConhecido","Direito_DataVerificacao","Direito_Status") VALUES
 ('Passe Livre interestadual para pessoa com deficiência','TRANSPORTE',
  'Viagem gratuita em ônibus, trem e barco entre estados para a pessoa com deficiência comprovadamente carente.',
  'Pessoa com deficiência física, auditiva, visual, intelectual, TEA ou ostomia, com renda familiar por pessoa de até um salário mínimo.',
  'Não vale para transporte urbano/municipal (gratuidades locais têm regras próprias) nem para transporte aéreo.',
  'GRATUITO','FEDERAL','Ministério dos Transportes','Empresas de transporte interestadual',
  'Lei nº 8.899/1994; Decreto nº 3.691/2000','LEI',
  'Comprovar a deficiência (laudo conforme o formulário oficial) e a renda familiar por pessoa de até um salário mínimo.',
  'Renda familiar mensal por pessoa de até 1 salário mínimo.',
  'Formulário oficial preenchido; atestado assinado por equipe do SUS ou laudo conforme instruções do programa; documentos pessoais.',
  'Atestado da deficiência conforme modelo do programa, emitido por profissional/equipe de saúde.',
  'Pedido pelo site do Ministério dos Transportes ou pelos Correios; a credencial é enviada ao endereço do beneficiário. Na viagem, solicitar o bilhete com antecedência mínima de 3 horas.',
  'gov.br — serviço "Obter Passe Livre"; pontos de atendimento indicados no site.',
  'https://www.gov.br/pt-br/servicos/obter-passe-livre-para-viagens-interestaduais',
  'Credencial com prazo de validade indicado no documento; renovação pelo mesmo canal.',
  'Renda acima do limite; laudo fora do modelo; documentação incompleta.',
  'Reapresentar o pedido com a pendência sanada; reclamação à ouvidoria do Ministério dos Transportes.',
  'Ouvidoria do Ministério dos Transportes; ANTT (transporte rodoviário interestadual) — Central 166.',
  'Estados e municípios têm passes livres próprios com regras diferentes — verificar a legislação local para trajetos dentro do estado.',
  'CONFIRMADA',true,'2026-07-17','PUBLICADO');

-- 7. Isenção de IR por doença grave
INSERT INTO "Direito" ("Direito_Nome","Direito_Area","Direito_Resumo","Direito_QuemPodeUsar",
 "Direito_QuemNaoSeEnquadra","Direito_Gratuidade","Direito_Abrangencia","Direito_OrgaoGestor",
 "Direito_OrgaoExecutor","Direito_BaseLegal","Direito_NaturezaNorma","Direito_Requisitos",
 "Direito_Documentos","Direito_LaudoPericia","Direito_ComoSolicitar","Direito_OndeSolicitar",
 "Direito_LinkOficial","Direito_MotivosNegativa","Direito_ComoRecorrer","Direito_CanaisReclamacao",
 "Direito_Observacoes","Direito_Confianca","Direito_PoucoConhecido","Direito_DataVerificacao",
 "Direito_Status") VALUES
 ('Isenção de Imposto de Renda sobre aposentadoria e pensão por doença grave','TRIBUTOS',
  'Quem tem uma das doenças listadas em lei não paga Imposto de Renda sobre aposentadoria, pensão ou reforma — mesmo que a doença tenha sido contraída depois da aposentadoria.',
  'Aposentados, pensionistas e militares reformados com doença listada na Lei nº 7.713/1988 (ex.: câncer, cardiopatia grave, Parkinson, esclerose múltipla, HIV/aids, hanseníase, tuberculose ativa, cegueira, alienação mental, nefropatia grave).',
  'A isenção NÃO alcança salários de quem continua trabalhando, aluguéis ou outras rendas — apenas proventos de aposentadoria, pensão ou reforma.',
  'GRATUITO','FEDERAL','Receita Federal','Fonte pagadora (INSS, regime próprio ou entidade de previdência)',
  'Lei nº 7.713/1988, art. 6º, XIV e XXI','LEI',
  'Ser aposentado/pensionista/reformado e ter laudo pericial oficial que identifique a doença listada.',
  'Laudo pericial de serviço médico oficial (União, estado, DF ou município); documentos do benefício.',
  'Laudo de serviço médico OFICIAL. O STJ admite prova por outros meios em juízo (Súmula 598), mas na via administrativa o laudo oficial é a regra; cegueira inclui a monocular (Súmula 377).',
  'Requerer à fonte pagadora (no INSS: pelo Meu INSS, serviço "Isenção de Imposto de Renda"); valores já retidos podem ser restituídos via declaração ou PER/DCOMP.',
  'Meu INSS ou Central 135 (aposentados do INSS); órgão pagador, nos demais regimes.',
  'https://www.gov.br/inss/pt-br/assuntos/isencao-de-imposto-de-renda',
  'Doença fora do rol legal; laudo não oficial na via administrativa; renda não previdenciária.',
  'Recurso administrativo na fonte pagadora; via judicial (Juizado Especial Federal ou Justiça comum) com apoio da Defensoria Pública se necessário.',
  'Ouvidoria da Receita Federal; ouvidoria do INSS; Defensoria Pública da União.',
  'O rol de doenças da lei é taxativo na via administrativa. Doença controlada/em remissão: o STJ entende que a isenção permanece para as doenças listadas (ex.: cardiopatia) mesmo sem sintomas atuais — nuance jurisprudencial.',
  'CONFIRMADA',true,'2026-07-17','PUBLICADO');

-- 8. Saque do FGTS por doença grave
INSERT INTO "Direito" ("Direito_Nome","Direito_Area","Direito_Resumo","Direito_QuemPodeUsar",
 "Direito_Gratuidade","Direito_Abrangencia","Direito_OrgaoGestor","Direito_OrgaoExecutor",
 "Direito_BaseLegal","Direito_NaturezaNorma","Direito_Requisitos","Direito_Documentos",
 "Direito_LaudoPericia","Direito_ComoSolicitar","Direito_OndeSolicitar","Direito_LinkOficial",
 "Direito_PrazoEstimado","Direito_MotivosNegativa","Direito_ComoRecorrer","Direito_CanaisReclamacao",
 "Direito_Observacoes","Direito_Confianca","Direito_PoucoConhecido","Direito_DataVerificacao",
 "Direito_Status") VALUES
 ('Saque do FGTS por doença grave','TRABALHO',
  'O trabalhador (ou seu dependente) com câncer, HIV/aids ou em estágio terminal de qualquer doença pode sacar o saldo do FGTS. Vale também para o PIS/Pasep, quando houver saldo.',
  'Titular de conta do FGTS quando o próprio trabalhador OU um de seus dependentes estiver acometido de neoplasia maligna, HIV/aids ou estágio terminal de doença.',
  'GRATUITO','FEDERAL','Conselho Curador do FGTS / Ministério do Trabalho e Emprego','Caixa Econômica Federal',
  'Lei nº 8.036/1990, art. 20, XI a XIV','LEI',
  'Ter saldo em conta vinculada do FGTS e comprovar a condição de saúde do titular ou do dependente.',
  'Atestado médico com diagnóstico (CID), carimbo e CRM; exames que comprovem; documento de identidade; comprovação de dependência, quando o doente for o dependente.',
  'Atestado médico conforme requisitos da Caixa; não exige perícia do INSS.',
  'Pedido pelo app FGTS (upload dos documentos) ou em agência da Caixa.',
  'App FGTS; agências da Caixa Econômica Federal.',
  'https://www.gov.br/pt-br/servicos/sacar-fgts-por-motivo-de-doencas-graves',
  'Análise em cerca de 5 dias úteis após a entrega completa dos documentos.',
  'Documentação médica incompleta; ausência de saldo; vínculo de dependência não comprovado.',
  'Reapresentar com a documentação exigida; reclamação nos canais da Caixa.',
  'Ouvidoria da Caixa; ouvidoria do FGTS; Defensoria Pública.',
  'O saque não depende de desligamento do emprego. Verifique no app o saldo de todas as contas (ativas e inativas).',
  'CONFIRMADA',true,'2026-07-17','PUBLICADO');

-- 9. Justiça gratuita e Defensoria Pública
INSERT INTO "Direito" ("Direito_Nome","Direito_Area","Direito_Resumo","Direito_QuemPodeUsar",
 "Direito_Gratuidade","Direito_Abrangencia","Direito_OrgaoGestor","Direito_OrgaoExecutor",
 "Direito_BaseLegal","Direito_NaturezaNorma","Direito_Requisitos","Direito_Documentos",
 "Direito_ComoSolicitar","Direito_OndeSolicitar","Direito_LinkOficial","Direito_Acumulacao",
 "Direito_MotivosNegativa","Direito_ComoRecorrer","Direito_CanaisReclamacao","Direito_Observacoes",
 "Direito_Confianca","Direito_DataVerificacao","Direito_Status") VALUES
 ('Assistência jurídica gratuita (Defensoria Pública e justiça gratuita)','JUSTICA',
  'Quem não pode pagar advogado e custas tem direito a atendimento jurídico integral e gratuito pela Defensoria Pública e à isenção de custas processuais.',
  'Pessoas que declarem insuficiência de recursos — pessoa física tem presunção legal a partir da simples declaração (CPC, art. 99, §3º); cada Defensoria define seu critério de atendimento.',
  'GRATUITO','FEDERAL','Defensorias Públicas (União, estados e DF)','Defensorias Públicas; Poder Judiciário (gratuidade de custas)',
  'Constituição Federal, art. 5º, LXXIV; CPC (Lei nº 13.105/2015), arts. 98–102; LC nº 80/1994','CONSTITUICAO',
  'Declaração de hipossuficiência; documentos pessoais e do caso concreto.',
  'Documento de identidade, CPF, comprovante de residência e de renda; documentos do caso.',
  'Procurar a unidade da Defensoria (estadual para causas comuns; DPU para INSS, União e federais); muitos atendimentos têm agendamento online ou por telefone.',
  'Defensoria Pública do estado; Defensoria Pública da União (dpu.def.br); núcleos de prática jurídica de universidades.',
  'https://www.dpu.def.br/',
  'Independe e não interfere em qualquer benefício social.',
  'Renda acima do critério de atendimento da Defensoria local (ainda assim a gratuidade de custas pode ser deferida pelo juiz).',
  'Da negativa da Defensoria cabe revisão pela própria instituição; da negativa judicial de gratuidade cabe recurso no processo.',
  'Ouvidoria da Defensoria; corregedoria do tribunal; OAB (advocacia pro bono).',
  'Juizados Especiais dispensam advogado em causas de até 20 salários mínimos (estadual) e permitem acesso direto no Juizado Especial Federal até 60 salários mínimos.',
  'CONFIRMADA','2026-07-17','PUBLICADO');

-- 10. Isenção de taxa em concursos federais
INSERT INTO "Direito" ("Direito_Nome","Direito_Area","Direito_Resumo","Direito_QuemPodeUsar",
 "Direito_Gratuidade","Direito_Abrangencia","Direito_OrgaoGestor","Direito_OrgaoExecutor",
 "Direito_BaseLegal","Direito_NaturezaNorma","Direito_Requisitos","Direito_Documentos",
 "Direito_ComoSolicitar","Direito_OndeSolicitar","Direito_LinkOficial","Direito_MotivosNegativa",
 "Direito_ComoRecorrer","Direito_CanaisReclamacao","Direito_Observacoes","Direito_Confianca",
 "Direito_PoucoConhecido","Direito_DataVerificacao","Direito_Status") VALUES
 ('Isenção de taxa de inscrição em concursos públicos federais','TRABALHO',
  'Inscrito no Cadastro Único de família de baixa renda e doadores de medula óssea não pagam taxa de inscrição em concursos do Executivo federal.',
  'Membros de família de baixa renda inscritos no Cadastro Único e doadores de medula óssea em entidades reconhecidas.',
  'GRATUITO','FEDERAL','Ministério da Gestão e da Inovação em Serviços Públicos','Bancas organizadoras dos concursos',
  'Decreto nº 6.593/2008; Lei nº 13.656/2018','LEI',
  'NIS válido no Cadastro Único (baixa renda) OU comprovação de doação de medula; pedido dentro do prazo do edital.',
  'NIS e dados pessoais idênticos aos do Cadastro Único; atestado de entidade de doação de medula, quando for o caso.',
  'Requerer a isenção no ato da inscrição, no site da banca, dentro da janela prevista no edital.',
  'Site da banca organizadora de cada concurso.',
  'https://www.gov.br/pt-br/servicos/solicitar-isencao-de-taxa-de-inscricao-em-concursos-publicos-federais',
  'NIS divergente ou desatualizado; pedido fora do prazo do edital.',
  'Recurso administrativo à banca no prazo do edital.',
  'Ouvidoria do órgão realizador do concurso.',
  'Estados e municípios têm leis próprias de isenção (inclusive para doadores de sangue em vários estados) — confira o edital e a lei local.',
  'CONFIRMADA',true,'2026-07-17','PUBLICADO');

-- 11. Transporte interestadual gratuito para pessoa idosa
INSERT INTO "Direito" ("Direito_Nome","Direito_Area","Direito_Resumo","Direito_QuemPodeUsar",
 "Direito_Gratuidade","Direito_Abrangencia","Direito_OrgaoGestor","Direito_OrgaoExecutor",
 "Direito_BaseLegal","Direito_NaturezaNorma","Direito_Requisitos","Direito_CriterioRenda",
 "Direito_Documentos","Direito_ComoSolicitar","Direito_OndeSolicitar","Direito_LinkOficial",
 "Direito_MotivosNegativa","Direito_ComoRecorrer","Direito_CanaisReclamacao","Direito_Observacoes",
 "Direito_Confianca","Direito_DataVerificacao","Direito_Status") VALUES
 ('Gratuidade e desconto no transporte interestadual para pessoa idosa','TRANSPORTE',
  'Pessoas com 60 anos ou mais e renda de até 2 salários mínimos têm direito a 2 vagas gratuitas por ônibus interestadual e a 50% de desconto nas demais.',
  'Pessoa com 60 anos ou mais com renda igual ou inferior a 2 salários mínimos.',
  'GRATUITO','FEDERAL','Ministério dos Transportes / ANTT','Empresas de transporte interestadual',
  'Lei nº 10.741/2003 (Estatuto da Pessoa Idosa), art. 40; Resoluções ANTT','LEI',
  'Idade 60+; comprovação de renda até 2 salários mínimos; solicitar o Bilhete de Viagem da Pessoa Idosa com antecedência (regra geral: até 3 horas antes do embarque).',
  'Renda individual igual ou inferior a 2 salários mínimos.',
  'Documento com foto e comprovante de renda (ou carteira do idoso emitida pelo CRAS para quem não tem como comprovar).',
  'Pedir o bilhete gratuito no guichê da empresa com antecedência; havendo negativa indevida, registrar reclamação na ANTT.',
  'Guichês das empresas; CRAS (carteira da pessoa idosa); ANTT Central 166.',
  'https://www.gov.br/antt/pt-br/assuntos/passageiros/gratuidades-e-beneficios',
  'Vagas gratuitas do horário já ocupadas (restam os 50% de desconto); falta de comprovação de renda.',
  'Reclamação na ANTT (Central 166) com o protocolo da empresa.',
  'ANTT — Central 166; Procon; Defensoria Pública.',
  'No transporte URBANO a gratuidade a partir dos 65 anos é direto da Constituição (art. 230, §2º); entre municípios do mesmo estado, a regra é estadual.',
  'CONFIRMADA','2026-07-17','PUBLICADO');

-- 12. Meia-entrada
INSERT INTO "Direito" ("Direito_Nome","Direito_Area","Direito_Resumo","Direito_QuemPodeUsar",
 "Direito_Gratuidade","Direito_Abrangencia","Direito_OrgaoGestor","Direito_OrgaoExecutor",
 "Direito_BaseLegal","Direito_NaturezaNorma","Direito_Requisitos","Direito_Documentos",
 "Direito_ComoSolicitar","Direito_OndeSolicitar","Direito_LinkOficial","Direito_Observacoes",
 "Direito_MotivosNegativa","Direito_ComoRecorrer","Direito_CanaisReclamacao","Direito_Confianca",
 "Direito_DataVerificacao","Direito_Status") VALUES
 ('Meia-entrada em eventos culturais e esportivos','CULTURA_ESPORTE_LAZER',
  'Estudantes, pessoas idosas (60+), pessoas com deficiência (e acompanhante quando necessário) e jovens de baixa renda pagam metade do ingresso em cinema, teatro, shows e jogos.',
  'Estudantes com CIE (Carteira de Identificação Estudantil); pessoas com 60+; pessoas com deficiência e, quando necessário, seu acompanhante; jovens de 15 a 29 anos de baixa renda com ID Jovem.',
  'SUBSIDIADO','FEDERAL','Ministérios da Cultura e do Esporte (regulação)','Produtores de eventos e bilheterias',
  'Lei nº 12.933/2013; Decreto nº 8.537/2015; Lei nº 10.741/2003, art. 23','LEI',
  'Apresentar o documento comprobatório na compra e na entrada; o benefício vale para 40% dos ingressos de cada evento.',
  'CIE (estudante); documento com foto (60+); comprovação da deficiência + cartão de gratuidade quando exigido; ID Jovem (jovem de baixa renda).',
  'Comprar o ingresso na modalidade meia-entrada e portar o documento no acesso ao evento.',
  'Bilheterias e plataformas de venda de cada evento.',
  'https://www.gov.br/pt-br/servicos/obter-a-carteira-de-identificacao-estudantil',
  'A cota de 40% pode se esgotar — a negativa nesse caso é lícita; fora disso, recusa de meia-entrada é infração de consumo.',
  'Cota de 40% esgotada; documento não aceito por estar fora dos modelos legais.',
  'Reclamação no Procon com o comprovante da recusa.',
  'Procon; consumidor.gov.br; Ministério Público (direitos difusos).',
  'CONFIRMADA','2026-07-17','PUBLICADO');

-- 13. ID Jovem
INSERT INTO "Direito" ("Direito_Nome","Direito_Area","Direito_Resumo","Direito_QuemPodeUsar",
 "Direito_Gratuidade","Direito_Abrangencia","Direito_OrgaoGestor","Direito_OrgaoExecutor",
 "Direito_BaseLegal","Direito_NaturezaNorma","Direito_Requisitos","Direito_CriterioRenda",
 "Direito_Documentos","Direito_ComoSolicitar","Direito_OndeSolicitar","Direito_LinkOficial",
 "Direito_ValidadeRenovacao","Direito_MotivosNegativa","Direito_ComoRecorrer","Direito_CanaisReclamacao",
 "Direito_Observacoes","Direito_Confianca","Direito_PoucoConhecido","Direito_DataVerificacao",
 "Direito_Status") VALUES
 ('ID Jovem — Identidade Jovem','CULTURA_ESPORTE_LAZER',
  'Documento digital gratuito que dá ao jovem de baixa renda meia-entrada em eventos e vagas gratuitas ou com desconto no transporte interestadual.',
  'Jovens de 15 a 29 anos, de famílias com renda de até 2 salários mínimos, inscritos no Cadastro Único.',
  'GRATUITO','FEDERAL','Secretaria Nacional de Juventude','App ID Jovem; empresas de transporte e bilheterias',
  'Lei nº 12.852/2013 (Estatuto da Juventude); Decreto nº 8.537/2015','LEI',
  'Idade entre 15 e 29 anos; Cadastro Único atualizado; renda familiar de até 2 salários mínimos.',
  'Renda familiar mensal total de até 2 salários mínimos.',
  'Apenas o NIS e dados pessoais — o documento é emitido na hora pelo app ou site.',
  'Emitir gratuitamente no app ID Jovem ou no site; no transporte interestadual, pedir o bilhete com antecedência ao embarque.',
  'App ID Jovem (Android/iOS); site oficial.',
  'https://www.gov.br/pt-br/servicos/obter-identidade-jovem-id-jovem',
  'Validade indicada no documento; reemissão imediata se os dados do Cadastro Único seguirem válidos.',
  'Cadastro Único desatualizado; dados divergentes.',
  'Atualizar o Cadastro Único no CRAS e reemitir.',
  'Ouvidoria da Secretaria Nacional de Juventude; ANTT (negativa de embarque) — Central 166.',
  'São 2 vagas gratuitas + 2 com 50% de desconto por veículo no transporte interestadual — regra da mesma família do benefício da pessoa idosa.',
  'CONFIRMADA',true,'2026-07-17','PUBLICADO');

-- 14. TFD
INSERT INTO "Direito" ("Direito_Nome","Direito_Area","Direito_Resumo","Direito_QuemPodeUsar",
 "Direito_Gratuidade","Direito_Abrangencia","Direito_OrgaoGestor","Direito_OrgaoExecutor",
 "Direito_BaseLegal","Direito_NaturezaNorma","Direito_Requisitos","Direito_Documentos",
 "Direito_ComoSolicitar","Direito_OndeSolicitar","Direito_LinkOficial","Direito_ValorCobertura",
 "Direito_MotivosNegativa","Direito_ComoRecorrer","Direito_CanaisReclamacao","Direito_Observacoes",
 "Direito_Confianca","Direito_PoucoConhecido","Direito_DataVerificacao","Direito_Status") VALUES
 ('Tratamento Fora de Domicílio (TFD)','SAUDE',
  'Quando o SUS não oferece o tratamento no seu município, o TFD custeia transporte e ajuda de custo para paciente (e acompanhante, quando indicado) tratar em outra cidade.',
  'Pacientes do SUS com indicação médica de tratamento eletivo indisponível no município de residência, esgotados os recursos locais.',
  'GRATUITO','FEDERAL','Ministério da Saúde (norma nacional)','Secretarias estaduais e municipais de saúde',
  'Portaria SAS/MS nº 55/1999','PORTARIA',
  'Laudo médico do SUS justificando; agendamento prévio no serviço de destino; distância mínima e demais critérios conforme a norma e regras estaduais.',
  'Laudo médico de referência do SUS; documentos pessoais; comprovante de residência.',
  'O médico do SUS preenche o laudo TFD; a secretaria de saúde processa, agenda e organiza o transporte.',
  'Setor de TFD da secretaria municipal ou estadual de saúde.',
  'https://www.gov.br/saude/pt-br/composicao/saes',
  'Passagens e diárias (ajuda de custo) nos valores da norma; acompanhante quando justificado clinicamente.',
  'Tratamento disponível no município; ausência de laudo ou de agendamento no destino.',
  'Revisão junto à secretaria de saúde; ouvidoria do SUS; em urgências, Defensoria Pública.',
  'Ouvidoria do SUS — Disque 136; Ministério Público (direito à saúde); Defensoria Pública.',
  'A operação (valores, fluxo, transporte sanitário) varia por estado e município — a norma federal fixa o piso do direito.',
  'CONFIRMADA_VARIACAO_LOCAL',true,'2026-07-17','PUBLICADO');

-- 15. Pé-de-Meia
INSERT INTO "Direito" ("Direito_Nome","Direito_Area","Direito_Resumo","Direito_QuemPodeUsar",
 "Direito_Gratuidade","Direito_Abrangencia","Direito_OrgaoGestor","Direito_OrgaoExecutor",
 "Direito_BaseLegal","Direito_NaturezaNorma","Direito_Requisitos","Direito_Documentos",
 "Direito_ComoSolicitar","Direito_OndeSolicitar","Direito_LinkOficial","Direito_ValorCobertura",
 "Direito_Automatico","Direito_MotivosNegativa","Direito_ComoRecorrer","Direito_CanaisReclamacao",
 "Direito_Observacoes","Direito_Confianca","Direito_DataVerificacao","Direito_Status") VALUES
 ('Pé-de-Meia — poupança do ensino médio','EDUCACAO',
  'Poupança mensal e depósitos por matrícula, frequência e conclusão para estudantes de baixa renda do ensino médio público, mais bônus por fazer o Enem.',
  'Estudantes de 14 a 24 anos do ensino médio público de famílias inscritas no Cadastro Único, conforme as faixas priorizadas na lei e regulamentos.',
  'GRATUITO','FEDERAL','Ministério da Educação','Caixa Econômica Federal (conta do estudante)',
  'Lei nº 14.818/2024','LEI',
  'Matrícula e frequência no ensino médio público; família no Cadastro Único; CPF regular.',
  'Nenhum pedido é necessário: a inclusão é automática pelo cruzamento censo escolar × Cadastro Único; o estudante só precisa autorizar a abertura da conta (menores: com responsável).',
  'Automático; acompanhar pelo app Jornada do Estudante e movimentar pela conta na Caixa.',
  'App Jornada do Estudante; app Caixa Tem.',
  'https://www.gov.br/mec/pt-br/pe-de-meia',
  'Parcelas de incentivo por matrícula, frequência, conclusão e Enem, nos valores fixados em regulamento — parte fica retida até a formatura.',
  true,
  'Cadastro Único desatualizado; frequência abaixo do exigido; dados divergentes entre escola e cadastro.',
  'Verificar pendências no app; corrigir o Cadastro Único no CRAS e os dados na secretaria da escola.',
  'Central 0800 616161 (MEC); ouvidoria do MEC.',
  'Receber o Pé-de-Meia não reduz o Bolsa Família da família — a lei exclui o incentivo do cálculo de renda.',
  'CONFIRMADA','2026-07-17','PUBLICADO');

-- 16. Salário-maternidade
INSERT INTO "Direito" ("Direito_Nome","Direito_Area","Direito_Resumo","Direito_QuemPodeUsar",
 "Direito_Gratuidade","Direito_Abrangencia","Direito_OrgaoGestor","Direito_OrgaoExecutor",
 "Direito_BaseLegal","Direito_NaturezaNorma","Direito_Requisitos","Direito_ExigeContribuicaoInss",
 "Direito_Documentos","Direito_ComoSolicitar","Direito_OndeSolicitar","Direito_LinkOficial",
 "Direito_ValorCobertura","Direito_Acumulacao","Direito_MotivosNegativa","Direito_ComoRecorrer",
 "Direito_CanaisReclamacao","Direito_Observacoes","Direito_Confianca","Direito_DataVerificacao",
 "Direito_Status") VALUES
 ('Salário-maternidade','PREVIDENCIA',
  'Renda mensal por 120 dias para quem se afasta por parto, adoção ou guarda judicial para adoção — inclui a trabalhadora rural e a segurada especial.',
  'Seguradas e segurados do INSS: empregadas, domésticas, MEI, contribuintes individuais e facultativas, seguradas especiais (rurais); em adoção, também o homem adotante.',
  'GRATUITO','FEDERAL','Ministério da Previdência Social','INSS (ou empregador, no caso da empregada)',
  'Lei nº 8.213/1991, arts. 71 a 73','LEI',
  'Qualidade de segurada na data do fato; carência de 10 contribuições para contribuinte individual/facultativa/MEI (empregada não tem carência); segurada especial comprova atividade rural.',
  true,
  'Certidão de nascimento ou termo de adoção/guarda; documentos pessoais; atestado médico no afastamento anterior ao parto.',
  'Empregada: direto com o empregador. Demais seguradas: pelo Meu INSS ou Central 135.',
  'Meu INSS (meu.inss.gov.br); Central 135.',
  'https://www.gov.br/inss/pt-br/direitos-e-deveres/salario-maternidade',
  '120 dias de renda conforme a categoria de filiação (a empregada recebe o salário integral).',
  'Não acumula com auxílio por incapacidade no mesmo período; desempregada em período de graça mantém o direito.',
  'Perda da qualidade de segurada; carência não cumprida; documentação de adoção incompleta.',
  'Recurso ao CRPS em 30 dias pelo Meu INSS; depois, Juizado Especial Federal.',
  'Ouvidoria do INSS — Central 135; Defensoria Pública da União.',
  'A segurada DESEMPREGADA pode ter direito se ainda estiver no "período de graça" — muita gente perde o benefício por não saber disso.',
  'CONFIRMADA','2026-07-17','PUBLICADO');

-- 17. Seguro-desemprego
INSERT INTO "Direito" ("Direito_Nome","Direito_Area","Direito_Resumo","Direito_QuemPodeUsar",
 "Direito_QuemNaoSeEnquadra","Direito_Gratuidade","Direito_Abrangencia","Direito_OrgaoGestor",
 "Direito_OrgaoExecutor","Direito_BaseLegal","Direito_NaturezaNorma","Direito_Requisitos",
 "Direito_Documentos","Direito_ComoSolicitar","Direito_OndeSolicitar","Direito_LinkOficial",
 "Direito_PrazoEstimado","Direito_ValorCobertura","Direito_Acumulacao","Direito_MotivosNegativa",
 "Direito_ComoRecorrer","Direito_CanaisReclamacao","Direito_Observacoes","Direito_Confianca",
 "Direito_DataVerificacao","Direito_Status") VALUES
 ('Seguro-desemprego','TRABALHO',
  'Parcelas mensais para o trabalhador formal demitido sem justa causa, enquanto procura recolocação. Há modalidades para doméstico, pescador artesanal e trabalhador resgatado.',
  'Trabalhador com carteira assinada dispensado sem justa causa que cumpra o tempo mínimo de trabalho da lei, sem renda própria e sem benefício previdenciário de prestação continuada.',
  'Pedido de demissão, demissão por justa causa e quem recebe aposentadoria não têm direito; acordo de demissão (art. 484-A da CLT) também não dá direito ao seguro.',
  'GRATUITO','FEDERAL','Ministério do Trabalho e Emprego','Rede SINE; app Carteira de Trabalho Digital; Caixa (pagamento)',
  'Lei nº 7.998/1990; CF, art. 7º, II','LEI',
  'Dispensa sem justa causa; tempo mínimo de trabalho conforme o número de solicitações anteriores; requerer entre o 7º e o 120º dia após a dispensa.',
  'Requerimento entregue na rescisão; documento de identidade; CPF; conta para depósito.',
  'Pelo app Carteira de Trabalho Digital, pelo gov.br ou presencialmente no SINE, do 7º ao 120º dia após a demissão.',
  'App Carteira de Trabalho Digital; portal gov.br; unidades do SINE.',
  'https://www.gov.br/pt-br/servicos/solicitar-o-seguro-desemprego',
  'Primeira parcela em cerca de 30 dias após a habilitação.',
  'De 3 a 5 parcelas conforme o histórico, calculadas sobre a média salarial pela fórmula legal — nunca abaixo do salário mínimo.',
  'Não acumula com aposentadoria nem com benefícios de prestação continuada da Previdência (exceto pensão por morte e auxílio-acidente); pode coexistir com Bolsa Família da família (a parcela entra no cálculo de renda).',
  'Prazo perdido (após 120 dias); vínculo/tempo insuficiente; renda própria identificada.',
  'Recurso administrativo pelo próprio app ou no SINE em até 2 anos.',
  'Central Alô Trabalho 158; ouvidoria do MTE; Defensoria Pública da União.',
  'Novo emprego formal durante o recebimento suspende as parcelas restantes.',
  'CONFIRMADA','2026-07-17','PUBLICADO');

-- 18. CIPTEA
INSERT INTO "Direito" ("Direito_Nome","Direito_Area","Direito_Resumo","Direito_QuemPodeUsar",
 "Direito_Gratuidade","Direito_Abrangencia","Direito_OrgaoGestor","Direito_OrgaoExecutor",
 "Direito_BaseLegal","Direito_NaturezaNorma","Direito_Requisitos","Direito_Documentos",
 "Direito_LaudoPericia","Direito_ComoSolicitar","Direito_OndeSolicitar","Direito_LinkOficial",
 "Direito_ValidadeRenovacao","Direito_CanaisReclamacao","Direito_Observacoes","Direito_Confianca",
 "Direito_PoucoConhecido","Direito_DataVerificacao","Direito_Status") VALUES
 ('CIPTEA — Carteira de Identificação da Pessoa com Transtorno do Espectro Autista','PESSOA_COM_DEFICIENCIA',
  'Documento gratuito que identifica a pessoa com TEA para garantir atendimento prioritário e acesso a políticas públicas, sem precisar apresentar laudo a cada atendimento.',
  'Pessoas com diagnóstico de transtorno do espectro autista, de qualquer idade.',
  'GRATUITO','FEDERAL','Ministério dos Direitos Humanos e da Cidadania (norma nacional)','Estados, DF e municípios (emissão)',
  'Lei nº 13.977/2020 (Lei Romeo Mion); Lei nº 12.764/2012','LEI',
  'Relatório médico com indicação do CID; documentos pessoais e do responsável legal, quando houver.',
  'Documento de identidade, CPF, foto, comprovante de residência e relatório médico com CID.',
  'Relatório médico simples com CID — a CIPTEA não exige perícia.',
  'Requerer no órgão estadual ou municipal responsável (varia: secretarias de assistência social, justiça ou da pessoa com deficiência); vários estados emitem online.',
  'Órgão emissor do estado ou município de residência.',
  'https://www.gov.br/mdh/pt-br/navegue-por-temas/pessoa-com-deficiencia',
  'Validade de 5 anos, com revalidação mantendo o número.',
  'Ouvidoria de Direitos Humanos — Disque 100; Ministério Público.',
  'A CIPTEA identifica; os benefícios (prioridade, gratuidades locais) decorrem das leis próprias. O uso do cordão de girassol é facultativo — não é requisito para atendimento prioritário. A pessoa com TEA é considerada pessoa com deficiência para todos os efeitos legais (Lei nº 12.764/2012, art. 1º, §2º).',
  'CONFIRMADA_VARIACAO_LOCAL',true,'2026-07-17','PUBLICADO');

-- 19. Isenção de IPI na compra de veículo (PcD/TEA)
INSERT INTO "Direito" ("Direito_Nome","Direito_Area","Direito_Resumo","Direito_QuemPodeUsar",
 "Direito_QuemNaoSeEnquadra","Direito_Gratuidade","Direito_Abrangencia","Direito_OrgaoGestor",
 "Direito_OrgaoExecutor","Direito_BaseLegal","Direito_NaturezaNorma","Direito_Requisitos",
 "Direito_Documentos","Direito_LaudoPericia","Direito_ComoSolicitar","Direito_OndeSolicitar",
 "Direito_LinkOficial","Direito_ValidadeRenovacao","Direito_MotivosNegativa","Direito_ComoRecorrer",
 "Direito_CanaisReclamacao","Direito_Observacoes","Direito_Confianca","Direito_DataVerificacao",
 "Direito_Status") VALUES
 ('Isenção de IPI na compra de veículo por pessoa com deficiência ou TEA','TRIBUTOS',
  'Pessoas com deficiência física, visual, auditiva, intelectual, mental ou TEA (condutoras ou não) podem comprar carro novo sem pagar IPI, dentro do limite de valor da lei.',
  'Pessoa com deficiência ou TEA, diretamente ou por representante legal (para não condutores).',
  'Veículos acima do teto de valor fixado em lei; nova isenção antes do intervalo legal entre compras.',
  'GRATUITO','FEDERAL','Receita Federal','Concessionárias (na venda); Receita Federal (habilitação)',
  'Lei nº 8.989/1995 e alterações','LEI',
  'Laudo que comprove a condição conforme os modelos aceitos; veículo novo nacional dentro do teto legal; respeitar o intervalo mínimo entre aquisições com isenção.',
  'Laudo médico/serviço credenciado; documentos pessoais; para condutores, CNH com as observações compatíveis.',
  'Laudo conforme regulamentação da Receita (serviços médicos credenciados pelo Detran também são aceitos para condutores).',
  'Pedido eletrônico no sistema da Receita Federal (Sisen) com o laudo; a autorização sai em nome do beneficiário e é levada à concessionária.',
  'Sistema Sisen (Receita Federal) — via gov.br.',
  'https://www.gov.br/pt-br/servicos/solicitar-isencao-de-ipi-na-aquisicao-de-veiculo-por-pessoa-com-deficiencia',
  'Isenção renovável a cada intervalo legal entre compras; a revenda antes do prazo mínimo exige recolher o imposto.',
  'Laudo fora do padrão; veículo acima do teto; intervalo entre compras não cumprido.',
  'Recurso administrativo no processo do Sisen.',
  'Ouvidoria da Receita Federal; Defensoria Pública da União.',
  'A isenção de ICMS e de IPVA é ESTADUAL: as regras (inclusive quais deficiências alcançam e tetos) variam por estado — verificar a Secretaria de Fazenda local. Teto de valor e prazos mudam por lei: confirme os vigentes.',
  'CONFIRMADA','2026-07-17','PUBLICADO');

-- 20. Auxílio-Inclusão
INSERT INTO "Direito" ("Direito_Nome","Direito_Area","Direito_Resumo","Direito_QuemPodeUsar",
 "Direito_Gratuidade","Direito_Abrangencia","Direito_OrgaoGestor","Direito_OrgaoExecutor",
 "Direito_BaseLegal","Direito_NaturezaNorma","Direito_Requisitos","Direito_CriterioRenda",
 "Direito_Documentos","Direito_ComoSolicitar","Direito_OndeSolicitar","Direito_LinkOficial",
 "Direito_ValorCobertura","Direito_Acumulacao","Direito_MotivosNegativa","Direito_ComoRecorrer",
 "Direito_CanaisReclamacao","Direito_Observacoes","Direito_Confianca","Direito_PoucoConhecido",
 "Direito_DataVerificacao","Direito_Status") VALUES
 ('Auxílio-Inclusão da pessoa com deficiência','TRABALHO',
  'Quem recebe BPC e consegue emprego formal não perde tudo: passa a receber o Auxílio-Inclusão (meio salário mínimo) junto com o salário, como incentivo à entrada no mercado de trabalho.',
  'Pessoa com deficiência que recebe o BPC (ou o recebeu nos últimos 5 anos) e inicia atividade remunerada com remuneração de até 2 salários mínimos.',
  'GRATUITO','FEDERAL','Ministério do Desenvolvimento e Assistência Social, Família e Combate à Fome','INSS',
  'Lei nº 8.742/1993, arts. 26-A a 26-C (incluídos pela Lei nº 14.176/2021)','LEI',
  'BPC ativo ou suspenso/cessado há menos de 5 anos por causa do trabalho; remuneração de até 2 salários mínimos; inscrição regular no Cadastro Único e no CPF.',
  'Remuneração mensal do vínculo de até 2 salários mínimos; renda familiar recalculada sem contar o próprio auxílio.',
  'Documentos pessoais; dados do vínculo de trabalho.',
  'Requerer pelo Meu INSS ou Central 135 após o início do vínculo.',
  'Meu INSS (meu.inss.gov.br); Central 135.',
  'https://www.gov.br/inss/pt-br/assuntos/auxilio-inclusao',
  'Meio salário mínimo mensal.',
  'Receber o Auxílio-Inclusão SUSPENDE o BPC (e o BPC pode ser retomado se o trabalho terminar). Não acumula com aposentadoria, pensão ou auxílio por incapacidade.',
  'Remuneração acima de 2 salários mínimos; BPC cessado há mais de 5 anos; cadastro irregular.',
  'Recurso ao CRPS em 30 dias pelo Meu INSS.',
  'Ouvidoria do INSS — Central 135; Defensoria Pública da União.',
  'É a ponte legal entre assistência e trabalho: perder o emprego permite voltar ao BPC sem novo pedido do zero (restabelecimento).',
  'CONFIRMADA',true,'2026-07-17','PUBLICADO');

-- ------------------------------------------------------------
-- Vínculos direito × público
-- ------------------------------------------------------------
INSERT INTO "DireitoPublico" ("DireitoPublico_DireitoId","DireitoPublico_PublicoId")
SELECT d."Direito_Id", p."PublicoAlvo_Id" FROM (VALUES
 (1,'toda-populacao'),
 (2,'familias-baixa-renda'),(2,'criancas'),(2,'gestantes'),
 (3,'idosos'),(3,'pcd'),(3,'familias-baixa-renda'),
 (4,'familias-baixa-renda'),(4,'povos-tradicionais'),
 (5,'toda-populacao'),(5,'pacientes'),(5,'idosos'),
 (6,'pcd'),(6,'familias-baixa-renda'),
 (7,'idosos'),(7,'pacientes'),
 (8,'trabalhadores-formais'),(8,'pacientes'),(8,'cuidadores'),
 (9,'toda-populacao'),(9,'familias-baixa-renda'),(9,'populacao-rua'),(9,'migrantes-refugiados'),
 (10,'familias-baixa-renda'),(10,'desempregados'),
 (11,'idosos'),
 (12,'estudantes'),(12,'idosos'),(12,'pcd'),(12,'jovens'),
 (13,'jovens'),(13,'familias-baixa-renda'),
 (14,'pacientes'),(14,'cuidadores'),
 (15,'estudantes'),(15,'adolescentes'),(15,'familias-baixa-renda'),
 (16,'gestantes'),(16,'mulheres'),(16,'trabalhadores-rurais'),
 (17,'trabalhadores-formais'),(17,'desempregados'),
 (18,'pcd'),(18,'criancas'),(18,'cuidadores'),
 (19,'pcd'),
 (20,'pcd'),(20,'trabalhadores-formais')
) v(direito, slug)
JOIN "Direito" d ON d."Direito_Id" = v.direito
JOIN "PublicoAlvo" p ON p."PublicoAlvo_Slug" = v.slug;

-- ------------------------------------------------------------
-- Vínculos direito × condição de saúde — SEMPRE com a nuance
-- que impede o automatismo (§4.8: doença ≠ incapacidade ≠ deficiência).
-- ------------------------------------------------------------
INSERT INTO "DireitoCondicao" ("DireitoCondicao_DireitoId","DireitoCondicao_CondicaoId","DireitoCondicao_Observacao")
SELECT d."Direito_Id", c."CondicaoSaude_Id", v.obs FROM (VALUES
 (7,'cancer','Rol taxativo da Lei 7.713/1988 — vale só para aposentadoria/pensão/reforma.'),
 (7,'cardiopatia-grave','Exige caracterização de gravidade em laudo oficial.'),
 (7,'nefropatia-grave','Exige caracterização de gravidade em laudo oficial.'),
 (7,'parkinson','Rol taxativo — laudo oficial na via administrativa.'),
 (7,'esclerose-multipla','Rol taxativo — laudo oficial na via administrativa.'),
 (7,'ela','Consta como paralisia irreversível/incapacitante ou pela própria doença conforme laudo.'),
 (7,'alzheimer','Enquadra-se como alienação mental, conforme laudo.'),
 (7,'hiv','Rol taxativo — laudo oficial na via administrativa.'),
 (7,'hanseniase','Rol taxativo — laudo oficial na via administrativa.'),
 (7,'tuberculose-ativa','Somente tuberculose ATIVA.'),
 (7,'cegueira','Inclui visão monocular (Súmula 377/STJ) — origem jurisprudencial.'),
 (7,'visao-monocular','Equiparação por jurisprudência consolidada (Súmula 377/STJ) e Lei 14.126/2021.'),
 (8,'cancer','Saque pelo titular OU quando o dependente é o acometido.'),
 (8,'hiv','Saque pelo titular OU quando o dependente é o acometido.'),
 (3,'tea','TEA é deficiência por força de lei (12.764/2012), mas o BPC ainda exige avaliação biopsicossocial e renda.'),
 (3,'sindrome-down','Deficiência reconhecida; BPC exige avaliação biopsicossocial e critério de renda.'),
 (3,'paralisia-cerebral','BPC exige avaliação biopsicossocial e critério de renda.'),
 (6,'deficiencia-fisica','Passe Livre exige também renda familiar per capita até 1 salário mínimo.'),
 (6,'deficiencia-auditiva','Passe Livre exige também critério de renda.'),
 (6,'deficiencia-visual','Passe Livre exige também critério de renda.'),
 (6,'deficiencia-intelectual','Passe Livre exige também critério de renda.'),
 (6,'tea','TEA equiparado a deficiência (Lei 12.764/2012).'),
 (18,'tea','Documento de identificação — não gera benefício financeiro por si.'),
 (19,'tea','Isenção de IPI inclui TEA desde a Lei 8.989/1995 alterada; condutor ou não condutor.'),
 (19,'deficiencia-fisica','Verificar enquadramento do laudo nos modelos da Receita.'),
 (19,'deficiencia-visual','Verificar enquadramento do laudo nos modelos da Receita.'),
 (19,'deficiencia-intelectual','Aquisição por meio de representante legal (não condutor).'),
 (19,'visao-monocular','Reconhecida como deficiência sensorial visual (Lei 14.126/2021).'),
 (20,'deficiencia-fisica','Exige BPC ativo/recente e remuneração até 2 SM.'),
 (20,'tea','Exige BPC ativo/recente e remuneração até 2 SM.')
) v(direito, slug, obs)
JOIN "Direito" d ON d."Direito_Id" = v.direito
JOIN "CondicaoSaude" c ON c."CondicaoSaude_Slug" = v.slug;

-- ------------------------------------------------------------
-- Regras determinísticas do "Descubra seus direitos" (§8).
-- RENDA_LIMITE / PERICIA / CONDICAO_ESPECIFICA são SEMPRE
-- AVALIACAO (F4-RG-06): o motor não decide renda nem laudo.
-- ------------------------------------------------------------
INSERT INTO "RegraElegibilidade"
 ("RegraElegibilidade_DireitoId","RegraElegibilidade_Fator","RegraElegibilidade_ValorNumerico",
  "RegraElegibilidade_Efeito","RegraElegibilidade_Descricao") VALUES
 -- 2. Bolsa Família
 (2,'CADUNICO',NULL,'REQUISITO','Inscrição atualizada no Cadastro Único.'),
 (2,'RENDA_LIMITE',NULL,'AVALIACAO','Renda familiar por pessoa dentro do limite de pobreza vigente (Lei 14.601/2023) — confirmar o valor atual.'),
 -- 3. BPC
 (3,'CADUNICO',NULL,'REQUISITO','Inscrição no Cadastro Único é pré-requisito do BPC.'),
 (3,'RENDA_LIMITE',NULL,'AVALIACAO','Renda familiar por pessoa até 1/4 do salário mínimo (LOAS art. 20 §3º), com hipóteses de flexibilização.'),
 (3,'PERICIA',NULL,'AVALIACAO','Idade 65+ OU deficiência confirmada em avaliação biopsicossocial do INSS.'),
 -- 4. Tarifa Social
 (4,'CADUNICO',NULL,'REQUISITO','Concessão automática a partir do Cadastro Único (Lei 14.203/2021).'),
 (4,'RENDA_LIMITE',NULL,'AVALIACAO','Renda por pessoa até 1/2 salário mínimo, ou recebimento de BPC.'),
 -- 6. Passe Livre PcD
 (6,'DEFICIENCIA',NULL,'REQUISITO','Destinado à pessoa com deficiência (Lei 8.899/1994).'),
 (6,'RENDA_LIMITE',NULL,'AVALIACAO','Renda familiar por pessoa até 1 salário mínimo.'),
 -- 7. Isenção IR doença grave
 (7,'DOENCA_GRAVE',NULL,'REQUISITO','Doença do rol da Lei 7.713/1988, art. 6º, XIV.'),
 (7,'PERICIA',NULL,'AVALIACAO','Laudo de serviço médico oficial identificando a doença do rol.'),
 (7,'CONDICAO_ESPECIFICA',NULL,'AVALIACAO','Só alcança proventos de aposentadoria, pensão ou reforma.'),
 -- 8. Saque FGTS doença grave
 (8,'DOENCA_GRAVE',NULL,'REQUISITO','Neoplasia maligna, HIV/aids ou estágio terminal (titular ou dependente).'),
 (8,'CONDICAO_ESPECIFICA',NULL,'AVALIACAO','É preciso haver saldo em conta vinculada do FGTS.'),
 -- 9. Justiça gratuita
 (9,'RENDA_LIMITE',NULL,'AVALIACAO','Declaração de insuficiência de recursos; critério de atendimento varia por Defensoria.'),
 -- 10. Isenção taxa concurso
 (10,'CADUNICO',NULL,'REQUISITO','Família de baixa renda inscrita no Cadastro Único (ou doador de medula óssea).'),
 -- 11. Gratuidade interestadual idoso
 (11,'IDADE_MIN',60,'REQUISITO','A partir de 60 anos (Estatuto da Pessoa Idosa, art. 40).'),
 (11,'RENDA_LIMITE',NULL,'AVALIACAO','Renda individual igual ou inferior a 2 salários mínimos.'),
 -- 12. Meia-entrada
 (12,'CONDICAO_ESPECIFICA',NULL,'AVALIACAO','Pertencer a um dos grupos legais: estudante com CIE, pessoa 60+, pessoa com deficiência (e acompanhante quando necessário) ou jovem de baixa renda com ID Jovem.'),
 -- 13. ID Jovem
 (13,'IDADE_MIN',15,'REQUISITO','Idade mínima de 15 anos.'),
 (13,'IDADE_MAX',29,'REQUISITO','Idade máxima de 29 anos.'),
 (13,'CADUNICO',NULL,'REQUISITO','Inscrição no Cadastro Único.'),
 (13,'RENDA_LIMITE',NULL,'AVALIACAO','Renda familiar total de até 2 salários mínimos.'),
 -- 14. TFD
 (14,'CONDICAO_ESPECIFICA',NULL,'AVALIACAO','Indicação médica do SUS de tratamento indisponível no município, esgotados os recursos locais.'),
 -- 15. Pé-de-Meia
 (15,'ESTUDANTE',NULL,'REQUISITO','Matrícula no ensino médio público com frequência mínima.'),
 (15,'CADUNICO',NULL,'REQUISITO','Família inscrita no Cadastro Único.'),
 (15,'IDADE_MIN',14,'REQUISITO','Idade mínima de 14 anos.'),
 (15,'IDADE_MAX',24,'REQUISITO','Idade máxima de 24 anos.'),
 -- 16. Salário-maternidade
 (16,'GESTANTE',NULL,'REQUISITO','Parto, adoção ou guarda judicial para fins de adoção.'),
 (16,'CONTRIBUINTE_INSS',NULL,'REQUISITO','Qualidade de segurada do INSS na data do fato (inclui período de graça).'),
 (16,'CONDICAO_ESPECIFICA',NULL,'AVALIACAO','Carência de 10 contribuições para contribuinte individual/facultativa/MEI; empregada não tem carência; segurada especial comprova atividade rural.'),
 -- 17. Seguro-desemprego
 (17,'DESEMPREGADO',NULL,'REQUISITO','Dispensa sem justa causa.'),
 (17,'CONDICAO_ESPECIFICA',NULL,'AVALIACAO','Tempo mínimo de vínculo conforme o número de solicitações anteriores; pedido entre o 7º e o 120º dia.'),
 -- 18. CIPTEA
 (18,'CONDICAO_ESPECIFICA',NULL,'AVALIACAO','Diagnóstico de TEA em relatório médico com CID; emissão pelo órgão estadual/municipal.'),
 -- 19. Isenção IPI
 (19,'DEFICIENCIA',NULL,'REQUISITO','Pessoa com deficiência ou TEA (condutora ou não).'),
 (19,'PERICIA',NULL,'AVALIACAO','Laudo conforme os modelos aceitos pela Receita Federal.'),
 (19,'CONDICAO_ESPECIFICA',NULL,'AVALIACAO','Veículo novo dentro do teto legal e intervalo mínimo entre compras com isenção.'),
 -- 20. Auxílio-Inclusão
 (20,'DEFICIENCIA',NULL,'REQUISITO','Pessoa com deficiência beneficiária do BPC.'),
 (20,'TRABALHADOR_FORMAL',NULL,'REQUISITO','Início de atividade remunerada formal.'),
 (20,'CONDICAO_ESPECIFICA',NULL,'AVALIACAO','BPC ativo ou cessado há menos de 5 anos; remuneração até 2 salários mínimos.');

-- ------------------------------------------------------------
-- Incompatibilidades (não acumulação) — §1 do prompt mestre
-- ------------------------------------------------------------
INSERT INTO "IncompatibilidadeBeneficio"
 ("IncompatibilidadeBeneficio_DireitoA","IncompatibilidadeBeneficio_DireitoB","IncompatibilidadeBeneficio_Descricao") VALUES
 (3,20,'Receber o Auxílio-Inclusão suspende o BPC (Lei 14.176/2021); o BPC pode ser restabelecido se o trabalho terminar.'),
 (3,16,'O BPC não acumula com benefícios previdenciários como o salário-maternidade (LOAS, art. 20, §4º) — salvo assistência médica e prestações indenizatórias.'),
 (17,3,'O seguro-desemprego não é devido a quem recebe benefício de prestação continuada da assistência ou previdência, exceto pensão por morte e auxílio-acidente (Lei 7.998/1990).');
