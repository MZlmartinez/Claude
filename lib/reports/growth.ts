import { queryReport } from "@/lib/supabase/pg";

// Los 10 datasets quedaron calcados 1:1 del artifact de claude.ai "Decathlon
// Growth" (mismo SQL, mismas columnas) — son queries de agregación pura
// sobre las tablas gold_shopify_*/gold_meta_campanas que ya sincroniza
// scripts/sync-gold.ts, sin parámetros de filtro: el dashboard trae todo el
// histórico y filtra/navega meses y rangos de días del lado del cliente.
//
// gold_shopify_sessions_by_referrer_master (880k+ filas) y
// gold_shopify_total_sales_by_product se escaneaban enteras una vez por
// cada query de acá abajo que las usaba (6 y 5 veces respectivamente, en
// una sola carga de página) — medido, una sola de esas agregaciones sin
// índice tardaba ~7s. Ahora leen de gold_shopify_sessions_daily_rollup y
// gold_shopify_sales_daily_rollup (vistas materializadas, agregadas por
// día/canal/tráfico/dispositivo y día/canal/tipo de producto/cliente
// respectivamente), que se refrescan una vez por día en sync-gold.ts
// (ver refreshGrowthRollups) — la misma agregación se paga una vez al día
// en vez de en cada visita. Los totales de ambos rollups están validados
// contra las tablas crudas (ver el chat de esta sesión).

export async function refreshGrowthRollups(): Promise<void> {
  await queryReport(`refresh materialized view concurrently public.gold_shopify_sessions_daily_rollup`);
  await queryReport(`refresh materialized view concurrently public.gold_shopify_sales_daily_rollup`);
}

export type CanalDiaRow = { dia: string; canal: string; sesiones: number };

export async function getCanalDia(): Promise<CanalDiaRow[]> {
  return queryReport<CanalDiaRow>(
    `with base as ( select day, referring_channel canal, sum(sessions) sessions from gold_shopify_sessions_daily_rollup group by 1, 2), top as (select canal from base group by 1 order by sum(sessions) desc limit 10) select to_char(day, 'YYYY-MM-DD') dia, case when canal in (select canal from top) then canal else 'Otros' end canal, sum(sessions)::float8 sesiones from base group by 1, 2 order by 1, 2`,
  );
}

export type CanalRow = {
  mes: string;
  canal: string;
  puesto: number;
  sesiones: number;
  share: number;
  sesiones_ant: number | null;
  dif_share: number | null;
  share_organico: number;
  share_pago: number;
  ordenes: number;
  tasa_adquisicion: number;
  fact_sin_iva: number;
};

