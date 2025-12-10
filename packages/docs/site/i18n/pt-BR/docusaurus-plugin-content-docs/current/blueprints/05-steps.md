---
sidebar_position: 3
slug: /blueprints/steps
description: A referência principal da API para a propriedade de etapas. Descubra todos os tipos de etapas disponíveis que você pode usar em uma Blueprint.
---

# Etapas

A propriedade `steps` de uma Blueprint é um array de etapas a serem executadas. Por exemplo, esta Blueprint faz o login do usuário como administrador:

import BlueprintExample from '@site/src/components/Blueprints/BlueprintExample.mdx';

<BlueprintExample blueprint={{
	"steps": [
		{
			"step": "login",
			"username": "admin",
			"password": "senha"
		}
	]
}} />

Cada etapa é um objeto que contém uma propriedade `step` que especifica o tipo de etapa a ser executada. As demais propriedades dependem do tipo de etapa. Aprenda e experimente cada tipo de etapa abaixo.

Os seguintes tópicos relacionados a etapas são abordados em páginas dedicadas incluídas nesta seção:

-   [Referências de Recursos](/blueprints/steps/resources) permitem que você use arquivos externos em Blueprints.

-   Algumas etapas têm uma versão abreviada. Confira a seção [Abreviações](/blueprints/steps/shorthands) para mais informações sobre elas.

-   Para cada etapa listada abaixo, você encontrará tanto uma "API de Blueprint" quanto uma "API de Função". Consulte a página [Consistência da API](/blueprints/steps/api-consistency) para mais detalhes.

:::tip
A [Biblioteca de Etapas do WordPress Playground](https://akirk.github.io/playground-step-library/#) fornece uma interface visual para arrastar ou clicar nas etapas para criar um blueprint para o WordPress Playground. Você também pode [criar suas próprias etapas](https://github.com/akirk/playground-step-library/#contributing)!
:::

---

import BlueprintStep from '@site/src/components/BlueprintsAPI/BlueprintStep';
import { BlueprintSteps, getStepAPI } from '@site/src/components/BlueprintsAPI/model';
import UpdateTopLevelToc from '@site/src/components/UpdateTopLevelToc';

<UpdateTopLevelToc
toc={toc}
tocItems={
BlueprintSteps
.map(name => ({
value: getStepAPI(name).stepId,
id: name,
level: 2
}))
} />

<span>
	{BlueprintSteps.map((name) => (
		<>
			<BlueprintStep name={name} key={name} />
			<hr/>
		</>
	))}
</span>
