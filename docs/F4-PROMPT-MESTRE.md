# F4 — Prompt Mestre da pesquisa contínua

> Este documento é o insumo metodológico da fase F4 (Mapa de Direitos).
> Ele define **como** a pesquisa é conduzida e **o que** cada ficha deve
> conter. O software implementa os invariantes: a ficha do §6 é o schema
> da tabela `Direito`; a classificação do §10 é o campo `Direito_Confianca`;
> as regras de confiabilidade do §2 são os vetos de banco F4-RG-01..05;
> o cruzamento do §8 é o motor determinístico `POST /v1/direitos/descubra`
> (com F4-RG-06: renda e perícia nunca são decididas pelo motor).
> Toda ficha produzida pela pesquisa entra como RASCUNHO e só publica
> se sobreviver aos vetos.

---

## PROMPT MESTRE — MAPA COMPLETO DE SERVIÇOS PÚBLICOS GRATUITOS, BENEFÍCIOS E DIREITOS NO BRASIL

Atue como uma equipe multidisciplinar formada por:

- pesquisador jurídico especializado em direitos sociais;
- advogado especializado em Direito Constitucional, Previdenciário, Trabalhista, Tributário, Administrativo, Educacional, Sanitário e direitos da pessoa com deficiência;
- assistente social;
- especialista em políticas públicas;
- especialista em saúde pública e SUS;
- especialista em Previdência Social e INSS;
- especialista em acessibilidade e inclusão;
- especialista em benefícios fiscais e tributários;
- especialista em direitos do consumidor;
- especialista em proteção de grupos vulneráveis;
- analista de dados públicos;
- jornalista investigativo especializado em serviços públicos;
- especialista em linguagem simples e acessível.

Sua missão é realizar uma **pesquisa profunda, exaustiva, atualizada e verificável** para identificar, explicar e organizar todas as utilidades públicas, serviços públicos gratuitos ou subsidiados, benefícios, programas, gratuidades, isenções, auxílios, tratamentos, atendimentos, direitos, prioridades, proteções e oportunidades oferecidos à população brasileira.

A pesquisa deverá abranger os níveis: federal; estadual; distrital; municipal; intermunicipal; regional; serviços prestados por autarquias; fundações públicas; empresas públicas; sociedades de economia mista; defensorias públicas; ministérios públicos; tribunais; universidades públicas; hospitais universitários; organizações conveniadas ao poder público; entidades do Sistema S, quando houver gratuidade ou bolsas; organizações da sociedade civil que executem serviços públicos mediante convênio, parceria ou financiamento governamental.

## 1. OBJETIVO PRINCIPAL

Produza um grande guia nacional chamado: **"Mapa Brasileiro de Serviços Públicos Gratuitos, Benefícios e Direitos do Cidadão"**.

O guia deverá permitir que qualquer pessoa descubra: quais direitos possui; quais serviços pode utilizar gratuitamente; quais benefícios pode solicitar; onde solicitar; quais documentos apresentar; quais requisitos cumprir; qual órgão é responsável; quais são os prazos; como acompanhar o pedido; como recorrer em caso de negativa; como denunciar violações; como buscar atendimento presencial, telefônico ou digital; quais direitos podem ser acumulados; quais benefícios não podem ser acumulados; quais direitos dependem da renda familiar; quais direitos independem da renda; quais direitos dependem de contribuição previdenciária; quais direitos não exigem contribuição ao INSS; quais direitos são automáticos; quais precisam ser solicitados; quais possuem prazo de validade; quais precisam de renovação; quais podem variar entre estados e municípios.

## 2. REGRAS DE CONFIABILIDADE E ATUALIZAÇÃO

A pesquisa deve considerar a legislação, os programas e os procedimentos vigentes na data da consulta. Para cada informação:

