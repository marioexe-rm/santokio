import { products, SITE_CONFIG } from "./data/products.js?v=9";
import {
  AI_IMAGE_KIND,
  REAL_IMAGE_KIND,
  buildHeroSlides,
  escapeHtml,
  formatCurrencyValue,
  formatPrice,
  getCatalogueFacets,
  getContainedImageAspectRatio,
  getImageSrcset,
  getModelImages,
  getOrderedImages,
  getProductFacts,
  getVisibleCatalogueProducts,
  makeProductWhatsappUrl,
  makeWhatsappUrl,
  renderAvailability,
  renderHeroSlideMarkup,
  renderImageAttributes,
  renderProductCardMarkup,
} from "./data/site-content.js?v=8";

const HERO_ROTATION_MS = 4000;
const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const catalogueFacets = getCatalogueFacets(products);
const CATALOGUE_SCROLL_SOURCES = new Set([
  "search",
  "sort",
  "clear-filters",
]);

const state = {
  query: "",
  sort: "featured",
  categories: new Set(),
  materials: new Set(),
  sizes: new Set(),
  minPrice: catalogueFacets.minPrice,
  maxPrice: catalogueFacets.maxPrice,
  filterDialogOpen: false,
  openFilterGroup: null,
  filterCloseShouldNavigate: false,
  activeProduct: null,
  galleryIndex: 0,
  lastFocused: null,
  scrollPosition: 0,
  pointerStartX: null,
  heroSlides: [],
  heroSlideIndex: 0,
  heroTimer: null,
  heroSuppressed: false,
  catalogueAlignmentToken: 0,
  pendingCatalogueAlignment: false,
  bodyInlineStyles: null,
  filterBackgroundInlineStyles: null,
  documentLocked: false,
  documentLockOwner: null,
};

const elements = {
  header: document.querySelector("[data-header]"),
  headerSearch: document.querySelector("[data-search-form]"),
  searchToggle: document.querySelector("[data-search-toggle]"),
  searchPanel: document.querySelector("[data-search-panel]"),
  menuToggle: document.querySelector("[data-menu-toggle]"),
  navigation: document.querySelector("[data-navigation]"),
  hero: document.querySelector(".hero"),
  heroSequence: document.querySelector("[data-hero-sequence]"),
  heroPrimary: document.querySelector("[data-hero-primary]"),
  heroPreview: document.querySelector("[data-hero-preview]"),
  search: document.querySelector("[data-search]"),
  sort: document.querySelector("[data-sort]"),
  filterToggle: document.querySelector("[data-filter-toggle]"),
  filterActiveCount: document.querySelector("[data-filter-active-count]"),
  filterDialog: document.querySelector("[data-filter-dialog]"),
  filterClose: document.querySelector("[data-filter-close]"),
  filterApply: document.querySelector("[data-filter-apply]"),
  filterForm: document.querySelector("[data-filter-form]"),
  filterScrollRegion: document.querySelector("[data-filter-scroll-region]"),
  filterReset: document.querySelector("[data-filter-reset]"),
  filterCategoryOptions: document.querySelector(
    '[data-filter-options="category"]',
  ),
  filterMaterialOptions: document.querySelector(
    '[data-filter-options="material"]',
  ),
  filterSizeOptions: document.querySelector('[data-filter-options="size"]'),
  filterGroups: document.querySelectorAll("[data-filter-group]"),
  filterGroupToggles: document.querySelectorAll("[data-filter-group-toggle]"),
  filterPriceMin: document.querySelector("[data-filter-price-min]"),
  filterPriceMax: document.querySelector("[data-filter-price-max]"),
  filterPriceMinOutput: document.querySelector(
    "[data-filter-price-min-output]",
  ),
  filterPriceMaxOutput: document.querySelector(
    "[data-filter-price-max-output]",
  ),
  priceRange: document.querySelector("[data-price-range]"),
  clear: document.querySelector("[data-clear]"),
  emptyClear: document.querySelector("[data-empty-clear]"),
  resultsStatus: document.querySelector("[data-results-status]"),
  catalogue: document.querySelector(".catalogue"),
  productList: document.querySelector("[data-product-list]"),
  emptyState: document.querySelector("[data-empty-state]"),
  generalWhatsappLinks: document.querySelectorAll("[data-general-whatsapp]"),
  collectionWhatsappLinks: document.querySelectorAll(
    "[data-collection-whatsapp]",
  ),
  instagramLinks: document.querySelectorAll("[data-instagram]"),
  currentYear: document.querySelector("[data-current-year]"),
  dialog: document.querySelector("[data-product-dialog]"),
  dialogClose: document.querySelector("[data-dialog-close]"),
  dialogName: document.querySelector("[data-dialog-name]"),
  dialogDescription: document.querySelector("[data-dialog-description]"),
  dialogPrice: document.querySelector("[data-dialog-price]"),
  dialogFacts: document.querySelector("[data-dialog-facts]"),
  dialogWhatsapp: document.querySelector("[data-dialog-whatsapp]"),
  galleryStage: document.querySelector("[data-gallery-stage]"),
  galleryImageFrame: document.querySelector("[data-gallery-image-frame]"),
  galleryImage: document.querySelector("[data-gallery-image]"),
  galleryCaption: document.querySelector("[data-gallery-caption]"),
  galleryPositionCount: document.querySelector("[data-gallery-position-count]"),
  galleryPrevious: document.querySelector("[data-gallery-previous]"),
  galleryNext: document.querySelector("[data-gallery-next]"),
  galleryThumbnails: document.querySelector("[data-gallery-thumbnails]"),
  confirmationNote: document.querySelector("[data-confirmation-note]"),
  dialogShell: document.querySelector(".dialog-shell"),
  dialogProduct: document.querySelector(".dialog-product"),
};

function preloadHeroImage(image) {
  const preload = new Image();
  preload.decoding = "async";
  preload.srcset = getImageSrcset(image);
  preload.sizes = "(max-width: 42rem) 100vw, 65vw";
  preload.src = image.src;
  preload.decode?.().catch(() => {});
}

function renderHeroFrame({ animate = false } = {}) {
  if (state.heroSlides.length === 0) {
    return;
  }

  const currentIndex = state.heroSlideIndex;
  const nextIndex = (currentIndex + 1) % state.heroSlides.length;

  if (animate && !reducedMotionQuery.matches) {
    elements.heroPrimary.classList.add("is-transition-reset");
  }

  elements.heroPrimary.innerHTML = renderHeroSlideMarkup(
    state.heroSlides[currentIndex],
    currentIndex,
    { priority: true },
  );
  elements.heroPreview.innerHTML = renderHeroSlideMarkup(
    state.heroSlides[nextIndex],
    nextIndex,
    { sizes: "(max-width: 42rem) 28vw, (max-width: 58rem) 28vw, 16vw" },
  );

  if (animate && !reducedMotionQuery.matches) {
    void elements.heroPrimary.offsetWidth;
    elements.heroPrimary.classList.remove("is-transition-reset");
  }

  preloadHeroImage(
    state.heroSlides[(nextIndex + 1) % state.heroSlides.length].image,
  );
}

