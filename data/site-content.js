import { SITE_CONFIG, VERIFICATION } from "./products.js";

export const AI_IMAGE_KIND = "ai-model-visualization";
export const REAL_IMAGE_KIND = "real-product-photo";

const moneyFormatter = new Intl.NumberFormat(SITE_CONFIG.locale, {
  style: "currency",
  currency: SITE_CONFIG.currency,
  maximumFractionDigits: 0,
});

const yenFormatter = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function formatIndex(index) {
  return String(index + 1).padStart(2, "0");
}

export function formatPrice(product) {
  const isVerified =
    product.fieldVerification?.priceClp === VERIFICATION.VERIFIED;

  return Number.isFinite(product.priceClp) && isVerified
    ? moneyFormatter.format(product.priceClp)
    : "Precio por confirmar";
}

export function formatAvailability(product) {
  if (!Number.isInteger(product.availability) || product.availability < 0) {
    return "Disponibilidad por confirmar";
  }

  if (product.availability === 0) {
    return "Sin unidades disponibles";
  }

  return product.availability === 1
    ? "1 unidad disponible"
    : `${product.availability} unidades disponibles`;
}

export function renderAvailability(
  product,
  value = formatAvailability(product),
) {
  const availability = Number.isInteger(product.availability)
    ? product.availability
    : "unknown";

  return `
    <span class="availability" data-availability="${escapeHtml(availability)}">
      <span class="availability-indicator" aria-hidden="true"></span>
      <span class="availability-label">${escapeHtml(value)}</span>
    </span>
  `;
}

export function formatMaterials(product) {
  if (
    product.fieldVerification?.materials !== VERIFICATION.VERIFIED ||
    !product.materials
  ) {
    return "Composición por confirmar";
  }

  return Array.isArray(product.materials)
    ? product.materials.join(", ")
    : String(product.materials);
}

export function formatMeasurements(product) {
  if (
    product.fieldVerification?.measurements !== VERIFICATION.VERIFIED ||
    !product.measurements
  ) {
    return "Medidas por confirmar";
  }

  if (Array.isArray(product.measurements)) {
    return product.measurements.join(" · ");
  }

  if (typeof product.measurements === "object") {
    return Object.entries(product.measurements)
      .map(([label, value]) => `${label}: ${value}`)
      .join(" · ");
  }

  return String(product.measurements);
}

export function formatSize(product) {
  return product.fieldVerification?.size === VERIFICATION.VERIFIED &&
    product.size
    ? String(product.size)
    : "Talla por confirmar";
}

export function getRealImages(product) {
  return product.images.filter((image) => image.kind === REAL_IMAGE_KIND);
}

export function getAiImages(product) {
  return product.images.filter((image) => image.kind === AI_IMAGE_KIND);
}

export function getOrderedImages(product) {
  const aiImages = getAiImages(product);
  const realImages = getRealImages(product);
  const classifiedImages = new Set([...aiImages, ...realImages]);
  const otherImages = product.images.filter(
    (image) => !classifiedImages.has(image),
  );

  return [...aiImages, ...realImages, ...otherImages];
}

export function getImageSrcset(image) {
  if (!Array.isArray(image.srcset) || image.srcset.length === 0) {
    return "";
  }

  return image.srcset
    .map((candidate) => `${candidate.src} ${candidate.width}w`)
    .join(", ");
}

export function renderImageAttributes(
  image,
  {
    alt = image.alt,
    sizes,
    loading = "lazy",
    fetchPriority = "low",
  } = {},
) {
  const srcset = getImageSrcset(image);

  return [
    `src="${escapeHtml(image.src)}"`,
    srcset ? `srcset="${escapeHtml(srcset)}"` : "",
    sizes ? `sizes="${escapeHtml(sizes)}"` : "",
    `alt="${escapeHtml(alt)}"`,
    `width="${escapeHtml(image.width)}"`,
    `height="${escapeHtml(image.height)}"`,
    `loading="${escapeHtml(loading)}"`,
    'decoding="async"',
    `fetchpriority="${escapeHtml(fetchPriority)}"`,
  ]
    .filter(Boolean)
    .join("\n          ");
}

