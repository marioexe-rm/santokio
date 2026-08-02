# SanTokyo

Landing editorial y catálogo estático para una selección pequeña de prendas nuevas importadas desde Japón. El sitio prioriza fotografías reales, datos verificables y consulta directa por WhatsApp; no incluye carrito, checkout, pagos en línea ni backend.

## Arquitectura

```text
index.html                 estructura semántica, secciones y diálogo
styles.css                 sistema visual, responsive y estados
script.js                  render, carruseles, anclas, galería, foco y enlaces externos
data/products.js           configuración comercial y catálogo centralizado
assets/fonts/              Funnel Sans autoalojada y licencia OFL
assets/catalogo/           copias públicas sin metadatos privados
ropa/                      activos fuente locales del inventario, no versionados
DESIGN.md                  sistema visual implementado
PRODUCT.md                 autoridad sobre el producto
.impeccable/surfaces/      brief de la superficie
.github/workflows/pages.yml despliegue automático en GitHub Pages
```

No hay framework, bundler, dependencias de JavaScript ni proceso de compilación.

## Ejecutar localmente

Requiere un navegador moderno y Python 3. Desde la raíz:

```bash
python3 -m http.server 8000
```

Luego abre:

```text
http://127.0.0.1:8000/
```

No abras `index.html` directamente con `file://`: los módulos ES necesitan un servidor HTTP.

## Configurar contacto y entrega

Edita `SITE_CONFIG` en `data/products.js`:

- `whatsappNumber`: número internacional sin `+`, espacios ni guiones;
- `generalWhatsappMessage`: mensaje del contacto general;
- `instagramUrl` y `instagramLabel`: destino y nombre accesible compartidos por navbar y footer;
- `shippingCostClp`: costo fijo vigente del envío;
- `delivery`: modalidad vigente;
- `confirmationNote`: resumen que aparece en cada ficha.

El mensaje por producto se genera en `makeProductWhatsappUrl()` dentro de `script.js` e incluye automáticamente `name` e `id`.

## Editar marca y textos

- Wordmark y contenido editorial: `index.html`.
- Paleta, tipografía, ritmo, estados y responsive: `styles.css`.
- Tokens y reglas durables: `DESIGN.md`.
- Nombre de marca, locale y moneda: `SITE_CONFIG` en `data/products.js`.

Si se cambia la dirección visual, actualiza también `DESIGN.md` para que describa el resultado real.

## Editar productos

Cada objeto de `products` en `data/products.js` representa exactamente una carpeta directa de `ropa/`. Los datos desconocidos deben permanecer en `null` y con estado `unverified`.

`folder` conserva la ruta del inventario fuente. Las rutas `images[].src` apuntan
a las copias públicas correspondientes en `assets/catalogo/`, creadas sin
metadatos privados. Nunca publiques directamente los originales de `ropa/`.

Estados admitidos:

- `verified`: dato comprobado y publicable;
- `unverified`: pendiente; la interfaz mostrará una frase natural “por confirmar”;
- `not_applicable`: campo técnico que no requiere verificación, por ejemplo un identificador neutral.

No uses una visualización generada con IA para deducir talla, composición, medidas, calce, caída, proporciones, color exacto, construcción, marca, diseñador o país de fabricación.

### Añadir una prenda

1. Crea una carpeta directa nueva en `ropa/`, por ejemplo `ropa/4/`.
2. Agrega las fotografías sin modificar, renombrar, convertir ni sobrescribir los archivos originales.
3. Crea un objeto nuevo en el arreglo `products`.
4. Genera copias públicas en `assets/catalogo/[N]/`, eliminando EXIF, GPS y otros metadatos privados sin sobrescribir los originales.
5. Ordena primero las tres visualizaciones IA y después las dos fotografías reales disponibles, sin duplicar archivos.
6. Clasifica cada activo con `kind: "real-product-photo"` o `kind: "ai-model-visualization"`.
7. Completa un `alt` descriptivo y conciso; para IA, agrega además el aviso referencial centralizado en `disclosure`. Las tarjetas usan solo las imágenes IA y las fotografías reales permanecen en el detalle.
8. Completa `availability`, `availabilityConfirmed` y cada estado de `fieldVerification` con evidencia real.
9. Levanta el servidor, abre la tarjeta y recorre toda la galería para revisar rutas, orden, avisos y WhatsApp.