function stopHeroRotation() {
  if (state.heroTimer !== null) {
    window.clearTimeout(state.heroTimer);
    state.heroTimer = null;
  }
}

function scheduleHeroRotation() {
  stopHeroRotation();

  if (
    reducedMotionQuery.matches ||
    document.hidden ||
    state.heroSuppressed ||
    state.heroSlides.length < 2
  ) {
    return;
  }

  state.heroTimer = window.setTimeout(() => {
    state.heroTimer = null;
    if (reducedMotionQuery.matches || document.hidden || state.heroSuppressed) {
      scheduleHeroRotation();
      return;
    }

    state.heroSlideIndex =
      (state.heroSlideIndex + 1) % state.heroSlides.length;
    renderHeroFrame({ animate: true });
    scheduleHeroRotation();
  }, HERO_ROTATION_MS);
}

function renderHero() {
  state.heroSlides = buildHeroSlides(products);
  state.heroSlideIndex = 0;
  elements.heroSequence.dataset.heroSlideCount = String(state.heroSlides.length);

  const prerenderedPrimary = elements.heroPrimary.querySelector(
    '[data-hero-slide="0"]',
  );
  const prerenderedPreview = elements.heroPreview.querySelector(
    '[data-hero-slide="1"]',
  );

  if (!prerenderedPrimary || (state.heroSlides.length > 1 && !prerenderedPreview)) {
    renderHeroFrame();
  } else if (state.heroSlides.length > 2) {
    preloadHeroImage(state.heroSlides[2].image);
  }

  scheduleHeroRotation();
}

function getVisibleProducts() {
  return getVisibleCatalogueProducts(products, {
    query: state.query,
    categories: state.categories,
    materials: state.materials,
    sizes: state.sizes,
    minPrice: state.minPrice,
    maxPrice: state.maxPrice,
    sort: state.sort,
  });
}

function renderProductCard(product) {
  return renderProductCardMarkup(product);
}

function hasActiveCatalogueCriteria() {
  return state.query.trim().length > 0 || hasActiveProductFilters();
}

function scrollToCatalogue({ force = false } = {}) {
  const token = ++state.catalogueAlignmentToken;

  if (state.documentLockOwner === "filters") {
    state.pendingCatalogueAlignment = true;
    return;
  }

  state.pendingCatalogueAlignment = false;
  const align = () => {
    if (
      token !== state.catalogueAlignmentToken ||
      (!force && !hasActiveCatalogueCriteria())
    ) {
      return;
    }
    navigateToSection("coleccion", "section", {
      updateHistory: false,
      behavior: reducedMotionQuery.matches ? "auto" : "smooth",
    });
  };

  if (reducedMotionQuery.matches) {
    align();
    return;
  }

  window.requestAnimationFrame(() => {
    const transitions = elements.hero.getAnimations();
    if (transitions.length === 0) {
      align();
      return;
    }

    Promise.allSettled(transitions.map((transition) => transition.finished)).then(
      align,
    );
  });
}

function updateHeroSearchPresentation() {
  const shouldSuppress = hasActiveCatalogueCriteria();
  const changed = state.heroSuppressed !== shouldSuppress;

  state.heroSuppressed = shouldSuppress;
  elements.hero.classList.toggle("is-search-hidden", shouldSuppress);
  elements.hero.inert = shouldSuppress;
  elements.hero.setAttribute("aria-hidden", String(shouldSuppress));
  if (changed) {
    scheduleHeroRotation();
    if (!shouldSuppress) {
      state.catalogueAlignmentToken += 1;
      state.pendingCatalogueAlignment = false;
    }
  }
}

function renderCatalogue({ source = "initial-render" } = {}) {
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
  syncFilterControls();
  updateHeroSearchPresentation();
  if (CATALOGUE_SCROLL_SOURCES.has(source)) {
    scrollToCatalogue({ force: true });
  }
}

function normalizedStatusText(resultLabel, query) {
  if (query.trim()) {
    return `${resultLabel} para “${query.trim()}”.`;
  }

  return hasActiveProductFilters()
    ? `${resultLabel} con los filtros actuales.`
    : `${resultLabel} en la colección.`;
}

function hasActiveProductFilters() {
  return getActiveFilterState().hasActiveFilters;
}

function getActiveFilterState() {
  const counts = {
    category: state.categories.size,
    material: state.materials.size,
    size: state.sizes.size,
    price: Number(
      state.minPrice !== catalogueFacets.minPrice ||
        state.maxPrice !== catalogueFacets.maxPrice,
    ),
  };
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);

  return {
    counts,
    total,
    hasActiveFilters: total > 0,
  };
}

const filterGroupLabels = Object.freeze({
  category: "Categoría",
  material: "Material",
  size: "Talla",
  price: "Precio",
});
const accordionFilterFamilies = new Set(["category", "material", "size"]);

function syncFilterGroupCounts(filterState = getActiveFilterState()) {
  elements.filterGroups.forEach((group) => {
    const family = group.dataset.filterGroup;
    const count = filterState.counts[family] ?? 0;
    const label = filterGroupLabels[family];
    const visibleCount = group.querySelector(
      `[data-filter-group-count="${family}"]`,
    );
    const accessibleCount = group.querySelector(
      `[data-filter-group-count-label="${family}"]`,
    );
    if (!visibleCount || !accessibleCount || !label) {
      return;
    }

    visibleCount.textContent = String(count);
    accessibleCount.textContent = `${count} ${
      count === 1 ? "opción activa" : "opciones activas"
    } en ${label}`;
    group.classList.toggle("has-active-filters", count > 0);
    group.dataset.activeFilterCount = String(count);
  });
}

function setFilterGroupExpanded(toggle, isOpen, { animate = false } = {}) {
  const panel = document.getElementById(toggle.getAttribute("aria-controls"));
  const wasOpen = toggle.getAttribute("aria-expanded") === "true";
  const currentHeight =
    panel && !panel.hidden ? panel.getBoundingClientRect().height : 0;

  toggle.setAttribute("aria-expanded", String(isOpen));
  if (!panel) {
    return;
  }

  if (!animate || wasOpen === isOpen) {
    cancelAccordionPanelAnimation(panel);
    panel.hidden = !isOpen;
    panel.inert = !isOpen;
    panel.style.removeProperty("height");
    panel.style.removeProperty("overflow");
    return;
  }

  panel.style.overflow = "hidden";
  if (isOpen) {
    panel.hidden = false;
    panel.inert = false;
    const targetHeight = panel.scrollHeight;
    animateAccordionPanel(panel, {
      currentHeight,
      targetHeight,
      willOpen: true,
      onFinish: () => {
        panel.style.removeProperty("height");
        panel.style.removeProperty("overflow");
      },
    });
    return;
  }

  panel.inert = true;
  animateAccordionPanel(panel, {
    currentHeight,
    targetHeight: 0,
    willOpen: false,
    onFinish: () => {
      panel.hidden = true;
      panel.style.removeProperty("height");
      panel.style.removeProperty("overflow");
    },
  });
}

function syncFilterGroups({ animate = false } = {}) {
  elements.filterGroupToggles.forEach((toggle) => {
    setFilterGroupExpanded(
      toggle,
      state.openFilterGroup === toggle.dataset.filterGroupToggle,
      { animate },
    );
  });
}

