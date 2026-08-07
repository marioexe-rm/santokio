export const VERIFICATION = Object.freeze({
  VERIFIED: "verified",
  DEMO: "demo",
  UNVERIFIED: "unverified",
  NOT_APPLICABLE: "not_applicable",
});

export const CATALOGUE_FILTER_OPTIONS = Object.freeze({
  categories: Object.freeze([
    "Poleras",
    "Vestidos",
    "Enteritos",
    "Jeans",
    "Pantalones",
    "Shorts",
    "Faldas",
    "Polerones",
    "Suéter",
    "Chalecos",
    "Abrigos",
    "Chaquetas",
    "Parkas",
    "Camisas",
    "Polos",
    "Blusas",
    "Beatles",
    "Cárdigans",
    "Blazers",
    "Montgomerys",
    "Carteras",
    "Billeteras",
    "Cinturones",
    "Jockey",
    "Bufandas",
    "Pañuelos",
    "Echarpes",
    "Pulseras",
    "Aros",
    "Anteojos",
    "Calcetines",
    "Zapatillas",
    "Zapatos",
    "Botas",
    "Botines",
    "Sandalias",
    "Bolsos",
    "Trajes de Baño",
    "Pijamas",
    "Sombreros",
    "Maletines",
    "Llaveros",
    "Viseras",
  ]),
  materials: Object.freeze([
    "Algodón",
    "Lana",
    "Seda",
    "Merino",
    "Lino",
    "Cuero",
    "Piel",
    "Mezclilla",
    "Acrílico",
    "Alpaca",
    "Angora",
    "Elastano",
    "Bambú",
    "Brocado",
    "Cáñamo",
    "Cachemira",
    "Ecocuero",
    "Lyocell",
    "Modal",
    "Mohair",
    "Nailon",
    "Polar",
    "Poliamida",
    "Poliéster",
    "Poliuretano",
    "Raso",
    "Rayón",
    "Terciopelo",
    "Thinsulate",
    "Vicuña",
    "Viscosa",
  ]),
  sizes: Object.freeze([
    "XS",
    "S",
    "M",
    "L",
    "XL",
    "XXL",
    "26",
    "27",
    "28",
    "29",
    "30",
    "31",
    "32",
    "33",
    "34",
    "35",
    "36",
    "37",
    "38",
    "39",
    "40",
    "41",
    "42",
    "43",
    "44",
    "45",
    "46",
    "47",
    "48",
  ]),
});

export const SITE_CONFIG = Object.freeze({
  brand: "SanTokyo",
  locale: "es-CL",
  currency: "CLP",
  siteTitle: "Ropa japonesa nueva en Chile | SanTokyo",
  siteDescription:
    "Prendas nuevas importadas desde Japón y disponibles en Chile. Revisa fotografías reales y coordina la compra por WhatsApp; paga por transferencia o efectivo.",
  whatsappNumber: "56932926203",
  whatsappBrandName: "Santokyo",
  collectionWhatsappMessage:
    "Hola, quisiera consultar por la colección de Santokyo.",
  generalWhatsappMessage:
    "Hola, quisiera conocer más sobre la colección de SanTokyo. ¿Me pueden orientar?",
  instagramHandle: "santokyo_jp",
  instagramUrl: "https://www.instagram.com/santokyo_jp/",
  instagramLabel: "Instagram de SanTokyo",
  shippingCostClp: 3000,
  delivery:
    "El envío dentro de Santiago tiene un costo fijo de $3.000, pagado previamente y no reembolsable. Al recibir la prenda podrás revisarla, pagar su valor mediante transferencia o efectivo y probártela. Si decides no quedártela, deberás devolverla en ese mismo momento y se reembolsará el valor de la prenda. El costo del envío no se devuelve.",
  confirmationNote:
    "Cada prenda publicada corresponde a una unidad. Talla, medidas y entrega se confirman previamente. El envío dentro de Santiago cuesta $3.000, se paga antes y no es reembolsable. La prenda se paga al recibirla mediante transferencia o efectivo; puedes probártela y, si no te la quedas, debes devolverla inmediatamente durante la misma entrega para recibir el reembolso del valor de la prenda.",
  publicSiteUrl: "https://santokyo.com/",
  socialImageUrl:
    "https://santokyo.com/assets/social/santokyo-coleccion.jpg",
  socialImageWidth: 1200,
  socialImageHeight: 630,
  socialImageType: "image/jpeg",
  socialImageAlt:
    "Tres faldas nuevas de la colección SanTokyo fotografiadas sobre superficies de madera.",
});

