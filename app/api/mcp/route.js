import { z } from "zod";
import { FRONT_PROPERTY, allRows, createLessonTable, getNotion, lessons, pageBodyText, titleOf } from "../../../lib/notion";
import { syncLesson } from "../../../lib/sync";

// Endpoint MCP public (sans auth) : le secret Notion reste côté serveur.
// lesson_id = l'id de la table (data-source id) d'une leçon.
// Parle MCP Streamable HTTP (JSON-RPC) : initialize, tools/list, tools/call.
// Outils : list_lessons, create_lesson, preview_lesson, sync_lesson, où lesson_id
// est l'id de la table (data-source id).
// Les routes /api/sync|lessons|export restent protégées par TOKEN_PWD.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SERVER_INFO = { name: "philo-workflow", version: "0.2.0" };
const SUPPORTED_PROTOCOLS = ["2025-06-18", "2025-11-25"];

const lessonIdSchema = z.object({ lesson_id: z.string().min(1) });
const createLessonSchema = z.object({ name: z.string().min(1).max(200) });

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
    name: "create_lesson",
    title: "Créer une table de leçon",
    description: "Crée une table de leçon enfant de la page parente, avec une SEULE propriété titre nommée exactement `Front`. À n'appeler qu'après confirmation explicite de l'utilisateur et si aucune leçon similaire n'existe déjà (vérifie avec list_lessons). Ne crée pas les fiches elles-mêmes : après création, utilise le skill Notion pour ajouter les entrées dans la table.",
    inputSchema: { type: "object", properties: { name: { type: "string", description: "Nom de la leçon, qui sera aussi celui de la table." } }, required: ["name"], additionalProperties: false },
    outputSchema: {
      type: "object",
      properties: {
        lesson_id: { type: "string", description: "Data-source id de la table créée, à réutiliser pour preview_lesson et sync_lesson." },
        lesson: { type: "string" },
        databaseId: { type: "string" },
        url: { type: "string" },
      },
      required: ["lesson_id", "lesson"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
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
    description: "Régénère le cache d'une leçon, c'est-à-dire sa page « <nom de la leçon> Cards » sous la page « Card ». Ecrase le cache existant. A n'appeler qu'après relecture par l'utilisateur et sur son ordre explicite.",
    inputSchema: { type: "object", properties: { lesson_id: { type: "string", description: "Id de la table (data-source id) de la leçon." } }, required: ["lesson_id"], additionalProperties: false },
    outputSchema: {
      type: "object",
      properties: {
        lesson: { type: "string" },
        cards: { type: "number" },
        cacheUrl: { type: "string", description: "URL de la page « <leçon> Cards » régénérée." },
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
  if (name === "create_lesson") {
    const { name: lessonName } = createLessonSchema.parse(args ?? {});
    const items = await lessons();
    const duplicate = items.find((l) => l.name.trim().toLowerCase() === lessonName.trim().toLowerCase());
    if (duplicate) {
      return {
        structuredContent: { lesson_id: duplicate.id, lesson: duplicate.name, databaseId: "", url: "" },
        content: [{ type: "text", text: `La leçon « ${duplicate.name} » existe déjà (lesson_id ${duplicate.id}). Aucune table créée.` }],
      };
    }
    const created = await createLessonTable(notion, lessonName.trim());
    const text = `Table « ${created.name} » créée avec la seule propriété « ${FRONT_PROPERTY} ». lesson_id : ${created.id}. Partage-la avec l'intégration du workflow (NOTION_TOKEN) pour que le MCP la voie, puis ajoute l'embed https://notion-philo-workflow.vercel.app/embed/${created.id}?token=<TOKEN_PWD> dans la page parente.`;
    return { structuredContent: { lesson_id: created.id, lesson: created.name, databaseId: created.databaseId, url: created.url }, content: [{ type: "text", text }] };
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