function toggleFilterGroup(family) {
  if (!accordionFilterFamilies.has(family)) {
    return;
  }
  state.openFilterGroup = state.openFilterGroup === family ? null : family;
  syncFilterGroups({ animate: true });
}

function renderFilterOptions(container, family, values) {
  container.innerHTML = values
    .map(
      (value) => `
        <label class="filter-option">
          <input
            type="checkbox"
            name="filter-${escapeHtml(family)}"
            value="${escapeHtml(value)}"
            data-filter-family="${escapeHtml(family)}"
          >
          <span>${escapeHtml(value)}</span>
        </label>
      `,
    )
    .join("");
}

function setFilterCheckboxes(family, values) {
  elements.filterForm
    .querySelectorAll(`[data-filter-family="${family}"]`)
    .forEach((checkbox) => {
      checkbox.checked = values.has(checkbox.value);
    });
}

function syncPriceFilterControls() {
  const priceSpan = Math.max(
    1,
    catalogueFacets.maxPrice - catalogueFacets.minPrice,
  );
  const minimumPosition =
    ((state.minPrice - catalogueFacets.minPrice) / priceSpan) * 100;
  const maximumPosition =
    ((state.maxPrice - catalogueFacets.minPrice) / priceSpan) * 100;

  elements.filterPriceMin.value = String(state.minPrice);
  elements.filterPriceMax.value = String(state.maxPrice);
  elements.filterPriceMin.setAttribute(
    "aria-valuetext",
    formatCurrencyValue(state.minPrice),
  );
  elements.filterPriceMax.setAttribute(
    "aria-valuetext",
    formatCurrencyValue(state.maxPrice),
  );
  elements.filterPriceMinOutput.value = formatCurrencyValue(state.minPrice);
  elements.filterPriceMaxOutput.value = formatCurrencyValue(state.maxPrice);
  elements.priceRange.style.setProperty(
    "--price-min-position",
    `${minimumPosition}%`,
  );
  elements.priceRange.style.setProperty(
    "--price-max-position",
    `${maximumPosition}%`,
  );
}

function syncFilterControls() {
  setFilterCheckboxes("category", state.categories);
  setFilterCheckboxes("material", state.materials);
  setFilterCheckboxes("size", state.sizes);
  syncPriceFilterControls();
  const filterState = getActiveFilterState();
  syncFilterGroupCounts(filterState);

  const activeCount = filterState.total;
  elements.filterActiveCount.hidden = activeCount === 0;
  elements.filterActiveCount.textContent = String(activeCount);
  elements.filterActiveCount.setAttribute(
    "aria-label",
    `${activeCount} ${activeCount === 1 ? "filtro activo" : "filtros activos"}`,
  );
  syncFilterClearControl(
    elements.clear,
    filterState.hasActiveFilters,
    elements.filterToggle,
  );
  syncFilterClearControl(
    elements.filterReset,
    filterState.hasActiveFilters,
    elements.filterApply,
  );
}

function syncFilterClearControl(control, isVisible, focusFallback) {
  if (!control) {
    return;
  }

  if (!isVisible && document.activeElement === control) {
    focusWithoutScroll(focusFallback, window.scrollY);
  }
  control.hidden = !isVisible;
  control.disabled = !isVisible;
}

function initCatalogueFilters() {
  renderFilterOptions(
    elements.filterCategoryOptions,
    "category",
    catalogueFacets.categories,
  );
  renderFilterOptions(
    elements.filterMaterialOptions,
    "material",
    catalogueFacets.materials,
  );
  renderFilterOptions(
    elements.filterSizeOptions,
    "size",
    catalogueFacets.sizes,
  );

  [elements.filterPriceMin, elements.filterPriceMax].forEach((input) => {
    input.min = String(catalogueFacets.minPrice);
    input.max = String(catalogueFacets.maxPrice);
    input.step = "1000";
  });
  syncFilterGroups();
  syncFilterControls();
}

function updateCheckboxFilter(checkbox) {
  const stateKey =
    checkbox.dataset.filterFamily === "category"
      ? "categories"
      : checkbox.dataset.filterFamily === "material"
        ? "materials"
        : "sizes";
  const selectedValues = state[stateKey];
  if (checkbox.checked) {
    selectedValues.add(checkbox.value);
  } else {
    selectedValues.delete(checkbox.value);
  }
  renderCatalogue({ source: "filter-option" });
}

function updatePriceFilter(input) {
  const value = Number(input.value);
  if (input === elements.filterPriceMin) {
    state.minPrice = Math.min(value, state.maxPrice);
  } else {
    state.maxPrice = Math.max(value, state.minPrice);
  }
  renderCatalogue({ source: "filter-option" });
}

const catalogueHoverQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
const catalogueImagePreloads = new Map();
const cardPreviewRequests = new WeakMap();

function preloadCatalogueImage(image) {
  if (catalogueImagePreloads.has(image.src)) {
    return catalogueImagePreloads.get(image.src);
  }

  const preload = new Image();
  preload.decoding = "async";
  preload.srcset = getImageSrcset(image);
  preload.sizes = "(max-width: 58rem) 50vw, 25vw";
  preload.src = image.src;
  const promise =
    typeof preload.decode === "function"
      ? preload.decode().catch(() => {})
      : new Promise((resolve) => {
          if (preload.complete) {
            resolve();
            return;
          }
          preload.addEventListener("load", resolve, { once: true });
          preload.addEventListener("error", resolve, { once: true });
        });

  catalogueImagePreloads.set(image.src, promise);
  return promise;
}

function setCatalogueCardImage(visual, image) {
  const cardImage = visual.querySelector("[data-card-image]");
  const cardImageFrame = visual.querySelector("[data-product-image-frame]");
  const kindLabel = visual.querySelector(".image-kind-label");

  cardImage.srcset = getImageSrcset(image);
  cardImage.src = image.src;
  cardImage.alt = image.alt;
  cardImage.width = image.width;
  cardImage.height = image.height;
  cardImageFrame.style.setProperty(
    "--contained-image-aspect-ratio",
    getContainedImageAspectRatio(image),
  );
  kindLabel.hidden = image.kind !== AI_IMAGE_KIND;
  visual.dataset.cardActiveKind = image.kind;
}

function getCardProduct(visual) {
  return products.find(
    (product) => product.id === visual.dataset.openProduct,
  );
}

function previewSecondaryCardImage(visual) {
  const product = getCardProduct(visual);
  const secondaryImage = product ? getModelImages(product)[1] : null;
  if (!secondaryImage) {
    return;
  }

  const request = {};
  cardPreviewRequests.set(visual, request);
  preloadCatalogueImage(secondaryImage).then(() => {
    if (
      cardPreviewRequests.get(visual) === request &&
      visual.isConnected &&
      (visual.matches(":hover") || visual.matches(":focus"))
    ) {
      setCatalogueCardImage(visual, secondaryImage);
    }
  });
}

function restorePrimaryCardImage(visual) {
  cardPreviewRequests.delete(visual);
  const product = getCardProduct(visual);
  const primaryImage = product
    ? getModelImages(product)[0] ?? product.images[0]
    : null;
  if (primaryImage) {
    setCatalogueCardImage(visual, primaryImage);
  }
}

