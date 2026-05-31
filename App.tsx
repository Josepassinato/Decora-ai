import React, { useState, useRef, useEffect, useCallback, type ReactNode, type FC } from 'react';
import ReactDOM from 'react-dom/client';
import { UploadCloud, Sofa, BedDouble, Baby, LampDesk, CookingPot, Bath, Wand2, PartyPopper, XCircle, FileText, Utensils, Tv, Shirt, Trees, DoorOpen, Waves, Bed, BedSingle, Clapperboard, CarFront, Flame, Umbrella, Building2, Briefcase, Stethoscope, Dumbbell, Coffee, Presentation, Gamepad2, Store, Download, FileDown, Coins, CreditCard, LogOut, Lock, ShieldCheck, CheckCircle2, ClipboardList, HardHat, Info, Rocket, Palette, Calendar, ExternalLink, Layers, Eye, ImagePlus, Camera, Maximize, PaintBucket, RefreshCw, Hexagon, Sparkles, ShoppingBag, HelpCircle, Globe, Stamp, Wifi, WifiOff, Database, HardDrive, Bell } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { loadStripe } from "@stripe/stripe-js";
import { jsPDF } from "jspdf";

// --- CONFIGURAÇÃO DE AMBIENTE ---

const STRIPE_PUBLIC_KEY = "pk_live_51STX0AGP0hzTc9bmcPigXv82Tr0ee11AV3YFHpZZgvjq0JFvKUMZLHP4P2keTn2BhaPj90tTFNkw2N1iQXoSNqhU00K4M923KK"; 

// A chave da API é injetada via process.env ou usa o fallback fornecido
const GEMINI_API_KEY = process.env.API_KEY || 'AIzaSyChe9wkjloCxBBnsaYNCMLPQQXU6c-NkxA';

// --- "THE VAULT": MEMÓRIA DE SISTEMA (FALLBACK/DEFAULT) ---
const DEFAULT_SYSTEM_MEMORY = {
	    ARCHITECT_PROTOCOL: `
	      CRITICAL SYSTEM DIRECTIVES (NON-NEGOTIABLE):
	      1. STRUCTURAL LOCK: Existing walls, ceiling height, floor plan, doors, windows, columns, beams, stairs and fixed plumbing locations are immutable.
	      2. NO STRUCTURAL EDITS: Never create, remove, move, widen or close openings, windows, doors, walls, columns or stairs.
	      3. COSMETIC FREEDOM: You may change wall colors, wallpaper, paint finishes, decorative cladding, movable furniture, rugs, curtains, art, mirrors, plants and special lighting.
	      4. BLANK WALL STRATEGY: If a wall is blank, improve it cosmetically with paint, wallpaper, art, lighting, removable panels or decor. Do not create architectural openings.
      
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
	      4. TEXTURE QUALITY: 8K Photorealism.
	      5. LIGHTING PHYSICS: Use warm layered lighting, accent lighting, wall washers, LED strips, pendants, sconces or lamps when appropriate.
	    `
};

// --- INICIALIZAÇÃO DE SERVIÇOS ---

let stripePromise: any = null;

try {
    if (STRIPE_PUBLIC_KEY) stripePromise = loadStripe(STRIPE_PUBLIC_KEY);
    console.log("🚀 Decore AI: serviços do cliente inicializados.");
} catch (e) {
    console.error("Erro crítico na inicialização dos serviços:", e);
}

// --- REDIMENSIONAMENTO DE IMAGEM (CLIENT SIDE) ---
const resizeImage = (base64Str: string, maxWidth = 1536, maxHeight = 1536): Promise<string> => {
  return new Promise((resolve) => {
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
      resolve(canvas.toDataURL('image/jpeg', 0.85)); // 85% quality
    };
    img.onerror = () => resolve(base64Str);
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

const WAYFAIR_BASE_URL = 'https://www.wayfair.com';
const WAYFAIR_SEARCH_URL = `${WAYFAIR_BASE_URL}/keyword.php`;
const DECORE_DEMO_BEFORE = 'https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?auto=format&fit=crop&w=900&q=80';
const DECORE_DEMO_AFTER = 'https://images.unsplash.com/photo-1600210492493-0946911123ea?auto=format&fit=crop&w=900&q=80';

const buildWayfairSearchUrl = (term: string) =>
  `${WAYFAIR_SEARCH_URL}?keyword=${encodeURIComponent(term.trim() || 'home decor')}`;

const isWayfairUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'wayfair.com' || parsed.hostname.endsWith('.wayfair.com');
  } catch {
    return false;
  }
};

const isWayfairDirectProductUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    const isWayfair = parsed.hostname === 'wayfair.com' || parsed.hostname.endsWith('.wayfair.com');
    return isWayfair && !parsed.pathname.includes('keyword.php');
  } catch {
    return false;
  }
};

const toMoney = (value: number) =>
  value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

const normalizeWayfairItem = (raw: any): WayfairBudgetItem | null => {
  if (!raw || typeof raw !== 'object') return null;
  const name = String(raw.name || '').trim();
  const category = String(raw.category || 'Decor').trim();
  const quantity = Math.max(1, Number(raw.quantity || 1));
  const unitPrice = Math.max(0, Number(raw.unitPrice || raw.price || 0));
  const proposedUrl = String(raw.url || '').trim();
  const url = isWayfairUrl(proposedUrl) ? proposedUrl : buildWayfairSearchUrl(name || category);
  if (!name) return null;
  return {
    name,
    category,
    quantity,
    unitPrice,
    totalPrice: Number((unitPrice * quantity).toFixed(2)),
    url,
    validation: proposedUrl && isWayfairDirectProductUrl(proposedUrl) ? 'direct_product' : 'search_result',
    note: String(raw.note || '').trim(),
  };
};

const PRODUCT_PROVIDERS = [
  { id: 'wayfair', name: 'Wayfair', status: 'active', note: 'Fornecedor principal para decoracao compravel.' },
  { id: 'home-depot', name: 'Home Depot', status: 'planned', note: 'Materiais e acabamentos de obra.' },
  { id: 'ikea', name: 'IKEA', status: 'planned', note: 'Moveis modulares e economicos.' },
  { id: 'west-elm', name: 'West Elm', status: 'planned', note: 'Decoracao premium.' },
  { id: 'manual-catalog', name: 'Catalogo manual', status: 'planned', note: 'Lojas sem catalogo publico, como HomeSense.' },
];

const extractJsonObject = (text: string) => {
  const fenced = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
  if (fenced?.[1]) return fenced[1];
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  throw new Error('Wayfair response did not contain JSON.');
};

const generateWayfairBudget = async (
  ai: GoogleGenAI,
  params: {
    roomLabel: string;
    styleLabel: string;
    designDescription: string;
    language: Language;
  }
): Promise<{ items: WayfairBudgetItem[]; note: string }> => {
  const prompt = `
You are a procurement-focused interior designer.

TASK:
Create a Wayfair-only shopping list for this generated interior design.

ROOM: ${params.roomLabel}
STYLE: ${params.styleLabel}
DESIGN DESCRIPTION:
${params.designDescription}

STRICT PROCUREMENT RULES:
1. Use ONLY products or product-searches from https://www.wayfair.com.
2. Use Google Search to look for real Wayfair product pages or strong Wayfair category/search matches.
3. Do not invent product IDs, SKUs, seller names, brands or URLs.
4. If a direct product page is not confidently found, use a Wayfair search URL for the exact item name.
5. Return 6 to 10 items that could realistically compose this room: furniture, rug, lighting, wall decor, accents, storage and textiles.
6. Prices must be realistic planning prices in USD. If exact current price is uncertain, use a conservative estimate and explain that in note.

Return ONLY valid JSON:
{
  "note": "short procurement note in ${params.language === 'pt' ? 'Portuguese' : params.language === 'es' ? 'Spanish' : 'English'}",
  "items": [
    {
      "name": "Wayfair-searchable product name",
      "category": "Sofa | Rug | Lighting | Decor | Storage | Table | Chair | Bedding | Bath | Outdoor",
      "quantity": 1,
      "unitPrice": 249.99,
      "url": "https://www.wayfair.com/...",
      "note": "direct product if verified, otherwise search match"
    }
  ]
}`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: { tools: [{ googleSearch: {} }] },
  });

  const parsed = JSON.parse(extractJsonObject(response.text || '{}'));
  const items = Array.isArray(parsed.items)
    ? parsed.items.map(normalizeWayfairItem).filter(Boolean) as WayfairBudgetItem[]
    : [];

  return {
    items,
    note: String(parsed.note || 'Wayfair shopping list generated with product links/search links for final validation.'),
  };
};

