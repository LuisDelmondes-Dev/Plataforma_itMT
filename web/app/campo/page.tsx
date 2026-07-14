'use client';

import { useEffect, useState } from 'react';

interface Missao {
  id: number; frente: string; produto: string; equipe: string;
  inicio: string; fim: string; status: string; municipio: string;
  autorizacoes_vigentes: number; capturas: number;
}
interface CapturaLocal {
  missao_id: number; operador: string; sensor: string;
  gnss: { lat: number | null; lon: number | null; precisao_m: number | null };
  checklist_ok: boolean; caminho_objeto: string; capturado_em: string;
}
interface Painel { municipio: string; frente: string; estado: string }

const CHECKLIST = [
  'Autorizações da missão conferidas e vigentes',
  'Cartões de memória formatados e identificados',
  'GNSS com precisão aceitável para o produto',
  'Plano de voo/roteiro validado com a equipe',
];

/**
 * APP DE CAMPO (RF-CAMPO-003) — offline-first:
 * as capturas entram numa FILA LOCAL do dispositivo e sincronizam
 * quando houver rede. O momento da captura é preservado separado do
 * momento da sincronização. Acesso por token de operador.
 */
export default function Campo() {
  const [token, setToken] = useState('');
  const [autenticado, setAutenticado] = useState(false);
  const [missoes, setMissoes] = useState<Missao[]>([]);
  const [painel, setPainel] = useState<Painel[]>([]);
  const [fila, setFila] = useState<CapturaLocal[]>([]);
  const [missaoSel, setMissaoSel] = useState<number | null>(null);
  const [operador, setOperador] = useState('');
  const [checks, setChecks] = useState<boolean[]>(CHECKLIST.map(() => false));
  const [msg, setMsg] = useState<string | null>(null);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    try { setFila(JSON.parse(localStorage.getItem('itmt.campo.fila') ?? '[]')); } catch {}
    const t = sessionStorage.getItem('itmt.campo.token');
    if (t) { setToken(t); entrar(t); }
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function salvarFila(f: CapturaLocal[]) {
    setFila(f);
    localStorage.setItem('itmt.campo.fila', JSON.stringify(f));
  }

  async function entrar(t = token) {
    const r = await fetch('/api/v1/admin/campo/missoes', { headers: { Authorization: `Bearer ${t}` } });
    if (!r.ok) { setMsg('Token inválido.'); return; }
    sessionStorage.setItem('itmt.campo.token', t);
    setAutenticado(true);
    setMissoes(await r.json());
    const p = await fetch('/api/v1/admin/campo/painel', { headers: { Authorization: `Bearer ${t}` } });
    if (p.ok) setPainel(await p.json());
    setMsg(null);
  }

  function capturar() {
    if (!missaoSel || !operador) { setMsg('Selecione a missão e identifique o operador.'); return; }
    const registrar = (lat: number | null, lon: number | null, precisao: number | null) => {
      const c: CapturaLocal = {
        missao_id: missaoSel, operador, sensor: 'Registro de campo',
        gnss: { lat, lon, precisao_m: precisao },
        checklist_ok: checks.every(Boolean),
        caminho_objeto: `upload-pendente/${Date.now()}.jpg`,
        capturado_em: new Date().toISOString(),
      };
      salvarFila([...fila, c]);
      setMsg(`Captura registrada na fila local (${fila.length + 1} pendente(s)). Sincronize quando houver rede.`);
    };
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (p) => registrar(p.coords.latitude, p.coords.longitude, p.coords.accuracy),
        () => registrar(null, null, null),
        { timeout: 5000 },
      );
    } else registrar(null, null, null);
  }

  async function sincronizar() {
    let ok = 0;
    const restantes: CapturaLocal[] = [];
    for (const c of fila) {
      try {
        const r = await fetch(`/api/v1/admin/campo/missoes/${c.missao_id}/capturas`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
          body: JSON.stringify(c),
        });
        if (r.ok) ok++; else restantes.push(c);
      } catch { restantes.push(c); }
    }
    salvarFila(restantes);
    setMsg(`${ok} captura(s) sincronizada(s); ${restantes.length} permanecem na fila.`);
    entrar();
  }

  const forma = (e: string) => (e === 'EXECUTADA' ? '●' : e === 'EM_CAMPO' ? '◐' : e === 'PLANEJADA' ? '—' : '○');

  if (!autenticado) {
    return (
      <div style={{ maxWidth: 420, margin: '48px auto' }}>
        <div className="overline">Operações de campo</div>
        <h1 style={{ fontSize: 24, lineHeight: '32px', fontWeight: 600 }}>Acesso do operador</h1>
        <input className="campo" type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Token de operador" aria-label="Token de operador" />
        <button className="btn primaria" style={{ marginTop: 8, width: '100%' }} onClick={() => entrar()}>Entrar</button>
        {msg && <p className="aviso" style={{ marginTop: 12 }}>{msg}</p>}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      <div className="overline">Operações de campo</div>
      <h1 style={{ fontSize: 28, lineHeight: '36px', fontWeight: 600, margin: '8px 0' }}>
        Missões e capturas
      </h1>
      <p className="mono" style={{ fontSize: 12, color: online ? 'var(--state-current)' : 'var(--state-stale)' }}>
        {online ? '● online' : '◐ offline — capturas continuam entrando na fila local'}
        {' · '}fila local: {fila.length}
      </p>
      {msg && <p className="aviso">{msg}</p>}

      <div className="card" style={{ marginTop: 8 }}>
        <div className="overline">Missões</div>
        {missoes.map((m) => (
          <button key={m.id} className={`opcao${missaoSel === m.id ? ' selecionada' : ''}`} onClick={() => setMissaoSel(m.id)}>
            <span>
              <strong>{m.municipio}</strong> · {m.frente} · {m.produto}
              <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}> {m.inicio} → {m.fim}</span>
            </span>
            <span className="mono" style={{ fontSize: 11 }}>
              {m.status} · aut. vigentes: {m.autorizacoes_vigentes} · capturas: {m.capturas}
            </span>
          </button>
        ))}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="overline">Checklist de captura</div>
        {CHECKLIST.map((c, i) => (
          <label key={c} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', fontSize: 14 }}>
            <input type="checkbox" checked={checks[i]} onChange={() => setChecks(checks.map((v, j) => (j === i ? !v : v)))} />
            {c}
          </label>
        ))}
        <input className="campo" style={{ marginTop: 8 }} value={operador} onChange={(e) => setOperador(e.target.value)} placeholder="Nome do operador" aria-label="Nome do operador" />
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button className="btn primaria" onClick={capturar}>Registrar captura (fila local)</button>
          <button className="btn" onClick={sincronizar} disabled={!fila.length}>Sincronizar {fila.length ? `(${fila.length})` : ''}</button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="overline">Painel de progresso — 4 frentes</div>
        <table className="dados" style={{ marginTop: 8 }}>
          <caption style={{ display: 'none' }}>Progresso das frentes de mapeamento</caption>
          <thead>
            <tr><th scope="col">Município</th><th scope="col">GEO</th><th scope="col">ESTRUTURANTE</th><th scope="col">AUDIOVISUAL</th><th scope="col">ESTATISTICO</th></tr>
          </thead>
          <tbody>
            {[...new Set(painel.map((p) => p.municipio))].map((mun) => (
              <tr key={mun}>
                <th scope="row" style={{ fontWeight: 500 }}>{mun}</th>
                {['GEO', 'ESTRUTURANTE', 'AUDIOVISUAL', 'ESTATISTICO'].map((f) => {
                  const cel = painel.find((p) => p.municipio === mun && p.frente === f);
                  return (
                    <td key={f} className="mono" style={{ fontSize: 11 }}>
                      <span aria-hidden="true">{forma(cel?.estado ?? 'SEM_MISSAO')}</span> {cel?.estado ?? 'SEM_MISSAO'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