function handleCataloguePointerOver(event) {
  if (!catalogueHoverQuery.matches || event.pointerType === "touch") {
    return;
  }

  const visual = event.target.closest?.("[data-card-primary-kind]");
  if (visual && !visual.contains(event.relatedTarget)) {
    previewSecondaryCardImage(visual);
  }
}

function handleCataloguePointerOut(event) {
  const visual = event.target.closest?.("[data-card-primary-kind]");
  if (visual && !visual.contains(event.relatedTarget)) {
    restorePrimaryCardImage(visual);
  }
}

function renderDialogProduct(product) {
  elements.dialogName.textContent = product.name;
  elements.dialogName.style.removeProperty("--dialog-title-size");
  elements.dialogClose.setAttribute(
    "aria-label",
    `Cerrar detalle de ${product.name}`,
  );
  elements.dialogDescription.textContent = product.longDescription;
  elements.dialogPrice.textContent = formatPrice(product);
  elements.dialogFacts.innerHTML = getProductFacts(product)
    .map(
      ([label, value, type]) => `
        <div class="product-fact">
          <dt class="product-fact__label">${escapeHtml(label)}</dt>
          <dd class="product-fact__value${
            type === "availability" ? " product-fact__value--availability" : ""
          }">${
            type === "availability"
              ? renderAvailability(product, value)
              : escapeHtml(value)
          }</dd>
        </div>
      `,
    )
    .join("");
  elements.dialogWhatsapp.href = makeProductWhatsappUrl(product);

  if (elements.dialog.open) {
    fitDialogTitle();
  }
}

function imageKindLabel(image) {
  return image.kind === REAL_IMAGE_KIND
    ? "fotografía real de la prenda"
    : "visualización referencial generada con IA";
}

let galleryStageToken = 0;

function invalidateGalleryStage() {
  galleryStageToken += 1;
}

function setGalleryStageImage(image) {
  const token = ++galleryStageToken;
  const stageImage = elements.galleryImage;
  const alreadyShown =
    stageImage.dataset.imageSrc === image.src &&
    stageImage.complete &&
    stageImage.naturalWidth > 0;

  stageImage.fetchPriority = "high";
  stageImage.alt = image.alt;
  stageImage.width = image.width;
  stageImage.height = image.height;
  elements.galleryImageFrame.style.setProperty(
    "--contained-image-aspect-ratio",
    getContainedImageAspectRatio(image),
  );
  stageImage.srcset = getImageSrcset(image);
  stageImage.sizes = "(max-width: 42rem) 100vw, 65vw";
  stageImage.dataset.imageSrc = image.src;

  if (alreadyShown) {
    elements.galleryStage.classList.remove("is-updating");
    return;
  }

  elements.galleryStage.classList.add("is-updating");
  stageImage.src = image.src;

  const reveal = () => {
    if (token === galleryStageToken) {
      elements.galleryStage.classList.remove("is-updating");
    }
  };
  const revealOnceLoaded = () => {
    if (stageImage.complete) {
      reveal();
      return;
    }
    stageImage.addEventListener("load", reveal, { once: true });
    stageImage.addEventListener("error", reveal, { once: true });
  };

  if (typeof stageImage.decode === "function") {
    stageImage.decode().then(reveal, revealOnceLoaded);
  } else {
    revealOnceLoaded();
  }

  window.setTimeout(reveal, 2000);
}

function renderGallery() {
  const product = state.activeProduct;
  if (!product) {
    return;
  }

  const orderedImages = getOrderedImages(product);
  const image = orderedImages[state.galleryIndex];
  const isAi = image.kind === AI_IMAGE_KIND;

  setGalleryStageImage(image);
  elements.galleryCaption.textContent = image.disclosure ?? "";
  elements.galleryCaption.hidden = !elements.galleryCaption.textContent;
  elements.galleryCaption.classList.toggle("is-real", !isAi);
  if (elements.galleryCaption.textContent) {
    elements.galleryImage.setAttribute("aria-describedby", "gallery-caption");
  } else {
    elements.galleryImage.removeAttribute("aria-describedby");
  }
  elements.galleryStage.classList.toggle("is-ai", isAi);
  elements.galleryPositionCount.textContent = `Imagen ${
    state.galleryIndex + 1
  } de ${orderedImages.length}`;

  if (elements.galleryThumbnails.dataset.productId !== product.id) {
    elements.galleryThumbnails.innerHTML = `
      <div class="gallery-thumbnails__track">
        ${orderedImages
          .map(
            (thumbnail, index) => `
          <button
            class="gallery-thumbnail"
            type="button"
            data-gallery-thumbnail="${index}"
            data-kind="${escapeHtml(thumbnail.kind)}"
            aria-label="Mostrar imagen ${index + 1}: ${escapeHtml(imageKindLabel(thumbnail))}"
            aria-current="false"
          >
            <img
              ${renderImageAttributes(thumbnail, {
                alt: "",
                sizes: "5rem",
                loading: "lazy",
                fetchPriority: "low",
              })}
              draggable="false"
            >
          </button>
        `,
          )
          .join("")}
      </div>
    `;
    elements.galleryThumbnails.dataset.productId = product.id;
  }

  elements.galleryThumbnails
    .querySelectorAll("[data-gallery-thumbnail]")
    .forEach((thumbnail, index) => {
      thumbnail.setAttribute(
        "aria-current",
        index === state.galleryIndex ? "true" : "false",
      );
    });
}

function showGalleryImage(index) {
  if (!state.activeProduct) {
    return;
  }

  const total = getOrderedImages(state.activeProduct).length;
  state.galleryIndex = (index + total) % total;
  renderGallery();
}

function lockFilterBackgroundLayout() {
  const catalogueHeight = elements.catalogue.getBoundingClientRect().height;
  const heroHeight = elements.hero.getBoundingClientRect().height;
  const heroPaddingBottom = getComputedStyle(elements.hero).paddingBottom;

  state.filterBackgroundInlineStyles = {
    catalogueBlockSize: elements.catalogue.style.getPropertyValue(
      "--filter-locked-catalogue-block-size",
    ),
    heroBlockSize: elements.hero.style.getPropertyValue(
      "--filter-locked-hero-block-size",
    ),
    heroPaddingBottom: elements.hero.style.getPropertyValue(
      "--filter-locked-hero-padding-bottom",
    ),
  };
  elements.catalogue.style.setProperty(
    "--filter-locked-catalogue-block-size",
    `${catalogueHeight}px`,
  );
  elements.hero.style.setProperty(
    "--filter-locked-hero-block-size",
    `${heroHeight}px`,
  );
  elements.hero.style.setProperty(
    "--filter-locked-hero-padding-bottom",
    heroPaddingBottom,
  );
}

function restoreInlineCustomProperty(element, property, value) {
  if (value) {
    element.style.setProperty(property, value);
  } else {
    element.style.removeProperty(property);
  }
}

