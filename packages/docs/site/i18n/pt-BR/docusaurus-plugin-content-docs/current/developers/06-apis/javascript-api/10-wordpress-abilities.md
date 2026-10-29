---
slug: /developers/apis/javascript-api/wordpress-abilities
---

# Habilidades do WordPress

Abra **Dev Tools → Abilities** no site do Playground para pesquisar habilidades PHP registradas, inspecionar seus esquemas e executá-las com dados de entrada em JSON. As habilidades são agrupadas por namespace, que geralmente identifica o plugin. A lista também inclui habilidades que não estão expostas pela API REST do WordPress.

Entre no WordPress primeiro. As chamadas usam o usuário atual e mantêm a validação dos dados de entrada e as verificações de permissão do WordPress. A [API de habilidades](https://developer.wordpress.org/apis/abilities-api/) precisa estar disponível na instalação em execução; o WordPress 6.9 e versões posteriores já a incluem.

## Usar o cliente no navegador

O `PlaygroundClient` do navegador oferece as mesmas operações:

```ts
const { available, user, abilities } = await client.listAbilities();
const result = await client.executeAbility('my-plugin/lookup', { id: 123 });
```

`listAbilities()` retorna a disponibilidade da API, o usuário atual e as descrições das habilidades. `executeAbility()` aceita qualquer valor JSON; omita o segundo argumento para uma habilidade que não recebe dados de entrada.

Uma execução bem-sucedida retorna `{ success: true, data: ... }`. Uma falha na habilidade retorna `{ success: false, errors: [{ code, message, data }] }`. Falhas de transporte e autenticação rejeitam a promessa. A execução nunca é repetida automaticamente: uma falha de conexão ou navegação pode ocorrer depois que a habilidade já alterou o site.

## Expor habilidades para agentes

Os controles **Agents** expõem habilidades individuais ou um namespace inteiro pelo WebMCP nos navegadores compatíveis e por um [servidor MCP do Playground](/guides/ai-assistants-mcp) conectado. A execução manual continua disponível sem essas conexões.

Todos os controles começam desativados. As seleções são mantidas por site até que a página do Playground seja recarregada. Fechar o painel mantém as ferramentas selecionadas disponíveis; ao trocar de site, apenas as seleções do site ativo ficam expostas. Esses controles são independentes das ferramentas WebMCP registradas diretamente por plugins.

As ferramentas recebem o nome `wp_ability_<namespace>.<slug>`, com um ponto no lugar do separador de namespace do WordPress. Uma chamada WebMCP passa os dados da habilidade na propriedade `input`, por exemplo `{ "input": { "id": 123 } }`. As chamadas MCP também exigem `siteId`.

Quando vários sites expõem o mesmo nome de habilidade com descrições, esquemas ou indicações de segurança diferentes, o MCP informa uma entrada genérica, sem indicações de segurança compartilhadas. Inspecione a habilidade no site de destino antes de chamá-la; o WordPress continua validando os dados de entrada e as permissões.

## Atualizar após alterações

Use **Refresh** após alterar o código de um plugin. O painel também é atualizado após navegações e recarregamentos do WordPress. As integrações com o cliente podem observar navegações de documentos, incluindo recarregamentos da mesma URL, com `client.onNavigation(callback, { includeReloads: true })`. Por padrão, apenas as alterações de URL são informadas.
