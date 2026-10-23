import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam, Tool, ToolUseBlock } from "@anthropic-ai/sdk/resources/messages";
import { NextResponse } from "next/server";
import { SCHEMA } from "@/lib/assistant/schema";
import { CONVENTIONS } from "@/lib/assistant/conventions";
import { runAssistantQuery } from "@/lib/supabase/readonlyPg";

export const dynamic = "force-dynamic";

const DEFAULT_MODEL = "claude-sonnet-5-5";
// Preguntas complejas (ej. "¿cómo afectó tal campaña a las ventas?")
// necesitan encontrar la campaña, su rango de fechas, y recién ahí cruzar
// con ventas — varios pasos legítimos. 6 se quedaba corto incluso con el
// schema completo documentado.
const MAX_SQL_CALLS = 14;

type ChatMessage = { role: "user" | "assistant"; content: string };

export type ChartSpec = {
  type: "kpi" | "table" | "bar" | "line";
  title: string;
  rows: Record<string, unknown>[];
  xKey?: string;
  yKey?: string;
  valueKey?: string;
  valueLabel?: string;
};

export type AssistantReport = { summary: string; sql: string; chart: ChartSpec | null };

const SYSTEM_PROMPT = `Sos el asistente de datos de Decathlon dentro de Coolmetrics (el portal de reportes de la agencia MOSCU). Tu trabajo es responder preguntas armando gráficos/reportes nuevos al vuelo, leyendo directo de la base con SQL de solo lectura.

Reglas:
- Es un solo cliente (Decathlon) — no hay riesgo de mezclar datos de otro cliente porque no existen en esta base.
- Solo podés leer datos con la tool run_sql (SELECT o WITH). Nunca inventes un número: si una consulta no trae filas, o trae NULL, decilo tal cual en tu respuesta — no lo reemplaces por una estimación ni por cero sin aclararlo.
- El schema de abajo ya tiene las columnas reales de las 16 tablas — no deberías necesitar "select * ... limit 3" para descubrir qué columnas existen. Usalo solo si una columna puntual tiene un formato dudoso (está marcado en el schema cuándo conviene revisarlo así).
- Preguntas complejas (ej. relacionar una campaña puntual con su efecto en ventas) necesitan varios pasos — está bien, tenés margen. Pero no repitas una exploración que ya hiciste: si ya viste la forma de una tabla, usá ese conocimiento en el resto de la conversación.
- Cuando tengas la respuesta, llamá a la tool present_report UNA sola vez, con el SQL FINAL que de verdad respalda la respuesta (el que trajo los datos que mostrás, no uno intermedio de exploración) — ese SQL se le muestra al usuario para que lo pueda verificar, así que tiene que ser exacto.
- Preferí el gráfico más simple que represente bien la pregunta: "kpi" para un solo número, "table" para un desglose con varias columnas, "bar" para comparar categorías, "line" para una evolución en el tiempo. Si hay más de un dato para comparar, siempre va en un gráfico — nunca listes esos valores solo en el texto.
- El resumen en texto es corto: 2 a 4 oraciones con la conclusión o el dato más importante, no una narración número por número. El gráfico ya muestra los valores — NO los repitas ahí abajo uno por uno. Si hay un supuesto o una limitación que el usuario necesita saber (datos incompletos, un criterio que elegiste), decilo en una sola frase.
- Respondé siempre en español, tono directo y breve. El texto es apoyo del gráfico, no al revés.

${SCHEMA}

${CONVENTIONS}`;

