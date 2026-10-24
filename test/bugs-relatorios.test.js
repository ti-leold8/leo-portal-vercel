'use strict';

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');

process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'chave-de-teste';
const portal = require('../lib/portal_supabase.js');
const { RTMA_REGIOES } = require('../lib/rtma_config.js');
const { mesclarClubesNasRegioes } = require('../lib/clubes_sync.js');

const fetchOriginal = globalThis.fetch;
afterEach(() => { globalThis.fetch = fetchOriginal; });

describe('campanha: Leões participantes', () => {
  it('não copia o número de Companheiros LEO quando Leões é 0', () => {
    const c = portal.portalNormalizeCampanhaRow({
      id: 'c1', qtd_associados_presentes: 3, companheiros_leoes_presentes: '0'
    });
    assert.equal(c.qtdPresentes, 3);
    assert.equal(c.qtdLeoesParticipantes, 0);
  });

  it('mantém o número de Leões informado', () => {
    const c = portal.portalNormalizeCampanhaRow({
      id: 'c2', qtd_associados_presentes: 3, companheiros_leoes_presentes: '2'
    });
    assert.equal(c.qtdLeoesParticipantes, 2);
  });
});

describe('lista de clubes', () => {
  it('inclui Ômega Iporã do Oeste na Região A', () => {
    assert.ok(RTMA_REGIOES.A.includes('Ômega Iporã do Oeste'));
  });

  it('acrescenta clube ativo novo da tabela e ignora inativo, sem região ou repetido', () => {
    const novos = mesclarClubesNasRegioes([
      { nome: 'Ômega Clube Teste', status: 'Ativo', regiao: 'b' },
      { nome: 'Ômega Inativo Teste', status: 'Inativo', regiao: 'B' },
      { nome: 'Ômega Sem Regiao Teste', status: 'Ativo', regiao: null },
      { nome: 'Ômega Saudades', status: 'Ativo', regiao: 'A' }
    ]);
    assert.deepEqual(novos, ['Ômega Clube Teste']);
    assert.ok(RTMA_REGIOES.B.includes('Ômega Clube Teste'));
    RTMA_REGIOES.B.splice(RTMA_REGIOES.B.indexOf('Ômega Clube Teste'), 1);
  });
});

describe('upload direto de vídeo', () => {
  it('recusa vídeo acima de 25MB sem chamar o Supabase', async () => {
    let chamou = false;
    globalThis.fetch = async () => { chamou = true; return new Response('{}'); };
    const r = await portal.portalCriarUploadDiretoVideoCampanha('Video', 'Ômega Saudades', 'abc', 'video/mp4', 26 * 1024 * 1024);
    assert.equal(r.sucesso, false);
    assert.equal(chamou, false);
  });

  it('gera o link assinado no caminho da campanha', async () => {
    let urlChamada = '';
    globalThis.fetch = async (url) => {
      urlChamada = String(url);
      return new Response(JSON.stringify({ url: '/object/upload/sign/campanhas-videos/x?token=t' }), { status: 200 });
    };
    const r = await portal.portalCriarUploadDiretoVideoCampanha('Video', 'Ômega Saudades', 'abc', 'video/mp4', 10 * 1024 * 1024);
    assert.equal(r.sucesso, true);
    assert.match(urlChamada, /\/storage\/v1\/object\/upload\/sign\/campanhas-videos\/campanhas\/.+\/abc\/video\//);
    assert.ok(r.uploadUrl.endsWith('/storage/v1/object/upload/sign/campanhas-videos/x?token=t'));
  });

  it('confirmação recusa caminho de outra campanha', async () => {
    globalThis.fetch = async () => { throw new Error('não deveria chamar'); };
    const r = await portal.portalConfirmarUploadDiretoVideoCampanha('Ômega Saudades', 'abc', 'campanhas/outro/xyz/video/v');
    assert.equal(r.sucesso, false);
  });
});
