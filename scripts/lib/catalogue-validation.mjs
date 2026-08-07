import fs from "node:fs";
import path from "node:path";
import {
  CATALOGUE_FILTER_OPTIONS,
  VERIFICATION,
} from "../../data/products.js";
import {
  AI_IMAGE_KIND,
  REAL_IMAGE_KIND,
  getProductMaterialNames,
} from "../../data/site-content.js";

const verificationStates = new Set(Object.values(VERIFICATION));
const displayableVerificationStates = new Set([
  VERIFICATION.VERIFIED,
  VERIFICATION.DEMO,
]);
const imageKinds = new Set([AI_IMAGE_KIND, REAL_IMAGE_KIND]);
const allowedCategories = new Set(CATALOGUE_FILTER_OPTIONS.categories);
const allowedMaterials = new Set(CATALOGUE_FILTER_OPTIONS.materials);
const allowedSizes = new Set(CATALOGUE_FILTER_OPTIONS.sizes);
const requiredTextFields = [
  "id",
  "reference",
  "slug",
  "name",
  "shortDescription",
  "longDescription",
  "category",
  "origin",
  "condition",
];

function isNonEmptyText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isSafeRelativeAssetPath(value) {
  if (!isNonEmptyText(value) || value.startsWith("/")) {
    return false;
  }

  if (/^[a-z][a-z\d+.-]*:/i.test(value) || value.includes("\\")) {
    return false;
  }

  return !value.split("/").includes("..");
}

function validateConfig(config, errors) {
  let siteUrl;
  try {
    siteUrl = new URL(config.publicSiteUrl);
  } catch {
    errors.push("SITE_CONFIG.publicSiteUrl debe ser una URL absoluta válida.");
  }

  if (
    siteUrl &&
    (siteUrl.href !== "https://santokyo.com/" || siteUrl.hostname.startsWith("www."))
  ) {
    errors.push(
      "SITE_CONFIG.publicSiteUrl debe ser exactamente https://santokyo.com/.",
    );
  }

  if (config.locale !== "es-CL") {
    errors.push("SITE_CONFIG.locale debe ser es-CL.");
  }

  if (config.currency !== "CLP") {
    errors.push("SITE_CONFIG.currency debe ser CLP.");
  }

  if (!/^\d{8,15}$/.test(config.whatsappNumber ?? "")) {
    errors.push("SITE_CONFIG.whatsappNumber debe contener solo 8 a 15 dígitos.");
  }

  for (const field of [
    "brand",
    "siteTitle",
    "siteDescription",
    "whatsappBrandName",
    "collectionWhatsappMessage",
    "generalWhatsappMessage",
    "instagramUrl",
    "socialImageUrl",
    "socialImageAlt",
  ]) {
    if (!isNonEmptyText(config[field])) {
      errors.push(`SITE_CONFIG.${field} no puede estar vacío.`);
    }
  }

  for (const field of ["instagramUrl", "socialImageUrl"]) {
    try {
      const url = new URL(config[field]);
      if (url.protocol !== "https:") {
        errors.push(`SITE_CONFIG.${field} debe usar HTTPS.`);
      }
    } catch {
      errors.push(`SITE_CONFIG.${field} debe ser una URL absoluta válida.`);
    }
  }

  if (!Number.isInteger(config.socialImageWidth) || config.socialImageWidth < 600) {
    errors.push("SITE_CONFIG.socialImageWidth debe ser un entero de al menos 600 px.");
  }

  if (!Number.isInteger(config.socialImageHeight) || config.socialImageHeight < 315) {
    errors.push("SITE_CONFIG.socialImageHeight debe ser un entero de al menos 315 px.");
  }
}

