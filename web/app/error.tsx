'use client';

import { EstadoDado } from '@/components/EstadoDado';

/**
 * Erro não capturado de qualquer rota. A frase separa "a fonte está fora
 * do ar" de "o dado não existe" — RN-005 vale até na tela de erro.
 */
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div style={{ maxWidth: 640, margin: '48px auto' }}>
      <h1 className="headline-lg">Algo falhou nesta página</h1>
      <p style={{ color: 'var(--on-surface-variant)', margin: '8px 0 16px' }}>
        A consulta não pôde ser concluída. Isto não significa que o dado não exista — a fonte pode
        estar temporariamente indisponível.
      </p>
      <EstadoDado estado="erro" erro={error} aoTentarNovamente={reset} />
    </div>
  );
}
