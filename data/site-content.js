import {
  CATALOGUE_FILTER_OPTIONS,
  SITE_CONFIG,
  VERIFICATION,
} from "./products.js?v=9";

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

const catalogueCollator = new Intl.Collator(SITE_CONFIG.locale, {
  numeric: true,
  sensitivity: "base",
  usage: "sort",
});

export const SIZE_ORDER = CATALOGUE_FILTER_OPTIONS.sizes;

export function isDisplayableProductField(status) {
  return status === VERIFICATION.VERIFIED || status === VERIFICATION.DEMO;
}

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
  const canDisplay = isDisplayableProductField(
    product.fieldVerification?.priceClp,
  );

  return Number.isFinite(product.priceClp) && canDisplay
    ? moneyFormatter.format(product.priceClp)
    : "Precio por confirmar";
}

export function formatCurrencyValue(value) {
  return Number.isFinite(value) ? moneyFormatter.format(value) : "—";
}

export function getProductReference(product) {
  return product.reference || product.id || "";
}

export function getProductMaterialNames(product) {
  const materials = Array.isArray(product.materials)
    ? product.materials
    : product.materials
      ? [product.materials]
      : [];

  return materials
    .map((material) =>
      String(material).replace(/\s+\d+(?:[.,]\d+)?%\s*$/u, "").trim(),
    )
    .filter(Boolean);
}

export function getCatalogueFacets(catalogue) {
  const prices = [];

  catalogue.forEach((product) => {
    if (Number.isFinite(product.priceClp)) {
      prices.push(product.priceClp);
    }
  });

  return {
    categories: [...CATALOGUE_FILTER_OPTIONS.categories],
    materials: [...CATALOGUE_FILTER_OPTIONS.materials],
    sizes: [...CATALOGUE_FILTER_OPTIONS.sizes],
    minPrice: prices.length ? Math.min(...prices) : 0,
    maxPrice: prices.length ? Math.max(...prices) : 0,
  };
}

function asFilterSet(value) {
  return value instanceof Set ? value : new Set(value ?? []);
}