const AI_DISCLOSURE =
  "Visualización referencial generada con IA. No constituye evidencia exacta de calce, caída, proporciones, color, construcción ni detalles de la prenda física.";

// DATOS DEMO TEMPORALES: todo campo marcado VERIFICATION.DEMO debe
// sustituirse por información comprobada de la prenda antes de producción.
const baseProducts = [
  {
    id: "STK-001",
    reference: "STK-001",
    slug: "pieza-01",
    folder: "ropa/1",
    name: "Falda Verde",
    shortDescription:
      "Falda con paneles y patrón gráfico visible en las fotografías reales.",
    longDescription:
      "La fotografía real muestra una falda con paneles contrastados y un patrón gráfico. La composición, la talla y las medidas deben verificarse antes de coordinar.",
    category: "Faldas",
    audience: "Mujer",
    size: "S",
    measurements: {
      Cintura: "68 cm",
      Cadera: "92 cm",
      Largo: "82 cm",
    },
    materials: ["Poliéster", "Rayón"],
    origin: "Importada desde Japón",
    manufactureCountry: "Japón",
    originalTag: "Conserva su etiqueta original",
    originalPriceYen: 12900,
    priceClp: 79990,
    condition: "Nueva, con etiqueta original",
    availability: 1,
    featured: true,
    fieldVerification: {
      name: VERIFICATION.NOT_APPLICABLE,
      category: VERIFICATION.VERIFIED,
      audience: VERIFICATION.DEMO,
      size: VERIFICATION.DEMO,
      measurements: VERIFICATION.DEMO,
      materials: VERIFICATION.DEMO,
      origin: VERIFICATION.VERIFIED,
      manufactureCountry: VERIFICATION.DEMO,
      originalTag: VERIFICATION.VERIFIED,
      originalPriceYen: VERIFICATION.DEMO,
      priceClp: VERIFICATION.DEMO,
      condition: VERIFICATION.VERIFIED,
    },
    images: [
      {
        source: "assets/catalogo/1/tercer_resultado.png",
        src: "assets/catalogo/1/derivados/pieza-01-visualizacion-ia-1-960.webp",
        srcset: [
          { src: "assets/catalogo/1/derivados/pieza-01-visualizacion-ia-1-480.webp", width: 480 },
          { src: "assets/catalogo/1/derivados/pieza-01-visualizacion-ia-1-960.webp", width: 960 },
        ],
        kind: "ai-model-visualization",
        width: 960,
        height: 1200,
        alt: "Visualización referencial generada con IA de una modelo con una prenda inspirada en la Falda Verde.",
        disclosure: AI_DISCLOSURE,
      },
      {
        source: "assets/catalogo/1/cuarto_resultado.png",
        src: "assets/catalogo/1/derivados/pieza-01-visualizacion-ia-2-960.webp",
        srcset: [
          { src: "assets/catalogo/1/derivados/pieza-01-visualizacion-ia-2-480.webp", width: 480 },
          { src: "assets/catalogo/1/derivados/pieza-01-visualizacion-ia-2-960.webp", width: 960 },
        ],
        kind: "ai-model-visualization",
        width: 960,
        height: 1200,
        alt: "Segunda visualización referencial generada con IA de una modelo con una prenda inspirada en la Falda Verde.",
        disclosure: AI_DISCLOSURE,
      },
      {
        source: "assets/catalogo/1/quinto_resultado.png",
        src: "assets/catalogo/1/derivados/pieza-01-visualizacion-ia-3-960.webp",
        srcset: [
          { src: "assets/catalogo/1/derivados/pieza-01-visualizacion-ia-3-480.webp", width: 480 },
          { src: "assets/catalogo/1/derivados/pieza-01-visualizacion-ia-3-960.webp", width: 960 },
        ],
        kind: "ai-model-visualization",
        width: 960,
        height: 1200,
        alt: "Tercera visualización referencial generada con IA de una modelo con una prenda inspirada en la Falda Verde.",
        disclosure: AI_DISCLOSURE,
      },
      {
        source: "assets/catalogo/1/frontal_1.jpeg",
        src: "assets/catalogo/1/derivados/pieza-01-fotografia-frontal-1200.webp",
        srcset: [
          { src: "assets/catalogo/1/derivados/pieza-01-fotografia-frontal-640.webp", width: 640 },
          { src: "assets/catalogo/1/derivados/pieza-01-fotografia-frontal-1200.webp", width: 1200 },
          { src: "assets/catalogo/1/derivados/pieza-01-fotografia-frontal-1800.webp", width: 1800 },
        ],
        kind: "real-product-photo",
        width: 1200,
        height: 1600,
        alt: "Falda extendida sobre una superficie de madera, con paneles de patrones gráficos en tonos oscuros, verdes, morados y claros.",
        disclosure: "Fotografía real de la prenda disponible.",
      },
      {
        source: "assets/catalogo/1/trasera_1.jpeg",
        src: "assets/catalogo/1/derivados/pieza-01-fotografia-trasera-1200.webp",
        srcset: [
          { src: "assets/catalogo/1/derivados/pieza-01-fotografia-trasera-640.webp", width: 640 },
          { src: "assets/catalogo/1/derivados/pieza-01-fotografia-trasera-1200.webp", width: 1200 },
          { src: "assets/catalogo/1/derivados/pieza-01-fotografia-trasera-1800.webp", width: 1800 },
        ],
        kind: "real-product-photo",
        width: 1200,
        height: 1600,
        alt: "Vista posterior de la falda extendida sobre una superficie de madera, tomada desde arriba.",
        disclosure: "Fotografía real de la prenda disponible.",
      },
    ],
    editableNotes: "Reemplazar los campos demo por datos verificados antes de producción.",
  },
  {
    id: "STK-002",
    reference: "STK-002",
    slug: "pieza-02",
    folder: "ropa/2",
    name: "Falda Amarilla",
    shortDescription:
      "Falda con motivo floral, pliegues y detalle de volante visible en las fotografías reales.",
    longDescription:
      "La fotografía real muestra una falda con motivo floral, pliegues verticales y un detalle de volante. La composición, la talla y las medidas deben verificarse antes de coordinar.",
    category: "Faldas",
    audience: "Mujer",
    size: "M",
    measurements: {
      Cintura: "72 cm",
      Cadera: "96 cm",
      Largo: "86 cm",
    },
    materials: ["Viscosa", "Poliéster"],
    origin: "Importada desde Japón",
    manufactureCountry: "China",
    originalTag: "Conserva su etiqueta original",
    originalPriceYen: 14900,
    priceClp: 89990,
    condition: "Nueva, con etiqueta original",
    availability: 1,
    featured: false,
    fieldVerification: {
      name: VERIFICATION.NOT_APPLICABLE,
      category: VERIFICATION.VERIFIED,
      audience: VERIFICATION.DEMO,
      size: VERIFICATION.DEMO,
      measurements: VERIFICATION.DEMO,
      materials: VERIFICATION.DEMO,
      origin: VERIFICATION.VERIFIED,
      manufactureCountry: VERIFICATION.DEMO,
      originalTag: VERIFICATION.VERIFIED,
      originalPriceYen: VERIFICATION.DEMO,
      priceClp: VERIFICATION.DEMO,
      condition: VERIFICATION.VERIFIED,
    },
    images: [
      {
        source: "assets/catalogo/2/tercer_resultado.png",
        src: "assets/catalogo/2/derivados/pieza-02-visualizacion-ia-1-960.webp",
        srcset: [
          { src: "assets/catalogo/2/derivados/pieza-02-visualizacion-ia-1-480.webp", width: 480 },
          { src: "assets/catalogo/2/derivados/pieza-02-visualizacion-ia-1-960.webp", width: 960 },
        ],
        kind: "ai-model-visualization",
        width: 960,
        height: 1200,
        alt: "Visualización referencial generada con IA de una modelo con una prenda inspirada en la Falda Amarilla.",
        disclosure: AI_DISCLOSURE,
      },
      {
        source: "assets/catalogo/2/ChatGPT Image 24 may 2026, 01_12_37 a.m..png",
        src: "assets/catalogo/2/derivados/pieza-02-visualizacion-ia-2-960.webp",
        srcset: [
          { src: "assets/catalogo/2/derivados/pieza-02-visualizacion-ia-2-480.webp", width: 480 },
          { src: "assets/catalogo/2/derivados/pieza-02-visualizacion-ia-2-960.webp", width: 960 },
        ],
        kind: "ai-model-visualization",
        width: 960,
        height: 1200,
        alt: "Segunda visualización referencial generada con IA de una modelo con una prenda inspirada en la Falda Amarilla.",
        disclosure: AI_DISCLOSURE,
      },
      {
        source: "assets/catalogo/2/ChatGPT Image 24 may 2026, 01_51_04 a.m..png",
        src: "assets/catalogo/2/derivados/pieza-02-visualizacion-ia-3-960.webp",
        srcset: [
          { src: "assets/catalogo/2/derivados/pieza-02-visualizacion-ia-3-480.webp", width: 480 },
          { src: "assets/catalogo/2/derivados/pieza-02-visualizacion-ia-3-960.webp", width: 960 },
        ],
        kind: "ai-model-visualization",
        width: 960,
        height: 1200,
        alt: "Tercera visualización referencial generada con IA de una modelo con una prenda inspirada en la Falda Amarilla.",
        disclosure: AI_DISCLOSURE,
      },
      {
        source: "assets/catalogo/2/frontal_2.jpeg",
        src: "assets/catalogo/2/derivados/pieza-02-fotografia-frontal-1200.webp",
        srcset: [
          { src: "assets/catalogo/2/derivados/pieza-02-fotografia-frontal-640.webp", width: 640 },
          { src: "assets/catalogo/2/derivados/pieza-02-fotografia-frontal-1200.webp", width: 1200 },
          { src: "assets/catalogo/2/derivados/pieza-02-fotografia-frontal-1800.webp", width: 1800 },
        ],
        kind: "real-product-photo",
        width: 1200,
        height: 1600,
        alt: "Falda clara con motivo floral, pliegues verticales y un volante, extendida sobre una superficie de madera.",
        disclosure: "Fotografía real de la prenda disponible.",
      },
      {
        source: "assets/catalogo/2/trasera_2.jpeg",
        src: "assets/catalogo/2/derivados/pieza-02-fotografia-trasera-1200.webp",
        srcset: [
          { src: "assets/catalogo/2/derivados/pieza-02-fotografia-trasera-640.webp", width: 640 },
          { src: "assets/catalogo/2/derivados/pieza-02-fotografia-trasera-1200.webp", width: 1200 },
          { src: "assets/catalogo/2/derivados/pieza-02-fotografia-trasera-1800.webp", width: 1800 },
        ],
        kind: "real-product-photo",
        width: 1200,
        height: 1600,
        alt: "Vista posterior de la falda clara con motivo floral extendida sobre una superficie de madera.",
        disclosure: "Fotografía real de la prenda disponible.",
      },
    ],
    editableNotes: "Reemplazar los campos demo por datos verificados antes de producción.",
  },
  {
    id: "STK-003",
    reference: "STK-003",
    slug: "pieza-03",
    folder: "ropa/3",
    name: "Falda Beige",
    shortDescription:
      "Falda clara con superficie texturada y terminación semitransparente visible en las fotografías reales.",
    longDescription:
      "La fotografía real muestra una falda clara de superficie texturada, con dos detalles de botón y una terminación semitransparente. La composición, la talla y las medidas deben verificarse antes de coordinar.",
    category: "Faldas",
    audience: "Mujer",
    size: "L",
    measurements: {
      Cintura: "76 cm",
      Cadera: "100 cm",
      Largo: "88 cm",
    },
    materials: ["Poliéster", "Nailon"],
    origin: "Importada desde Japón",
    manufactureCountry: "Vietnam",
    originalTag: "Conserva su etiqueta original",
    originalPriceYen: 16900,
    priceClp: 99990,
    condition: "Nueva, con etiqueta original",
    availability: 1,
    featured: false,
    fieldVerification: {
      name: VERIFICATION.NOT_APPLICABLE,
      category: VERIFICATION.VERIFIED,
      audience: VERIFICATION.DEMO,
      size: VERIFICATION.DEMO,
      measurements: VERIFICATION.DEMO,
      materials: VERIFICATION.DEMO,
      origin: VERIFICATION.VERIFIED,
      manufactureCountry: VERIFICATION.DEMO,
      originalTag: VERIFICATION.VERIFIED,
      originalPriceYen: VERIFICATION.DEMO,
      priceClp: VERIFICATION.DEMO,
      condition: VERIFICATION.VERIFIED,
    },
    images: [
      {
        source: "assets/catalogo/3/ChatGPT Image 24 may 2026, 02_11_27 a.m..png",
        src: "assets/catalogo/3/derivados/pieza-03-visualizacion-ia-1-960.webp",
        srcset: [
          { src: "assets/catalogo/3/derivados/pieza-03-visualizacion-ia-1-480.webp", width: 480 },
          { src: "assets/catalogo/3/derivados/pieza-03-visualizacion-ia-1-960.webp", width: 960 },
        ],
        kind: "ai-model-visualization",
        width: 960,
        height: 1200,
        alt: "Visualización referencial generada con IA de una modelo con una prenda inspirada en la Falda Beige.",
        disclosure: AI_DISCLOSURE,
      },
      {
        source: "assets/catalogo/3/ChatGPT Image 24 may 2026, 02_14_36 a.m..png",
        src: "assets/catalogo/3/derivados/pieza-03-visualizacion-ia-2-960.webp",
        srcset: [
          { src: "assets/catalogo/3/derivados/pieza-03-visualizacion-ia-2-480.webp", width: 480 },
          { src: "assets/catalogo/3/derivados/pieza-03-visualizacion-ia-2-960.webp", width: 960 },
        ],
        kind: "ai-model-visualization",
        width: 960,
        height: 1200,
        alt: "Segunda visualización referencial generada con IA de una modelo con una prenda inspirada en la Falda Beige.",
        disclosure: AI_DISCLOSURE,
      },
      {
        source: "assets/catalogo/3/ChatGPT Image 24 may 2026, 02_17_19 a.m..png",
        src: "assets/catalogo/3/derivados/pieza-03-visualizacion-ia-3-960.webp",
        srcset: [
          { src: "assets/catalogo/3/derivados/pieza-03-visualizacion-ia-3-480.webp", width: 480 },
          { src: "assets/catalogo/3/derivados/pieza-03-visualizacion-ia-3-960.webp", width: 960 },
        ],
        kind: "ai-model-visualization",
        width: 960,
        height: 1200,
        alt: "Tercera visualización referencial generada con IA de una modelo con una prenda inspirada en la Falda Beige.",
        disclosure: AI_DISCLOSURE,
      },
      {
        source: "assets/catalogo/3/frontal.jpeg",
        src: "assets/catalogo/3/derivados/pieza-03-fotografia-frontal-1200.webp",
        srcset: [
          { src: "assets/catalogo/3/derivados/pieza-03-fotografia-frontal-640.webp", width: 640 },
          { src: "assets/catalogo/3/derivados/pieza-03-fotografia-frontal-1200.webp", width: 1200 },
          { src: "assets/catalogo/3/derivados/pieza-03-fotografia-frontal-1800.webp", width: 1800 },
        ],
        kind: "real-product-photo",
        width: 1200,
        height: 1600,
        alt: "Falda clara con superficie texturada, dos detalles de botón y una terminación semitransparente, extendida sobre madera.",
        disclosure: "Fotografía real de la prenda disponible.",
      },
      {
        source: "assets/catalogo/3/trasera.jpeg",
        src: "assets/catalogo/3/derivados/pieza-03-fotografia-trasera-1200.webp",
        srcset: [
          { src: "assets/catalogo/3/derivados/pieza-03-fotografia-trasera-640.webp", width: 640 },
          { src: "assets/catalogo/3/derivados/pieza-03-fotografia-trasera-1200.webp", width: 1200 },
          { src: "assets/catalogo/3/derivados/pieza-03-fotografia-trasera-1800.webp", width: 1800 },
        ],
        kind: "real-product-photo",
        width: 1200,
        height: 1600,
        alt: "Vista posterior de la falda clara y texturada extendida sobre una superficie de madera.",
        disclosure: "Fotografía real de la prenda disponible.",
      },
    ],
    editableNotes: "Reemplazar los campos demo por datos verificados antes de producción.",
  },
];