export function validateCatalogue(
  catalogue,
  config,
  { repositoryRoot = process.cwd(), checkFiles = true } = {},
) {
  const errors = [];
  validateConfig(config, errors);

  if (!Array.isArray(catalogue) || catalogue.length === 0) {
    errors.push("El catálogo debe contener al menos un producto publicado.");
    return errors;
  }

  const ids = new Set();
  const references = new Set();
  const slugs = new Set();
  const folders = new Set();
  const catalogueById = new Map(
    catalogue
      .filter((product) => product && typeof product === "object")
      .map((product) => [product.id, product]),
  );
  const inventoryRootExists = fs.existsSync(path.join(repositoryRoot, "ropa"));

  for (const [index, product] of catalogue.entries()) {
    const label = isNonEmptyText(product?.id)
      ? product.id
      : `producto ${index + 1}`;

    if (!product || typeof product !== "object") {
      errors.push(`El producto ${index + 1} debe ser un objeto.`);
      continue;
    }

    for (const field of requiredTextFields) {
      if (!isNonEmptyText(product[field])) {
        errors.push(`${label}: ${field} no puede estar vacío.`);
      }
    }

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(product.slug ?? "")) {
      errors.push(`${label}: slug debe usar minúsculas, números y guiones simples.`);
    }

    if (ids.has(product.id)) {
      errors.push(`${label}: identificador duplicado.`);
    }
    ids.add(product.id);

    if (references.has(product.reference)) {
      errors.push(`${label}: referencia duplicada.`);
    }
    references.add(product.reference);

    if (slugs.has(product.slug)) {
      errors.push(`${label}: slug duplicado.`);
    }
    slugs.add(product.slug);

    if (product.demoSourceProductId) {
      const sourceProduct = catalogueById.get(product.demoSourceProductId);
      if (!sourceProduct || sourceProduct === product) {
        errors.push(`${label}: demoSourceProductId no referencia una prenda base válida.`);
      } else if (sourceProduct.folder !== product.folder) {
        errors.push(`${label}: la carpeta demo debe coincidir con su fuente de imágenes.`);
      }
    } else {
      if (folders.has(product.folder)) {
        errors.push(`${label}: carpeta de inventario duplicada.`);
      }
      folders.add(product.folder);
    }

    if (!Number.isInteger(product.availability) || product.availability < 1) {
      errors.push(
        `${label}: una prenda publicada debe tener availability como entero positivo.`,
      );
    }

    if (!product.fieldVerification || typeof product.fieldVerification !== "object") {
      errors.push(`${label}: falta fieldVerification.`);
    } else {
      for (const [field, status] of Object.entries(product.fieldVerification)) {
        if (!verificationStates.has(status)) {
          errors.push(`${label}: estado de verificación inválido en ${field}.`);
        }
      }
    }

    const priceStatus = product.fieldVerification?.priceClp;
    if (displayableVerificationStates.has(priceStatus)) {
      if (!Number.isInteger(product.priceClp) || product.priceClp < 0) {
        errors.push(
          `${label}: priceClp publicado debe ser un entero CLP no negativo.`,
        );
      }
    } else if (product.priceClp !== null) {
      errors.push(`${label}: priceClp no verificado debe permanecer en null.`);
    }

    if (!allowedCategories.has(product.category)) {
      errors.push(`${label}: categoría fuera de la lista centralizada de filtros.`);
    }

    if (
      displayableVerificationStates.has(product.fieldVerification?.size) &&
      !allowedSizes.has(String(product.size))
    ) {
      errors.push(`${label}: talla fuera de la lista centralizada de filtros.`);
    }

    if (
      displayableVerificationStates.has(product.fieldVerification?.materials)
    ) {
      const productMaterials = getProductMaterialNames(product);
      if (new Set(productMaterials).size !== productMaterials.length) {
        errors.push(`${label}: materials contiene valores duplicados.`);
      }
      if (productMaterials.some((material) => !allowedMaterials.has(material))) {
        errors.push(`${label}: material fuera de la lista centralizada de filtros.`);
      }
    }

    for (const field of ["audience", "size", "manufactureCountry"]) {
      if (
        displayableVerificationStates.has(product.fieldVerification?.[field]) &&
        !isNonEmptyText(product[field])
      ) {
        errors.push(`${label}: ${field} publicado no puede estar vacío.`);
      }
    }

    if (
      displayableVerificationStates.has(product.fieldVerification?.materials) &&
      !(
        isNonEmptyText(product.materials) ||
        (Array.isArray(product.materials) && product.materials.length > 0)
      )
    ) {
      errors.push(`${label}: materials publicado no puede estar vacío.`);
    }

    if (
      displayableVerificationStates.has(product.fieldVerification?.measurements) &&
      !(
        isNonEmptyText(product.measurements) ||
        (Array.isArray(product.measurements) && product.measurements.length > 0) ||
        (product.measurements &&
          typeof product.measurements === "object" &&
          Object.keys(product.measurements).length > 0)
      )
    ) {
      errors.push(`${label}: measurements publicado no puede estar vacío.`);
    }

    if (
      displayableVerificationStates.has(
        product.fieldVerification?.originalPriceYen,
      ) &&
      (!Number.isInteger(product.originalPriceYen) || product.originalPriceYen < 0)
    ) {
      errors.push(
        `${label}: originalPriceYen publicado debe ser un entero no negativo.`,
      );
    }

    if (!Array.isArray(product.images) || product.images.length === 0) {
      errors.push(`${label}: debe incluir al menos una imagen.`);
      continue;
    }

    if (!product.images.some((image) => image.kind === REAL_IMAGE_KIND)) {
      errors.push(`${label}: debe incluir al menos una fotografía real.`);
    }

    const imagePaths = new Set();
    for (const [imageIndex, image] of product.images.entries()) {
      const imageLabel = `${label}, imagen ${imageIndex + 1}`;

      if (!imageKinds.has(image.kind)) {
        errors.push(`${imageLabel}: kind no reconocido.`);
      }

      if (!isNonEmptyText(image.alt)) {
        errors.push(`${imageLabel}: alt no puede estar vacío.`);
      }

      if (!Number.isInteger(image.width) || image.width < 1) {
        errors.push(`${imageLabel}: width debe ser un entero positivo.`);
      }

      if (!Number.isInteger(image.height) || image.height < 1) {
        errors.push(`${imageLabel}: height debe ser un entero positivo.`);
      }

      for (const field of ["src", "source"]) {
        if (!isSafeRelativeAssetPath(image[field])) {
          errors.push(`${imageLabel}: ${field} debe ser una ruta relativa segura.`);
        } else if (checkFiles && !fs.existsSync(path.join(repositoryRoot, image[field]))) {
          errors.push(`${imageLabel}: no existe ${image[field]}.`);
        }
      }

      if (!image.src?.endsWith(".webp")) {
        errors.push(`${imageLabel}: src debe usar el derivado WebP optimizado.`);
      }

      if (imagePaths.has(image.src)) {
        errors.push(`${imageLabel}: ruta de imagen duplicada en la ficha.`);
      }
      imagePaths.add(image.src);

      if (!Array.isArray(image.srcset) || image.srcset.length < 2) {
        errors.push(`${imageLabel}: srcset debe incluir al menos dos tamaños.`);
      } else {
        const widths = new Set();
        let includesDefault = false;
        for (const candidate of image.srcset) {
          if (!isSafeRelativeAssetPath(candidate.src)) {
            errors.push(`${imageLabel}: srcset contiene una ruta inválida.`);
          } else if (
            checkFiles &&
            !fs.existsSync(path.join(repositoryRoot, candidate.src))
          ) {
            errors.push(`${imageLabel}: no existe ${candidate.src}.`);
          }

          if (!Number.isInteger(candidate.width) || candidate.width < 1) {
            errors.push(`${imageLabel}: srcset contiene un ancho inválido.`);
          }

          if (widths.has(candidate.width)) {
            errors.push(`${imageLabel}: srcset repite el ancho ${candidate.width}.`);
          }
          widths.add(candidate.width);
          includesDefault ||= candidate.src === image.src;
        }

        if (!includesDefault) {
          errors.push(`${imageLabel}: srcset debe incluir la ruta src de respaldo.`);
        }
      }

      if (image.kind === AI_IMAGE_KIND && !isNonEmptyText(image.disclosure)) {
        errors.push(`${imageLabel}: una visualización IA necesita disclosure.`);
      }
    }

    if (
      inventoryRootExists &&
      (!isSafeRelativeAssetPath(product.folder) ||
        !fs.existsSync(path.join(repositoryRoot, product.folder)))
    ) {
      errors.push(`${label}: no existe la carpeta de inventario ${product.folder}.`);
    }
  }

  return errors;
}
