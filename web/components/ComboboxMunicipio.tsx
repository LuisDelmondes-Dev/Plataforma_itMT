'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';

export interface MunicipioOpcao {
  codigo_ibge: string;
  nome: string;
}

const semAcento = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/**
 * Combobox de município (Onda B, padrão ARIA): busca por `includes` sem
 * acento — "floresta" acha "Alta Floresta" — com teclado completo (setas,
 * Enter, Esc) e anúncio de resultados. Substitui a lista plana de 142
 * botões do passo Local e os 142 chips da comparação.
 */
export function ComboboxMunicipio({
  municipios,
  rotulo,
  placeholder = 'Digite o nome do município…',
  aoSelecionar,
  desabilitados = [],
  texto,
  aoMudarTexto,
}: {
  municipios: MunicipioOpcao[];
  rotulo: string;
  placeholder?: string;
  aoSelecionar: (m: MunicipioOpcao) => void;
  /** Códigos que aparecem riscados/não selecionáveis (ex.: já comparados). */
  desabilitados?: string[];
  /** Modo controlado (opcional): preserva pontes como o ?rascunho= da Xingú. */
  texto?: string;
  aoMudarTexto?: (t: string) => void;
}) {
  const [buscaInterna, setBuscaInterna] = useState('');
  const busca = texto ?? buscaInterna;
  const setBusca = aoMudarTexto ?? setBuscaInterna;
  const [aberta, setAberta] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const idLista = useId();
  const raiz = useRef<HTMLDivElement>(null);

  const achados = useMemo(() => {
    const q = semAcento(busca.trim());
    const base = q ? municipios.filter((m) => semAcento(m.nome).includes(q)) : municipios;
    return base.slice(0, 60);
  }, [busca, municipios]);

  useEffect(() => setAtivo(0), [busca]);

  useEffect(() => {
    if (!aberta) return;
    const aoClicar = (e: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAberta(false);
    };
    window.addEventListener('mousedown', aoClicar);
    return () => window.removeEventListener('mousedown', aoClicar);
  }, [aberta]);

  function escolher(m: MunicipioOpcao) {
    if (desabilitados.includes(m.codigo_ibge)) return;
    aoSelecionar(m);
    setBusca('');
    setAberta(false);
  }

  function aoTeclar(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setAberta(true);
      setAtivo((a) => Math.min(a + 1, achados.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setAtivo((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      if (aberta && achados[ativo]) {
        e.preventDefault();
        escolher(achados[ativo]);
      }
    } else if (e.key === 'Escape') {
      setAberta(false);
    }
  }

  return (
    <div className="combobox-municipio" ref={raiz}>
      <label>
        <span className="label-md">{rotulo}</span>
        <input
          className="campo"
          role="combobox"
          aria-expanded={aberta}
          aria-controls={idLista}
          aria-activedescendant={aberta && achados[ativo] ? `${idLista}-${achados[ativo].codigo_ibge}` : undefined}
          aria-autocomplete="list"
          placeholder={placeholder}
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value);
            setAberta(true);
          }}
          onFocus={() => setAberta(true)}
          onKeyDown={aoTeclar}
        />
      </label>
      {aberta && (
        <ul className="combobox-lista" role="listbox" id={idLista} aria-label={rotulo}>
          {achados.map((m, i) => {
            const bloqueado = desabilitados.includes(m.codigo_ibge);
            return (
              <li
                key={m.codigo_ibge}
                id={`${idLista}-${m.codigo_ibge}`}
                role="option"
                aria-selected={i === ativo}
                aria-disabled={bloqueado || undefined}
                className={`combobox-opcao${i === ativo ? ' ativa' : ''}${bloqueado ? ' bloqueada' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault(); // não rouba o foco do input
                  escolher(m);
                }}
                onMouseEnter={() => setAtivo(i)}
              >
                <span>{m.nome}</span>
                <span className="mono combobox-codigo">{m.codigo_ibge}</span>
              </li>
            );
          })}
          {achados.length === 0 && (
            <li className="combobox-opcao vazia" role="option" aria-disabled aria-selected={false}>
              Nenhum município corresponde à busca.
            </li>
          )}
        </ul>
      )}
      <span className="sr-only" aria-live="polite">
        {aberta ? `${achados.length} município(s) encontrados` : ''}
      </span>
    </div>
  );
}
