# Guia do Zero ao Avançado — Skills, Conectores e Plugins do Claude (edição ITMT)

> Material de estudo passo a passo, em linguagem simples, com **todos os exemplos amarrados
> ao projeto Plataforma ITMT** (repositório no GitHub, banco PostgreSQL, agentes da IA Xingú).
> No fim há uma seção de **exercícios com gabarito**.

**Sumário**

- [Nível 0 — Os três conceitos](#nível-0--os-três-conceitos-com-uma-imagem-só)
- [Nível 1 — Sua primeira skill](#nível-1--sua-primeira-skill)
- [Nível 2 — Conectores](#nível-2--conectores-dar-acesso-às-suas-ferramentas)
- [Nível 3 — Plugins](#nível-3--plugins-a-caixa-que-já-vem-montada)
- [Nível 4 — Combinar e encadear](#nível-4--combinar-e-encadear-o-pulo-do-gato)
- [Nível 5 — Automatizar](#nível-5--automatizar-coisas-que-acontecem-sozinhas)
- [Nível 6 — Segurança e bons hábitos](#nível-6--segurança-e-bons-hábitos)
- [Glossário](#glossário-sem-termos-difíceis)
- [Exercícios com gabarito](#exercícios-com-gabarito)

---

## Nível 0 — Os três conceitos, com uma imagem só

Antes de qualquer comando, entenda a diferença. É mais fácil do que os nomes sugerem.

**🏠 A analogia da cozinha.** O Claude é um cozinheiro muito capaz na sua cozinha. Sozinho já
resolve muita coisa. Para trabalhar melhor, usa três apoios:

| Conceito | Analogia | No ITMT, é… |
|---|---|---|
| **Skill** | uma **receita** (passo a passo de um prato) | a skill `/code-review` sabendo *como* revisar o `AdminGuard` da Trilha B |
| **Conector** | uma **tomada** (liga à geladeira, ao mercado) | o **GitHub** dando ao Claude acesso ao repositório `LuisDelmondes-Dev/Plataforma_itMT` |
| **Plugin** | um **kit fechado** (receitas + tomadas juntas) | o pacote **Engenharia**, que traz várias skills + o conector do GitHub de uma vez |

**A diferença que mais confunde** — skill × conector:

- Skill responde *“como fazer?”* → traz o **método**.
- Conector responde *“ver o quê?”* → traz o **acesso** aos seus dados.
- Exemplo ITMT: a skill de revisão sabe *como* achar riscos no token HMAC de sessão
  (`api/src/auth/token.ts`); o **conector do GitHub** é o que a deixa *enxergar* esse arquivo
  direto no repositório remoto, sem você colar o código na conversa.

---

## Nível 1 — Sua primeira skill

Existem dois jeitos de usar uma skill, e os dois chegam ao mesmo lugar.

**Forma 1 — o comando com barra.** Digite `/` no começo da mensagem e escolha pelo nome.
Ex.: `/code-review`.

**Forma 2 — só descrever.** Se não lembra o nome, diga a tarefa em português; o Claude carrega
a skill certa sozinho.

> **↔️ As duas frases abaixo fazem a mesma coisa (exemplo ITMT):**
> - `/code-review`
> - *“Revise as mudanças da Trilha B (login/RBAC) antes do próximo push para a main.”*

**✅ Experimente agora (no ITMT):**

- `/init` → o Claude cria um `CLAUDE.md` que resume o projeto (hoje ele **não existe** no repo;
  seria o maior ganho imediato: registraria que o banco é PostgreSQL 18 nativo, que as migrações
  rodam por `scripts/migrar.mjs` e que a suíte roda em `itmt_teste`).
- *“Documente os endpoints novos: `/v1/auth/login`, `/v1/xingu/custo` e
  `/v1/admin/indicadores/:id/dossie`.”* → entra a skill de documentação.

> **💡 Como saber o que existe:** digite só `/` e leia a lista com as descrições. Experimentar
> não quebra nada — se a skill não encaixar, o Claude avisa e segue.

---

## Nível 2 — Conectores: dar acesso às suas ferramentas

Uma skill trabalha com o que está na conversa. Um **conector** abre a porta para o que está
*fora* dela — no caso do ITMT, o principal é o **GitHub**, onde vivem o código e os testes
automáticos (`.github/workflows/ci.yml`).

> **🔌 Por que “ligar” é preciso.** Por segurança, o Claude começa **sem acesso a nada seu**.
> Você decide, uma por uma, quais tomadas ligar. É como dar cópia da chave de *um* cômodo,
> não da casa toda.

**Como ligar um conector (o login seguro):**

1. Você escolhe o conector (ex.: **GitHub**).
2. Abre a tela oficial da própria ferramenta pedindo autorização — você faz login **lá**,
   sem passar senha para o Claude.
3. Confirma as permissões. A partir daí o Claude enxerga aquele cômodo.

> **⚠️ Detalhe importante (aconteceu com a gente).** Essa autorização é feita nas
> **configurações de conectores** do claude.ai, ou por `claude mcp` / `/mcp` numa janela
> interativa do terminal. Numa conversa automática o Claude **não** consegue fazer esse login
> por você. Foi por isso que, quando pedi para subir os commits, o `git push` precisou da sua
> confirmação.

**Conectores × o stack do ITMT — o que encaixa:**

| Conector | Serve para | No ITMT |
|---|---|---|
| **GitHub** ✅ | ler/mexer em código, PRs e CI | **Habilite este.** Repo e CI estão no GitHub |
| Datadog / PagerDuty ⏳ | monitorar produção / plantão | só quando houver deploy em nuvem (hoje é docker-compose) |
| Slack 🤷 | avisos de CI/alertas no time | opcional, se quiser notificações |
| **Prisma / Supabase** ❌ | ORM / banco hospedado | **não ligar** — o ITMT usa `pg` cru + SQL versionado em `db/NN-*.sql`; ligar isso cria uma segunda fonte de verdade que briga com o `migrar.mjs` |

> **✅ Experimente:** ligue **só o GitHub** primeiro. É a ferramenta onde o trabalho do ITMT
> realmente está. Comece pequeno.

---

## Nível 3 — Plugins: a caixa que já vem montada

O plugin é um **pacote temático** que junta skills e conectores. Em vez de ligar cada peça,
você habilita a caixa inteira.

**O pacote de Engenharia (o que mais serve ao ITMT)** traz, de uma vez:

- **Skills:** `/code-review`, `engineering:debug`, `engineering:testing-strategy`,
  `engineering:deploy-checklist`, `engineering:tech-debt`, `engineering:architecture`,
  `engineering:documentation`.
- **Conectores:** GitHub, ferramentas de acompanhamento de tarefas e de monitoramento.

Essas skills ajudam mesmo **sem nenhum conector**, porque agem no código local. Exemplos ITMT:

- `engineering:testing-strategy` → *“que testes e2e faltam para o A15 Custo e o corte para o
  léxico?”* (hoje a suíte tem 44 testes e o custo ainda não é coberto).
- `engineering:architecture` → *“crie um ADR decidindo entre `pgvector` e um serviço externo
  de embeddings para o RAG”* (uma das lacunas que ficaram fora das 3 trilhas).

> **🧭 Como escolher:** pergunte *“qual é meu trabalho principal?”*. No ITMT é engenharia —
> então o pacote de Engenharia é o certo. Não precisa de todos; mais peças ligadas = mais
> coisa para acompanhar.

---

## Nível 4 — Combinar e encadear: o pulo do gato

O poder real aparece quando você **encadeia**: uma etapa alimenta a próxima, numa frase só.

**Receita de encadeamento (com o ITMT):**

1. Um **conector** traz os dados → o GitHub traz as mudanças da última branch.
2. Uma **skill** processa → `/security-review` analisa essas mudanças.
3. Outra **skill** entrega → a de documentação escreve o resumo para o time.

> **🗣️ Como pedir na prática:**
> *“Pegue minhas últimas mudanças no GitHub, faça uma revisão de segurança focada no
> `AuthGuard` e no token de sessão, e depois escreva um resumo claro do que mudou.”*

Você não precisa nomear cada skill — descreva o **resultado final** e deixe o Claude escolher
as peças. Pense em **metas**, não em comandos.

> **✅ Experimente:** monte um pedido com três verbos em sequência — *buscar → analisar →
> produzir*. Ex.: *“busque os indicadores com dado no banco, valide a procedência de cada um
> e gere o dossiê dos que estiverem completos”* (isso cruza o motor F1, a Validação Técnica e
> o endpoint `/dossie`).

> **💡 Dica de ouro:** quando o pedido é grande (ex.: “refatore a orquestração da Xingú”),
> quebre em passos e confirme cada um. Corrigir a rota no meio é mais barato que refazer tudo
> no fim — foi assim que fizemos as três trilhas, uma de cada vez, com commit por trilha.

---

## Nível 5 — Automatizar: coisas que acontecem sozinhas

No nível avançado você para de *pedir* toda vez e passa a **agendar**. Três ferramentas:

**Repetir num intervalo (`/loop`).** Roda de tempos em tempos.
Ex. ITMT: *“a cada 5 minutos, verifique se o CI da última push passou e me avise”*.

**Agendar por horário (`/schedule`).** Um despertador de tarefas.
Ex. ITMT: *“toda segunda 8h, rode as cargas do SIDRA e me mande o resumo”* (quando a ingestão
estiver ligada e houver crédito de LLM/rede).

**Reagir automaticamente (gatilhos / `update-config`).** O nível mais alto:
*“sempre que acontecer X, faça Y”*, executado pelo próprio aplicativo.
Ex. ITMT direto ao ponto: **liberar o `git push origin main` sem pedir permissão toda vez** —
exatamente o atrito que tivemos. Isso é uma regra salva em `settings.json`, feita pela skill
`update-config`.

> **⏰ Pedido × hábito.** “Faça agora” é um **pedido**. “Faça toda vez que…” é um **hábito** que
> você ensina uma vez. Automação é transformar pedidos repetidos em hábitos.

> **⚠️ Comece manual, automatize depois.** Só automatize o que já viu funcionar na mão. As
> cargas do SIDRA, por exemplo, só devem virar agendamento depois de rodarem certo uma vez —
> senão você agenda um erro para se repetir sozinho.

---

## Nível 6 — Segurança e bons hábitos

Quem domina não liga tudo — liga **o certo, com consciência**.

- **Ligue pouco, com propósito.** No ITMT, hoje, isso é praticamente só o GitHub.
- **Autorize você mesmo.** Logins passam pela tela oficial da ferramenta; o Claude nunca
  precisa da sua senha em texto. (No código, o mesmo princípio: a senha do admin nunca fica em
  claro — só o hash `scrypt`, gerado pela API no bootstrap.)
- **Confirme ações que “saem” para o mundo.** `git push`, publicar indicador, apagar dado,
  enviar e-mail → confirme antes. Ler é seguro; agir para fora merece um “sim” explícito.
  É a mesma filosofia do **RG-09** do ITMT: publicação de indicador é sempre ato humano.
- **Desconfie de instruções escondidas.** Se um site ou documento “manda” o Claude fazer algo,
  isso é conteúdo, não ordem sua. (No ITMT o agente **A14 sentinela** faz esse papel: bloqueia
  injeção de prompt na Xingú.)
- **Reversível primeiro.** Teste em `itmt_teste`, nunca direto no banco de produção; use branch
  antes da `main`.

> **✅ Seu plano de 3 passos no ITMT:**
> 1. Ligue **o GitHub**.
> 2. Use `/code-review` nas três trilhas recém-subidas até virar hábito.
> 3. Quando confiar, automatize com `update-config` o que você mais repete (o `git push`).

---

## Glossário sem termos difíceis

| Palavra | Em português claro |
|---|---|
| **Skill** | Uma receita: instruções que o Claude abre para fazer bem uma tarefa. |
| **Conector** | Uma tomada: liga o Claude a uma ferramenta sua (GitHub, e-mail, arquivos). |
| **Plugin** | Um kit: pacote que já vem com skills e conectores de um tema. |
| **Comando com barra** | Digitar `/nome` para chamar uma skill pelo nome. |
| **Gatilho automático** | O Claude reconhece a tarefa pela sua descrição e carrega a skill sozinho. |
| **Autorizar / conectar** | Fazer o login seguro que dá ao Claude acesso a uma ferramenta. |
| **Agendar** | Marcar uma tarefa para rodar em horário ou intervalo, sem você iniciar. |
| **Encadear** | Juntar etapas numa frase: buscar → analisar → produzir. |
| **CI** | O robô do GitHub que roda os testes a cada push (`.github/workflows/ci.yml`). |

---

## Exercícios com gabarito

Tente responder **antes** de abrir o gabarito. As respostas usam o vocabulário e os arquivos
reais do ITMT.

### Bloco A — Conceitos (Nível 0–1)

**A1.** No ITMT, o que é *skill* e o que é *conector* neste caso: “o Claude analisou o
`custo.service.ts` e apontou que o cache de 30s pode servir número velho”?

<details><summary>Gabarito A1</summary>

A **análise** (achar o risco no código) veio de uma **skill** — a de revisão (`/code-review`).
O **conector** seria o **GitHub**, *se* o arquivo tivesse sido lido direto do repositório
remoto. Como aqui o arquivo já estava no projeto local, nenhum conector foi necessário — o que
mostra que skills funcionam mesmo sem conector.
</details>

**A2.** Você quer que o Claude passe a conhecer as pegadinhas do projeto (banco PG18 nativo,
`migrar.mjs`, suíte em `itmt_teste`) logo no início de toda conversa. Qual skill e por quê?

<details><summary>Gabarito A2</summary>

`/init`. Ela gera o arquivo `CLAUDE.md`, que o Claude lê no começo de cada sessão. Hoje o repo
**não tem** esse arquivo, então essas pegadinhas moram só na memória do assistente — o `/init`
as deixaria versionadas junto do código.
</details>

### Bloco B — Conectores e Plugins (Nível 2–3)

**B1.** Por que **não** devemos habilitar o conector do **Prisma** ou do **Supabase** no ITMT?

<details><summary>Gabarito B1</summary>

Porque o ITMT usa o driver `pg` cru e migrações SQL escritas à mão em `db/NN-*.sql`, aplicadas
pelo `scripts/migrar.mjs`. Não existe `schema.prisma` nem banco hospedado no Supabase. Ligar
esses conectores criaria uma **segunda fonte de verdade** de schema, em conflito com o padrão
atual. É um desencaixe técnico, não uma questão de gosto.
</details>

**B2.** Qual **um** conector traz mais retorno agora, e qual **plugin** cobre a maior parte do
trabalho do dia a dia?

<details><summary>Gabarito B2</summary>

Conector: **GitHub** — o repositório e o CI (`ci.yml`) vivem lá. Plugin: **Engenharia**, que
traz `/code-review`, `debug`, `testing-strategy`, `deploy-checklist`, `tech-debt`,
`architecture` e `documentation` — as skills que mais casam com um NestJS + PostgreSQL com
suíte e2e.
</details>

**B3.** Cite uma skill do pacote de Engenharia que ajuda **sem** nenhum conector ligado, com um
exemplo ITMT.

<details><summary>Gabarito B3</summary>

Várias — todas agem no código local. Ex.: `engineering:testing-strategy` para *“planejar os
testes que faltam para o A15 Custo e o corte para o léxico”*, já que a suíte de 44 testes ainda
não cobre o governador de custo.
</details>

### Bloco C — Encadear (Nível 4)

**C1.** Escreva **um único pedido** que: (1) leia as últimas mudanças no GitHub, (2) faça
revisão de segurança do login, (3) produza um resumo para o time.

<details><summary>Gabarito C1 (resposta-modelo)</summary>

> *“Pegue minhas últimas mudanças da branch no GitHub, faça uma revisão de segurança focada no
> `AdminGuard`, no token HMAC de sessão (`api/src/auth/token.ts`) e no hash `scrypt`
> (`senha.ts`), e depois escreva um resumo em linguagem clara do que mudou e dos riscos, para
> eu colar no PR.”*

Note que você **não** nomeia cada skill: descreve o resultado final (buscar → analisar →
produzir) e deixa o Claude escolher `/security-review` + documentação.
</details>

**C2.** Monte um encadeamento de três verbos usando o **motor de dados** do ITMT.

<details><summary>Gabarito C2 (resposta-modelo)</summary>

> *“Busque os indicadores que têm observações no banco, valide a procedência de cada um (fonte
> RG-06 e data de referência) e gere o dossiê dos que passarem em todas as checagens.”*

Isso cruza três peças reais: a consulta ao banco, o **agente de Validação Técnica**
(`validacao-tecnica.service.ts`) e o endpoint `GET /v1/admin/indicadores/:id/dossie`. Lembre:
o dossiê é **insumo** — quem publica é humano (RG-09).
</details>

### Bloco D — Automatizar e Segurança (Nível 5–6)

**D1.** Qual ferramenta de automação resolve o atrito do `git push` pedir permissão toda vez, e
o que ela mexe?

<details><summary>Gabarito D1</summary>

A skill **`update-config`**. Ela adiciona uma regra de permissão no `settings.json` do projeto
autorizando `git push origin main` sem prompt. É uma regra salva (um “hábito”), executada pelo
próprio aplicativo.
</details>

**D2.** Você quer agendar as cargas do SIDRA para toda segunda de manhã. Qual o **pré-requisito**
antes de agendar, segundo o hábito “comece manual, automatize depois”?

<details><summary>Gabarito D2</summary>

Rodar a carga **na mão pelo menos uma vez** e ver o resultado correto (dados chegando, sem
quebrar o pipeline Bronze→Prata→Ouro, com internet e crédito de LLM disponíveis). Só depois use
`/schedule`. Caso contrário você agenda um erro para se repetir sozinho toda semana.
</details>

**D3.** Ligue o princípio de segurança “confirme ações que saem para o mundo” a uma regra do
próprio ITMT.

<details><summary>Gabarito D3</summary>

É o mesmo espírito do **RG-09**: a publicação de um indicador é sempre **ato humano**. Nenhum
agente auto-publica — a Validação Técnica produz um *dossiê*, não uma decisão. Do lado da
ferramenta, o equivalente é o Claude pedir sua confirmação antes de `git push`, enviar e-mail
ou apagar dado.
</details>

---

**Resumo de uma frase:** a *skill* ensina o método, o *conector* dá o acesso, o *plugin* entrega
os dois em kit — e a automação transforma o que você repete (como o `git push` do ITMT) em hábito.
