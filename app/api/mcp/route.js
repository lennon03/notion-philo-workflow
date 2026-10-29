import { z } from "zod";
import { FRONT_PROPERTY, allRows, createLessonTable, getNotion, lessons, pageBodyText, titleOf } from "../../../lib/notion";

// Endpoint MCP public (sans auth) : le secret Notion reste côté serveur.
// lesson_id = l'id de la table (data-source id) d'une leçon.
// Parle MCP Streamable HTTP (JSON-RPC) : initialize, tools/list, tools/call.
// Outils : list_lessons, create_lesson, preview_lesson, où lesson_id
// est l'id de la table (data-source id).
// Les routes /api/lessons|export restent protégées par TOKEN_PWD.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SERVER_INFO = { name: "philo-workflow", version: "0.3.0" };
const SUPPORTED_PROTOCOLS = ["2025-06-18", "2025-11-25"];

// Guidance serveur renvoyée dans initialize.instructions. Elle porte le long
// formatage (consigne de production et aperçu HTML) ; les
// outils restent autonomes grâce à leurs descriptions, donc rien d'indispensable
// ne dépend de ce bloc.
const SERVER_INSTRUCTIONS = `Workflow de flashcards de philosophie (Notion).

PRÉREQUIS EXTERNE. Ce serveur ne donne pas accès à Notion : la lecture et l'écriture dans Notion passent par un skill Notion externe que l'agent doit avoir importé. Ne simule jamais l'accès à Notion et n'invente ni page, ni table, ni identifiant. Si le skill Notion est absent, dis-le clairement et arrête-toi.

RÉFLEXE DE DÉMARRAGE. Quand l'utilisateur parle d'une leçon sans identifiant, appelle list_lessons pour traduire son nom en lesson_id. Avant toute écriture, lis la structure de la table et vérifie que le champ Front est disponible.

CRÉER LES FICHES. Crée les entrées directement dans la bonne table, via le skill Notion : Front contient la question ou l'intitulé reformulé, et la réponse complète va dans le contenu de la page associée à l'entrée. N'écris jamais dans une page cache. Avant une création importante, indique brièvement la table visée et le nombre de cartes prévues, et affiche les cartes dans un tableau. Après l'écriture, précise la table modifiée, le nombre de cartes créées, et les limites ou ambiguïtés rencontrées.

CONSIGNE DE PRODUCTION (philosophe). Si la demande ne comporte pas le mot OCR, applique ceci : à partir des documents de cours joints, crée des flashcards. Organise les cartes par grands axes de cours et par auteurs, et non par notions élémentaires isolées ; chaque carte porte sur une thèse ou un raisonnement complet. Dans chaque réponse, regroupe les notions nécessaires au même axe : définitions utiles, distinctions, argumentation, conséquences pour la conception du bonheur ou du désir. Fais des cartes suffisamment denses pour préparer une évaluation, mais claires et mémorisables. Reste fidèle au cours ; évite le contexte historique, les exemples de la vie réelle et les cartes de définition isolée. Les intitulés restent fidèles aux axes du cours tout en comportant l'indice du contenu.

Si la demande comporte le mot OCR, ne change strictement rien à ce qui apparaît dans la photo que l'utilisateur envoie.

SOURCE DES DONNÉES. Les tables Notion sont l'unique source de vérité. Les lectures relisent directement les lignes et le contenu des pages associées ; aucun cache n'est créé ou synchronisé.

APERÇU HTML (si l'utilisateur demande un aperçu). Appelle preview_lesson, puis produis UNE page HTML autonome en artefact de chat, pas une page hébergée. Style spec, pas landing page : dense, lisible rapidement, sans hero, sans chrome décoratif, sans ton marketing, sans tirets cadratins. Fond noir pur (#000), texte blanc, gris sombre uniquement pour surfaces secondaires ou accents. Lisible sur mobile : viewport responsive, aucune mise en page à largeur fixe. HTML sémantique, CSS inline, SVG inline, images HTTPS ou data-URL uniquement. Script classique inline uniquement si l'interactivité aide vraiment ; la page doit rester utile sans JavaScript (le bac à sable bloque stockage, fetch, workers, frames, formulaires, popups). Sans script : liens externes en target="_blank" + rel="noopener noreferrer" ; avec script : pas de target="_blank". Jamais : scripts externes ou modules, gestionnaires d'événements inline, URLs javascript:, formulaires, frames, embeds, objets, applets, meta refresh, feuilles de style liées, secrets, URLs privées, chemins locaux. La page commence par un tableau question | réponse | changements. Les cartes sont en markdown Notion limité à : puces, flèches -> ou =>, italique, séparateurs. Aucune autre mise en forme.

CRÉER UNE NOUVELLE LECON. Après confirmation de l'utilisateur, et seulement si list_lessons ne renvoie rien de similaire : 1) appelle create_lesson({name}), qui crée la table et renvoie lesson_id ; s'il signale qu'une leçon de ce nom existe, reprends le lesson_id de list_lessons sans en créer une seconde. 2) Demande à l'utilisateur de partager la nouvelle base avec l'intégration du workflow (celle de NOTION_TOKEN), sinon ce serveur ne la verra pas ; cette étape ne peut pas être automatisée, et une table absente de list_lessons en est le symptôme. 3) Ajoute les fiches avec le skill Notion. 4) Dans la page parente, ajoute un bloc Embed pointant sur l'URL de vue mono-leçon ci-dessous, en demandant le TOKEN_PWD à l'utilisateur et sans jamais inventer sa valeur. 5) Vérifie en ouvrant le lien : la vue mono-leçon (titre et boutons d'export) doit s'afficher.

INSTANCE. Workflow hébergé : https://notion-philo-workflow.vercel.app/api/mcp. Application web : https://notion-philo-workflow.vercel.app. Vue mono-leçon : https://notion-philo-workflow.vercel.app/embed/<lesson_id>?token=<TOKEN_PWD>. Ces URL sont celles de cette instance : utilise-les telles quelles, n'invente pas d'autre domaine et ne demande pas à l'utilisateur d'URL de déploiement.`;

const lessonIdSchema = z.object({ lesson_id: z.string().min(1) });
const createLessonSchema = z.object({ name: z.string().min(1).max(200) });

const TOOLS = [
  {
    name: "list_lessons",
    title: "Lister les leçons",
    description: "Liste les leçons : pour chacune, son lesson_id et son nom. Appelle cet outil en premier dès que l'utilisateur parle d' flashcards de philosophie, d'une leçon, d'un chapitre ou d'un cours à relire, et systématiquement avant d'en créer une nouvelle. Lecture seule, ne modifie rien.",
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
        lesson_id: { type: "string", description: "Data-source id de la table créée, à réutiliser pour preview_lesson." },
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
    description: "Relit directement toutes les cartes d'une table (question + réponse) sans rien modifier. Sa sortie sert aussi à construire l'aperçu HTML. Lecture seule.",
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
      return ok(id, { protocolVersion, capabilities: { tools: {} }, serverInfo: SERVER_INFO, instructions: SERVER_INSTRUCTIONS });
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
