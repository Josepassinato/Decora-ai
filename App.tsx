import React, { useState, useRef, useEffect, useCallback, type ReactNode, type FC } from 'react';
import ReactDOM from 'react-dom/client';
import { UploadCloud, Sofa, BedDouble, Baby, LampDesk, CookingPot, Bath, Wand2, PartyPopper, XCircle, FileText, Utensils, Tv, Shirt, Trees, DoorOpen, Waves, Bed, BedSingle, Clapperboard, CarFront, Flame, Umbrella, Building2, Briefcase, Stethoscope, Dumbbell, Coffee, Presentation, Gamepad2, Store, Download, FileDown, Coins, CreditCard, LogOut, Lock, ShieldCheck, CheckCircle2, ClipboardList, HardHat, Info, Rocket, Palette, Calendar, ExternalLink, Layers, Eye, ImagePlus, Camera, Maximize, PaintBucket, RefreshCw, Hexagon, Sparkles, ShoppingBag, HelpCircle, Globe, Stamp, Wifi, WifiOff, Database, HardDrive, Bell } from 'lucide-react';
import { loadStripe } from "@stripe/stripe-js";
import { jsPDF } from "jspdf";

// --- CONFIGURAÇÃO DE AMBIENTE ---

const STRIPE_PUBLIC_KEY = "pk_live_51STX0AGP0hzTc9bmcPigXv82Tr0ee11AV3YFHpZZgvjq0JFvKUMZLHP4P2keTn2BhaPj90tTFNkw2N1iQXoSNqhU00K4M923KK"; 

// --- "THE VAULT": MEMÓRIA DE SISTEMA (FALLBACK/DEFAULT) ---
const DEFAULT_SYSTEM_MEMORY = {
	    ARCHITECT_PROTOCOL: `
	      CRITICAL SYSTEM DIRECTIVES (NON-NEGOTIABLE):
	      1. STRUCTURAL LOCK: Existing walls, ceiling height, floor plan, doors, windows, columns, beams, stairs and fixed plumbing locations are immutable.
	      2. NO STRUCTURAL EDITS: Never create, remove, move, widen or close openings, windows, doors, walls, columns or stairs.
	      3. COSMETIC FREEDOM: You may change wall colors, wallpaper, paint finishes, decorative cladding, movable furniture, rugs, curtains, art, mirrors, plants and special lighting.
	      4. BLANK WALL STRATEGY: If a wall is blank, improve it cosmetically with paint, wallpaper, art, lighting, removable panels or decor. Do not create architectural openings.
	      5. DIMENSION LOCK: The room must remain identical in scale, proportions, depth, width, ceiling height, perspective and camera viewpoint. Never stretch, shrink, rotate, reframe or rearrange the room.
	      6. LAYOUT LOCK: Keep the exact location of every wall edge, floor edge, ceiling edge, doorway, window, built-in element, plumbing fixture, staircase and column. New objects must adapt to the existing room, not the opposite.
      
      MANDATORY 2025 LUXURY SPECS:
      - LIGHTING: Magnetic Track Systems (Trilho Magnético), Linear LED Profiles (3000K). NO central simple bulbs.
      - MATERIALS: Fluted Wood (Ripado), Natural Stone (Travertine/Calacatta), Matte Lacquer, Bronze Glass.
      - FURNITURE: Floor-to-ceiling custom joinery. High-end Italian design.
    `,
	    RENDERER_PROTOCOL: `
	      VISUAL GENERATION HARD CONSTRAINTS:
	      1. PRESERVE GEOMETRY: Keep the same room shell, wall positions, floor plan, ceiling, windows, doors, columns, stairs and fixed openings.
	      2. ANTI-HALLUCINATION: Do not add new windows, doors, arches, balconies, fireplaces, skylights or exterior views where they do not already exist.
	      3. ALLOWED CHANGES: Change wall colors, wallpaper, paint, removable cladding, lighting fixtures/effects, furniture, textiles, rugs, decor and accessories.
	      4. CAMERA LOCK: Keep the exact same viewpoint, lens perspective, crop, aspect ratio and camera distance as the input image.
	      5. DIMENSION LOCK: Keep identical room dimensions and proportions. Do not make the room larger, smaller, wider, deeper, taller, more open or more enclosed.
	      6. OBJECT PLACEMENT LOCK: New movable furniture and decor must fit inside the existing photographed space without moving walls, windows, doors, fixed counters, fixed closets, plumbing, stairs or columns.
	      7. TEXTURE QUALITY: 8K Photorealism.
	      8. LIGHTING PHYSICS: Use warm layered lighting, accent lighting, wall washers, LED strips, pendants, sconces or lamps when appropriate.
	    `
};

// --- INICIALIZAÇÃO DE SERVIÇOS ---

let stripePromise: any = null;

try {
    if (STRIPE_PUBLIC_KEY) stripePromise = loadStripe(STRIPE_PUBLIC_KEY);
    console.log("🚀 WayDecor: serviços do cliente inicializados.");
} catch (e) {
    console.error("Erro crítico na inicialização dos serviços:", e);
}

// --- REDIMENSIONAMENTO DE IMAGEM (CLIENT SIDE) ---
const resizeImage = (base64Str: string, maxWidth = 1280, maxHeight = 1280): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.78));
    };
    img.onerror = () => reject(new Error('Formato de imagem não suportado. Use JPG, PNG ou tire uma nova foto pela câmera.'));
  });
};

// --- CONSTANTS & DATA ---

type Language = 'pt' | 'en' | 'es';

type WayfairBudgetItem = {
  name: string;
  category: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  url: string;
  validation: 'direct_product' | 'search_result';
  note?: string;
};

type BudgetTierId = 'essential' | 'balanced' | 'premium';

type BudgetTier = {
  id: BudgetTierId;
  min: number;
  max: number | null;
  labels: Record<Language, string>;
  subtitles: Record<Language, string>;
  prompt: string;
};

const BUDGET_TIERS: BudgetTier[] = [
  {
    id: 'essential',
    min: 0,
    max: 2000,
    labels: { pt: 'Até $2.000', en: 'Up to $2,000', es: 'Hasta $2,000' },
    subtitles: {
      pt: 'Prioriza impacto visual com peças essenciais e bons achados.',
      en: 'Prioritizes visual impact with essential pieces and good finds.',
      es: 'Prioriza impacto visual con piezas esenciales y buenos hallazgos.',
    },
    prompt: 'Essential budget. Keep the complete shopping list total at or below USD 2,000. Favor affordable pieces, accents, lighting, rugs and compact furniture with high visual impact.',
  },
  {
    id: 'balanced',
    min: 2000,
    max: 5000,
    labels: { pt: '$2.000 a $5.000', en: '$2,000 to $5,000', es: '$2,000 a $5,000' },
    subtitles: {
      pt: 'Equilibra móveis principais, iluminação e decoração de melhor acabamento.',
      en: 'Balances key furniture, lighting and better-finished decor.',
      es: 'Equilibra muebles principales, iluminación y decoración de mejor acabado.',
    },
    prompt: 'Balanced budget. Target a complete shopping list between USD 2,000 and USD 5,000. Mix good-value core furniture with better lighting, rug, decor and storage choices.',
  },
  {
    id: 'premium',
    min: 5000,
    max: null,
    labels: { pt: 'Acima de $5.000', en: 'Above $5,000', es: 'Más de $5,000' },
    subtitles: {
      pt: 'Usa peças premium e uma composição mais sofisticada, sem limite rígido.',
      en: 'Uses premium pieces and a more sophisticated composition, without a hard cap.',
      es: 'Usa piezas premium y una composición más sofisticada, sin límite rígido.',
    },
    prompt: 'Premium budget. Use higher-end pieces and a more complete composition. The total may exceed USD 5,000, but avoid waste and keep choices commercially realistic.',
  },
];

const getBudgetTier = (id: BudgetTierId) =>
  BUDGET_TIERS.find(tier => tier.id === id) || BUDGET_TIERS[0];

const getBudgetRangeLabel = (tier: BudgetTier, language: Language = 'pt') => tier.labels[language];

const WAYFAIR_BASE_URL = 'https://www.wayfair.com';
const WAYFAIR_SEARCH_URL = `${WAYFAIR_BASE_URL}/keyword.php?keyword=`;
const TARGET_BASE_URL = 'https://www.target.com';
const TARGET_SEARCH_URL = `${TARGET_BASE_URL}/s?searchTerm=`;
const DECORE_HERO_COMPARISON = '/assets/decore-hero-before-after.png';

const PRODUCT_PROVIDERS = [
  { id: 'wayfair', name: 'Wayfair', status: 'active', baseUrl: WAYFAIR_BASE_URL, searchUrl: WAYFAIR_SEARCH_URL, note: 'Fornecedor principal para decoracao compravel.' },
  { id: 'target', name: 'Target', status: 'active', baseUrl: TARGET_BASE_URL, searchUrl: TARGET_SEARCH_URL, note: 'Objetos, iluminacao simples e decoracao acessivel.' },
  { id: 'home-depot', name: 'Home Depot', status: 'planned', baseUrl: 'https://www.homedepot.com', searchUrl: 'https://www.homedepot.com/s/', note: 'Materiais e acabamentos de obra.' },
  { id: 'ikea', name: 'IKEA', status: 'planned', baseUrl: 'https://www.ikea.com', searchUrl: 'https://www.ikea.com/us/en/search/?q=', note: 'Moveis modulares e economicos.' },
  { id: 'west-elm', name: 'West Elm', status: 'planned', baseUrl: 'https://www.westelm.com', searchUrl: 'https://www.westelm.com/search/results.html?words=', note: 'Decoracao premium.' },
  { id: 'manual-catalog', name: 'Catalogo manual', status: 'planned', baseUrl: '', searchUrl: '', note: 'Lojas sem catalogo publico, como HomeSense.' },
];

type ProductProviderConfig = typeof PRODUCT_PROVIDERS[number];

const getProductProvider = (id: string): ProductProviderConfig =>
  PRODUCT_PROVIDERS.find(provider => provider.id === id) || PRODUCT_PROVIDERS[0];

const buildProductSearchUrl = (provider: ProductProviderConfig, term: string) =>
  provider.searchUrl ? `${provider.searchUrl}${encodeURIComponent(term.trim() || 'home decor')}` : '';

const isProductProviderUrl = (url: string, provider: ProductProviderConfig) => {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');
    if (provider.id === 'wayfair') return host === 'wayfair.com' || host.endsWith('.wayfair.com');
    if (provider.id === 'target') return host === 'target.com' || host.endsWith('.target.com');
    if (provider.id === 'home-depot') return host === 'homedepot.com' || host.endsWith('.homedepot.com');
    if (provider.id === 'ikea') return host === 'ikea.com' || host.endsWith('.ikea.com');
    if (provider.id === 'west-elm') return host === 'westelm.com' || host.endsWith('.westelm.com');
    return false;
  } catch {
    return false;
  }
};

const isDirectProductUrl = (url: string, provider: ProductProviderConfig) => {
  try {
    const parsed = new URL(url);
    if (!isProductProviderUrl(url, provider)) return false;
    if (provider.id === 'wayfair') return !parsed.pathname.includes('keyword.php');
    if (provider.id === 'target') return parsed.pathname.includes('/p/');
    if (provider.id === 'home-depot') return !parsed.pathname.startsWith('/s/');
    if (provider.id === 'ikea') return !parsed.pathname.includes('/search/');
    if (provider.id === 'west-elm') return !parsed.pathname.includes('/search/');
    return true;
  } catch {
    return false;
  }
};

const toMoney = (value: number) =>
  value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

const normalizeShoppingItem = (raw: any, provider: ProductProviderConfig): WayfairBudgetItem | null => {
  if (!raw || typeof raw !== 'object') return null;
  const name = String(raw.name || '').trim();
  const category = String(raw.category || 'Decor').trim();
  const quantity = Math.max(1, Number(raw.quantity || 1));
  const unitPrice = Math.max(0, Number(raw.unitPrice || raw.price || 0));
  const proposedUrl = String(raw.url || '').trim();
  const url = isProductProviderUrl(proposedUrl, provider) ? proposedUrl : buildProductSearchUrl(provider, name || category);
  if (!name) return null;
  return {
    name,
    category,
    quantity,
    unitPrice,
    totalPrice: Number((unitPrice * quantity).toFixed(2)),
    url,
    validation: proposedUrl && isDirectProductUrl(proposedUrl, provider) ? 'direct_product' : 'search_result',
    note: String(raw.note || '').trim(),
  };
};