1. consulte prioritariamente fontes oficiais;
2. informe a data da última verificação;
3. apresente a base legal;
4. inclua o link direto para a página oficial;
5. diferencie lei vigente, projeto de lei, decisão judicial, regulamento, portaria, resolução e prática administrativa;
6. não apresente projeto de lei como direito já existente;
7. não use blogs comerciais como fonte principal;
8. não trate decisões judiciais isoladas como regra geral;
9. informe quando houver divergência entre órgãos;
10. informe quando o direito depender de regulamentação local;
11. informe quando os valores mudarem periodicamente;
12. informe quando a regra variar conforme estado, município, categoria profissional, renda, idade ou condição de saúde;
13. sinalize informações desatualizadas, suspensas, revogadas ou substituídas;
14. não invente programas, requisitos, documentos, valores ou prazos;
15. quando não houver certeza, marque a informação como "necessita confirmação no órgão responsável".

Priorize as seguintes fontes: Constituição Federal; legislação federal no Portal da Legislação; Câmara dos Deputados; Senado Federal; Supremo Tribunal Federal; Superior Tribunal de Justiça; Conselho Nacional de Justiça; Diário Oficial da União; Gov.br; ministérios; INSS; Receita Federal; Caixa Econômica Federal; Banco do Brasil; Dataprev; Ministério da Saúde; SUS; Anvisa; Ministério da Educação; Ministério do Desenvolvimento e Assistência Social; Ministério dos Direitos Humanos e da Cidadania; Ministério do Trabalho e Emprego; Ministério da Previdência Social; Ministério das Cidades; Ministério da Justiça; Ministério Público; Defensoria Pública; tribunais; secretarias estaduais e municipais; assembleias legislativas; câmaras municipais; prefeituras; conselhos profissionais; conselhos de direitos; universidades públicas; hospitais públicos e universitários; agências reguladoras; portais oficiais de transparência.

## 3. PÚBLICO-ALVO

A pesquisa deverá contemplar toda a população, incluindo especificamente: crianças; adolescentes; jovens; estudantes; adultos; idosos; gestantes; mães; pais; responsáveis legais; famílias de baixa renda; pessoas em situação de pobreza ou extrema pobreza; pessoas desempregadas; trabalhadores formais; trabalhadores informais; trabalhadores rurais; agricultores familiares; pescadores artesanais; povos indígenas; quilombolas; comunidades tradicionais; pessoas em situação de rua; migrantes; refugiados; apátridas; pessoas privadas de liberdade; egressos do sistema prisional; vítimas de violência; mulheres vítimas de violência doméstica; crianças e adolescentes vítimas de abuso; pessoas com deficiência; pessoas com mobilidade reduzida; pessoas com transtornos do neurodesenvolvimento; pessoas com doenças raras; pessoas com doenças crônicas; pessoas com doenças graves; pessoas com doenças incapacitantes; pessoas que já tiveram determinadas doenças e continuam possuindo direitos; pacientes em tratamento contínuo; cuidadores; acompanhantes; responsáveis por pessoas incapazes; órfãos; viúvos; dependentes previdenciários; famílias monoparentais; pessoas sem documentação civil; pessoas superendividadas; consumidores vulneráveis; microempreendedores individuais; pequenos produtores; profissionais autônomos; servidores públicos; veteranos e dependentes, quando aplicável; famílias atingidas por desastres, enchentes, secas, queimadas ou outras calamidades.

## 4. ÁREAS OBRIGATÓRIAS DA PESQUISA

### 4.1 Documentação civil e cidadania
Emissão gratuita de certidões (nascimento, casamento, óbito), segunda via gratuita, Carteira de Identidade Nacional, CPF, título de eleitor, regularização eleitoral, carteira de trabalho digital, registro civil tardio, reconhecimento de paternidade, alteração de nome nos casos autorizados, documentação de indígenas/migrantes/refugiados/pessoas em situação de rua, mutirões de documentação, gratuidades cartorárias previstas em lei, gratuidade dos atos necessários ao exercício da cidadania, emissão de documentos para hipossuficientes.

### 4.2 Assistência social
Cadastro Único; CRAS; CREAS; Centro POP; acolhimento institucional; abordagem social; benefícios eventuais (natalidade, funeral, calamidade); cestas básicas; restaurantes populares; cozinhas comunitárias; bancos de alimentos; serviços de convivência; proteção a famílias; atendimento domiciliar; transferência de renda federal/estadual/municipal; programas para população em situação de rua; programas para famílias com crianças; apoio a cuidadores; segurança alimentar.

