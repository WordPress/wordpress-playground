---
sidebar_position: 3
slug: /blueprints/steps
---

# 手順

<!--
# Steps
-->

ブループリントの `steps` プロパティは、実行するステップの配列です。例えば、次のブループリントはユーザーを管理者としてログインさせます。

<!--
The `steps` property of a Blueprint is an array of steps to run. For example this Blueprint logs the user in as an admin:
-->

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

各ステップは、実行するステップの種類を指定する `step` プロパティを含むオブジェクトです。残りのプロパティはステップの種類によって異なります。以下の各ステップの種類について学び、試してみてください。

<!--
Each step is an object that contains a `step` property that specifies the type of step to run. The rest of the properties depend on the type of step. Learn and try each step type below.
-->

このセクションに含まれる専用ページでは、次の手順に関連するトピックが説明されています。

<!--
The following step-related topics are addressed on dedicated pages included in this section:
-->

-   [リソース参照](/blueprints/steps/resources)を使用すると、ブループリントで外部ファイルを使用できます。

-   一部のステップにはショートカットバージョンがあります。詳細については、[ショートカット](/blueprints/steps/shorthands)セクションをご覧ください。

-   以下にリストされている各ステップには、「ブループリント API」と「関数 API」の両方があります。詳細については、[API の一貫性](/blueprints/steps/api-consistency)ページを参照してください。

<!--
-   [Resources References](/blueprints/steps/resources) allow you use external files in Blueprints.

-   Some steps have a shorthand version. Check the [Shorthands](/blueprints/steps/shorthands) section for more information about them.

-   For each step listed below, you'll find both a "Blueprint API" and a "Function API". Refer to the [API Consistency](/blueprints/steps/api-consistency) page for further details.
-->

:::tip
[WordPress Playground ステップライブラリ](https://akirk.github.io/playground-step-library/#) ツールは、ステップをドラッグまたはクリックして WordPress Playground のブループリントを作成するためのビジュアルインターフェースを提供します。[独自のステップを作成](https://github.com/akirk/playground-step-library/#contributing) することも可能です!
:::

<!--
:::tip
The [WordPress Playground Step Library](https://akirk.github.io/playground-step-library/#) tool provides a visual interface to drag or click the steps to create a blueprint for WordPress Playground. You can also [create your own steps](https://github.com/akirk/playground-step-library/#contributing)!
:::
-->

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