// CATÁLOGO DEMO TEMPORAL: estas 27 prendas y todos sus atributos comerciales
// existen para probar la interfaz. Deben sustituirse por inventario verificado
// antes de publicar el catálogo en producción. Las imágenes se reutilizan sin
// duplicar archivos y cada objeto se clona para evitar referencias mutables.
const demoProductDefinitions = [
  ["Polerón Índigo", "Polerones", "XS", 69990, ["Algodón", "Poliéster"]],
  ["Polera Marfil", "Poleras", "S", 49990, ["Algodón"]],
  ["Pantalón Grafito", "Pantalones", "M", 89990, ["Lana", "Poliéster"]],
  ["Vestido Azul", "Vestidos", "L", 109990, ["Seda", "Viscosa"]],
  ["Chaqueta Corta", "Chaquetas", "XL", 129990, ["Merino", "Nailon"]],
  ["Falda Plisada", "Faldas", "S", 84990, ["Algodón", "Poliéster"]],
  ["Polerón Arena", "Polerones", "M", 74990, ["Algodón", "Rayón"]],
  ["Polera Verde", "Poleras", "L", 54990, ["Algodón", "Poliéster"]],
  ["Pantalón Recto", "Pantalones", "XL", 94990, ["Merino", "Poliéster"]],
  ["Vestido Negro", "Vestidos", "XS", 119990, ["Seda", "Rayón"]],
  ["Chaqueta Liviana", "Chaquetas", "S", 114990, ["Nailon", "Algodón"]],
  ["Falda Floral", "Faldas", "M", 79990, ["Viscosa", "Poliéster"]],
  ["Polerón Gris", "Polerones", "L", 79990, ["Lana", "Algodón"]],
  ["Polera Lila", "Poleras", "XL", 59990, ["Algodón"]],
  ["Pantalón Crema", "Pantalones", "XS", 99990, ["Algodón", "Lana"]],
  ["Vestido Marfil", "Vestidos", "S", 124990, ["Seda", "Viscosa"]],
  ["Chaqueta Índigo", "Chaquetas", "M", 139990, ["Merino", "Poliéster"]],
  ["Falda Midi", "Faldas", "L", 89990, ["Rayón", "Nailon"]],
  ["Polerón Burdeo", "Polerones", "XL", 84990, ["Lana", "Algodón"]],
  ["Polera Rayada", "Poleras", "XS", 64990, ["Algodón", "Rayón"]],
  ["Pantalón Ancho", "Pantalones", "S", 104990, ["Lana", "Poliéster"]],
  ["Vestido Verde", "Vestidos", "M", 129990, ["Seda", "Algodón"]],
  ["Chaqueta Técnica", "Chaquetas", "L", 149990, ["Nailon", "Poliéster"]],
  ["Falda Negra", "Faldas", "XL", 94990, ["Merino", "Rayón"]],
  ["Polerón Crudo", "Polerones", "XS", 89990, ["Algodón", "Lana"]],
  ["Polera Azul", "Poleras", "S", 69990, ["Algodón"]],
  ["Pantalón Beige", "Pantalones", "M", 109990, ["Merino", "Poliéster"]],
];