function unlockFilterBackgroundLayout() {
  const previous = state.filterBackgroundInlineStyles;
  if (!previous) {
    return;
  }

  restoreInlineCustomProperty(
    elements.catalogue,
    "--filter-locked-catalogue-block-size",
    previous.catalogueBlockSize,
  );
  restoreInlineCustomProperty(
    elements.hero,
    "--filter-locked-hero-block-size",
    previous.heroBlockSize,
  );
  restoreInlineCustomProperty(
    elements.hero,
    "--filter-locked-hero-padding-bottom",
    previous.heroPaddingBottom,
  );
  state.filterBackgroundInlineStyles = null;
}

function lockDocument(owner) {
  if (state.documentLocked) {
    return false;
  }

  state.scrollPosition = window.scrollY;
  state.bodyInlineStyles = {
    top: document.body.style.top,
    width: document.body.style.width,
    paddingRight: document.body.style.paddingRight,
  };
  if (owner === "filters") {
    lockFilterBackgroundLayout();
  }
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
  document.body.style.top = `-${state.scrollPosition}px`;
  document.body.style.width = "100%";
  if (scrollbarWidth > 0) {
    document.body.style.paddingRight = `${scrollbarWidth}px`;
  }
  document.body.classList.add(
    owner === "product" ? "dialog-open" : "filters-open",
  );
  state.documentLocked = true;
  state.documentLockOwner = owner;
  elements.header.inert = true;
  document.querySelector("main").inert = true;
  document.querySelector(".site-footer").inert = true;
  return true;
}

function unlockDocument(owner) {
  if (!state.documentLocked || state.documentLockOwner !== owner) {
    return;
  }

  const savedScrollY = state.scrollPosition;
  document.documentElement.classList.add("is-restoring-scroll");
  elements.header.inert = false;
  document.querySelector("main").inert = false;
  document.querySelector(".site-footer").inert = false;
  document.body.classList.remove("dialog-open", "filters-open");
  if (owner === "filters") {
    unlockFilterBackgroundLayout();
  }
  document.body.style.top = state.bodyInlineStyles?.top ?? "";
  document.body.style.width = state.bodyInlineStyles?.width ?? "";
  document.body.style.paddingRight = state.bodyInlineStyles?.paddingRight ?? "";
  state.bodyInlineStyles = null;
  window.scrollTo({ top: savedScrollY, left: 0, behavior: "auto" });
  state.documentLocked = false;
  state.documentLockOwner = null;
}

function focusWithoutScroll(target, savedScrollY) {
  if (!(target instanceof HTMLElement) || !target.isConnected) {
    return;
  }

  try {
    target.focus({ preventScroll: true });
  } catch {
    target.focus();
  }

  if (window.scrollY !== savedScrollY) {
    window.scrollTo({ top: savedScrollY, left: 0, behavior: "auto" });
  }
}

function openFilterDialog() {
  if (elements.filterDialog.open || state.documentLocked) {
    return;
  }

  closeMobileSearch();
  closeMobileNavigation();
  state.openFilterGroup = null;
  syncFilterGroups();
  if (!lockDocument("filters")) {
    return;
  }
  state.filterDialogOpen = true;
  state.filterCloseShouldNavigate = false;
  elements.filterToggle.setAttribute("aria-expanded", "true");
  elements.filterDialog.showModal();
  elements.filterScrollRegion.scrollTop = 0;
  elements.filterClose.focus({ preventScroll: true });
}

function closeFilterDialog({ navigateToCatalogue = false } = {}) {
  state.filterCloseShouldNavigate ||= navigateToCatalogue;
  if (elements.filterDialog.open) {
    elements.filterDialog.close();
    handleFilterDialogClosed();
  }
}

function handleFilterDialogClosed() {
  if (state.documentLockOwner !== "filters") {
    return;
  }

  const savedScrollY = state.scrollPosition;
  const shouldNavigate =
    state.filterCloseShouldNavigate || state.pendingCatalogueAlignment;
  state.filterDialogOpen = false;
  state.filterCloseShouldNavigate = false;
  state.pendingCatalogueAlignment = false;
  elements.filterToggle.setAttribute("aria-expanded", "false");
  unlockDocument("filters");
  queueMicrotask(() => {
    focusWithoutScroll(elements.filterToggle, savedScrollY);
    document.documentElement.classList.remove("is-restoring-scroll");
    if (shouldNavigate) {
      scrollToCatalogue({ force: true });
    }
  });
}

function resetDialogScroll() {
  elements.dialogShell.scrollTop = 0;
  elements.dialogProduct.scrollTop = 0;
}

const DIALOG_TITLE_MAX_LINES = 2;
const DIALOG_TITLE_STEP_PX = 0.5;
const DIALOG_TITLE_MAX_STEPS = 128;
let dialogTitleFitFrame = 0;

function countDialogTitleLines() {
  const range = document.createRange();
  range.selectNodeContents(elements.dialogName);
  const lineTops = [];

  Array.from(range.getClientRects()).forEach((rect) => {
    if (
      rect.width > 0 &&
      !lineTops.some((top) => Math.abs(top - rect.top) < 1)
    ) {
      lineTops.push(rect.top);
    }
  });

  range.detach();
  return Math.max(1, lineTops.length);
}

function fitDialogTitle() {
  const title = elements.dialogName;
  elements.dialog.classList.toggle(
    "has-expanded-title",
    title.textContent.trim().length > 48 &&
      window.matchMedia("(min-width: 42.01rem)").matches,
  );

  if (!elements.dialog.open || title.clientWidth === 0) {
    return;
  }

  title.style.removeProperty("--dialog-title-size");
  const maximumStyles = getComputedStyle(title);
  const maximumSize = Number.parseFloat(maximumStyles.fontSize);
  const maximumLineHeight = Number.parseFloat(maximumStyles.lineHeight);
  const allowedTitleHeight = Math.max(
    elements.dialogClose.getBoundingClientRect().height,
    maximumLineHeight,
  );
  title.style.setProperty(
    "--dialog-title-size",
    "var(--dialog-title-min-size)",
  );
  const minimumSize = Number.parseFloat(getComputedStyle(title).fontSize);
  let selectedSize = maximumSize;
  let lineCount = 1;

  for (let step = 0; step <= DIALOG_TITLE_MAX_STEPS; step += 1) {
    selectedSize = Math.max(
      minimumSize,
      maximumSize - step * DIALOG_TITLE_STEP_PX,
    );
    title.style.setProperty("--dialog-title-size", `${selectedSize}px`);
    lineCount = countDialogTitleLines();
    const titleHeight = title.getBoundingClientRect().height;

    if (
      (lineCount <= DIALOG_TITLE_MAX_LINES &&
        titleHeight <= allowedTitleHeight + 0.5) ||
      selectedSize === minimumSize
    ) {
      break;
    }
  }

  title.dataset.titleLines = String(lineCount);
  title.dataset.titleFontSize = selectedSize.toFixed(1);
  title.dataset.titleBlockHeight = title
    .getBoundingClientRect()
    .height.toFixed(1);
}

function scheduleDialogTitleFit() {
  if (!elements.dialog.open) {
    return;
  }

  window.cancelAnimationFrame(dialogTitleFitFrame);
  dialogTitleFitFrame = window.requestAnimationFrame(() => {
    dialogTitleFitFrame = 0;
    fitDialogTitle();
  });
}

