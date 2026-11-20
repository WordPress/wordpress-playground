---
sidebar_position: 3
slug: /blueprints/steps
description: steps প্রপার্টির জন্য প্রধান API রেফারেন্স। একটি ব্লুপ্রিন্টে আপনি ব্যবহার করতে পারেন এমন সমস্ত উপলব্ধ স্টেপ টাইপ আবিষ্কার করুন।
---

# স্টেপ

একটি ব্লুপ্রিন্টের `steps` প্রপার্টি চালানোর জন্য স্টেপের একটি অ্যারে। উদাহরণস্বরূপ এই ব্লুপ্রিন্ট ব্যবহারকারীকে অ্যাডমিন হিসাবে লগইন করে:

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

প্রতিটি স্টেপ একটি অবজেক্ট যাতে একটি `step` প্রপার্টি থাকে যা চালানোর জন্য স্টেপের টাইপ নির্দিষ্ট করে। বাকি প্রপার্টিগুলি স্টেপের টাইপের উপর নির্ভর করে। নিচে প্রতিটি স্টেপ টাইপ শিখুন এবং চেষ্টা করুন।

নিম্নলিখিত স্টেপ-সম্পর্কিত বিষয়গুলি এই বিভাগে অন্তর্ভুক্ত ডেডিকেটেড পৃষ্ঠাগুলিতে সম্বোধন করা হয়েছে:

- [রিসোর্স রেফারেন্স](/blueprints/steps/resources) আপনাকে ব্লুপ্রিন্টে এক্সটার্নাল ফাইল ব্যবহার করতে দেয়।

-   কিছু স্টেপের একটি শর্টহ্যান্ড সংস্করণ রয়েছে। তাদের সম্পর্কে আরও তথ্যের জন্য [Shorthands](/blueprints/steps/shorthands) বিভাগ দেখুন।

- কিছু স্টেপের একটি শর্টহ্যান্ড সংস্করণ রয়েছে। এগুলো সম্পর্কে আরও তথ্যের জন্য [শর্টহ্যান্ডস](/blueprints/steps/shorthands) সেকশনটি দেখুন।

<!--
-   For each step listed below, you'll find both a "Blueprint API" and a "Function API". Refer to the [API Consistency](/blueprints/steps/api-consistency) page for further details.
-->

- নিচে তালিকাভুক্ত প্রতিটি স্টেপের জন্য, আপনি একটি "Blueprint API" এবং একটি "Function API" উভয়ই পাবেন। আরও বিস্তারিত জানতে [API কনসিস্টেন্সি](/blueprints/steps/api-consistency) পেজটি দেখুন।

<!--
<div class="callout callout-tip">

The [WordPress Playground Step Library](https://akirk.github.io/playground-step-library/#) tool provides a visual interface to drag or click the steps to create a blueprint for WordPress Playground. You can also [create your own steps](https://github.com/akirk/playground-step-library/#contributing)!

</div>
-->

<div class="callout callout-tip">

[ওয়ার্ডপ্রেস প্লেগ্রাউন্ড স্টেপ লাইব্রেরি](https://akirk.github.io/playground-step-library/#) টুলটি ওয়ার্ডপ্রেস প্লেগ্রাউন্ডের জন্য একটি ব্লুপ্রিন্ট তৈরি করতে স্টেপগুলো ড্র্যাগ বা ক্লিক করার একটি ভিজ্যুয়াল ইন্টারফেস প্রদান করে। আপনি [নিজের স্টেপও তৈরি করতে পারেন](https://github.com/akirk/playground-step-library/#contributing)!

</div>

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