const demoCategoryCopy = Object.freeze({
  Faldas: {
    short: "Falda de línea midi con una silueta versátil.",
    long: "Falda de línea midi presentada con talla, composición y medidas para facilitar una consulta directa.",
    measurements: { Cintura: "70 cm", Cadera: "96 cm", Largo: "84 cm" },
  },
  Polerones: {
    short: "Polerón de corte relajado y largo regular.",
    long: "Polerón de corte relajado presentado con talla, composición y medidas para facilitar una consulta directa.",
    measurements: { Pecho: "104 cm", Largo: "66 cm", Manga: "60 cm" },
  },
  Poleras: {
    short: "Polera de corte recto y largo regular.",
    long: "Polera de corte recto presentada con talla, composición y medidas para facilitar una consulta directa.",
    measurements: { Pecho: "96 cm", Largo: "62 cm", Hombros: "40 cm" },
  },
  Pantalones: {
    short: "Pantalón de tiro medio y línea recta.",
    long: "Pantalón de línea recta presentado con talla, composición y medidas para facilitar una consulta directa.",
    measurements: { Cintura: "74 cm", Cadera: "100 cm", Largo: "102 cm" },
  },
  Vestidos: {
    short: "Vestido de largo midi y silueta fluida.",
    long: "Vestido de largo midi presentado con talla, composición y medidas para facilitar una consulta directa.",
    measurements: { Pecho: "94 cm", Cintura: "76 cm", Largo: "112 cm" },
  },
  Chaquetas: {
    short: "Chaqueta corta de estructura liviana.",
    long: "Chaqueta corta presentada con talla, composición y medidas para facilitar una consulta directa.",
    measurements: { Pecho: "108 cm", Largo: "64 cm", Manga: "61 cm" },
  },
});

