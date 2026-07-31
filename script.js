import { products, SITE_CONFIG, VERIFICATION } from "./data/products.js";

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

const state = {
  query: "",
  sort: "featured",
  activeProduct: null,
  galleryIndex: 0,
  lastFocused: null,
  scrollPosition: 0,
  pointerStartX: null,
};

const elements = {
  header: document.querySelector("[data-header]"),
  menuToggle: document.querySelector("[data-menu-toggle]"),
  navigation: document.querySelector("[data-navigation]"),
  heroPrimary: document.querySelector("[data-hero-primary]"),
  heroPreview: document.querySelector("[data-hero-preview]"),
  pieceIndex: document.querySelector("[data-piece-index]"),
  catalogueTools: document.querySelector("[data-catalogue-tools]"),
  search: document.querySelector("[data-search]"),
  sort: document.querySelector("[data-sort]"),
  clear: document.querySelector("[data-clear]"),
  emptyClear: document.querySelector("[data-empty-clear]"),
  resultsStatus: document.querySelector("[data-results-status]"),
  productList: document.querySelector("[data-product-list]"),
  emptyState: document.querySelector("[data-empty-state]"),
  generalWhatsappLinks: document.querySelectorAll("[data-general-whatsapp]"),
  currentYear: document.querySelector("[data-current-year]"),
  dialog: document.querySelector("[data-product-dialog]"),
  dialogClose: document.querySelector("[data-dialog-close]"),
  dialogName: document.querySelector("[data-dialog-name]"),
  dialogDescription: document.querySelector("[data-dialog-description]"),
  dialogPrice: document.querySelector("[data-dialog-price]"),
  dialogFacts: document.querySelector("[data-dialog-facts]"),
  dialogWhatsapp: document.querySelector("[data-dialog-whatsapp]"),
  productPrevious: document.querySelector("[data-product-previous]"),
  productNext: document.querySelector("[data-product-next]"),
  productPosition: document.querySelector("[data-product-position]"),
  galleryStage: document.querySelector("[data-gallery-stage]"),
  galleryImage: document.querySelector("[data-gallery-image]"),
  galleryCaption: document.querySelector("[data-gallery-caption]"),
  galleryPrevious: document.querySelector("[data-gallery-previous]"),
  galleryNext: document.querySelector("[data-gallery-next]"),
  galleryPosition: document.querySelector("[data-gallery-position]"),
  galleryThumbnails: document.querySelector("[data-gallery-thumbnails]"),
};

let productObserver;

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatIndex(index) {
  return String(index + 1).padStart(2, "0");
}

function formatPrice(product) {
  const isVerified =
    product.fieldVerification.priceClp === VERIFICATION.VERIFIED;

  return Number.isFinite(product.priceClp) && isVerified
    ? moneyFormatter.format(product.priceClp)
    : "Precio por definir";
}

function formatAvailability(product) {
  if (!product.availabilityConfirmed || !product.availability) {
    return "Disponibilidad por confirmar";
  }

  return product.availability;
}

function formatMaterials(product) {
  if (
    product.fieldVerification.materials !== VERIFICATION.VERIFIED ||
    !product.materials
  ) {
    return "Composición por confirmar";
  }

  return Array.isArray(product.materials)
    ? product.materials.join(", ")
    : product.materials;
}

