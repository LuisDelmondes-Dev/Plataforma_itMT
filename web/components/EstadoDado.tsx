'use client';

import { ErroApi } from '@/lib/api';

export type Estado = 'carregando' | 'erro' | 'vazio' | 'offline';

/**
 * Estado padrão de dado: carregando / erro / vazio / offline.
 * A distinção erro×vazio é a doutrina RN-005 em forma de componente:
 * "a fonte está fora do ar" NUNCA pode parecer "não há dados".
 */
export function EstadoDado({
  estado,
  mensagem,
  erro,
  aoTentarNovamente,
}: {
  estado: Estado;
  /** Sobrescreve o texto padrão do estado. */
  mensagem?: string;
  /** Quando houver um ErroApi, o texto humano dele tem prioridade. */
  erro?: unknown;
  aoTentarNovamente?: () => void;
}) {
  if (estado === 'carregando') {
    return (
      <div className="estado-dado" role="status" aria-live="polite">
        <div className="skeleton" style={{ height: 18, width: '52%' }} />
        <div className="skeleton" style={{ height: 18, width: '78%' }} />
        <div className="skeleton" style={{ height: 18, width: '64%' }} />
        <span className="sr-only">Carregando dados…</span>
      </div>
    );
  }

  const texto =
    mensagem ??
    (erro instanceof ErroApi
      ? erro.mensagemHumana
      : estado === 'erro'
        ? 'Não conseguimos consultar a fonte de dados agora. Isto não significa que o dado não exista.'
        : estado === 'offline'
          ? 'Você está offline. Os dados desta seção precisam de conexão.'
          : 'Não há dados para este recorte — ausência aqui é resposta, não erro.');

  return (
    <div className={`estado-dado estado-${estado}`} role={estado === 'vazio' ? 'status' : 'alert'}>
      <p>{texto}</p>
      {aoTentarNovamente && estado !== 'vazio' && (
        <button type="button" className="btn" onClick={aoTentarNovamente}>
          Tentar de novo
        </button>
      )}
    </div>
  );
}
