'use client';

import Image from 'next/image';

export type ModoPesquisa = 'pesquisa' | 'xingu';

interface SeletorModoPesquisaProps {
  ativo: ModoPesquisa;
  onChange: (modo: ModoPesquisa) => void;
  compacto?: boolean;
}

export function SeletorModoPesquisa({
  ativo,
  onChange,
  compacto = false,
}: SeletorModoPesquisaProps) {
  return (
    <div
      className={`seletor-modo-pesquisa${compacto ? ' compacto' : ''}`}
      role="group"
      aria-label="Escolha o modo de pesquisa"
    >
      <button
        type="button"
        className="modo-pesquisa-opcao modo-pesquisa-tradicional"
        aria-pressed={ativo === 'pesquisa'}
        onClick={() => onChange('pesquisa')}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="10.8" cy="10.8" r="6.8" />
          <path d="m16 16 4.2 4.2" />
        </svg>
        <span>Pesquisa</span>
      </button>

      <button
        type="button"
        className="modo-pesquisa-opcao modo-pesquisa-xingu"
        aria-label="Xingú IA"
        aria-pressed={ativo === 'xingu'}
        onClick={() => onChange('xingu')}
      >
        <Image
          src="/xingu-ia.png"
          alt=""
          width={460}
          height={147}
          sizes={compacto ? '(max-width: 560px) 108px, 132px' : '(max-width: 560px) 118px, 154px'}
          draggable={false}
        />
      </button>
    </div>
  );
}
