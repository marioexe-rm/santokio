---
name: SanTokyo
description: Secuencia editorial de prendas importadas desde Japón, documentada con calma y evidencia.
colors:
  chalk: "#f4f3ef"
  chalk-bright: "#fbfaf7"
  ink: "#17181a"
  ink-soft: "#4b4c4f"
  ink-muted: "#66686c"
  indigo: "#304c89"
  indigo-deep: "#203765"
  orchid: "#b9aed2"
  chartreuse: "#c9d35c"
  mist: "#d9d9d4"
  white: "#ffffff"
typography:
  display:
    fontFamily: "Funnel Sans, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: "clamp(3.15rem, 5vw, 5rem)"
    fontWeight: 430
    lineHeight: 0.98
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Funnel Sans, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: "clamp(2.35rem, 4.35vw, 4.75rem)"
    fontWeight: 430
    lineHeight: 0.98
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Funnel Sans, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: "clamp(1.5rem, 2vw, 2.25rem)"
    fontWeight: 430
    lineHeight: 0.98
    letterSpacing: "-0.035em"
  body:
    fontFamily: "Funnel Sans, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Funnel Sans, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: "0.78rem"
    fontWeight: 570
    lineHeight: 1.15
    letterSpacing: "0.08em"
rounded:
  none: "0"
spacing:
  "1": "0.375rem"
  "2": "0.625rem"
  "3": "0.875rem"
  "4": "1.25rem"
  "5": "1.75rem"
  "6": "2.5rem"
  "7": "3.75rem"
  "8": "5.5rem"
  "9": "8rem"
components:
  button-primary:
    backgroundColor: "{colors.indigo}"
    textColor: "{colors.white}"
    rounded: "{rounded.none}"
    padding: "0.75rem 1rem"
  button-primary-hover:
    backgroundColor: "{colors.indigo-deep}"
    textColor: "{colors.white}"
    rounded: "{rounded.none}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0.75rem 1rem"
  field:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0.5rem 0"
---

# Design System: SanTokyo

## Overview

**Creative North Star: "Índigo cinético"**

SanTokyo es una secuencia fotográfica paciente: una colección breve avanza mediante visualizaciones editoriales de gran escala, planos oblicuos y módulos desiguales, sin adquirir la uniformidad de una boutique de tarjetas. La voz es editorial, directa y verificable; el espacio tiza deja examinar cada pieza mientras tinta e índigo organizan el recorrido. Las fotografías reales permanecen disponibles como evidencia dentro de cada ficha.

La identidad obtiene energía de pocas intervenciones planas —orquídea, una línea chartreuse y geometrías inclinadas—, no de efectos aplicados a la prenda. La fotografía permanece estable, completa y neutral. El sistema sirve primero para entender la selección, distinguir evidencia de visualización y consultar una pieza directamente.

**Key Characteristics:**

- Secuencia panorámica con una fotografía dominante y la siguiente pieza en anticipo.
- Retícula de doce columnas y catálogo asimétrico de módulos alternados.
- Superficies planas, bordes rectos y reglas finas en lugar de tarjetas elevadas.
- Contraste entre campo tiza, estructura índigo y señales chartreuse breves.
- Hechos verificables junto a la imagen y consulta humana por WhatsApp.

## Colors

La paleta enfrenta neutrales cálidos y tinta con dos planos cromáticos fríos; chartreuse queda reservado para señales funcionales pequeñas.

### Primary

- **Índigo mineral:** estructura, botones primarios, estados activos y reglas que fijan declaraciones o hechos.
- **Índigo profundo:** estado de interacción del botón primario.

### Secondary

- **Orquídea bruma:** segundo plano de la composición, marcador de disponibilidad y fondo del aviso visual de IA.
- **Chartreuse de señal:** foco, selección, progreso y respuesta breve a la interacción.

### Neutral

- **Tiza:** campo principal, controles y superficies de información.
- **Tiza luminosa:** marco neutral de fotografías y cambio sutil del encabezado al desplazarse.
- **Tinta:** texto, bordes y footer.
- **Tinta suave:** texto secundario y explicaciones.
- **Tinta atenuada:** placeholders y estados deshabilitados.
- **Niebla:** divisores y bordes secundarios.
- **Blanco:** texto sobre índigo.