La composición admite veinte a treinta productos. La búsqueda funciona con nombre e identificador. Los filtros por talla, material u otros campos no se muestran mientras los datos sean insuficientes; el orden por precio debe añadirse solo cuando existan al menos dos precios numéricos verificados.

## Precios, disponibilidad y verificación

- `priceClp`: número entero en pesos chilenos o `null`; el sitio lo formatea como CLP.
- `originalPriceYen`: número o `null`; solo se muestra con verificación explícita.
- No conviertas automáticamente yenes a pesos.
- `availabilityConfirmed: true` permite publicar el texto de `availability`.
- Para afirmar “una unidad disponible”, escribe esa frase solo después de confirmarla.
- Talla, medidas, materiales y país de fabricación siguen la misma regla: valor comprobado más estado `verified`.

## Revisar rutas y contenido

Confirma que:

- cada carpeta directa de `ropa/` tenga exactamente un objeto;
- todas las rutas con espacios y caracteres especiales carguen mediante HTTP;
- cada producto tenga, cuando los activos existan, tres imágenes IA seguidas de dos fotografías reales;
- portada y tarjetas no usen fotografías reales;
- cada visualización IA tenga aviso visible en el detalle;
- no existan rutas absolutas del computador;
- no se publiquen placeholders como si fueran datos confirmados.

Comprobaciones básicas sin instalar dependencias:

```bash
node --check script.js
node --check data/products.js
git status --short
```

La revisión visual debe cubrir, como mínimo, `360 × 800`, `390 × 844`, `430 × 932`, `768 × 1024` y `1440 × 900`, además de teclado, Escape, retorno de foco, búsqueda sin resultados, limpiar filtros, carruseles, anclas, galerías y enlaces externos.

## Despliegue estático

Cada push a `main` ejecuta `.github/workflows/pages.yml` y publica la raíz mediante GitHub Pages, sin build:

```text
https://marioexe-rm.github.io/santokio/
```

El workflow habilita Pages cuando todavía no existe. También puedes publicar la
raíz en Cloudflare Pages, Netlify, Vercel u otro host estático.

Antes de publicar:

1. confirma que `publicSiteUrl`, `socialImageUrl`, `canonical` y `og:url` usen el dominio vigente;
2. usa siempre una fotografía real saneada como `og:image`;
3. revisa caché y peso de las copias públicas sin modificar los originales.

El prototipo omite datos estructurados `Product`: precio, stock y otros campos
comerciales todavía no permiten representar cada prenda con suficiente precisión.
Agrégalos solo cuando esos datos estén verificados.

## Limitaciones actuales

- El stock no está sincronizado y debe confirmarse manualmente.
- La consulta no constituye una reserva automática.
- No hay cuenta, carrito, checkout, pago en línea ni seguimiento de entrega.
- No existe un panel para editar productos; los cambios se hacen en el archivo de datos.
- El envío dentro de Santiago cuesta $3.000, se paga previamente y no es reembolsable. La decisión sobre la prenda se toma durante la misma entrega; no existe un plazo de devolución posterior documentado.
- Las imágenes originales contienen metadatos privados y quedan excluidas de Git; sólo se publican copias saneadas.
- `ropa/` pesa aproximadamente 55 MB y las fotografías documentales tienen resolución
  original. El hero rota tres visualizaciones IA del producto destacado y precarga
  la siguiente, pero un despliegue real deberá definir derivados
  responsivos no destructivos con autorización explícita.

## Posibles pasos futuros

- Incorporar un CMS que conserve los estados de verificación y la clasificación real/IA.
- Añadir inventario sincronizado y reservas con reglas explícitas.
- Integrar cálculo de entrega cuando exista una operación definida.
- Incorporar checkout o pagos únicamente cuando el modelo comercial cambie y se definan políticas.
