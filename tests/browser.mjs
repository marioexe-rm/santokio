import { products, SITE_CONFIG } from "../data/products.js";
import {
  AI_IMAGE_KIND,
  REAL_IMAGE_KIND,
  formatPrice,
  getAiImages,
  getCatalogueFacets,
  getModelImages,
  getOrderedImages,
  getProductMaterialNames,
  getVisibleCatalogueProducts,
  makeProductWhatsappUrl,
  makeWhatsappUrl,
} from "../data/site-content.js";

const CDP_ENDPOINT = process.env.CDP_ENDPOINT ?? "http://127.0.0.1:9222";
const SITE_URL =
  process.argv[2] ?? process.env.SITE_URL ?? "http://127.0.0.1:8000/";
const expectedProductCount = products.length;
const expectedDefaultProducts = getVisibleCatalogueProducts(products, {
  sort: "featured",
});
const expectedProductHrefs = expectedDefaultProducts.map(
  (product) => `#producto-${product.slug}`,
);
const catalogueFacets = getCatalogueFacets(products);
const expectedNameOrder = getVisibleCatalogueProducts(products, {
  sort: "name-asc",
});
const expectedPriceAscending = getVisibleCatalogueProducts(products, {
  sort: "price-asc",
});
const expectedPriceDescending = getVisibleCatalogueProducts(products, {
  sort: "price-desc",
});
const combinedFilterSelection = {
  query: "Falda",
  categories: ["Faldas"],
  materials: ["Algodón", "Seda"],
  sizes: ["S"],
  minPrice: 69990,
  maxPrice: 99990,
  sort: "price-asc",
};
const expectedCombinedFilter = getVisibleCatalogueProducts(
  products,
  combinedFilterSelection,
);
const removedInterfacePhrases = [
  "Abre una pieza para recorrer todas sus imágenes y revisar qué datos están confirmados antes de consultar.",
  "Respuestas prudentes para decidir qué conviene confirmar por WhatsApp.",
  "Una colección breve para observar cada pieza con calma.",
  "La conversación permite confirmar la información que todavía no puede resolverse desde una ficha estática.",
  "La presentación distingue evidencia documental, visualización referencial y datos todavía pendientes.",
];
const expectedHeroSlideCount = products.reduce(
  (total, product) => total + getAiImages(product).length,
  0,
);
const firstProduct = products[0];
const searchProduct = products[1] ?? firstProduct;
const firstProductImages = getOrderedImages(firstProduct);
const firstProductInitialImage = firstProductImages[0];
const firstProductNextImage = firstProductImages[1];
const firstProductModelImages = getModelImages(firstProduct);
const firstRealImageIndex = firstProductImages.findIndex(
  (image) => image.kind === REAL_IMAGE_KIND,
);
const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));
const results = [];

function stage(message) {
  console.error(`[browser] ${message}`);
}

function check(name, condition, details = "") {
  results.push({ name, status: condition ? "pass" : "fail", details });
}

function nextSlide(index, amount = 1) {
  return String((Number(index) + amount) % expectedHeroSlideCount);
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
      }, 30000);
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
    let response;
    try {
      response = await this.send("Runtime.evaluate", {
        expression,
        awaitPromise: true,
        returnByValue: true,
      });
    } catch (error) {
      const preview = expression.replace(/\s+/g, " ").slice(0, 180);
      throw new Error(`${error.message} Expresión: ${preview}`);
    }
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

