---
sidebar_position: 3
---

# Steps

The `steps` property of a Blueprint is an array of steps to run. For example this Blueprint logs the user in as an admin:

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

Each step is an object that contains a `step` property that specifies the type of step to run. The rest of the properties depend on the type of step. Learn and try each step type below.

The following step-related topics are addressed on dedicated pages included in this section:

-   [Resources References](./04-resources.md) allow you use external files in Blueprints.

-   Some steps have a shorthand version. Check the [Shorthands](./05-steps-shorthands.md) section for more information about them.

-   For each step listed below, you'll find both a "Blueprint API" and a "Function API". Refer to the [API Consistency](./07-json-api-and-function-api.md) page for further details.

:::tip
The [WordPress Playground Step Library](https://akirk.github.io/playground-step-library/#) tool provides a visual interface to drag or click the steps to create a blueprint for WordPress Playground. You can also [create your own steps](https://github.com/akirk/playground-step-library/#contributing)!
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
