// Reglas de negocio que hoy están repetidas a mano en cada query de
// lib/reports/*.ts. El asistente de IA las necesita como contexto fijo
// antes de escribir SQL nueva — sin esto, es casi seguro que calcule bien
// la sintaxis pero mal el número (el error más peligroso: no se nota a
// simple vista, y un cliente real lo ve con total confianza).
//
// Si agregás una convención nueva a algún reporte, agregala acá también —
// si no, el asistente sigue sin conocerla aunque el reporte ya la use.

export const CONVENTIONS = `
# Convenciones de datos — Decathlon (gold_* en Supabase/Postgres)

Estas tablas vienen de un pipeline diario de Fabric. Son de un único
cliente (Decathlon) — no hay columna de tenant, no filtres por cliente.

## IVA (Argentina, 21%)
- Todo lo que es "facturación" o "ticket" en las tablas de Shopify viene
  CON IVA incluido. Para mostrar el valor sin IVA (que es lo que se
  reporta como principal en todo el dashboard) se divide por 1.21.
- Ejemplo real: \`sum(total_sales) / 1.21\` en gold_shopify_total_sales_by_product.
- Mostrá siempre el valor sin IVA como protagonista; el valor con IVA (si
  hace falta) va como dato secundario, nunca al revés.
- La inversión en pauta (gold_shopify_facturacion_inversion, gold_meta_campanas)
  NO se divide por 1.21 — esos montos no son facturación con IVA.

## El balde "Otros"
- Cuando se rankea algo (canales, tipos de producto), los puestos fuera
  del top N quedan agrupados en una fila "Otros" — nunca se omiten del
  total, porque si no la suma del top N no cierra con el 100%.
- El ranking para decidir qué entra en el top N es casi siempre sobre el
  AÑO completo (no sobre el período corto que esté mirando el usuario),
  para que el conjunto de categorías no cambie de un día para el otro.
  Confirmá explícitamente contra qué ventana se rankeó si no es obvio.

## Canales y tráfico (gold_shopify_sessions_by_referrer_master)
- \`traffic_type\`: comparar siempre en minúsculas (\`lower(traffic_type)\`):
  'organic' = orgánico, 'paid' = pago. Puede venir NULL.
- \`session_device_type\`: 'mobile' / 'desktop'; cualquier sesión que no es
  ninguno de los dos entra en "otro dispositivo" (sesiones totales menos
  mobile menos desktop), no se descarta.
- \`referring_channel\` puede venir NULL — tratalo como 'N/A', no lo excluyas.
- Columnas de embudo: \`sessions_with_cart_additions\` (carrito),
  \`sessions_that_reached_checkout\` (llegó a checkout),
  \`sessions_that_completed_checkout\` (compró). Abandono de carrito =
  1 − checkout/carrito. Abandono de checkout = 1 − compras/checkout.

## Clientes nuevos vs. recurrentes
- La columna se llama \`new_or_returning_customer\`, con los valores EXACTOS
  (mayúscula inicial) 'New' y 'Returning' — no 'new'/'returning' en minúscula.
  Aparece en gold_shopify_total_sales_by_product y
  gold_shopify_new_vs_returning_customers.

## Objetivos y facturación total del negocio
- gold_shopify_objetivos tiene una fila por objetivo y por período
  (columna \`periodo\`, no por fecha): \`nombre_objetivo\` en
  {'Facturacion del mes', 'Ordenes Totales', 'Tasa de conversión'}, valor
  en \`objetivo\`.
- gold_shopify_facturacion_inversion también es por \`periodo\`:
  \`tipo\` en {'Facturacion Total', 'Inversion Total'}, valor en \`monto\`.
  "Facturación Total" es el negocio ENTERO (todos los canales de venta de
  Decathlon), no solo e-commerce — el peso del e-commerce sobre el total
  es (facturación Shopify sin IVA) / (Facturación Total del período).
- \`periodo\` es una clave de texto (no una fecha) que identifica el mes;
  gold_shopify_time tiene el mapeo completo período ↔ fecha/etiqueta
  (\`periodo\`, \`fecha\`, \`nombre_mes_anio\`, \`periodo_abrev\`) — unite por
  ahí si necesitás pasar de fecha a período o viceversa.

## ROAS e inversión
- ROAS = facturación sin IVA / inversión en pauta (gold_shopify_facturacion_inversion,
  tipo 'Inversion Total'). La inversión de Meta Ads (gold_meta_campanas,
  \`importe_gastado_ars\`) es una pauta específica, no reemplaza a la
  inversión total — son dos fuentes distintas, no las sumes sin aclarar
  cuál es cuál.

## Influencers (gold_influencers)
- \`presupuesto\` es el fee ACORDADO del CONTRATO completo (campaña +
  influencer), y se REPITE en cada fila/pieza de ese contrato. Nunca lo
  sumes directo: primero \`max(presupuesto)\` agrupando por
  (campana, influencer), recién ahí sumás esos máximos para totalizar
  inversión. Sumarlo sin deduplicar infla la inversión real varias veces.
- "Interacciones" = likes + comentarios + shares + guardados. \`click_a_arroba\`
  (clics al @ de la marca) se cuenta aparte, no es parte de "interacciones".
- Tasa de interacción = 100 × interacciones / visualizaciones.
- Costo por mil vistas = inversión × 1000 / visualizaciones (solo tiene
  sentido si inversión > 0).
- \`scope_recibido_tipo\` es el formato REALMENTE entregado (REEL/STORIE/
  PRESENCIA/TIKTOK); \`scope_acordado_tipo\` es el formato ACORDADO en el
  contrato — no son lo mismo, un contrato puede acordar 3 reels y recibir 2.
- Cumplimiento = 100 × mín(acordado, recibido) / acordado, por tipo de
  pieza — nunca más de 100%, aunque se haya entregado de más.

## Unidades y formato
- Sesiones, órdenes, unidades: enteros.
- Porcentajes de conversión/tasa: cuando la query ya los multiplicó por
  100 (ej. \`conversion\` en el mensual de Growth), no los multipliques de
  nuevo — fijate si el nombre de columna o su valor típico (0–100 vs
  0–1) ya lo indica antes de formatear.
`;
