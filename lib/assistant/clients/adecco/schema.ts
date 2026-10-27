// Descripción de las 2 tablas gold de Adecco para el system prompt del
// asistente. Mismo criterio que lib/assistant/clients/deca/schema.ts: sale
// de information_schema.columns real, no solo de lo que algún reporte fijo
// use hoy — si el pipeline agrega o cambia columnas en gold_*, actualizá
// esto corriendo de nuevo contra information_schema.columns.

export const SCHEMA = `
# Tablas disponibles (schema public, Postgres)

Todas son de Adecco — un solo cliente, sin columna de tenant. Todas
tienen \`id\` (uuid) y \`synced_at\` (cuándo se sincronizó esa fila) — no
suelen importar para responder preguntas de negocio, no hace falta
mencionarlos salvo que se pregunte puntualmente por la frescura del dato.

## gold_prensa_adecco
Cobertura de prensa/PR — una fila por nota o mención:
- cliente, marca (text)
- fecha (timestamp)
- tier (bigint — nivel/categoría del medio)
- medio, tipo_de_medio (text)
- periodista, vocero (text)
- formato_contenido (text)
- nacional_o_interior, provincia (text)
- industria (text)
- campana (text — sin tilde a propósito, en origen es "campaña")
- tema, tono (text — tono probablemente positivo/negativo/neutro, confirmá los valores reales con un SELECT antes de asumir)
- mencion_gestion (text — sin tilde a propósito, en origen es "mención_gestión")
- pago_organico (text)
- inversion (double precision — todavía en 0 para todas las filas, el dato real no está cargado en origen; avisá si una pregunta depende de este campo)
- reach, cpe_vap (bigint)
- link_a_nota, hipervinculo (text)

## gold_influencers_adecco
Una fila por PIEZA de contenido (no por contrato) — misma estructura y
mismas convenciones que la tabla de Decathlon (ver presupuesto, que se
repite por fila):
- empresa, marca, campana (text), objetivo (text — objetivo de la campaña, no un número)
- influencer, territorio (text, territorio puede ser NULL)
- periodo_desde, periodo_hasta (timestamp)
- presupuesto (numeric — fee del CONTRATO completo, se repite en cada pieza, ver convenciones)
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
