---
sidebar_position: 3
slug: /blueprints/steps
description: স্টেপস প্রপার্টির প্রধান এপিআই রেফারেন্স। একটি ব্লুপ্রিন্টে আপনি যেসব স্টেপ টাইপ ব্যবহার করতে পারেন, সেগুলো সম্পর্কে জানুন।
---

<!--
# Steps
-->

# স্টেপস

<!--
The `steps` property of a Blueprint is an array of steps to run. For example this Blueprint logs the user in as an admin:
-->

একটি ব্লুপ্রিন্টের `steps` প্রপার্টি হলো চালানোর জন্য স্টেপের একটি অ্যারে। উদাহরণস্বরূপ, এই ব্লুপ্রিন্টটি ইউজারকে অ্যাডমিন হিসেবে লগ ইন করায়:

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

<!--
Each step is an object that contains a `step` property that specifies the type of step to run. The rest of the properties depend on the type of step. Learn and try each step type below.
-->

প্রতিটি স্টেপ হলো একটি অবজেক্ট যেটিতে একটি `step` প্রপার্টি থাকে যা চালানোর জন্য স্টেপের টাইপ নির্দিষ্ট করে। বাকি প্রপার্টিগুলো স্টেপের টাইপের উপর নির্ভর করে। নিচে প্রতিটি স্টেপ টাইপ শিখুন এবং ট্রাই করুন।

<!--
The following step-related topics are addressed on dedicated pages included in this section:
-->

নিম্নলিখিত স্টেপ-সম্পর্কিত বিষয়গুলো এই সেকশনে অন্তর্ভুক্ত ডেডিকেটেড পেজগুলোতে আলোচনা করা হয়েছে:

<!--
-   [Resources References](/blueprints/steps/resources) allow you use external files in Blueprints.
-->

-   [রিসোর্স রেফারেন্স](/blueprints/steps/resources) আপনাকে ব্লুপ্রিন্টে এক্সটার্নাল ফাইল ব্যবহার করতে দেয়।

<!--
-   Some steps have a shorthand version. Check the [Shorthands](/blueprints/steps/shorthands) section for more information about them.
-->

-   কিছু স্টেপের একটি শর্টহ্যান্ড সংস্করণ রয়েছে। এগুলো সম্পর্কে আরও তথ্যের জন্য [শর্টহ্যান্ডস](/blueprints/steps/shorthands) সেকশনটি দেখুন।

<!--
-   For each step listed below, you'll find both a "Blueprint API" and a "Function API". Refer to the [API Consistency](/blueprints/steps/api-consistency) page for further details.
-->

-   নিচে তালিকাভুক্ত প্রতিটি স্টেপের জন্য, আপনি একটি "Blueprint API" এবং একটি "Function API" উভয়ই পাবেন। আরও বিস্তারিত জানতে [API কনসিস্টেন্সি](/blueprints/steps/api-consistency) পেজটি দেখুন।

<!--
:::tip
The [WordPress Playground Step Library](https://akirk.github.io/playground-step-library/#) tool provides a visual interface to drag or click the steps to create a blueprint for WordPress Playground. You can also [create your own steps](https://github.com/akirk/playground-step-library/#contributing)!
:::
-->

:::পরামর্শ
[ওয়ার্ডপ্রেস প্লেগ্রাউন্ড স্টেপ লাইব্রেরি](https://akirk.github.io/playground-step-library/#) টুলটি ওয়ার্ডপ্রেস প্লেগ্রাউন্ডের জন্য একটি ব্লুপ্রিন্ট তৈরি করতে স্টেপগুলো ড্র্যাগ বা ক্লিক করার একটি ভিজ্যুয়াল ইন্টারফেস প্রদান করে। আপনি [নিজের স্টেপও তৈরি করতে পারেন](https://github.com/akirk/playground-step-library/#contributing)!
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