export function getVisibleCatalogueProducts(
  catalogue,
  {
    query = "",
    categories = [],
    materials = [],
    sizes = [],
    minPrice = null,
    maxPrice = null,
    sort = "featured",
  } = {},
) {
  const normalizedQuery = query.trim().toLocaleLowerCase(SITE_CONFIG.locale);
  const selectedCategories = asFilterSet(categories);
  const selectedMaterials = asFilterSet(materials);
  const selectedSizes = asFilterSet(sizes);
  const hasPriceFilter = Number.isFinite(minPrice) || Number.isFinite(maxPrice);

  const visible = catalogue.filter((product) => {
    const searchableText = [
      product.name,
      getProductReference(product),
      product.id,
      product.slug,
      product.category,
    ]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase(SITE_CONFIG.locale);

    if (normalizedQuery && !searchableText.includes(normalizedQuery)) {
      return false;
    }
    if (selectedCategories.size && !selectedCategories.has(product.category)) {
      return false;
    }
    if (selectedSizes.size && !selectedSizes.has(String(product.size).toUpperCase())) {
      return false;
    }
    if (selectedMaterials.size) {
      const productMaterials = getProductMaterialNames(product);
      if (!productMaterials.some((material) => selectedMaterials.has(material))) {
        return false;
      }
    }
    if (hasPriceFilter) {
      if (!Number.isFinite(product.priceClp)) {
        return false;
      }
      if (Number.isFinite(minPrice) && product.priceClp < minPrice) {
        return false;
      }
      if (Number.isFinite(maxPrice) && product.priceClp > maxPrice) {
        return false;
      }
    }
    return true;
  });

  return visible
    .map((product, sourceIndex) => ({ product, sourceIndex }))
    .sort((left, right) => {
      const stable = left.sourceIndex - right.sourceIndex;
      if (sort === "name-asc") {
        return (
          catalogueCollator.compare(left.product.name, right.product.name) ||
          catalogueCollator.compare(
            getProductReference(left.product),
            getProductReference(right.product),
          ) ||
          stable
        );
      }
      if (sort === "price-asc" || sort === "price-desc") {
        const leftPrice = left.product.priceClp;
        const rightPrice = right.product.priceClp;
        const leftValid = Number.isFinite(leftPrice);
        const rightValid = Number.isFinite(rightPrice);
        if (leftValid !== rightValid) {
          return leftValid ? -1 : 1;
        }
        if (leftValid && rightValid && leftPrice !== rightPrice) {
          return sort === "price-asc"
            ? leftPrice - rightPrice
            : rightPrice - leftPrice;
        }
        return stable;
      }
      return Number(right.product.featured) - Number(left.product.featured) || stable;
    })
    .map(({ product }) => product);
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
    !isDisplayableProductField(product.fieldVerification?.materials) ||
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
    !isDisplayableProductField(product.fieldVerification?.measurements) ||
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
  return isDisplayableProductField(product.fieldVerification?.size) &&
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

export function getModelImages(product) {
  return getAiImages(product);
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
  const productReference = getProductReference(product);
  const reference = productReference ? ` (${productReference})` : "";
  const productUrl = new URL(
    `#producto-${product.slug}`,
    config.publicSiteUrl,
  ).href;

  return makeWhatsappUrl(
    `Hola, quisiera consultar por ${product.name}${reference} de ${config.whatsappBrandName}: ${productUrl}`,
    config,
  );
}

export function renderHeaderWhatsappMarkup(config = SITE_CONFIG) {
  return `
    <a
      class="header-social-link header-whatsapp"
      href="${escapeHtml(makeWhatsappUrl(config.collectionWhatsappMessage, config))}"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contactar por WhatsApp"
      data-collection-whatsapp
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <use href="#whatsapp-icon"></use>
      </svg>
    </a>
  `;
}

export function getProductFacts(product) {
  const facts = [
    ["Referencia", getProductReference(product)],
    ["Categoría", product.category ?? "Por confirmar"],
    ["Talla", formatSize(product)],
    ["Composición", formatMaterials(product)],
    ["Medidas", formatMeasurements(product)],
    ["Procedencia", product.origin],
    [
      "País de fabricación",
      isDisplayableProductField(
        product.fieldVerification?.manufactureCountry,
      ) &&
      product.manufactureCountry
        ? product.manufactureCountry
        : "Por confirmar",
    ],
    ["Etiqueta", product.originalTag],
    ["Condición", product.condition],
    ["Disponibilidad", formatAvailability(product), "availability"],
  ];

  if (
    isDisplayableProductField(
      product.fieldVerification?.originalPriceYen,
    ) &&
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

export function renderProductCardMarkup(product) {
  const modelImages = getModelImages(product);
  const image = modelImages[0] ?? product.images[0];
  const secondaryImage = modelImages[1];
  const productReference = getProductReference(product);
  const reference = productReference ? `, referencia ${productReference}` : "";
  const labelHidden = image.kind === AI_IMAGE_KIND ? "" : " hidden";

  return `
    <article
      class="product-entry"
      id="producto-${escapeHtml(product.slug)}"
      data-product-entry="${escapeHtml(product.id)}"
    >
      <a
        class="product-visual product-open catalogue-product-visual"
        href="#producto-${escapeHtml(product.slug)}"
        data-open-product="${escapeHtml(product.id)}"
        data-card-primary-kind="${escapeHtml(image.kind)}"
        data-card-active-kind="${escapeHtml(image.kind)}"
        ${secondaryImage ? `data-card-secondary-kind="${escapeHtml(secondaryImage.kind)}"` : ""}
        aria-label="Ver detalle de ${escapeHtml(product.name)}${escapeHtml(reference)}"
      >
        <span
          class="contained-image-frame product-image-frame"
          style="${renderContainedImageFrameStyle(image)}"
          data-product-image-frame
        >
          <img
            ${renderImageAttributes(image, {
              sizes: "(max-width: 58rem) 50vw, 25vw",
              loading: "lazy",
              fetchPriority: "low",
            })}
            draggable="false"
            data-card-image
          >
          <span class="image-kind-label"${labelHidden}>Visualización IA</span>
        </span>
        <span class="catalogue-product-detail-label">Ver detalle</span>
      </a>
      <div class="product-summary">
        <h3>${escapeHtml(product.name)}</h3>
        <p class="product-card-price">${escapeHtml(formatPrice(product))}</p>
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