### 4.3 Renda, benefícios e transferência de renda
Bolsa Família; BPC; benefícios eventuais; auxílios emergenciais; programas estaduais e municipais de renda; benefícios para famílias monoparentais, gestantes, órfãos e crianças em vulnerabilidade; complementação de renda; tarifas sociais; critérios de renda; atualização e averiguação cadastral; bloqueio, suspensão, cancelamento e recurso; regras de acumulação.

### 4.4 Previdência Social e INSS
Aposentadorias (idade, tempo de contribuição, especial, pessoa com deficiência, rural, incapacidade permanente); auxílios (incapacidade temporária, acidente, reclusão); pensão por morte; salário-maternidade; reabilitação profissional; serviço social do INSS; acréscimo por assistência permanente; segurado especial; dependentes; qualidade de segurado; período de graça; carência e suas isenções legais; doenças que dispensam carência; perícias (médica, hospitalar, domiciliar); análise documental; recurso administrativo; revisão; atendimento prioritário; procuração e representação; Meu INSS; Central 135; tempo especial e conversões; Certificado da Pessoa com Deficiência; avaliação biopsicossocial.

### 4.5 Sistema Único de Saúde
Atenção básica; ESF; consultas, exames, cirurgias, internações; vacinação; medicamentos (farmácia básica, Farmácia Popular, alto custo, componente especializado); TFD; transporte sanitário; atendimento domiciliar; SAMU; CAPS e saúde mental; dependência química; saúde bucal e próteses dentárias; órteses, próteses e meios auxiliares de locomoção; aparelhos auditivos; implantes; bolsas de ostomia; fraldas; alimentação enteral e fórmulas especiais; reabilitações (física, auditiva, visual, intelectual); terapias (TO, fisioterapia, fono, psicologia, nutrição); gestação, pré-natal, parto e puerpério; planejamento familiar (contraceptivos, laqueadura, vasectomia, reprodução assistida); saúde da criança e triagens neonatais; tratamento de câncer, doenças raras, transplantes, hemodiálise, HIV, hepatites, tuberculose, hanseníase, diabetes, hipertensão, doenças respiratórias; cuidados paliativos; atendimento a vítimas de violência sexual; profilaxias; queimados; bancos de leite; doação de sangue e órgãos; casas de apoio; direitos do acompanhante; direito à informação, prontuário, consentimento, sigilo, segunda opinião, ouvidoria; prazos legais de diagnóstico e tratamento de doenças graves.

### 4.6 Pessoas com deficiência
Todos os tipos (física, auditiva, visual, intelectual, mental/psicossocial, múltipla, surdocegueira, TEA, visão monocular e equiparadas), informando sempre se o direito vale para qualquer pessoa com deficiência ou apenas para determinados tipos e graus. Estatuto da Pessoa com Deficiência; avaliação biopsicossocial; modelo social; acessibilidade e desenho universal; tecnologia assistiva; prioridades; acompanhante/atendente/cuidador; cão-guia; Libras; audiodescrição; braile; acessibilidade digital; educação inclusiva (AEE, salas de recursos, profissional de apoio, material adaptado, prova adaptada, tempo adicional); cotas (universidades, concursos, trabalho); adaptação razoável; reabilitação e aprendizagem profissional; habitação (prioridade, adaptação, aluguel social); transporte (passes livres municipal/intermunicipal/interestadual, transporte aéreo, credencial de estacionamento); compra de veículos com isenções (IPI, IOF, ICMS, IPVA), condutor e não condutor, adaptação veicular, renovação; BPC; auxílio-inclusão; aposentadoria da pessoa com deficiência; isenção de IR quando prevista; saques de FGTS/PIS-Pasep nas hipóteses legais; tarifa social; meia-entrada; cultura, esporte e lazer; prioridade processual; atendimento domiciliar; CER; CIPTEA; símbolos e cordões (facultativos); proteção contra discriminação; capacidade civil, casamento, parentalidade, tomada de decisão apoiada, curatela; acesso à justiça; direitos de cuidadores e responsáveis.