// CSS linear-gradient direto: garante render mesmo se Tailwind CDN JIT falhar
// em arbitrary values dinamicos. Bug pre-fix: gradientes Tailwind nao apareciam.
const STYLE_GRADIENTS: Record<string, string> = {
  modern:               'linear-gradient(135deg, #2f1a35 0%, #7f187f 50%, #f2d2a9 100%)',
  industrial:           'linear-gradient(135deg, #252525 0%, #5d4d43 50%, #c0834b 100%)',
  scandinavian:         'linear-gradient(135deg, #f8f5f2 0%, #d8c8b5 50%, #91a3a8 100%)',
  luxury_italian:       'linear-gradient(135deg, #28172b 0%, #7f187f 50%, #d4af37 100%)',
  brazilian_modernism:  'linear-gradient(135deg, #533d2e 0%, #b98552 50%, #3d7f5c 100%)',
  japandi:              'linear-gradient(135deg, #efe6d6 0%, #8f7d6b 50%, #2e3a35 100%)',
  biophilic:            'linear-gradient(135deg, #183f2b 0%, #4f9d69 50%, #d8c8b5 100%)',
  mid_century:          'linear-gradient(135deg, #4f3626 0%, #a26735 50%, #d5a021 100%)',
  mediterranean:        'linear-gradient(135deg, #efe1cc 0%, #c9805a 50%, #477b93 100%)',
  neoclassical:         'linear-gradient(135deg, #f4edf5 0%, #d7bfdc 50%, #8e6d3f 100%)',
  boho:                 'linear-gradient(135deg, #8f5035 0%, #d19068 50%, #f2d7a5 100%)',
  farmhouse:            'linear-gradient(135deg, #f7f2eb 0%, #9f8d7b 50%, #222222 100%)',
  minimalist:           'linear-gradient(135deg, #fff8ef 0%, #dfcfbd 50%, #a88f74 100%)',
  art_deco:             'linear-gradient(135deg, #13251f 0%, #087262 50%, #d4af37 100%)',
  cyberpunk:            'linear-gradient(135deg, #111827 0%, #7f187f 50%, #00d4ff 100%)',
  coastal:              'linear-gradient(135deg, #f8fbfb 0%, #bddbea 50%, #2f6f91 100%)',
  maximalist:           'linear-gradient(135deg, #2f1a35 0%, #c24183 50%, #facc15 100%)',
  wabi_sabi:            'linear-gradient(135deg, #d6c3ad 0%, #8a7564 50%, #4d4138 100%)',
  transitional:         'linear-gradient(135deg, #f7f0e9 0%, #b79d84 50%, #38516b 100%)',
  classic:              'linear-gradient(135deg, #3e2418 0%, #7a4629 50%, #d5b268 100%)',
  vintage:              'linear-gradient(135deg, #6b3a1f 0%, #d97706 50%, #667a3a 100%)',
  rustic:               'linear-gradient(135deg, #3c2f25 0%, #8a5a36 50%, #d6b58a 100%)',
  zen:                  'linear-gradient(135deg, #e8dfd1 0%, #81936a 50%, #33443a 100%)',
  eclectic:             'linear-gradient(135deg, #3b2251 0%, #dd7f4f 50%, #5aa6a6 100%)',
};

const styleGradientFor = (id: string) =>
  STYLE_GRADIENTS[id] || 'linear-gradient(135deg, #2f1a35 0%, #7f187f 50%, #f2d2a9 100%)';

const extractJsonObject = (text: string) => {
  const fenced = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
  if (fenced?.[1]) return fenced[1];
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  throw new Error('Shopping-list response did not contain JSON.');
};

const generateGeminiContent = async (payload: any) => {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch('/api/gemini/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) return data;

      const message = data.message || data.error || 'Gemini generation failed';
      lastError = new Error(message);
      if (![502, 503, 504].includes(response.status) || attempt === 2) throw lastError;
    } catch (error: any) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt === 2) throw lastError;
    }
    await new Promise(resolve => window.setTimeout(resolve, 1200 + attempt * 1300));
  }
  throw lastError || new Error('Gemini generation failed');
};

const generateShoppingBudget = async (
  params: {
    roomLabel: string;
    styleLabel: string;
    designDescription: string;
    language: Language;
    budgetTier: BudgetTier;
    provider: ProductProviderConfig;
  }
): Promise<{ items: WayfairBudgetItem[]; note: string }> => {
  const prompt = `
You are a procurement-focused interior designer.

TASK:
Create a ${params.provider.name}-only shopping list for this generated interior design.

ROOM: ${params.roomLabel}
STYLE: ${params.styleLabel}
BUDGET: ${getBudgetRangeLabel(params.budgetTier, 'en')}
BUDGET INSTRUCTION:
${params.budgetTier.prompt}
DESIGN DESCRIPTION:
${params.designDescription}

STRICT PROCUREMENT RULES:
1. Use ONLY products or product-searches from ${params.provider.baseUrl}.
2. Use Google Search to look for real ${params.provider.name} product pages or strong ${params.provider.name} category/search matches.
3. Do not invent product IDs, SKUs, seller names, brands or URLs.
4. If a direct product page is not confidently found, use a ${params.provider.name} search URL for the exact item name.
5. Return 6 to 10 items that could realistically compose this room: furniture, rug, lighting, wall decor, accents, storage and textiles.
6. Prices must be realistic planning prices in USD. If exact current price is uncertain, use a conservative estimate and explain that in note.
7. Respect the selected budget tier. The sum of quantity * unitPrice must fit the budget rule whenever the tier has a cap.
8. If the selected room cannot be credibly completed inside the budget cap, choose the most important impact items first and explain the tradeoff in the note.

Return ONLY valid JSON:
{
  "note": "short procurement note in ${params.language === 'pt' ? 'Portuguese' : params.language === 'es' ? 'Spanish' : 'English'}",
  "items": [
    {
      "name": "${params.provider.name}-searchable product name",
      "category": "Sofa | Rug | Lighting | Decor | Storage | Table | Chair | Bedding | Bath | Outdoor",
      "quantity": 1,
      "unitPrice": 249.99,
      "url": "${params.provider.baseUrl}/...",
      "note": "direct product if verified, otherwise search match"
    }
  ]
}`;

  const response = await generateGeminiContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: { tools: [{ googleSearch: {} }] },
  });

  const parsed = JSON.parse(extractJsonObject(response.text || '{}'));
  const items = Array.isArray(parsed.items)
    ? parsed.items.map((item: any) => normalizeShoppingItem(item, params.provider)).filter(Boolean) as WayfairBudgetItem[]
    : [];

  return {
    items,
    note: String(parsed.note || `${params.provider.name} shopping list generated with product links/search links for final validation.`),
  };
};

const TRANSLATIONS = {
  pt: {
    nav: { store: "Loja", login: "Entrar", credits: "créditos" },
    steps: { upload: "Foto do ambiente", room: "Cômodo", style: "Estilo", project: "Projeto e orçamento" },
    upload: { title: "Comece com uma foto do ambiente", subtitle: "Envie uma imagem da galeria ou abra a câmera do celular", gallery: "Escolher da galeria", camera: "Abrir câmera", heroEyebrow: "Design com IA + lista de compra", heroTitle: "Decore seu ambiente com peças reais para comprar", heroSubtitle: "A WayDecor transforma uma foto em uma proposta visual, preserva a estrutura do espaço e monta um orçamento item por item com produtos pesquisáveis em lojas como Wayfair e Target.", featureDesign: "Imagem de encantamento", featureBudget: "Orçamento comprável", featureStructure: "Sem mexer na estrutura", demoBefore: "ambiente original", demoAfter: "visão projetada", procurementNote: "a proposta final separa móveis, iluminação, tapetes e decoração em uma lista de compra validável." },
    roomSelect: { title: "Qual ambiente vamos transformar?", residential: "Residencial", commercial: "Comercial & Corporativo", next: "Próximo", customLabel: "Descreva seu ambiente:", customPlaceholder: "Ex: consultório pequeno, varanda gourmet, loja de roupas...", customRoom: "Descrever ambiente", autoRoom: "IA reconhece o ambiente", autoRoomHint: "A Luna identifica o cômodo pela foto e decora conforme o reconhecimento." },
    kidsConfig: { title: "Configuração do Quarto Infantil", age: "Idade", theme: "Tema", themePlaceholder: "Ex: Dinossauros...", gender: "Gênero", select: "Selecione...", boy: "Menino", girl: "Menina", neutral: "Neutro" },
    styleSelect: { title: "Escolha a loja e o estilo", cost: "Custo", generate: "Gerar Transformação", storeTitle: "1. Loja do inventário", storeSubtitle: "Escolha qual loja será usada para montar a decoração e o orçamento item por item.", budgetTitle: "2. Budget do projeto", budgetSubtitle: "A lista da loja escolhida será calculada conforme a faixa escolhida.", styleTitle: "3. Estilo de decoração", styleSubtitle: "Escolha o estilo antes de gerar a imagem de encantamento.", missingStore: "Escolha a loja do inventário", missingStyle: "Escolha o estilo de decoração", styleHintTitle: "3. Direção de estilo (opcional)", styleHintSubtitle: "Se preferir, descreva em poucas palavras o estilo que você imagina. Sem isso, a IA escolhe o melhor estilo pra esse cômodo.", styleHintPlaceholder: "Ex: minimalista quente com tons terracota e madeira clara, ar industrial-chic com toque tropical...", styleHintAiChoice: "Sem direção: a IA vai escolher um estilo apropriado para o ambiente e o orçamento.", styleHintUsing: "Sua direção será aplicada apenas a acabamentos, iluminação e móveis — a arquitetura é preservada.", styleHintAiChoiceShort: "IA escolhe o estilo" },
    results: { 
      title: "Transformação Pronta!", subtitle: "Compare o Antes e Depois.", 
      download: "Baixar Imagem", 
      authorize: "Autorizar Projeto", authorized: "Projeto Autorizado", 
      downloadPdf: "Baixar PDF (Briefing)", 
      restart: "Novo Projeto", 
      quickSwitch: "Troca Rápida de Estilo", quickSwitchSub: "Gere uma nova versão instantaneamente.", 
      materialTitle: "Trocar Material / Cor", materialSub: "Personalize móveis e acabamentos.", materialPlaceholder: "Ex: Madeira Freijó, Sofá Verde...", updateBtn: "Atualizar", 
      extraViewsTitle: "Vistas Extras 360º", extraViewsSub: "Gere novos ângulos.", generateAngles: "Gerar 3 Ângulos", generatingAngles: "Criando...", 
      artDirectorTitle: "Relatório de Design", savePdf: "Salvar PDF" 
    },
    paywall: { title: "Loja de Créditos", subtitle: "Desbloqueie o poder da IA.", consumptionTable: "Consumo", choose: "Pacotes", popular: "POPULAR", buy: "Comprar", secure: "Seguro via Stripe" },
    loading: { photo: "O Fotógrafo está analisando...", design: "Sistema Blindado: Ocupando Paredes com Madeira/Pedra (Sem Janelas)...", rendering: "Renderizando imagem final...", report: "Gerando relatório...", tech: "Gerando briefing técnico...", connection: "Conectando...", seeding: "Sincronizando Banco de Dados de Estilos..." },
    items: { fullTransform: "Transformação (Render 8K)", extraViews: "Expansión (3 Ângulos)", techReport: "Briefing Técnico" }
  },
  en: {
    nav: { store: "Store", login: "Login", credits: "credits" },
    steps: { upload: "Room photo", room: "Room", style: "Style", project: "Project and budget" },
    upload: { title: "Start with a room photo", subtitle: "Upload from gallery or open your phone camera", gallery: "Choose from gallery", camera: "Open camera", heroEyebrow: "AI design + shopping list", heroTitle: "Redesign your room with real products to buy", heroSubtitle: "WayDecor turns a photo into a visual proposal, preserves the room structure and builds an item-by-item budget with searchable products from stores like Wayfair and Target.", featureDesign: "Visual transformation", featureBudget: "Buyable budget", featureStructure: "No structural edits", demoBefore: "original room", demoAfter: "projected vision", procurementNote: "the final proposal separates furniture, lighting, rugs and decor into a validated shopping list." },
    roomSelect: { title: "Which room are we transforming?", residential: "Residential", commercial: "Commercial", next: "Next", customLabel: "Describe your room:", customPlaceholder: "Ex: small clinic, gourmet balcony, clothing store...", customRoom: "Describe room", autoRoom: "AI recognizes the room", autoRoomHint: "Luna identifies the room from the photo and decorates based on that recognition." },
    kidsConfig: { title: "Kids Room Config", age: "Age", theme: "Theme", themePlaceholder: "Ex: Dinosaurs...", gender: "Gender", select: "Select...", boy: "Boy", girl: "Girl", neutral: "Neutral" },
    styleSelect: { title: "Choose store and style", cost: "Cost", generate: "Generate", storeTitle: "1. Inventory store", storeSubtitle: "Choose which store will be used for the decoration and item-by-item budget.", budgetTitle: "2. Project budget", budgetSubtitle: "The selected store list will be calculated according to this budget range.", styleTitle: "3. Decor style", styleSubtitle: "Choose the style before generating the visual transformation.", missingStore: "Choose the inventory store", missingStyle: "Choose the decor style", styleHintTitle: "3. Style direction (optional)", styleHintSubtitle: "If you like, describe in a few words the style you have in mind. Without it, the AI picks the best style for this room.", styleHintPlaceholder: "Ex: warm minimalist with terracotta and light wood, industrial-chic with a tropical touch...", styleHintAiChoice: "No direction: the AI will pick a style that suits the room and budget.", styleHintUsing: "Your direction will only drive finishes, lighting and furniture — the architecture is preserved.", styleHintAiChoiceShort: "AI picks the style" },
    results: { 
      title: "Transformation Ready!", subtitle: "Compare Before and After.", 
      download: "Download Image", 
      authorize: "Authorize Project", authorized: "Project Authorized", 
      downloadPdf: "Download PDF (Brief)", 
      restart: "New Project", 
      quickSwitch: "Quick Style Switch", quickSwitchSub: "Generate new version instantly.", 
      materialTitle: "Change Material / Color", materialSub: "Customize furniture and finishes.", materialPlaceholder: "Ex: Oak Wood, Green Sofa...", updateBtn: "Update", 
      extraViewsTitle: "Extra Views", extraViewsSub: "Generate new angles.", generateAngles: "Generate 3 Angles", generatingAngles: "Creating...", 
      artDirectorTitle: "Design Report", savePdf: "Save PDF" 
    },
    paywall: { title: "Credits Store", subtitle: "Unlock AI power.", consumptionTable: "Consumption", choose: "Packages", popular: "POPULAR", buy: "Buy", secure: "Secure via Stripe" },
    loading: { photo: "Photographer analyzing...", design: "System Locked: Cladding Walls (No Window Policy)...", rendering: "Rendering final image...", report: "Generating report...", tech: "Generating technical briefing...", connection: "Connecting...", seeding: "Syncing Style Database..." },
    items: { fullTransform: "Transformation (8K)", extraViews: "Expansion (3 Angles)", techReport: "Tech Briefing" }
  },
  es: {
    nav: { store: "Tienda", login: "Entrar", credits: "créditos" },
    steps: { upload: "Foto del ambiente", room: "Ambiente", style: "Estilo", project: "Proyecto y presupuesto" },
    upload: { title: "Empieza con una foto del ambiente", subtitle: "Sube desde la galería o abre la cámara del celular", gallery: "Elegir de galería", camera: "Abrir cámara", heroEyebrow: "Diseño con IA + lista de compra", heroTitle: "Rediseña tu ambiente con productos reales para comprar", heroSubtitle: "WayDecor transforma una foto en una propuesta visual, preserva la estructura y crea un presupuesto por ítems con productos buscables en tiendas como Wayfair y Target.", featureDesign: "Imagen de impacto", featureBudget: "Presupuesto comprable", featureStructure: "Sin cambios estructurales", demoBefore: "ambiente original", demoAfter: "visión proyectada", procurementNote: "la propuesta final separa muebles, iluminación, alfombras y decoración en una lista de compra validable." },
    roomSelect: { title: "¿Qué ambiente transformamos?", residential: "Residencial", commercial: "Comercial", next: "Siguiente", customLabel: "Describe tu ambiente:", customPlaceholder: "Ej: clínica pequeña, balcón gourmet, tienda de ropa...", customRoom: "Describir ambiente", autoRoom: "IA reconoce el ambiente", autoRoomHint: "Luna identifica el ambiente por la foto y decora según ese reconocimiento." },
    kidsConfig: { title: "Config Habitación Infantil", age: "Edad", theme: "Tema", themePlaceholder: "Ej: Dinosaurios...", gender: "Género", select: "Seleccione...", boy: "Niño", girl: "Niña", neutral: "Neutro" },
    styleSelect: { title: "Elige tienda y estilo", cost: "Costo", generate: "Generar", storeTitle: "1. Tienda del inventario", storeSubtitle: "Elige qué tienda se usará para la decoración y el presupuesto por ítems.", budgetTitle: "2. Budget del proyecto", budgetSubtitle: "La lista de la tienda elegida será calculada según esta franja.", styleTitle: "3. Estilo de decoración", styleSubtitle: "Elige el estilo antes de generar la imagen.", missingStore: "Elige la tienda del inventario", missingStyle: "Elige el estilo de decoración", styleHintTitle: "3. Dirección de estilo (opcional)", styleHintSubtitle: "Si quieres, describe en pocas palabras el estilo que imaginas. Sin esto, la IA elige el mejor estilo para este ambiente.", styleHintPlaceholder: "Ej: minimalista cálido con tonos terracota y madera clara, industrial-chic con toque tropical...", styleHintAiChoice: "Sin dirección: la IA elegirá un estilo adecuado al ambiente y al presupuesto.", styleHintUsing: "Tu dirección se aplicará solo a acabados, iluminación y muebles — la arquitectura se preserva.", styleHintAiChoiceShort: "La IA elige el estilo" },
    results: { 
      title: "¡Transformación Lista!", subtitle: "Compara Antes y Después.", 
      download: "Descargar Imagen", 
      authorize: "Autorizar Proyecto", authorized: "Proyecto Autorizado", 
      downloadPdf: "Bajar PDF (Briefing)", 
      restart: "Nuevo Proyecto", 
      quickSwitch: "Cambio Rápido", quickSwitchSub: "Genera nueva versión al instante.", 
      materialTitle: "Cambiar Material / Color", materialSub: "Personalizar muebles y acabados.", materialPlaceholder: "Ej: Madera Roble, Sofá Verde...", updateBtn: "Actualizar", 
      extraViewsTitle: "Vistas Extras", extraViewsSub: "Nuevos ángulos.", generateAngles: "Generar 3 Ángulos", generatingAngles: "Creando...", 
      artDirectorTitle: "Informe de Diseño", savePdf: "Guardar PDF" 
    },
    paywall: { title: "Tienda de Créditos", subtitle: "Desbloquea la IA.", consumptionTable: "Consumo", choose: "Paquetes", popular: "POPULAR", buy: "Comprar", secure: "Seguro via Stripe" },
    loading: { photo: "Fotógrafo analizando...", design: "Sistema Blindado: Ocupando Paredes con Madera/Piedra...", rendering: "Renderizando imagen final...", report: "Generando informe...", tech: "Generando briefing técnico...", connection: "Conectando...", seeding: "Sincronizando Base de Datos..." },
    items: { fullTransform: "Transformación (8K)", extraViews: "Expansión (3 Ángulos)", techReport: "Briefing Técnico" }
  }
};

