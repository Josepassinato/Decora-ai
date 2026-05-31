import { createServer } from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const PORT = Number(process.env.PORT || 8018);
const DATA_DIR = process.env.DECORA_DATA_DIR || path.join(process.cwd(), 'data');
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');

const PROVIDERS = [
  {
    id: 'wayfair',
    name: 'Wayfair',
    status: 'active',
    validation: 'direct-link-or-search',
    searchUrl: 'https://www.wayfair.com/keyword.php?keyword=',
    note: 'Fornecedor principal: catalogo online amplo, links publicos e validacao por produto ou busca.',
  },
  {
    id: 'home-depot',
    name: 'Home Depot',
    status: 'planned',
    validation: 'api-or-search',
    searchUrl: 'https://www.homedepot.com/s/',
    note: 'Indicado para materiais de obra e acabamentos, nao para decoracao fina.',
  },
  {
    id: 'ikea',
    name: 'IKEA',
    status: 'planned',
    validation: 'search',
    searchUrl: 'https://www.ikea.com/us/en/search/?q=',
    note: 'Bom para moveis modulares e projetos economicos.',
  },
  {
    id: 'west-elm',
    name: 'West Elm',
    status: 'planned',
    validation: 'search',
    searchUrl: 'https://www.westelm.com/search/results.html?words=',
    note: 'Bom para decoracao premium e ambientes mais autorais.',
  },
  {
    id: 'manual-catalog',
    name: 'Catalogo manual',
    status: 'planned',
    validation: 'curated',
    searchUrl: '',
    note: 'Para lojas sem catalogo publico, como HomeSense, usando itens cadastrados pela equipe.',
  },
];

const json = (res, status, body) => {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(payload);
};

const readBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
};

const ensureStore = async () => {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(PROJECTS_FILE);
  } catch {
    await fs.writeFile(PROJECTS_FILE, '[]\n');
  }
};

const readProjects = async () => {
  await ensureStore();
  const raw = await fs.readFile(PROJECTS_FILE, 'utf8');
  const parsed = JSON.parse(raw || '[]');
  return Array.isArray(parsed) ? parsed : [];
};

const writeProjects = async (projects) => {
  await ensureStore();
  await fs.writeFile(PROJECTS_FILE, `${JSON.stringify(projects, null, 2)}\n`);
};

const isProviderUrl = (url, providerId) => {
  try {
    const host = new URL(url).hostname;
    if (providerId === 'wayfair') return host === 'wayfair.com' || host.endsWith('.wayfair.com');
    if (providerId === 'home-depot') return host === 'homedepot.com' || host.endsWith('.homedepot.com');
    if (providerId === 'ikea') return host === 'ikea.com' || host.endsWith('.ikea.com');
    if (providerId === 'west-elm') return host === 'westelm.com' || host.endsWith('.westelm.com');
    return false;
  } catch {
    return false;
  }
};

const isDirectProductUrl = (url, providerId) => {
  try {
    const parsed = new URL(url);
    if (!isProviderUrl(url, providerId)) return false;
    if (providerId === 'wayfair') return !parsed.pathname.includes('keyword.php');
    if (providerId === 'home-depot') return !parsed.pathname.startsWith('/s/');
    if (providerId === 'ikea') return !parsed.pathname.includes('/search/');
    if (providerId === 'west-elm') return !parsed.pathname.includes('/search/');
    return true;
  } catch {
    return false;
  }
};

const buildSearchUrl = (provider, term) =>
  provider.searchUrl ? `${provider.searchUrl}${encodeURIComponent(String(term || 'home decor').trim())}` : '';

const normalizeProject = (payload) => {
  const providerId = payload.providerId || 'wayfair';
  const provider = PROVIDERS.find((entry) => entry.id === providerId) || PROVIDERS[0];
  const budgetItems = Array.isArray(payload.budgetItems) ? payload.budgetItems : [];
  const normalizedItems = budgetItems.map((item) => {
    const name = String(item.name || 'Decor item').trim();
    const url = String(item.url || '');
    const directProduct = isDirectProductUrl(url, provider.id);
    const quantity = Math.max(1, Number(item.quantity || 1));
    const unitPrice = Math.max(0, Number(item.unitPrice || 0));
    return {
      name,
      category: String(item.category || 'Decor'),
      quantity,
      unitPrice,
      totalPrice: Number((quantity * unitPrice).toFixed(2)),
      url: isProviderUrl(url, provider.id) ? url : buildSearchUrl(provider, name),
      validation: directProduct ? 'direct_product' : 'search_result',
      note: String(item.note || ''),
    };
  });

  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    providerId: provider.id,
    providerName: provider.name,
    room: String(payload.room || ''),
    style: String(payload.style || ''),
    status: payload.status || 'proposal',
    total: normalizedItems.reduce((sum, item) => sum + item.totalPrice, 0),
    budgetItems: normalizedItems,
    budgetNote: String(payload.budgetNote || ''),
    report: String(payload.report || ''),
    previewImage: String(payload.previewImage || '').slice(0, 500000),
  };
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    if (req.method === 'GET' && url.pathname === '/api/health') {
      return json(res, 200, { ok: true, service: 'decora-api', timestamp: new Date().toISOString() });
    }
    if (req.method === 'GET' && url.pathname === '/api/providers') {
      return json(res, 200, { providers: PROVIDERS });
    }
    if (req.method === 'POST' && url.pathname === '/api/catalog/validate') {
      const body = await readBody(req);
      const provider = PROVIDERS.find((entry) => entry.id === (body.providerId || 'wayfair')) || PROVIDERS[0];
      const itemName = String(body.itemName || '').trim();
      return json(res, 200, {
        providerId: provider.id,
        providerName: provider.name,
        itemName,
        url: buildSearchUrl(provider, itemName),
        validation: provider.status === 'active' ? 'search_result' : 'planned_provider',
        note: provider.note,
      });
    }
    if (req.method === 'GET' && url.pathname === '/api/projects') {
      const projects = await readProjects();
      return json(res, 200, { projects: projects.slice().reverse() });
    }
    if (req.method === 'POST' && url.pathname === '/api/projects') {
      const body = await readBody(req);
      const projects = await readProjects();
      const project = normalizeProject(body);
      projects.push(project);
      await writeProjects(projects);
      return json(res, 201, { project });
    }
    json(res, 404, { error: 'not_found' });
  } catch (error) {
    console.error(error);
    json(res, 500, { error: 'internal_error', message: String(error.message || error) });
  }
}).listen(PORT, () => {
  console.log(`Decora API listening on ${PORT}`);
});