export function getContainedImageAspectRatio(image) {
  const trimNumber = (value) => value.toFixed(6).replace(/\.?0+$/, "");
  return trimNumber(image.width / image.height);
}

function renderContainedImageFrameStyle(image) {
  return `--contained-image-aspect-ratio: ${getContainedImageAspectRatio(image)};`;
}

export function makeWhatsappUrl(message, config = SITE_CONFIG) {
  return `https://wa.me/${config.whatsappNumber}?text=${encodeURIComponent(message)}`;
}

export function makeProductWhatsappUrl(product, config = SITE_CONFIG) {
  return makeWhatsappUrl(
    `Hola, quisiera consultar por ${product.name}, referencia ${product.id}. ¿Sigue disponible?`,
    config,
  );
}

export function getProductFacts(product) {
  const facts = [
    ["Referencia", product.id],
    ["Categoría", product.category ?? "Por confirmar"],
    ["Talla", formatSize(product)],
    ["Composición", formatMaterials(product)],
    ["Medidas", formatMeasurements(product)],
    ["Procedencia", product.origin],
    [
      "País de fabricación",
      product.fieldVerification?.manufactureCountry === VERIFICATION.VERIFIED &&
      product.manufactureCountry
        ? product.manufactureCountry
        : "Por confirmar",
    ],
    ["Etiqueta", product.originalTag],
    ["Condición", product.condition],
    ["Disponibilidad", formatAvailability(product), "availability"],
  ];

  if (
    product.fieldVerification?.originalPriceYen === VERIFICATION.VERIFIED &&
    Number.isFinite(product.originalPriceYen)
  ) {
    facts.push([
      "Precio original",
      yenFormatter.format(product.originalPriceYen),
    ]);
  }

  return facts;
}

export function renderHeroSlideMarkup(
  slide,
  slideIndex,
  {
    priority = false,
    sizes = "(max-width: 42rem) 80vw, (max-width: 58rem) 78vw, 54vw",
  } = {},
) {
  const { product, productIndex, image, imageIndex, imageCount } = slide;

  return `
    <a
      class="hero-product-link"
      href="#producto-${escapeHtml(product.slug)}"
      data-open-product="${escapeHtml(product.id)}"
      data-hero-slide="${slideIndex}"
    >
      <figure>
        <span class="hero-image-area">
          <span
            class="contained-image-frame hero-image-frame"
            style="${renderContainedImageFrameStyle(image)}"
          >
            <img
              ${renderImageAttributes(image, {
                sizes,
                loading: priority ? "eager" : "lazy",
                fetchPriority: priority ? "high" : "low",
              })}
            >
            <span class="image-kind-label">Visualización IA</span>
          </span>
        </span>
        <figcaption>
          <span>${formatIndex(productIndex)} · ${escapeHtml(product.name)}</span>
          <span>${escapeHtml(formatPrice(product))}</span>
        </figcaption>
      </figure>
      <span class="visually-hidden">Abrir detalle de ${escapeHtml(product.name)}, visualización ${imageIndex + 1} de ${imageCount}.</span>
    </a>
  `;
}

