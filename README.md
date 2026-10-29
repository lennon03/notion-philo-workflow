# Notion Table Exporter

Exportez le contenu de vos pages Notion en PDF, Word ou HTML.

## 1. Structure compatible

La page Notion doit contenir une base de données intégrée, avec une ligne par page à exporter.

![Exemple de structure Notion](docs/notion-example.png)

## 2. Document exporté

Le contenu des pages est transformé en document propre et lisible.

![Exemple de document exporté](docs/example-export.png)

Les éléments Notion suivants sont pris en charge :

- MathJax et formules LaTeX
- Blocs de code et code inline
- Tableaux

## Token Notion

1. Ouvrez [My integrations](https://www.notion.so/my-integrations).
2. Cliquez sur **New integration**, choisissez votre espace de travail et créez l’intégration interne.
3. Copiez l’**Internal Integration Secret**.
4. Collez le token dans l’application, ou stockez-le dans `NOTION_API_TOKEN` dans un fichier `.env`.

Ne commitez jamais le token et ne le partagez pas publiquement.
