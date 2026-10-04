import { z } from "zod";
import { allRows, getNotion, lessons, pageBodyText, titleOf } from "../../../lib/notion";
import { syncLesson } from "../../../lib/sync";

// Endpoint MCP public (sans auth) : le secret Notion reste côté serveur.
// lesson_id = l'id de la table (data-source id) d'une leçon.
// Parle MCP Streamable HTTP (JSON-RPC) : initialize, tools/list, tools/call.
// Les routes /api/sync|lessons|export restent protégées par TOKEN_PWD.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SERVER_INFO = { name: "philo-workflow", version: "0.2.0" };
const SUPPORTED_PROTOCOLS = ["2025-06-18", "2025-11-25"];

const lessonIdSchema = z.object({ lesson_id: z.string().min(1) });

const TOOLS = [
  {
    name: "list_lessons",
    title: "Lister les leçons",
    description: "Liste les tables de leçons de philosophie (id de table + nom). Appelle-la pour résoudre un nom de leçon en lesson_id avant preview_lesson ou sync_lesson.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    outputSchema: {
      type: "object",
      properties: {
        lessons: { type: "array", items: { type: "object", properties: { id: { type: "string" }, name: { type: "string" } }, required: ["id", "name"] } },
      },
      required: ["lessons"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  {
    name: "preview_lesson",
    title: "Aperçu des cartes d'une leçon",
    description: "Lit les cartes Anki (question + réponse) d'une table de leçon sans rien modifier. Sert à relire et à construire l'aperçu HTML avant toute synchronisation.",
    inputSchema: { type: "object", properties: { lesson_id: { type: "string", description: "Id de la table (data-source id) de la leçon." } }, required: ["lesson_id"], additionalProperties: false },
    outputSchema: {
      type: "object",
      properties: {
        lesson: { type: "string" },
        cards: {
          type: "array",
          items: { type: "object", properties: { question: { type: "string" }, answer: { type: "string" } }, required: ["question", "answer"] },
        },
      },
      required: ["lesson", "cards"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  {
    name: "sync_lesson",
    title: "Synchroniser le cache d'une leçon",
    description: "Régénère la page cache '- cache -' d'une leçon à partir de sa table. Ecrase le cache existant. A n'appeler qu'après relecture par l'utilisateur et sur son ordre explicite.",
    inputSchema: { type: "object", properties: { lesson_id: { type: "string", description: "Id de la table (data-source id) de la leçon." } }, required: ["lesson_id"], additionalProperties: false },
    outputSchema: {
      type: "object",
      properties: {
        lesson: { type: "string" },
        cards: { type: "number" },
        cacheUrl: { type: "string" },
      },
      required: ["lesson", "cards"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
];

function ok(id, result) {
  return Response.json({ jsonrpc: "2.0", id, result }, { headers: cors() });
}

function fail(id, code, message) {
  return Response.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } }, { headers: cors() });
}

function cors() {
  return { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type, mcp-session-id" };
}

async function callTool(name, args) {
  const notion = getNotion();
  if (name === "list_lessons") {
    const items = await lessons();
    const structuredContent = { lessons: items };
    return { structuredContent, content: [{ type: "text", text: items.map((l) => `- ${l.name} (${l.id})`).join("\n") || "Aucune leçon." }] };
  }
  if (name === "preview_lesson") {
    const { lesson_id } = lessonIdSchema.parse(args ?? {});
    const items = await lessons();
    const lesson = items.find((l) => l.id === lesson_id);
    if (!lesson) throw new Error(`Leçon introuvable pour lesson_id ${lesson_id}. Appelle list_lessons.`);
    const rows = await allRows(notion, lesson_id);
    const cards = [];
    for (const row of rows) {
      const body = await pageBodyText(notion, row.id);
      cards.push({ question: titleOf(row).slice(0, 500), answer: body.slice(0, 1500) });
    }
    const structuredContent = { lesson: lesson.name, cards };
    const text = [`Leçon « ${lesson.name} » : ${cards.length} cartes.`, ...cards.map((c, i) => `${i + 1}. Q: ${c.question}`)].join("\n");
    return { structuredContent, content: [{ type: "text", text }] };
  }
  if (name === "sync_lesson") {
    const { lesson_id } = lessonIdSchema.parse(args ?? {});
    const items = await lessons();
    const lesson = items.find((l) => l.id === lesson_id);
    if (!lesson) throw new Error(`Leçon introuvable pour lesson_id ${lesson_id}. Appelle list_lessons.`);
    const result = await syncLesson(notion, lesson);
    return { structuredContent: result, content: [{ type: "text", text: `${result.lesson} : ${result.cards} cartes synchronisées.` }] };
  }
  throw new Error(`Outil inconnu : ${name}`);
}

async function handleRpc(body) {
  if (!body || body.jsonrpc !== "2.0" || typeof body.method !== "string") return fail(body?.id, -32600, "Requête JSON-RPC invalide.");
  const { id, method, params } = body;
  const isNotification = id === undefined || id === null;
  try {
    if (method === "initialize") {
      const requested = params?.protocolVersion;
      const protocolVersion = SUPPORTED_PROTOCOLS.includes(requested) ? requested : SUPPORTED_PROTOCOLS[0];
      return ok(id, { protocolVersion, capabilities: { tools: {} }, serverInfo: SERVER_INFO });
    }
    if (method === "ping") return ok(id, {});
    if (method === "tools/list") return ok(id, { tools: TOOLS });
    if (method === "tools/call") {
      const result = await callTool(params?.name, params?.arguments);
      return ok(id, { ...result, isError: false });
    }
    if (method.startsWith("notifications/")) {
      return new Response(null, { status: 202, headers: cors() });
    }
    if (isNotification) return new Response(null, { status: 202, headers: cors() });
    return fail(id, -32601, `Méthode inconnue : ${method}`);
  } catch (error) {
    if (isNotification) return new Response(null, { status: 202, headers: cors() });
    if (method === "tools/call") {
      return ok(id, { content: [{ type: "text", text: error.message || "L'appel a échoué." }], isError: true });
    }
    return fail(id, -32602, error.message || "Paramètres invalides.");
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    if (Array.isArray(body)) {
      const responses = [];
      for (const item of body) {
        const response = await handleRpc(item);
        if (response.status !== 202) responses.push(await response.json());
      }
      if (!responses.length) return new Response(null, { status: 202, headers: cors() });
      return Response.json(responses, { headers: cors() });
    }
    return handleRpc(body);
  } catch (error) {
    return fail(null, -32700, error.message || "JSON invalide.");
  }
}

export async function GET() {
  // Pas de flux SSE : les clients MCP basculent sur POST pur (SSE optionnel).
  return Response.json({ error: "MCP Streamable HTTP : utilise POST JSON-RPC." }, { status: 405, headers: cors() });
}

export async function DELETE() {
  return new Response(null, { status: 204, headers: cors() });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: { ...cors(), "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS" } });
}