export function renderProductCardMarkup(
  product,
  originalIndex,
  cardImageIndex = 0,
) {
  const cardImages = getAiImages(product).slice(0, 3);
  const normalizedImageIndex = cardImages.length
    ? cardImageIndex % cardImages.length
    : 0;
  const image = cardImages[normalizedImageIndex] ?? product.images[0];

  return `
    <article
      class="product-entry"
      id="producto-${escapeHtml(product.slug)}"
      data-product-entry="${escapeHtml(product.id)}"
    >
      <div class="product-visual">
        <a
          class="product-open"
          href="#producto-${escapeHtml(product.slug)}"
          data-open-product="${escapeHtml(product.id)}"
          aria-label="Visualización IA de ${escapeHtml(product.name)}, referencia ${escapeHtml(product.id)}. Ver detalle"
        >
          <span
            class="contained-image-frame product-image-frame"
            style="${renderContainedImageFrameStyle(image)}"
            data-product-image-frame
          >
            <img
              ${renderImageAttributes(image, {
                sizes: "(max-width: 42rem) 100vw, (max-width: 58rem) 58vw, 66vw",
                loading: "lazy",
                fetchPriority: "low",
              })}
              draggable="false"
              data-card-image
            >
            <span class="image-kind-label">Visualización IA</span>
          </span>
          <span class="product-open-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14"></path>
            </svg>
          </span>
        </a>
        <button
          class="card-carousel-control card-carousel-previous"
          type="button"
          data-card-previous="${escapeHtml(product.id)}"
          aria-label="Imagen anterior de ${escapeHtml(product.name)}"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <use href="#carousel-arrow-previous"></use>
          </svg>
        </button>
        <button
          class="card-carousel-control card-carousel-next"
          type="button"
          data-card-next="${escapeHtml(product.id)}"
          aria-label="Imagen siguiente de ${escapeHtml(product.name)}"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <use href="#carousel-arrow-next"></use>
          </svg>
        </button>
        <span class="visually-hidden" aria-live="polite" data-card-position>
          Visualización ${normalizedImageIndex + 1} de ${cardImages.length} de ${escapeHtml(product.name)}
        </span>
      </div>
      <div class="product-summary">
        <div>
          <p class="product-number" aria-hidden="true">${formatIndex(originalIndex)}</p>
          <h3>${escapeHtml(product.name)}</h3>
          <p class="product-category">${escapeHtml(product.category ?? "Categoría por confirmar")} · ${escapeHtml(product.id)}</p>
          <p class="product-description">${escapeHtml(product.shortDescription)}</p>
        </div>
        <div>
          <dl class="product-meta">
            <div>
              <dt>Talla</dt>
              <dd>${escapeHtml(formatSize(product))}</dd>
            </div>
            <div>
              <dt>Precio</dt>
              <dd>${escapeHtml(formatPrice(product))}</dd>
            </div>
            <div>
              <dt>Estado</dt>
              <dd>${escapeHtml(product.condition)}</dd>
            </div>
            <div>
              <dt>Stock</dt>
              <dd>${renderAvailability(product)}</dd>
            </div>
          </dl>
          <div class="product-actions">
            <a
              class="button button-secondary product-detail-button"
              href="#producto-${escapeHtml(product.slug)}"
              data-open-product="${escapeHtml(product.id)}"
            >
              Ver galería y detalle
            </a>
            <a
              class="button button-primary product-whatsapp-button"
              href="${escapeHtml(makeProductWhatsappUrl(product))}"
              target="_blank"
              rel="noopener noreferrer"
              data-product-whatsapp="${escapeHtml(product.id)}"
            >
              <span>Consultar esta prenda</span>
              <svg class="cta-arrow" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 12h13M14 7l5 5-5 5"></path>
              </svg>
            </a>
          </div>
        </div>
      </div>
    </article>
  `;
}

export function buildHeroSlides(products) {
  const slides = [];

  products.forEach((product, productIndex) => {
    const aiImages = getAiImages(product);
    aiImages.forEach((image, imageIndex) => {
      slides.push({
        product,
        productIndex,
        image,
        imageIndex,
        imageCount: aiImages.length,
      });
    });
  });

  return slides;
}