export async function getCanales(): Promise<CanalRow[]> {
  return queryReport<CanalRow>(
    `with s as ( select date_trunc('month', day)::date mes, referring_channel canal, sum(sessions) sesiones, sum(sessions) filter (where lower(traffic_type) = 'organic') ses_org, sum(sessions) filter (where lower(traffic_type) = 'paid') ses_pago from gold_shopify_sessions_daily_rollup group by 1, 2), o as (select date_trunc('month', day)::date mes, coalesce(referring_channel, 'N/A') canal, sum(orders_last_click) ordenes from gold_shopify_orders_over_time group by 1, 2), v as (select date_trunc('month', day)::date mes, referring_channel canal, sum(total_sales) / 1.21 fact from gold_shopify_sales_daily_rollup group by 1, 2), j as ( select coalesce(s.mes, o.mes, v.mes) mes, coalesce(s.canal, o.canal, v.canal) canal, coalesce(s.sesiones, 0) sesiones, coalesce(s.ses_org, 0) ses_org, coalesce(s.ses_pago, 0) ses_pago, coalesce(o.ordenes, 0) ordenes, coalesce(v.fact, 0) fact from s full join o on o.mes = s.mes and o.canal = s.canal full join v on v.mes = coalesce(s.mes, o.mes) and v.canal = coalesce(s.canal, o.canal)), t as (select mes, sum(sesiones) tot from j group by 1), r as ( select j.*, j.sesiones::float8 / nullif(t.tot, 0) share, lag(j.sesiones) over (partition by j.canal order by j.mes) ses_ant_raw, lag(j.mes) over (partition by j.canal order by j.mes) mes_ant, rank() over (partition by j.mes order by j.sesiones desc, j.fact desc, j.canal) rk from j join t using (mes)), ta as (select mes, tot from t) select to_char(r.mes, 'YYYY-MM') mes, r.canal, r.rk::int puesto, r.sesiones::float8 sesiones, round(r.share::numeric, 4)::float8 share, case when r.mes_ant = (r.mes - interval '1 month')::date then r.ses_ant_raw end::float8 sesiones_ant, round((r.share - case when r.mes_ant = (r.mes - interval '1 month')::date then r.ses_ant_raw::float8 / nullif(ta.tot, 0) end)::numeric, 4)::float8 dif_share, round((r.ses_org::float8 / nullif(r.sesiones, 0))::numeric, 4)::float8 share_organico, round((r.ses_pago::float8 / nullif(r.sesiones, 0))::numeric, 4)::float8 share_pago, r.ordenes::float8 ordenes, round((r.ordenes::float8 / nullif(r.sesiones, 0))::numeric, 5)::float8 tasa_adquisicion, round(r.fact::numeric, 0)::float8 fact_sin_iva from r left join ta on ta.mes = (r.mes - interval '1 month')::date where r.rk <= 12 order by r.mes, r.rk`,
  );
}

// "diario" no está cableado a ningún gráfico/tabla del dashboard original
// (quedó como dataset exploratorio sin usar) — se deja la función acá para
// paridad con el artifact pero no se llama desde la página. Sigue leyendo
// de las tablas crudas (no está en el camino caliente, no hace falta).
export type DiarioRow = { dia: string; mes: string; sesiones: number; fact_sin_iva: number; ordenes: number };

export async function getDiario(): Promise<DiarioRow[]> {
  return queryReport<DiarioRow>(
    `with s as (select day, sum(sessions) sesiones from gold_shopify_sessions_by_referrer_master group by 1), v as (select day, sum(total_sales) / 1.21 fact from gold_shopify_total_sales_by_product group by 1), o as (select day, sum(orders_last_click) ordenes from gold_shopify_orders_over_time group by 1) select to_char(d.day, 'YYYY-MM-DD') dia, to_char(d.day, 'YYYY-MM') mes, s.sesiones::float8 sesiones, round(v.fact::numeric, 0)::float8 fact_sin_iva, o.ordenes::float8 ordenes from (select day from s union select day from v union select day from o) d left join s using (day) left join v using (day) left join o using (day) order by d.day`,
  );
}

export type DispositivoRow = { mes: string; dispositivo: string; sesiones: number; compras: number; conversion: number };

export async function getDispositivo(): Promise<DispositivoRow[]> {
  return queryReport<DispositivoRow>(
    `select to_char(date_trunc('month', day), 'YYYY-MM') mes, coalesce(session_device_type, 'N/A') dispositivo, sum(sessions)::float8 sesiones, sum(sessions_that_completed_checkout)::float8 compras, round((100.0 * sum(sessions_that_completed_checkout) / nullif(sum(sessions), 0))::numeric, 2)::float8 conversion from gold_shopify_sessions_daily_rollup group by 1, 2 order by 1, 3 desc`,
  );
}