function openProduct(productId, trigger) {
  const product = products.find((candidate) => candidate.id === productId);
  if (!product || elements.dialog.open) {
    return;
  }

  elements.dialog.classList.add("is-sizing-title");
  state.activeProduct = product;
  state.galleryIndex = 0;
  state.lastFocused = trigger ?? document.activeElement;
  renderDialogProduct(product);
  renderGallery();
  if (!lockDocument("product")) {
    return;
  }
  elements.dialog.showModal();
  elements.galleryThumbnails.scrollLeft = 0;
  fitDialogTitle();
  elements.dialog.classList.remove("is-sizing-title");
  resetDialogScroll();
  elements.dialogClose.focus({ preventScroll: true });
}

function closeProduct() {
  if (elements.dialog.open) {
    elements.dialog.close();
    handleDialogClosed();
  }
}

function handleDialogClosed() {
  if (state.documentLockOwner !== "product") {
    return;
  }

  const savedScrollY = state.scrollPosition;
  const returnTarget = state.lastFocused;
  unlockDocument("product");
  invalidateGalleryStage();
  state.activeProduct = null;
  state.galleryIndex = 0;
  state.lastFocused = null;

  focusWithoutScroll(returnTarget, savedScrollY);
  queueMicrotask(() => {
    document.documentElement.classList.remove("is-restoring-scroll");
  });
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

const accordionAnimations = new Map();
let accordionTransitionMs = 760;
let accordionTransitionEasing = "cubic-bezier(0.16, 1, 0.3, 1)";

function readAccordionMotionSettings() {
  const rootStyles = getComputedStyle(document.documentElement);
  const raw = rootStyles.getPropertyValue("--hero-transition-duration").trim();
  const value = Number.parseFloat(raw);

  if (Number.isFinite(value)) {
    accordionTransitionMs = raw.endsWith("ms") ? value : value * 1000;
  }

  accordionTransitionEasing =
    rootStyles.getPropertyValue("--hero-transition-easing").trim() ||
    accordionTransitionEasing;
}

function cancelAccordionPanelAnimation(panel) {
  const runningAnimation = accordionAnimations.get(panel);
  if (!runningAnimation) {
    return;
  }

  accordionAnimations.delete(panel);
  runningAnimation.cancel();
}

function animateAccordionPanel(
  panel,
  { currentHeight, targetHeight, willOpen, onFinish = () => {} },
) {
  cancelAccordionPanelAnimation(panel);
  panel.style.height = `${currentHeight}px`;

  if (reducedMotionQuery.matches || typeof panel.animate !== "function") {
    panel.style.height = willOpen ? "auto" : "0px";
    onFinish();
    return;
  }

  const animation = panel.animate(
    [
      { height: `${currentHeight}px` },
      { height: `${targetHeight}px` },
    ],
    {
      duration: accordionTransitionMs,
      easing: accordionTransitionEasing,
      fill: "both",
    },
  );

  accordionAnimations.set(panel, animation);
  animation.finished.then(
    () => {
      if (accordionAnimations.get(panel) !== animation) {
        return;
      }

      accordionAnimations.delete(panel);
      panel.style.height = willOpen ? "auto" : "0px";
      onFinish();
      animation.cancel();
    },
    () => {},
  );
  animation.oncancel = () => {
    if (accordionAnimations.get(panel) === animation) {
      accordionAnimations.delete(panel);
    }
  };
}

function closeFaqItemImmediately(details) {
  const answer = details.querySelector(".faq-answer");
  const summary = details.querySelector("summary");
  cancelAccordionPanelAnimation(answer);
  details.classList.remove("is-open");
  details.open = false;
  if (summary) {
    summary.setAttribute("aria-expanded", "false");
  }
  if (answer) {
    answer.style.height = "0px";
    answer.inert = true;
  }
}

function closeOtherFaqItems(activeDetails) {
  document.querySelectorAll('.faq details[name="faq-accordion"]').forEach(
    (details) => {
      if (
        details !== activeDetails &&
        (details.open || details.classList.contains("is-open"))
      ) {
        closeFaqItemImmediately(details);
      }
    },
  );
}

function toggleFaqItem(details, summary) {
  const answer = details.querySelector(".faq-answer");
  if (!answer) {
    return;
  }

  const willOpen = summary.getAttribute("aria-expanded") !== "true";
  const currentHeight = answer.getBoundingClientRect().height;

  details.classList.toggle("is-open", willOpen);
  summary.setAttribute("aria-expanded", String(willOpen));

  if (willOpen) {
    closeOtherFaqItems(details);
    details.open = true;
    answer.inert = false;
  } else {
    answer.inert = true;
  }

  const expandedHeight =
    answer.firstElementChild?.getBoundingClientRect().height ??
    answer.scrollHeight;
  const targetHeight = willOpen ? expandedHeight : 0;
  animateAccordionPanel(answer, {
    currentHeight,
    targetHeight,
    willOpen,
    onFinish: () => {
      if (!willOpen) {
        details.open = false;
      }
    },
  });
}

function initFaq() {
  readAccordionMotionSettings();

  document.querySelectorAll(".faq details").forEach((details) => {
    const summary = details.querySelector("summary");
    const answer = details.querySelector(".faq-answer");
    if (!summary || !answer) {
      return;
    }

    if (details.dataset.faqInitialized === "true") {
      return;
    }

    details.classList.toggle("is-open", details.open);
    summary.setAttribute("aria-expanded", String(details.open));
    answer.style.height = details.open ? "auto" : "0px";
    answer.inert = !details.open;
    details.dataset.faqInitialized = "true";
    summary.addEventListener("click", (event) => {
      event.preventDefault();
      toggleFaqItem(details, summary);
    });
  });
}

const preloadedProductLeads = new Set();

function preloadProductLead(productId) {
  if (!productId || preloadedProductLeads.has(productId)) {
    return;
  }

  const product = products.find((candidate) => candidate.id === productId);
  if (!product) {
    return;
  }

  preloadedProductLeads.add(productId);
  const leadImage = getOrderedImages(product)[0];
  if (leadImage) {
    preloadHeroImage(leadImage);
  }
}

function handleProductLeadPreload(event) {
  const trigger = event.target.closest?.("[data-open-product]");
  if (trigger) {
    preloadProductLead(trigger.dataset.openProduct);
  }
}

const headerMobileQuery = window.matchMedia("(max-width: 58rem)");

function closeMobileSearch({ returnFocus = false } = {}) {
  const wasOpen = elements.headerSearch.classList.contains("is-open");
  elements.headerSearch.classList.remove("is-open");
  elements.searchToggle.setAttribute("aria-expanded", "false");
  elements.searchToggle.setAttribute("aria-label", "Buscar prendas");
  elements.searchPanel.setAttribute(
    "aria-hidden",
    String(headerMobileQuery.matches),
  );

  if (
    wasOpen &&
    (returnFocus || elements.headerSearch.contains(document.activeElement))
  ) {
    elements.searchToggle.focus();
    if (returnFocus) {
      queueMicrotask(() => elements.searchToggle.focus({ preventScroll: true }));
    }
  }
}

function openMobileSearch() {
  if (!headerMobileQuery.matches) {
    elements.search.focus();
    return;
  }

  closeMobileNavigation();
  elements.headerSearch.classList.add("is-open");
  elements.searchToggle.setAttribute("aria-expanded", "true");
  elements.searchToggle.setAttribute("aria-label", "Cerrar búsqueda");
  elements.searchPanel.setAttribute("aria-hidden", "false");
  elements.search.focus({ preventScroll: true });
  requestAnimationFrame(() => {
    if (
      elements.headerSearch.classList.contains("is-open") &&
      document.activeElement !== elements.search
    ) {
      elements.search.focus({ preventScroll: true });
    }
  });
}

function toggleMobileSearch() {
  if (elements.headerSearch.classList.contains("is-open")) {
    closeMobileSearch();
  } else {
    openMobileSearch();
  }
}

function syncHeaderSearchMode() {
  if (headerMobileQuery.matches) {
    elements.searchPanel.setAttribute(
      "aria-hidden",
      String(!elements.headerSearch.classList.contains("is-open")),
    );
    return;
  }

  elements.headerSearch.classList.remove("is-open");
  elements.searchToggle.setAttribute("aria-expanded", "false");
  elements.searchToggle.setAttribute("aria-label", "Buscar prendas");
  elements.searchPanel.setAttribute("aria-hidden", "false");
}

function closeMobileNavigation({ returnFocus = false } = {}) {
  const wasOpen = elements.navigation.classList.contains("is-open");
  elements.navigation.classList.remove("is-open");
  elements.menuToggle.setAttribute("aria-expanded", "false");
  elements.menuToggle.setAttribute("aria-label", "Abrir navegación");

  if (
    wasOpen &&
    (returnFocus || elements.navigation.contains(document.activeElement))
  ) {
    elements.menuToggle.focus({ preventScroll: true });
    if (returnFocus) {
      queueMicrotask(() => elements.menuToggle.focus({ preventScroll: true }));
    }
  }
}

function toggleMobileNavigation() {
  const willOpen = !elements.navigation.classList.contains("is-open");
  if (willOpen) {
    closeMobileSearch();
  }
  elements.navigation.classList.toggle("is-open", willOpen);
  elements.menuToggle.setAttribute("aria-expanded", String(willOpen));
  elements.menuToggle.setAttribute(
    "aria-label",
    willOpen ? "Cerrar navegación" : "Abrir navegación",
  );
}

const desktopPieceLayoutQuery = window.matchMedia("(min-width: 58rem)");
const sectionAnchorIds = new Set([
  "coleccion",
  "como-comprar",
  "concepto",
  "preguntas",
  "contacto",
]);

function getSectionAlignmentMode(sectionId) {
  if (sectionId.startsWith("producto-")) {
    return "piece";
  }
  return sectionAnchorIds.has(sectionId) ? "section" : "default";
}

function getSectionAnchorGap() {
  const rootStyles = getComputedStyle(document.documentElement);
  const rawValue = rootStyles
    .getPropertyValue("--anchor-title-gap")
    .trim();
  const value = Number.parseFloat(rawValue);
  if (!Number.isFinite(value)) {
    return 16;
  }
  if (rawValue.endsWith("rem")) {
    return value * Number.parseFloat(rootStyles.fontSize);
  }
  return value;
}

function getDocumentMaximumScroll() {
  return Math.max(
    0,
    document.documentElement.scrollHeight - window.innerHeight,
  );
}

function getPageTop(element) {
  return element.getBoundingClientRect().top + window.scrollY;
}

function computeSectionDestination(
  sectionId,
  alignmentMode = getSectionAlignmentMode(sectionId),
) {
  const section = document.getElementById(sectionId);
  if (!section) {
    return null;
  }

  const headerHeight = elements.header.getBoundingClientRect().height;
  const availableHeight = Math.max(0, window.innerHeight - headerHeight);
  const maximumScroll = getDocumentMaximumScroll();
  let destination = 0;

  if (alignmentMode === "piece" && desktopPieceLayoutQuery.matches) {
    const visual = section.querySelector(".product-visual") ?? section;
    const stageTarget = visual.querySelector("img") ?? visual;
    const targetRect = stageTarget.getBoundingClientRect();
    const targetTop = targetRect.top + window.scrollY;
    const centeredInset = Math.max(
      0,
      (availableHeight - targetRect.height) / 2,
    );
    destination = Math.max(
      targetTop - headerHeight - centeredInset,
      getPageTop(section) - headerHeight + 1,
    );
  } else if (alignmentMode === "section") {
    const heading = section.querySelector("h1, h2") ?? section;
    destination =
      getPageTop(heading) - headerHeight - getSectionAnchorGap();
  } else if (sectionId === "inicio") {
    destination = 0;
  } else {
    const heading = section.querySelector("h1, h2") ?? section;
    destination = getPageTop(heading) - headerHeight - 20;
  }

  return Math.min(maximumScroll, Math.max(0, destination));
}

function navigateToSection(
  sectionId,
  alignmentMode = getSectionAlignmentMode(sectionId),
  { updateHistory = true, behavior } = {},
) {
  const destination = computeSectionDestination(sectionId, alignmentMode);
  if (destination === null) {
    return false;
  }

  if (updateHistory) {
    const nextHash = `#${encodeURIComponent(sectionId)}`;
    if (window.location.hash !== nextHash) {
      window.history.pushState({ sectionId }, "", nextHash);
    } else {
      window.history.replaceState({ sectionId }, "", nextHash);
    }
  }

  window.scrollTo({
    top: destination,
    left: 0,
    behavior: behavior ?? (reducedMotionQuery.matches ? "auto" : "smooth"),
  });
  return true;
}

const REAFFIRM_CLASS = "nav-link--reaffirm";
const REAFFIRM_DURATION_MS = 600;
const REAFFIRM_TOLERANCE_PX = 24;
const reaffirmTimers = new Map();

function isAtSectionDestination(sectionId, alignmentMode) {
  const destination = computeSectionDestination(sectionId, alignmentMode);
  return (
    destination !== null &&
    Math.abs(window.scrollY - destination) <= REAFFIRM_TOLERANCE_PX
  );
}

function reaffirmNavLink(link) {
  window.clearTimeout(reaffirmTimers.get(link));
  link.classList.remove(REAFFIRM_CLASS);
  void link.offsetWidth;
  link.classList.add(REAFFIRM_CLASS);
  reaffirmTimers.set(
    link,
    window.setTimeout(() => {
      link.classList.remove(REAFFIRM_CLASS);
      reaffirmTimers.delete(link);
    }, REAFFIRM_DURATION_MS),
  );
}

function handleInternalNavigation(event) {
  const anchor = event.target.closest('a[href^="#"]');
  if (
    !anchor ||
    anchor.hasAttribute("data-open-product")
  ) {
    return;
  }

  const href = anchor.getAttribute("href");
  if (!href || href === "#") {
    return;
  }

  let sectionId;
  try {
    sectionId = decodeURIComponent(href.slice(1));
  } catch {
    return;
  }

  if (!document.getElementById(sectionId)) {
    return;
  }

  event.preventDefault();

  const alignmentMode = getSectionAlignmentMode(sectionId);
  if (
    anchor.closest("[data-navigation]") &&
    isAtSectionDestination(sectionId, alignmentMode)
  ) {
    reaffirmNavLink(anchor);
    return;
  }

  navigateToSection(sectionId, alignmentMode);
}

function handleHistoryNavigation() {
  let sectionId = "inicio";
  try {
    sectionId = window.location.hash
      ? decodeURIComponent(window.location.hash.slice(1))
      : "inicio";
  } catch {
    sectionId = "inicio";
  }

  navigateToSection(sectionId, getSectionAlignmentMode(sectionId), {
    updateHistory: false,
    behavior: "auto",
  });
}

function resetFilters({
  clearSearch = false,
  closeSidebar = false,
  navigateToCatalogue = false,
} = {}) {
  if (clearSearch) {
    state.query = "";
    elements.search.value = "";
  }
  state.categories.clear();
  state.materials.clear();
  state.sizes.clear();
  state.minPrice = catalogueFacets.minPrice;
  state.maxPrice = catalogueFacets.maxPrice;
  renderCatalogue({
    source: navigateToCatalogue ? "clear-filters" : "filter-reset",
  });

  if (closeSidebar && elements.filterDialog.open) {
    closeFilterDialog({ navigateToCatalogue });
  }
}

function bindEvents() {
  elements.searchToggle.addEventListener("click", toggleMobileSearch);
  elements.headerSearch.addEventListener("submit", (event) => {
    event.preventDefault();
    if (headerMobileQuery.matches) {
      closeMobileSearch({ returnFocus: true });
    }
  });
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
    if (!headerMobileQuery.matches) {
      closeMobileNavigation();
    }
    syncHeaderSearchMode();
    scheduleDialogTitleFit();
  });

  document.addEventListener("visibilitychange", scheduleHeroRotation);
  if (typeof reducedMotionQuery.addEventListener === "function") {
    reducedMotionQuery.addEventListener("change", scheduleHeroRotation);
  } else {
    reducedMotionQuery.addListener(scheduleHeroRotation);
  }

  elements.search.addEventListener("input", (event) => {
    state.query = event.currentTarget.value;
    renderCatalogue({ source: "search" });
  });

  elements.sort.addEventListener("pointerdown", () => {
    elements.sort.classList.add("is-pointer-focused");
  });
  elements.sort.addEventListener("keydown", () => {
    elements.sort.classList.remove("is-pointer-focused");
  });
  elements.sort.addEventListener("blur", () => {
    elements.sort.classList.remove("is-pointer-focused");
  });
  elements.sort.addEventListener("change", (event) => {
    state.sort = event.currentTarget.value;
    renderCatalogue({ source: "sort" });
  });

  elements.filterToggle.addEventListener("click", openFilterDialog);
  elements.filterClose.addEventListener("click", closeFilterDialog);
  elements.filterApply.addEventListener("click", () =>
    closeFilterDialog({ navigateToCatalogue: true }),
  );
  elements.filterReset.addEventListener("click", () =>
    resetFilters({
      clearSearch: false,
      closeSidebar: false,
      navigateToCatalogue: false,
    }),
  );
  elements.filterForm.addEventListener("click", (event) => {
    const toggle = event.target.closest("[data-filter-group-toggle]");
    if (toggle) {
      toggleFilterGroup(toggle.dataset.filterGroupToggle);
    }
  });
  elements.filterForm.addEventListener("change", (event) => {
    if (event.target.matches("[data-filter-family]")) {
      updateCheckboxFilter(event.target);
    }
  });
  elements.filterPriceMin.addEventListener("input", (event) =>
    updatePriceFilter(event.currentTarget),
  );
  elements.filterPriceMax.addEventListener("input", (event) =>
    updatePriceFilter(event.currentTarget),
  );

  const resetCatalogue = () =>
    resetFilters({
      clearSearch: true,
      closeSidebar: false,
      navigateToCatalogue: true,
    });
  elements.clear.addEventListener("click", resetCatalogue);
  elements.emptyClear.addEventListener("click", resetCatalogue);

  elements.productList.addEventListener(
    "pointerover",
    handleCataloguePointerOver,
  );
  elements.productList.addEventListener("pointerout", handleCataloguePointerOut);

  document.addEventListener("click", (event) => {
    if (
      headerMobileQuery.matches &&
      elements.headerSearch.classList.contains("is-open") &&
      !elements.headerSearch.contains(event.target)
    ) {
      closeMobileSearch();
    }

    if (
      headerMobileQuery.matches &&
      elements.navigation.classList.contains("is-open") &&
      !elements.navigation.contains(event.target) &&
      !elements.menuToggle.contains(event.target)
    ) {
      closeMobileNavigation();
    }

    const openTrigger = event.target.closest("[data-open-product]");
    if (openTrigger) {
      event.preventDefault();
      openProduct(openTrigger.dataset.openProduct, openTrigger);
    }
  });
  document.addEventListener("pointerover", handleProductLeadPreload);
  document.addEventListener("focusin", handleProductLeadPreload);
  document.addEventListener("click", handleInternalNavigation);
  window.addEventListener("popstate", handleHistoryNavigation);

  elements.dialogClose.addEventListener("click", closeProduct);
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

  elements.filterDialog.addEventListener("click", (event) => {
    if (event.target === elements.filterDialog) {
      closeFilterDialog();
    }
  });
  elements.filterDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeFilterDialog();
  });
  elements.filterDialog.addEventListener("close", handleFilterDialogClosed);

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

    if (
      event.key === "Escape" &&
      elements.headerSearch.classList.contains("is-open")
    ) {
      event.preventDefault();
      closeMobileSearch({ returnFocus: true });
    } else if (
      event.key === "Escape" &&
      elements.navigation.classList.contains("is-open")
    ) {
      event.preventDefault();
      closeMobileNavigation({ returnFocus: true });
    }
  });
}

