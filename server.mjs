import { createServer } from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { MongoClient } from 'mongodb';
import { GoogleGenAI } from '@google/genai';

const loadEnvFile = async () => {
  try {
    const raw = await fs.readFile(path.join(process.cwd(), '.env'), 'utf8');
    raw.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) return;
      const index = trimmed.indexOf('=');
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
      if (key && process.env[key] === undefined) process.env[key] = value;
    });
  } catch {
    // .env is optional; production can provide process env directly.
  }
};

await loadEnvFile();

const PORT = Number(process.env.PORT || 8018);
const DATA_DIR = process.env.DECORA_DATA_DIR || path.join(process.cwd(), 'data');
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
const MONGO_DB_NAME = process.env.MONGO_DB_NAME || 'decore_ai';
const DEFAULT_CLIENT_ID = 'default';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.API_KEY || '';

let mongoClient = null;
let mongoDb = null;
let mongoRetryAfter = 0;
let geminiClient = null;

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
    id: 'target',
    name: 'Target',
    status: 'active',
    validation: 'direct-link-or-search',
    searchUrl: 'https://www.target.com/s?searchTerm=',
    note: 'Objetos de decoracao, iluminacao simples, textiles e acentos acessiveis.',
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

const getMongoDb = async () => {
  if (mongoDb) return mongoDb;
  if (Date.now() < mongoRetryAfter) return null;
  try {
    mongoClient = new MongoClient(MONGO_URI, {
      serverSelectionTimeoutMS: 1500,
      connectTimeoutMS: 1500,
    });
    await mongoClient.connect();
    mongoDb = mongoClient.db(MONGO_DB_NAME);
    await mongoDb.collection('projects').createIndex({ createdAt: -1 });
    await mongoDb.collection('decor_styles').createIndex({ id: 1 }, { unique: true });
    await mongoDb.collection('credits').createIndex({ clientId: 1 }, { unique: true });
    return mongoDb;
  } catch (error) {
    mongoDb = null;
    mongoClient = null;
    mongoRetryAfter = Date.now() + 15000;
    console.warn('MongoDB unavailable, using local fallback:', error.message || error);
    return null;
  }
};

const storageStatus = async () => {
  const db = await getMongoDb();
  return db ? 'mongo' : 'local';
};

const getGeminiClient = () => {
  if (!GEMINI_API_KEY) return null;
  if (!geminiClient) geminiClient = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  return geminiClient;
};

const serializeGeminiResponse = (response) => ({
  text: response?.text || '',
  candidates: response?.candidates || [],
  usageMetadata: response?.usageMetadata || null,
});

const geminiErrorMessage = (error) => {
  const message = String(error?.message || error || 'Gemini request failed');
  if (message.includes('reported as leaked')) return 'Gemini API key was rejected as leaked.';
  if (message.includes('PERMISSION_DENIED')) return 'Gemini API key was rejected by Google.';
  return message.slice(0, 500);
};

const readStoredProjects = async () => {
  const db = await getMongoDb();
  if (!db) {
    const projects = await readProjects();
    return projects.slice().reverse();
  }
  const docs = await db.collection('projects')
    .find({}, { projection: { _id: 0 } })
    .sort({ createdAt: -1 })
    .limit(100)
    .toArray();
  return docs;
};

const saveStoredProject = async (project) => {
  const db = await getMongoDb();
  if (!db) {
    const projects = await readProjects();
    projects.push(project);
    await writeProjects(projects);
    return project;
  }
  await db.collection('projects').insertOne(project);
  return project;
};

const readStyles = async () => {
  const db = await getMongoDb();
  if (!db) return { storage: 'local', styles: [] };
  const styles = await db.collection('decor_styles')
    .find({}, { projection: { _id: 0 } })
    .sort({ order: 1, id: 1 })
    .toArray();
  return { storage: 'mongo', styles };
};

const seedStyles = async (styles) => {
  const db = await getMongoDb();
  if (!db) return { storage: 'local', inserted: 0 };
  const collection = db.collection('decor_styles');
  const existing = await collection.estimatedDocumentCount();
  if (existing > 0) return { storage: 'mongo', inserted: 0, existing };
  const docs = (Array.isArray(styles) ? styles : [])
    .filter((style) => style && style.id)
    .map((style, index) => ({ ...style, order: index, updatedAt: new Date().toISOString() }));
  if (!docs.length) return { storage: 'mongo', inserted: 0 };
  const result = await collection.insertMany(docs, { ordered: false });
  return { storage: 'mongo', inserted: result.insertedCount };
};