export type MensualRow = {
  mes: string;
  periodo: string;
  etiqueta: string;
  abrev: string;
  dias_mes: number;
  dias_datos: number;
  hasta: string | null;
  completo: boolean;
  fact_con_iva: number | null;
  ticket_con_iva: number | null;
  fact_sin_iva: number | null;
  fact_nuevos_sin_iva: number | null;
  fact_recurrentes_sin_iva: number | null;
  ordenes: number | null;
  ticket_sin_iva: number | null;
  sesiones: number | null;
  sesiones_organico: number | null;
  sesiones_pago: number | null;
  sesiones_mobile: number | null;
  sesiones_desktop: number | null;
  share_organico: number | null;
  share_pago: number | null;
  rebote: number | null;
  sesiones_diarias: number | null;
  conversion: number | null;
  sesiones_embudo: number | null;
  carrito: number | null;
  checkout: number | null;
  compras: number | null;
  abandono_carrito: number | null;
  abandono_checkout: number | null;
  clientes_nuevos: number | null;
  clientes_recurrentes: number | null;
  fact_total_sin_iva: number | null;
  inversion_sin_iva: number | null;
  peso_ecommerce: number | null;
  inversion_sobre_fact: number | null;
  roas: number | null;
  costo_sesion_sin_iva: number | null;
  costo_conversion_sin_iva: number | null;
  tasa_adquisicion: number | null;
  meta_gasto: number | null;
  roas_meta: number | null;
  obj_facturacion: number | null;
  obj_ordenes: number | null;
  obj_conversion: number | null;
  avance_obj_facturacion: number | null;
  var_fact: number | null;
  var_ordenes: number | null;
  var_ticket: number | null;
  var_sesiones: number | null;
  var_sesiones_diarias: number | null;
  dif_conversion: number | null;
  dif_peso: number | null;
  dif_inversion_fact: number | null;
  dif_roas: number | null;
  dif_share_organico: number | null;
  dif_share_pago: number | null;
  var_rebote: number | null;
  dif_abandono_carrito: number | null;
  dif_abandono_checkout: number | null;
  var_costo_sesion: number | null;
  var_costo_conversion: number | null;
  dif_roas_meta: number | null;
};

