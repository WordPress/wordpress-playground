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

---

import BlueprintStep from '@site/src/components/BlueprintsAPI/BlueprintStep';
import { BlueprintSteps } from '@site/src/components/BlueprintsAPI/model';
import UpdateTopLevelToc from '@site/src/components/UpdateTopLevelToc';

<UpdateTopLevelToc
toc={toc}
tocItems={
BlueprintSteps
.map(name => ({
value: name,
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
