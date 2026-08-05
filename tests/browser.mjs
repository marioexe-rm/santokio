import { products } from "../data/products.js";
import {
  AI_IMAGE_KIND,
  REAL_IMAGE_KIND,
  getAiImages,
  getOrderedImages,
} from "../data/site-content.js";

const CDP_ENDPOINT = process.env.CDP_ENDPOINT ?? "http://127.0.0.1:9222";
const SITE_URL =
  process.argv[2] ?? process.env.SITE_URL ?? "http://127.0.0.1:8000/";
const expectedProductCount = products.length;
const expectedResultLabel = `${expectedProductCount} ${
  expectedProductCount === 1 ? "resultado" : "resultados"
}`;
const expectedProductHrefs = products.map(
  (product) => `#producto-${product.slug}`,
);
const expectedHeroSlideCount = products.reduce(
  (total, product) => total + getAiImages(product).length,
  0,
);
const firstProduct = products[0];
const searchProduct = products[1] ?? firstProduct;
const firstProductImages = getOrderedImages(firstProduct);
const firstProductInitialImage = firstProductImages[0];
const firstProductNextImage = firstProductImages[1];
const firstRealImageIndex = firstProductImages.findIndex(
  (image) => image.kind === REAL_IMAGE_KIND,
);
const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));
const results = [];

function check(name, condition, details = "") {
  results.push({ name, status: condition ? "pass" : "fail", details });
}

class Session {
  constructor(socket) {
    this.socket = socket;
    this.sequence = 0;
    this.pending = new Map();
    this.waiters = new Map();
    this.events = [];

    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
        return;
      }

