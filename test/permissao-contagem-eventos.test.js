'use strict';

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');

process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'chave-de-teste';
const handler = require('../api/index.js');

const fetchOriginal = globalThis.fetch;
afterEach(() => { globalThis.fetch = fetchOriginal; });

// Simula o Supabase: usuário logado com o tipo_acesso informado; demais consultas devolvem lista vazia.
function simularUsuario(tipoAcesso, ativo = true) {
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('/auth/v1/user')) {
      return new Response(JSON.stringify({ id: 'user-1', email: 'teste@exemplo.com' }), { status: 200 });
    }
    if (u.includes('usuarios_acessos')) {
      return new Response(JSON.stringify([{ tipo_acesso: tipoAcesso, ativo }]), { status: 200 });
    }
    return new Response('[]', { status: 200, headers: { 'content-range': '*/0' } });
  };
}

async function chamar(action, args) {
  const req = {
    method: 'POST',
    headers: { authorization: 'Bearer token-teste', 'x-forwarded-for': '10.0.0.' + Math.floor(Math.random() * 250) },
    body: { action, args },
    socket: {}
  };
  const res = {
    statusCode: 200, body: null,
    setHeader() {},
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
    end() { return this; }
  };
  await handler(req, res);
  return res;
}

describe('API: total de inscritos por evento', () => {
  for (const tipo of ['clube', 'regiao']) {
    it(`bloqueia tipo_acesso "${tipo}"`, async () => {
      simularUsuario(tipo);
      const res = await chamar('portalContarInscricoesEventos', [['ev-1']]);
      assert.equal(res.statusCode, 403);
    });
  }

  it('bloqueia conta de Gabinete inativa', async () => {
    simularUsuario('distrito', false);
    const res = await chamar('portalContarInscricoesEventos', [['ev-1']]);
    assert.equal(res.statusCode, 403);
  });

  for (const tipo of ['distrito', 'evento']) {
    it(`libera tipo_acesso "${tipo}"`, async () => {
      simularUsuario(tipo);
      const res = await chamar('portalContarInscricoesEventos', [['ev-1']]);
      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.body, { 'ev-1': 0 });
    });
  }

  it('não muda outras ações para clubes', async () => {
    simularUsuario('clube');
    const res = await chamar('portalEventosComLotesAtivos', [['ev-1']]);
    assert.notEqual(res.statusCode, 403);
  });
});