export async function getMensual(): Promise<MensualRow[]> {
  return queryReport<MensualRow>(
    `with meses as ( select distinct date_trunc('month', fecha)::date mes, periodo, nombre_mes_anio etiqueta, periodo_abrev abrev from gold_shopify_time ), ventas as ( select date_trunc('month', day)::date mes, sum(total_sales) fact, count(distinct day) dias_v, max(day) hasta_v, sum(total_sales) filter (where new_or_returning_customer = 'New') fact_nuevos, sum(total_sales) filter (where new_or_returning_customer = 'Returning') fact_recurrentes from gold_shopify_sales_daily_rollup group by 1), aov as ( select date_trunc('month', day)::date mes, sum(gross_sales) bruto, sum(discounts) descuentos, sum(orders) ordenes_aov, max(day) hasta_a from gold_shopify_average_order_value_over_time group by 1), ords as ( select date_trunc('month', day)::date mes, sum(orders_last_click) ordenes from gold_shopify_orders_over_time group by 1), ses as ( select date_trunc('month', day)::date mes, sum(sessions) sesiones, count(distinct day) dias_s, max(day) hasta_s, sum(sessions) filter (where lower(traffic_type) = 'organic') ses_org, sum(sessions) filter (where lower(traffic_type) = 'paid') ses_pago, sum(sessions) filter (where session_device_type = 'mobile') ses_mobile, sum(sessions) filter (where session_device_type = 'desktop') ses_desktop, sum(bounces) rebotes, sum(sessions_that_completed_checkout) compras_ses from gold_shopify_sessions_daily_rollup group by 1), conv as ( select date_trunc('month', day)::date mes, sum(sessions) ses_conv, sum(sessions_that_completed_checkout) compras_conv from gold_shopify_conversion_rate_over_time group by 1), chk as ( select date_trunc('month', day)::date mes, sum(sessions_with_cart_additions) carrito, sum(sessions_that_reached_checkout) checkout, sum(sessions_that_completed_checkout) compras from gold_shopify_checkout_conversion_rate_over_time group by 1), cli as ( select date_trunc('month', day)::date mes, sum(customers) filter (where new_or_returning_customer = 'New') clientes_nuevos, sum(customers) filter (where new_or_returning_customer = 'Returning') clientes_recurrentes from gold_shopify_new_vs_returning_customers group by 1), fi as ( select periodo, sum(monto) filter (where tipo = 'Facturacion Total') fact_total, sum(monto) filter (where tipo = 'Inversion Total') inversion from gold_shopify_facturacion_inversion group by 1), meta as ( select date_trunc('month', fin_del_informe)::date mes, sum(importe_gastado_ars) meta_gasto, sum(valor_de_los_resultados) meta_valor from gold_meta_campanas group by 1), obj as ( select periodo, sum(objetivo) filter (where nombre_objetivo = 'Facturacion del mes') obj_facturacion, sum(objetivo) filter (where nombre_objetivo = 'Ordenes Totales') obj_ordenes, sum(objetivo) filter (where nombre_objetivo = 'Tasa de conversión') obj_conversion from gold_shopify_objetivos group by 1), b as ( select m.mes, m.periodo, m.etiqueta, m.abrev, extract(day from (m.mes + interval '1 month - 1 day'))::int dias_mes, least(coalesce(v.dias_v, 0), coalesce(s.dias_s, 0)) dias_datos, least(v.hasta_v, s.hasta_s, a.hasta_a) hasta, v.fact fact_con_iva, (a.bruto - a.descuentos) / nullif(a.ordenes_aov, 0) ticket_con_iva, v.fact / 1.21 fact_sin_iva, v.fact_nuevos / 1.21 fact_nuevos_sin_iva, v.fact_recurrentes / 1.21 fact_recurrentes_sin_iva, o.ordenes, (a.bruto - a.descuentos) / nullif(a.ordenes_aov, 0) / 1.21 ticket_sin_iva, s.sesiones, s.ses_org, s.ses_pago, s.ses_mobile, s.ses_desktop, s.ses_org::float8 / nullif(s.sesiones, 0) share_organico, s.ses_pago::float8 / nullif(s.sesiones, 0) share_pago, s.rebotes::float8 / nullif(s.sesiones, 0) rebote, s.sesiones::float8 / nullif(s.dias_s, 0) sesiones_diarias, 100.0 * c.compras_conv / nullif(c.ses_conv, 0) conversion, c.ses_conv sesiones_embudo, k.carrito, k.checkout, k.compras, 1 - k.checkout::float8 / nullif(k.carrito, 0) abandono_carrito, 1 - k.compras::float8 / nullif(k.checkout, 0) abandono_checkout, cl.clientes_nuevos, cl.clientes_recurrentes, f.fact_total fact_total_sin_iva, f.inversion inversion_sin_iva, v.fact / 1.21 / nullif(f.fact_total, 0) peso_ecommerce, f.inversion / nullif(v.fact / 1.21, 0) inversion_sobre_fact, v.fact / 1.21 / nullif(f.inversion, 0) roas, f.inversion / nullif(s.sesiones, 0) costo_sesion_sin_iva, f.inversion / nullif(s.compras_ses, 0) costo_conversion_sin_iva, o.ordenes::float8 / nullif(s.sesiones, 0) tasa_adquisicion, mt.meta_gasto, mt.meta_valor / 1.21 / nullif(mt.meta_gasto, 0) roas_meta, ob.obj_facturacion, ob.obj_ordenes, ob.obj_conversion from meses m left join ventas v using (mes) left join aov a using (mes) left join ords o using (mes) left join ses s using (mes) left join conv c using (mes) left join chk k using (mes) left join cli cl using (mes) left join meta mt using (mes) left join fi f on f.periodo = m.periodo left join obj ob on ob.periodo = m.periodo), l as ( select b.*, lag(fact_sin_iva) over w fact_ant, lag(ordenes) over w ordenes_ant, lag(ticket_sin_iva) over w ticket_ant, lag(sesiones) over w sesiones_ant, lag(conversion) over w conversion_ant, lag(peso_ecommerce) over w peso_ant, lag(inversion_sobre_fact) over w inv_fact_ant, lag(roas) over w roas_ant, lag(sesiones_diarias) over w ses_diarias_ant, lag(share_organico) over w share_org_ant, lag(share_pago) over w share_pago_ant, lag(rebote) over w rebote_ant, lag(abandono_carrito) over w ab_carrito_ant, lag(abandono_checkout) over w ab_checkout_ant, lag(costo_sesion_sin_iva) over w costo_sesion_ant, lag(costo_conversion_sin_iva) over w costo_conv_ant, lag(roas_meta) over w roas_meta_ant from b window w as (order by mes)) select to_char(mes, 'YYYY-MM') mes, periodo, etiqueta, abrev, dias_mes, dias_datos, to_char(hasta, 'YYYY-MM-DD') hasta, (dias_datos >= dias_mes) completo, round(fact_con_iva::numeric, 0)::float8 fact_con_iva, round(ticket_con_iva::numeric, 0)::float8 ticket_con_iva, round(fact_sin_iva::numeric, 0)::float8 fact_sin_iva, round(fact_nuevos_sin_iva::numeric, 0)::float8 fact_nuevos_sin_iva, round(fact_recurrentes_sin_iva::numeric, 0)::float8 fact_recurrentes_sin_iva, ordenes::float8 ordenes, round(ticket_sin_iva::numeric, 0)::float8 ticket_sin_iva, sesiones::float8 sesiones, ses_org::float8 sesiones_organico, ses_pago::float8 sesiones_pago, ses_mobile::float8 sesiones_mobile, ses_desktop::float8 sesiones_desktop, round(share_organico::numeric, 4)::float8 share_organico, round(share_pago::numeric, 4)::float8 share_pago, round(rebote::numeric, 4)::float8 rebote, round(sesiones_diarias::numeric, 0)::float8 sesiones_diarias, round(conversion::numeric, 2)::float8 conversion, sesiones_embudo::float8 sesiones_embudo, carrito::float8 carrito, checkout::float8 checkout, compras::float8 compras, round(abandono_carrito::numeric, 4)::float8 abandono_carrito, round(abandono_checkout::numeric, 4)::float8 abandono_checkout, clientes_nuevos::float8 clientes_nuevos, clientes_recurrentes::float8 clientes_recurrentes, round(fact_total_sin_iva::numeric, 0)::float8 fact_total_sin_iva, round(inversion_sin_iva::numeric, 0)::float8 inversion_sin_iva, round(peso_ecommerce::numeric, 4)::float8 peso_ecommerce, round(inversion_sobre_fact::numeric, 4)::float8 inversion_sobre_fact, round(roas::numeric, 2)::float8 roas, round(costo_sesion_sin_iva::numeric, 0)::float8 costo_sesion_sin_iva, round(costo_conversion_sin_iva::numeric, 0)::float8 costo_conversion_sin_iva, round(tasa_adquisicion::numeric, 5)::float8 tasa_adquisicion, round(meta_gasto::numeric, 0)::float8 meta_gasto, round(roas_meta::numeric, 2)::float8 roas_meta, obj_facturacion::float8 obj_facturacion, obj_ordenes::float8 obj_ordenes, obj_conversion::float8 obj_conversion, round((fact_sin_iva / nullif(obj_facturacion, 0))::numeric, 4)::float8 avance_obj_facturacion, round((fact_sin_iva / nullif(fact_ant, 0) - 1)::numeric, 4)::float8 var_fact, round((ordenes::float8 / nullif(ordenes_ant, 0) - 1)::numeric, 4)::float8 var_ordenes, round((ticket_sin_iva / nullif(ticket_ant, 0) - 1)::numeric, 4)::float8 var_ticket, round((sesiones::float8 / nullif(sesiones_ant, 0) - 1)::numeric, 4)::float8 var_sesiones, round((sesiones_diarias / nullif(ses_diarias_ant, 0) - 1)::numeric, 4)::float8 var_sesiones_diarias, round((conversion - conversion_ant)::numeric, 2)::float8 dif_conversion, round((peso_ecommerce - peso_ant)::numeric, 4)::float8 dif_peso, round((inversion_sobre_fact - inv_fact_ant)::numeric, 4)::float8 dif_inversion_fact, round((roas - roas_ant)::numeric, 2)::float8 dif_roas, round((share_organico - share_org_ant)::numeric, 4)::float8 dif_share_organico, round((share_pago - share_pago_ant)::numeric, 4)::float8 dif_share_pago, round((rebote / nullif(rebote_ant, 0) - 1)::numeric, 4)::float8 var_rebote, round((abandono_carrito - ab_carrito_ant)::numeric, 4)::float8 dif_abandono_carrito, round((abandono_checkout - ab_checkout_ant)::numeric, 4)::float8 dif_abandono_checkout, round((costo_sesion_sin_iva / nullif(costo_sesion_ant, 0) - 1)::numeric, 4)::float8 var_costo_sesion, round((costo_conversion_sin_iva / nullif(costo_conv_ant, 0) - 1)::numeric, 4)::float8 var_costo_conversion, round((roas_meta - roas_meta_ant)::numeric, 2)::float8 dif_roas_meta from l order by mes`,
  );
}