async function load(session, width, height, suffix = "", hash = "") {
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
    url: `${SITE_URL}${suffix ? `?${suffix}` : ""}${
      hash ? `#${encodeURIComponent(hash)}` : ""
    }`,
  });
  await loaded;
  await session.send("Page.bringToFront");
  await session.send("Emulation.setFocusEmulationEnabled", { enabled: true });
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

async function moveMouse(session, point) {
  await session.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: point.x,
    y: point.y,
  });
}

async function clickPoint(session, point) {
  await moveMouse(session, point);
  await session.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: point.x,
    y: point.y,
    button: "left",
    buttons: 1,
    clickCount: 1,
  });
  await session.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: point.x,
    y: point.y,
    button: "left",
    buttons: 0,
    clickCount: 1,
  });
}

async function rapidClickPoint(session, point, presses = 10) {
  await moveMouse(session, point);
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

async function tapTouch(session, point) {
  const touchPoint = {
    x: Math.round(point.x),
    y: Math.round(point.y),
    id: 1,
    radiusX: 1,
    radiusY: 1,
    force: 1,
  };
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [touchPoint],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
}

async function pressControlSnapshot(session, point, selector) {
  const serializedSelector = JSON.stringify(selector);
  const readControl = `(() => {
    const control = document.querySelector(${serializedSelector});
    const rect = control.getBoundingClientRect();
    return {
      active: control.matches(":active"),
      background: getComputedStyle(control).backgroundColor,
      rect: [rect.left, rect.top, rect.width, rect.height],
    };
  })()`;
  const before = await session.evaluate(readControl);
  const pressPoint = {
    x: Math.round(point.x),
    y: Math.round(point.y),
    id: 1,
    radiusX: 1,
    radiusY: 1,
    force: 1,
  };

  await session.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: pressPoint.x,
    y: pressPoint.y,
  });
  await session.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: pressPoint.x,
    y: pressPoint.y,
    button: "left",
    buttons: 1,
    clickCount: 1,
  });

  try {
    await session.evaluate(
      "new Promise((resolve) => requestAnimationFrame(() => resolve()))",
    );
    return { before, during: await session.evaluate(readControl) };
  } finally {
    await session.send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x: pressPoint.x,
      y: pressPoint.y,
      button: "left",
      buttons: 0,
      clickCount: 1,
    });
  }
}

async function waitForValue(session, expression, predicate, timeout = 2500) {
  const deadline = Date.now() + timeout;
  let value;
  do {
    value = await session.evaluate(expression);
    if (predicate(value)) return value;
    await wait(16);
  } while (Date.now() < deadline);
  return value;
}

async function waitForStableScroll(
  session,
  { timeout = 2500, stableSamples = 6, interval = 50 } = {},
) {
  const deadline = Date.now() + timeout;
  let previous = await session.evaluate("window.scrollY");
  let stable = 0;

  while (Date.now() < deadline) {
    await wait(interval);
    const current = await session.evaluate("window.scrollY");
    stable = Math.abs(current - previous) <= 0.5 ? stable + 1 : 0;
    previous = current;
    if (stable >= stableSamples) {
      return current;
    }
  }

  return previous;
}

async function waitForGallerySnapshot(session, expectedPosition) {
  return waitForValue(
    session,
    `(() => {
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
    })()`,
    (snapshot) => snapshot.position === expectedPosition && !snapshot.updating,
  );
}

async function layoutSnapshot(session) {
  return session.evaluate(`(() => {
    const productList = document.querySelector("[data-product-list]");
    const cards = [...document.querySelectorAll("[data-product-entry]")];
    const columns = getComputedStyle(productList).gridTemplateColumns
      .split(" ").filter(Boolean);
    return {
      viewport: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      columns: columns.length,
      gap: parseFloat(getComputedStyle(productList).columnGap),
      listBackground: getComputedStyle(productList).backgroundColor,
      products: cards.length,
      visualWidths: cards.map((card) =>
        card.querySelector(".product-visual").getBoundingClientRect().width
      ),
      uniformBackground: cards.every((card) =>
        getComputedStyle(card).backgroundColor === "rgb(251, 250, 247)"
      ),
      cardBorders: cards.map((card) => {
        const style = getComputedStyle(card);
        return [style.borderTopWidth, style.borderRightWidth,
          style.borderBottomWidth, style.borderLeftWidth];
      }),
    };
  })()`);
}

const session = await connect();

try {
  stage("desktop 1440: estructura, tarjetas y navbar");
  await load(session, 1440, 900, `browser-desktop=${Date.now()}`);

  const desktop = await session.evaluate(`(() => {
    const header = document.querySelector("[data-header]");
    const wordmark = header.querySelector(".wordmark");
    const searchForm = header.querySelector("[data-search-form]");
    const navigation = header.querySelector("[data-navigation]");
    const actions = header.querySelector(".header-actions");
    const instagram = header.querySelector("[data-instagram]");
    const whatsapp = header.querySelector("[data-collection-whatsapp]");
    const wordmarkRect = wordmark.getBoundingClientRect();
    const searchRect = searchForm.getBoundingClientRect();
    const navigationRect = navigation.getBoundingClientRect();
    const actionsRect = actions.getBoundingClientRect();
    const whatsappRect = whatsapp.getBoundingClientRect();
    const faqLink = navigation.querySelector('a[href="#preguntas"]');
    const socialSnapshot = (node) => {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return {
        width: rect.width,
        height: rect.height,
        border: style.border,
        background: style.backgroundColor,
        color: style.color,
      };
    };
    const toolChildren = [...document.querySelector("[data-catalogue-tools]").children];
    const toolsRect = document.querySelector("[data-catalogue-tools]")
      .getBoundingClientRect();
    const statusRect = document.querySelector("[data-results-status]")
      .getBoundingClientRect();
    const sortRect = document.querySelector(".sort-field").getBoundingClientRect();
    const sortStyle = getComputedStyle(document.querySelector(".sort-field"));
    const sortControlRect = document.querySelector("[data-sort]")
      .getBoundingClientRect();
    const listRect = document.querySelector("[data-product-list]")
      .getBoundingClientRect();
    return {
      lang: document.documentElement.lang,
      h1: document.querySelectorAll("h1").length,
      canonicalCount: document.querySelectorAll('link[rel="canonical"]').length,
      canonicalHref: document.querySelector('link[rel="canonical"]')?.href,
      documentWidth: document.documentElement.scrollWidth,
      viewport: innerWidth,
      initialScrollY: window.scrollY,
      headerBackground: getComputedStyle(header).backgroundColor,
      headerText: header.innerText,
      headerOrder:
        wordmark.nextElementSibling === searchForm &&
        searchForm.nextElementSibling === navigation &&
        navigation.nextElementSibling === actions,
      headerGeometry:
        wordmarkRect.right <= searchRect.left &&
        searchRect.right <= navigationRect.left &&
        navigationRect.right <= actionsRect.left,
      outerMargins: [wordmarkRect.left, innerWidth - actionsRect.right],
      blockGaps: [
        searchRect.left - wordmarkRect.right,
        navigationRect.left - searchRect.right,
        actionsRect.left - navigationRect.right,
      ],
      desktopFaqText: faqLink.innerText.trim(),
      desktopFaqLinkCount: navigation.querySelectorAll('a[href="#preguntas"]').length,
      searchVisible: getComputedStyle(document.querySelector("[data-search-panel]")).visibility === "visible",
      searchToggleHidden: getComputedStyle(document.querySelector("[data-search-toggle]")).display === "none",
      searchPlaceholder: document.querySelector("[data-search]").placeholder,
      searchIds: document.querySelectorAll("#catalogue-search").length,
      instagram: socialSnapshot(instagram),
      whatsapp: socialSnapshot(whatsapp),
      whatsappHref: whatsapp.href,
      menuHidden: getComputedStyle(document.querySelector("[data-menu-toggle]")).display === "none",
      toolsHaveSearch: Boolean(document.querySelector("[data-catalogue-tools] [data-search]")),
      toolOrder: toolChildren.map((node) => node.className),
      toolPositions: toolChildren.map((node) => {
        const rect = node.getBoundingClientRect();
        return {
          className: node.className,
          hidden: node.hidden,
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
        };
      }),
      toolsRect: { left: toolsRect.left, right: toolsRect.right },
      toolsPaddingBottom: parseFloat(
        getComputedStyle(document.querySelector("[data-catalogue-tools]")).paddingBottom
      ),
      whatsappRect: { left: whatsappRect.left, right: whatsappRect.right },
      statusRect: {
        left: statusRect.left, right: statusRect.right,
        top: statusRect.top, bottom: statusRect.bottom,
      },
      sortRect: {
        left: sortRect.left, right: sortRect.right,
        top: sortRect.top, bottom: sortRect.bottom, width: sortRect.width,
        maxWidth: sortStyle.maxWidth,
        flexBasis: sortStyle.flexBasis,
      },
      sortControlRect: {
        left: sortControlRect.left, right: sortControlRect.right,
        top: sortControlRect.top, bottom: sortControlRect.bottom,
      },
      listRect: { left: listRect.left, right: listRect.right },
      emptyAction: (() => {
        const action = document.querySelector("[data-empty-clear]");
        const primary = document.querySelector(".button-primary");
        const actionStyle = getComputedStyle(action);
        const primaryStyle = getComputedStyle(primary);
        return {
          primaryClass: action.classList.contains("button-primary"),
          background: actionStyle.backgroundColor,
          primaryBackground: primaryStyle.backgroundColor,
          color: actionStyle.color,
        };
      })(),
      heroControls: document.querySelectorAll(".hero-controls").length,
      inlineDetails: document.querySelectorAll(".product-inline-details").length,
      productIcons: document.querySelectorAll(".product-open-icon").length,
      responsiveImages: [...document.images].every((image) =>
        image.hasAttribute("width") && image.hasAttribute("height") &&
        image.hasAttribute("srcset") && image.hasAttribute("sizes")
      ),
      structuredDataValid: (() => {
        try {
          JSON.parse(document.querySelector("[data-structured-data]").textContent);
          return true;
        } catch {
          return false;
        }
      })(),
      heroCurrentSrc: document.querySelector("[data-hero-primary] img")?.currentSrc,
    };
  })()`);

  const expectedCollectionWhatsapp = makeWhatsappUrl(
    SITE_CONFIG.collectionWhatsappMessage,
  );
  check(
    "idioma, H1, canonical y JSON-LD permanecen correctos",
    desktop.lang === "es-CL" && desktop.h1 === 1 &&
      desktop.canonicalCount === 1 &&
      desktop.canonicalHref === "https://santokyo.com/" &&
      desktop.structuredDataValid && desktop.initialScrollY === 0,
    JSON.stringify(desktop),
  );
  check(
    "navbar desktop ordena wordmark, buscador, navegación y acciones sin solaparse",
    desktop.headerOrder && desktop.headerGeometry && desktop.searchVisible &&
      desktop.searchToggleHidden && desktop.menuHidden &&
      desktop.headerBackground === "rgb(251, 250, 247)" &&
      desktop.searchPlaceholder === "Ej. Falda Verde o STK-001" &&
      desktop.searchIds === 1 && desktop.desktopFaqText === "FAQ" &&
      desktop.desktopFaqLinkCount === 1,
    JSON.stringify(desktop),
  );
  check(
    "navbar elimina Ver colección y muestra WhatsApp con el estilo de Instagram",
    !/Ver colección/i.test(desktop.headerText) &&
      JSON.stringify(desktop.instagram) === JSON.stringify(desktop.whatsapp) &&
      desktop.whatsappHref === expectedCollectionWhatsapp,
    JSON.stringify(desktop),
  );
  check(
    "navbar equilibra los cuatro bloques y conserva márgenes exteriores simétricos",
    Math.abs(desktop.outerMargins[0] - desktop.outerMargins[1]) <= 1 &&
      Math.max(...desktop.blockGaps) - Math.min(...desktop.blockGaps) <= 1,
    JSON.stringify({
      outerMargins: desktop.outerMargins,
      blockGaps: desktop.blockGaps,
    }),
  );
  check(
    "toolbar alinea Filtrar a la izquierda y Ordenar con WhatsApp a la derecha",
    !desktop.toolsHaveSearch &&
      desktop.toolOrder.length === 3 &&
      desktop.toolOrder[0].includes("filter-toggle") &&
      desktop.toolOrder[1].includes("clear-button") &&
      desktop.toolOrder[2].includes("sort-field") &&
      desktop.toolPositions[1].hidden &&
      Math.abs(desktop.toolPositions[0].left - desktop.toolsRect.left) <= 1 &&
      Math.abs(desktop.sortRect.right - desktop.whatsappRect.right) <= 1 &&
      Math.abs(desktop.sortControlRect.right - desktop.whatsappRect.right) <= 1 &&
      desktop.sortRect.width <= 320.5 && desktop.sortRect.maxWidth === "320px" &&
      desktop.sortRect.flexBasis === "320px" &&
      Math.abs(
        (desktop.toolPositions[0].top + desktop.toolPositions[0].bottom) / 2 -
        (desktop.sortRect.top + desktop.sortRect.bottom) / 2
      ) <= 1 &&
      Math.abs(desktop.statusRect.left - desktop.listRect.left) <= 1 &&
      Math.abs(desktop.sortRect.right - desktop.listRect.right) <= 1,
    JSON.stringify(desktop),
  );
  check(
    "Ver todas las piezas reutiliza el tratamiento azul primario",
    desktop.emptyAction.primaryClass &&
      desktop.emptyAction.background === desktop.emptyAction.primaryBackground &&
      desktop.emptyAction.background === "rgb(48, 76, 137)" &&
      desktop.emptyAction.color === "rgb(255, 255, 255)",
    JSON.stringify(desktop.emptyAction),
  );
  check(
    "componentes de tarjeta eliminados no reaparecen",
    desktop.heroControls === 0 && desktop.inlineDetails === 0 &&
      desktop.productIcons === 0,
    JSON.stringify(desktop),
  );
  check(
    "imágenes siguen dimensionadas y LCP usa WebP",
    desktop.responsiveImages && /\.webp$/.test(desktop.heroCurrentSrc),
    desktop.heroCurrentSrc,
  );

  const desktopLayout = await layoutSnapshot(session);
  check(
    "catálogo desktop usa cuatro columnas iguales con gap de 5 px",
    desktopLayout.products === expectedProductCount &&
      desktopLayout.columns === 4 && desktopLayout.gap >= 4 &&
      desktopLayout.gap <= 5 &&
      Math.max(...desktopLayout.visualWidths) -
        Math.min(...desktopLayout.visualWidths) <= 1,
    JSON.stringify(desktopLayout),
  );
  check(
    "catálogo tiene fondo uniforme, sin bordes ni overflow",
    desktopLayout.uniformBackground &&
      desktopLayout.listBackground === "rgb(251, 250, 247)" &&
      desktopLayout.cardBorders.flat().every((width) => width === "0px") &&
      desktopLayout.documentWidth === desktopLayout.viewport,
    JSON.stringify(desktopLayout),
  );

  const sectionPresentation = await session.evaluate(`(() => {
    const catalogue = document.querySelector(".catalogue");
    const faq = document.querySelector(".faq");
    const tools = document.querySelector("[data-catalogue-tools]");
    const sortField = document.querySelector(".sort-field");
    const sortLabel = sortField.querySelector("label").getBoundingClientRect();
    const sortSelect = sortField.querySelector("select").getBoundingClientRect();
    const concept = document.querySelector("#concepto");
    const conceptEvidence = document.querySelector(".concept-evidence");
    const sectionBorders = [
      ".hero", ".catalogue", ".buying-process", ".editorial-intro",
      ".faq", ".contact-band"
    ].map((selector) => {
      const style = getComputedStyle(document.querySelector(selector));
      return [style.borderTopWidth, style.borderBottomWidth];
    });
    const toolsStyle = getComputedStyle(tools);
    return {
      catalogueBackground: getComputedStyle(catalogue).backgroundColor,
      cataloguePadding: [
        getComputedStyle(catalogue).paddingTop,
        getComputedStyle(catalogue).paddingBottom,
      ],
      conceptPadding: [
        getComputedStyle(concept).paddingTop,
        getComputedStyle(concept).paddingBottom,
      ],
      faqBackground: getComputedStyle(faq).backgroundColor,
      sectionBorders,
      toolBorders: [toolsStyle.borderTopWidth, toolsStyle.borderBottomWidth],
      evidenceInsideConcept: conceptEvidence?.closest("#concepto") === concept,
      independentEvidenceSections: document.querySelectorAll("section.evidence").length,
      evidenceBackground: conceptEvidence
        ? getComputedStyle(conceptEvidence).backgroundColor : null,
      conceptBackground: getComputedStyle(concept).backgroundColor,
      sectionHeadingMargins: [...document.querySelectorAll(".section-heading")]
        .map((heading) => getComputedStyle(heading).marginBottom),
      sortHorizontal: sortLabel.right <= sortSelect.left + 0.5 &&
        Math.abs(
          (sortLabel.top + sortLabel.bottom) / 2 -
          (sortSelect.top + sortSelect.bottom) / 2
        ) <= 1,
      visibleText: document.body.innerText,
    };
  })()`);
  check(
    "catálogo y FAQ usan chalk-bright sin divisores estructurales",
    sectionPresentation.catalogueBackground === "rgb(251, 250, 247)" &&
      sectionPresentation.cataloguePadding.every((value) => value === "128px") &&
      sectionPresentation.conceptPadding.every((value) => value === "128px") &&
      sectionPresentation.faqBackground === "rgb(251, 250, 247)" &&
      sectionPresentation.sectionBorders.flat().every((width) => width === "0px") &&
      sectionPresentation.toolBorders.every((width) => width === "0px"),
    JSON.stringify(sectionPresentation),
  );
  check(
    "evidence está integrado semántica y visualmente dentro de Concepto",
    sectionPresentation.evidenceInsideConcept &&
      sectionPresentation.independentEvidenceSections === 0 &&
      sectionPresentation.evidenceBackground === sectionPresentation.conceptBackground,
    JSON.stringify(sectionPresentation),
  );
  check(
    "Ordenar mantiene label y selector en una fila sin textos retirados",
    sectionPresentation.sortHorizontal &&
      sectionPresentation.sectionHeadingMargins.length > 0 &&
      sectionPresentation.sectionHeadingMargins.every(
        (margin) => margin === "30px"
      ) &&
      removedInterfacePhrases.every(
        (phrase) => !sectionPresentation.visibleText.includes(phrase),
      ),
    JSON.stringify({
      sortHorizontal: sectionPresentation.sortHorizontal,
      sectionHeadingMargins: sectionPresentation.sectionHeadingMargins,
    }),
  );

  const sortPointerSelection = await session.evaluate(`(() => {
    const select = document.querySelector("[data-sort]");
    select.scrollIntoView({ block: "center", behavior: "instant" });
    select.dispatchEvent(new PointerEvent("pointerdown", {
      bubbles: true,
      isPrimary: true,
      pointerType: "mouse",
    }));
    select.focus({ preventScroll: true });
    const geometries = [];
    for (const value of ["name-asc", "price-asc", "price-desc", "featured"]) {
      select.value = value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      const rect = select.getBoundingClientRect();
      geometries.push([rect.width, rect.height]);
    }
    const style = getComputedStyle(select);
    return {
      focused: document.activeElement === select,
      pointerClass: select.classList.contains("is-pointer-focused"),
      outlineStyle: style.outlineStyle,
      outlineColor: style.outlineColor,
      outlineWidth: style.outlineWidth,
      boxShadow: style.boxShadow,
      geometries,
    };
  })()`);
  check(
    "Ordenar no conserva marco por mouse y mantiene geometría entre opciones",
    sortPointerSelection.focused && sortPointerSelection.pointerClass &&
      (sortPointerSelection.outlineStyle === "none" ||
        sortPointerSelection.outlineWidth === "0px" ||
        sortPointerSelection.outlineColor === "rgba(0, 0, 0, 0)") &&
      sortPointerSelection.boxShadow === "none" &&
      sortPointerSelection.geometries.every(
        (geometry) => geometry.join() === sortPointerSelection.geometries[0].join()
      ),
    JSON.stringify(sortPointerSelection),
  );
  await pressKey(session, "ArrowDown", "ArrowDown", 40);
  const sortKeyboardFocus = await session.evaluate(`(() => {
    const select = document.querySelector("[data-sort]");
    const style = getComputedStyle(select);
    return {
      focused: document.activeElement === select,
      focusVisible: select.matches(":focus-visible"),
      pointerClass: select.classList.contains("is-pointer-focused"),
      outlineStyle: style.outlineStyle,
      outlineColor: style.outlineColor,
      outlineWidth: style.outlineWidth,
      boxShadow: style.boxShadow,
    };
  })()`);
  check(
    "Ordenar conserva un foco visible al pasar a interacción de teclado",
    sortKeyboardFocus.focused && sortKeyboardFocus.focusVisible &&
      !sortKeyboardFocus.pointerClass &&
      sortKeyboardFocus.outlineStyle !== "none" &&
      sortKeyboardFocus.outlineWidth !== "0px" &&
      sortKeyboardFocus.outlineColor !== "rgba(0, 0, 0, 0)" &&
      sortKeyboardFocus.boxShadow !== "none",
    JSON.stringify(sortKeyboardFocus),
  );
  await pressKey(session, "Escape", "Escape", 27);

  const anchorGaps = {};
  for (const sectionId of [
    "coleccion",
    "como-comprar",
    "concepto",
    "preguntas",
    "contacto",
  ]) {
    await session.evaluate(`document.querySelector(
      '[data-navigation] a[href="#${sectionId}"]'
    ).click()`);
    anchorGaps[sectionId] = await waitForValue(
      session,
      `(() => {
        const section = document.getElementById(${JSON.stringify(sectionId)});
        const heading = section.querySelector("h1, h2") || section;
        const header = document.querySelector("[data-header]")
          .getBoundingClientRect();
        const root = getComputedStyle(document.documentElement);
        const raw = root.getPropertyValue("--anchor-title-gap").trim();
        const value = parseFloat(raw);
        const expected = raw.endsWith("rem")
          ? value * parseFloat(root.fontSize) : value;
        return {
          gap: heading.getBoundingClientRect().top - header.bottom,
          expected,
          hash: location.hash,
        };
      })()`,
      (snapshot) =>
        snapshot.hash === `#${sectionId}` &&
        Math.abs(snapshot.gap - snapshot.expected) <= 0.5,
    );
  }
  check(
    "las anclas principales comparten el mismo espacio bajo el navbar",
    Object.values(anchorGaps).every(
      (snapshot) => Math.abs(snapshot.gap - snapshot.expected) <= 0.5,
    ) &&
      Math.max(...Object.values(anchorGaps).map(({ gap }) => gap)) -
        Math.min(...Object.values(anchorGaps).map(({ gap }) => gap)) <= 1,
    JSON.stringify(anchorGaps),
  );

  const faqPoint = await session.evaluate(`(async () => {
    const summary = document.querySelector(".faq summary");
    summary.scrollIntoView({ block: "center", behavior: "instant" });
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const rect = summary.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })()`);
  await moveMouse(session, { x: 2, y: 2 });
  const faqRestClosed = await session.evaluate(`(() => {
    const summary = document.querySelector(".faq summary");
    const style = getComputedStyle(summary);
    const symbol = getComputedStyle(summary, "::after");
    return {
      weight: Number(style.fontWeight),
      color: style.color,
      symbolColor: symbol.color,
      symbolSize: parseFloat(symbol.fontSize),
    };
  })()`);
  await moveMouse(session, faqPoint);
  const faqHover = await waitForValue(
    session,
    `(() => {
      const summary = document.querySelector(".faq summary");
      return {
        questionWeight: Number(getComputedStyle(summary).fontWeight),
        symbolWeight: Number(getComputedStyle(summary, "::after").fontWeight),
        color: getComputedStyle(summary).color,
        symbolColor: getComputedStyle(summary, "::after").color,
        symbolSize: parseFloat(getComputedStyle(summary, "::after").fontSize),
        symbol: getComputedStyle(summary, "::after").content,
        width: summary.getBoundingClientRect().width,
      };
    })()`,
    (snapshot) => snapshot.questionWeight === 540 && snapshot.symbolWeight === 540,
  );
  await moveMouse(session, { x: 2, y: 2 });
  const faqRestAfterHover = await waitForValue(
    session,
    `(() => {
      const summary = document.querySelector(".faq summary");
      const style = getComputedStyle(summary);
      const symbol = getComputedStyle(summary, "::after");
      return {
        weight: Number(style.fontWeight),
        color: style.color,
        symbolColor: symbol.color,
        symbolSize: parseFloat(symbol.fontSize),
      };
    })()`,
    (snapshot) => snapshot.weight === 400,
  );
  await pressKey(session, "Tab", "Tab", 9);
  const faqFocus = await session.evaluate(`(() => {
    const summary = document.querySelector(".faq summary");
    const widthBefore = summary.getBoundingClientRect().width;
    summary.focus();
    const plus = {
      questionWeight: Number(getComputedStyle(summary).fontWeight),
      symbolWeight: Number(getComputedStyle(summary, "::after").fontWeight),
      color: getComputedStyle(summary).color,
      symbolColor: getComputedStyle(summary, "::after").color,
      symbolSize: parseFloat(getComputedStyle(summary, "::after").fontSize),
      symbol: getComputedStyle(summary, "::after").content,
    };
    summary.click();
    const minus = getComputedStyle(summary, "::after").content;
    const animationDuration = summary.closest("details")
      .querySelector(".faq-answer").getAnimations()[0]?.effect.getTiming().duration ?? 0;
    const widthAfter = summary.getBoundingClientRect().width;
    summary.blur();
    return { plus, minus, widthBefore, widthAfter, animationDuration };
  })()`);
  check(
    "FAQ aplica peso 540, azul y símbolo doble solo en hover o foco",
    faqRestClosed.weight === 400 && faqHover.questionWeight === 540 &&
      faqHover.symbolWeight === 540 && faqHover.color === "rgb(48, 76, 137)" &&
      faqHover.symbolColor === "rgb(48, 76, 137)" &&
      faqHover.symbolSize >= faqRestClosed.symbolSize * 1.9 &&
      faqHover.symbol.includes("+") &&
      faqRestAfterHover.weight === 400 &&
      faqRestAfterHover.color === faqRestClosed.color &&
      faqRestAfterHover.symbolColor === faqRestClosed.symbolColor &&
      faqFocus.plus.questionWeight === 540 && faqFocus.plus.symbolWeight === 540 &&
      faqFocus.plus.symbolSize >= faqRestClosed.symbolSize * 1.9 &&
      faqFocus.plus.symbol.includes("+") && faqFocus.minus.includes("−") &&
      Math.abs(faqFocus.widthBefore - faqFocus.widthAfter) <= 0.5,
    JSON.stringify({ faqRestClosed, faqHover, faqRestAfterHover, faqFocus }),
  );

  const faqOpenRest = await waitForValue(session, `(() => {
    const details = document.querySelector(".faq details");
    const summary = details.querySelector("summary");
    return {
      open: details.open,
      weight: Number(getComputedStyle(summary).fontWeight),
      color: getComputedStyle(summary).color,
      symbolColor: getComputedStyle(summary, "::after").color,
      symbol: getComputedStyle(summary, "::after").content,
    };
  })()`, (snapshot) => snapshot.open && snapshot.weight === 400);
  check(
    "FAQ abierta en reposo no conserva peso ni azul de interacción",
    faqOpenRest.open && faqOpenRest.weight === 400 &&
      faqOpenRest.color === faqRestClosed.color &&
      faqOpenRest.symbolColor === faqRestClosed.symbolColor &&
      faqOpenRest.symbol.includes("−"),
    JSON.stringify(faqOpenRest),
  );

  const faqExclusive = await session.evaluate(`(() => {
    const details = [...document.querySelectorAll(".faq details")];
    details[1].querySelector("summary").click();
    return {
      open: details.map((item) => item.open),
      expanded: details.map((item) =>
        item.querySelector("summary").getAttribute("aria-expanded")
      ),
      focused: document.activeElement === details[1].querySelector("summary"),
    };
  })()`);
  await session.evaluate(
    'document.querySelectorAll(".faq summary")[1].click()',
  );
  const faqAllClosed = await waitForValue(
    session,
    'document.querySelectorAll(".faq details[open]").length',
    (count) => count === 0,
  );
  check(
    "FAQ mantiene un único elemento abierto y permite cerrarlos todos",
    faqExclusive.open.filter(Boolean).length === 1 &&
      faqExclusive.open[1] && !faqExclusive.open[0] &&
      faqExclusive.expanded[1] === "true" &&
      faqExclusive.expanded[0] === "false" && faqAllClosed === 0,
    JSON.stringify({ faqExclusive, faqAllClosed }),
  );

  const cards = await session.evaluate(`(() =>
    [...document.querySelectorAll("[data-product-entry]")].map((card) => {
      const visual = card.querySelector(".catalogue-product-visual");
      const frame = visual.querySelector("[data-product-image-frame]");
      const image = visual.querySelector("[data-card-image]");
      const label = visual.querySelector(".image-kind-label");
      const frameRect = frame.getBoundingClientRect();
      const labelRect = label.getBoundingClientRect();
      return {
        id: card.dataset.productEntry,
        href: visual.getAttribute("href"),
        anchors: card.querySelectorAll("a").length,
        buttons: card.querySelectorAll("button").length,
        images: card.querySelectorAll("img").length,
        headings: card.querySelectorAll("h3").length,
        prices: card.querySelectorAll(".product-card-price").length,
        summaries: card.querySelectorAll(".product-summary").length,
        forbidden: card.querySelectorAll(
          ".product-meta, .product-actions, .product-inline-details, .product-open-icon"
        ).length,
        nestedInteractive: Boolean(visual.querySelector("a, button, input, select")),
        detailText: visual.querySelector(".catalogue-product-detail-label")?.textContent.trim(),
        primaryKind: visual.dataset.cardPrimaryKind,
        activeKind: visual.dataset.cardActiveKind,
        labelVisible: !label.hidden && getComputedStyle(label).display !== "none",
        labelInside: label.hidden || (
          labelRect.left >= frameRect.left - 0.5 &&
          labelRect.top >= frameRect.top - 0.5 &&
          labelRect.right <= frameRect.right + 0.5 &&
          labelRect.bottom <= frameRect.bottom + 0.5
        ),
        imageNotDraggable: !image.draggable,
        userSelect: getComputedStyle(visual).userSelect,
        visibleSummary: card.querySelector(".product-summary").innerText.trim(),
      };
    })
  )()`);
  check(
    "tarjetas contienen un único enlace visual, imagen, nombre y precio",
    cards.every((card, index) =>
      card.anchors === 1 && card.buttons === 0 && card.images === 1 &&
      card.headings === 1 && card.prices === 1 && card.summaries === 1 &&
      card.forbidden === 0 && !card.nestedInteractive &&
      card.detailText === "Ver detalle" &&
      card.visibleSummary.replace(/\s+/g, " ") ===
        `${expectedDefaultProducts[index].name} ${formatPrice(expectedDefaultProducts[index])}`
    ),
    JSON.stringify(cards),
  );
  check(
    "enlaces estables y overlays IA se anclan dentro de la imagen",
    cards.map((card) => card.href).join("\n") ===
      expectedProductHrefs.join("\n") &&
      cards.every((card) =>
        card.labelInside && card.imageNotDraggable &&
        card.userSelect === "none" &&
        card.labelVisible === (card.activeKind === AI_IMAGE_KIND)
      ),
    JSON.stringify(cards),
  );

  stage("desktop 1440: hover y foco del catálogo");
  const hoverTarget = await session.evaluate(`(async () => {
    const visual = document.querySelector(
      '[data-product-entry=${JSON.stringify(firstProduct.id)}] .catalogue-product-visual'
    );
    visual.scrollIntoView({ block: "center", behavior: "instant" });
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const rect = visual.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })()`);
  await moveMouse(session, hoverTarget);
  const secondarySource = firstProductModelImages[1]?.src;
  const hover = await waitForValue(
    session,
    `(() => {
      const visual = document.querySelector(
        '[data-product-entry=${JSON.stringify(firstProduct.id)}] .catalogue-product-visual'
      );
      const image = visual.querySelector("[data-card-image]");
      const label = visual.querySelector(".image-kind-label");
      return {
        src: image.getAttribute("src"),
        activeKind: visual.dataset.cardActiveKind,
        labelVisible: !label.hidden && getComputedStyle(label).display !== "none",
        overlayOpacity: parseFloat(getComputedStyle(
          visual.querySelector(".catalogue-product-detail-label")
        ).opacity),
        overlayTransform: getComputedStyle(
          visual.querySelector(".catalogue-product-detail-label")
        ).transform,
        overlayBackground: getComputedStyle(
          visual.querySelector(".catalogue-product-detail-label")
        ).backgroundColor,
      };
    })()`,
    (snapshot) =>
      (!secondarySource || snapshot.src === secondarySource) &&
      snapshot.overlayOpacity === 1,
  );
  check(
    "hover carga la segunda imagen de modelo y muestra Ver detalle",
    (!secondarySource || hover.src === secondarySource) &&
      hover.activeKind === (firstProductModelImages[1] ?? firstProductModelImages[0]).kind &&
      hover.labelVisible ===
        ((firstProductModelImages[1] ?? firstProductModelImages[0]).kind === AI_IMAGE_KIND) &&
      hover.overlayOpacity === 1 && hover.overlayTransform !== "none" &&
      hover.overlayBackground === "rgba(23, 24, 26, 0.74)",
    JSON.stringify({ secondarySource, hover }),
  );
  await moveMouse(session, { x: 2, y: 2 });
  const restoredHover = await waitForValue(
    session,
    `(() => {
      const visual = document.querySelector(
        '[data-product-entry=${JSON.stringify(firstProduct.id)}] .catalogue-product-visual'
      );
      return {
        src: visual.querySelector("[data-card-image]").getAttribute("src"),
        activeKind: visual.dataset.cardActiveKind
      };
    })()`,
    (snapshot) => snapshot.src === firstProductModelImages[0].src,
  );
  check(
    "al terminar hover vuelve a la primera imagen sin estado residual",
    restoredHover.src === firstProductModelImages[0].src &&
      restoredHover.activeKind === firstProductModelImages[0].kind,
    JSON.stringify(restoredHover),
  );

  await pressKey(session, "Tab", "Tab", 9);
  await session.evaluate(`document.querySelector(
    '[data-product-entry=${JSON.stringify(firstProduct.id)}] .catalogue-product-visual'
  ).focus()`);
  const focusOverlay = await waitForValue(session, `(() => {
    const visual = document.querySelector(
      '[data-product-entry=${JSON.stringify(firstProduct.id)}] .catalogue-product-visual'
    );
    const label = visual.querySelector(".catalogue-product-detail-label");
    return {
      focused: document.activeElement === visual,
      opacity: parseFloat(getComputedStyle(label).opacity),
      outline: getComputedStyle(visual).outlineStyle,
      transform: getComputedStyle(label).transform,
      background: getComputedStyle(label).backgroundColor,
    };
  })()`, (snapshot) => snapshot.opacity === 1);
  check(
    "foco de teclado muestra Ver detalle y conserva foco visible",
    focusOverlay.focused && focusOverlay.opacity === 1 &&
      focusOverlay.outline !== "none" && focusOverlay.transform !== "none" &&
      focusOverlay.background === "rgba(23, 24, 26, 0.74)",
    JSON.stringify(focusOverlay),
  );
  await session.evaluate("document.activeElement.blur()");

  await session.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  const reducedOverlay = await session.evaluate(`(() => {
    const label = document.querySelector(".catalogue-product-detail-label");
    return {
      matches: matchMedia("(prefers-reduced-motion: reduce)").matches,
      transitionDuration: getComputedStyle(label).transitionDuration,
    };
  })()`);
  check(
    "efecto Ver detalle respeta prefers-reduced-motion",
    reducedOverlay.matches && reducedOverlay.transitionDuration === "0s",
    JSON.stringify(reducedOverlay),
  );
  await session.send("Emulation.setEmulatedMedia", { features: [] });

  stage("desktop 1440: rotación y búsqueda");
  const heroInitial = await session.evaluate(
    'document.querySelector("[data-hero-primary] [data-hero-slide]")?.dataset.heroSlide',
  );
  await wait(4200);
  const heroCycleOne = await session.evaluate(
    'document.querySelector("[data-hero-primary] [data-hero-slide]")?.dataset.heroSlide',
  );
  await session.evaluate(`(() => {
    window.dispatchEvent(new Event("resize"));
    document.dispatchEvent(new Event("visibilitychange"));
    document.dispatchEvent(new Event("visibilitychange"));
  })()`);
  await wait(4200);
  const heroCycleTwo = await session.evaluate(
    'document.querySelector("[data-hero-primary] [data-hero-slide]")?.dataset.heroSlide',
  );
  check(
    "hero avanza automáticamente varios ciclos sin temporizadores duplicados",
    heroCycleOne === nextSlide(heroInitial) &&
      heroCycleTwo === nextSlide(heroCycleOne),
    JSON.stringify({ heroInitial, heroCycleOne, heroCycleTwo }),
  );

  const searchByReference = await session.evaluate(`(() => {
    const input = document.querySelector("[data-search]");
    input.value = ${JSON.stringify(searchProduct.id)};
    input.dispatchEvent(new Event("input", { bubbles: true }));
    const hero = document.querySelector(".hero");
    return {
      ids: [...document.querySelectorAll("[data-product-entry]")]
        .map((entry) => entry.dataset.productEntry),
      heroHidden: hero.classList.contains("is-search-hidden"),
      heroInert: hero.inert,
      heroAriaHidden: hero.getAttribute("aria-hidden"),
      slide: document.querySelector("[data-hero-primary] [data-hero-slide]")?.dataset.heroSlide,
    };
  })()`);
  const collapsedHero = await waitForValue(session, `(() => {
    const hero = document.querySelector(".hero");
    const header = document.querySelector("[data-header]").getBoundingClientRect();
    const catalogue = document.querySelector(".catalogue").getBoundingClientRect();
    const heading = document.querySelector("#catalogue-title").getBoundingClientRect();
    const root = getComputedStyle(document.documentElement);
    const rawGap = root.getPropertyValue("--anchor-title-gap").trim();
    const value = parseFloat(rawGap);
    const expectedGap = rawGap.endsWith("rem")
      ? value * parseFloat(root.fontSize) : value;
    const style = getComputedStyle(hero);
    return {
      height: hero.getBoundingClientRect().height,
      maxHeight: style.maxHeight,
      opacity: style.opacity,
      catalogueTop: catalogue.top,
      catalogueDocumentTop: catalogue.top + scrollY,
      headerBottom: header.bottom,
      headerHeight: header.height,
      headingGap: heading.top - header.bottom,
      expectedGap,
      scrollY,
    };
  })()`, (snapshot) =>
    snapshot.height <= 1 &&
    Math.abs(snapshot.headingGap - snapshot.expectedGap) <= 1.5
  );
  check(
    "búsqueda por referencia filtra y colapsa el hero sin espacio residual",
    searchByReference.ids.join() === searchProduct.id &&
      searchByReference.heroHidden && searchByReference.heroInert &&
      searchByReference.heroAriaHidden === "true" &&
      collapsedHero.height <= 1 &&
      collapsedHero.catalogueDocumentTop >= collapsedHero.headerHeight - 1 &&
      Math.abs(collapsedHero.headingGap - collapsedHero.expectedGap) <= 1.5,
    JSON.stringify({ searchByReference, collapsedHero }),
  );
  await wait(4200);
  const slideWhileSearch = await session.evaluate(
    'document.querySelector("[data-hero-primary] [data-hero-slide]")?.dataset.heroSlide',
  );
  check(
    "hero permanece pausado mientras una búsqueda válida lo oculta",
    slideWhileSearch === searchByReference.slide,
    JSON.stringify({ searchByReference, slideWhileSearch }),
  );

  const searchByName = await session.evaluate(`(() => {
    const input = document.querySelector("[data-search]");
    input.value = ${JSON.stringify(searchProduct.name)};
    input.dispatchEvent(new Event("input", { bubbles: true }));
    return [...document.querySelectorAll("[data-product-entry]")]
      .map((entry) => entry.dataset.productEntry);
  })()`);
  check(
    "el mismo buscador encuentra por nombre",
    searchByName.join() === searchProduct.id,
    JSON.stringify(searchByName),
  );

  const noResults = await session.evaluate(`(() => {
    const input = document.querySelector("[data-search]");
    input.value = "consulta-sin-coincidencias-xyz";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    return {
      heroHidden: document.querySelector(".hero").classList.contains("is-search-hidden"),
      emptyVisible: !document.querySelector("[data-empty-state]").hidden,
      emptyTitle: document.querySelector("[data-empty-state] h3").textContent.trim(),
      productsHidden: document.querySelector("[data-product-list]").hidden,
      clearHidden: document.querySelector("[data-clear]").hidden,
      resetHidden: document.querySelector("[data-filter-reset]").hidden,
    };
  })()`);
  check(
    "búsqueda sin coincidencias mantiene el hero oculto y muestra el estado vacío",
    noResults.heroHidden && noResults.emptyVisible && noResults.productsHidden &&
      noResults.clearHidden && noResults.resetHidden &&
      noResults.emptyTitle === "No encontramos coincidencias.",
    JSON.stringify(noResults),
  );

  await session.evaluate(`(() => {
    const input = document.querySelector("[data-search]");
    input.value = ${JSON.stringify(searchProduct.id)};
    input.dispatchEvent(new Event("input", { bubbles: true }));
  })()`);
  const beforeClearSlide = await session.evaluate(
    'document.querySelector("[data-hero-primary] [data-hero-slide]")?.dataset.heroSlide',
  );
  await session.evaluate(`(() => {
    const input = document.querySelector("[data-search]");
    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  })()`);
  const restoredSearch = await waitForValue(session, `(() => {
    const header = document.querySelector("[data-header]").getBoundingClientRect();
    const heading = document.querySelector("#catalogue-title").getBoundingClientRect();
    const root = getComputedStyle(document.documentElement);
    const rawGap = root.getPropertyValue("--anchor-title-gap").trim();
    const value = parseFloat(rawGap);
    const expectedGap = rawGap.endsWith("rem")
      ? value * parseFloat(root.fontSize) : value;
    return {
      products: document.querySelectorAll("[data-product-entry]").length,
      value: document.querySelector("[data-search]").value,
      heroHidden: document.querySelector(".hero").classList.contains("is-search-hidden"),
      heroHeight: document.querySelector(".hero").getBoundingClientRect().height,
      clearDisabled: document.querySelector("[data-clear]").disabled,
      clearHidden: document.querySelector("[data-clear]").hidden,
      slide: document.querySelector("[data-hero-primary] [data-hero-slide]")?.dataset.heroSlide,
      headingGap: heading.top - header.bottom,
      expectedGap,
    };
  })()`, (snapshot) =>
    !snapshot.heroHidden && snapshot.heroHeight > 0 &&
    Math.abs(snapshot.headingGap - snapshot.expectedGap) <= 1.5
  );
  await wait(4200);
  const slideAfterSearchResume = await session.evaluate(
    'document.querySelector("[data-hero-primary] [data-hero-slide]")?.dataset.heroSlide',
  );
  check(
    "limpiar restaura hero, catálogo y estado sin reiniciar el slide",
    restoredSearch.products === expectedProductCount &&
      restoredSearch.value === "" && !restoredSearch.heroHidden &&
      restoredSearch.heroHeight > 0 && restoredSearch.clearDisabled &&
      restoredSearch.clearHidden &&
      restoredSearch.slide === beforeClearSlide &&
      Math.abs(restoredSearch.headingGap - restoredSearch.expectedGap) <= 1.5,
    JSON.stringify({ beforeClearSlide, restoredSearch }),
  );
  check(
    "hero reanuda una sola rotación tras limpiar la búsqueda",
    slideAfterSearchResume === nextSlide(restoredSearch.slide),
    JSON.stringify({ restoredSearch, slideAfterSearchResume }),
  );

  await session.evaluate(`document.querySelector(
    '[data-navigation] a[href="#preguntas"]'
  ).click()`);
  await waitForValue(session, `(() => {
    const header = document.querySelector("[data-header]").getBoundingClientRect();
    const heading = document.querySelector("#faq-title").getBoundingClientRect();
    const root = getComputedStyle(document.documentElement);
    return Math.abs(
      heading.top - header.bottom -
      parseFloat(root.getPropertyValue("--anchor-title-gap")) *
        parseFloat(root.fontSize)
    );
  })()`, (difference) => difference <= 1.5);
  await session.evaluate(`(() => {
    const input = document.querySelector("[data-search]");
    input.focus();
    input.value = ${JSON.stringify(searchProduct.name)};
    input.dispatchEvent(new Event("input", { bubbles: true }));
  })()`);
  const searchFromFaq = await waitForValue(session, `(() => {
    const input = document.querySelector("[data-search]");
    const header = document.querySelector("[data-header]").getBoundingClientRect();
    const heading = document.querySelector("#catalogue-title").getBoundingClientRect();
    const root = getComputedStyle(document.documentElement);
    const expected = parseFloat(root.getPropertyValue("--anchor-title-gap")) *
      parseFloat(root.fontSize);
    return {
      focused: document.activeElement === input,
      gap: heading.top - header.bottom,
      expected,
      products: document.querySelectorAll("[data-product-entry]").length,
    };
  })()`, (snapshot) => Math.abs(snapshot.gap - snapshot.expected) <= 1.5);

  await session.evaluate(`document.querySelector(
    '[data-navigation] a[href="#concepto"]'
  ).click()`);
  await waitForValue(session, `(() => {
    const header = document.querySelector("[data-header]").getBoundingClientRect();
    const heading = document.querySelector("#concept-title").getBoundingClientRect();
    const root = getComputedStyle(document.documentElement);
    return Math.abs(
      heading.top - header.bottom -
      parseFloat(root.getPropertyValue("--anchor-title-gap")) *
        parseFloat(root.fontSize)
    );
  })()`, (difference) => difference <= 1.5);
  await session.evaluate(`(() => {
    const input = document.querySelector("[data-search]");
    input.focus();
    input.value = "consulta-sin-coincidencias-desde-concepto";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  })()`);
  const emptySearchFromConcept = await waitForValue(session, `(() => {
    const input = document.querySelector("[data-search]");
    const header = document.querySelector("[data-header]").getBoundingClientRect();
    const heading = document.querySelector("#catalogue-title").getBoundingClientRect();
    const root = getComputedStyle(document.documentElement);
    const expected = parseFloat(root.getPropertyValue("--anchor-title-gap")) *
      parseFloat(root.fontSize);
    return {
      focused: document.activeElement === input,
      gap: heading.top - header.bottom,
      expected,
      emptyVisible: !document.querySelector("[data-empty-state]").hidden,
    };
  })()`, (snapshot) => Math.abs(snapshot.gap - snapshot.expected) <= 1.5);
  check(
    "buscar desde otras secciones siempre vuelve a Colección y conserva foco",
    searchFromFaq.focused && searchFromFaq.products === 1 &&
      Math.abs(searchFromFaq.gap - searchFromFaq.expected) <= 1.5 &&
      emptySearchFromConcept.focused && emptySearchFromConcept.emptyVisible &&
      Math.abs(emptySearchFromConcept.gap - emptySearchFromConcept.expected) <= 1.5,
    JSON.stringify({ searchFromFaq, emptySearchFromConcept }),
  );

  await session.evaluate(`(() => {
    const input = document.querySelector("[data-search]");
    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  })()`);
  await waitForValue(session, `(() => {
    const header = document.querySelector("[data-header]").getBoundingClientRect();
    const heading = document.querySelector("#catalogue-title").getBoundingClientRect();
    const root = getComputedStyle(document.documentElement);
    const expected = parseFloat(root.getPropertyValue("--anchor-title-gap")) *
      parseFloat(root.fontSize);
    return Math.abs(heading.top - header.bottom - expected);
  })()`, (difference) => difference <= 1.5);
  await session.evaluate(`document.querySelector(
    '[data-navigation] a[href="#contacto"]'
  ).click()`);
  await waitForValue(session, `(() => {
    const header = document.querySelector("[data-header]").getBoundingClientRect();
    const heading = document.querySelector("#contact-title").getBoundingClientRect();
    const root = getComputedStyle(document.documentElement);
    return Math.abs(
      heading.top - header.bottom -
      parseFloat(root.getPropertyValue("--anchor-title-gap")) *
        parseFloat(root.fontSize)
    );
  })()`, (difference) => difference <= 1.5);
  await session.evaluate(`(() => {
    const select = document.querySelector("[data-sort]");
    select.focus();
    select.value = "name-asc";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
  const sortFromContact = await waitForValue(session, `(() => {
    const select = document.querySelector("[data-sort]");
    const header = document.querySelector("[data-header]").getBoundingClientRect();
    const heading = document.querySelector("#catalogue-title").getBoundingClientRect();
    const root = getComputedStyle(document.documentElement);
    const expected = parseFloat(root.getPropertyValue("--anchor-title-gap")) *
      parseFloat(root.fontSize);
    return {
      focused: document.activeElement === select,
      gap: heading.top - header.bottom,
      expected,
      first: document.querySelector("[data-product-entry]")?.dataset.productEntry,
    };
  })()`, (snapshot) => Math.abs(snapshot.gap - snapshot.expected) <= 1.5);
  check(
    "cambiar Ordenar desde otra sección vuelve a Colección sin robar foco",
    sortFromContact.focused &&
      sortFromContact.first === expectedNameOrder[0].id &&
      Math.abs(sortFromContact.gap - sortFromContact.expected) <= 1.5,
    JSON.stringify(sortFromContact),
  );
  await session.evaluate(`(() => {
    const select = document.querySelector("[data-sort]");
    select.value = "featured";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);

  stage("desktop 1440: ordenamiento y sidebar de filtros");
  const sortResults = {};
  for (const sort of ["name-asc", "price-asc", "price-desc", "featured"]) {
    sortResults[sort] = await session.evaluate(`(() => {
      const select = document.querySelector("[data-sort]");
      select.value = ${JSON.stringify(sort)};
      select.dispatchEvent(new Event("change", { bubbles: true }));
      return [...document.querySelectorAll("[data-product-entry]")]
        .map((entry) => entry.dataset.productEntry);
    })()`);
  }
  await waitForValue(session, `(() => {
    const header = document.querySelector("[data-header]").getBoundingClientRect();
    const heading = document.querySelector("#catalogue-title").getBoundingClientRect();
    const root = getComputedStyle(document.documentElement);
    const expected = parseFloat(root.getPropertyValue("--anchor-title-gap")) *
      parseFloat(root.fontSize);
    return Math.abs(heading.top - header.bottom - expected);
  })()`, (difference) => difference <= 1.5, 4000);
  const originalNameOrder = sortResults["name-asc"]
    .filter((id) => ["STK-001", "STK-002", "STK-003"].includes(id))
    .map((id) => products.find((product) => product.id === id).name);
  check(
    "ordenamientos usan nombre es-CL y precios numéricos en ambos sentidos",
    sortResults["name-asc"].join() ===
      expectedNameOrder.map((product) => product.id).join() &&
      sortResults["price-asc"].join() ===
        expectedPriceAscending.map((product) => product.id).join() &&
      sortResults["price-desc"].join() ===
        expectedPriceDescending.map((product) => product.id).join() &&
      sortResults.featured.join() ===
        expectedDefaultProducts.map((product) => product.id).join() &&
      originalNameOrder.join() ===
        ["Falda Amarilla", "Falda Beige", "Falda Verde"].join(),
    JSON.stringify({ sortResults, originalNameOrder }),
  );

  await session.evaluate(`document.querySelector(
    '[data-navigation] a[href="#preguntas"]'
  ).click()`);
  await waitForValue(session, `(() => {
    const header = document.querySelector("[data-header]").getBoundingClientRect();
    const heading = document.querySelector("#faq-title").getBoundingClientRect();
    const root = getComputedStyle(document.documentElement);
    const expected = parseFloat(root.getPropertyValue("--anchor-title-gap")) *
      parseFloat(root.fontSize);
    return Math.abs(heading.top - header.bottom - expected);
  })()`, (difference) => difference <= 1.5);
  const filterOptionScrollStability = await session.evaluate(`(() => {
    const beforeOpen = window.scrollY;
    document.querySelector("[data-filter-toggle]").click();
    const scrollRegion = document.querySelector("[data-filter-scroll-region]");
    const toggle = document.querySelector(
      '[data-filter-group-toggle="category"]'
    );
    toggle.click();
    return {
      beforeOpen,
      bodyTop: document.body.style.top,
      bodyPosition: getComputedStyle(document.body).position,
      scrollRegionTop: scrollRegion.scrollTop,
      backgroundTop: document.querySelector("#faq-title")
        .getBoundingClientRect().top,
      lockedCatalogueSize: document.querySelector(".catalogue").style
        .getPropertyValue("--filter-locked-catalogue-block-size"),
      lockedHeroSize: document.querySelector(".hero").style
        .getPropertyValue("--filter-locked-hero-block-size"),
      changes: [],
    };
  })()`);
  await waitForValue(session, `(() => {
    const toggle = document.querySelector(
      '[data-filter-group-toggle="category"]'
    );
    const panel = document.getElementById(toggle.getAttribute("aria-controls"));
    return toggle.getAttribute("aria-expanded") === "true" &&
      !panel.hidden && panel.getAnimations().length === 0;
  })()`, Boolean);

  for (let index = 0; index < 10; index += 1) {
    const change = await session.evaluate(`(async () => {
      const dialog = document.querySelector("[data-filter-dialog]");
      const scrollRegion = document.querySelector("[data-filter-scroll-region]");
      const toggle = document.querySelector(
        '[data-filter-group-toggle="category"]'
      );
      const panel = document.getElementById(toggle.getAttribute("aria-controls"));
      const input = document.querySelectorAll(
        '[data-filter-family="category"]'
      )[${index}];
      const before = window.scrollY;
      const backgroundBefore = document.querySelector("#faq-title")
        .getBoundingClientRect().top;
      input.focus({ preventScroll: true });
      input.click();
      await new Promise((resolve) => requestAnimationFrame(
        () => requestAnimationFrame(resolve)
      ));
      return {
        before,
        after: window.scrollY,
        backgroundBefore,
        backgroundAfter: document.querySelector("#faq-title")
          .getBoundingClientRect().top,
        checked: input.checked,
        focused: document.activeElement === input,
        dialogOpen: dialog.open,
        groupOpen: toggle.getAttribute("aria-expanded") === "true" &&
          !panel.hidden,
        bodyTop: document.body.style.top,
        bodyPosition: getComputedStyle(document.body).position,
        scrollRegionTop: scrollRegion.scrollTop,
        lockedCatalogueSize: document.querySelector(".catalogue").style
          .getPropertyValue("--filter-locked-catalogue-block-size"),
        lockedHeroSize: document.querySelector(".hero").style
          .getPropertyValue("--filter-locked-hero-block-size"),
        heroHidden: document.querySelector(".hero")
          .classList.contains("is-search-hidden"),
      };
    })()`);
    filterOptionScrollStability.changes.push(change);
  }

  const selected = await session.evaluate(
    'document.querySelectorAll("[data-filter-family=category]:checked").length',
  );
  await session.evaluate('document.querySelector("[data-filter-close]").click()');
  const afterClose = await waitForStableScroll(session);
  Object.assign(
    filterOptionScrollStability,
    await session.evaluate(`(() => ({
      dialogOpen: document.querySelector("[data-filter-dialog]").open,
      bodyUnlocked: !document.body.classList.contains("filters-open") &&
        !document.querySelector("main").inert,
      catalogueLockCleared: document.querySelector(".catalogue").style
        .getPropertyValue("--filter-locked-catalogue-block-size") === "",
      heroLockCleared: document.querySelector(".hero").style
        .getPropertyValue("--filter-locked-hero-block-size") === "" &&
        document.querySelector(".hero").style
          .getPropertyValue("--filter-locked-hero-padding-bottom") === "",
      maximumScrollY: Math.max(0, document.documentElement.scrollHeight - innerHeight),
    }))()`),
    { afterClose, selected },
  );
  check(
    "diez cambios de filtros mantienen inmóvil el fondo, foco, sidebar y grupo",
    filterOptionScrollStability.changes.length === 10 &&
      filterOptionScrollStability.changes.every((change) =>
        Math.abs(change.after - change.before) <= 1 && change.checked &&
        Math.abs(change.backgroundBefore - filterOptionScrollStability.backgroundTop) <= 1 &&
        Math.abs(change.backgroundAfter - filterOptionScrollStability.backgroundTop) <= 1 &&
        change.focused && change.dialogOpen && change.groupOpen &&
        change.bodyTop === filterOptionScrollStability.bodyTop &&
        change.bodyPosition === "fixed" &&
        change.scrollRegionTop === filterOptionScrollStability.scrollRegionTop &&
        change.lockedCatalogueSize === filterOptionScrollStability.lockedCatalogueSize &&
        change.lockedHeroSize === filterOptionScrollStability.lockedHeroSize &&
        change.heroHidden
      ) && filterOptionScrollStability.selected === 10 &&
      filterOptionScrollStability.bodyPosition === "fixed" &&
      filterOptionScrollStability.lockedCatalogueSize !== "" &&
      filterOptionScrollStability.lockedHeroSize !== "" &&
      !filterOptionScrollStability.dialogOpen &&
      filterOptionScrollStability.bodyUnlocked &&
      filterOptionScrollStability.catalogueLockCleared &&
      filterOptionScrollStability.heroLockCleared &&
      Math.abs(
        filterOptionScrollStability.afterClose -
        Math.min(
          filterOptionScrollStability.beforeOpen,
          filterOptionScrollStability.maximumScrollY
        )
      ) <= 1,
    JSON.stringify(filterOptionScrollStability),
  );
  await session.evaluate('document.querySelector("[data-clear]").click()');
  await waitForValue(session, `(() => ({
    filters: document.querySelectorAll("[data-filter-family]:checked").length,
    heroHidden: document.querySelector(".hero").classList.contains("is-search-hidden"),
    gap: document.querySelector("#catalogue-title").getBoundingClientRect().top -
      document.querySelector("[data-header]").getBoundingClientRect().bottom,
    expected: parseFloat(getComputedStyle(document.documentElement)
      .getPropertyValue("--anchor-title-gap")) *
      parseFloat(getComputedStyle(document.documentElement).fontSize),
  }))()`, (snapshot) => snapshot.filters === 0 && !snapshot.heroHidden &&
    Math.abs(snapshot.gap - snapshot.expected) <= 1.5);

  await session.evaluate('document.querySelector("[data-filter-toggle]").click()');
  const filterOpened = await session.evaluate(`(() => {
    const dialog = document.querySelector("[data-filter-dialog]");
    const form = dialog.querySelector("[data-filter-form]");
    const scrollRegion = dialog.querySelector("[data-filter-scroll-region]");
    const actions = dialog.querySelector(".filter-dialog__actions");
    const priceGroup = dialog.querySelector('[data-filter-group="price"]');
    const priceContent = priceGroup.querySelector(".price-filter__content");
    const values = (family) => [...dialog.querySelectorAll(
      '[data-filter-family="' + family + '"]'
    )].map((input) => input.value);
    return {
      open: dialog.open,
      expanded: document.querySelector("[data-filter-toggle]")
        .getAttribute("aria-expanded"),
      focusedClose: document.activeElement === document.querySelector("[data-filter-close]"),
      bodyLocked: document.body.classList.contains("filters-open"),
      mainInert: document.querySelector("main").inert,
      scrollStructure: {
        scrollRegionInsideForm: scrollRegion.parentElement === form,
        actionsOutsideScrollRegion: actions.parentElement === form &&
          !scrollRegion.contains(actions),
        overflowY: getComputedStyle(scrollRegion).overflowY,
        overscrollBehavior: getComputedStyle(scrollRegion).overscrollBehavior,
        formOverflow: getComputedStyle(form).overflow,
        actionsBackground: getComputedStyle(actions).backgroundColor,
      },
      categories: values("category"),
      materials: values("material"),
      sizes: values("size"),
      priceMin: Number(document.querySelector("[data-filter-price-min]").min),
      priceMax: Number(document.querySelector("[data-filter-price-max]").max),
      clearHidden: document.querySelector("[data-clear]").hidden,
      resetHidden: document.querySelector("[data-filter-reset]").hidden,
      groups: [...dialog.querySelectorAll("[data-filter-group-toggle]")].map(
        (toggle) => ({
          family: toggle.dataset.filterGroupToggle,
          expanded: toggle.getAttribute("aria-expanded"),
          panelHidden: document.getElementById(
            toggle.getAttribute("aria-controls")
          ).hidden,
          count: toggle.querySelector("[data-filter-group-count]").textContent,
        })
      ),
      price: {
        visible: !priceContent.hidden && priceContent.getBoundingClientRect().height > 0,
        toggleCount: priceGroup.querySelectorAll("[data-filter-group-toggle]").length,
        expandedCount: priceGroup.querySelectorAll("[aria-expanded]").length,
        count: priceGroup.querySelector("[data-filter-group-count]").textContent,
      },
      headings: [...dialog.querySelectorAll(".filter-group__heading")].map((heading) => {
        const badge = heading.querySelector(".filter-group-count");
        const count = badge.querySelector("[data-filter-group-count]");
        const label = badge.nextElementSibling;
        const badgeRect = badge.getBoundingClientRect();
        const countRect = count.getBoundingClientRect();
        const labelRect = label.getBoundingClientRect();
        return {
          badgeBeforeLabel: badge.nextElementSibling === label &&
            badgeRect.right <= labelRect.left,
          gap: labelRect.left - badgeRect.right,
          centered: Math.abs(
            (badgeRect.top + badgeRect.bottom) / 2 -
            (countRect.top + countRect.bottom) / 2
          ) <= 1,
          display: getComputedStyle(badge).display,
          alignItems: getComputedStyle(badge).alignItems,
          justifyContent: getComputedStyle(badge).justifyContent,
        };
      }),
      groupBorders: [...dialog.querySelectorAll(".filter-group")].map((group) => {
        const style = getComputedStyle(group);
        return {
          top: style.borderTopWidth,
          bottom: style.borderBottomWidth,
          color: style.borderBottomColor,
        };
      }),
      actionsBorderTop: getComputedStyle(
        dialog.querySelector(".filter-dialog__actions")
      ).borderTopWidth,
      applyTop: dialog.querySelector("[data-filter-apply]")
        .getBoundingClientRect().top,
      applyText: dialog.querySelector("[data-filter-apply]")?.textContent.trim(),
    };
  })()`);
  check(
    "Filtrar abre un sidebar modal con facetas y rango derivados del catálogo",
    filterOpened.open && filterOpened.expanded === "true" &&
      filterOpened.focusedClose && filterOpened.bodyLocked && filterOpened.mainInert &&
      filterOpened.scrollStructure.scrollRegionInsideForm &&
      filterOpened.scrollStructure.actionsOutsideScrollRegion &&
      filterOpened.scrollStructure.overflowY === "auto" &&
      filterOpened.scrollStructure.overscrollBehavior === "contain" &&
      filterOpened.scrollStructure.formOverflow === "hidden" &&
      filterOpened.scrollStructure.actionsBackground === "rgb(251, 250, 247)" &&
      filterOpened.categories.join() === catalogueFacets.categories.join() &&
      filterOpened.materials.join() === catalogueFacets.materials.join() &&
      filterOpened.sizes.join() === catalogueFacets.sizes.join() &&
      filterOpened.priceMin === catalogueFacets.minPrice &&
      filterOpened.priceMax === catalogueFacets.maxPrice &&
      filterOpened.clearHidden && filterOpened.resetHidden &&
      filterOpened.groups.length === 3 &&
      filterOpened.groups.every((group) =>
        group.expanded === "false" && group.panelHidden && group.count === "0"
      ) &&
      filterOpened.price.visible && filterOpened.price.toggleCount === 0 &&
      filterOpened.price.expandedCount === 0 && filterOpened.price.count === "0" &&
      filterOpened.headings.every((heading) =>
        heading.badgeBeforeLabel && heading.gap > 0 && heading.gap <= 10 &&
        heading.centered && heading.display === "flex" &&
        heading.alignItems === "center" && heading.justifyContent === "center"
      ) &&
      filterOpened.groupBorders.every((border) =>
        border.top === "0px" && border.bottom === "1px" &&
        border.color === filterOpened.groupBorders[0].color
      ) && filterOpened.actionsBorderTop === "0px" &&
      filterOpened.applyText === "Aplicar filtros",
    JSON.stringify(filterOpened),
  );

  const filterVisibilityByFamily = await session.evaluate(`(() => {
    const initialApplyTop = document.querySelector("[data-filter-apply]")
      .getBoundingClientRect().top;
    const snapshot = (family) => {
      const group = document.querySelector('[data-filter-group="' + family + '"]');
      const badge = group.querySelector(".filter-group-count");
      const clear = document.querySelector("[data-clear]");
      const reset = document.querySelector("[data-filter-reset]");
      const clearStyle = getComputedStyle(clear);
      const resetStyle = getComputedStyle(reset);
      const applyRect = document.querySelector("[data-filter-apply]")
        .getBoundingClientRect();
      const resetRect = reset.getBoundingClientRect();
      return {
        clearVisible: !clear.hidden,
        resetVisible: !reset.hidden,
        active: group.classList.contains("has-active-filters"),
        count: group.querySelector("[data-filter-group-count]").textContent,
        background: getComputedStyle(badge).backgroundColor,
        applyTop: applyRect.top,
        resetBelowApply: resetRect.top >= applyRect.bottom &&
          resetRect.bottom > resetRect.top,
        clearStyle: {
          border: clearStyle.borderColor,
          background: clearStyle.backgroundColor,
          color: clearStyle.color,
        },
        resetStyle: {
          border: resetStyle.borderColor,
          background: resetStyle.backgroundColor,
          color: resetStyle.color,
        },
      };
    };
    const results = { initialApplyTop };
    for (const family of ["category", "material", "size"]) {
      const input = document.querySelector('[data-filter-family="' + family + '"]');
      input.checked = true;
      input.dispatchEvent(new Event("change", { bubbles: true }));
      results[family] = snapshot(family);
      input.checked = false;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
    const minimum = document.querySelector("[data-filter-price-min]");
    const initialMinimum = Number(minimum.value);
    minimum.value = String(initialMinimum + Number(minimum.step));
    minimum.dispatchEvent(new Event("input", { bubbles: true }));
    results.price = snapshot("price");
    minimum.value = String(initialMinimum);
    minimum.dispatchEvent(new Event("input", { bubbles: true }));
    results.cleared = {
      clearHidden: document.querySelector("[data-clear]").hidden,
      resetHidden: document.querySelector("[data-filter-reset]").hidden,
      activeGroups: document.querySelectorAll(
        ".filter-group.has-active-filters"
      ).length,
      focusedToggle: document.activeElement ===
        document.querySelector("[data-filter-toggle]"),
    };
    return results;
  })()`);
  check(
    "limpieza y badges responden al estado real de cada familia de filtros",
    ["category", "material", "size", "price"].every((family) =>
      filterVisibilityByFamily[family].clearVisible &&
      filterVisibilityByFamily[family].resetVisible &&
      filterVisibilityByFamily[family].active &&
      filterVisibilityByFamily[family].count === "1" &&
      filterVisibilityByFamily[family].background === "rgb(48, 76, 137)" &&
      Math.abs(
        filterVisibilityByFamily[family].applyTop -
        filterVisibilityByFamily.initialApplyTop
      ) <= 0.5 && filterVisibilityByFamily[family].resetBelowApply &&
      filterVisibilityByFamily[family].clearStyle.border === "rgb(48, 76, 137)" &&
      filterVisibilityByFamily[family].clearStyle.background === "rgba(0, 0, 0, 0)" &&
      filterVisibilityByFamily[family].clearStyle.color === "rgb(48, 76, 137)" &&
      filterVisibilityByFamily[family].resetStyle.border === "rgb(48, 76, 137)" &&
      filterVisibilityByFamily[family].resetStyle.background === "rgba(0, 0, 0, 0)" &&
      filterVisibilityByFamily[family].resetStyle.color === "rgb(48, 76, 137)"
    ) && filterVisibilityByFamily.cleared.clearHidden &&
      filterVisibilityByFamily.cleared.resetHidden &&
      filterVisibilityByFamily.cleared.activeGroups === 0,
    JSON.stringify(filterVisibilityByFamily),
  );

  const filterGroupAccordion = await session.evaluate(`(async () => {
    const states = () => [...document.querySelectorAll(
      "[data-filter-group-toggle]"
    )].map((toggle) => ({
      family: toggle.dataset.filterGroupToggle,
      expanded: toggle.getAttribute("aria-expanded") === "true",
      hidden: document.getElementById(toggle.getAttribute("aria-controls")).hidden,
    }));
    const settle = async (panel) => {
      const animations = panel.getAnimations();
      await Promise.allSettled(animations.map((animation) => animation.finished));
      await new Promise((resolve) => requestAnimationFrame(resolve));
    };
    const materialToggle = document.querySelector(
      '[data-filter-group-toggle="material"]'
    );
    const materialPanel = document.getElementById(
      materialToggle.getAttribute("aria-controls")
    );
    const categoryToggle = document.querySelector(
      '[data-filter-group-toggle="category"]'
    );
    const categoryPanel = document.getElementById(
      categoryToggle.getAttribute("aria-controls")
    );
    const priceContent = document.querySelector(
      '[data-filter-group="price"] .price-filter__content'
    );
    materialToggle.click();
    const openAnimation = materialPanel.getAnimations()[0];
    const openDuration = openAnimation?.effect.getTiming().duration ?? 0;
    const materialOpen = states();
    await settle(materialPanel);

    const persistedInput = document.querySelector(
      '[data-filter-family="material"][value="Algodón"]'
    );
    const inactiveBadge = materialToggle.querySelector(".filter-group-count");
    const inactiveBadgeRect = inactiveBadge.getBoundingClientRect();
    persistedInput.checked = true;
    persistedInput.dispatchEvent(new Event("change", { bubbles: true }));
    const activeBadge = materialToggle.querySelector(".filter-group-count");
    const activeBadgeRect = activeBadge.getBoundingClientRect();
    const activeState = {
      clearVisible: !document.querySelector("[data-clear]").hidden,
      resetVisible: !document.querySelector("[data-filter-reset]").hidden,
      groupActive: materialToggle.closest(".filter-group")
        .classList.contains("has-active-filters"),
      badgeBackground: getComputedStyle(activeBadge).backgroundColor,
      badgeColor: getComputedStyle(activeBadge).color,
      badgeSize: [activeBadgeRect.width, activeBadgeRect.height],
      inactiveBadgeSize: [inactiveBadgeRect.width, inactiveBadgeRect.height],
    };
    document.querySelector("[data-filter-close]").click();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    document.querySelector("[data-filter-toggle]").click();
    const reopened = {
      groups: states(),
      selectionPersisted: persistedInput.checked,
      count: document.querySelector(
        '[data-filter-group-count="material"]'
      ).textContent,
      priceVisible: priceContent.getBoundingClientRect().height > 0,
    };
    persistedInput.checked = false;
    persistedInput.dispatchEvent(new Event("change", { bubbles: true }));
    const clearedState = {
      clearHidden: document.querySelector("[data-clear]").hidden,
      resetHidden: document.querySelector("[data-filter-reset]").hidden,
      groupActive: materialToggle.closest(".filter-group")
        .classList.contains("has-active-filters"),
    };

    materialToggle.click();
    await settle(materialPanel);
    materialToggle.click();
    const closeAnimation = materialPanel.getAnimations()[0];
    const closeDuration = closeAnimation?.effect.getTiming().duration ?? 0;
    await settle(materialPanel);
    const allClosed = {
      groups: states(),
      hidden: materialPanel.hidden,
      height: materialPanel.getBoundingClientRect().height,
      inlineHeight: materialPanel.style.height,
      inlineOverflow: materialPanel.style.overflow,
      animations: materialPanel.getAnimations().length,
    };

    materialToggle.click();
    await settle(materialPanel);
    categoryToggle.click();
    await Promise.all([settle(materialPanel), settle(categoryPanel)]);
    const immediateSwitch = {
      groups: states(),
      materialInlineHeight: materialPanel.style.height,
      categoryInlineHeight: categoryPanel.style.height,
      materialInlineOverflow: materialPanel.style.overflow,
      categoryInlineOverflow: categoryPanel.style.overflow,
      categoryOverflow: getComputedStyle(categoryPanel).overflow,
      priceVisible: priceContent.getBoundingClientRect().height > 0,
    };
    return {
      materialOpen, allClosed, reopened, immediateSwitch, activeState,
      clearedState, openDuration, closeDuration,
    };
  })()`);
  check(
    "solo tres grupos participan del acordeón; Precio queda visible y el cierre termina limpio",
    filterGroupAccordion.materialOpen.filter((group) => group.expanded).length === 1 &&
      filterGroupAccordion.materialOpen.find((group) => group.family === "material")
        .expanded &&
      filterGroupAccordion.allClosed.groups.every(
        (group) => !group.expanded && group.hidden
      ) && filterGroupAccordion.allClosed.hidden &&
      filterGroupAccordion.allClosed.height === 0 &&
      filterGroupAccordion.allClosed.inlineHeight === "" &&
      filterGroupAccordion.allClosed.inlineOverflow === "" &&
      filterGroupAccordion.allClosed.animations === 0 &&
      filterGroupAccordion.immediateSwitch.groups.filter(
        (group) => group.expanded
      ).length === 1 &&
      filterGroupAccordion.immediateSwitch.groups.find(
        (group) => group.family === "category"
      ).expanded && filterGroupAccordion.immediateSwitch.priceVisible &&
      filterGroupAccordion.immediateSwitch.materialInlineHeight === "" &&
      filterGroupAccordion.immediateSwitch.categoryInlineHeight === "" &&
      filterGroupAccordion.immediateSwitch.materialInlineOverflow === "" &&
      filterGroupAccordion.immediateSwitch.categoryInlineOverflow === "" &&
      filterGroupAccordion.immediateSwitch.categoryOverflow === "visible" &&
      filterGroupAccordion.reopened.groups.every(
        (group) => !group.expanded && group.hidden
      ) && filterGroupAccordion.reopened.selectionPersisted &&
      filterGroupAccordion.reopened.count === "1" &&
      filterGroupAccordion.reopened.priceVisible &&
      filterGroupAccordion.activeState.clearVisible &&
      filterGroupAccordion.activeState.resetVisible &&
      filterGroupAccordion.activeState.groupActive &&
      filterGroupAccordion.activeState.badgeBackground === "rgb(48, 76, 137)" &&
      filterGroupAccordion.activeState.badgeColor === "rgb(255, 255, 255)" &&
      filterGroupAccordion.activeState.badgeSize.join() ===
        filterGroupAccordion.activeState.inactiveBadgeSize.join() &&
      filterGroupAccordion.clearedState.clearHidden &&
      filterGroupAccordion.clearedState.resetHidden &&
      !filterGroupAccordion.clearedState.groupActive &&
      filterGroupAccordion.openDuration === faqFocus.animationDuration &&
      filterGroupAccordion.closeDuration === faqFocus.animationDuration &&
      filterGroupAccordion.openDuration > 0,
    JSON.stringify(filterGroupAccordion),
  );

  const filterGroupPoint = await session.evaluate(`(() => {
    const toggle = document.querySelector('[data-filter-group-toggle="category"]');
    const rect = toggle.getBoundingClientRect();
    const style = getComputedStyle(toggle);
    const symbol = getComputedStyle(toggle, "::after");
    window.__filterGroupRest = {
      weight: Number(style.fontWeight),
      color: style.color,
      symbolColor: symbol.color,
      countColor: getComputedStyle(toggle.querySelector(".filter-group-count")).color,
      symbolSize: parseFloat(symbol.fontSize),
      symbol: symbol.content,
      groupRects: [...document.querySelectorAll(".filter-group")].map((group) => {
        const groupRect = group.getBoundingClientRect();
        return { top: groupRect.top, bottom: groupRect.bottom };
      }),
    };
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })()`);
  await moveMouse(session, filterGroupPoint);
  const filterGroupHover = await waitForValue(session, `(() => {
    const toggle = document.querySelector('[data-filter-group-toggle="category"]');
    const style = getComputedStyle(toggle);
    const symbol = getComputedStyle(toggle, "::after");
    return {
      rest: window.__filterGroupRest,
      weight: Number(style.fontWeight),
      color: style.color,
      symbolColor: symbol.color,
      countColor: getComputedStyle(toggle.querySelector(".filter-group-count")).color,
      symbolSize: parseFloat(symbol.fontSize),
      symbol: symbol.content,
      groupRects: [...document.querySelectorAll(".filter-group")].map((group) => {
        const groupRect = group.getBoundingClientRect();
        return { top: groupRect.top, bottom: groupRect.bottom };
      }),
    };
  })()`, (snapshot) => snapshot.weight === 540);
  await moveMouse(session, { x: 2, y: 2 });
  const filterGroupOpenRest = await waitForValue(session, `(() => {
    const toggle = document.querySelector('[data-filter-group-toggle="category"]');
    return {
      weight: Number(getComputedStyle(toggle).fontWeight),
      color: getComputedStyle(toggle).color,
      symbolColor: getComputedStyle(toggle, "::after").color,
      countColor: getComputedStyle(toggle.querySelector(".filter-group-count")).color,
      symbol: getComputedStyle(toggle, "::after").content,
    };
  })()`, (snapshot) => snapshot.weight === 400);
  check(
    "acordeón de filtros usa peso y azul solo durante interacción",
    filterGroupHover.rest.weight === 400 && filterGroupHover.weight === 540 &&
      filterGroupHover.color === "rgb(48, 76, 137)" &&
      filterGroupHover.symbolColor === "rgb(48, 76, 137)" &&
      filterGroupHover.countColor === "rgb(48, 76, 137)" &&
      filterGroupHover.symbolSize >= filterGroupHover.rest.symbolSize * 1.9 &&
      filterGroupHover.groupRects.every((rect, index) =>
        Math.abs(rect.top - filterGroupHover.rest.groupRects[index].top) <= 0.5 &&
        Math.abs(rect.bottom - filterGroupHover.rest.groupRects[index].bottom) <= 0.5
      ) &&
      filterGroupHover.symbol.includes("−") && filterGroupOpenRest.weight === 400 &&
      filterGroupOpenRest.color === filterGroupHover.rest.color &&
      filterGroupOpenRest.symbolColor === filterGroupHover.rest.symbolColor &&
      filterGroupOpenRest.countColor === filterGroupHover.rest.countColor &&
      filterGroupOpenRest.symbol.includes("−"),
    JSON.stringify({ filterGroupHover, filterGroupOpenRest }),
  );
  await session.evaluate("delete window.__filterGroupRest");

  const priceFooterLayout = await session.evaluate(`(async () => {
    const scrollRegion = document.querySelector("[data-filter-scroll-region]");
    const price = document.querySelector('[data-filter-group="price"]');
    const range = document.querySelector("[data-price-range]");
    const actions = document.querySelector(".filter-dialog__actions");
    const apply = document.querySelector("[data-filter-apply]");
    scrollRegion.scrollTop = scrollRegion.scrollHeight;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const scrollRect = scrollRegion.getBoundingClientRect();
    const priceRect = price.getBoundingClientRect();
    const rangeRect = range.getBoundingClientRect();
    const actionsRect = actions.getBoundingClientRect();
    const applyRect = apply.getBoundingClientRect();
    const hit = document.elementFromPoint(
      applyRect.left + applyRect.width / 2,
      applyRect.top + applyRect.height / 2
    );
    const rawThumbSize = getComputedStyle(range)
      .getPropertyValue("--price-thumb-size").trim();
    const thumbValue = parseFloat(rawThumbSize);
    const thumbSize = rawThumbSize.endsWith("rem")
      ? thumbValue * parseFloat(getComputedStyle(document.documentElement).fontSize)
      : thumbValue;
    return {
      scrollable: scrollRegion.scrollHeight > scrollRegion.clientHeight,
      scrollTop: scrollRegion.scrollTop,
      maxScroll: scrollRegion.scrollHeight - scrollRegion.clientHeight,
      priceAboveActions: priceRect.bottom <= scrollRect.bottom + 0.5 &&
        rangeRect.bottom < actionsRect.top,
      clearance: actionsRect.top - rangeRect.bottom,
      thumbSize,
      actionsOpaque: getComputedStyle(actions).backgroundColor ===
        "rgb(251, 250, 247)",
      actionsClickable: hit === apply || apply.contains(hit),
      bodyTop: document.body.style.top,
      backgroundTop: document.querySelector("#faq-title")
        .getBoundingClientRect().top,
      wheelPoint: {
        x: scrollRect.left + scrollRect.width / 2,
        y: scrollRect.top + Math.min(scrollRect.height - 4, 80),
      },
    };
  })()`);
  await session.send("Input.dispatchMouseEvent", {
    type: "mouseWheel",
    x: priceFooterLayout.wheelPoint.x,
    y: priceFooterLayout.wheelPoint.y,
    deltaX: 0,
    deltaY: 600,
  });
  await wait(50);
  const priceFooterAfterWheel = await session.evaluate(`(() => {
    const scrollRegion = document.querySelector("[data-filter-scroll-region]");
    return {
      scrollTop: scrollRegion.scrollTop,
      maxScroll: scrollRegion.scrollHeight - scrollRegion.clientHeight,
      bodyTop: document.body.style.top,
      backgroundTop: document.querySelector("#faq-title")
        .getBoundingClientRect().top,
      windowScrollY: window.scrollY,
    };
  })()`);
  check(
    "Precio queda completamente sobre acciones opacas y el scroll no se propaga",
      priceFooterLayout.scrollable && priceFooterLayout.scrollTop > 0 &&
      Math.abs(priceFooterLayout.scrollTop - priceFooterLayout.maxScroll) <= 1 &&
      priceFooterLayout.priceAboveActions &&
      priceFooterLayout.clearance >= priceFooterLayout.thumbSize / 2 &&
      priceFooterLayout.actionsOpaque && priceFooterLayout.actionsClickable &&
      Math.abs(priceFooterAfterWheel.scrollTop - priceFooterAfterWheel.maxScroll) <= 1 &&
      priceFooterAfterWheel.bodyTop === priceFooterLayout.bodyTop &&
      Math.abs(
        priceFooterAfterWheel.backgroundTop - priceFooterLayout.backgroundTop
      ) <= 1 && priceFooterAfterWheel.windowScrollY === 0,
    JSON.stringify({ priceFooterLayout, priceFooterAfterWheel }),
  );

  const priceKeyboardBefore = await session.evaluate(`(() => {
    const input = document.querySelector("[data-filter-price-min]");
    input.focus();
    return Number(input.value);
  })()`);
  await pressKey(session, "ArrowRight", "ArrowRight", 39);
  const priceKeyboardAdvanced = await session.evaluate(`(() => {
    const input = document.querySelector("[data-filter-price-min]");
    return {
      value: Number(input.value),
      focused: document.activeElement === input,
      focusVisible: input.matches(":focus-visible"),
      outline: getComputedStyle(input).outlineStyle,
    };
  })()`);
  await pressKey(session, "ArrowLeft", "ArrowLeft", 37);
  const priceKeyboardRestored = await session.evaluate(
    'Number(document.querySelector("[data-filter-price-min]").value)',
  );
  check(
    "rango de precio responde al teclado y conserva foco visible",
    priceKeyboardAdvanced.value > priceKeyboardBefore &&
      priceKeyboardAdvanced.focused && priceKeyboardAdvanced.focusVisible &&
      priceKeyboardAdvanced.outline !== "none" &&
      priceKeyboardRestored === priceKeyboardBefore,
    JSON.stringify({
      priceKeyboardBefore,
      priceKeyboardAdvanced,
      priceKeyboardRestored,
    }),
  );

  const filterBackdropPoint = await session.evaluate(`(() => {
    const rect = document.querySelector("[data-filter-dialog]").getBoundingClientRect();
    return { x: Math.max(2, rect.left / 2), y: innerHeight / 2 };
  })()`);
  await clickPoint(session, filterBackdropPoint);
  const filterOutsideClosed = await waitForValue(
    session,
    `(() => ({
      open: document.querySelector("[data-filter-dialog]").open,
      expanded: document.querySelector("[data-filter-toggle]").getAttribute("aria-expanded"),
      focusedToggle: document.activeElement === document.querySelector("[data-filter-toggle]"),
      unlocked: !document.body.classList.contains("filters-open") &&
        !document.querySelector("main").inert,
    }))()`,
    (snapshot) => !snapshot.open && snapshot.focusedToggle,
  );
  check(
    "clic exterior cierra el sidebar, desbloquea y devuelve el foco",
    !filterOutsideClosed.open && filterOutsideClosed.expanded === "false" &&
      filterOutsideClosed.focusedToggle && filterOutsideClosed.unlocked,
    JSON.stringify(filterOutsideClosed),
  );

  await session.evaluate('document.querySelector("[data-filter-toggle]").click()');
  await pressKey(session, "Escape", "Escape", 27);
  const filterEscapeClosed = await waitForValue(
    session,
    `(() => ({
      open: document.querySelector("[data-filter-dialog]").open,
      focusedToggle: document.activeElement === document.querySelector("[data-filter-toggle]"),
      expanded: document.querySelector("[data-filter-toggle]").getAttribute("aria-expanded"),
    }))()`,
    (snapshot) => !snapshot.open && snapshot.focusedToggle,
  );
  check(
    "Escape cierra el sidebar y restaura foco y aria-expanded",
    !filterEscapeClosed.open && filterEscapeClosed.focusedToggle &&
      filterEscapeClosed.expanded === "false",
    JSON.stringify(filterEscapeClosed),
  );

  const filterCombination = await session.evaluate(`(() => {
    document.querySelector("[data-filter-toggle]").click();
    const choose = (family, value) => {
      const input = [...document.querySelectorAll(
        '[data-filter-family="' + family + '"]'
      )].find((candidate) => candidate.value === value);
      input.checked = true;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    };
    choose("category", "Faldas");
    choose("material", "Algodón");
    choose("material", "Seda");
    choose("size", "S");
    const minimum = document.querySelector("[data-filter-price-min]");
    const maximum = document.querySelector("[data-filter-price-max]");
    minimum.value = "69990";
    minimum.dispatchEvent(new Event("input", { bubbles: true }));
    maximum.value = "99990";
    maximum.dispatchEvent(new Event("input", { bubbles: true }));
    return {
      open: document.querySelector("[data-filter-dialog]").open,
      idsWithoutQuery: [...document.querySelectorAll("[data-product-entry]")]
        .map((entry) => entry.dataset.productEntry),
      minimum: Number(minimum.value),
      maximum: Number(maximum.value),
      minimumText: document.querySelector("[data-filter-price-min-output]").value,
      maximumText: document.querySelector("[data-filter-price-max-output]").value,
      activeCount: document.querySelector("[data-filter-active-count]").textContent,
      clearVisible: !document.querySelector("[data-clear]").hidden,
      resetVisible: !document.querySelector("[data-filter-reset]").hidden,
      activeGroups: document.querySelectorAll(
        ".filter-group.has-active-filters"
      ).length,
      checked: [...document.querySelectorAll("[data-filter-family]:checked")]
        .map((input) => input.value),
      groupCounts: Object.fromEntries(
        [...document.querySelectorAll("[data-filter-group-count]")].map(
          (count) => [count.dataset.filterGroupCount, count.textContent]
        )
      ),
    };
  })()`);
  const expectedWithoutQuery = getVisibleCatalogueProducts(products, {
    ...combinedFilterSelection,
    query: "",
    sort: "featured",
  });
  check(
    "familias combinan AND, opciones combinan OR y el rango mantiene mínimo ≤ máximo",
    filterCombination.open && filterCombination.minimum <= filterCombination.maximum &&
      filterCombination.idsWithoutQuery.join() ===
        expectedWithoutQuery.map((product) => product.id).join() &&
      filterCombination.minimumText === "$69.990" &&
      filterCombination.maximumText === "$99.990" &&
      filterCombination.activeCount === "5" &&
      filterCombination.clearVisible && filterCombination.resetVisible &&
      filterCombination.activeGroups === 4 &&
      ["Faldas", "Algodón", "Seda", "S"].every((value) =>
        filterCombination.checked.includes(value)
      ) && JSON.stringify(filterCombination.groupCounts) ===
        JSON.stringify({ category: "1", material: "2", size: "1", price: "1" }),
    JSON.stringify(filterCombination),
  );
  await session.evaluate('document.querySelector("[data-filter-apply]").click()');
  const appliedFilters = await waitForValue(session, `(() => {
    const header = document.querySelector("[data-header]").getBoundingClientRect();
    const heading = document.querySelector("#catalogue-title").getBoundingClientRect();
    const root = getComputedStyle(document.documentElement);
    const rawGap = root.getPropertyValue("--anchor-title-gap").trim();
    const value = parseFloat(rawGap);
    const expectedGap = rawGap.endsWith("rem")
      ? value * parseFloat(root.fontSize) : value;
    return {
      open: document.querySelector("[data-filter-dialog]").open,
      selected: document.querySelectorAll("[data-filter-family]:checked").length,
      focusedToggle: document.activeElement ===
        document.querySelector("[data-filter-toggle]"),
      bodyLocked: document.body.classList.contains("filters-open"),
      headingGap: heading.top - header.bottom,
      expectedGap,
    };
  })()`, (snapshot) =>
    !snapshot.open && !snapshot.bodyLocked && snapshot.focusedToggle &&
    Math.abs(snapshot.headingGap - snapshot.expectedGap) <= 1.5
  );
  check(
    "Aplicar filtros cierra el sidebar, conserva selección y vuelve a Colección",
    !appliedFilters.open && appliedFilters.selected === 4 &&
      appliedFilters.focusedToggle && !appliedFilters.bodyLocked &&
      Math.abs(appliedFilters.headingGap - appliedFilters.expectedGap) <= 1.5,
    JSON.stringify(appliedFilters),
  );

  const combinedSearchAndSort = await session.evaluate(`(() => {
    const input = document.querySelector("[data-search]");
    input.value = "Falda";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    const select = document.querySelector("[data-sort]");
    select.value = "price-asc";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    return {
      ids: [...document.querySelectorAll("[data-product-entry]")]
        .map((entry) => entry.dataset.productEntry),
      emptyVisible: !document.querySelector("[data-empty-state]").hidden,
      heroHidden: document.querySelector(".hero").classList.contains("is-search-hidden"),
    };
  })()`);
  check(
    "búsqueda, filtros y ordenamiento usan un único resultado predecible",
    combinedSearchAndSort.ids.join() ===
      expectedCombinedFilter.map((product) => product.id).join() &&
      combinedSearchAndSort.emptyVisible === (expectedCombinedFilter.length === 0) &&
      combinedSearchAndSort.heroHidden,
    JSON.stringify(combinedSearchAndSort),
  );

  await session.evaluate('document.querySelector("[data-clear]").click()');
  const clearedAllFilters = await waitForValue(session, `(() => {
    const header = document.querySelector("[data-header]").getBoundingClientRect();
    const heading = document.querySelector("#catalogue-title").getBoundingClientRect();
    const root = getComputedStyle(document.documentElement);
    const rawGap = root.getPropertyValue("--anchor-title-gap").trim();
    const value = parseFloat(rawGap);
    const expectedGap = rawGap.endsWith("rem")
      ? value * parseFloat(root.fontSize) : value;
    return {
      products: document.querySelectorAll("[data-product-entry]").length,
      query: document.querySelector("[data-search]").value,
      checked: document.querySelectorAll("[data-filter-family]:checked").length,
      min: Number(document.querySelector("[data-filter-price-min]").value),
      max: Number(document.querySelector("[data-filter-price-max]").value),
      countHidden: document.querySelector("[data-filter-active-count]").hidden,
      clearDisabled: document.querySelector("[data-clear]").disabled,
      clearHidden: document.querySelector("[data-clear]").hidden,
      resetHidden: document.querySelector("[data-filter-reset]").hidden,
      activeGroups: document.querySelectorAll(
        ".filter-group.has-active-filters"
      ).length,
      focusedToggle: document.activeElement ===
        document.querySelector("[data-filter-toggle]"),
      groupCounts: [...document.querySelectorAll("[data-filter-group-count]")]
        .map((count) => count.textContent),
      headingGap: heading.top - header.bottom,
      expectedGap,
    };
  })()`, (snapshot) =>
    snapshot.products === expectedProductCount && snapshot.clearDisabled &&
    Math.abs(snapshot.headingGap - snapshot.expectedGap) <= 1.5
  );
  check(
    "Limpiar restablece búsqueda, grupos, rango y desplaza a Colección",
    clearedAllFilters.products === expectedProductCount &&
      clearedAllFilters.query === "" && clearedAllFilters.checked === 0 &&
      clearedAllFilters.min === catalogueFacets.minPrice &&
      clearedAllFilters.max === catalogueFacets.maxPrice &&
      clearedAllFilters.countHidden && clearedAllFilters.clearDisabled &&
      clearedAllFilters.clearHidden && clearedAllFilters.resetHidden &&
      clearedAllFilters.activeGroups === 0 && clearedAllFilters.focusedToggle &&
      clearedAllFilters.groupCounts.every((count) => count === "0") &&
      Math.abs(clearedAllFilters.headingGap - clearedAllFilters.expectedGap) <= 1.5,
    JSON.stringify(clearedAllFilters),
  );

  const emptyFilteredState = await session.evaluate(`(() => {
    document.querySelector("[data-filter-toggle]").click();
    const input = [...document.querySelectorAll(
      '[data-filter-family="category"]'
    )].find((candidate) => candidate.value === "Enteritos");
    input.checked = true;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return {
      open: document.querySelector("[data-filter-dialog]").open,
      heroHidden: document.querySelector(".hero").classList.contains("is-search-hidden"),
      emptyVisible: !document.querySelector("[data-empty-state]").hidden,
      emptyTitle: document.querySelector("[data-empty-state] h3").textContent.trim(),
      products: document.querySelectorAll("[data-product-entry]").length,
      categoryCount: document.querySelector(
        '[data-filter-group-count="category"]'
      ).textContent,
    };
  })()`);
  check(
    "un filtro sin resultados mantiene hero oculto y mensaje en Colección",
    emptyFilteredState.open && emptyFilteredState.heroHidden &&
      emptyFilteredState.emptyVisible && emptyFilteredState.products === 0 &&
      emptyFilteredState.emptyTitle === "No encontramos coincidencias." &&
      emptyFilteredState.categoryCount === "1",
    JSON.stringify(emptyFilteredState),
  );
  const resetFromSidebarBefore = await session.evaluate(`(() => ({
    windowScrollY: window.scrollY,
    bodyTop: document.body.style.top,
    backgroundTop: document.querySelector("#catalogue-title")
      .getBoundingClientRect().top,
    scrollTop: document.querySelector("[data-filter-scroll-region]").scrollTop,
    applyTop: document.querySelector("[data-filter-apply]")
      .getBoundingClientRect().top,
  }))()`);
  await session.evaluate(`(() => {
    const reset = document.querySelector("[data-filter-reset]");
    reset.focus({ preventScroll: true });
    reset.click();
  })()`);
  const resetFromSidebar = await waitForValue(session, `(() => {
    return {
      open: document.querySelector("[data-filter-dialog]").open,
      expanded: document.querySelector("[data-filter-toggle]")
        .getAttribute("aria-expanded"),
      products: document.querySelectorAll("[data-product-entry]").length,
      heroHidden: document.querySelector(".hero").classList.contains("is-search-hidden"),
      locked: document.body.classList.contains("filters-open"),
      mainInert: document.querySelector("main").inert,
      clearHidden: document.querySelector("[data-clear]").hidden,
      resetHidden: document.querySelector("[data-filter-reset]").hidden,
      focusedApply: document.activeElement ===
        document.querySelector("[data-filter-apply]"),
      counts: [...document.querySelectorAll("[data-filter-group-count]")]
        .map((count) => count.textContent),
      checked: document.querySelectorAll("[data-filter-family]:checked").length,
      min: Number(document.querySelector("[data-filter-price-min]").value),
      max: Number(document.querySelector("[data-filter-price-max]").value),
      windowScrollY: window.scrollY,
      bodyTop: document.body.style.top,
      backgroundTop: document.querySelector("#catalogue-title")
        .getBoundingClientRect().top,
      scrollTop: document.querySelector("[data-filter-scroll-region]").scrollTop,
      applyTop: document.querySelector("[data-filter-apply]")
        .getBoundingClientRect().top,
    };
  })()`, (snapshot) => snapshot.open && snapshot.locked &&
    snapshot.resetHidden && snapshot.counts.every((count) => count === "0")
  );
  check(
    "Limpiar dentro del sidebar conserva diálogo, bloqueo y geometría mientras reinicia filtros",
    resetFromSidebar.open && resetFromSidebar.expanded === "true" &&
      resetFromSidebar.locked && resetFromSidebar.mainInert &&
      resetFromSidebar.products === expectedProductCount &&
      !resetFromSidebar.heroHidden &&
      resetFromSidebar.clearHidden && resetFromSidebar.resetHidden &&
      resetFromSidebar.focusedApply && resetFromSidebar.checked === 0 &&
      resetFromSidebar.min === catalogueFacets.minPrice &&
      resetFromSidebar.max === catalogueFacets.maxPrice &&
      resetFromSidebar.counts.every((count) => count === "0") &&
      resetFromSidebar.windowScrollY === resetFromSidebarBefore.windowScrollY &&
      resetFromSidebar.bodyTop === resetFromSidebarBefore.bodyTop &&
      Math.abs(
        resetFromSidebar.backgroundTop - resetFromSidebarBefore.backgroundTop
      ) <= 1 && resetFromSidebar.scrollTop === resetFromSidebarBefore.scrollTop &&
      Math.abs(resetFromSidebar.applyTop - resetFromSidebarBefore.applyTop) <= 0.5,
    JSON.stringify({ resetFromSidebarBefore, resetFromSidebar }),
  );
  await session.evaluate('document.querySelector("[data-filter-close]").click()');
  await waitForValue(
    session,
    `!document.querySelector("[data-filter-dialog]").open &&
      !document.body.classList.contains("filters-open")`,
    Boolean,
  );

  stage("desktop 1440: ficha y galería");
  const dialog = await session.evaluate(`(async () => {
    const trigger = document.querySelector(
      '[data-product-entry=${JSON.stringify(firstProduct.id)}] .catalogue-product-visual'
    );
    trigger.click();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const gallery = document.querySelector(".dialog-gallery");
    const stage = document.querySelector("[data-gallery-stage]");
    const frame = document.querySelector("[data-gallery-image-frame]");
    const image = document.querySelector("[data-gallery-image]");
    const label = stage.querySelector(".image-kind-label");
    const thumbnails = document.querySelector("[data-gallery-thumbnails]");
    const position = document.querySelector("[data-gallery-position]");
    const count = position.querySelector("[data-gallery-position-count]");
    const frameRect = frame.getBoundingClientRect();
    const labelRect = label.getBoundingClientRect();
    const positionRect = position.getBoundingClientRect();
    const countRect = count.getBoundingClientRect();
    const thumbStyle = getComputedStyle(thumbnails);
    const positionStyle = getComputedStyle(position);
    const stageStyle = getComputedStyle(stage);
    const nextRect = document.querySelector("[data-gallery-next]").getBoundingClientRect();
    const previousRect = document.querySelector("[data-gallery-previous]").getBoundingClientRect();
    const galleryRect = gallery.getBoundingClientRect();
    const nextControl = document.querySelector("[data-gallery-next]");
    const previousControl = document.querySelector("[data-gallery-previous]");
    const thumbnailsRect = thumbnails.getBoundingClientRect();
    const cta = document.querySelector("[data-dialog-whatsapp]");
    const dialogHeader = document.querySelector(".dialog-header");
    const close = document.querySelector("[data-dialog-close]");
    const dialogHeaderRect = dialogHeader.getBoundingClientRect();
    const closeRect = close.getBoundingClientRect();
    const closeStyle = getComputedStyle(close);
    const productStyle = getComputedStyle(document.querySelector(".dialog-product"));
    const priceStyle = getComputedStyle(document.querySelector(".dialog-price"));
    return {
      open: document.querySelector("[data-product-dialog]").open,
      focusClose: document.activeElement === document.querySelector("[data-dialog-close]"),
      bodyLocked: document.body.classList.contains("dialog-open"),
      mainInert: document.querySelector("main").inert,
      thumbs: document.querySelectorAll("[data-gallery-thumbnail]").length,
      position: position.textContent.trim(),
      positionAfterThumbnails: thumbnails.nextElementSibling === position,
      positionCentered: Math.abs(
        (positionRect.left + positionRect.right) / 2 -
        (countRect.left + countRect.right) / 2
      ) <= 1,
      positionOverflow: position.scrollWidth > position.clientWidth,
      positionChildren: position.children.length,
      residualPositionText: /[·]|visualización referencial generada con IA|fotografía real de la prenda/i
        .test(position.textContent),
      horizontalLines: [
        thumbStyle.borderTopWidth, thumbStyle.borderBottomWidth,
        positionStyle.borderTopWidth, positionStyle.borderBottomWidth,
        stageStyle.borderBottomWidth
      ],
      isAi: stage.classList.contains("is-ai"),
      labelCount: stage.querySelectorAll(".image-kind-label").length,
      labelText: label.textContent.trim(),
      labelVisible: getComputedStyle(label).display !== "none" && labelRect.width > 0,
      labelInside: labelRect.left >= frameRect.left - 0.5 &&
        labelRect.top >= frameRect.top - 0.5 &&
        labelRect.right <= frameRect.right + 0.5 &&
        labelRect.bottom <= frameRect.bottom + 0.5,
      galleryUserSelect: getComputedStyle(gallery).userSelect,
      imagesNotDraggable: [...gallery.querySelectorAll("img")]
        .every((candidate) => !candidate.draggable),
      ctaHref: cta.href,
      ctaHasWhatsapp: Boolean(cta.querySelector(".button-whatsapp-icon use[href='#whatsapp-icon']")),
      ctaHasArrow: Boolean(cta.querySelector(".cta-arrow")),
      controlPoints: {
        next: { x: nextRect.left + nextRect.width / 2, y: nextRect.top + nextRect.height / 2 },
        previous: { x: previousRect.left + previousRect.width / 2, y: previousRect.top + previousRect.height / 2 },
      },
      controlsRelativeToGallery:
        nextControl.offsetParent === gallery && previousControl.offsetParent === gallery,
      controlCenterDelta: [nextRect, previousRect].map((rect) =>
        Math.abs(
          (rect.top + rect.bottom) / 2 -
          (galleryRect.top + galleryRect.bottom) / 2
        )
      ),
      controlsSameHeight: Math.abs(
        (nextRect.top + nextRect.bottom) / 2 -
        (previousRect.top + previousRect.bottom) / 2
      ),
      controlsClearThumbnails:
        nextRect.bottom < thumbnailsRect.top && previousRect.bottom < thumbnailsRect.top,
      closeLayout: {
        position: closeStyle.position,
        offsetParentIsHeader: close.offsetParent === dialogHeader,
        top: closeStyle.top,
        right: closeStyle.right,
        topGap: closeRect.top - dialogHeaderRect.top,
        rightGap: dialogHeaderRect.right - closeRect.right,
      },
      productPaddingTop: productStyle.paddingTop,
      priceMarginTop: priceStyle.marginTop,
      imageSrc: image.getAttribute("src"),
    };
  })()`);
  check(
    "ficha abre con foco, bloqueo y galería completa",
    dialog.open && dialog.focusClose && dialog.bodyLocked && dialog.mainInert &&
      dialog.thumbs === firstProductImages.length,
    JSON.stringify(dialog),
  );
  check(
    "gallery-position queda bajo thumbnails, centrado y sin frases residuales",
    dialog.positionAfterThumbnails && dialog.positionCentered &&
      !dialog.positionOverflow && dialog.positionChildren === 1 &&
      !dialog.residualPositionText &&
      dialog.position === `Imagen 1 de ${firstProductImages.length}`,
    JSON.stringify(dialog),
  );
  check(
    "thumbnails y vecinos no dibujan líneas horizontales grises",
    dialog.horizontalLines.every((width) => width === "0px"),
    JSON.stringify(dialog.horizontalLines),
  );
  check(
    "imagen IA inicial muestra un solo label dentro de la imagen",
    dialog.isAi === (firstProductInitialImage.kind === AI_IMAGE_KIND) &&
      dialog.labelCount === 1 && dialog.labelText === "Visualización IA" &&
      dialog.labelVisible === (firstProductInitialImage.kind === AI_IMAGE_KIND) &&
      dialog.labelInside && dialog.imageSrc === firstProductInitialImage.src,
    JSON.stringify(dialog),
  );
  check(
    "galería bloquea selección accidental y arrastre nativo localmente",
    dialog.galleryUserSelect === "none" && dialog.imagesNotDraggable,
    JSON.stringify(dialog),
  );
  check(
    "controles se centran verticalmente respecto de dialog-gallery",
    dialog.controlsRelativeToGallery &&
      dialog.controlCenterDelta.every((delta) => delta <= 1) &&
      dialog.controlsSameHeight <= 1 && dialog.controlsClearThumbnails,
    JSON.stringify({
      controlsRelativeToGallery: dialog.controlsRelativeToGallery,
      controlCenterDelta: dialog.controlCenterDelta,
      controlsSameHeight: dialog.controlsSameHeight,
      controlsClearThumbnails: dialog.controlsClearThumbnails,
    }),
  );
  check(
    "ficha desktop coloca el cierre a 28 px arriba/derecha sin mover contenido",
    dialog.closeLayout.position === "absolute" &&
      dialog.closeLayout.offsetParentIsHeader &&
      dialog.closeLayout.top === "28px" && dialog.closeLayout.right === "28px" &&
      Math.abs(dialog.closeLayout.topGap - 28) <= 0.5 &&
      Math.abs(dialog.closeLayout.rightGap - 28) <= 0.5 &&
      dialog.productPaddingTop === "10px" && dialog.priceMarginTop === "10px",
    JSON.stringify({
      closeLayout: dialog.closeLayout,
      productPaddingTop: dialog.productPaddingTop,
      priceMarginTop: dialog.priceMarginTop,
    }),
  );

  const galleryControlRest = await session.evaluate(`(() => {
    const snapshot = (selector) => {
      const control = document.querySelector(selector);
      const rect = control.getBoundingClientRect();
      return {
        rect: [rect.left, rect.top, rect.width, rect.height],
        background: getComputedStyle(control).backgroundColor,
      };
    };
    const probe = document.createElement("span");
    probe.style.background = "var(--chartreuse)";
    document.body.append(probe);
    const chartreuse = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return {
      chartreuse,
      next: snapshot("[data-gallery-next]"),
      previous: snapshot("[data-gallery-previous]"),
    };
  })()`);
  await moveMouse(session, dialog.controlPoints.next);
  const nextControlHover = await waitForValue(session, `(() => {
    const control = document.querySelector("[data-gallery-next]");
    const rect = control.getBoundingClientRect();
    return {
      rect: [rect.left, rect.top, rect.width, rect.height],
      background: getComputedStyle(control).backgroundColor,
    };
  })()`, (snapshot) => snapshot.background === galleryControlRest.chartreuse);
  await moveMouse(session, dialog.controlPoints.previous);
  const previousControlHover = await waitForValue(session, `(() => {
    const control = document.querySelector("[data-gallery-previous]");
    const rect = control.getBoundingClientRect();
    return {
      rect: [rect.left, rect.top, rect.width, rect.height],
      background: getComputedStyle(control).backgroundColor,
    };
  })()`, (snapshot) => snapshot.background === galleryControlRest.chartreuse);
  await moveMouse(session, { x: 2, y: 2 });
  const rectsMatch = (first, second) => first.every(
    (value, index) => Math.abs(value - second[index]) <= 0.5,
  );
  check(
    "hover desktop vuelve amarillos ambos controles sin cambiar sus coordenadas",
    nextControlHover.background === galleryControlRest.chartreuse &&
      previousControlHover.background === galleryControlRest.chartreuse &&
      rectsMatch(nextControlHover.rect, galleryControlRest.next.rect) &&
      rectsMatch(previousControlHover.rect, galleryControlRest.previous.rect),
    JSON.stringify({ galleryControlRest, nextControlHover, previousControlHover }),
  );
  check(
    "Consultar esta prenda usa WhatsApp sin la flecha anterior",
    dialog.ctaHasWhatsapp && !dialog.ctaHasArrow &&
      dialog.ctaHref === makeProductWhatsappUrl(firstProduct),
    JSON.stringify({ href: dialog.ctaHref }),
  );

  await pressKey(session, "Tab", "Tab", 9);
  const galleryKeyboardFocus = await session.evaluate(`(() => ({
    previousFocused: document.activeElement === document.querySelector("[data-gallery-previous]"),
    focusVisible: document.activeElement.matches(":focus-visible"),
    outline: getComputedStyle(document.activeElement).outlineStyle,
  }))()`);
  check(
    "controles de galería conservan foco visible por teclado",
    galleryKeyboardFocus.previousFocused && galleryKeyboardFocus.focusVisible &&
      galleryKeyboardFocus.outline !== "none",
    JSON.stringify(galleryKeyboardFocus),
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
      userSelect: getComputedStyle(description).userSelect,
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

  await session.evaluate("getSelection().removeAllRanges()");
  await rapidClickPoint(session, dialog.controlPoints.next, 10);
  await rapidClickPoint(session, dialog.controlPoints.previous, 10);
  await wait(250);
  const rapidGalleryControls = await session.evaluate(`(() => {
    const selection = getSelection();
    const gallery = document.querySelector(".dialog-gallery");
    return {
      position: document.querySelector("[data-gallery-position]").textContent.trim(),
      selection: selection?.toString() ?? "",
      rangeCount: selection?.rangeCount ?? 0,
      anchorInsideGallery: selection?.anchorNode
        ? gallery.contains(selection.anchorNode) : false,
    };
  })()`);
  check(
    "diez pulsaciones rápidas por control no seleccionan la galería",
    rapidGalleryControls.position === `Imagen 1 de ${firstProductImages.length}` &&
      rapidGalleryControls.selection === "" &&
      rapidGalleryControls.rangeCount === 0 &&
      !rapidGalleryControls.anchorInsideGallery,
    JSON.stringify(rapidGalleryControls),
  );

  const snapshotForIndex = async (index, action) => {
    await session.evaluate(action);
    return waitForGallerySnapshot(
      session,
      `Imagen ${index + 1} de ${firstProductImages.length}`,
    );
  };
  const nextSnapshot = await snapshotForIndex(
    1,
    'document.querySelector("[data-gallery-next]").click()',
  );
  const previousSnapshot = await snapshotForIndex(
    0,
    'document.querySelector("[data-gallery-previous]").click()',
  );
  const realSnapshot = await snapshotForIndex(
    firstRealImageIndex,
    `document.querySelector('[data-gallery-thumbnail="${firstRealImageIndex}"]').click()`,
  );
  const firstThumbnailSnapshot = await snapshotForIndex(
    0,
    'document.querySelector(\'[data-gallery-thumbnail="0"]\').click()',
  );
  check(
    "botones y thumbnails actualizan posición, tipo y label según los datos",
    nextSnapshot.src === firstProductNextImage.src &&
      nextSnapshot.isAi === (firstProductNextImage.kind === AI_IMAGE_KIND) &&
      nextSnapshot.labelVisible === (firstProductNextImage.kind === AI_IMAGE_KIND) &&
      previousSnapshot.src === firstProductInitialImage.src &&
      previousSnapshot.isAi === (firstProductInitialImage.kind === AI_IMAGE_KIND) &&
      realSnapshot.src === firstProductImages[firstRealImageIndex].src &&
      !realSnapshot.isAi && !realSnapshot.labelVisible &&
      firstThumbnailSnapshot.src === firstProductInitialImage.src &&
      firstThumbnailSnapshot.isAi && firstThumbnailSnapshot.labelVisible,
    JSON.stringify({ nextSnapshot, previousSnapshot, realSnapshot, firstThumbnailSnapshot }),
  );

  await pressKey(session, "ArrowRight", "ArrowRight", 39);
  const keyboardNext = await waitForGallerySnapshot(
    session,
    `Imagen 2 de ${firstProductImages.length}`,
  );
  await pressKey(session, "ArrowLeft", "ArrowLeft", 37);
  const keyboardPrevious = await waitForGallerySnapshot(
    session,
    `Imagen 1 de ${firstProductImages.length}`,
  );
  check(
    "teclado navega y mantiene position, clase y label sincronizados",
    keyboardNext.src === firstProductNextImage.src &&
      keyboardNext.isAi === (firstProductNextImage.kind === AI_IMAGE_KIND) &&
      keyboardNext.labelVisible === (firstProductNextImage.kind === AI_IMAGE_KIND) &&
      keyboardPrevious.src === firstProductInitialImage.src &&
      keyboardPrevious.isAi === (firstProductInitialImage.kind === AI_IMAGE_KIND) &&
      keyboardPrevious.labelVisible === (firstProductInitialImage.kind === AI_IMAGE_KIND),
    JSON.stringify({ keyboardNext, keyboardPrevious }),
  );

  await pressKey(session, "Escape", "Escape", 27);
  await wait(80);
  const closed = await session.evaluate(`(() => ({
    open: document.querySelector("[data-product-dialog]").open,
    focusReturned: document.activeElement.matches(
      '[data-product-entry=${JSON.stringify(firstProduct.id)}] .catalogue-product-visual'
    ),
    unlocked: !document.body.classList.contains("dialog-open") &&
      !document.querySelector("main").inert,
  }))()`);
  check(
    "Escape cierra, desbloquea y devuelve foco al enlace visual",
    !closed.open && closed.focusReturned && closed.unlocked,
    JSON.stringify(closed),
  );

  const allProductDialogs = { failures: [], bodyUnlocked: true };
  for (const product of products) {
    const productDialog = await session.evaluate(`(() => {
      const id = ${JSON.stringify(product.id)};
      const expected = ${JSON.stringify(product.name)};
      const trigger = document.querySelector(
        '[data-product-entry="' + id + '"] .catalogue-product-visual'
      );
      trigger?.click();
      const dialog = document.querySelector("[data-product-dialog]");
      const title = document.querySelector("[data-dialog-name]").textContent.trim();
      const snapshot = {
        id,
        trigger: Boolean(trigger),
        open: dialog.open,
        title,
        expected,
      };
      document.querySelector("[data-dialog-close]").click();
      snapshot.bodyUnlocked = !document.body.classList.contains("dialog-open") &&
        !document.querySelector("main").inert;
      return snapshot;
    })()`);
    if (
      !productDialog.trigger ||
      !productDialog.open ||
      productDialog.title !== productDialog.expected ||
      !productDialog.bodyUnlocked
    ) {
      allProductDialogs.failures.push(productDialog);
    }
    allProductDialogs.bodyUnlocked &&= productDialog.bodyUnlocked;
  }
  check(
    "las fichas de las 30 prendas abren y cierran desde la fuente común",
    allProductDialogs.failures.length === 0 && allProductDialogs.bodyUnlocked,
    JSON.stringify(allProductDialogs),
  );

  stage("desktop 960: breakpoint cercano");
  await load(session, 960, 900, `browser-near-desktop=${Date.now()}`);
  const nearDesktop = await session.evaluate(`(() => {
    const header = document.querySelector("[data-header]");
    const nodes = [
      header.querySelector(".wordmark"),
      header.querySelector("[data-search-form]"),
      header.querySelector("[data-navigation]"),
      header.querySelector(".header-actions"),
    ].map((node) => node.getBoundingClientRect());
    const sort = document.querySelector(".sort-field").getBoundingClientRect();
    const sortControl = document.querySelector("[data-sort]")
      .getBoundingClientRect();
    const whatsapp = header.querySelector(".header-whatsapp").getBoundingClientRect();
    const filter = document.querySelector("[data-filter-toggle]")
      .getBoundingClientRect();
    return {
      viewport: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      searchVisible: getComputedStyle(document.querySelector("[data-search-panel]")).visibility === "visible",
      menuHidden: getComputedStyle(document.querySelector("[data-menu-toggle]")).display === "none",
      nonOverlapping: nodes.every((rect, index) =>
        index === 0 || nodes[index - 1].right <= rect.left + 0.5
      ),
      headerInside: nodes.every((rect) => rect.left >= 0 && rect.right <= innerWidth),
      outerMargins: [nodes[0].left, innerWidth - nodes[3].right],
      blockGaps: [
        nodes[1].left - nodes[0].right,
        nodes[2].left - nodes[1].right,
        nodes[3].left - nodes[2].right,
      ],
      faqText: header.querySelector('a[href="#preguntas"]').innerText.trim(),
      toolbarAligned: Math.abs(sort.right - whatsapp.right) <= 1 &&
        Math.abs(sortControl.right - whatsapp.right) <= 1 &&
        Math.abs((sort.top + sort.bottom) / 2 -
          (filter.top + filter.bottom) / 2) <= 1,
    };
  })()`);
  const nearDesktopLayout = await layoutSnapshot(session);
  check(
    "desktop cercano al breakpoint conserva navbar y cuatro columnas sin overflow",
    nearDesktop.searchVisible && nearDesktop.menuHidden &&
      nearDesktop.nonOverlapping && nearDesktop.headerInside &&
      nearDesktop.documentWidth === nearDesktop.viewport &&
      nearDesktopLayout.columns === 4 && nearDesktop.faqText === "FAQ" &&
      nearDesktop.toolbarAligned &&
      Math.abs(nearDesktop.outerMargins[0] - nearDesktop.outerMargins[1]) <= 1 &&
      Math.max(...nearDesktop.blockGaps) - Math.min(...nearDesktop.blockGaps) <= 1,
    JSON.stringify({ nearDesktop, nearDesktopLayout }),
  );

  await load(
    session,
    960,
    900,
    `browser-direct-hash=${Date.now()}`,
    "concepto",
  );
  const directHash = await waitForValue(session, `(() => {
    const header = document.querySelector("[data-header]").getBoundingClientRect();
    const heading = document.querySelector("#concept-title").getBoundingClientRect();
    const root = getComputedStyle(document.documentElement);
    const rawGap = root.getPropertyValue("--anchor-title-gap").trim();
    const value = parseFloat(rawGap);
    const expectedGap = rawGap.endsWith("rem")
      ? value * parseFloat(root.fontSize) : value;
    return {
      hash: location.hash,
      gap: heading.top - header.bottom,
      expectedGap,
    };
  })()`, (snapshot) =>
    snapshot.hash === "#concepto" &&
    Math.abs(snapshot.gap - snapshot.expectedGap) <= 1.5
  );
  check(
    "enlace directo con hash aplica el mismo offset centralizado",
    directHash.hash === "#concepto" &&
      Math.abs(directHash.gap - directHash.expectedGap) <= 1.5,
    JSON.stringify(directHash),
  );

  stage("desktop 1920: distribución ancha");
  await load(session, 1920, 1080, `browser-wide-desktop=${Date.now()}`);
  const wideDesktop = await session.evaluate(`(() => {
    const header = document.querySelector("[data-header]");
    const nodes = [
      header.querySelector(".wordmark"),
      header.querySelector("[data-search-form]"),
      header.querySelector("[data-navigation]"),
      header.querySelector(".header-actions"),
    ].map((node) => node.getBoundingClientRect());
    const sort = document.querySelector(".sort-field").getBoundingClientRect();
    const sortControl = document.querySelector("[data-sort]")
      .getBoundingClientRect();
    const whatsapp = header.querySelector(".header-whatsapp").getBoundingClientRect();
    return {
      documentWidth: document.documentElement.scrollWidth,
      viewport: innerWidth,
      margins: [nodes[0].left, innerWidth - nodes[3].right],
      gaps: [
        nodes[1].left - nodes[0].right,
        nodes[2].left - nodes[1].right,
        nodes[3].left - nodes[2].right,
      ],
      sortAlignedWithWhatsapp: Math.abs(sort.right - whatsapp.right) <= 1 &&
        Math.abs(sortControl.right - whatsapp.right) <= 1,
    };
  })()`);
  const wideDesktopLayout = await layoutSnapshot(session);
  check(
    "desktop ancho mantiene cuatro columnas, espacios equilibrados y sin overflow",
    wideDesktop.documentWidth === wideDesktop.viewport &&
      wideDesktopLayout.columns === 4 &&
      wideDesktop.sortAlignedWithWhatsapp &&
      Math.abs(wideDesktop.margins[0] - wideDesktop.margins[1]) <= 1 &&
      Math.max(...wideDesktop.gaps) - Math.min(...wideDesktop.gaps) <= 1,
    JSON.stringify({ wideDesktop, wideDesktopLayout }),
  );

  stage("tablet 768: navbar, grid y ficha");
  await load(session, 768, 1024, `browser-tablet=${Date.now()}`);
  const tabletLayout = await layoutSnapshot(session);
  const tablet = await session.evaluate(`(() => ({
    viewport: innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    searchToggleVisible: getComputedStyle(document.querySelector("[data-search-toggle]")).display !== "none",
    menuVisible: getComputedStyle(document.querySelector("[data-menu-toggle]")).display !== "none",
  }))()`);
  check(
    "tablet usa dos columnas y navbar móvil sin overflow",
    tabletLayout.columns === 2 && tabletLayout.gap >= 4 &&
      tabletLayout.gap <= 5 && tablet.searchToggleVisible &&
      tablet.menuVisible && tablet.documentWidth === tablet.viewport,
    JSON.stringify({ tablet, tabletLayout }),
  );

  await session.evaluate(`document.querySelector(
    '[data-product-entry=${JSON.stringify(firstProduct.id)}] .catalogue-product-visual'
  ).click()`);
  await wait(80);
  const tabletDialog = await session.evaluate(`(() => {
    const dialog = document.querySelector("[data-product-dialog]");
    const gallery = document.querySelector(".dialog-gallery");
    const thumbnails = document.querySelector("[data-gallery-thumbnails]");
    const position = document.querySelector("[data-gallery-position]");
    const frame = document.querySelector("[data-gallery-image-frame]").getBoundingClientRect();
    const label = document.querySelector("[data-gallery-stage] .image-kind-label").getBoundingClientRect();
    const galleryRect = gallery.getBoundingClientRect();
    const controls = [
      document.querySelector("[data-gallery-previous]"),
      document.querySelector("[data-gallery-next]"),
    ];
    return {
      noOverflow: dialog.scrollWidth <= dialog.clientWidth,
      positionAfterThumbnails: thumbnails.nextElementSibling === position,
      labelInside: label.left >= frame.left - 0.5 && label.top >= frame.top - 0.5 &&
        label.right <= frame.right + 0.5 && label.bottom <= frame.bottom + 0.5,
      controlsCentered: controls.every((control) => {
        const rect = control.getBoundingClientRect();
        return control.offsetParent === gallery && Math.abs(
          (rect.top + rect.bottom) / 2 -
          (galleryRect.top + galleryRect.bottom) / 2
        ) <= 1;
      }),
    };
  })()`);
  check(
    "ficha tablet conserva orden, label y ausencia de overflow",
    tabletDialog.noOverflow && tabletDialog.positionAfterThumbnails &&
      tabletDialog.labelInside && tabletDialog.controlsCentered,
    JSON.stringify(tabletDialog),
  );
  await session.evaluate('document.querySelector("[data-dialog-close]").click()');
  await wait(80);

  stage("mobile 430: grid");
  await load(session, 430, 932, `browser-mobile-wide=${Date.now()}`);
  const mobileWideLayout = await layoutSnapshot(session);
  check(
    "mobile ancho conserva dos columnas y gap sin overflow",
    mobileWideLayout.columns === 2 && mobileWideLayout.gap >= 4 &&
      mobileWideLayout.gap <= 5 &&
      mobileWideLayout.documentWidth === mobileWideLayout.viewport,
    JSON.stringify(mobileWideLayout),
  );

  stage("mobile 360: navbar y búsqueda");
  await load(session, 360, 800, `browser-mobile-narrow=${Date.now()}`);
  const mobileLayout = await layoutSnapshot(session);
  const mobile = await session.evaluate(`(() => {
    const search = document.querySelector("[data-search-toggle]");
    const instagram = document.querySelector("[data-instagram]");
    const whatsapp = document.querySelector("[data-collection-whatsapp]");
    const menu = document.querySelector("[data-menu-toggle]");
    const controls = [search, instagram, whatsapp, menu].map((node) => {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return {
        x: rect.left,
        right: rect.right,
        width: rect.width,
        height: rect.height,
        border: style.border,
        background: style.backgroundColor,
        color: style.color,
      };
    });
    const filter = document.querySelector("[data-filter-toggle]").getBoundingClientRect();
    const clearButton = document.querySelector("[data-clear]");
    const clear = clearButton.getBoundingClientRect();
    const tools = document.querySelector("[data-catalogue-tools]");
    const sort = document.querySelector(".sort-field").getBoundingClientRect();
    const status = document.querySelector("[data-results-status]").getBoundingClientRect();
    const sortLabel = document.querySelector(".sort-field label").getBoundingClientRect();
    const sortSelect = document.querySelector(".sort-field select").getBoundingClientRect();
    return {
      viewport: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      headerBackground: getComputedStyle(
        document.querySelector("[data-header]")
      ).backgroundColor,
      controls,
      order: controls.every((control, index) =>
        index === 0 || controls[index - 1].right <= control.x + 0.5
      ),
      sameVisuals: controls.slice(1).every((control) =>
        JSON.stringify({ ...control, x: 0, right: 0 }) ===
        JSON.stringify({ ...controls[0], x: 0, right: 0 })
      ),
      whatsappHref: whatsapp.href,
      heroControls: document.querySelectorAll(".hero-controls").length,
      inlineDetails: document.querySelectorAll(".product-inline-details").length,
      toolbar: {
        filter: { left: filter.left, right: filter.right, top: filter.top, bottom: filter.bottom },
        clear: { left: clear.left, right: clear.right, top: clear.top, bottom: clear.bottom },
        clearHidden: clearButton.hidden,
        sort: { left: sort.left, right: sort.right, top: sort.top, bottom: sort.bottom },
        sortMaxWidth: getComputedStyle(
          document.querySelector(".sort-field")
        ).maxWidth,
        status: {
          left: status.left, right: status.right,
          top: status.top, bottom: status.bottom,
        },
        sortHorizontal: sortLabel.right <= sortSelect.left + 0.5 &&
          Math.abs((sortLabel.top + sortLabel.bottom) / 2 -
            (sortSelect.top + sortSelect.bottom) / 2) <= 1,
        toolsPaddingBottom: parseFloat(getComputedStyle(tools).paddingBottom),
      },
      sectionHeadingMargin: getComputedStyle(
        document.querySelector(".section-heading")
      ).marginBottom,
    };
  })()`);
  check(
    "navbar móvil ordena buscador, Instagram, WhatsApp y menú",
    mobile.order && mobile.controls.every((control) =>
      control.width >= 44 && control.height >= 44
    ) && mobile.whatsappHref === expectedCollectionWhatsapp,
    JSON.stringify(mobile),
  );
  check(
    "botones móviles comparten dimensiones y estilo sin overflow",
    mobile.sameVisuals && mobile.documentWidth === mobile.viewport &&
      mobile.headerBackground === "rgb(251, 250, 247)" &&
      mobileLayout.documentWidth === mobileLayout.viewport &&
      mobileLayout.columns === 2 && mobile.heroControls === 0 &&
      mobile.inlineDetails === 0,
    JSON.stringify({ mobile, mobileLayout }),
  );
  check(
    "toolbar móvil oculta Limpiar en reposo y conserva Ordenar en la segunda fila",
    mobile.toolbar.clearHidden && mobile.toolbar.clear.right === 0 &&
      mobile.toolbar.sort.top >= mobile.toolbar.filter.bottom &&
      mobile.toolbar.sort.left <= mobile.toolbar.filter.left + 1 &&
      mobile.toolbar.sort.right >= mobile.toolbar.status.right - 1 &&
      mobile.toolbar.sortMaxWidth === "none" &&
      mobile.toolbar.status.top - mobile.toolbar.sort.bottom >= 19 &&
      mobile.toolbar.status.top - mobile.toolbar.sort.bottom <= 21 &&
      Math.abs(
        mobile.toolbar.toolsPaddingBottom - desktop.toolsPaddingBottom
      ) <= 0.5 &&
      mobile.toolbar.sortHorizontal && mobile.sectionHeadingMargin === "30px",
    JSON.stringify(mobile.toolbar),
  );

  const mobileSortTouch = await session.evaluate(`(() => {
    const select = document.querySelector("[data-sort]");
    const before = select.getBoundingClientRect();
    select.dispatchEvent(new PointerEvent("pointerdown", {
      bubbles: true,
      isPrimary: true,
      pointerType: "touch",
    }));
    select.focus({ preventScroll: true });
    select.value = "price-desc";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    const after = select.getBoundingClientRect();
    const style = getComputedStyle(select);
    return {
      focused: document.activeElement === select,
      pointerClass: select.classList.contains("is-pointer-focused"),
      outlineStyle: style.outlineStyle,
      outlineColor: style.outlineColor,
      outlineWidth: style.outlineWidth,
      boxShadow: style.boxShadow,
      geometryStable: before.width === after.width && before.height === after.height,
    };
  })()`);
  check(
    "Ordenar por touch tampoco conserva el marco y mantiene su geometría",
    mobileSortTouch.focused && mobileSortTouch.pointerClass &&
      (mobileSortTouch.outlineStyle === "none" ||
        mobileSortTouch.outlineWidth === "0px" ||
        mobileSortTouch.outlineColor === "rgba(0, 0, 0, 0)") &&
      mobileSortTouch.boxShadow === "none" && mobileSortTouch.geometryStable,
    JSON.stringify(mobileSortTouch),
  );
  await session.evaluate(`(() => {
    const select = document.querySelector("[data-sort]");
    select.blur();
    select.value = "featured";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);

  stage("mobile 360: abrir y cerrar búsqueda con Escape");
  const mobileSearchTogglePoint = await session.evaluate(`(() => {
    const rect = document.querySelector("[data-search-toggle]").getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })()`);
  await clickPoint(session, mobileSearchTogglePoint);
  const mobileSearchOpened = await waitForValue(
    session,
    `(() => ({
      open: document.querySelector("[data-search-form]").classList.contains("is-open"),
      expanded: document.querySelector("[data-search-toggle]").getAttribute("aria-expanded"),
      ariaHidden: document.querySelector("[data-search-panel]").getAttribute("aria-hidden"),
      focused: document.activeElement === document.querySelector("[data-search]"),
      inputIds: document.querySelectorAll("#catalogue-search").length,
    }))()`,
    (snapshot) => snapshot.focused,
  );
  check(
    "botón móvil abre el único buscador y enfoca su input",
    mobileSearchOpened.open && mobileSearchOpened.expanded === "true" &&
      mobileSearchOpened.ariaHidden === "false" &&
      mobileSearchOpened.focused && mobileSearchOpened.inputIds === 1,
    JSON.stringify(mobileSearchOpened),
  );
  await pressKey(session, "Escape", "Escape", 27);
  const mobileSearchClosed = await waitForValue(
    session,
    `(() => ({
      open: document.querySelector("[data-search-form]").classList.contains("is-open"),
      expanded: document.querySelector("[data-search-toggle]").getAttribute("aria-expanded"),
      focusedToggle: document.activeElement === document.querySelector("[data-search-toggle]"),
    }))()`,
    (snapshot) => !snapshot.open && snapshot.focusedToggle,
  );
  check(
    "Escape cierra búsqueda móvil y devuelve el foco al botón",
    !mobileSearchClosed.open && mobileSearchClosed.expanded === "false" &&
      mobileSearchClosed.focusedToggle,
    JSON.stringify(mobileSearchClosed),
  );

  stage("mobile 360: cerrar búsqueda con clic fuera");
  const outsideClose = await session.evaluate(`(async () => {
    document.querySelector("[data-search-toggle]").click();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    document.querySelector("main").click();
    return {
      open: document.querySelector("[data-search-form]").classList.contains("is-open"),
      expanded: document.querySelector("[data-search-toggle]").getAttribute("aria-expanded"),
    };
  })()`);
  check(
    "clic fuera cierra el buscador móvil",
    !outsideClose.open && outsideClose.expanded === "false",
    JSON.stringify(outsideClose),
  );

  stage("mobile 360: filtrar desde búsqueda y enviar");
  const mobileSearchResult = await session.evaluate(`(async () => {
    document.querySelector("[data-search-toggle]").click();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const input = document.querySelector("[data-search]");
    input.value = ${JSON.stringify(searchProduct.id)};
    input.dispatchEvent(new Event("input", { bubbles: true }));
    const ids = [...document.querySelectorAll("[data-product-entry]")]
      .map((entry) => entry.dataset.productEntry);
    document.querySelector("[data-search-form]").requestSubmit();
    return {
      ids,
      panelClosed: !document.querySelector("[data-search-form]").classList.contains("is-open"),
      focusReturned: document.activeElement === document.querySelector("[data-search-toggle]"),
      heroHidden: document.querySelector(".hero").classList.contains("is-search-hidden"),
    };
  })()`);
  check(
    "búsqueda móvil comparte estado, filtra y cierra al enviar",
    mobileSearchResult.ids.join() === searchProduct.id &&
      mobileSearchResult.panelClosed && mobileSearchResult.focusReturned &&
      mobileSearchResult.heroHidden,
    JSON.stringify(mobileSearchResult),
  );
  await session.evaluate(`(() => {
    const input = document.querySelector("[data-search]");
    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  })()`);
  await wait(80);

  await session.evaluate(`(() => {
    const visual = document.querySelector(
      '[data-product-entry=${JSON.stringify(firstProduct.id)}] .catalogue-product-visual'
    );
    visual.focus();
  })()`);
  const mobileFocusedCard = await waitForValue(session, `(() => {
    const visual = document.querySelector(
      '[data-product-entry=${JSON.stringify(firstProduct.id)}] .catalogue-product-visual'
    );
    return {
      src: visual.querySelector("[data-card-image]").getAttribute("src"),
      activeKind: visual.dataset.cardActiveKind,
      overlayOpacity: parseFloat(getComputedStyle(
        visual.querySelector(".catalogue-product-detail-label")
      ).opacity),
    };
  })()`, (snapshot) => snapshot.overlayOpacity === 1);
  check(
    "dispositivo sin hover conserva la primera imagen al enfocar la tarjeta",
    mobileFocusedCard.src === firstProductModelImages[0].src &&
      mobileFocusedCard.activeKind === firstProductModelImages[0].kind &&
      mobileFocusedCard.overlayOpacity === 1,
    JSON.stringify(mobileFocusedCard),
  );

  stage("mobile 360: menú y apertura de ficha");
  const mobileMenu = await session.evaluate(`(() => {
    const toggle = document.querySelector("[data-menu-toggle]");
    toggle.click();
    const navigation = document.querySelector("[data-navigation]");
    const rect = navigation.getBoundingClientRect();
    const mobileFaqLabel = navigation.querySelector(".nav-label-mobile");
    const desktopFaqLabel = navigation.querySelector(".nav-label-desktop");
    return {
      expanded: toggle.getAttribute("aria-expanded"),
      open: navigation.classList.contains("is-open"),
      searchClosed: !document.querySelector("[data-search-form]").classList.contains("is-open"),
      faqText: mobileFaqLabel.textContent.trim(),
      faqLinks: navigation.querySelectorAll('a[href="#preguntas"]').length,
      mobileFaqVisible: getComputedStyle(mobileFaqLabel).display !== "none" &&
        mobileFaqLabel.getBoundingClientRect().width > 0,
      desktopFaqHidden: getComputedStyle(desktopFaqLabel).display === "none" &&
        desktopFaqLabel.getBoundingClientRect().width === 0,
      panelInside: rect.left >= 0 && rect.right <= innerWidth &&
        Math.abs(rect.width - innerWidth) <= 1,
    };
  })()`);
  stage("mobile 360: menú evaluado");
  check(
    "menú móvil abre sin competir con el buscador",
    mobileMenu.expanded === "true" && mobileMenu.open && mobileMenu.searchClosed &&
      mobileMenu.faqText === "PREGUNTAS FRECUENTES" &&
      mobileMenu.faqLinks === 1 && mobileMenu.mobileFaqVisible &&
      mobileMenu.desktopFaqHidden && mobileMenu.panelInside,
    JSON.stringify(mobileMenu),
  );

  const mobileMenuInside = await session.evaluate(`(() => {
    document.querySelector("[data-navigation] ul").dispatchEvent(
      new MouseEvent("click", { bubbles: true })
    );
    return {
      open: document.querySelector("[data-navigation]").classList.contains("is-open"),
      expanded: document.querySelector("[data-menu-toggle]").getAttribute("aria-expanded"),
    };
  })()`);
  check(
    "interactuar dentro del panel no cierra el menú móvil",
    mobileMenuInside.open && mobileMenuInside.expanded === "true",
    JSON.stringify(mobileMenuInside),
  );

  const mobileMenuOutside = await session.evaluate(`(() => {
    document.querySelector("main").click();
    return {
      open: document.querySelector("[data-navigation]").classList.contains("is-open"),
      expanded: document.querySelector("[data-menu-toggle]").getAttribute("aria-expanded"),
    };
  })()`);
  check(
    "clic exterior cierra menú y sincroniza clase y aria-expanded",
    !mobileMenuOutside.open && mobileMenuOutside.expanded === "false",
    JSON.stringify(mobileMenuOutside),
  );

  const repeatedMobilePanels = await session.evaluate(`(() => {
    const toggle = document.querySelector("[data-menu-toggle]");
    for (let index = 0; index < 3; index += 1) {
      toggle.click();
      document.querySelector("main").click();
    }
    toggle.click();
    document.querySelector("[data-search-toggle]").click();
    const searchReplacesMenu =
      !document.querySelector("[data-navigation]").classList.contains("is-open") &&
      document.querySelector("[data-search-form]").classList.contains("is-open");
    toggle.click();
    return {
      searchReplacesMenu,
      menuReplacesSearch:
        document.querySelector("[data-navigation]").classList.contains("is-open") &&
        !document.querySelector("[data-search-form]").classList.contains("is-open"),
      expanded: toggle.getAttribute("aria-expanded"),
    };
  })()`);
  check(
    "aperturas repetidas no superponen menú y buscador ni duplican cierres",
    repeatedMobilePanels.searchReplacesMenu &&
      repeatedMobilePanels.menuReplacesSearch &&
      repeatedMobilePanels.expanded === "true",
    JSON.stringify(repeatedMobilePanels),
  );
  await pressKey(session, "Escape", "Escape", 27);
  const menuEscape = await session.evaluate(`(() => ({
    open: document.querySelector("[data-navigation]").classList.contains("is-open"),
    focusedToggle: document.activeElement === document.querySelector("[data-menu-toggle]"),
    expanded: document.querySelector("[data-menu-toggle]").getAttribute("aria-expanded"),
  }))()`);
  check(
    "Escape cierra el menú móvil y devuelve el foco al toggle",
    !menuEscape.open && menuEscape.focusedToggle && menuEscape.expanded === "false",
    JSON.stringify(menuEscape),
  );

  stage("mobile 360: sidebar de filtros táctil");
  await session.send("Emulation.setTouchEmulationEnabled", {
    enabled: true,
    maxTouchPoints: 1,
  });
  let mobileFilterTouch;
  try {
    const mobileFilter = await session.evaluate(`(() => {
      document.querySelector("[data-filter-toggle]").click();
      const dialog = document.querySelector("[data-filter-dialog]");
      const rect = dialog.getBoundingClientRect();
      const apply = document.querySelector("[data-filter-apply]");
      const applyTopWithoutReset = apply.getBoundingClientRect().top;
      const input = document.querySelector('[data-filter-family="category"]');
      input.checked = true;
      input.dispatchEvent(new Event("change", { bubbles: true }));
      const reset = document.querySelector("[data-filter-reset]");
      const applyTopWithReset = apply.getBoundingClientRect().top;
      const resetRect = reset.getBoundingClientRect();
      const applyRect = apply.getBoundingClientRect();
      const backgroundTop = document.querySelector("#catalogue-title")
        .getBoundingClientRect().top;
      const bodyTop = document.body.style.top;
      const windowScrollY = window.scrollY;
      reset.focus({ preventScroll: true });
      reset.click();
      return {
        open: dialog.open,
        width: rect.width,
        viewport: innerWidth,
        outside: { x: Math.max(2, rect.left / 2), y: innerHeight / 2 },
        bodyLocked: document.body.classList.contains("filters-open"),
        resetState: {
          applyTopWithoutReset,
          applyTopWithReset,
          applyTopAfterReset: apply.getBoundingClientRect().top,
          resetBelowApply: resetRect.top >= applyRect.bottom,
          dialogOpen: dialog.open,
          resetHidden: reset.hidden,
          focusedApply: document.activeElement === apply,
          checked: document.querySelectorAll("[data-filter-family]:checked").length,
          counts: [...document.querySelectorAll("[data-filter-group-count]")]
            .map((count) => count.textContent),
          backgroundStable: Math.abs(
            document.querySelector("#catalogue-title").getBoundingClientRect().top -
            backgroundTop
          ) <= 1,
          bodyTopStable: document.body.style.top === bodyTop,
          windowScrollStable: window.scrollY === windowScrollY,
        },
      };
    })()`);
    await tapTouch(session, mobileFilter.outside);
    mobileFilterTouch = await waitForValue(
      session,
      `(() => ({
        open: document.querySelector("[data-filter-dialog]").open,
        expanded: document.querySelector("[data-filter-toggle]").getAttribute("aria-expanded"),
        bodyLocked: document.body.classList.contains("filters-open"),
        mainInert: document.querySelector("main").inert,
        focusedToggle: document.activeElement === document.querySelector("[data-filter-toggle]"),
      }))()`,
      (snapshot) => !snapshot.open && snapshot.focusedToggle,
    );
    mobileFilterTouch.opened = mobileFilter;
  } finally {
    await session.send("Emulation.setTouchEmulationEnabled", { enabled: false });
  }
  check(
    "drawer móvil cabe en viewport y toque exterior lo cierra sin bloqueo residual",
    mobileFilterTouch.opened.open && mobileFilterTouch.opened.bodyLocked &&
      mobileFilterTouch.opened.width < mobileFilterTouch.opened.viewport &&
      Math.abs(
        mobileFilterTouch.opened.resetState.applyTopWithoutReset -
        mobileFilterTouch.opened.resetState.applyTopWithReset
      ) <= 0.5 &&
      Math.abs(
        mobileFilterTouch.opened.resetState.applyTopWithoutReset -
        mobileFilterTouch.opened.resetState.applyTopAfterReset
      ) <= 0.5 && mobileFilterTouch.opened.resetState.resetBelowApply &&
      mobileFilterTouch.opened.resetState.dialogOpen &&
      mobileFilterTouch.opened.resetState.resetHidden &&
      mobileFilterTouch.opened.resetState.focusedApply &&
      mobileFilterTouch.opened.resetState.checked === 0 &&
      mobileFilterTouch.opened.resetState.counts.every((count) => count === "0") &&
      mobileFilterTouch.opened.resetState.backgroundStable &&
      mobileFilterTouch.opened.resetState.bodyTopStable &&
      mobileFilterTouch.opened.resetState.windowScrollStable &&
      !mobileFilterTouch.open && mobileFilterTouch.expanded === "false" &&
      !mobileFilterTouch.bodyLocked && !mobileFilterTouch.mainInert &&
      mobileFilterTouch.focusedToggle,
    JSON.stringify(mobileFilterTouch),
  );

  stage("mobile 360: abrir ficha");
  await session.evaluate(`document.querySelector(
    '[data-product-entry=${JSON.stringify(firstProduct.id)}] .catalogue-product-visual'
  ).click()`);
  stage("mobile 360: ficha abierta");
  await wait(80);
  const mobileDialog = await session.evaluate(`(() => {
    const dialog = document.querySelector("[data-product-dialog]");
    const gallery = document.querySelector(".dialog-gallery");
    const thumbnails = document.querySelector("[data-gallery-thumbnails]");
    const position = document.querySelector("[data-gallery-position]");
    const frame = document.querySelector("[data-gallery-image-frame]").getBoundingClientRect();
    const label = document.querySelector("[data-gallery-stage] .image-kind-label").getBoundingClientRect();
    const stageRect = document.querySelector("[data-gallery-stage]").getBoundingClientRect();
    const controls = [
      document.querySelector("[data-gallery-previous]"),
      document.querySelector("[data-gallery-next]"),
    ];
    const close = document.querySelector("[data-dialog-close]");
    const productStyle = getComputedStyle(document.querySelector(".dialog-product"));
    const priceStyle = getComputedStyle(document.querySelector(".dialog-price"));
    const rootStyle = getComputedStyle(document.documentElement);
    const toPixels = (value) => {
      const number = parseFloat(value);
      return value.trim().endsWith("rem")
        ? number * parseFloat(rootStyle.fontSize) : number;
    };
    return {
      noOverflow: dialog.scrollWidth <= dialog.clientWidth,
      positionAfterThumbnails: thumbnails.nextElementSibling === position,
      labelInside: label.left >= frame.left - 0.5 && label.top >= frame.top - 0.5 &&
        label.right <= frame.right + 0.5 && label.bottom <= frame.bottom + 0.5,
      ctaIcon: Boolean(document.querySelector("[data-dialog-whatsapp] .button-whatsapp-icon")),
      controlsCentered: controls.every((control) => {
        const rect = control.getBoundingClientRect();
        return control.offsetParent === gallery && Math.abs(
          (rect.top + rect.bottom) / 2 -
          (stageRect.top + stageRect.bottom) / 2
        ) <= 1;
      }),
      controlPoints: controls.map((control) => {
        const rect = control.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      }),
      closePosition: getComputedStyle(close).position,
      closeTop: getComputedStyle(close).top,
      closeRight: getComputedStyle(close).right,
      productPaddingTop: parseFloat(productStyle.paddingTop),
      expectedProductPaddingTop: toPixels(
        rootStyle.getPropertyValue("--space-5")
      ),
      priceMarginTop: parseFloat(priceStyle.marginTop),
      expectedPriceMarginTop: toPixels(
        rootStyle.getPropertyValue("--space-4")
      ),
    };
  })()`);
  stage("mobile 360: geometría de ficha evaluada");
  check(
    "ficha móvil centra controles respecto de la foto y conserva su estructura",
    mobileDialog.noOverflow && mobileDialog.positionAfterThumbnails &&
      mobileDialog.labelInside && mobileDialog.ctaIcon &&
      mobileDialog.controlsCentered && mobileDialog.closePosition === "static" &&
      mobileDialog.closeTop === "auto" && mobileDialog.closeRight === "auto" &&
      Math.abs(
        mobileDialog.productPaddingTop - mobileDialog.expectedProductPaddingTop
      ) <= 0.5 && Math.abs(
        mobileDialog.priceMarginTop - mobileDialog.expectedPriceMarginTop
      ) <= 0.5,
    JSON.stringify(mobileDialog),
  );

  stage("mobile 360: galería táctil");
  const baselineMaxTouchPoints = await session.evaluate("navigator.maxTouchPoints");
  await session.send("Emulation.setTouchEmulationEnabled", {
    enabled: true,
    maxTouchPoints: 1,
  });
  let touchEnvironment;
  let mobileSwipePoints;
  let afterSwipeLeft;
  let afterSwipeRight;

  try {
    const nextPressed = await pressControlSnapshot(
      session,
      mobileDialog.controlPoints[1],
      "[data-gallery-next]",
    );
    await waitForGallerySnapshot(
      session,
      `Imagen 2 de ${firstProductImages.length}`,
    );
    const previousPressed = await pressControlSnapshot(
      session,
      mobileDialog.controlPoints[0],
      "[data-gallery-previous]",
    );
    await waitForGallerySnapshot(
      session,
      `Imagen 1 de ${firstProductImages.length}`,
    );
    const pressedControls = [nextPressed, previousPressed];
    check(
      "los controles móviles conservan su posición mientras están presionados",
      pressedControls.every(({ before, during }) =>
        during.active &&
        during.rect.every((value, index) =>
          Math.abs(value - before.rect[index]) <= 0.5
        )
      ),
      JSON.stringify(pressedControls),
    );

    const touchControlBaseline = await session.evaluate(`(() =>
      [...document.querySelectorAll(
        "[data-gallery-previous], [data-gallery-next]"
      )].map((control) => {
        const rect = control.getBoundingClientRect();
        return {
          background: getComputedStyle(control).backgroundColor,
          rect: [rect.left, rect.top, rect.width, rect.height],
        };
      })
    )()`);
    for (let index = 0; index < 10; index += 1) {
      await tapTouch(session, mobileDialog.controlPoints[1]);
    }
    for (let index = 0; index < 10; index += 1) {
      await tapTouch(session, mobileDialog.controlPoints[0]);
    }
    const touchControlAfter = await waitForValue(session, `(() => ({
      position: document.querySelector("[data-gallery-position]").textContent.trim(),
      controls: [...document.querySelectorAll(
        "[data-gallery-previous], [data-gallery-next]"
      )].map((control) => {
        const rect = control.getBoundingClientRect();
        return {
          background: getComputedStyle(control).backgroundColor,
          active: control.matches(":active"),
          focusVisible: control.matches(":focus-visible"),
          rect: [rect.left, rect.top, rect.width, rect.height],
        };
      }),
    }))()`, (snapshot) =>
      snapshot.position === `Imagen 1 de ${firstProductImages.length}` &&
      snapshot.controls.every((control) => !control.active)
    );
    check(
      "veinte taps rápidos no dejan amarillo ni geometría residual en controles móviles",
      touchControlAfter.position === `Imagen 1 de ${firstProductImages.length}` &&
        touchControlAfter.controls.every((control, index) =>
          control.background === touchControlBaseline[index].background &&
          !control.active && !control.focusVisible &&
          control.rect.every((value, rectIndex) => Math.abs(
            value - touchControlBaseline[index].rect[rectIndex]
          ) <= 0.5)
        ),
      JSON.stringify({ touchControlBaseline, touchControlAfter }),
    );

    touchEnvironment = await session.evaluate(`(() => ({
      viewport: { width: innerWidth, height: innerHeight },
      maxTouchPoints: navigator.maxTouchPoints,
      mobileMedia: matchMedia("(max-width: 58rem)").matches,
    }))()`);
    mobileSwipePoints = await session.evaluate(`(async () => {
      const stage = document.querySelector("[data-gallery-stage]");
      const frame = document.querySelector("[data-gallery-image-frame]");
      stage.scrollIntoView({ block: "center", inline: "nearest" });
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const stageRect = stage.getBoundingClientRect();
      const frameRect = frame.getBoundingClientRect();
      const controls = [
        document.querySelector("[data-gallery-previous]").getBoundingClientRect(),
        document.querySelector("[data-gallery-next]").getBoundingClientRect(),
      ];
      const inset = Math.min(64, Math.max(28, frameRect.width * 0.18));
      const y = frameRect.top + frameRect.height * 0.28;
      const fromRight = { x: frameRect.right - inset, y };
      const fromLeft = { x: frameRect.left + inset, y };
      const inside = (point, rect) =>
        point.x > rect.left && point.x < rect.right &&
        point.y > rect.top && point.y < rect.bottom;
      const insideViewport = (point) =>
        point.x > 0 && point.x < innerWidth &&
        point.y > 0 && point.y < innerHeight;
      return {
        fromRight,
        fromLeft,
        distance: fromRight.x - fromLeft.x,
        safe: inside(fromRight, stageRect) && inside(fromLeft, stageRect) &&
          inside(fromRight, frameRect) && inside(fromLeft, frameRect) &&
          insideViewport(fromRight) && insideViewport(fromLeft) &&
          controls.every((control) =>
            !inside(fromRight, control) && !inside(fromLeft, control)
          ),
      };
    })()`);
    check(
      "swipe usa viewport móvil táctil y coordenadas interactivas seguras",
      touchEnvironment.viewport.width === 360 && touchEnvironment.mobileMedia &&
        touchEnvironment.maxTouchPoints >= 1 && mobileSwipePoints.safe &&
        mobileSwipePoints.distance > 50,
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

  const initialImageIsAi = firstProductInitialImage.kind === AI_IMAGE_KIND;
  const nextImageIsAi = firstProductNextImage.kind === AI_IMAGE_KIND;
  check(
    "swipe navega y sincroniza position, clase is-ai y label",
    afterSwipeLeft.position === `Imagen 2 de ${firstProductImages.length}` &&
      afterSwipeLeft.src === firstProductNextImage.src &&
      afterSwipeLeft.isAi === nextImageIsAi &&
      afterSwipeLeft.labelVisible === nextImageIsAi &&
      !afterSwipeLeft.updating &&
      afterSwipeRight.position === `Imagen 1 de ${firstProductImages.length}` &&
      afterSwipeRight.src === firstProductInitialImage.src &&
      afterSwipeRight.isAi === initialImageIsAi &&
      afterSwipeRight.labelVisible === initialImageIsAi &&
      !afterSwipeRight.updating,
    JSON.stringify({
      expectedKinds: {
        initial: firstProductInitialImage.kind,
        next: firstProductNextImage.kind,
      },
      afterSwipeLeft,
      afterSwipeRight,
    }),
  );
  const touchCleanup = await session.evaluate(`(() => {
    document.querySelector("[data-gallery-next]").click();
    document.querySelector("[data-gallery-previous]").click();
    const selection = getSelection();
    const gallery = document.querySelector(".dialog-gallery");
    return {
      maxTouchPoints: navigator.maxTouchPoints,
      position: document.querySelector("[data-gallery-position]").textContent.trim(),
      selection: selection?.toString() ?? "",
      anchorInsideGallery: selection?.anchorNode
        ? gallery.contains(selection.anchorNode) : false,
    };
  })()`);
  check(
    "swipe termina sin sesión táctil, selección ni estado residual",
    touchCleanup.maxTouchPoints === baselineMaxTouchPoints &&
      touchCleanup.position === `Imagen 1 de ${firstProductImages.length}` &&
      touchCleanup.selection === "" && !touchCleanup.anchorInsideGallery,
    JSON.stringify({ baselineMaxTouchPoints, touchCleanup }),
  );
  await session.evaluate('document.querySelector("[data-dialog-close]").click()');
  await wait(80);

  stage("mobile 360: fallback sin JavaScript");
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
    return event.method === "Log.entryAdded" &&
      event.params?.entry?.level === "error";
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
