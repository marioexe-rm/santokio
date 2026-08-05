import { products, SITE_CONFIG } from "./data/products.js?v=4";
import {
  AI_IMAGE_KIND,
  REAL_IMAGE_KIND,
  buildHeroSlides,
  escapeHtml,
  formatPrice,
  getAiImages,
  getContainedImageAspectRatio,
  getImageSrcset,
  getOrderedImages,
  getProductFacts,
  makeProductWhatsappUrl,
  makeWhatsappUrl,
  renderAvailability,
  renderHeroSlideMarkup,
  renderImageAttributes,
  renderProductCardMarkup,
} from "./data/site-content.js?v=2";

const HERO_ROTATION_MS = 4000;
const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

const state = {
  query: "",
  sort: "featured",
  activeProduct: null,
  galleryIndex: 0,
  lastFocused: null,
  scrollPosition: 0,
  pointerStartX: null,
  cardImageIndices: new Map(),
  heroSlides: [],
  heroSlideIndex: 0,
  heroTimer: null,
  bodyInlineStyles: null,
  documentLocked: false,
};

const elements = {
  header: document.querySelector("[data-header]"),
  menuToggle: document.querySelector("[data-menu-toggle]"),
  navigation: document.querySelector("[data-navigation]"),
  heroSequence: document.querySelector("[data-hero-sequence]"),
  heroPrimary: document.querySelector("[data-hero-primary]"),
  heroPreview: document.querySelector("[data-hero-preview]"),
  catalogueTools: document.querySelector("[data-catalogue-tools]"),
  search: document.querySelector("[data-search]"),
  sort: document.querySelector("[data-sort]"),
  clear: document.querySelector("[data-clear]"),
  emptyClear: document.querySelector("[data-empty-clear]"),
  resultsStatus: document.querySelector("[data-results-status]"),
  productList: document.querySelector("[data-product-list]"),
  emptyState: document.querySelector("[data-empty-state]"),
  generalWhatsappLinks: document.querySelectorAll("[data-general-whatsapp]"),
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
    state.heroSlides.length < 2
  ) {
    return;
  }

  state.heroTimer = window.setTimeout(() => {
    state.heroTimer = null;
    if (reducedMotionQuery.matches || document.hidden) {
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
  const storedImageIndex = state.cardImageIndices.get(product.id) ?? 0;
  return renderProductCardMarkup(product, originalIndex, storedImageIndex);
}

function changeCardImage(productId, offset) {
  const product = products.find((candidate) => candidate.id === productId);
  const cardImages = product ? getAiImages(product).slice(0, 3) : [];
  const productEntry = elements.productList.querySelector(
    `[data-product-entry="${CSS.escape(productId)}"]`,
  );

  if (!product || cardImages.length === 0 || !productEntry) {
    return;
  }

  const currentIndex = state.cardImageIndices.get(productId) ?? 0;
  const nextIndex = (currentIndex + offset + cardImages.length) % cardImages.length;
  const image = cardImages[nextIndex];
  const cardImage = productEntry.querySelector("[data-card-image]");
  const cardImageFrame = productEntry.querySelector(
    "[data-product-image-frame]",
  );
  const cardPosition = productEntry.querySelector("[data-card-position]");

  state.cardImageIndices.set(productId, nextIndex);
  cardImage.srcset = getImageSrcset(image);
  cardImage.src = image.src;
  cardImage.alt = image.alt;
  cardImage.width = image.width;
  cardImage.height = image.height;
  cardImageFrame.style.setProperty(
    "--contained-image-aspect-ratio",
    getContainedImageAspectRatio(image),
  );
  cardPosition.textContent = `Visualización ${nextIndex + 1} de ${
    cardImages.length
  } de ${product.name}`;
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
}

function normalizedStatusText(resultLabel, query) {
  return query.trim()
    ? `${resultLabel} para “${query.trim()}”.`
    : `${resultLabel} en la colección.`;
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

function lockDocument() {
  state.scrollPosition = window.scrollY;
  state.bodyInlineStyles = {
    top: document.body.style.top,
    width: document.body.style.width,
    paddingRight: document.body.style.paddingRight,
  };
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
  document.body.style.top = `-${state.scrollPosition}px`;
  document.body.style.width = "100%";
  if (scrollbarWidth > 0) {
    document.body.style.paddingRight = `${scrollbarWidth}px`;
  }
  document.body.classList.add("dialog-open");
  state.documentLocked = true;
  elements.header.inert = true;
  document.querySelector("main").inert = true;
  document.querySelector(".site-footer").inert = true;
}

function unlockDocument() {
  if (!state.documentLocked) {
    return;
  }

  const savedScrollY = state.scrollPosition;
  document.documentElement.classList.add("is-restoring-scroll");
  elements.header.inert = false;
  document.querySelector("main").inert = false;
  document.querySelector(".site-footer").inert = false;
  document.body.classList.remove("dialog-open");
  document.body.style.top = state.bodyInlineStyles?.top ?? "";
  document.body.style.width = state.bodyInlineStyles?.width ?? "";
  document.body.style.paddingRight = state.bodyInlineStyles?.paddingRight ?? "";
  state.bodyInlineStyles = null;
  window.scrollTo({ top: savedScrollY, left: 0, behavior: "auto" });
  state.documentLocked = false;
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
  lockDocument();
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
  if (!state.documentLocked) {
    return;
  }

  const savedScrollY = state.scrollPosition;
  const returnTarget = state.lastFocused;
  unlockDocument();
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

const faqAnimations = new Map();
let faqTransitionMs = 760;
let faqTransitionEasing = "cubic-bezier(0.16, 1, 0.3, 1)";

function readFaqMotionSettings() {
  const rootStyles = getComputedStyle(document.documentElement);
  const raw = rootStyles.getPropertyValue("--hero-transition-duration").trim();
  const value = Number.parseFloat(raw);

  if (Number.isFinite(value)) {
    faqTransitionMs = raw.endsWith("ms") ? value : value * 1000;
  }

  faqTransitionEasing =
    rootStyles.getPropertyValue("--hero-transition-easing").trim() ||
    faqTransitionEasing;
}

function toggleFaqItem(details, summary) {
  const answer = details.querySelector(".faq-answer");
  if (!answer) {
    return;
  }

  const willOpen = summary.getAttribute("aria-expanded") !== "true";
  const currentHeight = answer.getBoundingClientRect().height;
  const runningAnimation = faqAnimations.get(details);

  if (runningAnimation) {
    faqAnimations.delete(details);
    runningAnimation.cancel();
  }

  details.classList.toggle("is-open", willOpen);
  summary.setAttribute("aria-expanded", String(willOpen));

  if (willOpen) {
    details.open = true;
    answer.inert = false;
  } else {
    answer.inert = true;
  }

  if (reducedMotionQuery.matches || typeof answer.animate !== "function") {
    answer.style.height = willOpen ? "auto" : "0px";
    if (!willOpen) {
      details.open = false;
    }
    return;
  }

  const expandedHeight =
    answer.firstElementChild?.getBoundingClientRect().height ??
    answer.scrollHeight;
  const targetHeight = willOpen ? expandedHeight : 0;
  answer.style.height = `${currentHeight}px`;

  const animation = answer.animate(
    [
      { height: `${currentHeight}px` },
      { height: `${targetHeight}px` },
    ],
    {
      duration: faqTransitionMs,
      easing: faqTransitionEasing,
      fill: "both",
    },
  );

  faqAnimations.set(details, animation);
  animation.finished.then(
    () => {
      if (faqAnimations.get(details) !== animation) {
        return;
      }

      faqAnimations.delete(details);
      answer.style.height = willOpen ? "auto" : "0px";
      if (!willOpen) {
        details.open = false;
      }
      animation.cancel();
    },
    () => {},
  );
  animation.oncancel = () => {
    if (faqAnimations.get(details) === animation) {
      faqAnimations.delete(details);
    }
  };
}

function initFaq() {
  readFaqMotionSettings();

  document.querySelectorAll(".faq details").forEach((details) => {
    const summary = details.querySelector("summary");
    const answer = details.querySelector(".faq-answer");
    if (!summary || !answer) {
      return;
    }

    details.classList.toggle("is-open", details.open);
    summary.setAttribute("aria-expanded", String(details.open));
    answer.style.height = details.open ? "auto" : "0px";
    answer.inert = !details.open;
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

const desktopPieceLayoutQuery = window.matchMedia("(min-width: 58rem)");

function getSectionAlignmentMode(sectionId) {
  if (sectionId.startsWith("producto-")) {
    return "piece";
  }

  return (
    {
      coleccion: "collection",
      "como-comprar": "how-to-buy",
      preguntas: "faq",
      contacto: "contact",
    }[sectionId] ?? "default"
  );
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
  } else if (alignmentMode === "contact") {
    const heading = section.querySelector("h2") ?? section;
    destination = getPageTop(heading) - headerHeight - 24;
  } else if (alignmentMode === "how-to-buy") {
    const contentStart = section.querySelector(".section-heading") ?? section;
    const contentEnd = section.querySelector(".process-list") ?? section;
    const contentTop = getPageTop(contentStart);
    const contentBottom =
      contentEnd.getBoundingClientRect().bottom + window.scrollY;
    const contentHeight = contentBottom - contentTop;
    const verticalInset =
      contentHeight + 32 <= availableHeight
        ? (availableHeight - contentHeight) / 2
        : 16;
    destination = contentTop - headerHeight - verticalInset;
  } else if (alignmentMode === "collection" || alignmentMode === "faq") {
    const heading = section.querySelector("h2") ?? section;
    const offset = alignmentMode === "collection" ? 20 : 24;
    destination = getPageTop(heading) - headerHeight - offset;
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

  elements.productList.addEventListener("click", (event) => {
    const previous = event.target.closest("[data-card-previous]");
    const next = event.target.closest("[data-card-next]");
    const control = previous ?? next;

    if (!control) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    changeCardImage(
      previous ? previous.dataset.cardPrevious : next.dataset.cardNext,
      previous ? -1 : 1,
    );
  });

  document.addEventListener("click", (event) => {
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
  if ("scrollRestoration" in window.history) {
    window.history.scrollRestoration = "manual";
  }
  renderHero();
  renderCatalogue();
  configureContactLinks();
  initFaq();
  elements.currentYear.textContent = new Date().getFullYear();
  bindEvents();

  document.fonts?.ready.then(scheduleDialogTitleFit);

  if (window.location.hash) {
    requestAnimationFrame(handleHistoryNavigation);
  }
}

init();
