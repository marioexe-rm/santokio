import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  CATALOGUE_FILTER_OPTIONS,
  products,
  SITE_CONFIG,
  VERIFICATION,
} from "../data/products.js";
import {
  buildHeroSlides,
  buildStructuredData,
  formatAvailability,
  formatPrice,
  formatSize,
  getCatalogueFacets,
  getModelImages,
  getProductMaterialNames,
  getVisibleCatalogueProducts,
  makeProductWhatsappUrl,
  makeWhatsappUrl,
  renderMetadataMarkup,
  renderProductCardMarkup,
} from "../data/site-content.js";
import { validateCatalogue } from "../scripts/lib/catalogue-validation.mjs";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const read = (relativePath) =>
  fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8");
const indexHtml = read("index.html");
const styles = read("styles.css");
const expectedFilterOptions = {
  categories: [
    "Poleras", "Vestidos", "Enteritos", "Jeans", "Pantalones", "Shorts",
    "Faldas", "Polerones", "Suéter", "Chalecos", "Abrigos", "Chaquetas",
    "Parkas", "Camisas", "Polos", "Blusas", "Beatles", "Cárdigans",
    "Blazers", "Montgomerys", "Carteras", "Billeteras", "Cinturones",
    "Jockey", "Bufandas", "Pañuelos", "Echarpes", "Pulseras", "Aros",
    "Anteojos", "Calcetines", "Zapatillas", "Zapatos", "Botas", "Botines",
    "Sandalias", "Bolsos", "Trajes de Baño", "Pijamas", "Sombreros",
    "Maletines", "Llaveros", "Viseras",
  ],
  materials: [
    "Algodón", "Lana", "Seda", "Merino", "Lino", "Cuero", "Piel",
    "Mezclilla", "Acrílico", "Alpaca", "Angora", "Elastano", "Bambú",
    "Brocado", "Cáñamo", "Cachemira", "Ecocuero", "Lyocell", "Modal",
    "Mohair", "Nailon", "Polar", "Poliamida", "Poliéster", "Poliuretano",
    "Raso", "Rayón", "Terciopelo", "Thinsulate", "Vicuña", "Viscosa",
  ],
  sizes: [
    "XS", "S", "M", "L", "XL", "XXL", "26", "27", "28", "29", "30",
    "31", "32", "33", "34", "35", "36", "37", "38", "39", "40", "41",
    "42", "43", "44", "45", "46", "47", "48",
  ],
};

function tags(html, tagName) {
  return html.match(new RegExp(`<${tagName}\\b[^>]*>`, "gi")) ?? [];
}

function attribute(tag, name) {
  return tag.match(new RegExp(`\\s${name}=["']([^"']*)["']`, "i"))?.[1] ?? null;
}

