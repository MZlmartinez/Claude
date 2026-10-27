// Descripción de las 15 tablas gold para el system prompt del asistente.
// A diferencia de la primera versión (que solo listaba las columnas que
// ya usan lib/reports/growth.ts e influencers.ts), esto sale de
// information_schema.columns de verdad — varias tablas tienen muchas más
// columnas de las que cualquier reporte usa hoy, y el asistente las
// necesita para preguntas que ningún reporte fijo contesta (ej. "¿qué
// campaña de Meta corresponde al día del padre?", que necesita
// nombre_de_la_campana, una columna que ningún reporte usa pero existe).
//
// Si el pipeline agrega o cambia columnas en gold_*, actualizá esto
// corriendo de nuevo contra information_schema.columns — si no, el
// asistente vuelve a quedar a ciegas como antes.

export const SCHEMA = `
# Tablas disponibles (schema public, Postgres)

Todas son de Decathlon — un solo cliente, sin columna de tenant. Todas
tienen \`id\` (uuid) y \`synced_at\` (cuándo se sincronizó esa fila) — no
suelen importar para responder preguntas de negocio, no hace falta
mencionarlos salvo que se pregunte puntualmente por la frescura del dato.

## gold_shopify_sessions_by_referrer_master
Una fila por día y canal/tráfico — la tabla de sesiones más agregada y la
que usan los reportes para series de tiempo. Columnas:
- day (date)
- referring_channel (text, puede ser NULL — tratar como 'N/A')
- traffic_type (text: 'organic' / 'paid' / NULL — comparar con lower())
- marketing_platform (text — plataforma de marketing asociada, ej. Meta/Google)
- session_device_type (text: 'mobile' / 'desktop' / otros)
- sessions (numeric), online_store_visitors (numeric)
- bounces (numeric), bounce_rate (numeric)
- sessions_that_completed_checkout (numeric)
- referrer_source, referrer_name, session_city (text — detalle del origen y ciudad)
Tabla grande (cientos de miles de filas) — agregá con group by, nunca traigas todo sin filtrar.

## gold_shopify_sessions_by_session_device_type
Sesiones por tramo de tiempo y dispositivo, con más granularidad temporal
que las otras dos tablas de sesiones:
- session_device_type (text)
- year, month, day (date), hour (timestamp — incluye la hora del día)
- sessions, online_store_visitors, sessions_that_completed_checkout (numeric)
- conversion_rate (numeric), average_session_duration (numeric, segundos)

## gold_shopify_orders_over_time
- day (date)
- referring_channel (text)
- order_referrer_name, order_referrer_source (text — detalle de atribución del pedido, más granular que referring_channel)
- orders_last_click (numeric) — órdenes atribuidas por último clic
- quantity_ordered_per_order_last_click (numeric)
- average_order_value_last_click (numeric)
- reversed_quantity_last_click (numeric)

## gold_shopify_total_sales_by_product
- day (date)
- product_title, product_vendor, product_type, product_variant_title (text)
- net_items_sold (numeric)
- gross_sales, discounts, sales_reversals, net_sales, taxes, total_sales (numeric — total_sales CON IVA incluido, dividir por 1.21 para sin IVA)
- new_or_returning_customer (text: 'New' / 'Returning', exacto con mayúscula)
- referring_channel (text — permite cruzar ventas por canal, no solo sesiones)

## gold_shopify_average_order_value_over_time
- day (date)
- gross_sales (numeric), discounts (numeric), orders (numeric)
- average_order_value (numeric, ya calculado — (gross_sales − discounts) / orders)

## gold_shopify_conversion_rate_over_time
- day (date), referring_channel (text)
- sessions, sessions_with_cart_additions, sessions_that_reached_checkout, sessions_that_completed_checkout (numeric)
- conversion_rate (numeric, ya calculado)

## gold_shopify_checkout_conversion_rate_over_time
- day (date)
- sessions, sessions_with_cart_additions, sessions_that_reached_checkout, sessions_that_completed_checkout (numeric)
- sessions_that_reached_and_completed_checkout (numeric)
- checkout_conversion_rate, completed_checkout_rate (numeric, ya calculados)

## gold_shopify_customer_behavior
Tabla grande (~170k filas, agregá siempre). Comportamiento a nivel cliente:
- customer_id (numeric), customer_name (text), customer_number_of_orders (numeric)
- day (date)
- sessions_with_cart_additions, sessions_that_reached_checkout, sessions_that_completed_checkout (numeric)

## gold_shopify_new_vs_returning_customers
- day (date)
- customers (numeric)
- new_or_returning_customer (text: 'New' / 'Returning')

## gold_shopify_facturacion_inversion
Facturación e inversión del NEGOCIO ENTERO (no solo e-commerce), una fila por período y tipo:
- periodo (integer — clave de período, no es una fecha; unite con gold_shopify_time.periodo)
- tipo (text: 'Facturacion Total' / 'Inversion Total')
- plataforma, universo (poco usados / casi siempre NULL en la práctica)
- monto (numeric)

## gold_meta_campanas
Pauta de Meta Ads (Facebook/Instagram), una fila por campaña e informe —
tiene el detalle completo de cada campaña, no solo el gasto agregado:
- inicio_del_informe, fin_del_informe (date — rango que cubre esa fila)
- nombre_de_la_campana (text — así se busca una campaña puntual por nombre, ej. "día del padre")
- entrega_de_la_campana (text — estado de entrega)
- resultados (numeric), indicador_de_resultado (text — qué mide "resultados": compras, mensajes, etc.)
- resultados_iniciales, indicador_de_resultados_inicial (text)
- coste_por_resultados (numeric)
- presupuesto_del_conjunto_de_anuncios (numeric), tipo_de_presupuesto_del_conjunto_de_anuncios (text)
- importe_gastado_ars (numeric — gasto real en ARS)
- impresiones, alcance, frecuencia (numeric)
- cpm_coste_por_1000_impresiones_ars (numeric)
- compras (numeric)
- configuracion_de_atribucion (text — ventana de atribución usada)
- roas_retorno_del_gasto_publicitario_de_compras (numeric)
- valor_de_los_resultados (numeric), indicador_de_valor_resultante (text)
- fin (text — no es una fecha pese al nombre, revisar su contenido real con un SELECT si hace falta usarla)
Para preguntas sobre una campaña puntual por nombre o fecha (ej. "¿qué
pasó con la campaña de X?"), empezá filtrando por nombre_de_la_campana
(ILIKE para no depender de mayúsculas exactas) o por el rango
inicio_del_informe/fin_del_informe, y desde ahí cruzá con las ventas del
mismo rango de fechas en gold_shopify_total_sales_by_product /
gold_shopify_orders_over_time si la pregunta pide ver el impacto en ventas.

## gold_shopify_objetivos
Objetivos cargados a mano por período:
- periodo (integer), plataforma (text)
- nombre_objetivo (text: 'Facturacion del mes' / 'Ordenes Totales' / 'Tasa de conversión')
- objetivo (numeric)

## gold_shopify_time
Tabla de mapeo de períodos y calendario — unite acá para pasar de fecha a
período, o para filtrar por día de semana / fin de semana / trimestre:
- fecha (date), periodo (integer), periodo_mes, periodo_abrev (text)
- anio, mes, dia, trimestre, semana_anio, dia_anio (integer)
- mes_nombre, dia_semana_nombre (text)
- dia_semana_num (integer, 0-6 o 1-7 — confirmá el rango con un SELECT antes de asumir cuál día es cuál)
- es_fin_de_semana (boolean)
- nombre_mes_anio (text, ej. "Enero 2026")
- ultimo_periodo (integer)

## gold_influencers_deca
Una fila por PIEZA de contenido (no por contrato) — ver convenciones sobre
\`presupuesto\`, que se repite por fila:
- empresa, marca, campana (text), objetivo (text — objetivo de la campaña, no un número)
- influencer, territorio (text, territorio puede ser NULL)
- periodo_desde, periodo_hasta (timestamp)
- presupuesto (numeric, ARS — fee del CONTRATO completo, se repite en cada pieza, ver convenciones)
- presupuesto_usd, presupuesto_anio_fiscal (numeric)
- press_kit, costos_extras (numeric — costos adicionales al fee principal)
- scope_acordado_tipo, scope_acrodado_numero (lo acordado en el contrato — sí, "acrodado" con ese typo real en la columna)
- scope_recibido_tipo, scope_recibido_numero (lo realmente entregado)
- fecha_contenido (numeric — revisar su formato real con un SELECT antes de usarla como fecha)
- visualizaciones, alcance, impresiones (numeric)
- likes, comentarios, shares, guardados, click_a_arroba (numeric)
- engagement_rate_ig, engagement_rate_tik_tok (numeric, ya calculados por la plataforma de origen)
- instagram, tiktok (numeric — probablemente IDs o conteos de posts; revisar con un SELECT si una pregunta los necesita)
- clipping (text, nullable)
`;
