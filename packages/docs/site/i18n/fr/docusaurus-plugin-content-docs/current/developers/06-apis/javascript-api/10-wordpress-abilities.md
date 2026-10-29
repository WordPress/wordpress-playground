---
slug: /developers/apis/javascript-api/wordpress-abilities
---

# Les aptitudes WordPress

Ouvrez **Dev Tools → Abilities** sur le site Playground pour rechercher les aptitudes PHP enregistrées, examiner leurs schémas et les exécuter avec des données JSON. Les aptitudes sont regroupées par espace de noms, qui identifie généralement leur extension. La liste inclut aussi les aptitudes qui ne sont pas exposées par l’API REST de WordPress.

Connectez-vous d’abord à WordPress. Les appels utilisent le compte actuel et conservent la validation des données et les vérifications des droits de WordPress. L’[API des aptitudes](https://developer.wordpress.org/apis/abilities-api/) doit être disponible dans l’installation en cours ; elle est incluse dans WordPress 6.9 et les versions suivantes.

## Utiliser le client du navigateur

Le `PlaygroundClient` du navigateur propose les mêmes opérations :

```ts
const { available, user, abilities } = await client.listAbilities();
const result = await client.executeAbility('my-plugin/lookup', { id: 123 });
```

`listAbilities()` renvoie la disponibilité de l’API, le compte actuel et les descriptions des aptitudes. `executeAbility()` accepte toute valeur JSON ; omettez son second argument si l’aptitude ne reçoit aucune donnée.

Une exécution réussie renvoie `{ success: true, data: ... }`. Un échec de l’aptitude renvoie `{ success: false, errors: [{ code, message, data }] }`. Les échecs de transport ou d’authentification rejettent la promesse. L’exécution n’est jamais relancée automatiquement : une erreur de connexion ou de navigation peut survenir après que l’aptitude a déjà modifié le site.

## Exposer les aptitudes aux agents

Les interrupteurs **Agents** exposent des aptitudes individuelles ou un espace de noms entier via WebMCP dans les navigateurs compatibles et via un [serveur MCP de Playground](/guides/ai-assistants-mcp) connecté. L’exécution manuelle reste disponible sans ces connexions.

Tous les interrupteurs sont désactivés au départ. Les sélections sont conservées pour chaque site jusqu’au rechargement de la page Playground. Fermer le panneau laisse les outils sélectionnés disponibles ; changer de site expose uniquement les sélections du site actif. Ces interrupteurs sont indépendants des outils WebMCP enregistrés directement par les extensions.

Les outils sont nommés `wp_ability_<namespace>.<slug>`, avec un point à la place du séparateur d’espace de noms de WordPress. Un appel WebMCP transmet les données de l’aptitude dans une propriété `input`, par exemple `{ "input": { "id": 123 } }`. Les appels MCP exigent aussi `siteId`.

Lorsque plusieurs sites exposent le même nom d’aptitude avec des descriptions, des schémas ou des indications de sécurité différents, MCP annonce une entrée générique sans indications de sécurité communes. Examinez l’aptitude sur le site cible avant de l’appeler ; WordPress continue de valider les données et les droits.

## Actualiser après les modifications

Utilisez **Refresh** après avoir modifié le code d’une extension. Le panneau s’actualise aussi après les navigations et les rechargements de WordPress. Les intégrations clientes peuvent observer les navigations de documents, y compris les rechargements de la même URL, avec `client.onNavigation(callback, { includeReloads: true })`. Par défaut, seuls les changements d’URL sont signalés.
