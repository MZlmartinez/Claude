// Descripción de las 16 tablas gold para el system prompt del asistente.
// Las columnas de acá están sacadas directo de las queries reales de
// lib/reports/growth.ts y lib/reports/influencers.ts — no son inventadas.
// Las 4 tablas que ningún reporte usa todavía no tienen columnas
// confirmadas: el asistente las explora él mismo con un
// `select * from <tabla> limit 3` antes de armar una consulta real.

export const SCHEMA = `
# Tablas disponibles (schema public, Postgres)

Todas son de Decathlon — un solo cliente, sin columna de tenant.

## gold_shopify_sessions_by_referrer_master
Una fila por día y canal/tráfico. Columnas:
- day (date)
- referring_channel (text, puede ser NULL — tratar como 'N/A')
- sessions (numeric)
- traffic_type (text: 'organic' / 'paid' / NULL — comparar con lower())
- session_device_type (text: 'mobile' / 'desktop' / otros)
- sessions_that_completed_checkout (numeric)
- sessions_with_cart_additions (numeric)
- sessions_that_reached_checkout (numeric)
- bounces (numeric)
Tabla grande (cientos de miles de filas) — agregá con group by, nunca traigas todo sin filtrar.

## gold_shopify_orders_over_time
- day (date)
- referring_channel (text)
- orders_last_click (numeric) — órdenes atribuidas por último clic

## gold_shopify_total_sales_by_product
- day (date)
- total_sales (numeric) — CON IVA incluido, dividir por 1.21 para sin IVA
- new_or_returning_customer (text: 'New' / 'Returning', exacto con mayúscula)
- product_type (text, puede venir vacío — tratar '' como 'N/A')
- net_items_sold (numeric)

## gold_shopify_average_order_value_over_time
- day (date)
- gross_sales (numeric)
- discounts (numeric)
- orders (numeric)
Ticket promedio = (gross_sales − discounts) / orders.

## gold_shopify_conversion_rate_over_time
- day (date)
- sessions (numeric)
- sessions_that_completed_checkout (numeric)

## gold_shopify_checkout_conversion_rate_over_time
- day (date)
- sessions_with_cart_additions (numeric)
- sessions_that_reached_checkout (numeric)
- sessions_that_completed_checkout (numeric)

## gold_shopify_new_vs_returning_customers
- day (date)
- customers (numeric)
- new_or_returning_customer (text: 'New' / 'Returning')

## gold_shopify_facturacion_inversion
Facturación e inversión del NEGOCIO ENTERO (no solo e-commerce), una fila por período y tipo:
- periodo (text — clave de período, no es una fecha)
- tipo (text: 'Facturacion Total' / 'Inversion Total')
- monto (numeric)

## gold_meta_campanas
Pauta de Meta Ads (Facebook/Instagram), una fila por campaña e informe:
- fin_del_informe (date)
- importe_gastado_ars (numeric)
- valor_de_los_resultados (numeric)

## gold_shopify_objetivos
Objetivos cargados a mano por período:
- periodo (text)
- nombre_objetivo (text: 'Facturacion del mes' / 'Ordenes Totales' / 'Tasa de conversión')
- objetivo (numeric)

## gold_shopify_time
Tabla de mapeo de períodos — unite acá para pasar de fecha a período o viceversa:
- fecha (date)
- periodo (text)
- nombre_mes_anio (text, ej. "Enero 2026")
- periodo_abrev (text)

## gold_influencers
Una fila por PIEZA de contenido (no por contrato) — ver convenciones sobre \`presupuesto\`:
- id, campana (text), territorio (text, nullable), influencer (text), marca (text)
- scope_recibido_tipo (text: 'REEL' / 'STORIE' / 'PRESENCIA' / 'TIKTOK' — lo que se entregó)
- scope_recibido_numero (numeric)
- scope_acordado_tipo (text — lo que se acordó en el contrato)
- scope_acrodado_numero (numeric — sí, con ese typo en el nombre real de la columna)
- presupuesto (numeric — fee del CONTRATO completo, se repite en cada pieza, ver convenciones)
- visualizaciones, alcance, likes, comentarios, shares, guardados, click_a_arroba (numeric)
- periodo_desde, periodo_hasta (date)
- clipping (text, nullable)

## Tablas sin columnas confirmadas todavía
Estas existen y tienen datos, pero ningún reporte las usa hoy, así que no
hay columnas documentadas con certeza acá. Antes de armar una consulta
real contra cualquiera de estas, corré primero
\`select * from <tabla> limit 3\` con la tool run_sql para ver su forma
real — no asumas nombres de columna:
- gold_shopify_channel
- gold_shopify_sessions_by_referrer (nota: NO es la misma tabla que
  gold_shopify_sessions_by_referrer_master, de arriba, que sí está documentada)
- gold_shopify_sessions_by_session_device_type
- gold_shopify_customer_behavior (tabla grande, ~170k filas — agregá siempre)
`;
