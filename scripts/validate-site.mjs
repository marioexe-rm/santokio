import path from "node:path";
import { fileURLToPath } from "node:url";
import { products, SITE_CONFIG } from "../data/products.js";
import { validateCatalogue } from "./lib/catalogue-validation.mjs";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const errors = validateCatalogue(products, SITE_CONFIG, { repositoryRoot });

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(`${products.length} productos y sus activos pasaron la validación.`);
}
