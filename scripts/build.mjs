import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { products, SITE_CONFIG } from "../data/products.js";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const outputRoot = path.join(repositoryRoot, "dist");
const files = new Set([
  "index.html",
  "styles.css",
  "script.js",
  "robots.txt",
  "sitemap.xml",
  "CNAME",
  "data/products.js",
  "data/site-content.js",
  "assets/favicon.svg",
  "assets/fonts/funnel-sans-latin.woff2",
  "assets/fonts/Funnel-Sans-OFL.txt",
]);

for (const product of products) {
  for (const image of product.images) {
    files.add(image.src);
    for (const candidate of image.srcset ?? []) {
      files.add(candidate.src);
    }
  }
}

const socialImageUrl = new URL(SITE_CONFIG.socialImageUrl);
if (socialImageUrl.origin !== new URL(SITE_CONFIG.publicSiteUrl).origin) {
  throw new Error("La imagen social debe pertenecer al dominio canónico.");
}
files.add(decodeURIComponent(socialImageUrl.pathname.slice(1)));

fs.rmSync(outputRoot, { recursive: true, force: true });

let totalBytes = 0;
for (const relativePath of [...files].sort()) {
  const source = path.join(repositoryRoot, relativePath);
  const destination = path.join(outputRoot, relativePath);
  if (!fs.existsSync(source)) {
    throw new Error(`No existe el archivo de producción ${relativePath}.`);
  }

  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
  totalBytes += fs.statSync(source).size;
}

const megabytes = (totalBytes / 1024 / 1024).toFixed(2);
console.log(
  `Build estático listo en dist/: ${files.size} archivos, ${megabytes} MB.`,
);
