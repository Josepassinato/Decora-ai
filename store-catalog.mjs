/**
 * Conector nativo de catálogo de loja (ingestão própria) — p/ lojas pequenas que
 * o Google Shopping não indexa bem. Estratégia: crawl do sitemap → páginas de
 * produto → extrai {nome, preço, imagem, url, categoria} → grava no Mongo
 * (`store_products`) → busca local por relevância de tokens.
 *
 * Hoje suporta: koizadikaza (HTML server-rendered, padrão /categoria/slug/).
 * Desenhado pra crescer: adicione um extractor por loja em EXTRACTORS.
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

const fetchText = async (url, ms = 15000) => {
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'pt-BR,pt;q=0.9' }, signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
};

const fetchImageB64 = async (url, ms = 8000) => {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(ms) });
    if (!r.ok) return '';
    const ct = r.headers.get('content-type') || 'image/jpeg';
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 900000) return '';
    return `data:${ct};base64,${buf.toString('base64')}`;
  } catch { return ''; }
};

const decodeEntities = (s) => String(s || '')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').trim();

const brToNumber = (s) => {
  const m = String(s || '').replace(/[^\d.,]/g, '');
  if (!m) return 0;
  return Number(m.replace(/\./g, '').replace(',', '.')) || 0;
};

export const normalizeText = (s) => String(s || '')
  .toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '') // remove acentos
  .replace(/[^a-z0-9\s]/g, ' ')
  .replace(/\s+/g, ' ').trim();

const STOPWORDS = new Set(['de', 'da', 'do', 'das', 'dos', 'em', 'com', 'e', 'a', 'o', 'as', 'os', 'para', 'p', 'por', 'no', 'na', 'um', 'uma', 'the', 'of', 'in', 'with', 'cm', 'm']);
const tokens = (s) => normalizeText(s).split(' ').filter((t) => t && t.length > 1 && !STOPWORDS.has(t));

// ---- Extractors por loja ----------------------------------------------------

const EXTRACTORS = {
  koizadikaza: {
    base: 'https://koizadikaza.com.br',
    sitemap: 'https://koizadikaza.com.br/sitemap.xml',
    // produto = exatamente 2 segmentos de path (/categoria/slug/); exclui institucionais
    isProductPath: (p) => {
      const parts = p.replace(/^\/|\/$/g, '').split('/');
      if (parts.length !== 2) return false;
      const bad = /^(login|cadastro|contato|empresa|documentos|conta|carrinho|checkout|buscar-por|perguntas)/i;
      return !bad.test(parts[0]);
    },
    parse: (html, url) => {
      const name = decodeEntities((html.match(/class="product-name"[^>]*>\s*([^<]+)</i) || [])[1] || (html.match(/<title>([^<]+)<\/title>/i) || [])[1] || '');
      if (!name) return null;
      // preço principal: primeiro .price dentro do bloco price-container
      let price = 0;
      const pc = html.match(/class="price-container"[\s\S]{0,400}?class="price"[^>]*>\s*([^<]+)</i);
      if (pc) price = brToNumber(pc[1]);
      if (!price) price = brToNumber((html.match(/R\$\s*[0-9][0-9.,]*/) || [])[0]);
      // imagem: foto de produto (arquivos/produtos)
      const img = (html.match(/https:\/\/koizadikaza\.com\.br\/arquivos\/produtos\/[^"'\s)]+\.(?:webp|jpe?g|png)/i) || [])[0]
        || (html.match(/https:\/\/koizadikaza\.com\.br\/resize\/imagecache\/[a-f0-9]+/i) || [])[0] || '';
      const category = url.replace(EXTRACTORS.koizadikaza.base, '').replace(/^\/|\/$/g, '').split('/')[0].replace(/-/g, ' ');
      return { name, price, image: img, url, category };
    },
  },
};

export const hasNativeConnector = (providerId) => Boolean(EXTRACTORS[providerId]);

// ---- Crawl ------------------------------------------------------------------

const mapPool = async (items, n, fn) => {
  const out = [];
  let i = 0;
  const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      try { out[idx] = await fn(items[idx], idx); } catch { out[idx] = null; }
    }
  });
  await Promise.all(workers);
  return out;
};

/** Crawl + upsert no Mongo. Retorna { provider, total, saved }. */
export const syncStoreCatalog = async (db, providerId, { limit = 0, concurrency = 8 } = {}) => {
  const ex = EXTRACTORS[providerId];
  if (!ex) throw new Error(`sem conector nativo para ${providerId}`);
  if (!db) throw new Error('Mongo indisponível');
  const sm = await fetchText(ex.sitemap, 20000);
  let locs = Array.from(sm.matchAll(/<loc>([^<]+)<\/loc>/g)).map((m) => decodeEntities(m[1]));
  let productUrls = locs.filter((u) => { try { return ex.isProductPath(new URL(u).pathname); } catch { return false; } });
  if (limit > 0) productUrls = productUrls.slice(0, limit);

  const col = db.collection('store_products');
  await col.createIndex({ providerId: 1, url: 1 }, { unique: true });
  await col.createIndex({ providerId: 1 });

  let saved = 0;
  await mapPool(productUrls, concurrency, async (url) => {
    let html;
    try { html = await fetchText(url, 15000); } catch { return; }
    const p = ex.parse(html, url);
    if (!p || !p.name || !p.price) return;
    await col.updateOne(
      { providerId, url: p.url },
      { $set: { providerId, name: p.name, nameNorm: normalizeText(p.name), price: p.price, currency: 'BRL', image: p.image, url: p.url, category: p.category, tokens: tokens(p.name), updatedAt: new Date() } },
      { upsert: true },
    );
    saved += 1;
  });
  return { provider: providerId, total: productUrls.length, saved };
};

// ---- Busca local ------------------------------------------------------------

/** Busca por relevância de tokens no catálogo local. Retorna shape compatível com serpShopping. */
export const searchLocalCatalog = async (db, providerId, query, { limit = 4, withImage = false } = {}) => {
  if (!db) return [];
  const qTokens = tokens(query);
  if (!qTokens.length) return [];
  const col = db.collection('store_products');
  // candidatos: produtos que compartilham ao menos 1 token (rápido com array index não-textual; varremos provider)
  const docs = await col.find({ providerId, tokens: { $in: qTokens } }).limit(400).toArray();
  const scored = docs.map((d) => {
    const set = new Set(d.tokens || []);
    let hits = 0;
    for (const t of qTokens) if (set.has(t)) hits += 1;
    const coverage = hits / qTokens.length;
    return { d, score: hits * 10 + coverage * 5 - (d.name.length / 100) };
  }).sort((a, b) => b.score - a.score).slice(0, limit);

  const items = [];
  for (const { d } of scored) {
    const item = {
      name: d.name,
      price: Number(d.price || 0),
      currency: d.currency || 'BRL',
      source: EXTRACTORS[providerId]?.base?.replace(/^https?:\/\/(www\.)?/, '') || providerId,
      inStore: true,
      link: d.url,
      thumbnail: d.image || '',
      image: '',
    };
    if (withImage && d.image) item.image = await fetchImageB64(d.image);
    items.push(item);
  }
  return items;
};