const ROOM_LABELS: Record<Language, Record<string, string>> = {
  pt: {
    living_room: 'Sala de Estar', bedroom_master: 'Quarto Casal', bedroom_kids: 'Quarto Infantil', bedroom_single: 'Quarto Solteiro', bedroom_guest: 'Quarto Visitas', closet: 'Closet / Vestuário', kitchen: 'Cozinha', dining_room: 'Sala de Jantar', bathroom: 'Banheiro', office: 'Home Office', hall: 'Hall de Entrada', laundry: 'Lavanderia', balcony: 'Varanda / Terraço', cinema: 'Sala de Cinema', garage: 'Garagem', bbq: 'Churrasqueira', pool: 'Área Piscina', reception_medical: 'Recepção Consultório', lobby_corporate: 'Lobby Corporativo', meeting_room: 'Sala de Reunião', coworking: 'Espaço Coworking', coffee_shop: 'Cafeteria / Copa', lobby_residential: 'Lobby Residencial', party_hall: 'Salão de Festas', gym: 'Academia', kids_club: 'Brinquedoteca', custom_commercial: 'Outro / Loja', custom_room: 'Ambiente descrito pelo usuário', ai_detect: 'Ambiente reconhecido pela IA'
  },
  en: {
    living_room: 'Living Room', bedroom_master: 'Master Bedroom', bedroom_kids: 'Kids Bedroom', bedroom_single: 'Single Bedroom', bedroom_guest: 'Guest Bedroom', closet: 'Walk-in Closet', kitchen: 'Kitchen', dining_room: 'Dining Room', bathroom: 'Bathroom', office: 'Home Office', hall: 'Entrance Hall', laundry: 'Laundry Room', balcony: 'Balcony / Terrace', cinema: 'Home Theater', garage: 'Garage', bbq: 'BBQ Area', pool: 'Pool Area', reception_medical: 'Medical Reception', lobby_corporate: 'Corporate Lobby', meeting_room: 'Meeting Room', coworking: 'Coworking Space', coffee_shop: 'Coffee Shop', lobby_residential: 'Residential Lobby', party_hall: 'Party Hall', gym: 'Gym', kids_club: 'Kids Club', custom_commercial: 'Other / Retail', custom_room: 'User-described room', ai_detect: 'AI-recognized room'
  },
  es: {
    living_room: 'Sala de Estar', bedroom_master: 'Dormitorio Principal', bedroom_kids: 'Dormitorio Niños', bedroom_single: 'Dormitorio Individual', bedroom_guest: 'Dormitorio Visitas', closet: 'Vestidor', kitchen: 'Cocina', dining_room: 'Comedor', bathroom: 'Baño', office: 'Oficina en Casa', hall: 'Recibidor', laundry: 'Lavandería', balcony: 'Balcón / Terraza', cinema: 'Cine en Casa', garage: 'Garaje', bbq: 'Zona de Barbacoa', pool: 'Zona de Piscina', reception_medical: 'Recepción Médica', lobby_corporate: 'Vestíbulo Corporativo', meeting_room: 'Sala de Reuniones', coworking: 'Espacio Coworking', coffee_shop: 'Cafetería', lobby_residential: 'Vestíbulo Residencial', party_hall: 'Salón de Fiestas', gym: 'Gimnasio', kids_club: 'Club Infantil', custom_commercial: 'Otro / Tienda', custom_room: 'Ambiente descrito por el usuario', ai_detect: 'Ambiente reconocido por IA'
  }
};

const STYLE_LABELS: Record<Language, Record<string, string>> = {
  pt: {
    modern: 'Moderno (Trends 2025)', industrial: 'Industrial Chic', scandinavian: 'Novo Nórdico', luxury_italian: 'Italiano High-End', brazilian_modernism: 'Modernismo Tropical', japandi: 'Japandi', biophilic: 'Biofílico Urbano', mid_century: 'Mid-Century', mediterranean: 'Mediterrâneo Moderno', neoclassical: 'Neoclássico', boho: 'Boho Chic', farmhouse: 'Rústico Moderno', minimalist: 'Minimalismo Quente', art_deco: 'Art Déco', cyberpunk: 'Cyberpunk', coastal: 'Costeiro', maximalist: 'Maximalista', wabi_sabi: 'Wabi-Sabi (Imperfeição)', transitional: 'Transicional', classic: 'Clássico Tradicional', vintage: 'Vintage Retro', rustic: 'Rústico Raw', zen: 'Zen Asiático', eclectic: 'Eclético Curated'
  },
  en: {
    modern: 'Modern (Trends 2025)', industrial: 'Industrial Chic', scandinavian: 'New Nordic', luxury_italian: 'Italian High-End', brazilian_modernism: 'Tropical Modernism', japandi: 'Japandi', biophilic: 'Urban Biophilic', mid_century: 'Mid-Century', mediterranean: 'Modern Mediterranean', neoclassical: 'Neoclassical', boho: 'Boho Chic', farmhouse: 'Modern Farmhouse', minimalist: 'Warm Minimalist', art_deco: 'Art Deco', cyberpunk: 'Cyberpunk', coastal: 'Coastal', maximalist: 'Maximalist', wabi_sabi: 'Wabi-Sabi', transitional: 'Transitional', classic: 'Traditional Classic', vintage: 'Vintage Retro', rustic: 'Rustic Raw', zen: 'Asian Zen', eclectic: 'Eclectic Curated'
  },
  es: {
    modern: 'Moderno (Tendencias)', industrial: 'Industrial Chic', scandinavian: 'Nuevo Nórdico', luxury_italian: 'Lujo Italiano', brazilian_modernism: 'Modernismo Tropical', japandi: 'Japandi', biophilic: 'Biofílico Urbano', mid_century: 'Mid-Century', mediterranean: 'Mediterráneo Moderno', neoclassical: 'Neoclásico', boho: 'Boho Chic', farmhouse: 'Granja Moderna', minimalist: 'Minimalismo Cálido', art_deco: 'Art Déco', cyberpunk: 'Cyberpunk', coastal: 'Costero', maximalist: 'Maximalista', wabi_sabi: 'Wabi-Sabi', transitional: 'Transicional', classic: 'Clásico Tradicional', vintage: 'Vintage Retro', rustic: 'Rústico Raw', zen: 'Zen Asiático', eclectic: 'Ecléctico Curated'
  }
};

