---
sidebar_position: 3
slug: /blueprints/steps
description: A referência principal da API para a propriedade de etapas. Descubra todos os tipos de etapas disponíveis que você pode usar em uma Blueprint.
---

<!--
# Steps
The `steps` property of a Blueprint is an array of steps to run. For example this Blueprint logs the user in as an admin:
-->

# Etapas (steps)

<!-- A propriedade `steps` de uma Blueprint é um array de etapas a serem executadas. Por exemplo, esta Blueprint faz o login do usuário como administrador: -->

A propriedade `steps` de uma Blueprint é um array de etapas a serem executadas. Por exemplo, esta Blueprint faz o login do usuário como administrador:

<!-- Each step is an object that contains a `step` property that specifies the type of step to run. The rest of the properties depend on the type of step. Learn and try each step type below. -->

Cada etapa é um objeto que contém uma propriedade `step` que especifica o tipo de etapa a ser executada. As demais propriedades dependem do tipo de etapa. Aprenda e experimente cada tipo de etapa abaixo.

<!-- The following step-related topics are addressed on dedicated pages included in this section:

-   [Resources References](/blueprints/steps/resources) allow you use external files in Blueprints.

-   Some steps have a shorthand version. Check the [Shorthands](/blueprints/steps/shorthands) section for more information about them.

-   For each step listed below, you'll find both a "Blueprint API" and a "Function API". Refer to the [API Consistency](/blueprints/steps/api-consistency) page for further details. -->

Os seguintes tópicos relacionados a etapas são abordados em páginas dedicadas incluídas nesta seção:

- [Referências de Recursos](/blueprints/steps/resources) permitem que você use arquivos externos em Blueprints.

- Algumas etapas têm uma versão abreviada. Confira a seção [Abreviações](/blueprints/steps/shorthands) para mais informações sobre elas.

- Para cada etapa listada abaixo, você encontrará tanto uma "API de Blueprint" quanto uma "API de Função". Consulte a página [Consistência da API](/blueprints/steps/api-consistency) para mais detalhes.

<!-- :::tip
The [WordPress Playground Step Library](https://akirk.github.io/playground-step-library/#) tool provides a visual interface to drag or click the steps to create a blueprint for WordPress Playground. You can also [create your own steps](https://github.com/akirk/playground-step-library/#contributing)!
::: -->

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
