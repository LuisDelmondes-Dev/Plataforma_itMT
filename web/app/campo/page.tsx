'use client';

import { useEffect, useState } from 'react';
import { CapturaOutbox, enfileirar, escopoDoToken, lerCache, listarOutbox, removerOutbox, salvarCache } from '@/lib/campo-outbox';

interface Missao { id:number; frente:string; produto:string; equipe:string; inicio:string; fim:string; status:string; municipio:string; autorizacoes_vigentes:number; capturas:number }
interface Painel { municipio:string; frente:string; estado:string }
interface Formulario { versao:string; titulo:string; schema:{ checklist:string[] } }
const CHECKLIST_PADRAO = ['Autorizações da missão conferidas e vigentes','Cartões de memória formatados e identificados','GNSS com precisão aceitável para o produto','Plano de voo/roteiro validado com a equipe'];

export default function Campo() {
  const [token,setToken]=useState(''); const [scope,setScope]=useState(''); const [autenticado,setAutenticado]=useState(false);
  const [missoes,setMissoes]=useState<Missao[]>([]); const [painel,setPainel]=useState<Painel[]>([]); const [fila,setFila]=useState<CapturaOutbox[]>([]);
  const [missaoSel,setMissaoSel]=useState<number|null>(null); const [operador,setOperador]=useState(''); const [arquivo,setArquivo]=useState<File|null>(null);
  const [checklist,setChecklist]=useState(CHECKLIST_PADRAO); const [checks,setChecks]=useState(CHECKLIST_PADRAO.map(()=>false)); const [formularioVersao,setFormularioVersao]=useState('campo-v1');
  const [msg,setMsg]=useState<string|null>(null); const [online,setOnline]=useState(true);

  useEffect(()=>{ setOnline(navigator.onLine); const on=()=>setOnline(true),off=()=>setOnline(false); window.addEventListener('online',on); window.addEventListener('offline',off);
    const salvo=sessionStorage.getItem('itmt.campo.token'); if(salvo){setToken(salvo); void entrar(salvo);} return()=>{window.removeEventListener('online',on);window.removeEventListener('offline',off);};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  async function entrar(t=token){
    try{
      const s=escopoDoToken(t); setScope(s); setFila(await listarOutbox(s)); const headers={Authorization:`Bearer ${t}`};
      const [mr,pr,fr]=await Promise.all([fetch('/api/v1/admin/campo/missoes',{headers}),fetch('/api/v1/admin/campo/painel',{headers}),fetch('/api/v1/admin/campo/formularios/ativo',{headers})]);
      if(!mr.ok) throw new Error('Token ou contexto de organização inválido.'); const m=await mr.json(); const p=pr.ok?await pr.json():[]; const f:Formulario|null=fr.ok?await fr.json():null;
      setMissoes(m);setPainel(p);await salvarCache(s,'missoes',m);await salvarCache(s,'painel',p);
      if(f?.schema?.checklist){setFormularioVersao(f.versao);setChecklist(f.schema.checklist);setChecks(f.schema.checklist.map(()=>false));await salvarCache(s,'formulario',f);}
      sessionStorage.setItem('itmt.campo.token',t);setAutenticado(true);setMsg(null);
    }catch(erro){
      try{const s=escopoDoToken(t);const m=await lerCache<Missao[]>(s,'missoes');if(!m)throw erro;const p=await lerCache<Painel[]>(s,'painel');const f=await lerCache<Formulario>(s,'formulario');
        setScope(s);setFila(await listarOutbox(s));setMissoes(m);setPainel(p??[]);if(f){setFormularioVersao(f.versao);setChecklist(f.schema.checklist);setChecks(f.schema.checklist.map(()=>false));}setAutenticado(true);setMsg('Modo offline: dados cifrados carregados do dispositivo.');
      }catch{setMsg(erro instanceof Error?erro.message:'Não foi possível entrar.');}
    }
  }

  function capturar(){
    if(!missaoSel||!operador||!arquivo||!scope){setMsg('Selecione missão e arquivo e identifique o operador.');return;}
    const registrar=async(lat:number|null,lon:number|null,precisao:number|null)=>{const captura:CapturaOutbox={idempotency_key:crypto.randomUUID(),formulario_versao:formularioVersao,missao_id:missaoSel,operador,sensor:'Registro de campo',gnss:{lat,lon,precisao_m:precisao},checklist_ok:checks.every(Boolean),capturado_em:new Date().toISOString(),arquivo_nome:arquivo.name,arquivo_tipo:arquivo.type,arquivo};await enfileirar(scope,captura);const atual=await listarOutbox(scope);setFila(atual);setArquivo(null);setMsg(`Captura cifrada na fila (${atual.length} pendente(s)).`);};
    if('geolocation'in navigator)navigator.geolocation.getCurrentPosition(p=>void registrar(p.coords.latitude,p.coords.longitude,p.coords.accuracy),()=>void registrar(null,null,null),{timeout:5000});else void registrar(null,null,null);
  }

  async function sincronizar(){let ok=0;const falhas:string[]=[];for(const c of fila){try{const form=new FormData();form.append('idempotency_key',c.idempotency_key);form.append('arquivo',c.arquivo,c.arquivo_nome);const up=await fetch('/api/v1/admin/campo/uploads',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:form});if(!up.ok)throw new Error(`upload ${up.status}`);const objeto=await up.json();const r=await fetch(`/api/v1/admin/campo/missoes/${c.missao_id}/capturas`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({...c,arquivo:undefined,caminho_objeto:objeto.object_key})});if(!r.ok)throw new Error(`captura ${r.status}`);await removerOutbox(scope,c.idempotency_key);ok++;}catch(e){falhas.push(`${c.idempotency_key}: ${(e as Error).message}`);}}setFila(await listarOutbox(scope));setMsg(`${ok} sincronizada(s); ${falhas.length} pendente(s).`);if(ok)void entrar(token);}
  const forma=(e:string)=>(e==='EXECUTADA'?'●':e==='EM_CAMPO'?'◐':e==='PLANEJADA'?'—':'○');

  if(!autenticado)return <div style={{maxWidth:420,margin:'48px auto'}}><div className="overline">Operações de campo</div><h1>Acesso do operador</h1><form onSubmit={e=>{e.preventDefault();void entrar();}}><input className="campo" type="password" value={token} onChange={e=>setToken(e.target.value)} placeholder="Token contextual da organização" aria-label="Token do operador"/><button className="btn primaria" style={{marginTop:8,width:'100%'}}>Entrar</button></form>{msg&&<p className="aviso" role="alert">{msg}</p>}</div>;

  return <div style={{maxWidth:860,margin:'0 auto'}}><div className="overline">Operações de campo</div><h1>Missões e capturas</h1><p className="mono" style={{color:online?'var(--state-current)':'var(--state-stale)'}}>{online?'● online':'◐ offline'} · fila cifrada: {fila.length} · formulário {formularioVersao}</p>{msg&&<p className="aviso" role="status">{msg}</p>}
    <div className="card"><div className="overline">Missões</div>{missoes.map(m=><button key={m.id} className={`opcao${missaoSel===m.id?' selecionada':''}`} onClick={()=>setMissaoSel(m.id)}><span><strong>{m.municipio}</strong> · {m.frente} · {m.produto}</span><span className="mono">{m.status} · autorizações: {m.autorizacoes_vigentes} · capturas: {m.capturas}</span></button>)}</div>
    <div className="card" style={{marginTop:16}}><div className="overline">Checklist versionado</div>{checklist.map((item,i)=><label key={item} style={{display:'flex',gap:8,padding:'6px 0'}}><input type="checkbox" checked={checks[i]} onChange={()=>setChecks(checks.map((v,j)=>j===i?!v:v))}/>{item}</label>)}<input className="campo" value={operador} onChange={e=>setOperador(e.target.value)} placeholder="Nome do operador" aria-label="Nome do operador"/><label style={{display:'block',marginTop:10}}>Arquivo da captura<input className="campo" type="file" accept="image/jpeg,image/png,image/webp,video/mp4" capture="environment" onChange={e=>setArquivo(e.target.files?.[0]??null)}/></label><div style={{display:'flex',gap:8,marginTop:12}}><button className="btn primaria" onClick={capturar}>Registrar offline</button><button className="btn" onClick={()=>void sincronizar()} disabled={!fila.length||!online}>Sincronizar ({fila.length})</button></div></div>
    <div className="card" style={{marginTop:16}}><div className="overline">Painel de progresso</div><table className="dados"><thead><tr><th>Município</th><th>GEO</th><th>ESTRUTURANTE</th><th>AUDIOVISUAL</th><th>ESTATISTICO</th></tr></thead><tbody>{[...new Set(painel.map(p=>p.municipio))].map(mun=><tr key={mun}><th>{mun}</th>{['GEO','ESTRUTURANTE','AUDIOVISUAL','ESTATISTICO'].map(f=>{const c=painel.find(p=>p.municipio===mun&&p.frente===f);return <td key={f}>{forma(c?.estado??'SEM_MISSAO')} {c?.estado??'SEM_MISSAO'}</td>;})}</tr>)}</tbody></table></div>
  </div>;
}