// --- INITIAL SEED DATA (THE GOLD COPY) ---
const INITIAL_DECOR_STYLES = [
  { 
    id: 'modern', 
    thumb: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=300&q=80',
    prompt_modifier: '2025 Contemporary Modern Design: Fluted wood panels (ripado), integrated LED strip lighting in joinery, matte lacquer finishes, neutral palette with bold stone textures (Travertine), floor-to-ceiling custom cabinets, handle-less push-to-open doors, sophisticated and high-tech.'
  },
  { 
    id: 'industrial', 
    thumb: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?auto=format&fit=crop&w=300&q=80',
    prompt_modifier: 'Industrial Chic 2025: Micro-cement flooring, matte black metal framing, exposed architectural concrete, cognac leather furniture, track lighting systems, open shelving with metal mesh details, smart home integration aesthetics.'
  },
  { 
    id: 'scandinavian', 
    thumb: 'https://images.unsplash.com/photo-1532323544230-ac13f7613d71?auto=format&fit=crop&w=300&q=80',
    prompt_modifier: 'New Nordic Style: Whitewashed oak wood, curved furniture (organic shapes), soft bouclé fabrics, beige and greige tones, minimalist lighting fixtures, cozy but highly functional custom wardrobes.'
  },
  { 
    id: 'luxury_italian', 
    thumb: 'https://images.unsplash.com/photo-1600210492493-0946911123ea?auto=format&fit=crop&w=300&q=80',
    prompt_modifier: 'Ultra-Luxury Italian Design: Calacatta Viola or Arabescato marble surfaces, bronze tinted glass cabinets, velvet upholstery, dark wood veneers (Walnut/Eucalyptus), Poliform-style closet systems, dramatic chandelier lighting.'
  },
  { 
    id: 'brazilian_modernism', 
    thumb: 'https://images.unsplash.com/photo-1600607686527-6fb886090705?auto=format&fit=crop&w=300&q=80',
    prompt_modifier: 'Contemporary Brazilian Design: Freijó wood slatted panels, natural stone walls, straw/rattan details (palhinha), signature design chairs, linen sofas, indoor landscaping integration, warm and earthy luxury.'
  },
  { 
    id: 'japandi', 
    thumb: 'https://images.unsplash.com/photo-1598928636135-d146006ff4be?auto=format&fit=crop&w=300&q=80',
    prompt_modifier: 'Japandi 2025: Hybrid of Japanese rustic minimalism and Scandinavian functionality. Low-profile platform beds, paper lanterns, shoji-screen inspired joinery, natural clay textures, zen atmosphere.'
  },
  { 
    id: 'biophilic', 
    thumb: 'https://images.unsplash.com/photo-1627230495819-2a912b772428?auto=format&fit=crop&w=300&q=80',
    prompt_modifier: 'Urban Biophilic Luxury: Vertical garden walls, natural light optimization, sustainable wood materials, organic curved sofas, moss walls, stone textures, blurring the line between indoor and outdoor.'
  },
  { 
    id: 'mid_century', 
    thumb: 'https://images.unsplash.com/photo-1595515106969-1ce29569ff1b?auto=format&fit=crop&w=300&q=80',
    prompt_modifier: 'Mid-Century Modern Revival: Walnut wood sideboards, olive green and mustard velvet, brass legs, sunburst clocks, terrazzo flooring, vintage-inspired lighting with modern LED tech.'
  },
  { 
    id: 'mediterranean', 
    thumb: 'https://images.unsplash.com/photo-1533044309907-0fa3413da946?auto=format&fit=crop&w=300&q=80',
    prompt_modifier: 'Modern Mediterranean: Tadelakt or lime-wash walls, arched niches for shelving, travertine floors, rustic timber beams, linen curtains, warm terracotta accents, relaxed luxury.'
  },
  { 
    id: 'neoclassical', 
    thumb: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=300&q=80',
    prompt_modifier: 'Modern Neoclassical: Boiserie wall panels updated with cleaner lines, herringbone wood floors, marble fireplaces, gold hardware, pastel palette, symmetry, sophisticated grandeur.'
  },
   { 
    id: 'boho', 
    thumb: 'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?auto=format&fit=crop&w=300&q=80',
    prompt_modifier: 'High-End Boho: Layered persian rugs, macramé art, rattan hanging chairs, solid wood furniture, global artifacts, warm lighting, eclectic but curated.'
  },
  { 
    id: 'farmhouse', 
    thumb: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=300&q=80',
    prompt_modifier: 'Modern Farmhouse 2025: Black steel framed glass partitions, shiplap walls, chunky oak beams, industrial pendant lights, oversized comfortable furniture, neutral color palette.'
  },
  { 
    id: 'minimalist', 
    thumb: 'https://images.unsplash.com/photo-1502005229766-31e4795323d8?auto=format&fit=crop&w=300&q=80',
    prompt_modifier: 'Warm Minimalism: Soft textures, beige and cream tones, hidden storage (invisible doors), continuous floor materials, clutter-free surfaces, high-end materials like Travertine and Oak.'
  },
  { 
    id: 'art_deco', 
    thumb: 'https://images.unsplash.com/photo-1616046229478-9901c5536a45?auto=format&fit=crop&w=300&q=80',
    prompt_modifier: 'Art Deco Revival: Bold geometric wallpapers, brass inlays in stone floors, velvet curves, jewel tones (Emerald, Sapphire), fluted glass, glamorous lighting.'
  },
  { 
    id: 'cyberpunk', 
    thumb: 'https://images.unsplash.com/photo-1535295972055-1c762f4483e5?auto=format&fit=crop&w=300&q=80',
    prompt_modifier: 'Cyberpunk Gamer Room: Nanoleaf lighting panels, RGB LED strips integrated into desk, dark acoustic panels, futuristic ergonomic furniture, holographic accents.'
  },
  { 
    id: 'coastal', 
    thumb: 'https://images.unsplash.com/photo-1615529182904-14819c35db37?auto=format&fit=crop&w=300&q=80',
    prompt_modifier: 'Hamptons Coastal Luxury: White wainscoting, light blue and linen tones, bleached wood floors, airy curtains, coral decor, sophisticated beach house vibe.'
  },
  { 
    id: 'maximalist', 
    thumb: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=300&q=80',
    prompt_modifier: 'Curated Maximalism: Gallery walls, bold pattern mixing, saturated colors, vintage velvet armchairs, unique statement pieces, controlled chaos.'
  },
  {
    id: 'wabi_sabi',
    thumb: 'https://images.unsplash.com/photo-1628151015968-3a4429e9ef04?auto=format&fit=crop&w=300&q=80',
    prompt_modifier: 'Wabi-Sabi 2025: Celebrating imperfection, raw concrete walls, aged wood, irregular ceramics, linen textiles, earthy muted tones, unrefined beauty, serene and grounded.'
  },
  {
    id: 'transitional',
    thumb: 'https://images.unsplash.com/photo-1616047006789-b7af5afb8c20?auto=format&fit=crop&w=300&q=80',
    prompt_modifier: 'Transitional Style: A balanced blend of traditional and modern. Shaker cabinetry, neutral color palette with deep accents, comfortable upholstered furniture, metallic finishes (nickel/brass), sophisticated and timeless.'
  },
  {
    id: 'classic',
    thumb: 'https://images.unsplash.com/photo-1565538810643-b5bdb714032a?auto=format&fit=crop&w=300&q=80',
    prompt_modifier: 'Traditional Classic: Rich mahogany wood, intricate moldings, antique rugs, crystal chandeliers, silk drapes, formal layout, oil paintings, heritage luxury.'
  },
  {
    id: 'vintage',
    thumb: 'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=300&q=80',
    prompt_modifier: 'Vintage Retro 70s/80s: Vibrant color palettes (orange, brown, olive), pattern wallpapers, velvet modular sofas, plastic fantastic furniture, nostalgic and playful.'
  },
  {
    id: 'rustic',
    thumb: 'https://images.unsplash.com/photo-1449247709967-d4461a6a6103?auto=format&fit=crop&w=300&q=80',
    prompt_modifier: 'Raw Rustic: Exposed stone walls, reclaimed thick wood beams, leather armchairs, open fireplaces, earthy tones, cabin-like cozy atmosphere.'
  },
  {
    id: 'zen',
    thumb: 'https://images.unsplash.com/photo-1508138221679-760a23a2285b?auto=format&fit=crop&w=300&q=80',
    prompt_modifier: 'Asian Zen: Minimalism, tatami mats, low furniture, sliding paper doors, bonsai plants, water features, neutral and calming palette, spiritual serenity.'
  },
  {
    id: 'eclectic',
    thumb: 'https://images.unsplash.com/photo-1550581190-9c1c48d21d6c?auto=format&fit=crop&w=300&q=80',
    prompt_modifier: 'Eclectic Curated: A harmonious mix of different time periods and styles. Antique dresser next to modern art, mixed patterns, personalized collections, unique and storytelling.'
  }
];

const ROOM_TYPES = [
  // Residencial - Íntimo
  { id: 'living_room', icon: Sofa, category: 'residential' },
  { id: 'bedroom_master', icon: BedDouble, category: 'residential' },
  { id: 'bedroom_kids', icon: Baby, category: 'residential' },
  { id: 'bedroom_single', icon: BedSingle, category: 'residential' },
  { id: 'bedroom_guest', icon: Bed, category: 'residential' },
  { id: 'closet', icon: Shirt, category: 'residential' },
  
  // Residencial - Social & Serviço
  { id: 'kitchen', icon: CookingPot, category: 'residential' },
  { id: 'dining_room', icon: Utensils, category: 'residential' },
  { id: 'bathroom', icon: Bath, category: 'residential' },
  { id: 'office', icon: LampDesk, category: 'residential' },
  { id: 'hall', icon: DoorOpen, category: 'residential' },
  { id: 'laundry', icon: Waves, category: 'residential' },
  
  // Residencial - Lazer
  { id: 'balcony', icon: Trees, category: 'residential' },
  { id: 'cinema', icon: Clapperboard, category: 'residential' },
  { id: 'garage', icon: CarFront, category: 'residential' },
  { id: 'bbq', icon: Flame, category: 'residential' },
  { id: 'pool', icon: Umbrella, category: 'residential' },

  // Comercial & Corporativo
  { id: 'reception_medical', icon: Stethoscope, category: 'commercial' },
  { id: 'lobby_corporate', icon: Building2, category: 'commercial' },
  { id: 'meeting_room', icon: Presentation, category: 'commercial' },
  { id: 'coworking', icon: Briefcase, category: 'commercial' },
  { id: 'coffee_shop', icon: Coffee, category: 'commercial' },

  // Condomínio & Áreas Comuns
  { id: 'lobby_residential', icon: Building2, category: 'commercial' },
  { id: 'party_hall', icon: PartyPopper, category: 'commercial' },
  { id: 'gym', icon: Dumbbell, category: 'commercial' },
  { id: 'kids_club', icon: Gamepad2, category: 'commercial' },

];

const GENERATION_COST = 10;
const TECH_REPORT_COST = 2;
const EXTRA_VIEWS_COST = 5;

// --- COMPONENTS ---

const Tooltip: FC<{ text: string; children: ReactNode }> = ({ text, children }) => (
  <div className="group relative flex items-center justify-center">
    {children}
    <div className="absolute bottom-full mb-2 hidden w-48 flex-col items-center group-hover:flex z-50">
      <div className="rounded bg-black p-2 text-xs text-white shadow-lg text-center">{text}</div>
    </div>
  </div>
);

const ComparisonSlider: FC<{
  before: string;
  after: string;
  className?: string;
  beforeLabel?: string;
  afterLabel?: string;
}> = ({ before, after, className = 'h-[400px] md:h-[600px] border-4', beforeLabel = 'Antes', afterLabel = 'Depois' }) => {
  const [sliderPosition, setSliderPosition] = useState(50);
  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
    setSliderPosition(Math.max(0, Math.min(100, ((x - rect.left) / rect.width) * 100)));
  };

  return (
    <div 
      className={`relative w-full overflow-hidden rounded-xl cursor-ew-resize select-none border-[#eadff2] shadow-2xl group ${className}`}
      onMouseMove={handleMove} onTouchMove={handleMove}
    >
      <img src={after} className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 w-full h-full overflow-hidden border-r-2 border-white" style={{ width: `${sliderPosition}%` }}>
        <img src={before} className="absolute inset-0 w-full h-full object-cover" />
      </div>
      <div className="absolute top-0 bottom-0 w-px bg-white/90 shadow-[0_0_18px_rgba(255,255,255,0.9)]" style={{ left: `${sliderPosition}%` }}></div>
      <div className="absolute top-1/2 -mt-5 -ml-5 w-10 h-10 bg-white rounded-full shadow-xl flex items-center justify-center border border-[#eadff2]" style={{ left: `${sliderPosition}%` }}>
        <div className="flex gap-1 text-[#7F187F] text-xs font-black">
          <span>&lt;</span>
          <span>&gt;</span>
        </div>
      </div>
      <div className="absolute bottom-4 left-4 bg-black/60 text-white px-3 py-1 rounded-full text-xs uppercase tracking-wide font-bold">{beforeLabel}</div>
      <div className="absolute bottom-4 right-4 bg-[#7F187F]/90 text-white px-3 py-1 rounded-full text-xs uppercase tracking-wide font-bold">{afterLabel}</div>
    </div>
  );
};

const HeroComparisonPhoto: FC<{
  image: string;
  beforeLabel: string;
  afterLabel: string;
}> = ({ image, beforeLabel, afterLabel }) => {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [manualMode, setManualMode] = useState(false);

  useEffect(() => {
    if (manualMode) return;
    let frame = 0;
    const timer = window.setInterval(() => {
      frame += 1;
      const wave = (Math.sin(frame / 24) + 1) / 2;
      setSliderPosition(10 + wave * 80);
    }, 45);
    return () => window.clearInterval(timer);
  }, [manualMode]);

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
    setManualMode(true);
    setSliderPosition(Math.max(4, Math.min(96, ((x - rect.left) / rect.width) * 100)));
  };

  return (
    <div
      className="relative overflow-hidden rounded-xl border border-[#eadff2] bg-[#f8f4fa] cursor-ew-resize select-none"
      onMouseMove={handleMove}
      onTouchMove={handleMove}
      onMouseLeave={() => setManualMode(false)}
      onTouchEnd={() => setManualMode(false)}
    >
      <img
        src={image}
        alt={`${beforeLabel} / ${afterLabel}`}
        className="w-full h-48 sm:h-64 md:h-80 object-cover"
      />
      <div
        className="absolute top-0 bottom-0 w-[3px] bg-white shadow-[0_0_22px_rgba(255,255,255,0.95)] transition-[left] duration-75"
        style={{ left: `${sliderPosition}%` }}
      />
      <div
        className="absolute top-1/2 -mt-6 -ml-6 w-12 h-12 rounded-full bg-white/95 text-[#7F187F] shadow-2xl border border-[#eadff2] flex items-center justify-center transition-[left] duration-75"
        style={{ left: `${sliderPosition}%` }}
        aria-hidden="true"
      >
        <div className="flex gap-1 text-sm font-black">
          <span>&lt;</span>
          <span>&gt;</span>
        </div>
      </div>
      <div
        className="absolute inset-y-0 bg-white/10 backdrop-blur-[1px] pointer-events-none transition-[width] duration-75"
        style={{ width: `${sliderPosition}%` }}
      />
      <div className="absolute bottom-4 left-4 bg-black/60 text-white px-3 py-1 rounded-full text-xs uppercase tracking-wide font-bold">{beforeLabel}</div>
      <div className="absolute bottom-4 right-4 bg-[#7F187F]/90 text-white px-3 py-1 rounded-full text-xs uppercase tracking-wide font-bold">{afterLabel}</div>
    </div>
  );
};

const Spinner: FC<{ message: string }> = ({ message }) => (
  <div className="flex flex-col items-center justify-center p-12 text-center animate-fade-in">
    <div className="relative w-24 h-24 mb-6">
      <div className="absolute inset-0 border-4 border-[#eadff2] rounded-full"></div>
      <div className="absolute inset-0 border-4 border-[#7F187F] rounded-full border-t-transparent animate-spin"></div>
      <Wand2 className="absolute inset-0 m-auto text-[#7F187F] w-8 h-8 animate-pulse" />
    </div>
    <h3 className="text-xl font-bold text-[#2f1a35]">{message}</h3>
  </div>
);