export type NegocioDiaRow = {
  dia: string;
  mes: string;
  fact_con_iva: number;
  fact_sin_iva: number;
  fact_nuevos_sin_iva: number;
  fact_recurrentes_sin_iva: number;
  ordenes: number;
  neto_ticket_con_iva: number;
  ordenes_ticket: number;
};

export async function getNegocioDia(): Promise<NegocioDiaRow[]> {
  return queryReport<NegocioDiaRow>(
    `with v as ( select day, sum(total_sales) fact, sum(total_sales) filter (where new_or_returning_customer = 'New') fact_nuevos, sum(total_sales) filter (where new_or_returning_customer = 'Returning') fact_recurrentes from gold_shopify_sales_daily_rollup group by 1), a as (select day, sum(gross_sales) - sum(discounts) neto_ticket, sum(orders) ordenes_ticket from gold_shopify_average_order_value_over_time group by 1), o as (select day, sum(orders_last_click) ordenes from gold_shopify_orders_over_time group by 1) select to_char(day, 'YYYY-MM-DD') dia, to_char(day, 'YYYY-MM') mes, round(coalesce(v.fact, 0)::numeric, 0)::float8 fact_con_iva, round((coalesce(v.fact, 0) / 1.21)::numeric, 0)::float8 fact_sin_iva, round((coalesce(v.fact_nuevos, 0) / 1.21)::numeric, 0)::float8 fact_nuevos_sin_iva, round((coalesce(v.fact_recurrentes, 0) / 1.21)::numeric, 0)::float8 fact_recurrentes_sin_iva, coalesce(o.ordenes, 0)::float8 ordenes, round(coalesce(a.neto_ticket, 0)::numeric, 0)::float8 neto_ticket_con_iva, coalesce(a.ordenes_ticket, 0)::float8 ordenes_ticket from v full join a using (day) full join o using (day) order by day`,
  );
}