function localPathFromUrl(value) {
  return decodeURIComponent(value.split(/[?#]/, 1)[0]);
}

test("el HTML inicial contiene metadatos canónicos únicos y coherentes", () => {
  assert.equal(tags(indexHtml, "title").length, 1);
  assert.equal(tags(indexHtml, "h1").length, 1);
  assert.match(indexHtml, /<html lang="es-CL">/);

  const title = indexHtml.match(/<title>([^<]+)<\/title>/)?.[1];
  assert.equal(title, SITE_CONFIG.siteTitle);
  assert.ok(title.length >= 25 && title.length <= 60);

  const descriptionTags = tags(indexHtml, "meta").filter(
    (tag) => attribute(tag, "name") === "description",
  );
  assert.equal(descriptionTags.length, 1);
  assert.equal(attribute(descriptionTags[0], "content"), SITE_CONFIG.siteDescription);
  assert.ok(SITE_CONFIG.siteDescription.length >= 110 && SITE_CONFIG.siteDescription.length <= 165);

  const canonicalTags = tags(indexHtml, "link").filter(
    (tag) => attribute(tag, "rel") === "canonical",
  );
  assert.equal(canonicalTags.length, 1);
  assert.equal(attribute(canonicalTags[0], "href"), SITE_CONFIG.publicSiteUrl);

  const robotsTag = tags(indexHtml, "meta").find(
    (tag) => attribute(tag, "name") === "robots",
  );
  const robotsDirectives = new Set(
    attribute(robotsTag, "content")
      .split(",")
      .map((directive) => directive.trim().split(":", 1)[0]),
  );
  assert.ok(robotsDirectives.has("index"));
  assert.ok(robotsDirectives.has("follow"));
  assert.ok(!robotsDirectives.has("noindex"));
  assert.ok(!robotsDirectives.has("nofollow"));
});

test("Open Graph y Twitter usan la misma URL, descripción e imagen social real", () => {
  const metas = tags(indexHtml, "meta");
  const contentFor = (attributeName, value) =>
    attribute(
      metas.find((tag) => attribute(tag, attributeName) === value),
      "content",
    );

  assert.equal(contentFor("property", "og:url"), SITE_CONFIG.publicSiteUrl);
  assert.equal(contentFor("property", "og:title"), SITE_CONFIG.siteTitle);
  assert.equal(
    contentFor("property", "og:description"),
    SITE_CONFIG.siteDescription,
  );
  assert.equal(contentFor("property", "og:image"), SITE_CONFIG.socialImageUrl);
  assert.equal(
    contentFor("property", "og:image:width"),
    String(SITE_CONFIG.socialImageWidth),
  );
  assert.equal(contentFor("name", "twitter:card"), "summary_large_image");
  assert.equal(contentFor("name", "twitter:image"), SITE_CONFIG.socialImageUrl);

  const socialPath = new URL(SITE_CONFIG.socialImageUrl).pathname.slice(1);
  assert.ok(fs.existsSync(path.join(repositoryRoot, socialPath)));
});

test("JSON-LD representa la página y su lista sin simular fichas Product", () => {
  const jsonText = indexHtml.match(
    /<script type="application\/ld\+json" data-structured-data>([\s\S]*?)<\/script>/,
  )?.[1];
  assert.ok(jsonText);
  const data = JSON.parse(jsonText);
  const types = data["@graph"].map((node) => node["@type"]);

  assert.deepEqual(types, ["Organization", "WebSite", "CollectionPage", "ItemList"]);
  assert.ok(!jsonText.includes('"@type": "Product"'));
  assert.ok(!jsonText.includes('"@type": "Offer"'));
  assert.ok(!/AggregateRating|Review|gtin|mpn|brand/i.test(jsonText));

  const itemList = data["@graph"].find((node) => node["@type"] === "ItemList");
  assert.equal(itemList.numberOfItems, products.length);
  assert.equal(itemList.itemListElement.length, products.length);
  itemList.itemListElement.forEach((item, index) => {
    assert.equal(item.position, index + 1);
    assert.equal(item.name, products[index].name);
    assert.equal(
      item.url,
      `${SITE_CONFIG.publicSiteUrl}#producto-${products[index].slug}`,
    );
    assert.ok(item.image.length >= 1);
    item.image.forEach((url) => assert.match(url, /^https:\/\/santokyo\.com\//));
  });
});

test("el catálogo y sus datos esenciales existen antes de ejecutar JavaScript", () => {
  assert.equal(tags(indexHtml, "article").filter((tag) => tag.includes("product-entry")).length, products.length);

  for (const product of products) {
    assert.match(indexHtml, new RegExp(`id="producto-${product.slug}"`));
    assert.ok(indexHtml.includes(product.name));
    assert.ok(indexHtml.includes(formatPrice(product)));
    assert.match(
      indexHtml,
      new RegExp(`href="#producto-${product.slug}"`),
    );
  }

  assert.ok(!indexHtml.includes("product-inline-details"));
  assert.ok(!indexHtml.includes("Este catálogo necesita JavaScript"));
});

test("navbar y WhatsApp comparten configuración sin duplicar el buscador", () => {
  const header = indexHtml.match(/<header class="site-header"[\s\S]*?<\/header>/)?.[0];
  assert.ok(header);
  assert.ok(header.indexOf('class="wordmark"') < header.indexOf('class="header-search"'));
  assert.ok(header.indexOf('class="header-search"') < header.indexOf('class="site-navigation"'));
  assert.doesNotMatch(header, />\s*Ver colección\s*</i);
  assert.equal((header.match(/data-collection-whatsapp/g) ?? []).length, 1);
  assert.equal((indexHtml.match(/id="catalogue-search"/g) ?? []).length, 1);

  const whatsappHref = attribute(
    tags(header, "a").find((tag) => tag.includes("data-collection-whatsapp")),
    "href",
  );
  assert.equal(
    whatsappHref,
    makeWhatsappUrl(SITE_CONFIG.collectionWhatsappMessage),
  );
  const whatsappUrl = new URL(whatsappHref);
  assert.equal(whatsappUrl.hostname, "wa.me");
  assert.equal(whatsappUrl.pathname, `/${SITE_CONFIG.whatsappNumber}`);
  assert.equal(
    whatsappUrl.searchParams.get("text"),
    "Hola, quisiera consultar por la colección de Santokyo.",
  );
});

test("cada tarjeta mínima tiene un solo enlace, imagen, nombre y precio", () => {
  for (const product of products) {
    const markup = renderProductCardMarkup(product);
    const modelImages = getModelImages(product);

    assert.equal(tags(markup, "a").length, 1);
    assert.equal(tags(markup, "button").length, 0);
    assert.equal(tags(markup, "img").length, 1);
    assert.equal(tags(markup, "h3").length, 1);
    assert.match(markup, /catalogue-product-detail-label">Ver detalle</);
    assert.match(markup, new RegExp(`href="#producto-${product.slug}"`));
    assert.ok(markup.includes(formatPrice(product)));
    assert.ok(markup.includes(modelImages[0]?.src ?? product.images[0].src));
    assert.ok(!/product-meta|product-actions|product-inline-details|product-open-icon/.test(markup));
    assert.ok(!/<a\b[^>]*>[\s\S]*<(?:a|button)\b/i.test(markup));
  }
});

test("todos los enlaces y recursos locales del HTML resuelven", () => {
  const ids = new Set(
    [...indexHtml.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]),
  );
  const anchors = tags(indexHtml, "a");

  for (const anchor of anchors) {
    const href = attribute(anchor, "href");
    if (!href) continue;
    assert.notEqual(href, "#");

    if (href.startsWith("#")) {
      assert.ok(ids.has(decodeURIComponent(href.slice(1))), `Fragmento roto: ${href}`);
    } else if (/^https:\/\//.test(href)) {
      assert.doesNotThrow(() => new URL(href));
    } else {
      assert.ok(
        fs.existsSync(path.join(repositoryRoot, localPathFromUrl(href))),
        `Recurso enlazado inexistente: ${href}`,
      );
    }
  }

  const resourceTags = [
    ...tags(indexHtml, "img"),
    ...tags(indexHtml, "script"),
    ...tags(indexHtml, "link"),
  ];
  for (const tag of resourceTags) {
    const value = attribute(tag, "src") ?? attribute(tag, "href");
    if (!value || value.startsWith("#") || /^https:\/\//.test(value)) continue;
    assert.ok(
      fs.existsSync(path.join(repositoryRoot, localPathFromUrl(value))),
      `Recurso local inexistente: ${value}`,
    );
  }

  for (const tag of tags(indexHtml, "img")) {
    assert.notEqual(attribute(tag, "alt"), null);
    assert.match(attribute(tag, "width"), /^\d+$/);
    assert.match(attribute(tag, "height"), /^\d+$/);
    assert.match(attribute(tag, "src"), /\.webp$/);
    const srcset = attribute(tag, "srcset");
    if (!srcset) continue;
    for (const candidate of srcset.split(",")) {
      const candidatePath = candidate.trim().split(/\s+/, 1)[0];
      assert.ok(fs.existsSync(path.join(repositoryRoot, candidatePath)));
    }
  }
});

test("robots.txt, sitemap y CNAME apuntan solo al dominio canónico", () => {
  const robots = read("robots.txt");
  const sitemap = read("sitemap.xml");
  assert.match(robots, /User-agent:\s*\*/i);
  assert.match(robots, /Allow:\s*\//i);
  assert.match(robots, /Sitemap:\s*https:\/\/santokyo\.com\/sitemap\.xml/i);
  assert.doesNotMatch(robots, /Disallow:\s*\//i);
  assert.equal((sitemap.match(/<loc>/g) ?? []).length, 1);
  assert.match(sitemap, /<loc>https:\/\/santokyo\.com\/<\/loc>/);
  assert.equal(read("CNAME").trim(), "santokyo.com");
});

test("el validador acepta el catálogo real y rechaza catálogo vacío o duplicado", () => {
  assert.deepEqual(
    validateCatalogue(products, SITE_CONFIG, { repositoryRoot }),
    [],
  );
  assert.match(
    validateCatalogue([], SITE_CONFIG, { checkFiles: false }).join(" "),
    /al menos un producto/i,
  );

  const duplicate = structuredClone(products[0]);
  const duplicateErrors = validateCatalogue(
    [products[0], duplicate],
    SITE_CONFIG,
    { checkFiles: false },
  ).join(" ");
  assert.match(duplicateErrors, /identificador duplicado/i);
  assert.match(duplicateErrors, /referencia duplicada/i);
  assert.match(duplicateErrors, /slug duplicado/i);
  assert.match(duplicateErrors, /carpeta de inventario duplicada/i);
});

test("los datos demo se publican desde la fuente y un precio demo inválido falla", () => {
  for (const product of products) {
    assert.equal(product.fieldVerification.priceClp, VERIFICATION.DEMO);
    assert.equal(product.fieldVerification.size, VERIFICATION.DEMO);
    assert.match(formatPrice(product), /^\$[\d.]+$/);
    assert.doesNotMatch(formatPrice(product), /por confirmar/i);
    assert.doesNotMatch(formatSize(product), /por confirmar/i);
  }
  assert.ok(new Set(products.map((product) => product.priceClp)).size > 1);
  assert.ok(new Set(products.map((product) => product.size)).size > 1);

  const schema = JSON.stringify(buildStructuredData(products, SITE_CONFIG));
  assert.ok(!/price|Offer|Product/.test(schema));

  const invalidPrice = structuredClone(products[0]);
  invalidPrice.fieldVerification.priceClp = VERIFICATION.DEMO;
  invalidPrice.priceClp = null;
  assert.match(
    validateCatalogue([invalidPrice], SITE_CONFIG, { checkFiles: false }).join(" "),
    /priceClp publicado/i,
  );
});

test("las tarjetas toleran una sola imagen de modelo y clasifican el label por datos", () => {
  const singleModel = structuredClone(products[0]);
  singleModel.images = [
    getModelImages(singleModel)[0],
    singleModel.images.find((image) => image.kind === "real-product-photo"),
  ];
  const markup = renderProductCardMarkup(singleModel);

  assert.equal(getModelImages(singleModel).length, 1);
  assert.doesNotMatch(markup, /data-card-secondary-kind/);
  assert.match(markup, /data-card-primary-kind="ai-model-visualization"/);
  assert.match(markup, /<span class="image-kind-label">Visualización IA<\/span>/);
});

test("la consulta de producto usa nombre, referencia, URL canónica y número central", () => {
  const product = products[0];
  const url = new URL(makeProductWhatsappUrl(product));
  assert.equal(url.hostname, "wa.me");
  assert.equal(url.pathname, `/${SITE_CONFIG.whatsappNumber}`);
  assert.equal(
    url.searchParams.get("text"),
    `Hola, quisiera consultar por ${product.name} (${product.reference}) de ${SITE_CONFIG.whatsappBrandName}: ${SITE_CONFIG.publicSiteUrl}#producto-${product.slug}`,
  );

  const withoutReference = { ...product, id: "", reference: "" };
  const message = new URL(makeProductWhatsappUrl(withoutReference)).searchParams.get("text");
  assert.ok(message.includes(`por ${product.name} de`));
  assert.ok(!message.includes("()"));
});

test("el catálogo demo contiene 30 objetos independientes con claves únicas", () => {
  assert.equal(products.length, 30);
  assert.equal(new Set(products.map((product) => product.id)).size, 30);
  assert.equal(new Set(products.map((product) => product.reference)).size, 30);
  assert.equal(new Set(products.map((product) => product.slug)).size, 30);
  assert.deepEqual(
    products.slice(0, 3).map((product) => product.name),
    ["Falda Verde", "Falda Amarilla", "Falda Beige"],
  );
  assert.deepEqual(
    products.map((product) => product.reference),
    Array.from({ length: 30 }, (_, index) =>
      `STK-${String(index + 1).padStart(3, "0")}`,
    ),
  );

  const baseById = new Map(products.slice(0, 3).map((product) => [product.id, product]));
  products.slice(3).forEach((product) => {
    const source = baseById.get(product.demoSourceProductId);
    assert.ok(source);
    assert.equal(product.folder, source.folder);
    assert.notEqual(product.images, source.images);
    assert.notEqual(product.materials, source.materials);
    assert.notEqual(product.measurements, source.measurements);
    product.images.forEach((image, index) => {
      assert.notEqual(image, source.images[index]);
      assert.notEqual(image.srcset, source.images[index].srcset);
    });
  });
});

test("facetas, búsqueda, filtros y ordenamiento comparten valores normalizados", () => {
  const facets = getCatalogueFacets(products);
  assert.deepEqual(CATALOGUE_FILTER_OPTIONS, expectedFilterOptions);
  assert.deepEqual(facets.categories, CATALOGUE_FILTER_OPTIONS.categories);
  assert.deepEqual(facets.materials, CATALOGUE_FILTER_OPTIONS.materials);
  assert.deepEqual(facets.sizes, CATALOGUE_FILTER_OPTIONS.sizes);
  products.forEach((product) => {
    assert.ok(CATALOGUE_FILTER_OPTIONS.categories.includes(product.category));
    assert.ok(CATALOGUE_FILTER_OPTIONS.sizes.includes(String(product.size)));
    const materials = getProductMaterialNames(product);
    assert.equal(new Set(materials).size, materials.length);
    materials.forEach((material) =>
      assert.ok(CATALOGUE_FILTER_OPTIONS.materials.includes(material)),
    );
  });
  assert.equal(facets.minPrice, Math.min(...products.map(({ priceClp }) => priceClp)));
  assert.equal(facets.maxPrice, Math.max(...products.map(({ priceClp }) => priceClp)));
  assert.ok(
    products.every((product) =>
      getProductMaterialNames(product).every((material) => !/%/.test(material)),
    ),
  );

  const originalProductsByName = getVisibleCatalogueProducts(products.slice(0, 3), {
    sort: "name-asc",
  });
  assert.deepEqual(
    originalProductsByName.map((product) => product.name),
    ["Falda Amarilla", "Falda Beige", "Falda Verde"],
  );

  const ascending = getVisibleCatalogueProducts(products, { sort: "price-asc" });
  const descending = getVisibleCatalogueProducts(products, { sort: "price-desc" });
  assert.ok(
    ascending.every((product, index) =>
      index === 0 || ascending[index - 1].priceClp <= product.priceClp,
    ),
  );
  assert.ok(
    descending.every((product, index) =>
      index === 0 || descending[index - 1].priceClp >= product.priceClp,
    ),
  );
  const missingPrice = { ...products[0], id: "STK-SIN-PRECIO", priceClp: null };
  assert.equal(
    getVisibleCatalogueProducts([...products.slice(0, 2), missingPrice], {
      sort: "price-asc",
    }).at(-1),
    missingPrice,
  );
  assert.equal(
    getVisibleCatalogueProducts([...products.slice(0, 2), missingPrice], {
      sort: "price-desc",
    }).at(-1),
    missingPrice,
  );

  const filtered = getVisibleCatalogueProducts(products, {
    query: "Falda",
    categories: ["Faldas"],
    materials: ["Algodón", "Seda"],
    sizes: ["S"],
    minPrice: 70000,
    maxPrice: 100000,
    sort: "price-asc",
  });
  assert.ok(filtered.length > 0);
  filtered.forEach((product) => {
    assert.equal(product.category, "Faldas");
    assert.equal(product.size, "S");
    assert.ok(product.priceClp >= 70000 && product.priceClp <= 100000);
    assert.ok(
      getProductMaterialNames(product).some((material) =>
        ["Algodón", "Seda"].includes(material),
      ),
    );
  });
});

test("HTML y CSS conservan estructura semántica, acordeones y layout responsive", () => {
  const removedPhrases = [
    "Abre una pieza para recorrer todas sus imágenes y revisar qué datos están confirmados antes de consultar.",
    "Respuestas prudentes para decidir qué conviene confirmar por WhatsApp.",
    "Una colección breve para observar cada pieza con calma.",
    "La conversación permite confirmar la información que todavía no puede resolverse desde una ficha estática.",
    "La presentación distingue evidencia documental, visualización referencial y datos todavía pendientes.",
  ];
  removedPhrases.forEach((phrase) => assert.ok(!indexHtml.includes(phrase)));
  assert.match(indexHtml, /data-filter-toggle/);
  assert.match(indexHtml, /data-filter-dialog/);
  assert.match(indexHtml, /data-filter-apply[^>]*>[\s\S]*?Aplicar filtros/);
  assert.equal((indexHtml.match(/data-filter-group-toggle=/g) ?? []).length, 3);
  assert.equal((indexHtml.match(/data-filter-group-count=/g) ?? []).length, 4);
  assert.match(indexHtml, /class="clear-button"[^>]*hidden[^>]*disabled/);
  assert.match(indexHtml, /class="filter-dialog__reset"[^>]*hidden[^>]*disabled/);
  assert.match(
    indexHtml,
    /class="filter-dialog__scroll-region"[^>]*data-filter-scroll-region[\s\S]*?class="filter-dialog__actions"/,
  );
  assert.match(indexHtml, /class="button button-primary"[^>]*data-empty-clear/);
  assert.match(indexHtml, /Precio: menor a mayor/);
  assert.match(indexHtml, /Precio: mayor a menor/);
  assert.match(indexHtml, /<option value="name-asc">Nombre<\/option>/);
  assert.match(
    indexHtml,
    /class="dialog-close"[^>]*data-dialog-close/s,
  );

  const mobileStyles = styles.slice(styles.indexOf("@media (max-width: 58rem)"));
  const mobileNavigation = mobileStyles.match(/\.site-navigation\s*\{([^}]*)\}/)?.[1];
  assert.ok(mobileNavigation);
  assert.doesNotMatch(mobileNavigation, /\bleft\s*:\s*0\b/);
  assert.match(mobileNavigation, /width\s*:\s*100%/);
  assert.match(styles, /\.catalogue\s*\{[^}]*background:\s*var\(--chalk-bright\)/s);
  assert.match(styles, /\.faq\s*\{[^}]*background:\s*var\(--chalk-bright\)/s);
  const siteHeader = styles.match(/\.site-header\s*\{([^}]*)\}/)?.[1];
  const scrolledHeader = styles.match(/\.site-header\.is-scrolled\s*\{([^}]*)\}/)?.[1];
  assert.ok(siteHeader && scrolledHeader);
  assert.match(siteHeader, /background:\s*var\(--chalk-bright\)/);
  assert.doesNotMatch(scrolledHeader, /background\s*:/);
  assert.match(styles, /\.catalogue-tools\s*\{[^}]*display:\s*flex/s);
  assert.match(
    styles,
    /\.sort-field\s*\{[^}]*max-width:\s*20rem;[^}]*flex:\s*0 1 20rem;/s,
  );
  assert.match(
    indexHtml,
    /class="catalogue-tools"[\s\S]*?class="sort-field"[\s\S]*?class="catalogue-status"/,
  );
  assert.match(
    styles,
    /\.catalogue\s*\{[^}]*padding-top:\s*128px;[^}]*padding-bottom:\s*128px;/s,
  );
  assert.match(
    styles,
    /\.editorial-intro\s*\{[^}]*padding-top:\s*128px;[^}]*padding-bottom:\s*128px;/s,
  );
  assert.match(styles, /--anchor-title-gap:\s*1rem/);
  assert.match(styles, /scroll-margin-top:\s*calc\(var\(--header-height\)/);

  const filterGroupFirst = styles.match(/\.filter-group:first-of-type\s*\{([^}]*)\}/)?.[1];
  const filterFieldsets = styles.match(
    /\.filter-dialog__scroll-region fieldset\s*\{([^}]*)\}/,
  )?.[1];
  const filterScrollRegion = styles.match(
    /\.filter-dialog__scroll-region\s*\{([^}]*)\}/,
  )?.[1];
  const filterActions = styles.match(/\.filter-dialog__actions\s*\{([^}]*)\}/)?.[1];
  const filterCount = styles.match(/\.filter-group-count\s*\{([^}]*)\}/)?.[1];
  assert.ok(
    filterGroupFirst && filterFieldsets && filterScrollRegion &&
      filterActions && filterCount,
  );
  assert.doesNotMatch(filterGroupFirst, /border-top/);
  assert.match(filterFieldsets, /border-bottom:\s*var\(--rule\)/);
  assert.doesNotMatch(filterActions, /border-top/);
  assert.match(
    filterActions,
    /grid-template-rows:\s*repeat\(2, var\(--filter-dialog-action-height\)\)/,
  );
  assert.match(filterScrollRegion, /overflow-y:\s*auto/);
  assert.match(filterScrollRegion, /overscroll-behavior:\s*contain/);
  assert.match(filterCount, /display:\s*inline-flex/);
  assert.match(filterCount, /align-items:\s*center/);
  assert.match(filterCount, /justify-content:\s*center/);
  const filterGroupButtons = indexHtml.match(
    /<button[^>]*class="filter-group__toggle"[\s\S]*?<\/button>/g,
  ) ?? [];
  assert.equal(filterGroupButtons.length, 3);
  filterGroupButtons.forEach((button) => {
    assert.match(button, /aria-expanded="false"/);
    assert.match(button, /data-filter-group-toggle=/);
  });
  assert.match(
    indexHtml,
    /class="filter-group__heading">\s*<span class="filter-group-count"[^>]*>[\s\S]*?<\/span>\s*<span>Categoría<\/span>/,
  );
  const priceGroup = indexHtml.match(
    /<fieldset class="filter-group price-filter"[\s\S]*?<\/fieldset>/,
  )?.[0];
  assert.ok(priceGroup);
  assert.match(priceGroup, /class="price-filter__heading"/);
  assert.match(priceGroup, /class="price-filter__content"/);
  assert.match(priceGroup, /data-filter-group-count="price"/);
  assert.doesNotMatch(priceGroup, /data-filter-group-toggle|aria-expanded/);
  assert.match(
    styles,
    /\.filter-group\.has-active-filters \.filter-group-count\s*\{[^}]*background:\s*var\(--indigo\)/s,
  );
  const animatedPanel = styles.match(/\.filter-group__panel\s*\{([^}]*)\}/)?.[1];
  const filterOptions = styles.match(/\.filter-options\s*\{([^}]*)\}/)?.[1];
  assert.ok(animatedPanel && filterOptions);
  assert.doesNotMatch(animatedPanel, /padding/);
  assert.doesNotMatch(animatedPanel, /overflow/);
  assert.match(filterOptions, /padding-bottom:\s*var\(--space-4\)/);
  assert.match(
    mobileStyles,
    /\.catalogue-tools\s*\{[^}]*padding-bottom:\s*var\(--space-4\)/s,
  );
  const activeGalleryControl = styles.match(
    /\.card-carousel-control:active\s*\{([^}]*)\}/,
  )?.[1];
  assert.ok(activeGalleryControl);
  assert.match(activeGalleryControl, /background:\s*var\(--chartreuse\)/);
  assert.doesNotMatch(activeGalleryControl, /transform\s*:/);
  assert.match(
    mobileStyles,
    /\.dialog-gallery-control\s*\{[^}]*transform:\s*none/s,
  );

  const concept = indexHtml.match(
    /<section class="editorial-intro" id="concepto"[\s\S]*?<\/section>/,
  )?.[0];
  assert.ok(concept);
  assert.match(concept, /class="concept-evidence"/);
  assert.match(concept, /class="evidence-list"/);
  assert.doesNotMatch(indexHtml, /<section class="evidence"/);

  const faqDetails = indexHtml.match(/<details name="faq-accordion">/g) ?? [];
  assert.equal(faqDetails.length, 14);
  assert.match(styles, /\.faq summary\s*\{[^}]*--faq-question-weight:\s*400/s);
  assert.match(styles, /\.faq details:hover > summary\s*\{[^}]*--faq-question-weight:\s*540/s);
  assert.match(styles, /--faq-symbol-size:\s*3rem/);
});