function formatMeasurements(product) {
  if (
    product.fieldVerification.measurements !== VERIFICATION.VERIFIED ||
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

function getRealImages(product) {
  return product.images.filter(
    (image) => image.kind === "real-product-photo",
  );
}

function getPrimaryImage(product) {
  return getRealImages(product)[0] ?? product.images[0];
}

function makeWhatsappUrl(message) {
  return `https://wa.me/${SITE_CONFIG.whatsappNumber}?text=${encodeURIComponent(message)}`;
}

function makeProductWhatsappUrl(product) {
  return makeWhatsappUrl(
    `Hola, quisiera consultar por la prenda ${product.name}, referencia ${product.id}. ¿Sigue disponible?`,
  );
}

function renderHeroProduct(product, index, priority = false) {
  const image = getPrimaryImage(product);
  const loading = priority ? "eager" : "lazy";
  const fetchPriority = priority
    ? ' fetchpriority="high"'
    : ' fetchpriority="low"';

  return `
    <a
      class="hero-product-link"
      href="#producto-${escapeHtml(product.slug)}"
      data-open-product="${escapeHtml(product.id)}"
      aria-label="Abrir detalle de ${escapeHtml(product.name)}"
    >
      <figure>
        <img
          src="${escapeHtml(image.src)}"
          alt="${escapeHtml(image.alt)}"
          width="${image.width}"
          height="${image.height}"
          loading="${loading}"
          decoding="async"${fetchPriority}
        >
        <figcaption>
          <span>${formatIndex(index)} · ${escapeHtml(product.name)}</span>
          <span>${escapeHtml(formatPrice(product))}</span>
        </figcaption>
      </figure>
    </a>
  `;
}

function renderDeferredHeroPreview(product, index) {
  const render = () => {
    const commit = () => {
      elements.heroPreview.innerHTML = renderHeroProduct(product, index);
      elements.heroPreview.removeAttribute("aria-busy");
    };

    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(commit, { timeout: 800 });
    } else {
      window.setTimeout(commit, 0);
    }
  };

  if (document.readyState === "complete") {
    render();
  } else {
    window.addEventListener("load", render, { once: true });
  }
}

function renderHero() {
  const primaryProduct = products.find((product) => product.featured) ?? products[0];
  const primaryIndex = products.indexOf(primaryProduct);
  const previewProduct =
    products.find((product) => product.id !== primaryProduct.id) ?? primaryProduct;
  const previewIndex = products.indexOf(previewProduct);

  elements.heroPrimary.innerHTML = renderHeroProduct(
    primaryProduct,
    primaryIndex,
    true,
  );
  elements.heroPreview.innerHTML = "";
  elements.heroPreview.setAttribute("aria-busy", "true");
  renderDeferredHeroPreview(previewProduct, previewIndex);

  elements.pieceIndex.innerHTML = products
    .map(
      (product, index) => `
        <li>
          <a
            href="#producto-${escapeHtml(product.slug)}"
            class="${index === 0 ? "is-active" : ""}"
            data-index-link="${escapeHtml(product.id)}"
          >
            <span>${formatIndex(index)}</span>
            <span class="visually-hidden">${escapeHtml(product.name)}</span>
          </a>
        </li>
      `,
    )
    .join("");

}

function getVisibleProducts() {
  const normalizedQuery = state.query.trim().toLocaleLowerCase(SITE_CONFIG.locale);

  const visible = products.filter((product) => {
    if (!normalizedQuery) {
      return true;
    }

    return [product.name, product.id, product.slug]
      .join(" ")
      .toLocaleLowerCase(SITE_CONFIG.locale)
      .includes(normalizedQuery);
  });

  return visible.sort((a, b) => {
    if (state.sort === "name-asc") {
      return a.name.localeCompare(b.name, SITE_CONFIG.locale, {
        numeric: true,
        sensitivity: "base",
      });
    }

    return Number(b.featured) - Number(a.featured) || a.id.localeCompare(b.id);
  });
}

function renderProductCard(product) {
  const originalIndex = products.indexOf(product);
  const image = getPrimaryImage(product);
  const size =
    product.fieldVerification.size === VERIFICATION.VERIFIED && product.size
      ? product.size
      : "Talla por confirmar";

  return `
    <article
      class="product-entry"
      id="producto-${escapeHtml(product.slug)}"
      data-product-entry="${escapeHtml(product.id)}"
    >
      <div class="product-visual">
        <button
          class="product-open"
          type="button"
          data-open-product="${escapeHtml(product.id)}"
          aria-label="Ver detalle de ${escapeHtml(product.name)}, referencia ${escapeHtml(product.id)}"
        >
          <img
            src="${escapeHtml(image.src)}"
            alt="${escapeHtml(image.alt)}"
            width="${image.width}"
            height="${image.height}"
            loading="lazy"
            decoding="async"
            fetchpriority="low"
          >
          <span class="product-open-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14"></path>
            </svg>
          </span>
        </button>
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
              <dd>${escapeHtml(size)}</dd>
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
              <dd><span class="availability">${escapeHtml(formatAvailability(product))}</span></dd>
            </div>
          </dl>
          <button
            class="button button-secondary product-detail-button"
            type="button"
            data-open-product="${escapeHtml(product.id)}"
          >
            Ver detalle
          </button>
        </div>
      </div>
    </article>
  `;
}

function renderCatalogue() {
  const visibleProducts = getVisibleProducts();
  const resultLabel = `${visibleProducts.length} ${
    visibleProducts.length === 1 ? "resultado" : "resultados"
  }`;

  elements.productList.setAttribute("aria-busy", "true");
  elements.productList.innerHTML = visibleProducts.map(renderProductCard).join("");
  elements.productList.setAttribute("aria-busy", "false");
  elements.productList.hidden = visibleProducts.length === 0;
  elements.emptyState.hidden = visibleProducts.length !== 0;
  elements.resultsStatus.textContent = normalizedStatusText(
    resultLabel,
    state.query,
  );
  elements.clear.disabled = state.query.trim() === "";
  observeProducts();
}

function normalizedStatusText(resultLabel, query) {
  return query.trim()
    ? `${resultLabel} para “${query.trim()}”.`
    : `${resultLabel} en la colección.`;
}

function setActiveIndex(productId) {
  document.querySelectorAll("[data-index-link]").forEach((link) => {
    const isActive = link.dataset.indexLink === productId;
    link.classList.toggle("is-active", isActive);
    if (isActive) {
      link.setAttribute("aria-current", "true");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

function observeProducts() {
  productObserver?.disconnect();

  if (!("IntersectionObserver" in window)) {
    return;
  }

  productObserver = new IntersectionObserver(
    (entries) => {
      const visibleEntry = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

      if (visibleEntry) {
        setActiveIndex(visibleEntry.target.dataset.productEntry);
      }
    },
    {
      rootMargin: "-32% 0px -52% 0px",
      threshold: [0, 0.1, 0.35],
    },
  );

  document
    .querySelectorAll("[data-product-entry]")
    .forEach((entry) => productObserver.observe(entry));
}

function getProductFacts(product) {
  const facts = [
    ["Referencia", product.id],
    ["Categoría", product.category ?? "Por confirmar"],
    [
      "Talla",
      product.fieldVerification.size === VERIFICATION.VERIFIED && product.size
        ? product.size
        : "Talla por confirmar",
    ],
    ["Composición", formatMaterials(product)],
    ["Medidas", formatMeasurements(product)],
    ["Procedencia", product.origin],
    [
      "País de fabricación",
      product.fieldVerification.manufactureCountry === VERIFICATION.VERIFIED &&
      product.manufactureCountry
        ? product.manufactureCountry
        : "Por confirmar",
    ],
    ["Etiqueta", product.originalTag],
    ["Condición", product.condition],
    ["Disponibilidad", formatAvailability(product)],
  ];

  if (
    product.fieldVerification.originalPriceYen === VERIFICATION.VERIFIED &&
    Number.isFinite(product.originalPriceYen)
  ) {
    facts.push(["Precio original", yenFormatter.format(product.originalPriceYen)]);
  }

  return facts;
}

function renderDialogProduct(product) {
  const productIndex = products.indexOf(product);
  const previousProduct = products[(productIndex - 1 + products.length) % products.length];
  const nextProduct = products[(productIndex + 1) % products.length];

  elements.dialogName.textContent = product.name;
  elements.dialogClose.setAttribute(
    "aria-label",
    `Cerrar detalle de ${product.name}`,
  );
  elements.dialogDescription.textContent = product.longDescription;
  elements.dialogPrice.textContent = formatPrice(product);
  elements.dialogFacts.innerHTML = getProductFacts(product)
    .map(
      ([label, value]) => `
        <div>
          <dt>${escapeHtml(label)}</dt>
          <dd>${escapeHtml(value)}</dd>
        </div>
      `,
    )
    .join("");
  elements.dialogWhatsapp.href = makeProductWhatsappUrl(product);
  elements.productPosition.textContent = `${productIndex + 1} de ${products.length}`;
  elements.productPrevious.setAttribute(
    "aria-label",
    `Prenda anterior: ${previousProduct.name}`,
  );
  elements.productNext.setAttribute(
    "aria-label",
    `Prenda siguiente: ${nextProduct.name}`,
  );
}

function imageKindLabel(image) {
  return image.kind === "real-product-photo"
    ? "fotografía real de la prenda"
    : "visualización referencial generada con IA";
}

function renderGallery() {
  const product = state.activeProduct;
  if (!product) {
    return;
  }

  const image = product.images[state.galleryIndex];
  const isAi = image.kind === "ai-model-visualization";

  elements.galleryImage.src = image.src;
  elements.galleryImage.fetchPriority = "high";
  elements.galleryImage.alt = image.alt;
  elements.galleryImage.width = image.width;
  elements.galleryImage.height = image.height;
  elements.galleryCaption.textContent = image.disclosure;
  elements.galleryStage.classList.toggle("is-ai", isAi);
  elements.galleryPosition.textContent = `${state.galleryIndex + 1} de ${
    product.images.length
  } · ${imageKindLabel(image)}`;

  elements.galleryThumbnails.innerHTML = product.images
    .map(
      (thumbnail, index) => `
        <button
          class="gallery-thumbnail"
          type="button"
          data-gallery-thumbnail="${index}"
          data-kind="${escapeHtml(thumbnail.kind)}"
          aria-label="Mostrar imagen ${index + 1}: ${escapeHtml(imageKindLabel(thumbnail))}"
          aria-current="${index === state.galleryIndex ? "true" : "false"}"
        >
          <img
            src="${escapeHtml(thumbnail.src)}"
            alt=""
            width="${thumbnail.width}"
            height="${thumbnail.height}"
            loading="lazy"
            decoding="async"
            fetchpriority="low"
          >
        </button>
      `,
    )
    .join("");
}

function showGalleryImage(index) {
  if (!state.activeProduct) {
    return;
  }

  const total = state.activeProduct.images.length;
  state.galleryIndex = (index + total) % total;
  renderGallery();
}

function showAdjacentProduct(offset) {
  if (!state.activeProduct || products.length === 0) {
    return;
  }

  const currentIndex = products.indexOf(state.activeProduct);
  const nextIndex = (currentIndex + offset + products.length) % products.length;
  state.activeProduct = products[nextIndex];
  state.galleryIndex = 0;
  renderDialogProduct(state.activeProduct);
  renderGallery();
}

function lockDocument() {
  state.scrollPosition = window.scrollY;
  document.body.style.top = `-${state.scrollPosition}px`;
  document.body.classList.add("dialog-open");
  elements.header.inert = true;
  document.querySelector("main").inert = true;
  document.querySelector(".site-footer").inert = true;
}

function unlockDocument() {
  elements.header.inert = false;
  document.querySelector("main").inert = false;
  document.querySelector(".site-footer").inert = false;
  document.body.classList.remove("dialog-open");
  document.body.style.top = "";
  window.scrollTo({ top: state.scrollPosition, left: 0, behavior: "auto" });
}

function openProduct(productId, trigger) {
  const product = products.find((candidate) => candidate.id === productId);
  if (!product || elements.dialog.open) {
    return;
  }

  state.activeProduct = product;
  state.galleryIndex = 0;
  state.lastFocused = trigger ?? document.activeElement;
  renderDialogProduct(product);
  renderGallery();
  lockDocument();
  elements.dialog.showModal();
  requestAnimationFrame(() => elements.dialogClose.focus());
}

function closeProduct() {
  if (elements.dialog.open) {
    elements.dialog.close();
  }
}

function handleDialogClosed() {
  unlockDocument();
  const returnTarget = state.lastFocused;
  state.activeProduct = null;
  state.galleryIndex = 0;
  state.lastFocused = null;

  if (returnTarget instanceof HTMLElement && returnTarget.isConnected) {
    returnTarget.focus();
  }
}

function trapDialogFocus(event) {
  if (event.key !== "Tab") {
    return;
  }

  const focusable = Array.from(
    elements.dialog.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hidden && element.offsetParent !== null);

  if (focusable.length === 0) {
    event.preventDefault();
    elements.dialog.focus();
    return;
  }

  const first = focusable[0];
  const last = focusable.at(-1);

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function closeMobileNavigation() {
  elements.navigation.classList.remove("is-open");
  elements.menuToggle.setAttribute("aria-expanded", "false");
  elements.menuToggle.setAttribute("aria-label", "Abrir navegación");
}

function toggleMobileNavigation() {
  const willOpen = !elements.navigation.classList.contains("is-open");
  elements.navigation.classList.toggle("is-open", willOpen);
  elements.menuToggle.setAttribute("aria-expanded", String(willOpen));
  elements.menuToggle.setAttribute(
    "aria-label",
    willOpen ? "Cerrar navegación" : "Abrir navegación",
  );
}

function clearFilters({ focusSearch = false } = {}) {
  state.query = "";
  elements.search.value = "";
  renderCatalogue();
  if (focusSearch) {
    elements.search.focus();
  }
}

function bindEvents() {
  elements.menuToggle.addEventListener("click", toggleMobileNavigation);
  elements.navigation.addEventListener("click", (event) => {
    if (event.target.closest("a")) {
      closeMobileNavigation();
    }
  });

  window.addEventListener(
    "scroll",
    () => {
      elements.header.classList.toggle("is-scrolled", window.scrollY > 16);
    },
    { passive: true },
  );

  window.addEventListener("resize", () => {
    if (window.innerWidth > 928) {
      closeMobileNavigation();
    }
  });

  elements.search.addEventListener("input", (event) => {
    state.query = event.currentTarget.value;
    renderCatalogue();
  });

  elements.sort.addEventListener("change", (event) => {
    state.sort = event.currentTarget.value;
    renderCatalogue();
  });

  elements.catalogueTools.addEventListener("submit", (event) => {
    event.preventDefault();
  });

  elements.clear.addEventListener("click", () => clearFilters({ focusSearch: true }));
  elements.emptyClear.addEventListener("click", () =>
    clearFilters({ focusSearch: true }),
  );

  document.addEventListener("click", (event) => {
    const openTrigger = event.target.closest("[data-open-product]");
    if (openTrigger) {
      event.preventDefault();
      openProduct(openTrigger.dataset.openProduct, openTrigger);
    }
  });

  elements.dialogClose.addEventListener("click", closeProduct);
  elements.productPrevious.addEventListener("click", () =>
    showAdjacentProduct(-1),
  );
  elements.productNext.addEventListener("click", () => showAdjacentProduct(1));
  elements.galleryPrevious.addEventListener("click", () =>
    showGalleryImage(state.galleryIndex - 1),
  );
  elements.galleryNext.addEventListener("click", () =>
    showGalleryImage(state.galleryIndex + 1),
  );
  elements.galleryThumbnails.addEventListener("click", (event) => {
    const thumbnail = event.target.closest("[data-gallery-thumbnail]");
    if (thumbnail) {
      const index = Number(thumbnail.dataset.galleryThumbnail);
      showGalleryImage(index);
      elements.galleryThumbnails
        .querySelector(`[data-gallery-thumbnail="${index}"]`)
        ?.focus();
    }
  });

  elements.galleryStage.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "mouse") {
      state.pointerStartX = event.clientX;
      if (event.isTrusted && event.currentTarget.setPointerCapture) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    }
  });

  elements.galleryStage.addEventListener("pointerup", (event) => {
    if (state.pointerStartX === null || event.pointerType === "mouse") {
      return;
    }

    const distance = event.clientX - state.pointerStartX;
    state.pointerStartX = null;
    if (
      event.isTrusted &&
      event.currentTarget.hasPointerCapture?.(event.pointerId)
    ) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (Math.abs(distance) > 50) {
      showGalleryImage(state.galleryIndex + (distance < 0 ? 1 : -1));
    }
  });

  elements.galleryStage.addEventListener("pointercancel", () => {
    state.pointerStartX = null;
  });

  elements.dialog.addEventListener("click", (event) => {
    if (event.target === elements.dialog) {
      closeProduct();
    }
  });

  elements.dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeProduct();
  });

  elements.dialog.addEventListener("close", handleDialogClosed);

  document.addEventListener("keydown", (event) => {
    if (elements.dialog.open) {
      trapDialogFocus(event);

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        showGalleryImage(state.galleryIndex - 1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        showGalleryImage(state.galleryIndex + 1);
      }

      return;
    }

    if (event.key === "Escape" && elements.navigation.classList.contains("is-open")) {
      closeMobileNavigation();
      elements.menuToggle.focus();
    }
  });
}

function configureContactLinks() {
  const generalUrl = makeWhatsappUrl(SITE_CONFIG.generalWhatsappMessage);
  elements.generalWhatsappLinks.forEach((link) => {
    link.href = generalUrl;
  });
}

function init() {
  renderHero();
  renderCatalogue();
  configureContactLinks();
  elements.currentYear.textContent = new Date().getFullYear();
  bindEvents();
}

init();
