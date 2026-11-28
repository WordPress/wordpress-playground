---
slug: /developers/apis/javascript-api/wordpress-abilities
---

# Capacidades de WordPress

Abre **Dev Tools → Abilities** en el sitio de Playground para buscar capacidades PHP registradas, inspeccionar sus esquemas y ejecutarlas con datos de entrada JSON. Las capacidades se agrupan por espacio de nombres, que normalmente identifica su plugin. La lista también incluye capacidades que no están expuestas mediante la API REST de WordPress.

Inicia sesión en WordPress primero. Las llamadas usan el usuario actual y conservan la validación de los datos de entrada y las comprobaciones de permisos de WordPress. La [API de capacidades](https://developer.wordpress.org/apis/abilities-api/) debe estar disponible en la instalación en ejecución; WordPress 6.9 y las versiones posteriores la incluyen.

## Usar el cliente del navegador

El `PlaygroundClient` del navegador ofrece las mismas operaciones:

```ts
const { available, user, abilities } = await client.listAbilities();
const result = await client.executeAbility('my-plugin/lookup', { id: 123 });
```

`listAbilities()` devuelve la disponibilidad de la API, el usuario actual y las descripciones de las capacidades. `executeAbility()` acepta cualquier valor JSON; omite su segundo argumento para una capacidad que no recibe datos de entrada.

Una ejecución correcta devuelve `{ success: true, data: ... }`. Un fallo de la capacidad devuelve `{ success: false, errors: [{ code, message, data }] }`. Los fallos de transporte y autenticación rechazan la promesa. La ejecución nunca se repite automáticamente: un fallo de conexión o navegación puede producirse después de que la capacidad ya haya modificado el sitio.

## Exponer capacidades a los agentes

Los interruptores **Agents** exponen capacidades individuales o un espacio de nombres completo mediante WebMCP en navegadores compatibles y mediante un [servidor MCP de Playground](/guides/ai-assistants-mcp) conectado. La ejecución manual sigue disponible sin estas conexiones.

Todos los interruptores empiezan desactivados. Las selecciones se conservan por sitio hasta que se recarga la página de Playground. Cerrar el panel mantiene disponibles las herramientas seleccionadas; al cambiar de sitio, solo se exponen las selecciones del sitio activo. Estos interruptores son independientes de las herramientas WebMCP registradas directamente por los plugins.

Las herramientas se denominan `wp_ability_<namespace>.<slug>`, con un punto en lugar del separador de espacio de nombres de WordPress. Una llamada WebMCP pasa los datos de la capacidad en una propiedad `input`, por ejemplo `{ "input": { "id": 123 } }`. Las llamadas MCP también requieren `siteId`.

Cuando varios sitios exponen el mismo nombre de capacidad con descripciones, esquemas o indicaciones de seguridad diferentes, MCP anuncia una entrada genérica sin indicaciones de seguridad compartidas. Inspecciona la capacidad en el sitio de destino antes de llamarla; WordPress sigue validando sus datos de entrada y permisos.

## Actualizar tras los cambios

Usa **Refresh** después de cambiar el código de un plugin. El panel también se actualiza tras las navegaciones y recargas de WordPress. Las integraciones del cliente pueden observar las navegaciones de documentos, incluidas las recargas de la misma URL, con `client.onNavigation(callback, { includeReloads: true })`. Por defecto, solo se notifican los cambios de URL.