const demoFieldVerification = Object.freeze({
  name: VERIFICATION.DEMO,
  category: VERIFICATION.DEMO,
  audience: VERIFICATION.DEMO,
  size: VERIFICATION.DEMO,
  measurements: VERIFICATION.DEMO,
  materials: VERIFICATION.DEMO,
  origin: VERIFICATION.DEMO,
  manufactureCountry: VERIFICATION.DEMO,
  originalTag: VERIFICATION.DEMO,
  originalPriceYen: VERIFICATION.NOT_APPLICABLE,
  priceClp: VERIFICATION.DEMO,
  condition: VERIFICATION.DEMO,
});

function makeDemoSlug(name, productNumber) {
  const normalizedName = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return `${normalizedName}-${String(productNumber).padStart(2, "0")}`;
}

function cloneDemoImages(images, productName) {
  return images.map((image, imageIndex) => ({
    ...image,
    srcset: image.srcset?.map((candidate) => ({ ...candidate })),
    alt:
      image.kind === "ai-model-visualization"
        ? `${imageIndex === 0 ? "Visualización" : "Otra visualización"} referencial generada con IA para ${productName}.`
        : `Fotografía de prenda reutilizada temporalmente para el producto de demostración ${productName}.`,
  }));
}

function createDemoProduct(definition, definitionIndex) {
  const [name, category, size, priceClp, materials] = definition;
  const productNumber = definitionIndex + baseProducts.length + 1;
  const reference = `STK-${String(productNumber).padStart(3, "0")}`;
  const imageSourceProduct = baseProducts[definitionIndex % baseProducts.length];
  const categoryCopy = demoCategoryCopy[category];
  const manufactureCountries = ["Japón", "China", "Vietnam"];

  return {
    id: reference,
    reference,
    slug: makeDemoSlug(name, productNumber),
    folder: imageSourceProduct.folder,
    demoSourceProductId: imageSourceProduct.id,
    name,
    shortDescription: categoryCopy.short,
    longDescription: categoryCopy.long,
    category,
    audience: "Mujer",
    size,
    measurements: { ...categoryCopy.measurements },
    materials: [...new Set(materials)],
    origin: "Importada desde Japón",
    manufactureCountry:
      manufactureCountries[definitionIndex % manufactureCountries.length],
    originalTag: "Conserva su etiqueta original",
    originalPriceYen: null,
    priceClp,
    condition: "Nueva",
    availability: 1,
    featured: productNumber % 5 === 0,
    fieldVerification: { ...demoFieldVerification },
    images: cloneDemoImages(imageSourceProduct.images, name),
    editableNotes:
      "Producto y atributos demo: reemplazar por datos verificados antes de producción.",
  };
}

export const products = [
  ...baseProducts,
  ...demoProductDefinitions.map(createDemoProduct),
];
