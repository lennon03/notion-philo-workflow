# Notion Export — V2

Application Next.js qui lit directement les tables Notion et exporte une ou plusieurs tables sélectionnées en DOCX, HTML ou PDF via l'impression du navigateur.

## Lancer localement

1. Copiez `.env.example` vers `.env.local` et renseignez `NOTION_TOKEN`.
2. Partagez la page parente et chaque base de leçon avec l'intégration Notion.
3. Exécutez `bun install`, puis `bun run dev`.

La page racine est vide par défaut. Ajoutez `?id=<page_id>` pour charger une page Notion.

## Exports

La sélection accepte plusieurs tables et les exporte dans un document unique. Les trois formats disponibles sont DOCX, HTML et PDF expérimental. Le PDF ouvre l'HTML dans le navigateur afin d'utiliser son moteur d'impression.

Les données sont toujours relues directement depuis les data sources Notion et le contenu de leurs pages. V2 ne crée, ne lit et ne synchronise aucun cache.

## Déploiement Vercel

Ajoutez `NOTION_TOKEN` et, si besoin, `NOTION_PARENT_PAGE_ID` ou `NOTION_LESSONS_JSON` dans les variables d'environnement de production.

L'URL principale accepte `?id=<page_id>`. Pour une page privée, ajoutez le token réel de l'intégration Notion : `?id=<page_id>&token=<notion_token>`. Sans token d'URL, l'application utilise `NOTION_TOKEN`.

## Embed par page

`/embed/<page_id>?token=<notion_token>` affiche une page Notion directement exportable.
