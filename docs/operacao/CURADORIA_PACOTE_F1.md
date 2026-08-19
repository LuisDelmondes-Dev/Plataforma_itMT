# Curadoria e liberação do pacote F1

O carregamento automatizado nunca publica um indicador. A liberação exige dois
gates independentes: o técnico e o parecer humano.

## 1. Confirmar o gate técnico

Na pasta `api`:

```powershell
npm run validar:f1:dados
```

O comando deve mostrar `12/12`. Ele verifica a referência mais recente, cobertura dos
dez municípios piloto, procedência completa e ausência de dados demonstrativos.

## 2. Revisar cada dossiê

Um usuário `ADMIN` ou `CURADOR` consulta:

```text
GET /v1/admin/indicadores/{id}/dossie
```

O parecerista confere metodologia, fonte e licença, referência, unidade, agregação,
amostra municipal, cobertura, cargas e alertas de atualidade. CEMPRE 2021 deve manter
o selo `DEFASADO`; os indicadores de saneamento são baseline censitário de 2022.

## 3. Registrar a decisão

```text
POST /v1/admin/indicadores/{id}/parecer
Authorization: Bearer <token de ADMIN ou CURADOR>
Content-Type: application/json

{
  "parecerista": "Nome e identificação funcional",
  "decisao": "APROVADO",
  "justificativa": "Fonte, metodologia, cobertura e limitações revisadas."
}
```

Uma rejeição usa `REJEITADO` e descreve a correção necessária. A decisão fica no
histórico de pareceres e na trilha de auditoria.

## 4. Confirmar o gate de publicação

```powershell
npm run validar:f1
```

Somente `12/12` autoriza o lançamento. O andamento público pode ser consultado em
`GET /v1/transparencia/lancamento-f1`.

