# Workflow Philo Notion

Application Next.js pour synchroniser les caches de leçons et exporter une leçon au format Word. Le code Word réemploie la logique de l’ancien projet, en lecture seule, et la rend accessible via l’interface web.

## Lancer localement

1. Copiez `.env.example` vers `.env.local` et renseignez `NOTION_TOKEN`.
2. Partagez la page parente et chaque base de leçon avec l’intégration Notion correspondant au jeton.
3. Exécutez `npm install`, puis `npm run dev`.

Par défaut, l’application découvre les bases inline présentes dans la page `NOTION_PARENT_PAGE_ID`. Pour des leçons placées ailleurs, configurez `NOTION_LESSONS_JSON`.

## Cache

La page cache est nommée exactement `- cache -`. Elle est retrouvée grâce à un marqueur technique interne et entièrement régénérée à chaque synchronisation : aucun doublon n’est créé. Une modification manuelle du cache est écrasée à la prochaine synchronisation ; la table source demeure l’autorité.

## Déploiement Vercel

Importez ce dossier dans un projet Vercel. Ajoutez `NOTION_TOKEN`, `NOTION_PARENT_PAGE_ID`, `TOKEN_PWD` et, si besoin, `NOTION_LESSONS_JSON` dans les variables d’environnement de production. Puis embarquez l’URL de production avec `/embed?token=VOTRE_TOKEN_PWD` dans Notion.

## MCP public (sans auth)

`POST /api/mcp` parle MCP Streamable HTTP (JSON-RPC) sans `TOKEN_PWD` : le secret Notion reste côté serveur. Outils : `list_lessons`, `preview_lesson({lesson_id})`, `sync_lesson({lesson_id})`, où `lesson_id` est l’id de la table (data-source id). `sync_lesson` n’est à appeler qu’après relecture et sur ordre de l’utilisateur.

## Embed par table

`/embed/<lesson_id>?token=xxx` affiche une vue mono-leçon (titre + statut au-dessus des deux boutons Sync / Export), adaptée aux embeds Notion étroits. Chaque ligne de la liste principale propose un lien ⧉ vers sa vue embarquée.

## Plugin

`plugin/philo-flashcards` est un plugin d’instructions autonome. Le ZIP à installer est créé à la racine du projet sous le nom `philo-flashcards-plugin.zip`.