test("imagen faltante y URL malformada producen errores explícitos", () => {
  const missingImage = structuredClone(products[0]);
  missingImage.images[0].src = "assets/catalogo/no-existe.webp";
  missingImage.images[0].srcset[1].src = "assets/catalogo/no-existe.webp";
  assert.match(
    validateCatalogue([missingImage], SITE_CONFIG, { repositoryRoot }).join(" "),
    /no existe assets\/catalogo\/no-existe\.webp/i,
  );

  const malformed = structuredClone(products[0]);
  malformed.images[0].src = "https://ejemplo.test/imagen.webp";
  malformed.images[0].srcset[1].src = malformed.images[0].src;
  assert.match(
    validateCatalogue([malformed], SITE_CONFIG, { checkFiles: false }).join(" "),
    /ruta relativa segura/i,
  );
});

test("caracteres japoneses, acentos, comillas y símbolos se serializan sin inyección", () => {
  const special = structuredClone(products[0]);
  special.id = "STK-青-01";
  special.slug = "falda-aoi-01";
  special.name = 'Falda “青い” <edición> $ especial';
  special.shortDescription =
    'Edición "azul" — diseño 日本語 <script>alert(1)</script> por confirmar.';
  special.longDescription = "Descripción con áéíóú, ¥ y <script>alert(1)</script>.";
  const markup = renderProductCardMarkup(special);

  assert.ok(markup.includes("青い"));
  assert.ok(markup.includes("&lt;edición&gt;"));
  assert.ok(!markup.includes("<script>alert(1)</script>"));

  const data = buildStructuredData([special], SITE_CONFIG);
  assert.equal(data["@graph"][3].itemListElement[0].name, special.name);
  assert.doesNotThrow(() => JSON.stringify(data));
  const metadata = renderMetadataMarkup([special], SITE_CONFIG);
  assert.ok(metadata.includes("\\u003cscript>alert(1)\\u003c/script>"));
  assert.ok(!metadata.includes("<script>alert(1)</script>"));
});

