import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { products } from "../data/products.js";
import {
  buildHeroSlides,
  renderHeroSlideMarkup,
  renderMetadataMarkup,
  renderProductCardMarkup,
} from "../data/site-content.js";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const indexPath = path.join(repositoryRoot, "index.html");
const checkOnly = process.argv.includes("--check");

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceGeneratedSection(source, name, content) {
  const start = `<!-- generated:${name}:start -->`;
  const end = `<!-- generated:${name}:end -->`;
  const pattern = new RegExp(
    `${escapeRegExp(start)}[\\s\\S]*?${escapeRegExp(end)}`,
  );

  if (!pattern.test(source)) {
    throw new Error(`No se encontraron los marcadores generados para “${name}”.`);
  }

  return source.replace(pattern, `${start}\n${content.trim()}\n    ${end}`);
}

function generateIndex(source) {
  const heroSlides = buildHeroSlides(products);
  const primary = heroSlides[0]
    ? renderHeroSlideMarkup(heroSlides[0], 0, { priority: true })
    : "";
  const preview = heroSlides[1]
    ? renderHeroSlideMarkup(heroSlides[1], 1, {
        sizes: "(max-width: 42rem) 28vw, (max-width: 58rem) 28vw, 16vw",
      })
    : "";
  const catalogue = products
    .map((product, index) => renderProductCardMarkup(product, index))
    .join("");

  return [
    ["metadata", renderMetadataMarkup(products)],
    ["hero-primary", primary],
    ["hero-preview", preview],
    [
      "catalogue-status",
      `${products.length} ${products.length === 1 ? "resultado" : "resultados"} en la colección.`,
    ],
    ["catalogue", catalogue],
  ].reduce(
    (html, [name, content]) => replaceGeneratedSection(html, name, content),
    source,
  ).replace(/[ \t]+$/gm, "");
}

const currentIndex = fs.readFileSync(indexPath, "utf8");
const generatedIndex = generateIndex(currentIndex);

if (checkOnly) {
  if (generatedIndex !== currentIndex) {
    console.error(
      "index.html no coincide con data/products.js. Ejecuta `npm run generate`.",
    );
    process.exitCode = 1;
  } else {
    console.log("Contenido prerenderizado actualizado.");
  }
} else if (generatedIndex !== currentIndex) {
  fs.writeFileSync(indexPath, generatedIndex);
  console.log("index.html actualizado desde el catálogo centralizado.");
} else {
  console.log("index.html ya estaba actualizado.");
}