const readConfig = async () => {
  const db = await getMongoDb();
  if (!db) return { storage: 'local', config: [] };
  const config = await db.collection('system_config')
    .find({}, { projection: { _id: 0 } })
    .sort({ key: 1 })
    .toArray();
  return { storage: 'mongo', config };
};

const getCredits = async (clientId = DEFAULT_CLIENT_ID) => {
  const db = await getMongoDb();
  if (!db) return { storage: 'local', clientId, credits: 1000 };
  const collection = db.collection('credits');
  const result = await collection.findOneAndUpdate(
    { clientId },
    { $setOnInsert: { clientId, credits: 1000, createdAt: new Date().toISOString() } },
    { upsert: true, returnDocument: 'after', projection: { _id: 0 } },
  );
  const doc = result?.value || result || { clientId, credits: 1000 };
  return { storage: 'mongo', ...doc };
};

const deductCredits = async (amount, clientId = DEFAULT_CLIENT_ID) => {
  const db = await getMongoDb();
  const safeAmount = Math.max(0, Number(amount || 0));
  if (!db) return { storage: 'local', clientId, credits: null };
  const collection = db.collection('credits');
  await getCredits(clientId);
  const result = await collection.findOneAndUpdate(
    { clientId },
    [
      {
        $set: {
          credits: { $max: [0, { $subtract: ['$credits', safeAmount] }] },
          updatedAt: new Date().toISOString(),
        },
      },
    ],
    { returnDocument: 'after', projection: { _id: 0 } },
  );
  const doc = result?.value || result || { clientId, credits: 1000 };
  return { storage: 'mongo', ...doc };
};

const isProviderUrl = (url, providerId) => {
  try {
    const host = new URL(url).hostname;
    if (providerId === 'wayfair') return host === 'wayfair.com' || host.endsWith('.wayfair.com');
    if (providerId === 'target') return host === 'target.com' || host.endsWith('.target.com');
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
    if (providerId === 'target') return parsed.pathname.includes('/p/');
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
    budgetTier: String(payload.budgetTier || ''),
    budgetRange: String(payload.budgetRange || ''),
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
      return json(res, 200, {
        ok: true,
        service: 'decora-api',
        storage: await storageStatus(),
        database: MONGO_DB_NAME,
        timestamp: new Date().toISOString(),
      });
    }
    if (req.method === 'GET' && url.pathname === '/api/providers') {
      return json(res, 200, { providers: PROVIDERS });
    }
    if (req.method === 'GET' && url.pathname === '/api/styles') {
      return json(res, 200, await readStyles());
    }
    if (req.method === 'POST' && url.pathname === '/api/styles/seed') {
      const body = await readBody(req);
      return json(res, 200, await seedStyles(body.styles));
    }
    if (req.method === 'GET' && url.pathname === '/api/config') {
      return json(res, 200, await readConfig());
    }
    if (req.method === 'GET' && url.pathname === '/api/credits') {
      return json(res, 200, await getCredits(url.searchParams.get('clientId') || DEFAULT_CLIENT_ID));
    }
    if (req.method === 'POST' && url.pathname === '/api/credits/deduct') {
      const body = await readBody(req);
      return json(res, 200, await deductCredits(body.amount, body.clientId || DEFAULT_CLIENT_ID));
    }
    if (req.method === 'POST' && url.pathname === '/api/gemini/generate') {
      const body = await readBody(req);
      const client = getGeminiClient();
      if (!client) {
        return json(res, 503, {
          error: 'gemini_not_configured',
          message: 'Gemini API key is not configured on the server.',
        });
      }

      const model = String(body.model || '');
      if (!model.startsWith('gemini-')) {
        return json(res, 400, { error: 'invalid_model', message: 'Invalid Gemini model.' });
      }

      try {
        const response = await client.models.generateContent({
          model,
          contents: body.contents,
          ...(body.config ? { config: body.config } : {}),
        });
        return json(res, 200, serializeGeminiResponse(response));
      } catch (error) {
        console.error('Gemini generation failed:', error?.message || error);
        return json(res, 502, { error: 'gemini_error', message: geminiErrorMessage(error) });
      }
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
      const projects = await readStoredProjects();
      return json(res, 200, { storage: await storageStatus(), projects });
    }
    if (req.method === 'POST' && url.pathname === '/api/projects') {
      const body = await readBody(req);
      const project = normalizeProject(body);
      await saveStoredProject(project);
      return json(res, 201, { storage: await storageStatus(), project });
    }
    json(res, 404, { error: 'not_found' });
  } catch (error) {
    console.error(error);
    json(res, 500, { error: 'internal_error', message: String(error.message || error) });
  }
}).listen(PORT, () => {
  console.log(`Decora API listening on ${PORT}`);
});
