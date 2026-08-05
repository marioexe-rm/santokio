import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { products, SITE_CONFIG, VERIFICATION } from "../data/products.js";
import {
  buildHeroSlides,
  buildStructuredData,
  formatAvailability,
  formatPrice,
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
    assert.ok(indexHtml.includes(product.id));
    assert.ok(indexHtml.includes(product.shortDescription));
    assert.ok(indexHtml.includes(product.condition));
    assert.match(
      indexHtml,
      new RegExp(`href="#producto-${product.slug}"`),
    );
  }

  assert.ok(!indexHtml.includes("product-inline-details"));
  assert.ok(!indexHtml.includes("Este catálogo necesita JavaScript"));
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
  assert.match(duplicateErrors, /slug duplicado/i);
  assert.match(duplicateErrors, /carpeta de inventario duplicada/i);
});

test("precio ausente no crea datos comerciales y precio verificado inválido falla", () => {
  assert.equal(formatPrice(products[0]), "Precio por confirmar");
  const schema = JSON.stringify(buildStructuredData(products, SITE_CONFIG));
  assert.ok(!/price|Offer|Product/.test(schema));

  const invalidPrice = structuredClone(products[0]);
  invalidPrice.fieldVerification.priceClp = VERIFICATION.VERIFIED;
  invalidPrice.priceClp = null;
  assert.match(
    validateCatalogue([invalidPrice], SITE_CONFIG, { checkFiles: false }).join(" "),
    /priceClp verificado/i,
  );
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
  const markup = renderProductCardMarkup(special, 0);

  assert.ok(markup.includes("青い"));
  assert.ok(markup.includes("&lt;edición&gt;"));
  assert.ok(markup.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  assert.ok(!markup.includes("<script>alert(1)</script>"));

  const data = buildStructuredData([special], SITE_CONFIG);
  assert.equal(data["@graph"][3].itemListElement[0].name, special.name);
  assert.doesNotThrow(() => JSON.stringify(data));
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
