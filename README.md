# Workflow Philo Notion — V2

Application Next.js qui lit directement les tables Notion et exporte une ou plusieurs tables sélectionnées en DOCX, HTML ou PDF via l'impression du navigateur.

## Lancer localement

1. Copiez `.env.example` vers `.env.local` et renseignez `NOTION_TOKEN`.
2. Partagez la page parente et chaque base de leçon avec l'intégration Notion.
3. Exécutez `bun install`, puis `bun run dev`.

Les tables de leçon sont découvertes dans `NOTION_PARENT_PAGE_ID`. Pour des tables placées ailleurs, configurez `NOTION_LESSONS_JSON`.

## Exports

La sélection accepte plusieurs tables et les exporte dans un document unique. Les trois formats disponibles sont DOCX, HTML et PDF expérimental. Le PDF ouvre l'HTML dans le navigateur afin d'utiliser son moteur d'impression.

Les données sont toujours relues directement depuis les data sources Notion et le contenu de leurs pages. V2 ne crée, ne lit et ne synchronise aucun cache.

## Déploiement Vercel

Ajoutez `NOTION_TOKEN`, `NOTION_PARENT_PAGE_ID`, `TOKEN_PWD` et, si besoin, `NOTION_LESSONS_JSON` dans les variables d'environnement de production. Embarquez ensuite `/embed?token=VOTRE_TOKEN_PWD` dans Notion.

## MCP public

`POST /api/mcp` parle MCP Streamable HTTP (JSON-RPC), sans `TOKEN_PWD`. Outils : `list_lessons`, `create_lesson` et `preview_lesson`. `preview_lesson` lit directement la table demandée.

## Embed par table

`/embed/<lesson_id>?token=xxx` affiche une vue mono-table adaptée aux embeds Notion, avec les boutons d'export.