export type ProductoDiaRow = { dia: string; tipo: string; fact_sin_iva: number; unidades: number };

export async function getProductoDia(): Promise<ProductoDiaRow[]> {
  return queryReport<ProductoDiaRow>(
    `with base as ( select day, product_type tipo, sum(total_sales) total_sales, sum(net_items_sold) net_items_sold from gold_shopify_sales_daily_rollup group by 1, 2) , top as (select tipo from base group by 1 order by sum(total_sales) desc limit 25) select to_char(day, 'YYYY-MM-DD') dia, case when tipo in (select tipo from top) then tipo else 'Otros' end tipo, round((sum(total_sales) / 1.21)::numeric, 0)::float8 fact_sin_iva, sum(net_items_sold)::float8 unidades from base group by 1, 2 order by 1, 2`,
  );
}

export type ProductoRow = { mes: string; tipo: string; puesto: number; fact_sin_iva: number; unidades: number };

export async function getProductos(): Promise<ProductoRow[]> {
  return queryReport<ProductoRow>(
    `with p as ( select to_char(date_trunc('month', day), 'YYYY-MM') mes, product_type tipo, sum(total_sales) / 1.21 fact, sum(net_items_sold) unidades from gold_shopify_sales_daily_rollup group by 1, 2), r as (select p.*, rank() over (partition by mes order by fact desc, tipo) rk from p) select mes, case when rk <= 10 then tipo else 'Otros' end tipo, min(rk)::int puesto, round(sum(fact)::numeric, 0)::float8 fact_sin_iva, sum(unidades)::float8 unidades from r group by 1, 2 order by 1, 3`,
  );
}