const TOOLS: Tool[] = [
  {
    name: "run_sql",
    description:
      "Ejecuta una consulta SQL de solo lectura (SELECT o WITH) contra las tablas gold_* y devuelve las filas. Usala para explorar tablas no documentadas o para armar la consulta final.",
    input_schema: {
      type: "object",
      properties: {
        sql: { type: "string", description: "La consulta SQL completa, de solo lectura." },
      },
      required: ["sql"],
    },
  },
  {
    name: "present_report",
    description:
      "Entrega la respuesta final al usuario: un resumen en texto, el SQL que de verdad respalda esa respuesta, y un gráfico. Llamala una sola vez, al final.",
    input_schema: {
      type: "object",
      properties: {
        summary: { type: "string", description: "Respuesta en texto plano, en español." },
        sql: { type: "string", description: "El SQL final que trajo los datos mostrados." },
        chart: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["kpi", "table", "bar", "line"] },
            title: { type: "string" },
            rows: { type: "array", items: { type: "object" } },
            xKey: { type: "string" },
            yKey: { type: "string" },
            valueKey: { type: "string" },
            valueLabel: { type: "string" },
          },
          required: ["type", "title", "rows"],
        },
      },
      required: ["summary", "sql", "chart"],
    },
  },
];

function missingEnvResponse(name: string) {
  return NextResponse.json({ error: `Falta configurar la variable de entorno ${name}.` }, { status: 500 });
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return missingEnvResponse("ANTHROPIC_API_KEY");
  if (!process.env.SUPABASE_READONLY_DB_URL) return missingEnvResponse("SUPABASE_READONLY_DB_URL");

  let body: { messages?: ChatMessage[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }
  const history = body.messages ?? [];
  if (!history.length) {
    return NextResponse.json({ error: "Falta el mensaje del usuario." }, { status: 400 });
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = process.env.ANTHROPIC_CHAT_MODEL || DEFAULT_MODEL;

  const messages: MessageParam[] = history.map((m) => ({ role: m.role, content: m.content }));

  let sqlCalls = 0;
  for (let turn = 0; turn < MAX_SQL_CALLS + 1; turn++) {
    let response;
    try {
      response = await anthropic.messages.create({
        model,
        max_tokens: 8192,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages,
      });
    } catch (error) {
      return NextResponse.json(
        { error: `Error llamando a la API de Claude: ${error instanceof Error ? error.message : String(error)}` },
        { status: 502 },
      );
    }

    const toolUseBlocks = response.content.filter((b): b is ToolUseBlock => b.type === "tool_use");
    const presentCall = toolUseBlocks.find((b) => b.name === "present_report");
    if (presentCall) {
      const input = presentCall.input as AssistantReport;
      return NextResponse.json({
        summary: input.summary,
        sql: input.sql,
        chart: input.chart ?? null,
      } satisfies AssistantReport);
    }

    const sqlCalls_ = toolUseBlocks.filter((b) => b.name === "run_sql");
    if (!sqlCalls_.length) {
      // El modelo respondió en texto plano sin llamar a present_report — lo
      // tratamos como resumen sin gráfico en vez de romper la respuesta.
      const text = response.content
        .filter((b): b is Extract<(typeof response.content)[number], { type: "text" }> => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      return NextResponse.json({
        summary: text || "No pude armar una respuesta para esta pregunta.",
        sql: "",
        chart: null,
      } satisfies AssistantReport);
    }

    sqlCalls += sqlCalls_.length;
    if (sqlCalls > MAX_SQL_CALLS) {
      return NextResponse.json(
        { error: `La consulta se volvió demasiado larga de resolver (más de ${MAX_SQL_CALLS} pasos). Probá con una pregunta más acotada.` },
        { status: 422 },
      );
    }

    messages.push({ role: "assistant", content: response.content });
    const toolResults = await Promise.all(
      sqlCalls_.map(async (block) => {
        const { sql } = block.input as { sql: string };
        const result = await runAssistantQuery(sql);
        const content = "error" in result ? `Error: ${result.error}` : JSON.stringify(result.rows);
        return { type: "tool_result" as const, tool_use_id: block.id, content };
      }),
    );
    messages.push({ role: "user", content: toolResults });
  }

  return NextResponse.json({ error: "No se pudo resolver la consulta." }, { status: 500 });
}