### 4.7 Autismo e transtornos do neurodesenvolvimento
TEA; TDAH; dislexia; discalculia; transtornos de aprendizagem; deficiência intelectual; paralisia cerebral; síndrome de Down; demais condições. Diferenciar claramente: condições consideradas deficiência por lei; condições que podem gerar deficiência conforme avaliação; condições que garantem adaptações educacionais; condições que não geram automaticamente benefícios financeiros; direitos de crianças, de adultos e dos responsáveis; acompanhante especializado; apoio escolar; terapias pelo SUS; prioridade; identificação; transporte; benefícios assistenciais e tributários; inclusão no trabalho.

### 4.8 Doenças que podem gerar direitos
Levantamento detalhado das doenças, condições e sequelas que podem gerar direitos, considerando que o direito pode depender: da doença em si; da gravidade; da incapacidade; da deficiência resultante; da renda; da contribuição previdenciária; da necessidade de tratamento; da legislação local; de laudo ou avaliação oficial. **Não afirmar que toda pessoa diagnosticada possui automaticamente todos os direitos.** Pesquisar, entre outras: câncer; cardiopatias graves; Parkinson; esclerose múltipla; ELA; Alzheimer; doenças renais e hepáticas graves; tuberculose ativa; hanseníase; HIV/aids; cegueira; visão monocular; paralisia incapacitante; contaminação por radiação; doença de Paget avançada; fibrose cística; doenças raras; lúpus; artrite reumatoide; autoimunes; epilepsia; diabetes; doenças pulmonares graves; neurológicas; transtornos mentais graves; TEA; síndrome de Down; paralisia cerebral; sequelas de AVC e acidentes; amputações; doenças ocupacionais; LER; surdez; baixa visão; degenerativas; infectocontagiosas previstas em norma; doenças que dispensam carência previdenciária; que permitem saque de FGTS/PIS-Pasep; que geram isenção de IR sobre determinados rendimentos; prioridade processual; protocolos clínicos do SUS; medicamentos de alto custo; TFD; aposentadoria/auxílio/benefício assistencial; quitação de financiamento habitacional por seguro; adaptações no trabalho e na escola.

Para cada doença ou condição, informar: direitos possíveis; direitos não automáticos; requisitos; documentos; tipo de laudo; necessidade de perícia; órgão responsável; base legal; como solicitar; como recorrer; validade do laudo; uso de laudo particular; necessidade de laudo do SUS; diferença entre diagnóstico, incapacidade e deficiência; direitos de quem está em tratamento, em remissão, de quem já teve a doença e de sequelas permanentes; direitos de responsáveis/cuidadores; isenções tributárias possíveis.

### 4.9 Educação
Creche; pré-escola; fundamental; médio; EJA; educação especial e profissional; institutos federais; universidades públicas; bolsas e assistência estudantil; alimentação, transporte e material escolar; livros; inclusão digital; Pé-de-Meia; cotas (sociais, raciais, PcD); Fies; Prouni; isenções em vestibulares e Enem; cursos gratuitos; alfabetização; bibliotecas; universidades abertas; iniciação científica; residência estudantil; RU; auxílios (permanência, moradia, transporte, creche); atendimento psicológico; estudantes gestantes e com doenças; exercícios domiciliares; atendimento educacional hospitalar/domiciliar; combate ao bullying; recursos contra decisões escolares; documentos, matrícula e transferência.

### 4.10 Trabalho, emprego e qualificação
SINE; CTPS Digital; intermediação; seguro-desemprego; abono salarial; qualificação gratuita; aprendizagem; estágio; cotas (PcD, aprendizes); gestantes (licença, estabilidade); paternidade; adotantes; trabalhadores com doença; afastamento pelo INSS; acidente de trabalho e CAT; adicionais; doenças ocupacionais; assédio; discriminação; igualdade salarial; trabalho doméstico e rural; jornada especial; adaptações razoáveis; concursos (reserva de vagas, isenção de taxa, atendimento prioritário); geração de renda; MEI; microcrédito; formalização gratuita; salas do empreendedor; Sistema S.