export function buildStructuredData(products, config = SITE_CONFIG) {
  const siteUrl = new URL(config.publicSiteUrl).href;
  const organizationId = new URL("#organization", siteUrl).href;
  const websiteId = new URL("#website", siteUrl).href;
  const webpageId = new URL("#webpage", siteUrl).href;
  const catalogueId = new URL("#catalogue", siteUrl).href;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": organizationId,
        name: config.brand,
        url: siteUrl,
        image: config.socialImageUrl,
        sameAs: [config.instagramUrl],
      },
      {
        "@type": "WebSite",
        "@id": websiteId,
        url: siteUrl,
        name: config.brand,
        inLanguage: config.locale,
        publisher: { "@id": organizationId },
      },
      {
        "@type": "CollectionPage",
        "@id": webpageId,
        url: siteUrl,
        name: config.siteTitle,
        description: config.siteDescription,
        inLanguage: config.locale,
        isPartOf: { "@id": websiteId },
        about: { "@id": organizationId },
        primaryImageOfPage: {
          "@type": "ImageObject",
          url: config.socialImageUrl,
          width: config.socialImageWidth,
          height: config.socialImageHeight,
        },
        mainEntity: { "@id": catalogueId },
      },
      {
        "@type": "ItemList",
        "@id": catalogueId,
        name: "Colección actual de SanTokyo",
        numberOfItems: products.length,
        itemListOrder: "https://schema.org/ItemListOrderAscending",
        itemListElement: products.map((product, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: product.name,
          description: product.shortDescription,
          url: new URL(`#producto-${product.slug}`, siteUrl).href,
          image: getRealImages(product).map((image) =>
            new URL(image.src, siteUrl).href,
          ),
        })),
      },
    ],
  };
}

export function renderMetadataMarkup(products, config = SITE_CONFIG) {
  const firstHeroImage = getAiImages(products[0] ?? { images: [] })[0];
  const schema = JSON.stringify(buildStructuredData(products, config), null, 2)
    .replaceAll("<", "\\u003c");
  const imageSrcset = firstHeroImage ? getImageSrcset(firstHeroImage) : "";

  return `
    <title>${escapeHtml(config.siteTitle)}</title>
    <meta name="description" content="${escapeHtml(config.siteDescription)}">
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
    <link rel="canonical" href="${escapeHtml(config.publicSiteUrl)}">
    <meta property="og:type" content="website">
    <meta property="og:locale" content="es_CL">
    <meta property="og:site_name" content="${escapeHtml(config.brand)}">
    <meta property="og:title" content="${escapeHtml(config.siteTitle)}">
    <meta property="og:description" content="${escapeHtml(config.siteDescription)}">
    <meta property="og:url" content="${escapeHtml(config.publicSiteUrl)}">
    <meta property="og:image" content="${escapeHtml(config.socialImageUrl)}">
    <meta property="og:image:secure_url" content="${escapeHtml(config.socialImageUrl)}">
    <meta property="og:image:type" content="${escapeHtml(config.socialImageType)}">
    <meta property="og:image:width" content="${escapeHtml(config.socialImageWidth)}">
    <meta property="og:image:height" content="${escapeHtml(config.socialImageHeight)}">
    <meta property="og:image:alt" content="${escapeHtml(config.socialImageAlt)}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(config.siteTitle)}">
    <meta name="twitter:description" content="${escapeHtml(config.siteDescription)}">
    <meta name="twitter:image" content="${escapeHtml(config.socialImageUrl)}">
    <meta name="twitter:image:alt" content="${escapeHtml(config.socialImageAlt)}">
    ${
      firstHeroImage
        ? `<link
      rel="preload"
      href="${escapeHtml(firstHeroImage.src)}"
      as="image"
      type="image/webp"
      ${imageSrcset ? `imagesrcset="${escapeHtml(imageSrcset)}"` : ""}
      imagesizes="(max-width: 42rem) 80vw, (max-width: 58rem) 78vw, 54vw"
      fetchpriority="high"
    >`
        : ""
    }
    <script type="application/ld+json" data-structured-data>
${schema}
    </script>
  `.trim();
}