const TRANSLATIONS = {
  pt: {
    nav: { store: "Loja", login: "Entrar", credits: "créditos" },
    steps: { upload: "Foto do ambiente", room: "Cômodo", style: "Estilo", project: "Projeto e orçamento" },
    upload: { title: "Comece com uma foto do ambiente", subtitle: "Envie uma imagem da galeria ou abra a câmera do celular", gallery: "Escolher da galeria", camera: "Abrir câmera", heroEyebrow: "Design com IA + lista de compra", heroTitle: "Decore seu ambiente com peças reais para comprar", heroSubtitle: "A Decore AI transforma uma foto em uma proposta visual, preserva a estrutura do espaço e monta um orçamento item por item com produtos pesquisáveis na Wayfair.", featureDesign: "Imagem de encantamento", featureBudget: "Orçamento comprável", featureStructure: "Sem mexer na estrutura", demoBefore: "ambiente original", demoAfter: "visão projetada", procurementNote: "a proposta final separa móveis, iluminação, tapetes e decoração em uma lista de compra validável." },
    roomSelect: { title: "Qual ambiente vamos transformar?", residential: "Residencial", commercial: "Comercial & Corporativo", next: "Próximo", customLabel: "Descreva seu negócio:", customPlaceholder: "Ex: Barbearia Vintage..." },
    kidsConfig: { title: "Configuração do Quarto Infantil", age: "Idade", theme: "Tema", themePlaceholder: "Ex: Dinossauros...", gender: "Gênero", select: "Selecione...", boy: "Menino", girl: "Menina", neutral: "Neutro" },
    styleSelect: { title: "Escolha o estilo ideal", cost: "Custo", generate: "Gerar Transformação" },
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
    upload: { title: "Start with a room photo", subtitle: "Upload from gallery or open your phone camera", gallery: "Choose from gallery", camera: "Open camera", heroEyebrow: "AI design + shopping list", heroTitle: "Redesign your room with real products to buy", heroSubtitle: "Decore AI turns a photo into a visual proposal, preserves the room structure and builds an item-by-item budget with searchable Wayfair products.", featureDesign: "Visual transformation", featureBudget: "Buyable budget", featureStructure: "No structural edits", demoBefore: "original room", demoAfter: "projected vision", procurementNote: "the final proposal separates furniture, lighting, rugs and decor into a validated shopping list." },
    roomSelect: { title: "Which room are we transforming?", residential: "Residential", commercial: "Commercial", next: "Next", customLabel: "Describe business:", customPlaceholder: "Ex: Vintage Barbershop..." },
    kidsConfig: { title: "Kids Room Config", age: "Age", theme: "Theme", themePlaceholder: "Ex: Dinosaurs...", gender: "Gender", select: "Select...", boy: "Boy", girl: "Girl", neutral: "Neutral" },
    styleSelect: { title: "Choose ideal style", cost: "Cost", generate: "Generate" },
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
    upload: { title: "Empieza con una foto del ambiente", subtitle: "Sube desde la galería o abre la cámara del celular", gallery: "Elegir de galería", camera: "Abrir cámara", heroEyebrow: "Diseño con IA + lista de compra", heroTitle: "Rediseña tu ambiente con productos reales para comprar", heroSubtitle: "Decore AI transforma una foto en una propuesta visual, preserva la estructura y crea un presupuesto por ítems con productos buscables en Wayfair.", featureDesign: "Imagen de impacto", featureBudget: "Presupuesto comprable", featureStructure: "Sin cambios estructurales", demoBefore: "ambiente original", demoAfter: "visión proyectada", procurementNote: "la propuesta final separa muebles, iluminación, alfombras y decoración en una lista de compra validable." },
    roomSelect: { title: "¿Qué ambiente transformamos?", residential: "Residencial", commercial: "Comercial", next: "Siguiente", customLabel: "Describe tu negocio:", customPlaceholder: "Ej: Barbería Vintage..." },
    kidsConfig: { title: "Config Habitación Infantil", age: "Edad", theme: "Tema", themePlaceholder: "Ej: Dinosaurios...", gender: "Género", select: "Seleccione...", boy: "Niño", girl: "Niña", neutral: "Neutro" },
    styleSelect: { title: "Elige estilo ideal", cost: "Costo", generate: "Generar" },
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
    living_room: 'Sala de Estar', bedroom_master: 'Quarto Casal', bedroom_kids: 'Quarto Infantil', bedroom_single: 'Quarto Solteiro', bedroom_guest: 'Quarto Visitas', closet: 'Closet / Vestuário', kitchen: 'Cozinha', dining_room: 'Sala de Jantar', bathroom: 'Banheiro', office: 'Home Office', hall: 'Hall de Entrada', laundry: 'Lavanderia', balcony: 'Varanda / Terraço', cinema: 'Sala de Cinema', garage: 'Garagem', bbq: 'Churrasqueira', pool: 'Área Piscina', reception_medical: 'Recepção Consultório', lobby_corporate: 'Lobby Corporativo', meeting_room: 'Sala de Reunião', coworking: 'Espaço Coworking', coffee_shop: 'Cafeteria / Copa', lobby_residential: 'Lobby Residencial', party_hall: 'Salão de Festas', gym: 'Academia', kids_club: 'Brinquedoteca', custom_commercial: 'Outro / Loja'
  },
  en: {
    living_room: 'Living Room', bedroom_master: 'Master Bedroom', bedroom_kids: 'Kids Bedroom', bedroom_single: 'Single Bedroom', bedroom_guest: 'Guest Bedroom', closet: 'Walk-in Closet', kitchen: 'Kitchen', dining_room: 'Dining Room', bathroom: 'Bathroom', office: 'Home Office', hall: 'Entrance Hall', laundry: 'Laundry Room', balcony: 'Balcony / Terrace', cinema: 'Home Theater', garage: 'Garage', bbq: 'BBQ Area', pool: 'Pool Area', reception_medical: 'Medical Reception', lobby_corporate: 'Corporate Lobby', meeting_room: 'Meeting Room', coworking: 'Coworking Space', coffee_shop: 'Coffee Shop', lobby_residential: 'Residential Lobby', party_hall: 'Party Hall', gym: 'Gym', kids_club: 'Kids Club', custom_commercial: 'Other / Retail'
  },
  es: {
    living_room: 'Sala de Estar', bedroom_master: 'Dormitorio Principal', bedroom_kids: 'Dormitorio Niños', bedroom_single: 'Dormitorio Individual', bedroom_guest: 'Dormitorio Visitas', closet: 'Vestidor', kitchen: 'Cocina', dining_room: 'Comedor', bathroom: 'Baño', office: 'Oficina en Casa', hall: 'Recibidor', laundry: 'Lavandería', balcony: 'Balcón / Terraza', cinema: 'Cine en Casa', garage: 'Garaje', bbq: 'Zona de Barbacoa', pool: 'Zona de Piscina', reception_medical: 'Recepción Médica', lobby_corporate: 'Vestíbulo Corporativo', meeting_room: 'Sala de Reuniones', coworking: 'Espacio Coworking', coffee_shop: 'Cafetería', lobby_residential: 'Vestíbulo Residencial', party_hall: 'Salón de Fiestas', gym: 'Gimnasio', kids_club: 'Club Infantil', custom_commercial: 'Otro / Tienda'
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

  // Personalizado
  { id: 'custom_commercial', icon: Store, category: 'commercial' }
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
  const [selectedProviderId, setSelectedProviderId] = useState('wayfair');
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
    
    const effectiveStyleId = targetStyleId || selectedStyleId || 'modern';
    if (targetStyleId) setSelectedStyleId(targetStyleId);

    if (selectedRoomId === 'bedroom_kids' && (!childAge || !childTheme)) {
        alert("Informe idade e tema para quarto infantil."); return;
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
      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
      const room = ROOM_TYPES.find(r => r.id === selectedRoomId);
      const style = decorStyles.find(s => s.id === effectiveStyleId);
      const requestId = new Date().getTime();

      setLoadingMessage(t.loading.design);
      
      // USE DYNAMIC SYSTEM MEMORY HERE
      const creativePrompt = `
        ${systemMemory.ARCHITECT_PROTOCOL}
        
        Act as a Senior Interior Architect.
        Target Style: ${STYLE_LABELS['en'][effectiveStyleId]} (${style?.prompt_modifier || 'High-end design'})
        Room Type: ${selectedRoomId === 'custom_commercial' ? customRoomType : ROOM_LABELS['en'][selectedRoomId]}
        ${selectedRoomId === 'bedroom_kids' ? `Kids Config: Age ${childAge}, Theme ${childTheme}, Gender ${childGender}.` : ''}
        ${overrideMaterial ? `MANDATORY MATERIAL OVERRIDE: All furniture and joinery MUST USE: ${overrideMaterial}.` : ''}
        
	        INSTRUCTIONS:
	        1. ANALYZE STRUCTURE: Preserve the exact room shell. Do not change walls, windows, doors, columns, stairs, ceiling geometry or fixed openings.
	        2. COSMETIC DESIGN ONLY: You may change wall colors, wallpaper, paint effects, decorative panels, movable furniture, rugs, curtains, art, mirrors, plants and special lighting.
	        3. LIGHTING UPGRADE: Add sophisticated lighting only as visible fixtures or lighting effects, not as structural changes.
	        4. REDESIGN INTERIOR: Apply a new, sophisticated composition without changing the architecture of the room.
	        5. WAYFAIR PROCUREMENT LOCK: The design must be executable with furniture, lighting, rugs, wall decor, storage, textiles and decorative items that can be sourced on Wayfair.com.
	        6. Do not depend on custom-only or unbuyable pieces unless they are non-structural finishes already present in the room.
	        
	        Output only the raw prompt text.
	      `;

      const creativeRes = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: creativePrompt
      });
      
      const enhancedDescription = creativeRes.text;

      setLoadingMessage(t.loading.rendering);

      const optimizedBase64 = await resizeImage(selectedImage);
      const base64Data = optimizedBase64.split(',')[1];
      
      const renderPrompt = `
        ${systemMemory.RENDERER_PROTOCOL}

	        TASK: REDESIGN INTERIOR LAYOUT with 2025 LUXURY TRENDS.
	        INPUT IMAGE: This is the IMMUTABLE SHELL.
	        STRUCTURAL WARNING: Keep all existing walls, doors, windows, ceiling shape, floor plan, columns, stairs and fixed openings exactly where they are. Only cosmetic and movable-item changes are allowed.
        
        NEW DESIGN INSTRUCTION:
        ${enhancedDescription}
        ${overrideMaterial ? `MATERIAL OVERRIDE: Apply ${overrideMaterial} to all new furniture.` : ''}

        Request ID: ${requestId}
      `;
      
      const result = await ai.models.generateContent({
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
	             const reportRes = await ai.models.generateContent({
	                 model: 'gemini-2.5-flash',
	                 contents: `Generate a 3 bullet point design report for: ${enhancedDescription}. Lang: ${lang}.`
		             });
		             setTransformationReport(reportRes.text || "Report unavailable.");
	          }
	          setLoadingMessage("Curando lista de compras Wayfair...");
	          setWayfairBudget([]);
	          const wayfairResult = await generateWayfairBudget(ai, {
	              roomLabel: selectedRoomId === 'custom_commercial' ? customRoomType : ROOM_LABELS['en'][selectedRoomId],
	              styleLabel: STYLE_LABELS['en'][effectiveStyleId],
	              designDescription: `${enhancedDescription || ''}${overrideMaterial ? `\nMaterial override: ${overrideMaterial}` : ''}`,
	              language: lang,
	          });
	          setWayfairBudget(wayfairResult.items);
	          setWayfairBudgetNote(wayfairResult.note);
	          setCurrentStep(4);
      } else {
          throw new Error("No image generated");
      }

    } catch (e) {
      console.error(e);
      alert("Erro na geração. Tente novamente.");
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
         const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
         const prompt = `
            ACT AS A SENIOR INTERIOR ARCHITECT.
	            PROJECT: ${ROOM_LABELS['en'][selectedRoomId]} in ${STYLE_LABELS['en'][selectedStyleId]} style.
	            TASK: Create a Professional Project Briefing for the Carpenter/Contractor.
	            LANGUAGE: ${lang === 'pt' ? 'Portuguese' : lang === 'es' ? 'Spanish' : 'English'}.
	            WAYFAIR PROCUREMENT LIST:
	            ${wayfairBudget.map(item => `- ${item.quantity}x ${item.name} (${item.category}) - ${toMoney(item.totalPrice)} - ${item.url}`).join('\n')}
	            Include a short note that movable furniture/decor items were selected from Wayfair links/searches and must be checked for final availability before purchase.
	            FORMAT: Plain text with headers.
	         `;
         const res = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
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
        doc.text("Decore AI", margin, 17);
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
      doc.text(`${ROOM_LABELS[lang][selectedRoomId!] || selectedRoomId}`, margin + 20, cursorY);
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
	          doc.text("Orçamento Wayfair", margin, cursorY);
	          cursorY += 8;
	          doc.setFont("helvetica", "normal");
	          doc.setFontSize(9);
	          doc.setTextColor(40, 40, 40);
	          const budgetLines = doc.splitTextToSize(
	              `${wayfairBudgetNote || 'Itens selecionados em Wayfair para validação final de disponibilidade e preço.'}\n\n` +
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
	      doc.save(`DecoreAI_Briefing_${selectedRoomId}.pdf`);
	  };

	  const generateExtraViews = async () => {
	      if (!generatedImage || !(await deductCredits(EXTRA_VIEWS_COST))) return;
	      setIsGeneratingExtras(true);
      try {
          const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
          const optimized = await resizeImage(generatedImage); 
          const base64 = optimized.split(',')[1];
          const views = [
              { label: 'Ângulo Inverso', prompt: 'Reverse angle view of this room. Show the 4th wall.' },
              { label: 'Planta 3D', prompt: 'Isometric 3D floor plan view (dollhouse view).' },
              { label: 'Detalhe', prompt: 'Close up detail of the custom furniture/joinery.' }
          ];
          const newExtras = [];
          for (const v of views) {
              const res = await ai.models.generateContent({
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
	                  room: ROOM_LABELS[lang][selectedRoomId] || selectedRoomId,
	                  style: STYLE_LABELS[lang][selectedStyleId] || selectedStyleId,
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
            <div className="bg-[#7F187F] p-2 rounded border border-[#651365] shadow-sm"><Sparkles className="text-white w-5 h-5"/></div>
            <div className="leading-tight">
                <div>Decore AI</div>
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
                                <ComparisonSlider
                                    before={DECORE_DEMO_BEFORE}
                                    after={DECORE_DEMO_AFTER}
                                    className="h-48 sm:h-64 md:h-80 border"
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
                                <span className="font-black text-[#2f1a35]">Wayfair-ready:</span> {t.upload.procurementNote}
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
                        <div className="flex justify-end"><button onClick={() => setCurrentStep(3)} className="bg-[#7F187F] px-8 py-3 rounded-xl font-bold text-white hover:bg-[#651365]">{t.roomSelect.next}</button></div>
                    </div>
                )}

                {currentStep === 3 && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="flex justify-between items-center">
                            <h2 className="text-2xl font-bold">{t.styleSelect.title}</h2>
	                            <span className="bg-white px-3 py-1 rounded text-sm text-[#6f6075]">{t.styleSelect.cost}: {GENERATION_COST}</span>
	                        </div>
	                        <div className="bg-white border border-[#eadff2] rounded-2xl p-5">
	                            <div className="flex items-center gap-2 mb-4">
	                                <Store className="w-5 h-5 text-[#7F187F]" />
	                                <div>
	                                    <h3 className="font-black text-[#2f1a35]">Fornecedor do orçamento</h3>
	                                    <p className="text-xs text-[#85758a]">Nesta versão, a decoração comprável fica travada no fornecedor ativo.</p>
	                                </div>
	                            </div>
	                            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
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
	                        {loadingStyles ? (
                            <div className="flex justify-center py-20"><Spinner message={t.loading.seeding || "Loading..."} /></div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {decorStyles.map(s => (
                                    <Tooltip key={s.id} text={s.prompt_modifier}>
                                        <button onClick={() => setSelectedStyleId(s.id)} className={`relative aspect-video rounded-xl overflow-hidden border bg-[#f3e8ff] ${selectedStyleId===s.id ? 'ring-2 ring-[#7F187F]' : 'border-[#eadff2] hover:scale-105'} transition-all`}>
                                            <img src={s.thumb} className="w-full h-full object-cover opacity-60 hover:opacity-100" onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/300?text=Style'; }}/>
                                            <div className="absolute bottom-0 left-0 w-full p-2 bg-black/60 font-bold text-sm text-white z-10">{STYLE_LABELS[lang][s.id] || s.id}</div>
                                            {selectedStyleId === s.id && <div className="absolute top-2 right-2 bg-[#7F187F] text-white rounded-full p-1 z-10"><CheckCircle2 size={16}/></div>}
                                        </button>
                                    </Tooltip>
                                ))}
                            </div>
                        )}
                        <div className="flex justify-end"><button onClick={() => generateDecoration()} disabled={loadingStyles} className="bg-[#7F187F] px-10 py-4 rounded-xl font-bold text-white hover:bg-[#651365] shadow-lg flex items-center disabled:opacity-50"><Wand2 className="mr-2"/> {t.styleSelect.generate}</button></div>
                    </div>
                )}

                {currentStep === 4 && generatedImage && selectedImage && (
                    <div className="space-y-8 animate-fade-in">
                        <div className="text-center">
                            <h2 className="text-3xl font-bold text-[#2f1a35]">{t.results.title}</h2>
                            <p className="text-[#6f6075]">{t.results.subtitle}</p>
                        </div>

	                        <ComparisonSlider before={selectedImage} after={generatedImage} />

	                        {/* WAYFAIR PROCUREMENT BUDGET */}
	                        <div className="bg-white border border-[#D57DEA]/40 rounded-2xl overflow-hidden shadow-xl">
	                            <div className="p-5 border-b border-[#eadff2] flex flex-col md:flex-row md:items-center md:justify-between gap-3">
	                                <div>
	                                    <div className="flex items-center gap-2 text-[#7F187F] font-black uppercase tracking-wide text-sm">
	                                        <ShoppingBag className="w-4 h-4" />
	                                        Wayfair Shopping List
	                                    </div>
	                                    <p className="text-[#6f6075] text-sm mt-1">
	                                        Itens móveis e decoração limitados à Wayfair, com link direto ou busca validável na loja.
	                                    </p>
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
	                                                    {item.validation === 'direct_product' ? 'produto Wayfair' : 'busca Wayfair'}
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
	                                                title="Abrir na Wayfair"
	                                            >
	                                                <ExternalLink className="w-4 h-4" />
	                                            </a>
	                                        </div>
	                                    </div>
	                                )) : (
	                                    <div className="p-5 text-sm text-[#6f6075]">
	                                        A lista Wayfair ainda não foi gerada. Gere novamente a transformação para criar o orçamento por itens da loja.
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
                                        onClick={() => {const l = document.createElement('a'); l.href=generatedImage; l.download='DecoreAI_Render.jpg'; l.click()}} 
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