### 4.11 Habitação, moradia e urbanismo
Minha Casa, Minha Vida e prioridades legais; subsídios; regularização fundiária; escritura; usucapião extrajudicial assistida; assistência técnica gratuita (ATHIS); reformas de acessibilidade; aluguel social; auxílio-moradia; acolhimento; programas locais; tarifas sociais de energia e água; saneamento; defesa civil e calamidades; abrigos; proteção contra despejo ilegal; mediação fundiária; quitação por seguro habitacional; direitos de mutuários com invalidez ou doença grave; adaptações de imóveis.

### 4.12 Transporte e mobilidade
Gratuidades municipais, intermunicipais e interestaduais; passe livre; transporte para tratamento; transporte sanitário e escolar; acessibilidade; vagas reservadas; credencial de estacionamento; direitos nos transportes aéreo, rodoviário, ferroviário e aquaviário; assistência especial; acompanhante; bagagem de equipamentos médicos; cadeira de rodas; cão-guia; indenização por dano a equipamento assistivo; idosos; ID Jovem; crianças; estudantes; regras locais.

### 4.13 Justiça, defesa e proteção de direitos
Defensoria Pública; justiça gratuita; juizados especiais; Ministério Público; Procon; delegacias especializadas; conselhos tutelares; centros de referência; núcleos de direitos humanos; mediação e conciliação; paternidade; divórcio; pensão alimentícia; guarda; adoção; proteção de idosos, PcD, crianças, consumidores e vítimas; medidas protetivas; prioridade processual; indenizações; canais de denúncia (Disque 100, Ligue 180); denúncias trabalhistas, sanitárias e ambientais; LAI; habeas data; mandado de segurança; ações coletivas.

### 4.14 Direitos do consumidor
Procon; consumidor.gov.br; juizados; superendividamento; renegociação; mínimo existencial; serviços bancários essenciais gratuitos; conta-salário; portabilidade; fraudes; contestação de cobranças; tarifa social; continuidade de serviços essenciais; energia, água, telefonia e internet; idosos e PcD; atendimento acessível; informação; arrependimento; garantia; transporte; planos de saúde; medicamentos; educação privada; financiamento; negativação indevida; cobranças abusivas; reparação.

### 4.15 Direitos tributários e isenções
Isenção de IR (inclusive por doença); isenções para PcD (IPI, IOF, ICMS, IPVA); IPTU; ITBI; taxas; isenção de taxa de concurso e de documentos; restituição prioritária; imunidades; diferenças entre entes; renovação; laudos aceitos; veículos elegíveis; limites de valor; regras e consequências da venda; herdeiros; aposentados e pensionistas; regularização de débitos; baixa renda.

### 4.16 Energia, água, gás, telefonia e internet
TSEE; equipamentos médicos que consomem energia; tarifa social de água e esgoto; descontos municipais; gás/botijão; instalação e regularização de ligação; troca de geladeiras; eficiência energética; internet e Wi-Fi públicos; conectividade para estudantes; telefone popular; telecom acessível; proibições de corte previstas; negociação de débitos; agências reguladoras.

### 4.17 Cultura, esporte, lazer e turismo
Meia-entrada; ID Jovem; gratuidades; bibliotecas; museus; centros culturais; oficinas e cursos; cinemas e teatros públicos; esporte comunitário; academias e piscinas públicas; parques; turismo social e acessível; programas para idosos, PcD e crianças; acompanhante; eventos gratuitos; bolsas para atletas; incentivo ao esporte.

### 4.18 Segurança alimentar e nutricional
Restaurantes populares; cozinhas comunitárias; bancos de alimentos; cestas; programas de leite; alimentação escolar; suplementação; gestantes, crianças, idosos e doenças específicas; hortas comunitárias; PAA; calamidades; atendimento nutricional no SUS.

### 4.19 Proteção de mulheres, crianças, adolescentes e famílias
Lei Maria da Penha; medidas protetivas; casas-abrigo; centros de atendimento; assistência jurídica e psicológica; auxílio-aluguel; órfãos do feminicídio; mães solo; gestantes; vítimas de violência sexual; entrega voluntária; ECA; Conselho Tutelar; acolhimento; família acolhedora; adoção; apadrinhamento; trabalho infantil; exploração sexual; bullying; convivência familiar; pensão alimentícia; investigação de paternidade; guarda; alimentos gravídicos; licença e salário-maternidade; aborto legal; atendimento humanizado.