test("campos vacíos, disponibilidad desconocida y dominio inválido no se silencian", () => {
  const invalid = structuredClone(products[0]);
  invalid.name = "";
  invalid.availability = null;
  const errors = validateCatalogue([invalid], SITE_CONFIG, {
    checkFiles: false,
  }).join(" ");
  assert.match(errors, /name no puede estar vacío/i);
  assert.match(errors, /availability como entero positivo/i);
  assert.equal(formatAvailability(invalid), "Disponibilidad por confirmar");

  const invalidConfig = { ...SITE_CONFIG, publicSiteUrl: "not a url" };
  assert.match(
    validateCatalogue([products[0]], invalidConfig, { checkFiles: false }).join(" "),
    /URL absoluta válida/i,
  );
  assert.throws(() => buildStructuredData(products, invalidConfig));
});

test("los generadores toleran catálogo vacío sin inventar productos", () => {
  assert.deepEqual(buildHeroSlides([]), []);
  const schema = buildStructuredData([], SITE_CONFIG);
  assert.equal(schema["@graph"][3].numberOfItems, 0);
  assert.deepEqual(schema["@graph"][3].itemListElement, []);
  const metadata = renderMetadataMarkup([], SITE_CONFIG);
  assert.ok(metadata.includes(SITE_CONFIG.siteTitle));
  assert.ok(!metadata.includes('rel="preload"'));
});