const Step: FC<{ number: number; title: string; isActive: boolean; isCompleted: boolean }> = ({ number, title, isActive, isCompleted }) => (
  <div className={`flex items-center space-x-3 p-3 rounded-lg transition-all ${isActive ? 'bg-white border border-[#eadff2]' : 'opacity-60'}`}>
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${isActive ? 'bg-[#7F187F] text-white' : isCompleted ? 'bg-green-600 text-white' : 'bg-[#f3e8ff] text-[#85758a]'}`}>
      {isCompleted ? <CheckCircle2 size={16} /> : number}
    </div>
    <span className={`font-medium ${isActive ? 'text-[#2f1a35]' : 'text-[#85758a]'}`}>{title}</span>
  </div>
);

// --- APP PRINCIPAL ---

export default function App() {
  const [lang, setLang] = useState<Language>('pt');
  const t = TRANSLATIONS[lang];
  
  const [credits, setCredits] = useState(1000);
  const [currentStep, setCurrentStep] = useState(1);
  const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [configSource, setConfigSource] = useState<'local' | 'mongo'>('local');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [customRoomType, setCustomRoomType] = useState('');
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null);
  const [customStyleHint, setCustomStyleHint] = useState<string>('');
  
  const [childAge, setChildAge] = useState('');
  const [childTheme, setChildTheme] = useState('');
  const [childGender, setChildGender] = useState('neutral');

  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [extraImages, setExtraImages] = useState<any[]>([]);
  const [transformationReport, setTransformationReport] = useState<string>('');
  
  const [decorStyles, setDecorStyles] = useState<any[]>(INITIAL_DECOR_STYLES);
  const [loadingStyles, setLoadingStyles] = useState(false);
  // NEW: State for Dynamic System Configuration
  const [systemMemory, setSystemMemory] = useState(DEFAULT_SYSTEM_MEMORY);

  const [isApproved, setIsApproved] = useState(false);
  const [technicalBrief, setTechnicalBrief] = useState<string>('');
  const [wayfairBudget, setWayfairBudget] = useState<WayfairBudgetItem[]>([]);
  const [wayfairBudgetNote, setWayfairBudgetNote] = useState('');
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [selectedBudgetTierId, setSelectedBudgetTierId] = useState<BudgetTierId>('essential');
  const [savedProjects, setSavedProjects] = useState<any[]>([]);
  const [savingProject, setSavingProject] = useState(false);
  const [projectSaveMessage, setProjectSaveMessage] = useState('');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingExtras, setIsGeneratingExtras] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [showPaywall, setShowPaywall] = useState(false);
  const [customMaterial, setCustomMaterial] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const getSelectedRoomLabel = (language: Language = lang) => {
    if (selectedRoomId === 'custom_room') return customRoomType.trim() || ROOM_LABELS[language].custom_room;
    if (selectedRoomId === 'ai_detect') return ROOM_LABELS[language].ai_detect;
    return selectedRoomId ? (ROOM_LABELS[language][selectedRoomId] || selectedRoomId) : '';
  };

  const getRoomPromptInstruction = () => {
    if (selectedRoomId === 'ai_detect') {
      return 'AI-DETECTED ROOM: First identify the room type from the input image, then design appropriately for that recognized room. State the recognition internally through the design choices, but preserve the original architecture.';
    }
    if (selectedRoomId === 'custom_room') {
      return `USER-DESCRIBED ROOM: ${customRoomType.trim()}. Treat this description as the room type and business/use context.`;
    }
    return `ROOM TYPE: ${getSelectedRoomLabel('en')}`;
  };

  const canProceedFromRoom = Boolean(selectedRoomId && (selectedRoomId !== 'custom_room' || customRoomType.trim().length >= 3));
  const selectedProductProvider = selectedProviderId ? getProductProvider(selectedProviderId) : null;
  const selectedProviderName = selectedProductProvider?.name || (lang === 'en' ? 'Selected store' : lang === 'es' ? 'Tienda elegida' : 'Loja escolhida');
  const selectedBudgetTier = getBudgetTier(selectedBudgetTierId);
  // Estilo agora e opcional: usuario pode escrever uma direcao livre OU deixar a IA escolher.
  const canGenerateDecoration = Boolean(selectedProductProvider && selectedProductProvider.status === 'active');

  useEffect(() => {
    const savedLang = localStorage.getItem('bhome_lang');
    if (savedLang) setLang(savedLang as Language);
  }, []);

  useEffect(() => {
    localStorage.setItem('bhome_lang', lang);
  }, [lang]);

  const refreshSavedProjects = useCallback(async () => {
    try {
      const response = await fetch('/api/projects');
      if (!response.ok) return;
      const data = await response.json();
      setSavedProjects(Array.isArray(data.projects) ? data.projects : []);
    } catch (error) {
      console.warn('Project history unavailable', error);
    }
  }, []);

  useEffect(() => {
    refreshSavedProjects();
  }, [refreshSavedProjects]);

  // --- DATA SYNC (MONGO VIA BACKEND API) ---
  useEffect(() => {
      const syncData = async () => {
          setLoadingStyles(true);
          try {
              const [healthResponse, stylesResponse, configResponse, creditsResponse] = await Promise.all([
                  fetch('/api/health'),
                  fetch('/api/styles'),
                  fetch('/api/config'),
                  fetch('/api/credits'),
              ]);

              const health = healthResponse.ok ? await healthResponse.json() : null;
              setDbStatus(health?.storage === 'mongo' ? 'connected' : 'disconnected');
              setConfigSource(health?.storage === 'mongo' ? 'mongo' : 'local');

              const stylesPayload = stylesResponse.ok ? await stylesResponse.json() : null;
              const remoteStyles = Array.isArray(stylesPayload?.styles) ? stylesPayload.styles : [];
              if (remoteStyles.length > 0) {
                  setDecorStyles(remoteStyles);
              } else if (stylesPayload?.storage === 'mongo') {
                  fetch('/api/styles/seed', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ styles: INITIAL_DECOR_STYLES }),
                  }).catch((error) => console.warn('Mongo style seed failed', error));
              }

              const configPayload = configResponse.ok ? await configResponse.json() : null;
              const configData = Array.isArray(configPayload?.config) ? configPayload.config : [];
              const newMemory = { ...DEFAULT_SYSTEM_MEMORY };
              let updated = false;
              configData.forEach((row: any) => {
                  if (row.key === 'architect_protocol') { newMemory.ARCHITECT_PROTOCOL = row.value; updated = true; }
                  if (row.key === 'renderer_protocol') { newMemory.RENDERER_PROTOCOL = row.value; updated = true; }
              });
              
              if (updated) {
                  setSystemMemory(newMemory);
                  setConfigSource('mongo');
                  setToastMessage("📡 Protocolos de Sistema sincronizados com MongoDB");
                  setTimeout(() => setToastMessage(null), 5000);
              }

              const creditsPayload = creditsResponse.ok ? await creditsResponse.json() : null;
              if (Number.isFinite(Number(creditsPayload?.credits))) setCredits(Number(creditsPayload.credits));
          } catch (error) {
              console.warn("Mongo API unavailable. Using local fallback.", error);
              setDbStatus('disconnected');
              setConfigSource('local');
          } finally {
              setLoadingStyles(false);
          }
      };
      
      syncData();
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => { setSelectedImage(reader.result as string); setCurrentStep(2); };
      reader.readAsDataURL(file);
    }
  };

  const deductCredits = async (amount: number) => {
    if (credits < amount) { setShowPaywall(true); return false; }

    setCredits(c => c - amount);
    try {
        const response = await fetch('/api/credits/deduct', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount }),
        });
        if (response.ok) {
            const data = await response.json();
            if (Number.isFinite(Number(data.credits))) setCredits(Number(data.credits));
        }
    } catch (e) { console.warn("Credit sync failed", e); }
    return true;
  };

  const handleNewProject = () => {
    setGeneratedImage(null);
    setExtraImages([]);
    setTransformationReport('');
    setIsApproved(false);
    setTechnicalBrief('');
    setWayfairBudget([]);
    setWayfairBudgetNote('');
    setCurrentStep(2);
  };

  const generateDecoration = async (overrideMaterial?: string, targetStyleId?: string) => {
    if (!selectedImage || !selectedRoomId) return;
    
    // Estilo agora e opcional. effectiveStyleId pode ser null se usuario nao escolheu.
    const effectiveStyleId = targetStyleId || selectedStyleId;
    if (targetStyleId) setSelectedStyleId(targetStyleId);

    if (!selectedProductProvider || selectedProductProvider.status !== 'active') {
        alert(lang === 'en' ? 'Choose the inventory store before generating.' : lang === 'es' ? 'Elige la tienda del inventario antes de generar.' : 'Escolha a loja do inventário antes de gerar.');
        return;
    }

    if (selectedRoomId === 'bedroom_kids' && (!childAge || !childTheme)) {
        alert("Informe idade e tema para quarto infantil."); return;
    }

    if (selectedRoomId === 'custom_room' && customRoomType.trim().length < 3) {
        alert("Descreva o ambiente para continuar."); return;
    }

    if (!(await deductCredits(GENERATION_COST))) return;

	    if (!overrideMaterial) {
	        setGeneratedImage(null); 
	        setIsApproved(false); 
	        setTechnicalBrief('');
	        setWayfairBudget([]);
	        setWayfairBudgetNote('');
	    }
    
    setIsGenerating(true);
    
    try {
      const style = effectiveStyleId ? decorStyles.find(s => s.id === effectiveStyleId) : null;
      const requestId = new Date().getTime();
      const roomLabel = getSelectedRoomLabel('en');
      const roomInstruction = getRoomPromptInstruction();
      const budgetInstruction = selectedBudgetTier.prompt;
      const userStyleHint = customStyleHint.trim();

      // Direcao de estilo: hint do usuario > preset (legacy) > IA escolhe.
      const styleDirectionLine = userStyleHint
        ? `Target Style: User direction (free text) — "${userStyleHint}". Interpret this faithfully but only via surface finishes, lighting and movable items.`
        : effectiveStyleId && STYLE_LABELS['en'][effectiveStyleId]
          ? `Target Style: ${STYLE_LABELS['en'][effectiveStyleId]} (${style?.prompt_modifier || 'High-end design'})`
          : `Target Style: Designer's choice. Pick a tasteful, high-end style that suits the room type, the existing architecture and the selected budget. Lean contemporary unless the room screams otherwise.`;

      setLoadingMessage(t.loading.design);

      // USE DYNAMIC SYSTEM MEMORY HERE
      const creativePrompt = `
        ${systemMemory.ARCHITECT_PROTOCOL}

        Act as a Senior Interior Architect.
        ${styleDirectionLine}
        ${roomInstruction}
        BUDGET TIER: ${getBudgetRangeLabel(selectedBudgetTier, 'en')}
        BUDGET DISCIPLINE: ${budgetInstruction}
        ${selectedRoomId === 'bedroom_kids' ? `Kids Config: Age ${childAge}, Theme ${childTheme}, Gender ${childGender}.` : ''}
        ${overrideMaterial ? `MANDATORY MATERIAL OVERRIDE: All furniture and joinery MUST USE: ${overrideMaterial}.` : ''}
        
		        INSTRUCTIONS:
		        1. GEOMETRY LOCK (ABSOLUTE): Keep the EXACT room dimensions, proportions and shape. Do NOT move, resize, add or remove any wall, window, door, column, stair, beam or ceiling edge. Keep every opening in the same position and size. Keep the same camera viewpoint, lens, perspective and crop. The room's geometry/footprint is immutable.
		        2. WHAT YOU MAY CHANGE: Within that fixed geometry you MAY restyle freely — wall colors, paint, wallpaper, wall paneling/cladding, flooring finish, ceiling finish, lighting (fixtures, track, recessed, LED, ambiance) AND all furniture, rugs, curtains, art, mirrors, plants and decor.
		        3. LIGHTING: Lighting may change — add or upgrade fixtures and lighting effects freely, as long as the ceiling/wall SHAPE and positions do not change.
		        4. APPLY THE STYLE: Express the target style through finishes, lighting and furniture — but never by altering the room's size, shape, layout or perspective.
	        5. PROCUREMENT LOCK: The design must be executable with furniture, lighting, rugs, wall decor, storage, textiles and decorative items that can be sourced on ${selectedProductProvider.name} (${selectedProductProvider.baseUrl}).
		        6. Do not depend on custom-only or unbuyable pieces unless they are non-structural finishes already present in the room.
		        7. Respect the selected budget tier. Match the visual ambition to the budget and avoid designing around items that would clearly exceed the selected range.
		        8. The output description must explicitly instruct the renderer to edit the existing photo, not create a new room.

	        Output only the raw prompt text.

	        OUTPUT CONSTRAINT (NON-NEGOTIABLE — applies to the very text you produce):
	        - Your output will be fed verbatim into an image-edit renderer. Anything you describe will be attempted by the renderer.
	        - Therefore your output MUST NOT mention, suggest, imply or hint at any change to the room's geometry, structure, footprint, layout or perspective.
	        - Forbidden topics in your output: opening, closing, widening, narrowing, raising, lowering, knocking down, removing, adding, moving, repositioning, extending or merging any wall, window, door, opening, ceiling, floor, column, stair, beam, balcony, loft or fireplace; changing room dimensions, proportions, footprint, camera angle, lens, perspective or crop.
	        - Forbidden phrasing: "open up", "knock down", "remove the wall", "add a window", "expand", "extend", "integrate with", "raise the ceiling", "lower the ceiling", "convert the layout", "reframe", "rearrange the walls".
	        - If the target style traditionally implies architectural changes, translate them into SURFACE FINISHES ONLY (e.g., "Industrial loft" → concrete-effect paint, metal-framed art, exposed-style decor — NEVER actual exposed beams or removed walls).
	        - Allowed scope: paint colors, wallpaper, removable wall paneling/cladding, ceiling paint/finish, floor finish (rugs, decorative panels — not structural floor changes), lighting fixtures and effects, furniture, rugs, curtains, art, mirrors, lamps, plants and decor.
	        - Begin the output with the phrase: "Within the existing room shell, with all walls, windows, doors, ceiling and floor in their exact current positions, ..."
	      `;

      const creativeRes = await generateGeminiContent({
          model: 'gemini-2.5-flash',
          contents: creativePrompt
      });
      
      const enhancedDescription = creativeRes.text;

      setLoadingMessage(t.loading.rendering);

      const optimizedBase64 = await resizeImage(selectedImage);
      const base64Data = optimizedBase64.split(',')[1];
      
      const renderPrompt = `
        ${systemMemory.RENDERER_PROTOCOL}

		        TASK: PHOTO-REALISTIC IMAGE EDIT OF THE SAME ROOM.
		        INPUT IMAGE: This is the IMMUTABLE SHELL and the camera reference.
		        GEOMETRY WARNING (ABSOLUTE): Keep the EXACT room dimensions, proportions and shape. Every wall, door, window, ceiling edge, column, stair and opening must stay in the SAME position and SAME size. Do not move, resize, add or remove any of them. Keep the same camera angle, lens, perspective, crop and spatial disposition as the original photo.
		        DO NOT: change the room's size, shape, layout, proportions, perspective or camera; do not move/add/remove walls, windows, doors, openings or change ceiling/floor geometry.
		        DO (within the fixed geometry): freely restyle — repaint, wallpaper, wall paneling/cladding, flooring finish, ceiling finish, lighting (add/upgrade fixtures, track, recessed, LED, ambiance) — and add/replace furniture, rugs, curtains, tables, lamps, art, mirrors, plants and decor. The look can change a lot; the room's geometry cannot.
	        
	        NEW DESIGN INSTRUCTION (apply ONLY to surfaces, lighting and movable items — never to geometry):
        ${enhancedDescription}
        ${overrideMaterial ? `MATERIAL OVERRIDE: Apply ${overrideMaterial} to all new furniture.` : ''}

        FINAL OVERRIDE (defense-in-depth — beats anything above):
        - If ANY part of the design instruction above suggests moving, adding, removing, resizing or reshaping a wall, window, door, opening, ceiling, floor, column, stair, beam, balcony, loft, fireplace, or changing room dimensions/proportions/perspective/camera, IGNORE THAT PART.
        - Treat the input image as a locked architectural shell. Restyle it; do not redesign it.
        - The output image MUST be a photo-edit of the SAME room from the SAME viewpoint — not a new generation.

        Request ID: ${requestId}
      `;
      
      const result = await generateGeminiContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: base64Data } },
            { text: renderPrompt }
          ]
        }
      });

      let imgUrl = null;
      if (result.candidates?.[0]?.content?.parts) {
          for (const part of result.candidates[0].content.parts) {
              if (part.inlineData) imgUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          }
      }

      if (imgUrl) {
          setGeneratedImage(imgUrl);
          setExtraImages([]);
          
	          if (!overrideMaterial) {
	             setLoadingMessage(t.loading.report);
	             const reportRes = await generateGeminiContent({
	                 model: 'gemini-2.5-flash',
	                 contents: `Generate a 3 bullet point design report for: ${enhancedDescription}. Lang: ${lang}.`
		             });
		             setTransformationReport(reportRes.text || "Report unavailable.");
	          }
	          setLoadingMessage(`Curando lista de compras ${selectedProductProvider.name}...`);
	          setWayfairBudget([]);
	          const shoppingResult = await generateShoppingBudget({
	              roomLabel,
	              styleLabel: userStyleHint || (effectiveStyleId && STYLE_LABELS['en'][effectiveStyleId]) || "Designer's choice",
	              designDescription: `${enhancedDescription || ''}${overrideMaterial ? `\nMaterial override: ${overrideMaterial}` : ''}`,
	              language: lang,
	              budgetTier: selectedBudgetTier,
	              provider: selectedProductProvider,
	          });
	          setWayfairBudget(shoppingResult.items);
	          setWayfairBudgetNote(shoppingResult.note);
	          setCurrentStep(4);
      } else {
          throw new Error("No image generated");
      }

    } catch (e) {
      console.error(e);
      alert(`Erro na geração: ${e instanceof Error ? e.message : 'tente novamente.'}`);
    } finally {
      setIsGenerating(false);
      setLoadingMessage('');
    }
  };

  const handleAuthorizeProject = async () => {
     if (!generatedImage || !selectedRoomId || !selectedStyleId) return;
     if (!(await deductCredits(TECH_REPORT_COST))) return;
     
     setIsGenerating(true);
	     setLoadingMessage(t.loading.tech);
	     
	     try {
         const roomLabel = getSelectedRoomLabel('en');
	         const prompt = `
            ACT AS A SENIOR INTERIOR ARCHITECT.
		            PROJECT: ${roomLabel} in ${STYLE_LABELS['en'][selectedStyleId]} style.
		            TASK: Create a Professional Project Briefing for the Carpenter/Contractor.
		            LANGUAGE: ${lang === 'pt' ? 'Portuguese' : lang === 'es' ? 'Spanish' : 'English'}.
		            SELECTED CLIENT BUDGET: ${getBudgetRangeLabel(selectedBudgetTier, lang)}.
		            ${selectedProviderName.toUpperCase()} PROCUREMENT LIST:
		            ${wayfairBudget.map(item => `- ${item.quantity}x ${item.name} (${item.category}) - ${toMoney(item.totalPrice)} - ${item.url}`).join('\n')}
		            Include a short note that movable furniture/decor items were selected from ${selectedProviderName} links/searches and must be checked for final availability before purchase.
	            FORMAT: Plain text with headers.
	         `;
         const res = await generateGeminiContent({ model: 'gemini-2.5-flash', contents: prompt });
         setTechnicalBrief(res.text || "Briefing not available.");
         setIsApproved(true);
     } catch(e) { console.error(e); alert("Erro ao gerar briefing."); } finally { setIsGenerating(false); }
  };

  const downloadBriefingPDF = () => {
      if (!technicalBrief) return;
      const doc = new jsPDF();
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 15;
      let cursorY = 0;

      const drawHeader = () => {
        doc.setFillColor(28, 25, 23);
        doc.rect(0, 0, pageWidth, 25, 'F');
        doc.setTextColor(217, 119, 6);
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text("WayDecor", margin, 17);
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text("Briefing Técnico & Especificações", pageWidth - margin, 17, { align: 'right' });
        cursorY = 35;
      };

      drawHeader();
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(`Projeto:`, margin, cursorY);
      doc.setFont("helvetica", "normal");
      doc.text(`${getSelectedRoomLabel(lang)}`, margin + 20, cursorY);
      cursorY += 6;
      doc.setFont("helvetica", "bold");
      doc.text(`Estilo:`, margin, cursorY);
      doc.setFont("helvetica", "normal");
      doc.text(`${STYLE_LABELS[lang][selectedStyleId!] || selectedStyleId}`, margin + 20, cursorY);
      cursorY += 6;
      doc.setFont("helvetica", "bold");
      doc.text(`Data:`, margin, cursorY);
      doc.setFont("helvetica", "normal");
      doc.text(new Date().toLocaleDateString(), margin + 20, cursorY);
      cursorY += 10;
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, cursorY, pageWidth - margin, cursorY);
      cursorY += 10;
      doc.setFontSize(10);
      doc.setTextColor(30, 30, 30);
      
      const textLines = doc.splitTextToSize(technicalBrief, pageWidth - (margin * 2));
      const lineHeight = 6;
	      textLines.forEach((line: string) => {
	          if (cursorY + lineHeight > pageHeight - margin) {
	              doc.addPage();
              drawHeader();
              doc.setTextColor(30, 30, 30);
              doc.setFontSize(10);
          }
	          doc.text(line, margin, cursorY);
	          cursorY += lineHeight;
	      });
	      if (wayfairBudget.length > 0) {
	          cursorY += 8;
	          if (cursorY > pageHeight - 50) {
	              doc.addPage();
	              drawHeader();
	          }
	          doc.setFont("helvetica", "bold");
	          doc.setFontSize(13);
	          doc.setTextColor(217, 119, 6);
	          doc.text(`Orçamento ${selectedProviderName}`, margin, cursorY);
	          cursorY += 8;
	          doc.setFont("helvetica", "normal");
		          doc.setFontSize(9);
		          doc.setTextColor(40, 40, 40);
		          const budgetLines = doc.splitTextToSize(
		              `Budget selecionado: ${getBudgetRangeLabel(selectedBudgetTier, lang)}\n` +
		              `${wayfairBudgetNote || `Itens selecionados em ${selectedProviderName} para validação final de disponibilidade e preço.`}\n\n` +
		              wayfairBudget.map((item, index) =>
		                  `${index + 1}. ${item.quantity}x ${item.name} | ${item.category} | ${toMoney(item.totalPrice)} | ${item.url}`
		              ).join('\n'),
	              pageWidth - (margin * 2)
	          );
	          budgetLines.forEach((line: string) => {
	              if (cursorY + lineHeight > pageHeight - margin) {
	                  doc.addPage();
	                  drawHeader();
	                  doc.setTextColor(40, 40, 40);
	                  doc.setFontSize(9);
	              }
	              doc.text(line, margin, cursorY);
	              cursorY += lineHeight;
	          });
	      }
	      doc.save(`WayDecor_Briefing_${selectedRoomId}.pdf`);
	  };

	  const generateExtraViews = async () => {
	      if (!generatedImage || !(await deductCredits(EXTRA_VIEWS_COST))) return;
	      setIsGeneratingExtras(true);
      try {
          const optimized = await resizeImage(generatedImage); 
	          const base64 = optimized.split(',')[1];
	          const views = [
	              { label: 'Ângulo Inverso', prompt: 'Reverse angle view of the same decorated room. Preserve the same room dimensions, wall/window/door positions and spatial layout.' },
	              { label: 'Planta 3D', prompt: 'Isometric 3D floor plan view of the same decorated room. Preserve exact dimensions, proportions, wall positions, openings and furniture relationships.' },
	              { label: 'Detalhe', prompt: 'Close up detail of the custom furniture/joinery from this same room. Do not invent a different room or change the architecture.' }
	          ];
          const newExtras = [];
          for (const v of views) {
              const res = await generateGeminiContent({
                  model: 'gemini-2.5-flash-image',
                  contents: { parts: [{ inlineData: { mimeType: 'image/jpeg', data: base64 } }, { text: v.prompt }] }
              });
              if (res.candidates?.[0]?.content?.parts?.[0]?.inlineData) {
                  const p = res.candidates[0].content.parts[0].inlineData;
                  newExtras.push({ label: v.label, url: `data:${p.mimeType};base64,${p.data}` });
              }
          }
          setExtraImages(newExtras);
	      } catch(e) { console.error(e); } finally { setIsGeneratingExtras(false); }
	  };

	  const saveCommercialProject = async () => {
	      if (!selectedRoomId || !selectedStyleId || !generatedImage) return;
	      setSavingProject(true);
	      setProjectSaveMessage('');
	      try {
	          const response = await fetch('/api/projects', {
	              method: 'POST',
	              headers: { 'Content-Type': 'application/json' },
	              body: JSON.stringify({
		                  providerId: selectedProviderId,
		                  room: getSelectedRoomLabel(lang),
		                  style: customStyleHint.trim() || (selectedStyleId ? (STYLE_LABELS[lang][selectedStyleId] || selectedStyleId) : "Designer's choice"),
		                  budgetTier: selectedBudgetTierId,
		                  budgetRange: getBudgetRangeLabel(selectedBudgetTier, lang),
		                  budgetItems: wayfairBudget,
		                  budgetNote: wayfairBudgetNote,
		                  report: transformationReport,
	                  previewImage: generatedImage,
	              }),
	          });
	          if (!response.ok) throw new Error('save_failed');
	          setProjectSaveMessage('Projeto salvo no histórico comercial.');
	          await refreshSavedProjects();
	      } catch (error) {
	          console.error(error);
	          setProjectSaveMessage('Não foi possível salvar agora.');
	      } finally {
	          setSavingProject(false);
	      }
	  };

	  const wayfairTotal = wayfairBudget.reduce((sum, item) => sum + item.totalPrice, 0);
	  const budgetStatus = selectedBudgetTier.max && wayfairTotal > selectedBudgetTier.max
	      ? 'over'
	      : selectedBudgetTier.min > 0 && wayfairTotal > 0 && wayfairTotal < selectedBudgetTier.min
	          ? 'under'
	          : 'within';
	  const budgetStatusLabel = budgetStatus === 'over'
	      ? (lang === 'en' ? 'over budget' : lang === 'es' ? 'sobre el budget' : 'acima do budget')
	      : budgetStatus === 'under'
	          ? (lang === 'en' ? 'below range' : lang === 'es' ? 'debajo de la faixa' : 'abaixo da faixa')
	          : (lang === 'en' ? 'within budget' : lang === 'es' ? 'dentro del budget' : 'dentro do budget');

	  return (
    <div className="min-h-screen bg-[#f7f3fb] font-sans text-[#2f1a35] pb-20 relative">
      {/* TOAST NOTIFICATION */}
      {toastMessage && (
          <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 animate-bounce-in">
	              <div className="bg-[#7F187F] text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 border border-[#7F187F]/50 backdrop-blur-md">
	                  <Wifi className="w-5 h-5 animate-pulse" />
	                  <span className="font-bold text-sm tracking-wide">{toastMessage}</span>
	              </div>
	          </div>
	      )}

      {/* HEADER */}
      <header className="bg-white/90 backdrop-blur border-b border-[#eadff2] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex justify-between items-center">
          <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
            <img src="/icons/icon-192.png" alt="WayDecor logo" className="w-10 h-10 rounded-xl shadow-sm border border-[#eadff2]" />
            <div className="leading-tight">
                <div>WayDecor</div>
                <div className="hidden sm:block text-[10px] uppercase tracking-wide text-[#85758a] font-bold">Visual design + shopping list</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <Tooltip text={`Config: ${configSource === 'mongo' ? 'MongoDB' : 'Fallback local'}`}>
                <div className="hidden md:flex items-center gap-2 text-xs font-mono cursor-help transition-all hover:bg-[#f3e8ff] p-2 rounded">
                    {configSource === 'mongo' ? <Database className="w-3 h-3 text-[#7F187F]"/> : <HardDrive className="w-3 h-3 text-[#85758a]"/>}
                    <div className={`w-2 h-2 rounded-full ${dbStatus === 'connected' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : dbStatus === 'checking' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'}`}></div>
                </div>
             </Tooltip>

             <div className="flex bg-[#f3e8ff] rounded p-1">
                 {['pt','en','es'].map(l => (
                     <button key={l} onClick={() => setLang(l as Language)} className={`px-2 text-xs font-bold rounded uppercase ${lang===l ? 'bg-[#7F187F] text-white' : 'text-[#85758a]'}`}>{l}</button>
                 ))}
             </div>
             <div onClick={() => setShowPaywall(true)} className="flex items-center bg-white rounded-full px-3 py-1 border border-[#eadff2] cursor-pointer hover:bg-[#f3e8ff]">
                 <Coins className="w-4 h-4 text-[#7F187F] mr-2"/>
                 <span className="font-bold text-sm">{credits}<span className="hidden sm:inline text-[#85758a] ml-1">cr</span></span>
             </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* SIDEBAR */}
        <div className="lg:col-span-3 space-y-2">
           <Step number={1} title={t.steps.upload} isActive={currentStep===1} isCompleted={currentStep>1} />
           <Step number={2} title={t.steps.room} isActive={currentStep===2} isCompleted={currentStep>2} />
           <Step number={3} title={t.steps.style} isActive={currentStep===3} isCompleted={currentStep>3} />
           <div className="mt-8">
               <Step number={4} title={t.steps.project} isActive={currentStep===4} isCompleted={isApproved} />
           </div>
        </div>

        {/* CONTENT */}
        <div className="lg:col-span-9">
           {isGenerating ? <Spinner message={loadingMessage} /> : (
               <>
                {currentStep === 1 && (
                    <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_0.95fr] gap-6 animate-fade-in">
                        <section className="space-y-5">
                            <div>
                                <div className="inline-flex items-center gap-2 rounded-full bg-white border border-[#eadff2] px-3 py-1 text-xs font-black uppercase tracking-wide text-[#7F187F] shadow-sm">
                                    <Sparkles className="w-3.5 h-3.5" />
                                    {t.upload.heroEyebrow}
                                </div>
                                <h1 className="mt-4 text-3xl md:text-5xl font-black leading-tight text-[#2f1a35]">
                                    {t.upload.heroTitle}
                                </h1>
                                <p className="mt-4 text-base md:text-lg text-[#6f6075] leading-relaxed max-w-2xl">
                                    {t.upload.heroSubtitle}
                                </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {[
                                    [ImagePlus, t.upload.featureDesign],
                                    [ShoppingBag, t.upload.featureBudget],
                                    [ShieldCheck, t.upload.featureStructure],
                                ].map(([Icon, label]: any) => (
                                    <div key={label} className="bg-white border border-[#eadff2] rounded-lg px-4 py-3 flex items-center gap-3 shadow-sm">
                                        <Icon className="w-5 h-5 text-[#7F187F] shrink-0" />
                                        <span className="text-sm font-bold text-[#4b3650]">{label}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="block bg-white border border-[#eadff2] rounded-2xl overflow-hidden shadow-xl p-2">
                                <HeroComparisonPhoto
                                    image={DECORE_HERO_COMPARISON}
                                    beforeLabel={t.upload.demoBefore}
                                    afterLabel={t.upload.demoAfter}
                                />
                            </div>
                        </section>

                        <section className="bg-white rounded-2xl border border-[#eadff2] p-6 md:p-8 shadow-xl self-start">
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload}/>
                            <input type="file" ref={cameraInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleImageUpload}/>
                            <div className="w-16 h-16 bg-[#f3e8ff] rounded-xl flex items-center justify-center mb-6">
                                <UploadCloud size={32} className="text-[#7F187F]"/>
                            </div>
                            <h2 className="text-2xl md:text-3xl font-black mb-3 text-[#2f1a35]">{t.upload.title}</h2>
                            <p className="text-[#6f6075] mb-7 leading-relaxed">{t.upload.subtitle}</p>
                            <div className="flex flex-col gap-3">
                                <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full inline-flex items-center justify-center gap-2 bg-[#7F187F] text-white px-6 py-4 rounded-xl font-black hover:bg-[#651365] transition-colors shadow-lg">
                                    <ImagePlus className="w-5 h-5" />
                                    {t.upload.gallery}
                                </button>
                                <button type="button" onClick={() => cameraInputRef.current?.click()} className="w-full inline-flex items-center justify-center gap-2 bg-[#f3e8ff] text-[#7F187F] px-6 py-4 rounded-xl font-black hover:bg-[#eadff2] transition-colors border border-[#dac7e5]">
                                    <Camera className="w-5 h-5" />
                                    {t.upload.camera}
                                </button>
                            </div>
                            <div className="mt-6 rounded-lg bg-[#f7f3fb] border border-[#eadff2] p-4 text-sm text-[#6f6075] leading-relaxed">
                                <span className="font-black text-[#2f1a35]">Shopping-ready:</span> {t.upload.procurementNote}
                            </div>
                        </section>
                        </div>
                )}

                {currentStep === 2 && (
                    <div className="space-y-6 animate-fade-in">
                        <h2 className="text-2xl font-bold">{t.roomSelect.title}</h2>
                        {['residential', 'commercial'].map(cat => (
                            <div key={cat} className="mb-6">
                                <h3 className="text-sm font-bold text-[#85758a] uppercase mb-4 flex items-center">
                                    {cat === 'residential' ? <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg> : <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>}
                                    {cat === 'residential' ? t.roomSelect.residential : t.roomSelect.commercial}
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {ROOM_TYPES.filter(r => r.category === cat).map(r => (
                                        <button key={r.id} onClick={() => setSelectedRoomId(r.id)} className={`flex flex-col items-center p-4 rounded-xl transition-all ${selectedRoomId===r.id ? 'bg-[#f3e8ff] text-[#7F187F] ring-2 ring-[#7F187F]' : 'bg-white border border-[#eadff2] hover:border-[#7F187F]/50'}`}>
                                            <r.icon size={32} className="mb-3"/>
                                            <span className="text-sm font-medium text-center">{ROOM_LABELS[lang][r.id] || r.id}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                        <div className="bg-white border border-[#eadff2] rounded-2xl p-5 shadow-sm">
                            <h3 className="text-sm font-bold text-[#85758a] uppercase mb-4 flex items-center">
                                <HelpCircle className="w-4 h-4 mr-2" />
                                Opções flexíveis
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <button
                                    onClick={() => setSelectedRoomId('custom_room')}
                                    className={`flex items-start gap-4 p-4 rounded-xl text-left transition-all ${selectedRoomId==='custom_room' ? 'bg-[#f3e8ff] text-[#7F187F] ring-2 ring-[#7F187F]' : 'bg-[#fbf8fd] border border-[#eadff2] hover:border-[#7F187F]/50'}`}
                                >
                                    <HelpCircle size={30} className="shrink-0 mt-1" />
                                    <div>
                                        <div className="font-black">{t.roomSelect.customRoom}</div>
                                        <div className="text-xs text-[#85758a] mt-1">{t.roomSelect.customLabel}</div>
                                    </div>
                                </button>
                                <button
                                    onClick={() => setSelectedRoomId('ai_detect')}
                                    className={`flex items-start gap-4 p-4 rounded-xl text-left transition-all ${selectedRoomId==='ai_detect' ? 'bg-[#f3e8ff] text-[#7F187F] ring-2 ring-[#7F187F]' : 'bg-[#fbf8fd] border border-[#eadff2] hover:border-[#7F187F]/50'}`}
                                >
                                    <Sparkles size={30} className="shrink-0 mt-1" />
                                    <div>
                                        <div className="font-black">{t.roomSelect.autoRoom}</div>
                                        <div className="text-xs text-[#85758a] mt-1">{t.roomSelect.autoRoomHint}</div>
                                    </div>
                                </button>
                            </div>
                            {selectedRoomId === 'custom_room' && (
                                <div className="mt-4">
                                    <label className="block text-xs font-black uppercase text-[#85758a] mb-2">{t.roomSelect.customLabel}</label>
                                    <input
                                        value={customRoomType}
                                        onChange={e => setCustomRoomType(e.target.value)}
                                        placeholder={t.roomSelect.customPlaceholder}
                                        className="w-full bg-[#f7f3fb] border border-[#dac7e5] p-3 rounded-xl text-[#2f1a35] outline-none focus:ring-2 focus:ring-[#7F187F]"
                                    />
                                </div>
                            )}
                        </div>
                        {selectedRoomId === 'bedroom_kids' && (
                             <div className="bg-white border border-[#eadff2] p-4 rounded-xl grid grid-cols-3 gap-4">
                                 <input placeholder={t.kidsConfig.age} value={childAge} onChange={e=>setChildAge(e.target.value)} className="bg-[#f7f3fb] border border-[#dac7e5] p-2 rounded text-[#2f1a35]"/>
                                 <input placeholder={t.kidsConfig.theme} value={childTheme} onChange={e=>setChildTheme(e.target.value)} className="bg-[#f7f3fb] border border-[#dac7e5] p-2 rounded text-[#2f1a35]"/>
                                 <select value={childGender} onChange={e=>setChildGender(e.target.value)} className="bg-[#f7f3fb] border border-[#dac7e5] p-2 rounded text-[#2f1a35]">
                                     <option value="neutral">{t.kidsConfig.neutral}</option>
                                     <option value="boy">{t.kidsConfig.boy}</option>
                                     <option value="girl">{t.kidsConfig.girl}</option>
                                 </select>
                             </div>
                        )}
                        <div className="flex justify-end"><button onClick={() => canProceedFromRoom && setCurrentStep(3)} disabled={!canProceedFromRoom} className="bg-[#7F187F] px-8 py-3 rounded-xl font-bold text-white hover:bg-[#651365] disabled:opacity-45 disabled:cursor-not-allowed">{t.roomSelect.next}</button></div>
                    </div>
                )}

                {currentStep === 3 && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="flex justify-between items-center">
                            <h2 className="text-2xl font-bold">{t.styleSelect.title}</h2>
	                            <span className="bg-white px-3 py-1 rounded text-sm text-[#6f6075]">{t.styleSelect.cost}: {GENERATION_COST}</span>
	                        </div>
	                        <div className="bg-white border border-[#eadff2] rounded-2xl p-5">
	                            <div className="flex items-start justify-between gap-3 mb-4">
	                                <div className="flex items-center gap-2">
	                                    <Store className="w-5 h-5 text-[#7F187F]" />
	                                    <div>
	                                        <h3 className="font-black text-[#2f1a35]">{t.styleSelect.storeTitle}</h3>
	                                        <p className="text-xs text-[#85758a]">{t.styleSelect.storeSubtitle}</p>
	                                    </div>
	                                </div>
	                                {!selectedProviderId && <span className="text-xs font-bold text-[#7F187F] bg-[#f3e8ff] px-3 py-1 rounded-full whitespace-nowrap">{t.styleSelect.missingStore}</span>}
	                            </div>
	                            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
	                                {PRODUCT_PROVIDERS.map(provider => (
	                                    <button
	                                        key={provider.id}
	                                        onClick={() => provider.status === 'active' && setSelectedProviderId(provider.id)}
	                                        disabled={provider.status !== 'active'}
	                                        className={`text-left rounded-xl border p-3 transition-all ${selectedProviderId === provider.id ? 'bg-[#7F187F]/10 border-[#7F187F] text-[#7F187F]' : 'bg-[#f7f3fb] border-[#eadff2] text-[#6f6075]'} ${provider.status !== 'active' ? 'opacity-45 cursor-not-allowed' : 'hover:border-[#7F187F]'}`}
	                                    >
	                                        <div className="font-black text-sm">{provider.name}</div>
	                                        <div className="text-[10px] uppercase font-bold mt-1">{provider.status === 'active' ? 'ativo' : 'em breve'}</div>
	                                    </button>
	                                ))}
	                            </div>
	                        </div>
	                        <div className="bg-white border border-[#eadff2] rounded-2xl p-5">
	                            <div className="flex items-center gap-2 mb-4">
	                                <Coins className="w-5 h-5 text-[#7F187F]" />
	                                <div>
	                                    <h3 className="font-black text-[#2f1a35]">{t.styleSelect.budgetTitle}</h3>
	                                    <p className="text-xs text-[#85758a]">{t.styleSelect.budgetSubtitle}</p>
	                                </div>
	                            </div>
	                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
	                                {BUDGET_TIERS.map(tier => (
	                                    <button
	                                        key={tier.id}
	                                        type="button"
	                                        onClick={() => setSelectedBudgetTierId(tier.id)}
	                                        className={`text-left rounded-xl border p-4 transition-all ${selectedBudgetTierId === tier.id ? 'bg-[#7F187F]/10 border-[#7F187F] text-[#7F187F] ring-2 ring-[#7F187F]/20' : 'bg-[#f7f3fb] border-[#eadff2] text-[#4b3650] hover:border-[#7F187F]/50'}`}
	                                    >
	                                        <div className="flex items-center justify-between gap-3">
	                                            <div className="font-black text-lg">{tier.labels[lang]}</div>
	                                            {selectedBudgetTierId === tier.id && <CheckCircle2 className="w-5 h-5 shrink-0" />}
	                                        </div>
	                                        <p className="text-xs text-[#6f6075] mt-2 leading-relaxed">{tier.subtitles[lang]}</p>
	                                    </button>
	                                ))}
	                            </div>
	                        </div>
	                        <div className="bg-white border border-[#eadff2] rounded-2xl p-5">
	                            <div className="flex items-start gap-3 mb-3">
	                                <Wand2 className="w-5 h-5 text-[#7F187F] shrink-0 mt-0.5" />
	                                <div>
	                                    <h3 className="font-black text-[#2f1a35]">{t.styleSelect.styleHintTitle}</h3>
	                                    <p className="text-xs text-[#85758a]">{t.styleSelect.styleHintSubtitle}</p>
	                                </div>
	                            </div>
	                            <textarea
	                                value={customStyleHint}
	                                onChange={(e) => setCustomStyleHint(e.target.value)}
	                                placeholder={t.styleSelect.styleHintPlaceholder}
	                                rows={2}
	                                maxLength={280}
	                                className="w-full bg-[#f7f3fb] border border-[#dac7e5] rounded-lg p-3 text-sm text-[#2f1a35] placeholder:text-[#a596ad] focus:outline-none focus:border-[#7F187F] focus:ring-2 focus:ring-[#7F187F]/20 resize-none"
	                            />
	                            <p className="text-[11px] text-[#85758a] mt-2 italic">
	                                {customStyleHint.trim() ? t.styleSelect.styleHintUsing : t.styleSelect.styleHintAiChoice}
	                            </p>
	                        </div>
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white border border-[#eadff2] rounded-2xl p-4">
                            <div className="text-sm text-[#4b3650]">
                                <div className="font-black">
                                    {selectedProductProvider ? selectedProductProvider.name : t.styleSelect.missingStore}
                                    {' · '}
                                    {customStyleHint.trim() ? customStyleHint.trim().slice(0, 60) + (customStyleHint.trim().length > 60 ? '…' : '') : t.styleSelect.styleHintAiChoiceShort}
                                    {' · '}
                                    {getBudgetRangeLabel(selectedBudgetTier, lang)}
                                </div>
                                <div className="text-xs text-[#85758a] mt-1">A imagem e o inventário serão gerados somente depois dessas escolhas.</div>
                            </div>
                            <button onClick={() => generateDecoration()} disabled={loadingStyles || !canGenerateDecoration} className="bg-[#7F187F] px-10 py-4 rounded-xl font-bold text-white hover:bg-[#651365] shadow-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"><Wand2 className="mr-2"/> {canGenerateDecoration ? t.styleSelect.generate : t.styleSelect.missingStore}</button>
                        </div>
                    </div>
                )}

                {currentStep === 4 && generatedImage && selectedImage && (
                    <div className="space-y-8 animate-fade-in">
                        <div className="text-center">
                            <h2 className="text-3xl font-bold text-[#2f1a35]">{t.results.title}</h2>
                            <p className="text-[#6f6075]">{t.results.subtitle}</p>
                        </div>

	                        <ComparisonSlider before={selectedImage} after={generatedImage} />

	                        {/* PROCUREMENT BUDGET */}
	                        <div className="bg-white border border-[#D57DEA]/40 rounded-2xl overflow-hidden shadow-xl">
	                            <div className="p-5 border-b border-[#eadff2] flex flex-col md:flex-row md:items-center md:justify-between gap-3">
	                                <div>
	                                    <div className="flex items-center gap-2 text-[#7F187F] font-black uppercase tracking-wide text-sm">
	                                        <ShoppingBag className="w-4 h-4" />
	                                        {selectedProviderName} Shopping List
	                                    </div>
	                                    <p className="text-[#6f6075] text-sm mt-1">
	                                        Itens móveis e decoração limitados à {selectedProviderName}, com link direto ou busca validável na loja.
	                                    </p>
	                                    <div className="mt-3 flex flex-wrap gap-2">
	                                        <span className="inline-flex items-center gap-1 rounded-full bg-[#f3e8ff] px-3 py-1 text-xs font-black text-[#7F187F]">
	                                            <Coins className="w-3 h-3" />
	                                            Budget: {getBudgetRangeLabel(selectedBudgetTier, lang)}
	                                        </span>
	                                        {wayfairBudget.length > 0 && (
	                                            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-black ${budgetStatus === 'over' ? 'bg-red-50 text-red-700' : budgetStatus === 'under' ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>
	                                                {budgetStatusLabel}
	                                            </span>
	                                        )}
	                                    </div>
	                                </div>
	                                <div className="flex flex-col md:flex-row gap-3 md:items-center">
	                                    <button
	                                        onClick={saveCommercialProject}
	                                        disabled={savingProject || wayfairBudget.length === 0}
	                                        className="bg-[#7F187F] hover:bg-[#651365] disabled:opacity-50 text-white px-4 py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2"
	                                    >
	                                        <ClipboardList className="w-4 h-4" />
	                                        {savingProject ? 'Salvando...' : 'Salvar proposta'}
	                                    </button>
	                                    <div className="bg-[#f7f3fb] border border-[#eadff2] rounded-xl px-4 py-3 text-right">
	                                        <p className="text-[10px] text-[#85758a] uppercase font-bold">Total estimado</p>
	                                        <p className="text-2xl text-[#7F187F] font-black">{toMoney(wayfairTotal)}</p>
	                                    </div>
	                                </div>
	                            </div>
	                            {projectSaveMessage && (
	                                <div className="mx-5 mb-4 rounded-lg border border-[#eadff2] bg-[#f7f3fb] px-4 py-2 text-xs text-[#4b3650]">
	                                    {projectSaveMessage}
	                                </div>
	                            )}
	                            <div className="divide-y divide-[#eadff2]">
	                                {wayfairBudget.length > 0 ? wayfairBudget.map((item, index) => (
	                                    <div key={`${item.name}-${index}`} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
	                                        <div className="min-w-0">
	                                            <div className="flex flex-wrap items-center gap-2">
	                                                <span className="text-xs bg-[#f3e8ff] text-[#4b3650] px-2 py-1 rounded font-bold">{item.category}</span>
	                                                <span className={`text-[10px] px-2 py-1 rounded uppercase font-black ${item.validation === 'direct_product' ? 'bg-[#e9f8ee] text-[#1f7a3f]' : 'bg-[#f3e8ff] text-[#7F187F]'}`}>
	                                                    {item.validation === 'direct_product' ? `produto ${selectedProviderName}` : `busca ${selectedProviderName}`}
	                                                </span>
	                                            </div>
	                                            <h3 className="font-bold text-[#2f1a35] mt-2">{item.quantity}x {item.name}</h3>
	                                            {item.note && <p className="text-xs text-[#85758a] mt-1">{item.note}</p>}
	                                        </div>
	                                        <div className="flex items-center gap-3 shrink-0">
	                                            <div className="text-right">
	                                                <p className="font-black text-[#2f1a35]">{toMoney(item.totalPrice)}</p>
	                                                <p className="text-xs text-[#85758a]">{toMoney(item.unitPrice)} un.</p>
	                                            </div>
	                                            <a
	                                                href={item.url}
	                                                target="_blank"
	                                                rel="noopener noreferrer"
	                                                className="bg-[#f3e8ff] hover:bg-[#eadff2] border border-[#dac7e5] rounded-lg p-3 text-[#7F187F]"
	                                                title={`Abrir na ${selectedProviderName}`}
	                                            >
	                                                <ExternalLink className="w-4 h-4" />
	                                            </a>
	                                        </div>
	                                    </div>
	                                )) : (
	                                    <div className="p-5 text-sm text-[#6f6075]">
	                                        A lista da loja ainda não foi gerada. Gere novamente a transformação para criar o orçamento por itens.
	                                    </div>
	                                )}
	                            </div>
	                            {wayfairBudgetNote && (
	                                <div className="p-4 bg-[#f7f3fb]/70 text-xs text-[#85758a] border-t border-[#eadff2]">
	                                    {wayfairBudgetNote}
	                                </div>
	                            )}
	                        </div>
	                        
	                        {/* FLUXO DE APROVAÇÃO (BOTÃO AUTORIZAR) */}
                        <div className="flex flex-col items-center gap-4 bg-white p-6 rounded-2xl border border-[#eadff2] shadow-xl">
                            {!isApproved ? (
                                <div className="text-center w-full">
                                    <p className="text-[#6f6075] mb-4 text-sm">Gostou do resultado? Autorize para gerar o Briefing Técnico para execução.</p>
                                    <div className="flex justify-center gap-4">
                                        <button 
                                            onClick={handleAuthorizeProject} 
                                            className="w-full md:w-auto bg-green-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-green-700 transition-all shadow-lg flex items-center justify-center"
                                        >
                                            <CheckCircle2 className="mr-2 w-6 h-6"/> {t.results.authorize} <span className="text-xs bg-green-800 ml-2 px-2 py-0.5 rounded">-{TECH_REPORT_COST} cr</span>
                                        </button>
                                        <button onClick={handleNewProject} className="bg-[#f3e8ff] px-6 py-4 rounded-xl font-bold hover:bg-[#eadff2] text-[#4b3650] border border-[#dac7e5]">
                                            {t.results.restart}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="w-full flex flex-col md:flex-row items-center justify-center gap-4 animate-fade-in">
                                    <div className="flex items-center text-green-500 font-bold bg-green-900/20 px-4 py-2 rounded-lg border border-green-900/50">
                                        <Stamp className="mr-2 w-5 h-5"/> {t.results.authorized}
                                    </div>
                                    <button 
                                        onClick={downloadBriefingPDF} 
                                        className="bg-[#f3e8ff] text-[#2f1a35] px-8 py-3 rounded-xl font-bold flex items-center hover:bg-white transition-all shadow-lg border border-[#eadff2]"
                                    >
                                        <FileDown className="mr-2 w-5 h-5"/> {t.results.downloadPdf}
                                    </button>
                                    <button 
                                        onClick={() => {const l = document.createElement('a'); l.href=generatedImage; l.download='WayDecor_Render.jpg'; l.click()}} 
                                        className="bg-[#f3e8ff] text-[#4b3650] px-6 py-3 rounded-xl font-bold flex items-center hover:bg-[#eadff2] border border-[#dac7e5]"
                                    >
                                        <Download className="mr-2 w-5 h-5"/> {t.results.download}
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* MATERIAL SWITCHER */}
                        <div className="bg-white/80 border border-[#eadff2] p-6 rounded-xl">
                            <h3 className="font-bold mb-4 flex items-center text-[#2f1a35]">
                                <PaintBucket className="w-4 h-4 mr-2 text-[#7F187F]"/> {t.results.materialTitle}
                            </h3>
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    value={customMaterial}
                                    onChange={(e) => setCustomMaterial(e.target.value)}
                                    placeholder={t.results.materialPlaceholder}
                                    className="flex-1 bg-[#f7f3fb] border border-[#dac7e5] rounded-lg px-4 py-3 focus:outline-none focus:border-[#7F187F] transition-colors"
                                />
                                <button 
                                    onClick={() => generateDecoration(customMaterial)}
                                    className="bg-[#7F187F] hover:bg-[#651365] text-white px-6 py-3 rounded-lg font-bold transition-colors border border-[#7F187F]"
                                >
                                    {t.results.updateBtn}
                                </button>
                            </div>
                            <p className="text-xs text-[#85758a] mt-2 ml-1">{t.results.materialSub}</p>
                        </div>
                        
                         {/* EXTRA VIEWS */}
                         <div className="border-t border-[#eadff2] pt-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold flex items-center"><Layers className="mr-2 text-[#6f6075] w-5 h-5"/> {t.results.extraViewsTitle}</h3>
                                <button onClick={generateExtraViews} disabled={isGeneratingExtras} className="text-xs bg-[#f3e8ff] px-3 py-1 rounded text-[#4b3650] hover:bg-[#eadff2]">{isGeneratingExtras ? t.results.generatingAngles : t.results.generateAngles}</button>
                            </div>
	                            <div className="grid grid-cols-3 gap-4">
	                                {extraImages.map((img, i) => (
	                                    <div key={i} className="relative rounded-lg overflow-hidden border border-[#eadff2] group">
	                                        <img src={img.url} className="w-full h-32 object-cover"/>
	                                        <div className="absolute bottom-0 bg-black/60 w-full p-1 text-[10px] text-center">{img.label}</div>
	                                        <button onClick={() => {const l=document.createElement('a'); l.href=img.url; l.download=`View_${i}.jpg`; l.click()}} className="absolute top-1 right-1 bg-black/50 p-1 rounded hover:bg-white/20 hidden group-hover:block"><Download size={12}/></button>
	                                    </div>
	                                ))}
	                            </div>
	                         </div>
	                         {savedProjects.length > 0 && (
	                            <div className="border-t border-[#eadff2] pt-6">
	                                <h3 className="font-bold flex items-center mb-4">
	                                    <ClipboardList className="mr-2 text-[#6f6075] w-5 h-5" />
	                                    Histórico comercial
	                                </h3>
	                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
	                                    {savedProjects.slice(0, 3).map(project => (
	                                        <div key={project.id} className="bg-white border border-[#eadff2] rounded-xl p-4">
	                                            <p className="text-xs text-[#85758a]">{new Date(project.createdAt).toLocaleDateString()}</p>
	                                            <h4 className="font-black text-[#2f1a35] mt-1">{project.room || 'Ambiente'}</h4>
	                                            <p className="text-xs text-[#6f6075]">{project.style || 'Estilo'} • {project.providerName}</p>
	                                            {project.budgetRange && <p className="text-[11px] text-[#85758a] mt-1">Budget: {project.budgetRange}</p>}
	                                            <p className="text-[#7F187F] font-black mt-2">{toMoney(Number(project.total || 0))}</p>
	                                        </div>
	                                    ))}
	                                </div>
	                            </div>
	                         )}
	                    </div>
	                )}
               </>
           )}
        </div>
      </main>

      {/* PAYWALL MODAL */}
      {showPaywall && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
              <div className="bg-white max-w-2xl w-full rounded-2xl border border-[#eadff2] p-8 relative">
                  <button onClick={() => setShowPaywall(false)} className="absolute top-4 right-4 text-[#85758a] hover:text-[#2f1a35]"><XCircle/></button>
                  <h2 className="text-2xl font-bold text-[#7F187F] mb-2">{t.paywall.title}</h2>
                  <p className="text-[#6f6075] mb-6">{t.paywall.subtitle}</p>
                  <div className="grid grid-cols-3 gap-4">
                      {[{l:'Starter',c:50,p:25},{l:'Pro',c:120,p:50,pop:true},{l:'Agency',c:300,p:100}].map(pk => (
                          <div key={pk.l} onClick={() => alert("Stripe Integration Mock: Redirecting...")} className={`border rounded-xl p-4 cursor-pointer hover:border-[#7F187F] ${pk.pop ? 'bg-[#f3e8ff] border-[#7F187F] ring-1 ring-[#7F187F]' : 'bg-[#f7f3fb] border-[#eadff2]'}`}>
                              <h3 className="font-bold text-lg">{pk.l}</h3>
                              <div className="text-2xl font-bold my-2">{pk.c} <span className="text-xs text-[#85758a]">cr</span></div>
                              <button className="w-full bg-[#7F187F] text-white py-2 rounded text-xs font-bold mt-2 hover:bg-[#651365]">${pk.p}</button>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}