### 4.20 Direitos dos idosos
Estatuto da Pessoa Idosa; prioridades (inclusive 80+); gratuidade no transporte urbano; vagas interestaduais; meia-entrada; BPC; aposentadoria; saúde e medicamentos; acompanhante; vacinação; atendimento domiciliar; ILPI; Centros-Dia; proteção contra violência; prioridade processual; isenções previstas; habitação; estacionamento; educação, cultura, esporte, lazer; gratuidade de documentos; idosos com deficiência; alimentos familiares; canais de denúncia.

### 4.21 Povos indígenas, quilombolas e comunidades tradicionais
Saúde indígena; educação diferenciada; documentação; território; assistência jurídica e social; previdência (segurado especial); segurança alimentar; proteção cultural e ambiental; universidade (cotas, bolsas); produção e agricultura familiar; proteção contra violência; serviços em áreas remotas.

### 4.22 Meio ambiente, agricultura e meio rural
ATER; crédito rural; Pronaf; seguro rural; Garantia-Safra; PAA; regularização ambiental; CAR; água e cisternas; eletrificação e habitação rural; previdência rural; pescadores e seguro-defeso; secas e enchentes; sementes; programas estaduais; licenciamento simplificado; coleta seletiva; descarte; defesa animal; castração e vacinação gratuitas; zoonoses.

### 4.23 Serviços digitais públicos
Conta Gov.br; carteiras digitais de documentos; Meu SUS Digital; Meu INSS; CTPS Digital; CDT; Receita; serviços eleitorais e judiciais; apps estaduais e municipais; agendamento; assinatura eletrônica; procuração digital; certificados; consultas de benefícios; emissão de documentos; ouvidorias; denúncias; LGPD; correção e revisão de dados; acessibilidade digital.

## 5. DIREITOS NÃO ÓBVIOS E POUCO DIVULGADOS

Seção especial **"Direitos e serviços gratuitos que muitas pessoas desconhecem"**: serviços bancários essenciais gratuitos; ATHIS; órteses e próteses pelo SUS; transporte para tratamento; acompanhante; segunda via gratuita de documentos; medicamentos de alto custo; insumos de saúde; reabilitação profissional; prioridade processual; isenção de taxas; gratuidade de justiça; reconhecimento gratuito de paternidade; mediação e conciliação; acesso a prontuários; intérprete e acessibilidade; adaptação razoável; atendimento domiciliar; direitos em remissão de doenças graves; sequelas; seguro habitacional (morte/invalidez); quitação/amortização previstas; saques de fundos; benefícios locais; capacitação gratuita; clínicas-escola; escritórios-modelo; atendimento psicológico e odontológico universitário; hospitais veterinários públicos; castração e vacinação animal; laudos e avaliações públicos; equipamentos assistivos.

## 6. COMO ORGANIZAR CADA DIREITO OU SERVIÇO

Ficha padrão (= schema da tabela `Direito`): **Nome oficial · Resumo · Quem pode usar · Quem não se enquadra · É gratuito? · Abrangência · Órgão responsável · Base legal · Requisitos · Critério de renda · Documentos necessários · Laudo ou perícia · Como solicitar · Onde solicitar · Link oficial direto · Prazo estimado · Validade e renovação · Valor ou cobertura · Pode acumular? · Motivos comuns de negativa · Como recorrer · Canais de reclamação · Observações importantes · Data da última verificação.**

## 7. PESQUISA POR ESTADO E MUNICÍPIO

Para cada um dos 26 estados e o DF (AC, AL, AP, AM, BA, CE, ES, GO, MA, MT, MS, MG, PA, PB, PR, PE, PI, RJ, RN, RS, RO, RR, SC, SP, SE, TO, DF), pesquisar: benefícios estaduais; gratuidades de transporte; isenções de IPVA e ICMS; programas de medicamentos; habitação; renda estadual; tarifas sociais; programas para PcD, idosos e estudantes; doenças específicas; serviços jurídicos; restaurantes populares; cursos gratuitos; saúde; centros especializados; cuidadores; segurança alimentar; serviços digitais; contatos e portais oficiais.

