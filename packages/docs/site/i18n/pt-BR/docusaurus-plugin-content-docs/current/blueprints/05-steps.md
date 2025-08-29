---
sidebar_position: 3
slug: /blueprints/steps
description: A principal referência da API para a propriedade steps. Descubra todos os tipos de passos disponíveis que você pode usar em um Blueprint.
---

<!-- # Steps -->

# Passos

<!-- The `steps` property of a Blueprint is an array of steps to run. For example this Blueprint logs the user in as an admin: -->

A propriedade `steps` de um Blueprint é um array de passos para executar. Por exemplo, este Blueprint faz login do usuário como administrador:

import BlueprintExample from '@site/src/components/Blueprints/BlueprintExample.mdx';

<BlueprintExample blueprint={{
	"steps": [
		{
			"step": "login",
			"username": "admin",
			"password": "password"
		}
	]
}} />

<!-- Each step is an object that contains a `step` property that specifies the type of step to run. The rest of the properties depend on the type of step. Learn and try each step type below. -->

Cada passo é um objeto que contém uma propriedade `step` que especifica o tipo de passo a executar. O resto das propriedades depende do tipo de passo. Aprenda e experimente cada tipo de passo abaixo.

<!-- The following step-related topics are addressed on dedicated pages included in this section: -->

Os seguintes tópicos relacionados a passos são abordados em páginas dedicadas incluídas nesta seção:

<!-- -   [Resources References](/blueprints/steps/resources) allow you use external files in Blueprints. -->

<!-- -   Some steps have a shorthand version. Check the [Shorthands](/blueprints/steps/shorthands) section for more information about them. -->

<!-- -   For each step listed below, you'll find both a "Blueprint API" and a "Function API". Refer to the [API Consistency](/blueprints/steps/api-consistency) page for further details. -->

-   [Referências de Recursos](/blueprints/steps/resources) permitem que você use arquivos externos em Blueprints.

-   Alguns passos têm uma versão abreviada. Verifique a seção [Abreviações](/blueprints/steps/shorthands) para mais informações sobre eles.

-   Para cada passo listado abaixo, você encontrará tanto uma "API Blueprint" quanto uma "API Function". Consulte a página [Consistência da API](/blueprints/steps/api-consistency) para mais detalhes.

<!-- :::tip -->
<!-- The [WordPress Playground Step Library](https://akirk.github.io/playground-step-library/#) tool provides a visual interface to drag or click the steps to create a blueprint for WordPress Playground. You can also [create your own steps](https://github.com/akirk/playground-step-library/#contributing)! -->
<!-- ::: -->

:::tip
A ferramenta [Biblioteca de Passos do WordPress Playground](https://akirk.github.io/playground-step-library/#) fornece uma interface visual para arrastar ou clicar nos passos para criar um blueprint para WordPress Playground. Você também pode [criar seus próprios passos](https://github.com/akirk/playground-step-library/#contributing)!
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
