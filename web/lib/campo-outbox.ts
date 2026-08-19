export interface CapturaOutbox {
  idempotency_key: string;
  formulario_versao: string;
  missao_id: number;
  operador: string;
  sensor: string;
  gnss: { lat: number | null; lon: number | null; precisao_m: number | null };
  checklist_ok: boolean;
  capturado_em: string;
  arquivo_nome: string;
  arquivo_tipo: string;
  arquivo: Blob;
}

interface LinhaCifrada { pk: string; scope: string; iv: ArrayBuffer; dados: ArrayBuffer; blobIv?: ArrayBuffer; blob?: ArrayBuffer }
const DB = 'itmt-campo-secure-v2';

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      const outbox = db.createObjectStore('outbox', { keyPath: 'pk' });
      outbox.createIndex('scope', 'scope');
      db.createObjectStore('keys', { keyPath: 'scope' });
      db.createObjectStore('cache', { keyPath: 'pk' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const requisicao = <T>(req: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
  req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
});

async function chave(db: IDBDatabase, scope: string) {
  const tx = db.transaction('keys', 'readwrite');
  const store = tx.objectStore('keys');
  const atual = await requisicao<{ scope: string; key: CryptoKey } | undefined>(store.get(scope));
  if (atual?.key) return atual.key;
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt','decrypt']);
  store.put({ scope, key });
  return key;
}

async function cifrar(key: CryptoKey, valor: unknown) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const dados = new TextEncoder().encode(JSON.stringify(valor));
  return { iv: iv.buffer, dados: await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, dados) };
}
async function decifrar<T>(key: CryptoKey, iv: ArrayBuffer, dados: ArrayBuffer): Promise<T> {
  const aberto = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(iv) }, key, dados);
  return JSON.parse(new TextDecoder().decode(aberto)) as T;
}

export function escopoDoToken(token: string) {
  if (token === 'itmt-admin-dev') return 'dev:00000000-0000-4000-8000-000000000002';
  try {
    const payload = JSON.parse(atob(token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/')));
    if (!payload.sub || !payload.tid || !payload.oid) throw new Error();
    return `${payload.sub}:${payload.tid}:${payload.oid}`;
  } catch { throw new Error('Selecione uma organização antes de usar o aplicativo de campo.'); }
}

export async function listarOutbox(scope: string): Promise<CapturaOutbox[]> {
  const db = await abrir(); const key = await chave(db, scope);
  const linhas = await requisicao<LinhaCifrada[]>(db.transaction('outbox').objectStore('outbox').index('scope').getAll(scope));
  return Promise.all(linhas.map(async (linha) => {
    const meta = await decifrar<Omit<CapturaOutbox,'arquivo'>>(key, linha.iv, linha.dados);
    const bytes = linha.blob && linha.blobIv
      ? await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(linha.blobIv) }, key, linha.blob) : new ArrayBuffer(0);
    return { ...meta, arquivo: new Blob([bytes], { type: meta.arquivo_tipo }) };
  }));
}

export async function enfileirar(scope: string, captura: CapturaOutbox) {
  const db = await abrir(); const key = await chave(db, scope);
  const { arquivo, ...meta } = captura;
  const dados = await cifrar(key, meta);
  const blobIv = crypto.getRandomValues(new Uint8Array(12));
  const blob = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: blobIv }, key, await arquivo.arrayBuffer());
  const linha: LinhaCifrada = { pk: `${scope}:${captura.idempotency_key}`, scope, ...dados, blobIv: blobIv.buffer, blob };
  await requisicao(abrirTransacao(db, 'outbox', 'readwrite').put(linha));
}

export async function removerOutbox(scope: string, id: string) {
  const db = await abrir(); await requisicao(abrirTransacao(db, 'outbox', 'readwrite').delete(`${scope}:${id}`));
}

function abrirTransacao(db: IDBDatabase, store: string, mode: IDBTransactionMode) { return db.transaction(store, mode).objectStore(store); }

export async function salvarCache(scope: string, nome: string, valor: unknown) {
  const db = await abrir(); const key = await chave(db, scope); const dados = await cifrar(key, valor);
  await requisicao(abrirTransacao(db, 'cache', 'readwrite').put({ pk: `${scope}:${nome}`, scope, ...dados }));
}
export async function lerCache<T>(scope: string, nome: string): Promise<T | null> {
  const db = await abrir(); const key = await chave(db, scope);
  const linha = await requisicao<LinhaCifrada | undefined>(abrirTransacao(db, 'cache', 'readonly').get(`${scope}:${nome}`));
  return linha ? decifrar<T>(key, linha.iv, linha.dados) : null;
}