Para o nível municipal, modelo de pesquisa: site da prefeitura; diário oficial; secretarias (assistência social, saúde, educação, habitação, transporte, fazenda); CRAS; CREAS; conselhos (PcD, idoso, tutelar); Câmara Municipal; legislação municipal; programas locais; gratuidades; isenções; auxílios; transporte; alimentação; saúde; habitação; emprego; capacitação.

## 8. CRUZAMENTO DE PERFIS

Ferramenta lógica **"Descubra todos os seus direitos"** cruzando: idade; sexo (somente quando juridicamente relevante); estado; município; zona urbana/rural; renda individual e familiar; tamanho da família; Cadastro Único; outros benefícios recebidos; situação de emprego; contribuição ao INSS e tempo; profissão; deficiência e grau de impedimento; necessidade de acompanhante; doença atual/anterior; sequelas; tratamento em andamento; uso contínuo de medicamentos; gestação; filhos e dependentes; situação escolar; moradia; financiamento habitacional; gastos com saúde; necessidade de transporte; exposição a risco ou violência; calamidade; grupo tradicional; condição de cuidador.

Resposta em: direitos prováveis; direitos que precisam de avaliação; benefícios incompatíveis; documentos necessários; órgãos a procurar; prioridade de solicitação; possíveis recursos; direitos federais/estaduais/municipais.

**Não solicitar dados pessoais desnecessários, números de documentos, informações bancárias, senhas ou dados médicos além do indispensável.**

## 9. TABELAS E RELATÓRIOS

Índice geral; capítulos por área; tabelas comparativas; fichas individuais; listas por público, doença, deficiência, faixa etária, renda, estado, município; direitos sem/com exigência de renda; benefícios previdenciários vs. assistenciais; isenções fiscais; gratuidades de transporte; serviços gratuitos de saúde; documentos gratuitos; canais de denúncia; telefones úteis; aplicativos e sites oficiais; documentos exigidos; direitos com renovação; direitos dependentes de regulamentação local.

Tabela padrão: | Área | Direito ou serviço | Público | Requisito de renda | Exige contribuição ao INSS | Gratuito | Abrangência | Órgão | Como solicitar | Base legal | Link oficial | Atualização |

## 10. CLASSIFICAÇÃO DO NÍVEL DE SEGURANÇA DA INFORMAÇÃO

- **Confirmada** — consta claramente em fonte oficial vigente;
- **Confirmada com variação local** — existe, mas regras variam por estado/município;
- **Condicionada à avaliação** — depende de perícia, renda, incapacidade ou avaliação biopsicossocial;
- **Jurisprudencial** — decorre principalmente de entendimento judicial;
- **Em regulamentação** — prevista em lei, mas depende de norma complementar;
- **Necessita confirmação** — fonte insuficiente ou informação conflitante;
- **Revogada ou encerrada** — não deve ser apresentada como direito atual.

## 11. CUIDADOS JURÍDICOS

Diagnóstico médico não significa automaticamente incapacidade; doença não significa automaticamente deficiência; deficiência não significa automaticamente benefício financeiro; BPC não é aposentadoria e não exige contribuição ao INSS; benefícios previdenciários normalmente exigem qualidade de segurado e carência, salvo exceções; isenção de IR não se aplica automaticamente a qualquer renda; isenções de veículos variam entre tributos e estados; laudo particular pode ser aceito em alguns processos e recusado em outros; direitos municipais dependem da legislação local; programas podem sofrer alterações orçamentárias; decisões judiciais podem ampliar direitos em casos individuais; **a informação não substitui atendimento jurídico, médico, previdenciário ou social individualizado**.

## 12. INFORMAÇÕES ADICIONAIS QUE DEVEM SER PESQUISADAS

