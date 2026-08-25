'use client';

import { FormEvent, useEffect, useState } from 'react';

interface Impacto {
  total: number;
  respondidas: number;
  em_andamento: number;
}
interface Recibo {
  protocolo: string;
  token_acompanhamento: string;
  status: string;
  aviso: string;
}
interface Andamento {
  protocolo: string;
  status: string;
  resposta: string | null;
  atualizada_em: string;
}

export default function ParticipacaoPage() {
  const [impacto, setImpacto] = useState<Impacto | null>(null);
  const [recibo, setRecibo] = useState<Recibo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [andamento, setAndamento] = useState<Andamento | null>(null);

  const atualizarImpacto = () =>
    fetch('/api/v1/participacao')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setImpacto)
      .catch(() => null);
  useEffect(() => {
    void atualizarImpacto();
  }, []);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);
    setEnviando(true);
    const formulario = evento.currentTarget;
    const dados = new FormData(formulario);
    const resposta = await fetch('/api/v1/participacao', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        categoria: dados.get('categoria'),
        codigo_ibge: dados.get('codigo_ibge') || undefined,
        mensagem: dados.get('mensagem'),
        consentimento: dados.get('consentimento') === 'on',
      }),
    });
    const corpo = await resposta
      .json()
      .catch(() => ({ message: 'Não foi possível registrar a manifestação.' }));
    setEnviando(false);
    if (!resposta.ok) {
      setErro(Array.isArray(corpo.message) ? corpo.message.join(' ') : corpo.message);
      return;
    }
    setRecibo(corpo);
    formulario.reset();
    void atualizarImpacto();
  }

  async function acompanhar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);
    setAndamento(null);
    const dados = new FormData(evento.currentTarget),
      protocolo = String(dados.get('protocolo') ?? ''),
      token = String(dados.get('token') ?? '');
    const resposta = await fetch(
      `/api/v1/participacao/${encodeURIComponent(protocolo)}?token=${encodeURIComponent(token)}`,
    );
    if (!resposta.ok) {
      setErro('Protocolo ou token de acompanhamento inválido.');
      return;
    }
    setAndamento(await resposta.json());
  }

  return (
    <div className="participacao">
      <header className="participacao-hero">
        <p className="participacao-kicker">Escuta pública · sem cadastro · sem PII</p>
        <h1>
          Sua observação entra.
          <br />
          <em>A devolutiva sai.</em>
        </h1>
        <p>
          Informe um dado incorreto, proponha uma melhoria ou registre uma necessidade territorial.
          Você recebe um protocolo anônimo e acompanha a resposta da curadoria.
        </p>
        <div className="participacao-impacto" aria-label="Indicadores de participação">
          <div>
            <strong>{impacto?.total ?? '—'}</strong>
            <span>manifestações</span>
          </div>
          <div>
            <strong>{impacto?.respondidas ?? '—'}</strong>
            <span>respondidas</span>
          </div>
          <div>
            <strong>{impacto?.em_andamento ?? '—'}</strong>
            <span>em andamento</span>
          </div>
        </div>
      </header>

      {erro && (
        <p className="participacao-erro" role="alert">
          {erro}
        </p>
      )}
      {recibo && (
        <section className="participacao-recibo" aria-live="polite">
          <span>Registro confirmado</span>
          <h2>Guarde estas duas chaves.</h2>
          <dl>
            <div>
              <dt>Protocolo</dt>
              <dd>{recibo.protocolo}</dd>
            </div>
            <div>
              <dt>Token</dt>
              <dd>{recibo.token_acompanhamento}</dd>
            </div>
          </dl>
          <p>{recibo.aviso}</p>
        </section>
      )}

      <div className="participacao-grid">
        <section className="participacao-formulario">
          <div className="participacao-numero">01</div>
          <h2>Registrar manifestação</h2>
          <form onSubmit={enviar}>
            <label>
              Assunto
              <select name="categoria" required defaultValue="">
                <option value="" disabled>
                  Selecione
                </option>
                <option value="CORRECAO">Correção de dado</option>
                <option value="DADO">Solicitação de dado</option>
                <option value="SERVICO">Serviço</option>
                <option value="SUGESTAO">Sugestão</option>
                <option value="OUTRO">Outro</option>
              </select>
            </label>
            <label>
              Código IBGE do município <small>Opcional, 7 dígitos</small>
              <input name="codigo_ibge" inputMode="numeric" pattern="[0-9]{7}" maxLength={7} />
            </label>
            <label>
              Manifestação
              <textarea
                name="mensagem"
                minLength={20}
                maxLength={5000}
                rows={7}
                required
                placeholder="Descreva o fato, onde o encontrou e o que espera como devolutiva."
              />
            </label>
            <label className="participacao-consentimento">
              <input type="checkbox" name="consentimento" required />
              <span>
                Concordo com o tratamento desta manifestação para análise e devolutiva. Não inclua
                dados pessoais.
              </span>
            </label>
            <button className="btn participacao-enviar" disabled={enviando}>
              {enviando ? 'Registrando…' : 'Gerar protocolo'}
            </button>
          </form>
        </section>

        <section className="participacao-acompanhar">
          <div className="participacao-numero">02</div>
          <h2>Acompanhar devolutiva</h2>
          <p>
            O token funciona como uma chave privada. A plataforma armazena apenas seu hash e não
            consegue recuperá-lo.
          </p>
          <form onSubmit={acompanhar}>
            <label>
              Protocolo
              <input name="protocolo" required autoComplete="off" />
            </label>
            <label>
              Token de acompanhamento
              <input name="token" required autoComplete="off" />
            </label>
            <button className="btn" type="submit">
              Consultar situação
            </button>
          </form>
          {andamento && (
            <article className="participacao-andamento" aria-live="polite">
              <span>{andamento.status.replace('_', ' ')}</span>
              <h3>Devolutiva</h3>
              <p>{andamento.resposta ?? 'A manifestação ainda está em análise.'}</p>
              <small>
                Atualizado em {new Date(andamento.atualizada_em).toLocaleString('pt-BR')}
              </small>
            </article>
          )}
        </section>
      </div>
    </div>
  );
}
