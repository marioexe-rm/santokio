# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Portable static site using semantic HTML5, modern CSS, and vanilla JavaScript. No framework, backend, shopping platform, or runtime dependency. A lightweight Node build pre-renders and validates indexable catalogue HTML before deployment to a static host.

## Users

SanTokyo's primary customer is an adult in Chile, initially concentrated in Santiago, who values fashion, thoughtful design, good construction, and higher-quality materials. They may be interested in design or contemporary fashion, but do not need prior knowledge of Japanese fashion.

Their job is to discover a distinctive garment, evaluate its real photographs, materials, size, measurements, and price, and then contact SanTokyo directly to confirm availability and coordinate the purchase. The experience must remain approachable to someone who simply wants a well-made or unusual piece.

## Product Purpose

SanTokyo is a static landing page and catalogue for a small collection of new garments imported from Japan. It exists to help customers discover the collection, understand each available piece through reliable product information, and begin a direct purchase conversation with SanTokyo.

Success means that a customer can confidently assess a garment, understand how availability, payment, and delivery work, and contact SanTokyo about the specific item without needing a cart or online checkout.

## Positioning

SanTokyo combines a limited, personally selected inventory with real garments imported from Japan, their original labels, and direct communication with the seller. The collection emphasizes materials, construction, and designs that can be difficult to find in Chilean generalist stores. Inventory generally consists of one unit per product rather than a mass catalogue.

The commercial experience is calm and editorial, without artificial discounts, fabricated urgency, or purchase pressure.

## Operating Context

Customers browse the catalogue in Spanish for Chile, review product imagery and details, and contact SanTokyo through WhatsApp at `56932926203`. The prefilled WhatsApp message must identify the product by name or identifier.

Every published garment represents one available unit and must be removed from the catalogue immediately when sold. Size, measurements, and delivery are confirmed manually. Delivery within Santiago costs `$3.000 CLP`; this cost is paid in advance and is not refundable. At delivery, the customer may inspect the garment, pay its value by bank transfer or cash, and try it on. They must decide during that same delivery whether to keep it. If they do not keep it, they return it immediately and receive a refund of the garment value only; there is no later return period and the delivery cost is not refunded.

Prices are presented in Chilean pesos using CLP formatting.

## Capabilities and Constraints

- The catalogue currently has one product per direct subfolder of `ropa/` and is expected to grow to approximately 30–50 products.
- Product content must be centralized in a maintainable data file rather than duplicated across HTML.
- The site has no checkout, shopping cart, online payment flow, backend, or automatic inventory system.
- Product-specific facts—including size, measurements, materials, price, colour, and construction—must come from real garment photographs, labels, or manually verified data. Availability follows the publication rule: one unit while listed, then immediate removal when sold. None of these facts may be inferred from AI-generated visualizations.
- Only local assets under `ropa/` may be used for garment imagery. The original files must not be modified, renamed, converted, overwritten, or deleted.
- The implementation must make AI-generated visualizations easy to replace or remove later.
- The catalogue uses Chilean Spanish with `lang="es-CL"`.
- Responsive behaviour must be verified at approximately 360 px, 768 px, and 1440 px viewport widths.
- Future content must not fabricate reviews, discounts, countdowns, scarcity beyond confirmed inventory, authenticity claims, or commercial conditions beyond the documented same-delivery decision.
- Product-level measurements, materials, prices, and other structured catalogue facts remain open until they are manually verified.

## Brand Commitments

The product name is SanTokyo.

The experience should be calm, editorial, direct, and approachable. It should communicate care in selection and respect for the garments without requiring customers to be experts in Japanese fashion. It must avoid high-pressure retail language and unsupported commercial claims.

## Evidence on Hand

- `ropa/` contains photographs of the real inventory, organized by product. These are approved product and marketing assets.
- The real garment photographs and visible labels may be used as evidence, subject to careful reading and manual verification.
- Some labels retain an original price in yen.
- Some files under `ropa/` are AI-generated model visualizations approved for the initial prototype. They are illustrative only and are not documentary evidence of exact fit, drape, proportions, colour, construction, or garment details.
- AI-generated people must not be described as real customers or as models photographed wearing the physical inventory.
- No testimonials, customer reviews, case studies, later return period, exchange policy, or verified structured product dataset has been provided. Future work must not invent them or extend the documented immediate same-delivery return.

## Product Principles

1. Put verifiable garment truth ahead of persuasive claims.
2. Make a small collection feel considered, legible, and easy to explore.
3. Keep direct human contact central to availability and purchase coordination.
4. Build confidence without discounts, urgency, or pressure tactics.
5. Keep catalogue content maintainable as the collection grows.

## Accessibility & Inclusion

Use semantic structure, complete keyboard navigation, visible focus states, sufficient colour contrast, descriptive alternative text, and accessible product details or dialogs. Respect `prefers-reduced-motion`.

The content and interaction model should remain understandable to customers without specialist knowledge of Japanese fashion.
