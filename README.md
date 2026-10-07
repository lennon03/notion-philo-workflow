# Workflow Philo Notion

Application Next.js pour synchroniser les caches de leçons et exporter une leçon au format Word. Le code Word réemploie la logique de l’ancien projet, en lecture seule, et la rend accessible via l’interface web.

## Lancer localement

1. Copiez `.env.example` vers `.env.local` et renseignez `NOTION_TOKEN`.
2. Partagez la page parente et chaque base de leçon avec l’intégration Notion correspondant au jeton.
3. Exécutez `npm install`, puis `npm run dev`.

Par défaut, l’application découvre les bases inline présentes dans la page `NOTION_PARENT_PAGE_ID`. Pour des leçons placées ailleurs, configurez `NOTION_LESSONS_JSON`.

## Cache

Chaque table de leçon a son propre cache, et tous les caches sont regroupés sous une page `Card`, elle-même enfant de la page parente. Le cache d'une leçon « Le bonheur » est donc la page « Le bonheur Cards » dans `Card`. La page `Card` est créée à la première synchronisation.

Chaque cache est retrouvé grâce à un marqueur technique interne et non via son titre : le renommer dans Notion n'en provoque pas de duplication. Son contenu est entièrement régénéré à chaque synchronisation. Une modification manuelle du cache est écrasée à la prochaine synchronisation ; la table source demeure l'autorité.

## Déploiement Vercel

Importez ce dossier dans un projet Vercel. Ajoutez `NOTION_TOKEN`, `NOTION_PARENT_PAGE_ID`, `TOKEN_PWD` et, si besoin, `NOTION_LESSONS_JSON` dans les variables d’environnement de production. Puis embarquez l’URL de production avec `/embed?token=VOTRE_TOKEN_PWD` dans Notion.

## MCP public (sans auth)

`POST /api/mcp` parle MCP Streamable HTTP (JSON-RPC) sans `TOKEN_PWD` : le secret Notion reste côté serveur. Outils : `list_lessons`, `create_lesson({name})`, `preview_lesson({lesson_id})`, `sync_lesson({lesson_id})`, où `lesson_id` est l’id de la table (data-source id). `sync_lesson` n’est à appeler qu’après relecture et sur ordre de l’utilisateur.

## Tables de leçon

`create_lesson` crée une base de données enfant de la page parente dont la seule propriété est un champ titre nommé exactement `Front`. Il refuse de créer une table si une leçon porte déjà ce nom. Une fois la table créée, elle doit être partagée avec l’intégration correspondant à `NOTION_TOKEN`, sinon `list_lessons` ne la verra pas.

## Embed par table

`/embed/<lesson_id>?token=xxx` affiche une vue mono-leçon (titre + statut au-dessus des deux boutons Sync / Export), adaptée aux embeds Notion étroits. Chaque ligne de la liste principale propose un lien ⧉ vers sa vue embarquée.

## Plugin

Le plugin n’est pas dans ce dépôt : il vit dans un dépôt séparé, `philo-flashcards-plugin`, qui ne contient que `plugin.json`, `mcp.json` et `skills/`. Son `mcp.json` pointe vers le `POST /api/mcp` de ce projet. Toute modification du contrat d'outils doit être répercutée dans la skill du plugin.