function configureContactLinks() {
  const generalUrl = makeWhatsappUrl(SITE_CONFIG.generalWhatsappMessage);
  elements.generalWhatsappLinks.forEach((link) => {
    link.href = generalUrl;
  });

  const collectionUrl = makeWhatsappUrl(SITE_CONFIG.collectionWhatsappMessage);
  elements.collectionWhatsappLinks.forEach((link) => {
    link.href = collectionUrl;
  });

  elements.instagramLinks.forEach((link) => {
    link.href = SITE_CONFIG.instagramUrl;
    link.setAttribute(
      "aria-label",
      link.hasAttribute("data-instagram-footer")
        ? `Síguenos en Instagram: @${SITE_CONFIG.instagramHandle}`
        : SITE_CONFIG.instagramLabel,
    );
  });

  elements.confirmationNote.textContent = SITE_CONFIG.confirmationNote;
}

function init() {
  document.documentElement.classList.add("js");
  syncHeaderSearchMode();
  if ("scrollRestoration" in window.history) {
    window.history.scrollRestoration = "manual";
  }
  renderHero();
  initCatalogueFilters();
  renderCatalogue();
  configureContactLinks();
  initFaq();
  elements.currentYear.textContent = new Date().getFullYear();
  bindEvents();

  const fontsReady = document.fonts?.ready ?? Promise.resolve();
  fontsReady.then(() => {
    scheduleDialogTitleFit();
    if (window.location.hash) {
      requestAnimationFrame(handleHistoryNavigation);
    }
  });
}

init();