export type TraficoRow = { mes: string; grupo: string; sesiones: number };

export async function getTrafico(): Promise<TraficoRow[]> {
  return queryReport<TraficoRow>(
    `select to_char(date_trunc('month', day), 'YYYY-MM') mes, case when lower(traffic_type) = 'paid' then 'Pago' when lower(traffic_type) = 'organic' then 'Orgánico' when traffic_type is null then '(En blanco)' else 'Otros' end grupo, sum(sessions)::float8 sesiones from gold_shopify_sessions_daily_rollup group by 1, 2 order by 1, 3 desc`,
  );
}

export type TraficoDiaRow = {
  dia: string;
  mes: string;
  sesiones: number;
  sesiones_organico: number;
  sesiones_pago: number;
  sesiones_mobile: number;
  sesiones_desktop: number;
  sesiones_otro_dispositivo: number;
  rebotes: number;
  clientes_nuevos: number;
  clientes_recurrentes: number;
};

export async function getTraficoDia(): Promise<TraficoDiaRow[]> {
  return queryReport<TraficoDiaRow>(
    `with s as ( select day, sum(sessions) sesiones, sum(sessions) filter (where lower(traffic_type) = 'organic') ses_org, sum(sessions) filter (where lower(traffic_type) = 'paid') ses_pago, sum(sessions) filter (where session_device_type = 'mobile') ses_mobile, sum(sessions) filter (where session_device_type = 'desktop') ses_desktop, sum(bounces) rebotes from gold_shopify_sessions_daily_rollup group by 1), c as ( select day, sum(customers) filter (where new_or_returning_customer = 'New') nuevos, sum(customers) filter (where new_or_returning_customer = 'Returning') recurrentes from gold_shopify_new_vs_returning_customers group by 1) select to_char(day, 'YYYY-MM-DD') dia, to_char(day, 'YYYY-MM') mes, coalesce(s.sesiones, 0)::float8 sesiones, coalesce(s.ses_org, 0)::float8 sesiones_organico, coalesce(s.ses_pago, 0)::float8 sesiones_pago, coalesce(s.ses_mobile, 0)::float8 sesiones_mobile, coalesce(s.ses_desktop, 0)::float8 sesiones_desktop, (coalesce(s.sesiones, 0) - coalesce(s.ses_mobile, 0) - coalesce(s.ses_desktop, 0))::float8 sesiones_otro_dispositivo, coalesce(s.rebotes, 0)::float8 rebotes, coalesce(c.nuevos, 0)::float8 clientes_nuevos, coalesce(c.recurrentes, 0)::float8 clientes_recurrentes from s full join c using (day) order by day`,
  );
}