### Named Rules

**The Brief Signal Rule.** El chartreuse marca foco, selección o respuesta en líneas y superficies pequeñas; nunca se convierte en un campo dominante.

**The Calibrated Line Rule.** La estructura usa reglas base de un píxel; el índigo fija declaraciones y hechos con uno a tres píxeles, y el chartreuse sólo acentúa con dos píxeles.

## Typography

**Display Font:** Funnel Sans (con Helvetica Neue, Helvetica, Arial y sans-serif como respaldo)
**Body Font:** Funnel Sans (con Helvetica Neue, Helvetica, Arial y sans-serif como respaldo)

**Character:** Una única sans variable autoalojada cubre desde titulares de trazo ligero hasta etiquetas firmes. La identidad nace del contraste de escala, peso y espaciado, no de mezclar familias.

### Hierarchy

- **Display** (430, fluido, interlínea 0.98): titular principal contenido en unas once letras por línea.
- **Headline** (430, fluido, interlínea 0.98): capítulos editoriales de gran escala.
- **Title** (430, fluido, interlínea 0.98): nombres de piezas y títulos locales.
- **Body** (400, 1rem, interlínea 1.55): texto corriente con un máximo habitual de 70 caracteres.
- **Label** (570, 0.78rem, tracking 0.08em): etiquetas funcionales en mayúsculas para búsqueda y orden.
- **Numeral editorial** (330, fluido, interlínea 0.85): índices de pieza y números de proceso con cifras tabulares.
- **Wordmark** (620, fluido, tracking 0.2em): nombre SanTokyo en mayúsculas.

### Named Rules

**The One-Family Rule.** Funnel Sans sostiene display, lectura, etiquetas y datos; la jerarquía cambia por escala y peso, no por una segunda tipografía.

## Layout

El lienzo está limitado a 96rem y usa un gutter fluido entre 1rem y 3.5rem. La rampa espacial avanza en nueve pasos, de 0.375rem a 8rem, y los capítulos principales respiran con los pasos 7 a 9.

La primera vista usa doce columnas: mensaje y acción ocupan el tercio izquierdo; la secuencia visual ocupa las ocho columnas restantes, con una visualización IA dominante y el siguiente slide en anticipo a la derecha. El catálogo reutiliza las doce columnas con una proporción visual/resumen constante de 8/4 y alterna la ubicación de ambos bloques. Los datos siempre quedan unidos a la visualización por una regla, y la evidencia fotográfica real queda en la ficha.

A 72rem se comprime la navegación y la evidencia pasa a dos columnas. A 58rem aparece el menú desplegable, el hero se apila en tres filas y el catálogo adopta una relación visual/resumen 7/5. A 42rem, hero, herramientas, catálogo, proceso, evidencia, footer y diálogo pasan a flujo vertical; la anticipación de la siguiente pieza se conserva como una franja lateral estrecha. A 23.5rem se reducen gutters y miniaturas.

**The Unequal Sequence Rule.** Las piezas forman una secuencia editorial alternando la posición de imagen y resumen; no se normalizan en tarjetas repetidas.

## Elevation & Depth

El sistema es plano y no utiliza sombras. La profundidad proviene de campos tiza, índigo y orquídea separados por reglas, del solape geométrico de planos oblicuos y del scrim oscuro del diálogo modal.

**The Flat Evidence Rule.** Las fotografías documentales descansan sobre un fondo neutral, sin sombras, tintes, filtros ni planos cromáticos superpuestos.

## Shapes

Los controles, campos, módulos y diálogo son rectangulares, con esquinas a cero. Los bordes de un píxel, los subrayados y los rombos pequeños de disponibilidad construyen la geometría; las diagonales pertenecen a planos de fondo oblicuos y nunca recortan la prenda.

Los iconos son SVG lineales de trazo fino, extremos cuadrados y uniones en inglete. Los objetivos interactivos habituales miden al menos 2.75rem y las acciones principales 2.875rem o más.

## Components

### Buttons

