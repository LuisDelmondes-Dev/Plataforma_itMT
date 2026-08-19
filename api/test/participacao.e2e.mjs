import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
const PORT=4800+(process.pid%100), BASE=`http://localhost:${PORT}/v1`; let api;
before(async()=>{api=spawn('node',['dist/main.js'],{env:{...process.env,PORT:String(PORT),AGENTES_AUTO:'0',DOCUMENTOS_WORKER:'0'},stdio:process.env.TEST_DEBUG==='1'?'inherit':'ignore'});for(let i=0;i<80;i++){if(api.exitCode!==null)throw new Error(`API encerrou prematuramente (exit ${api.exitCode}).`);try{if((await fetch(`${BASE}/saude/live`)).ok)return;}catch{}await new Promise(r=>setTimeout(r,500));}throw new Error('API não subiu.');});
after(()=>api?.kill());

test('F6-R013-R016: manifestação anônima recebe devolutiva sem expor token', async()=>{
  const criada=await fetch(`${BASE}/participacao`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
    categoria:'CORRECAO',codigo_ibge:'5103403',mensagem:'A fonte deste indicador precisa de revisão documental.',consentimento:true,
  })});
  assert.equal(criada.status,201); const cadastro=await criada.json();
  assert.ok(cadastro.protocolo&&cadastro.token_acompanhamento);
  assert.equal((await fetch(`${BASE}/participacao/${cadastro.protocolo}?token=incorreto`)).status,404);
  const admin=await fetch(`${BASE}/admin/participacao/${cadastro.protocolo}/resposta`,{method:'POST',headers:{authorization:'Bearer itmt-admin-dev','content-type':'application/json'},body:JSON.stringify({resposta:'Fonte encaminhada para revisão da curadoria.'})});
  assert.equal(admin.status,201);
  const acompanhamento=await fetch(`${BASE}/participacao/${cadastro.protocolo}?token=${encodeURIComponent(cadastro.token_acompanhamento)}`);
  assert.equal(acompanhamento.status,200); const estado=await acompanhamento.json();
  assert.equal(estado.status,'RESPONDIDA'); assert.match(estado.resposta,/revisão/);
  assert.doesNotMatch(JSON.stringify(estado),/token/i);
  const impacto=await (await fetch(`${BASE}/participacao`)).json();
  assert.ok(impacto.total>=1&&impacto.respondidas>=1);
});