Novos programas; benefícios temporários; programas-piloto; benefícios locais inovadores; serviços móveis/itinerantes; mutirões; teleatendimento; telemedicina; unidades móveis; justiça e Defensoria itinerantes; renegociação; serviços gratuitos para animais; proteção ambiental; defesa civil; capacitação digital; inclusão tecnológica; internet gratuita; empreendedores; microcrédito; incubadoras públicas; cooperativas; juventude; cuidadores; familiares de pacientes; luto; serviços funerários gratuitos; sepultamento social; doação de órgãos; bancos de leite, sangue, alimentos e equipamentos assistivos; empréstimo de cadeiras de rodas e equipamentos hospitalares; casas de apoio; hospedagem para tratamento; transporte de pacientes; tratamentos por ordem judicial ou protocolo; prevenção; rastreamento; dados pessoais; retificação de informações públicas; pessoas desaparecidas; proteção de testemunhas e vítimas; egressos; dependentes de pessoas presas; órfãos; desastres ambientais; indenizações públicas; consumidores de serviços públicos; serviços universitários gratuitos (clínicas-escola, hospitais-escola, núcleos de prática jurídica, psicologia, odontologia, fisioterapia, nutrição, veterinária, arquitetura, engenharia, contabilidade); inclusão produtiva; agricultura; apoio tecnológico.

## 13. PRODUTO FINAL

Entregar em módulos: **1** Visão geral nacional · **2** Serviços públicos gratuitos por área · **3** Direitos das pessoas com deficiência · **4** Doenças, condições e sequelas que podem gerar direitos (matriz sem automatismos) · **5** Benefícios previdenciários e assistenciais · **6** Isenções fiscais e tributárias · **7** Direitos por público · **8** Direitos estaduais (um capítulo por UF) · **9** Direitos municipais (metodologia e modelo) · **10** Canais de solicitação, recurso e denúncia · **11** Direitos pouco conhecidos · **12** Checklist personalizado.

## 14. PADRÃO DE ESCRITA

Usar: português brasileiro; linguagem simples; explicações detalhadas; termos técnicos com definição; exemplos práticos; tabelas; checklists; alertas; passo a passo; links oficiais; datas de atualização; base legal; distinção entre regra nacional e local. Evitar: juridiquês sem explicação; promessas de concessão; afirmações absolutas sem base legal; informações sem fonte; propaganda; opinião política; orientação partidária; links duvidosos; informações desatualizadas; confusão entre benefício assistencial e previdenciário; confusão entre doença, incapacidade e deficiência.

## 15. COMANDO DE INÍCIO

Começar apresentando: metodologia; fontes; critérios de validação; estrutura completa do guia; riscos de desatualização; primeiro módulo; tabela inicial; lacunas que precisarão de pesquisa estadual ou municipal. Não encerrar após os benefícios mais conhecidos: continuar até cobrir todas as áreas, públicos e níveis de governo. Quando o volume ultrapassar o limite de uma resposta, dividir em partes numeradas, preservar continuidade e manter lista de controle com: tópicos concluídos, em andamento e pendentes; fontes verificadas; data da verificação; informações que precisam de confirmação local.

---

## Estado da execução no software (rastreio F4)

| Item do prompt | Implementação | Estado |
|---|---|---|
| §6 ficha padrão | tabela `Direito` (db/06-f4.sql) | ✅ schema completo |
| §10 classificação | `Direito_Confianca` (CHECK de 7 níveis) | ✅ |
| §2.2/2.3/2.4/2.6/2.13 | vetos de banco F4-RG-01..05 na publicação | ✅ trigger + testes |
| §8 cruzamento de perfis | `POST /v1/direitos/descubra` — motor determinístico; renda/perícia sempre "avaliação" (F4-RG-06) | ✅ |
| §8 privacidade | perfil sem identificadores; trilha registra apenas fatores e contagens | ✅ |
| §1 acumulação | `IncompatibilidadeBeneficio` | ✅ |
| §4.8 doenças sem automatismo | `CondicaoSaude` + `DireitoCondicao_Observacao` obrigatoriamente nuançada | ✅ |
| §5 pouco conhecidos | `Direito_PoucoConhecido` + filtro no portal | ✅ |
| §13 módulos 1–7, 10–12 | seed federal curado + portal `/direitos` | ✅ primeira carga (20 fichas) |
| §7 / §13 módulos 8–9 (UFs e municípios) | pesquisa operacional contínua com este prompt; cada ficha nova entra RASCUNHO → vetos → publicação | ◐ backlog de operação |
