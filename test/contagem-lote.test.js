'use strict';

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');

process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'chave-de-teste';
const portal = require('../lib/portal_supabase.js');

const fetchOriginal = globalThis.fetch;
afterEach(() => { globalThis.fetch = fetchOriginal; });

// Simula o Supabase: a primeira resposta traz só 1 linha (Range 0-0) e o total no cabeçalho.
function simularSupabase({ total, linhas, status = 206 }) {
  const chamadas = [];
  globalThis.fetch = async (url, opts) => {
    chamadas.push({ url, opts });
    const comRange = opts && opts.headers && opts.headers.Range;
    const headers = {};
    if (comRange && total !== undefined) headers['content-range'] = '0-0/' + total;
    const corpo = comRange ? linhas.slice(0, 1) : linhas;
    return new Response(JSON.stringify(corpo), { status: comRange ? status : 200, headers });
  };
  return chamadas;
}

describe('portalContarInscricoesPorLote', () => {
  it('usa o total do cabeçalho content-range (minúsculo, como o Node entrega)', async () => {
    const linhas = Array.from({ length: 126 }, (_, i) => ({ id: i }));
    simularSupabase({ total: 126, linhas });
    assert.equal(await portal.portalContarInscricoesPorLote('lote-1'), 126);
  });

  it('sem cabeçalho de total, conta todas as linhas em vez de só a primeira', async () => {
    const linhas = Array.from({ length: 229 }, (_, i) => ({ id: i }));
    const chamadas = simularSupabase({ total: undefined, linhas });
    assert.equal(await portal.portalContarInscricoesPorLote('lote-2'), 229);
    assert.equal(chamadas.length, 2);
  });

  it('erro do Supabase bloqueia em vez de dizer que o lote está vazio', async () => {
    globalThis.fetch = async () => new Response('{"message":"falha"}', { status: 500 });
    await assert.rejects(() => portal.portalContarInscricoesPorLote('lote-3'));
  });
});
