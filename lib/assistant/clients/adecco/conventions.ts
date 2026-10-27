// Mismo motivo que lib/assistant/clients/deca/conventions.ts: reglas de
// negocio que el asistente necesita como contexto fijo antes de escribir
// SQL. Si se agrega una convención nueva, agregarla acá también.

export const CONVENTIONS = `
# Convenciones de datos — Adecco (gold_* en Supabase/Postgres)

Estas tablas vienen de un pipeline diario de Fabric. Son de un único
cliente (Adecco) — no hay columna de tenant, no filtres por cliente.

## Prensa (gold_prensa_adecco)
- \`inversion\` está en 0 en todas las filas hoy — el dato real de
  inversión paga todavía no se cargó en origen. Si una pregunta depende
  de ese número, aclaralo en vez de responder con un 0 sin contexto.
- \`tono\` y los demás campos de texto libre: no asumas valores fijos sin
  confirmarlos con un \`SELECT DISTINCT\` primero — esta tabla es más
  nueva que las demás y los valores reales pueden no coincidir con lo
  que diría un reporte típico de prensa.

## Influencers (gold_influencers_adecco)
Misma estructura y mismas reglas que la tabla de Decathlon (son el mismo
tipo de dato, cada cliente con su propio Lakehouse):
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
- \`scope_recibido_tipo\` es el formato REALMENTE entregado; \`scope_acordado_tipo\`
  es el formato ACORDADO en el contrato — no son lo mismo.
- Cumplimiento = 100 × mín(acordado, recibido) / acordado, por tipo de
  pieza — nunca más de 100%, aunque se haya entregado de más.

## Unidades y formato
- Enteros para conteos (piezas, contratos, influencers).
- Porcentajes: confirmá si la query ya multiplicó por 100 antes de
  formatear, para no duplicar la escala.
`;