      this.events.push(message);
      const waiters = this.waiters.get(message.method) ?? [];
      waiters.forEach((resolve) => resolve(message.params));
      this.waiters.delete(message.method);
    });
  }

  send(method, params = {}) {
    const id = ++this.sequence;
    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP no respondió a ${method}.`));
      }, 10000);
      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timeout);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });
    });
  }

  waitFor(method) {
    return new Promise((resolve) => {
      const waiters = this.waiters.get(method) ?? [];
      waiters.push(resolve);
      this.waiters.set(method, waiters);
    });
  }

  async evaluate(expression) {
    const response = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (response.exceptionDetails) {
      throw new Error(
        response.exceptionDetails.exception?.description ??
          response.exceptionDetails.text,
      );
    }
    return response.result.value;
  }
}

async function connect() {
  const target = await fetch(
    `${CDP_ENDPOINT}/json/new?${encodeURIComponent("about:blank")}`,
    { method: "PUT" },
  ).then((response) => response.json());
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  const session = new Session(socket);
  session.targetId = target.id;
  await Promise.all([
    session.send("Page.enable"),
    session.send("Runtime.enable"),
    session.send("Log.enable"),
    session.send("Network.enable"),
    session.send("DOM.enable"),
  ]);
  return session;
}

async function load(session, width, height, suffix = "") {
  await session.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width <= 480,
    screenWidth: width,
    screenHeight: height,
  });
  const loaded = session.waitFor("Page.loadEventFired");
  await session.send("Page.navigate", {
    url: `${SITE_URL}${suffix ? `?${suffix}` : ""}`,
  });
  await loaded;
  await wait(400);
}

async function pressKey(session, key, code, keyCode) {
  const common = {
    key,
    code,
    windowsVirtualKeyCode: keyCode,
    nativeVirtualKeyCode: keyCode,
  };
  await session.send("Input.dispatchKeyEvent", { ...common, type: "keyDown" });
  await session.send("Input.dispatchKeyEvent", { ...common, type: "keyUp" });
}

async function rapidClickPoint(session, point, presses = 10) {
  await session.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: point.x,
    y: point.y,
  });

  for (let index = 0; index < presses; index += 1) {
    const clickCount = Math.min(index + 1, 3);
    await session.send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      x: point.x,
      y: point.y,
      button: "left",
      buttons: 1,
      clickCount,
    });
    await session.send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x: point.x,
      y: point.y,
      button: "left",
      buttons: 0,
      clickCount,
    });
  }
}

async function swipeTouch(session, start, end) {
  const touchPoint = (point) => ({
    x: Math.round(point.x),
    y: Math.round(point.y),
    id: 1,
    radiusX: 1,
    radiusY: 1,
    force: 1,
  });

  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [touchPoint(start)],
  });

  try {
    for (const progress of [0.35, 0.7, 1]) {
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          touchPoint({
            x: start.x + (end.x - start.x) * progress,
            y: start.y + (end.y - start.y) * progress,
          }),
        ],
      });
    }
  } finally {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
  }
}

async function waitForGallerySnapshot(session, expectedPosition) {
  const deadline = Date.now() + 2500;
  let snapshot;

  do {
    snapshot = await session.evaluate(`(() => {
      const stage = document.querySelector("[data-gallery-stage]");
      const image = document.querySelector("[data-gallery-image]");
      const label = stage.querySelector(".image-kind-label");
      const labelStyle = getComputedStyle(label);
      return {
        position: document.querySelector("[data-gallery-position]").textContent.trim(),
        src: image.getAttribute("src"),
        isAi: stage.classList.contains("is-ai"),
        updating: stage.classList.contains("is-updating"),
        labelVisible: labelStyle.display !== "none" &&
          labelStyle.visibility !== "hidden" &&
          labelStyle.opacity !== "0" &&
          label.getBoundingClientRect().width > 0
      };
    })()`);

    if (snapshot.position === expectedPosition && !snapshot.updating) {
      return snapshot;
    }

    await wait(16);
  } while (Date.now() < deadline);

  return snapshot;
}

const session = await connect();

try {
  await load(session, 1440, 900, `browser-test=${Date.now()}`);
  const desktop = await session.evaluate(`(() => {
    const visualWidths = [...document.querySelectorAll(".product-visual")]
      .map((node) => node.getBoundingClientRect().width);
    const frameChecks = [...document.querySelectorAll(".contained-image-frame")]
      .map((frame) => {
        const frameRect = frame.getBoundingClientRect();
        const imageRect = frame.querySelector("img").getBoundingClientRect();
        const labelRect = frame.querySelector(".image-kind-label").getBoundingClientRect();
        const inside = (rect) =>
          rect.left >= frameRect.left - 0.5 && rect.top >= frameRect.top - 0.5 &&
          rect.right <= frameRect.right + 0.5 && rect.bottom <= frameRect.bottom + 0.5;
        return {
          imageMatchesFrame:
            Math.abs(imageRect.left - frameRect.left) <= 0.5 &&
            Math.abs(imageRect.top - frameRect.top) <= 0.5 &&
            Math.abs(imageRect.width - frameRect.width) <= 0.5 &&
            Math.abs(imageRect.height - frameRect.height) <= 0.5,
          labelInside: inside(labelRect),
          labelRight: frameRect.right - labelRect.right,
          labelBottom: frameRect.bottom - labelRect.bottom
        };
      });
    const iconChecks = [...document.querySelectorAll(".product-visual")]
      .map((visual) => {
        const visualRect = visual.getBoundingClientRect();
        const icon = visual.querySelector(".product-open-icon");
        const iconRect = icon.getBoundingClientRect();
        const nextRect = visual.querySelector(".card-carousel-next").getBoundingClientRect();
        const labelRect = visual.querySelector(".image-kind-label").getBoundingClientRect();
        const overlaps = (first, second) =>
          !(first.right <= second.left || first.left >= second.right ||
            first.bottom <= second.top || first.top >= second.bottom);
        return {
          offsetParentIsVisual: icon.offsetParent === visual,
          outsideImageFrame: !visual.querySelector(".product-image-frame").contains(icon),
          insideVisual: iconRect.left >= visualRect.left - 0.5 &&
            iconRect.top >= visualRect.top - 0.5 &&
            iconRect.right <= visualRect.right + 0.5 &&
            iconRect.bottom <= visualRect.bottom + 0.5,
          rightAlignedWithNext: Math.abs(iconRect.right - nextRect.right) <= 0.5,
          topInset: iconRect.top - visualRect.top,
          noOverlap: !overlaps(iconRect, nextRect) && !overlaps(iconRect, labelRect)
        };
      });
    return {
      lang: document.documentElement.lang,
      h1: document.querySelectorAll("h1").length,
      products: document.querySelectorAll("[data-product-entry]").length,
      canonical: document.querySelectorAll('link[rel="canonical"]').length,
      canonicalHref: document.querySelector('link[rel="canonical"]')?.href,
      width: document.documentElement.scrollWidth,
      viewport: innerWidth,
      heroSlide: document.querySelector("[data-hero-primary] [data-hero-slide]")?.dataset.heroSlide,
      heroCurrentSrc: document.querySelector("[data-hero-primary] img")?.currentSrc,
      heroControls: document.querySelectorAll(".hero-controls").length,
      inlineDetails: document.querySelectorAll(".product-inline-details").length,
      productIcons: document.querySelectorAll(".product-open-icon").length,
      visualWidths,
      frameChecks,
      iconChecks,
      visualsPreventSelection: [...document.querySelectorAll(".product-visual")]
        .every((visual) => getComputedStyle(visual).userSelect === "none"),
      visualImagesNotDraggable: [...document.querySelectorAll(".product-visual img")]
        .every((image) => !image.draggable),
      productHrefs: [...document.querySelectorAll("[data-product-entry] .product-detail-button")]
        .map((link) => link.getAttribute("href")),
      responsiveImages: [...document.images].every((image) =>
        image.hasAttribute("width") && image.hasAttribute("height") &&
        image.hasAttribute("srcset") && image.hasAttribute("sizes")
      ),
      structuredDataValid: (() => {
        try { JSON.parse(document.querySelector("[data-structured-data]").textContent); return true; }
        catch { return false; }
      })()
    };
  })()`);

  check("idioma y un solo H1", desktop.lang === "es-CL" && desktop.h1 === 1, JSON.stringify(desktop));
  check(
    "catálogo completo renderizado",
    desktop.products === expectedProductCount,
    String(desktop.products),
  );
  check(
    "canonical única y correcta",
    desktop.canonical === 1 && desktop.canonicalHref === "https://santokyo.com/",
    JSON.stringify(desktop),
  );
  check("sin scroll horizontal de escritorio", desktop.width === desktop.viewport, JSON.stringify(desktop));
  check(
    "hero-controls e inline details eliminados",
    desktop.heroControls === 0 && desktop.inlineDetails === 0,
    JSON.stringify({
      heroControls: desktop.heroControls,
      inlineDetails: desktop.inlineDetails,
    }),
  );
  check(
    "todos los product-visual tienen el mismo ancho en escritorio",
    Math.max(...desktop.visualWidths) - Math.min(...desktop.visualWidths) <= 1,
    JSON.stringify(desktop.visualWidths),
  );
  check(
    "etiquetas permanecen ancladas a sus imágenes",
    desktop.frameChecks.every((frame) =>
        frame.imageMatchesFrame && frame.labelInside &&
        frame.labelRight >= 0 && frame.labelRight <= 16 &&
        frame.labelBottom >= 0 && frame.labelBottom <= 16,
      ),
    JSON.stringify(desktop.frameChecks),
  );
  check(
    "product-open-icon se posiciona desde product-visual y alinea con siguiente",
    desktop.productIcons === expectedProductCount &&
      desktop.iconChecks.every((icon) =>
        icon.offsetParentIsVisual && icon.outsideImageFrame && icon.insideVisual &&
        icon.rightAlignedWithNext && icon.topInset >= 12 && icon.topInset <= 33 &&
        icon.noOverlap,
      ),
    JSON.stringify(desktop.iconChecks),
  );
  check(
    "áreas visuales impiden selección y arrastre nativo",
    desktop.visualsPreventSelection && desktop.visualImagesNotDraggable,
    JSON.stringify({
      visualsPreventSelection: desktop.visualsPreventSelection,
      visualImagesNotDraggable: desktop.visualImagesNotDraggable,
    }),
  );
  check(
    "enlaces estables de producto",
    desktop.productHrefs.join("\n") === expectedProductHrefs.join("\n"),
    JSON.stringify(desktop.productHrefs),
  );
  check("imágenes responsivas dimensionadas", desktop.responsiveImages);
  check("JSON-LD parseable en navegador", desktop.structuredDataValid);
  check("LCP usa un derivado WebP", /\.webp$/.test(desktop.heroCurrentSrc), desktop.heroCurrentSrc);

  const rapidCardControls = await session.evaluate(`(() => {
    const entry = document.querySelector('[data-product-entry=${JSON.stringify(firstProduct.id)}]');
    const image = entry.querySelector("[data-card-image]");
    const initialSrc = image.getAttribute("src");
    const next = entry.querySelector("[data-card-next]");
    const previous = entry.querySelector("[data-card-previous]");
    for (let index = 0; index < 10; index += 1) next.click();
    const afterNext = image.getAttribute("src");
    for (let index = 0; index < 10; index += 1) previous.click();
    return {
      initialSrc,
      afterNext,
      afterPrevious: image.getAttribute("src"),
      labelCount: entry.querySelectorAll(".image-kind-label").length,
      iconOffsetParent: entry.querySelector(".product-open-icon").offsetParent?.className,
      selection: getSelection()?.toString() ?? ""
    };
  })()`);
  check(
    "diez pulsaciones por control de tarjeta conservan estado y overlays",
    rapidCardControls.afterNext !== rapidCardControls.initialSrc &&
      rapidCardControls.afterPrevious === rapidCardControls.initialSrc &&
      rapidCardControls.labelCount === 1 &&
      rapidCardControls.iconOffsetParent === "product-visual" &&
      rapidCardControls.selection === "",
    JSON.stringify(rapidCardControls),
  );

  await wait(4300);
  const firstAutomaticSlide = await session.evaluate(
    `document.querySelector("[data-hero-primary] [data-hero-slide]")?.dataset.heroSlide`,
  );
  await session.evaluate(`(() => {
    window.dispatchEvent(new Event("resize"));
    window.dispatchEvent(new PopStateEvent("popstate"));
    document.dispatchEvent(new Event("visibilitychange"));
    document.dispatchEvent(new Event("visibilitychange"));
  })()`);
  await wait(4300);
  const secondAutomaticSlide = await session.evaluate(
    `document.querySelector("[data-hero-primary] [data-hero-slide]")?.dataset.heroSlide`,
  );
  await wait(4300);
  const thirdAutomaticSlide = await session.evaluate(
    `document.querySelector("[data-hero-primary] [data-hero-slide]")?.dataset.heroSlide`,
  );
  check(
    "hero avanza automáticamente durante varios ciclos sin temporizadores duplicados",
    [firstAutomaticSlide, secondAutomaticSlide, thirdAutomaticSlide].join() ===
      [1, 2, 3].map((index) => String(index % expectedHeroSlideCount)).join(),
    JSON.stringify({
      firstAutomaticSlide,
      secondAutomaticSlide,
      thirdAutomaticSlide,
    }),
  );

  const hiddenOverride = await session.evaluate(`(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true
    });
    document.dispatchEvent(new Event("visibilitychange"));
    return document.hidden;
  })()`);
  await wait(4300);
  const slideWhileHidden = await session.evaluate(
    `document.querySelector("[data-hero-primary] [data-hero-slide]")?.dataset.heroSlide`,
  );
  await session.evaluate(`(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false
    });
    document.dispatchEvent(new Event("visibilitychange"));
  })()`);
  await wait(4300);
  const slideAfterResume = await session.evaluate(
    `document.querySelector("[data-hero-primary] [data-hero-slide]")?.dataset.heroSlide`,
  );
  check(
    "hero pausa en pestaña oculta y reanuda con un solo temporizador",
    hiddenOverride && slideWhileHidden === thirdAutomaticSlide &&
      slideAfterResume === String(4 % expectedHeroSlideCount),
    JSON.stringify({ hiddenOverride, slideWhileHidden, slideAfterResume }),
  );

  const search = await session.evaluate(`(() => {
    const field = document.querySelector("[data-search]");
    field.value = ${JSON.stringify(searchProduct.id)};
    field.dispatchEvent(new Event("input", { bubbles: true }));
    const filtered = [...document.querySelectorAll("[data-product-entry]")]
      .map((node) => node.dataset.productEntry);
    document.querySelector("[data-clear]").click();
    return {
      filtered,
      restored: document.querySelectorAll("[data-product-entry]").length,
      status: document.querySelector("[data-results-status]").textContent
    };
  })()`);
  check(
    "búsqueda y limpieza conservan el catálogo",
    search.filtered.join() === searchProduct.id &&
      search.restored === expectedProductCount &&
      search.status.includes(expectedResultLabel),
    JSON.stringify(search),
  );

  const dialog = await session.evaluate(`(async () => {
    document.querySelector('[data-product-entry=${JSON.stringify(firstProduct.id)}] .product-detail-button').click();
    await new Promise((resolve) => setTimeout(resolve, 80));
    const galleryElement = document.querySelector(".dialog-gallery");
    const gallery = galleryElement.getBoundingClientRect();
    const galleryBorderRight = parseFloat(
      getComputedStyle(galleryElement).borderRightWidth
    );
    const position = document.querySelector("[data-gallery-position]");
    const positionRect = position.getBoundingClientRect();
    const positionCount = position.querySelector("[data-gallery-position-count]");
    const countRect = positionCount.getBoundingClientRect();
    const thumbnails = document.querySelector("[data-gallery-thumbnails]");
    const stage = document.querySelector("[data-gallery-stage]");
    const frame = document.querySelector("[data-gallery-image-frame]");
    const frameRect = frame.getBoundingClientRect();
    const image = document.querySelector("[data-gallery-image]");
    const imageRect = image.getBoundingClientRect();
    const label = stage.querySelector(".image-kind-label");
    const labelRect = label.getBoundingClientRect();
    const nextRect = document.querySelector("[data-gallery-next]").getBoundingClientRect();
    const previousRect = document.querySelector("[data-gallery-previous]").getBoundingClientRect();
    return {
      open: document.querySelector("[data-product-dialog]").open,
      focusClose: document.activeElement === document.querySelector("[data-dialog-close]"),
      thumbs: document.querySelectorAll("[data-gallery-thumbnail]").length,
      position: position.textContent.trim(),
      positionLayout: {
        afterThumbnails: thumbnails.nextElementSibling === position,
        fullWidth: position.offsetWidth === galleryElement.clientWidth &&
          Math.abs(positionRect.left - gallery.left) <= 0.5 &&
          Math.abs(positionRect.right - (gallery.right - galleryBorderRight)) <= 0.5,
        centered: Math.abs(
          (countRect.left + countRect.right) / 2 -
          (positionRect.left + positionRect.right) / 2
        ) <= 1,
        borderTop: parseFloat(getComputedStyle(position).borderTopWidth),
        overflow: position.scrollWidth > position.clientWidth,
        items: position.children.length,
        legacyNodes: position.querySelectorAll(
          ".gallery-position__track, .gallery-position__separator, [data-gallery-position-kind]"
        ).length,
        galleryWidth: gallery.width,
        galleryClientWidth: galleryElement.clientWidth,
        positionWidth: positionRect.width,
        galleryBorderRight
      },
      initialImage: {
        isAi: stage.classList.contains("is-ai"),
        labelCount: stage.querySelectorAll(".image-kind-label").length,
        labelText: label.textContent.trim(),
        labelVisible: getComputedStyle(label).display !== "none" && labelRect.width > 0,
        labelInside: labelRect.left >= frameRect.left - 0.5 &&
          labelRect.top >= frameRect.top - 0.5 &&
          labelRect.right <= frameRect.right + 0.5 &&
          labelRect.bottom <= frameRect.bottom + 0.5,
        labelRight: frameRect.right - labelRect.right,
        labelBottom: frameRect.bottom - labelRect.bottom,
        imageMatchesFrame: Math.abs(imageRect.left - frameRect.left) <= 0.5 &&
          Math.abs(imageRect.top - frameRect.top) <= 0.5 &&
          Math.abs(imageRect.width - frameRect.width) <= 0.5 &&
          Math.abs(imageRect.height - frameRect.height) <= 0.5,
        galleryUserSelect: getComputedStyle(galleryElement).userSelect,
        imagesNotDraggable: [...galleryElement.querySelectorAll("img")]
          .every((candidate) => !candidate.draggable)
      },
      controlPoints: {
        next: { x: nextRect.left + nextRect.width / 2, y: nextRect.top + nextRect.height / 2 },
        previous: {
          x: previousRect.left + previousRect.width / 2,
          y: previousRect.top + previousRect.height / 2
        }
      },
      bodyLocked: document.body.classList.contains("dialog-open"),
      mainInert: document.querySelector("main").inert
    };
  })()`);
  check(
    "diálogo abre con foco, bloqueo y galería completa",
    dialog.open && dialog.focusClose &&
      dialog.thumbs === firstProductImages.length && dialog.bodyLocked && dialog.mainInert,
    JSON.stringify(dialog),
  );
  check(
    "posición inicial de galería se anuncia",
    dialog.position === `Imagen 1 de ${firstProductImages.length}`,
    dialog.position,
  );
  check(
    "gallery-position queda bajo miniaturas, centrado y sin texto residual",
    dialog.positionLayout.afterThumbnails && dialog.positionLayout.fullWidth &&
      dialog.positionLayout.centered &&
      dialog.positionLayout.borderTop >= 1 && !dialog.positionLayout.overflow &&
      dialog.positionLayout.items === 1 && dialog.positionLayout.legacyNodes === 0 &&
      !/[·]|visualización referencial generada con IA|fotografía real de la prenda/i
        .test(dialog.position),
    JSON.stringify(dialog.positionLayout),
  );
  check(
    "imagen IA inicial muestra un único label dentro de la imagen",
    dialog.initialImage.isAi && dialog.initialImage.labelCount === 1 &&
      dialog.initialImage.labelText === "Visualización IA" &&
      dialog.initialImage.labelVisible && dialog.initialImage.labelInside &&
      dialog.initialImage.labelRight >= 0 && dialog.initialImage.labelRight <= 16 &&
      dialog.initialImage.labelBottom >= 0 && dialog.initialImage.labelBottom <= 16 &&
      dialog.initialImage.imageMatchesFrame,
    JSON.stringify(dialog.initialImage),
  );
  check(
    "galería bloquea selección accidental y arrastre de imágenes",
    dialog.initialImage.galleryUserSelect === "none" &&
      dialog.initialImage.imagesNotDraggable,
    JSON.stringify(dialog.initialImage),
  );

  await pressKey(session, "Tab", "Tab", 9);
  const galleryKeyboardFocus = await session.evaluate(`(() => ({
    previousFocused: document.activeElement === document.querySelector("[data-gallery-previous]"),
    focusVisible: document.activeElement.matches(":focus-visible"),
    outline: getComputedStyle(document.activeElement).outlineStyle
  }))()`);
  check(
    "controles de galería conservan foco visible por teclado",
    galleryKeyboardFocus.previousFocused && galleryKeyboardFocus.focusVisible &&
      galleryKeyboardFocus.outline !== "none",
    JSON.stringify(galleryKeyboardFocus),
  );

  await session.evaluate(`getSelection().removeAllRanges()`);
  await rapidClickPoint(session, dialog.controlPoints.next, 10);
  await rapidClickPoint(session, dialog.controlPoints.previous, 10);
  await wait(250);
  const rapidGalleryControls = await session.evaluate(`(() => {
    const selection = getSelection();
    const gallery = document.querySelector(".dialog-gallery");
    return {
      position: document.querySelector("[data-gallery-position]").textContent.trim(),
      labelVisible: getComputedStyle(
        document.querySelector("[data-gallery-stage] .image-kind-label")
      ).display !== "none",
      selection: selection?.toString() ?? "",
      rangeCount: selection?.rangeCount ?? 0,
      anchorInsideGallery: selection?.anchorNode ? gallery.contains(selection.anchorNode) : false
    };
  })()`);
  check(
    "diez pulsaciones rápidas por control no seleccionan la galería",
    rapidGalleryControls.position === `Imagen 1 de ${firstProductImages.length}` &&
      rapidGalleryControls.labelVisible && rapidGalleryControls.selection === "" &&
      rapidGalleryControls.rangeCount === 0 && !rapidGalleryControls.anchorInsideGallery,
    JSON.stringify(rapidGalleryControls),
  );

  const selectableDescription = await session.evaluate(`(() => {
    const description = document.querySelector("[data-dialog-description]");
    const selection = getSelection();
    const range = document.createRange();
    range.selectNodeContents(description);
    selection.removeAllRanges();
    selection.addRange(range);
    const result = {
      selected: selection.toString().trim(),
      expected: description.textContent.trim(),
      userSelect: getComputedStyle(description).userSelect
    };
    selection.removeAllRanges();
    return result;
  })()`);
  check(
    "texto descriptivo de la ficha continúa seleccionable",
    selectableDescription.selected === selectableDescription.expected &&
      selectableDescription.selected.length > 0 &&
      selectableDescription.userSelect !== "none",
    JSON.stringify(selectableDescription),
  );

  const realPhoto = await session.evaluate(`(async () => {
    document.querySelector('[data-gallery-thumbnail=${JSON.stringify(String(firstRealImageIndex))}]').click();
    const image = document.querySelector("[data-gallery-image]");
    if (!image.complete) await new Promise((resolve) => image.addEventListener("load", resolve, { once: true }));
    const label = document.querySelector("[data-gallery-stage] .image-kind-label");
    return {
      src: image.currentSrc,
      caption: document.querySelector("[data-gallery-caption]").textContent,
      position: document.querySelector("[data-gallery-position]").textContent.trim(),
      isAi: document.querySelector("[data-gallery-stage]").classList.contains("is-ai"),
      labelVisible: getComputedStyle(label).display !== "none" &&
        label.getBoundingClientRect().width > 0
    };
  })()`);
  check(
    "fotografía real se carga sin label IA",
    /\.webp$/.test(realPhoto.src) && /Fotografía real/.test(realPhoto.caption) &&
      realPhoto.position === `Imagen ${firstRealImageIndex + 1} de ${firstProductImages.length}` &&
      !realPhoto.isAi && !realPhoto.labelVisible,
    JSON.stringify(realPhoto),
  );

  const galleryNavigation = await session.evaluate(`(() => {
    const stage = document.querySelector("[data-gallery-stage]");
    const label = stage.querySelector(".image-kind-label");
    const position = () => document.querySelector("[data-gallery-position]").textContent.trim();
    const snapshot = () => ({
      position: position(),
      isAi: stage.classList.contains("is-ai"),
      labelVisible: getComputedStyle(label).display !== "none" &&
        label.getBoundingClientRect().width > 0
    });

    document.querySelector("[data-gallery-previous]").click();
    const previousToAi = snapshot();
    document.querySelector("[data-gallery-next]").click();
    const nextToReal = snapshot();
    document.querySelector('[data-gallery-thumbnail="0"]').click();
    const thumbnailToAi = snapshot();
    document.querySelector('[data-gallery-thumbnail=${JSON.stringify(String(firstRealImageIndex))}]').click();
    const thumbnailToReal = snapshot();
    return { previousToAi, nextToReal, thumbnailToAi, thumbnailToReal };
  })()`);
  check(
    "botones y miniaturas actualizan label IA según el tipo real",
    galleryNavigation.previousToAi.isAi &&
      galleryNavigation.previousToAi.labelVisible &&
      !galleryNavigation.nextToReal.isAi &&
      !galleryNavigation.nextToReal.labelVisible &&
      galleryNavigation.thumbnailToAi.isAi &&
      galleryNavigation.thumbnailToAi.labelVisible &&
      !galleryNavigation.thumbnailToReal.isAi &&
      !galleryNavigation.thumbnailToReal.labelVisible,
    JSON.stringify(galleryNavigation),
  );

  await pressKey(session, "ArrowLeft", "ArrowLeft", 37);
  const keyboardToAi = await session.evaluate(`(() => ({
    position: document.querySelector("[data-gallery-position]").textContent.trim(),
    isAi: document.querySelector("[data-gallery-stage]").classList.contains("is-ai"),
    labelVisible: getComputedStyle(
      document.querySelector("[data-gallery-stage] .image-kind-label")
    ).display !== "none"
  }))()`);
  await pressKey(session, "ArrowRight", "ArrowRight", 39);
  const keyboardToReal = await session.evaluate(`(() => ({
    position: document.querySelector("[data-gallery-position]").textContent.trim(),
    isAi: document.querySelector("[data-gallery-stage]").classList.contains("is-ai"),
    labelVisible: getComputedStyle(
      document.querySelector("[data-gallery-stage] .image-kind-label")
    ).display !== "none"
  }))()`);
  check(
    "teclado alterna correctamente entre IA y fotografía real",
    keyboardToAi.isAi && keyboardToAi.labelVisible &&
      !keyboardToReal.isAi && !keyboardToReal.labelVisible,
    JSON.stringify({ keyboardToAi, keyboardToReal }),
  );

  await pressKey(session, "Escape", "Escape", 27);
  await wait(80);
  const closed = await session.evaluate(`(() => ({
    open: document.querySelector("[data-product-dialog]").open,
    focusReturned: document.activeElement.matches('[data-product-entry=${JSON.stringify(firstProduct.id)}] .product-detail-button'),
    unlocked: !document.body.classList.contains("dialog-open") && !document.querySelector("main").inert
  }))()`);
  check("Escape cierra, desbloquea y devuelve foco", !closed.open && closed.focusReturned && closed.unlocked, JSON.stringify(closed));

  await load(session, 768, 1024, `browser-tablet=${Date.now()}`);
  const tablet = await session.evaluate(`(() => {
    const visualWidths = [...document.querySelectorAll(".product-visual")]
      .map((node) => node.getBoundingClientRect().width);
    const overlaysInside = [...document.querySelectorAll(".contained-image-frame")]
      .every((frame) => {
        const frameRect = frame.getBoundingClientRect();
        return [...frame.querySelectorAll(".image-kind-label")]
          .every((overlay) => {
            const rect = overlay.getBoundingClientRect();
            return rect.left >= frameRect.left - 0.5 &&
              rect.top >= frameRect.top - 0.5 &&
              rect.right <= frameRect.right + 0.5 &&
              rect.bottom <= frameRect.bottom + 0.5;
          });
      });
    const iconsAligned = [...document.querySelectorAll(".product-visual")]
      .every((visual) => {
        const visualRect = visual.getBoundingClientRect();
        const icon = visual.querySelector(".product-open-icon");
        const iconRect = icon.getBoundingClientRect();
        const nextRect = visual.querySelector(".card-carousel-next").getBoundingClientRect();
        return icon.offsetParent === visual &&
          Math.abs(iconRect.right - nextRect.right) <= 0.5 &&
          iconRect.top >= visualRect.top && iconRect.right <= visualRect.right + 0.5;
      });
    return {
      width: document.documentElement.scrollWidth,
      viewport: innerWidth,
      visualWidths,
      overlaysInside,
      iconsAligned,
      products: document.querySelectorAll("[data-product-entry]").length
    };
  })()`);
  check(
    "tablet conserva ancho uniforme, overlays y ausencia de overflow",
    tablet.width === tablet.viewport && tablet.overlaysInside && tablet.iconsAligned &&
      tablet.products === expectedProductCount &&
      Math.max(...tablet.visualWidths) - Math.min(...tablet.visualWidths) <= 1,
    JSON.stringify(tablet),
  );

  const tabletDialog = await session.evaluate(`(async () => {
    document.querySelector('[data-product-entry=${JSON.stringify(firstProduct.id)}] .product-detail-button').click();
    await new Promise((resolve) => setTimeout(resolve, 80));
    const stage = document.querySelector("[data-gallery-stage]");
    const frame = document.querySelector("[data-gallery-image-frame]");
    const frameRect = frame.getBoundingClientRect();
    const labelRect = stage.querySelector(".image-kind-label").getBoundingClientRect();
    const thumbnails = document.querySelector("[data-gallery-thumbnails]");
    const position = document.querySelector("[data-gallery-position]");
    const dialog = document.querySelector("[data-product-dialog]");
    return {
      noOverflow: dialog.scrollWidth <= dialog.clientWidth,
      positionAfterThumbnails: thumbnails.nextElementSibling === position,
      position: position.textContent.trim(),
      labelInside: labelRect.left >= frameRect.left - 0.5 &&
        labelRect.top >= frameRect.top - 0.5 &&
        labelRect.right <= frameRect.right + 0.5 &&
        labelRect.bottom <= frameRect.bottom + 0.5
    };
  })()`);
  check(
    "ficha tablet conserva orden, label y ausencia de overflow",
    tabletDialog.noOverflow && tabletDialog.positionAfterThumbnails &&
      tabletDialog.position === `Imagen 1 de ${firstProductImages.length}` &&
      tabletDialog.labelInside,
    JSON.stringify(tabletDialog),
  );
  await session.evaluate(`document.querySelector("[data-dialog-close]").click()`);
  await wait(80);

  await load(session, 360, 800, `browser-mobile=${Date.now()}`);
  const mobile = await session.evaluate(`(() => {
    const rect = (selector) => document.querySelector(selector).getBoundingClientRect();
    const menu = rect("[data-menu-toggle]");
    const previous = rect("[data-card-previous]");
    const next = rect("[data-card-next]");
    const overlaysInside = [...document.querySelectorAll(".contained-image-frame")]
      .every((frame) => {
        const frameRect = frame.getBoundingClientRect();
        return [...frame.querySelectorAll(".image-kind-label")]
          .every((overlay) => {
            const overlayRect = overlay.getBoundingClientRect();
            return overlayRect.left >= frameRect.left - 0.5 &&
              overlayRect.top >= frameRect.top - 0.5 &&
              overlayRect.right <= frameRect.right + 0.5 &&
              overlayRect.bottom <= frameRect.bottom + 0.5;
          });
      });
    const iconsAligned = [...document.querySelectorAll(".product-visual")]
      .every((visual) => {
        const visualRect = visual.getBoundingClientRect();
        const icon = visual.querySelector(".product-open-icon");
        const iconRect = icon.getBoundingClientRect();
        const nextRect = visual.querySelector(".card-carousel-next").getBoundingClientRect();
        return icon.offsetParent === visual &&
          Math.abs(iconRect.right - nextRect.right) <= 0.5 &&
          iconRect.top >= visualRect.top && iconRect.right <= visualRect.right + 0.5;
      });
    return {
      width: document.documentElement.scrollWidth,
      viewport: innerWidth,
      menu: { width: menu.width, height: menu.height },
      previous: { width: previous.width, height: previous.height },
      next: { width: next.width, height: next.height },
      overlaysInside,
      iconsAligned,
      heroControls: document.querySelectorAll(".hero-controls").length,
      inlineDetails: document.querySelectorAll(".product-inline-details").length,
      products: document.querySelectorAll("[data-product-entry]").length
    };
  })()`);
  check("sin scroll horizontal móvil", mobile.width === mobile.viewport, JSON.stringify(mobile));
  check(
    "controles móviles alcanzan 44 px",
    [mobile.menu, mobile.previous, mobile.next].every((rect) => rect.width >= 44 && rect.height >= 44),
    JSON.stringify(mobile),
  );
  check(
    "overlays móviles permanecen dentro de la imagen y sin componentes eliminados",
    mobile.overlaysInside && mobile.iconsAligned &&
      mobile.heroControls === 0 && mobile.inlineDetails === 0,
    JSON.stringify(mobile),
  );
  check(
    "productos permanecen en móvil",
    mobile.products === expectedProductCount,
    String(mobile.products),
  );

  const mobileMenu = await session.evaluate(`(() => {
    const toggle = document.querySelector("[data-menu-toggle]");
    toggle.click();
    return {
      expanded: toggle.getAttribute("aria-expanded"),
      open: document.querySelector("[data-navigation]").classList.contains("is-open")
    };
  })()`);
  check("menú móvil expone su estado", mobileMenu.expanded === "true" && mobileMenu.open, JSON.stringify(mobileMenu));
  await pressKey(session, "Escape", "Escape", 27);

  const mobileDialog = await session.evaluate(`(async () => {
    document.querySelector('[data-product-entry=${JSON.stringify(firstProduct.id)}] .product-detail-button').click();
    await new Promise((resolve) => setTimeout(resolve, 80));
    const stage = document.querySelector("[data-gallery-stage]");
    const frame = document.querySelector("[data-gallery-image-frame]");
    const frameRect = frame.getBoundingClientRect();
    const labelRect = stage.querySelector(".image-kind-label").getBoundingClientRect();
    const thumbnails = document.querySelector("[data-gallery-thumbnails]");
    const position = document.querySelector("[data-gallery-position]");
    position.scrollIntoView({ block: "end" });
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const positionRect = position.getBoundingClientRect();
    const ctaRect = document.querySelector(".dialog-cta").getBoundingClientRect();
    const dialog = document.querySelector("[data-product-dialog]");
    return {
      noOverflow: dialog.scrollWidth <= dialog.clientWidth,
      positionAfterThumbnails: thumbnails.nextElementSibling === position,
      position: position.textContent.trim(),
      positionVisibleAboveCta: positionRect.top >= 0 && positionRect.bottom <= ctaRect.top + 0.5,
      labelInside: labelRect.left >= frameRect.left - 0.5 &&
        labelRect.top >= frameRect.top - 0.5 &&
        labelRect.right <= frameRect.right + 0.5 &&
        labelRect.bottom <= frameRect.bottom + 0.5
    };
  })()`);
  check(
    "ficha móvil conserva orden, label visible y ausencia de overflow",
    mobileDialog.noOverflow && mobileDialog.positionAfterThumbnails &&
      mobileDialog.position === `Imagen 1 de ${firstProductImages.length}` &&
      mobileDialog.positionVisibleAboveCta && mobileDialog.labelInside,
    JSON.stringify(mobileDialog),
  );

  const baselineMaxTouchPoints = await session.evaluate(
    "navigator.maxTouchPoints",
  );
  await session.send("Emulation.setTouchEmulationEnabled", {
    enabled: true,
    maxTouchPoints: 1,
  });
  let touchEnvironment;
  let mobileSwipePoints;
  let afterSwipeLeft;
  let afterSwipeRight;

  try {
    touchEnvironment = await session.evaluate(`(() => ({
      viewport: { width: innerWidth, height: innerHeight },
      maxTouchPoints: navigator.maxTouchPoints
    }))()`);
    mobileSwipePoints = await session.evaluate(`(async () => {
      const stage = document.querySelector("[data-gallery-stage]");
      const frame = document.querySelector("[data-gallery-image-frame]");
      const controls = [
        document.querySelector("[data-gallery-previous]").getBoundingClientRect(),
        document.querySelector("[data-gallery-next]").getBoundingClientRect()
      ];
      stage.scrollIntoView({ block: "center", inline: "nearest" });
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const stageRect = stage.getBoundingClientRect();
      const frameRect = frame.getBoundingClientRect();
      const inset = Math.min(64, Math.max(28, frameRect.width * 0.18));
      const y = frameRect.top + frameRect.height * 0.28;
      const fromRight = { x: frameRect.right - inset, y };
      const fromLeft = { x: frameRect.left + inset, y };
      const inside = (point, rect) =>
        point.x > rect.left && point.x < rect.right &&
        point.y > rect.top && point.y < rect.bottom;
      const insideViewport = (point) =>
        point.x > 0 && point.x < innerWidth && point.y > 0 && point.y < innerHeight;
      const outsideControls = (point) =>
        controls.every((control) => !inside(point, control));

      return {
        fromRight,
        fromLeft,
        distance: fromRight.x - fromLeft.x,
        safe: [fromRight, fromLeft].every((point) =>
          inside(point, stageRect) && inside(point, frameRect) &&
          insideViewport(point) && outsideControls(point)
        ),
        stage: {
          left: stageRect.left,
          top: stageRect.top,
          right: stageRect.right,
          bottom: stageRect.bottom
        },
        frame: {
          left: frameRect.left,
          top: frameRect.top,
          right: frameRect.right,
          bottom: frameRect.bottom
        }
      };
    })()`);
    check(
      "gesto táctil usa viewport móvil y coordenadas interactivas seguras",
      touchEnvironment.viewport.width === 360 &&
        touchEnvironment.maxTouchPoints >= 1 &&
        mobileSwipePoints.safe && mobileSwipePoints.distance > 50,
      JSON.stringify({ touchEnvironment, mobileSwipePoints }),
    );

    await swipeTouch(
      session,
      mobileSwipePoints.fromRight,
      mobileSwipePoints.fromLeft,
    );
    afterSwipeLeft = await waitForGallerySnapshot(
      session,
      `Imagen 2 de ${firstProductImages.length}`,
    );
    await swipeTouch(
      session,
      mobileSwipePoints.fromLeft,
      mobileSwipePoints.fromRight,
    );
    afterSwipeRight = await waitForGallerySnapshot(
      session,
      `Imagen 1 de ${firstProductImages.length}`,
    );
  } finally {
    await session.send("Emulation.setTouchEmulationEnabled", {
      enabled: false,
    });
  }

  const touchCleanup = await session.evaluate(`(() => ({
    maxTouchPoints: navigator.maxTouchPoints,
    position: document.querySelector("[data-gallery-position]").textContent.trim(),
    selectionRangeCount: getSelection()?.rangeCount ?? 0
  }))()`);

  const initialImageIsAi = firstProductInitialImage?.kind === AI_IMAGE_KIND;
  const nextImageIsAi = firstProductNextImage?.kind === AI_IMAGE_KIND;
  check(
    "gesto táctil navega y mantiene el label IA sincronizado",
    afterSwipeLeft.position === `Imagen 2 de ${firstProductImages.length}` &&
      afterSwipeLeft.src === firstProductNextImage?.src &&
      afterSwipeLeft.isAi === nextImageIsAi &&
      afterSwipeLeft.labelVisible === nextImageIsAi &&
      !afterSwipeLeft.updating &&
      afterSwipeRight.position === `Imagen 1 de ${firstProductImages.length}` &&
      afterSwipeRight.src === firstProductInitialImage?.src &&
      afterSwipeRight.isAi === initialImageIsAi &&
      afterSwipeRight.labelVisible === initialImageIsAi &&
      !afterSwipeRight.updating,
    JSON.stringify({
      expectedKinds: {
        initial: firstProductInitialImage?.kind,
        next: firstProductNextImage?.kind,
      },
      afterSwipeLeft,
      afterSwipeRight,
    }),
  );
  check(
    "gesto táctil termina sin selección ni emulación residual",
    touchCleanup.maxTouchPoints === baselineMaxTouchPoints &&
      touchCleanup.position === `Imagen 1 de ${firstProductImages.length}` &&
      touchCleanup.selectionRangeCount === 0,
    JSON.stringify({ baselineMaxTouchPoints, touchCleanup }),
  );
  await session.evaluate(`document.querySelector("[data-dialog-close]").click()`);
  await wait(80);

  await session.send("Emulation.setScriptExecutionDisabled", { value: true });
  await load(session, 360, 800, `no-js=${Date.now()}`);
  const { root } = await session.send("DOM.getDocument", { depth: -1 });
  const rawProducts = await session.send("DOM.querySelectorAll", {
    nodeId: root.nodeId,
    selector: "[data-product-entry]",
  });
  const rawLinks = await session.send("DOM.querySelectorAll", {
    nodeId: root.nodeId,
    selector: 'a[href^="#producto-"]',
  });
  check(
    "sin JavaScript permanecen productos y enlaces reales",
    rawProducts.nodeIds.length === expectedProductCount &&
      rawLinks.nodeIds.length >= expectedProductCount,
    JSON.stringify({
      products: rawProducts.nodeIds.length,
      links: rawLinks.nodeIds.length,
    }),
  );
  await session.send("Emulation.setScriptExecutionDisabled", { value: false });

  const errors = session.events.filter((event) => {
    if (event.method === "Runtime.exceptionThrown") return true;
    if (event.method === "Network.loadingFailed") return !event.params?.canceled;
    return event.method === "Log.entryAdded" && event.params?.entry?.level === "error";
  });
  check("sin errores de consola ni red", errors.length === 0, JSON.stringify(errors));
} finally {
  await session
    .send("Target.closeTarget", { targetId: session.targetId })
    .catch(() => null);
  session.socket.close();
}

const failed = results.filter((result) => result.status === "fail");
console.log(
  JSON.stringify(
    {
      summary: {
        total: results.length,
        passed: results.length - failed.length,
        failed: failed.length,
      },
      failed,
    },
    null,
    2,
  ),
);
process.exitCode = failed.length ? 1 : 0;
