'use strict';

// Completa a lista fixa de clubes (RTMA_REGIOES) com os clubes ativos da tabela
// `clubes` do Supabase. Assim um clube novo (ex.: Ômega Iporã do Oeste) aparece nas
// telas distritais sem precisar mudar o código.
//
// Fica fora da lista de módulos do api/index.js de propósito: tudo que aqueles
// módulos exportam vira uma ação chamável pela API.

const { RTMA_REGIOES, rtmaClubeExiste } = require('./rtma_config');

const TTL_MS = 10 * 60 * 1000;
let ultimaSincronizacao = 0;
let emAndamento = null;

/**
 * Acrescenta (nunca remove) os clubes ativos com região conhecida. Altera os arrays
 * no lugar, porque vários módulos guardam referência a RTMA_REGIOES.
 * @param {Array<{nome:string,status?:string,regiao?:string}>} clubes
 * @return {string[]} nomes acrescentados
 */
function mesclarClubesNasRegioes(clubes) {
  const acrescentados = [];
  (Array.isArray(clubes) ? clubes : []).forEach(c => {
    const nome = String((c && c.nome) || '').trim();
    const regiao = String((c && c.regiao) || '').trim().toUpperCase();
    const status = String((c && c.status) || '').trim();
    if (!nome || status !== 'Ativo' || !RTMA_REGIOES[regiao]) return;
    if (rtmaClubeExiste(nome)) return;
    RTMA_REGIOES[regiao].push(nome);
    RTMA_REGIOES[regiao].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    acrescentados.push(nome);
  });
  return acrescentados;
}

/** Busca a tabela `clubes` no máximo a cada 10 min por instância. Nunca lança erro. */
async function sincronizarClubesDoSupabase() {
  if (Date.now() - ultimaSincronizacao < TTL_MS) return;
  if (emAndamento) return emAndamento;
  // Marca antes de buscar: se o Supabase falhar, só tenta de novo após o TTL.
  ultimaSincronizacao = Date.now();
  emAndamento = (async () => {
    try {
      const url = process.env.SUPABASE_URL || 'https://bqkttaflhtsdkamgscnf.supabase.co';
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
      if (!key) return;
      const res = await fetch(`${url}/rest/v1/clubes?select=nome,status,regiao`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(3000)
      });
      if (res.status !== 200) return;
      const novos = mesclarClubesNasRegioes(await res.json());
      if (novos.length) console.log('[clubes_sync] Clubes acrescentados:', novos.join(', '));
    } catch (e) {
      console.warn('[clubes_sync] Falha ao sincronizar clubes:', e && e.message);
    } finally {
      emAndamento = null;
    }
  })();
  return emAndamento;
}

module.exports = { mesclarClubesNasRegioes, sincronizarClubesDoSupabase };