- **Shape:** rectángulo sin radio, borde de un píxel y altura mínima de 2.875rem.
- **Primary:** fondo índigo, texto blanco y padding compacto; al pasar el puntero usa índigo profundo y sube 2px, mientras que al activar vuelve a su plano.
- **Secondary:** transparente con tinta; la interacción invierte a fondo tinta y texto tiza.
- **Focus:** contorno de tinta de 2px, offset de 4px y halo chartreuse de 6px.

### Inputs / Fields

- **Style:** fondo transparente, sin borde lateral ni superior, y línea inferior de tinta; altura mínima de 3rem.
- **Labels:** etiquetas funcionales en mayúsculas con tracking amplio.
- **State:** placeholder y deshabilitado usan tinta atenuada; el foco global aporta dos señales visibles.

### Navigation

El encabezado es sticky, tiza y separado por una regla. Los enlaces dibujan una línea índigo de derecha a izquierda al interactuar. Bajo 58rem, un botón rectangular abre una lista vertical de filas altas y subrayadas.

### Panoramic Sequence

La secuencia hero parte con la primera visualización ya presente en HTML y avanza cada cuatro segundos, en orden de catálogo, por las tres visualizaciones IA de cada prenda. Muestra la siguiente en un anticipo parcial, vuelve a la primera al completar la colección y pausa el temporizador con movimiento reducido o cuando la pestaña está oculta. Las capas índigo y orquídea se inclinan detrás de las imágenes y cada cambio reutiliza la transición de entrada. En desktop, la imagen absorbe aproximadamente la mitad del alto liberado por el índice retirado y la mitad restante queda como aire tiza.

### Product Entry

Cada entrada contrapone un carrusel de tres visualizaciones IA sobre tiza luminosa con un resumen tiza y un índice editorial. El ancho visual permanece constante mientras imagen y resumen alternan su ubicación; los hechos se alinean en filas con regla, “Ver detalle” abre el diálogo y “Consultar esta prenda” inicia la conversación específica por WhatsApp. La imagen nunca es un fondo decorativo, los chevrons mantienen estado independiente por producto, la etiqueta IA se ancla abajo a la derecha y el acceso al detalle arriba a la derecha.

### Product Dialog

El diálogo rectangular divide galería neutral e información. Contiene miniaturas desplazables, posición anunciada, hechos, cierre visible y una acción primaria de WhatsApp cuyo mensaje identifica nombre y referencia. En móvil ocupa el viewport y se convierte en una sola columna.

### AI Disclosure

Las visualizaciones IA aparecen en portada, tarjetas y al inicio de la galería como presentación editorial. En la ficha, el aviso separado cambia a orquídea y la miniatura muestra la etiqueta textual “IA”; ninguna de esas imágenes alimenta hechos de producto. Las dos fotografías reales aparecen después y ocultan por completo el aviso IA.

### Motion

Los estados funcionales duran 180–260ms. La entrada inicial mueve el plano índigo 1.5rem durante 720ms y revela la imagen con 1rem de desplazamiento durante 760ms, usando una curva de salida expresiva sin rebote. Con movimiento reducido desaparecen entrada, desplazamientos y scroll suave; sólo permanecen cambios breves de opacidad o visibilidad.

## Do's and Don'ts

### Do:

- **Do** usar visualizaciones IA identificadas en hero y catálogo, y fotografía real local, completa y sin filtro como evidencia dentro del detalle.
- **Do** mantener los datos, la disponibilidad y la acción de consulta próximos a la pieza correspondiente.
- **Do** construir ritmo con módulos desiguales, espacio amplio, reglas finas y planos cromáticos detrás de las imágenes.
- **Do** describir WhatsApp como consulta directa y precompletar nombre y referencia de la prenda.
- **Do** respetar la reducción de movimiento y conservar doble señal de foco.

### Don't:

- **Don't** convertir el catálogo en tarjetas uniformes, añadir sombras o redondear sus contenedores.
- **Don't** teñir, filtrar, deformar, enmascarar ni animar fotografías reales de forma que dificulte examinarlas.
- **Don't** usar chartreuse como superficie dominante ni superponer índigo u orquídea sobre la prenda.
- **Don't** presentar visualizaciones IA como evidencia de calce, color, material, construcción o proporción.
- **Don't** fabricar precio, talla, medidas, materiales, disponibilidad, urgencia, descuentos o claims comerciales.
