/**
 * Semáforo de cobertura: forma + rótulo + cor, NESSA ordem (§15.1).
 * Um usuário com deuteranopia lê pela forma; um leitor de tela, pelo rótulo.
 */
const MAPA = {
  DISPONIVEL: { classe: 'atual', forma: '●', rotulo: 'Disponível' },
  EM_CONSTRUCAO: { classe: 'construcao', forma: '—', rotulo: 'Em construção' },
  SEM_FONTE: { classe: 'sem-dado', forma: '○', rotulo: 'Sem fonte' },
  DEFASADO: { classe: 'defasado', forma: '◐', rotulo: 'Defasado' },
} as const;

export function ChipSemaforo({ status }: { status: keyof typeof MAPA }) {
  const s = MAPA[status] ?? MAPA.SEM_FONTE;
  return (
    <span className={`chip ${s.classe}`}>
      <span className="forma" aria-hidden="true">
        {s.forma}
      </span>
      {s.rotulo}
    </span>
  );
}
