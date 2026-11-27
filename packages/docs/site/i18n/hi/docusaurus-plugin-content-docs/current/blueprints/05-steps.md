---
sidebar_position: 3
slug: /blueprints/steps
description: steps प्रॉपर्टी का मुख्य API रेफ़रेंस। ब्लूप्रिंट में इस्तेमाल किए जा सकने वाले सभी तरह के स्टेप के बारे में जानें।
---

<!-- # Steps -->

# स्टेप

<!-- The `steps` property of a Blueprint is an array of steps to run. For example this Blueprint logs the user in as an admin: -->

ब्लूप्रिंट की `steps` प्रॉपर्टी चलाए जाने वाले स्टेप का एक ऐरे है। उदाहरण के लिए, यह ब्लूप्रिंट उपयोगकर्ता को एडमिन के रूप में लॉग इन करता है:

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

हर स्टेप एक ऑब्जेक्ट है, जिसमें एक `step` प्रॉपर्टी होती है। यह प्रॉपर्टी बताती है कि कौन सा स्टेप चलाना है। बाकी प्रॉपर्टी स्टेप के प्रकार पर निर्भर करती हैं। नीचे हर तरह के स्टेप के बारे में जानें और उन्हें आज़माएँ।

<!-- The following step-related topics are addressed on dedicated pages included in this section: -->

स्टेप से जुड़े ये विषय इस सेक्शन के अलग पेजों पर समझाए गए हैं:

<!--
- [Resources References](/blueprints/steps/resources) allow you to use external files in Blueprints.

- Some steps have a shorthand version. Check the [Shorthands](/blueprints/steps/shorthands) section for more information about them.

- For each step listed below, you'll find both a "Blueprint API" and a "Function API". Refer to the [API Consistency](/blueprints/steps/api-consistency) page for further details.
-->

- [रिसोर्स रेफ़रेंस](/blueprints/steps/resources) की मदद से आप ब्लूप्रिंट में बाहरी फ़ाइलें इस्तेमाल कर सकते हैं।

- कुछ स्टेप का एक छोटा रूप (शॉर्टहैंड) भी होता है। इनके बारे में ज़्यादा जानकारी के लिए [शॉर्टहैंड](/blueprints/steps/shorthands) सेक्शन देखें।

- नीचे दिए गए हर स्टेप के लिए आपको "Blueprint API" और "Function API", दोनों मिलेंगे। ज़्यादा जानकारी के लिए [API में एकरूपता](/blueprints/steps/api-consistency) पेज देखें।

<div class="callout callout-tip">

<!-- The [WordPress Playground Step Library](https://akirk.github.io/playground-step-library/#) tool provides a visual interface to drag or click the steps to create a blueprint for WordPress Playground. You can also [create your own steps](https://github.com/akirk/playground-step-library/#contributing)! -->

[WordPress Playground Step Library](https://akirk.github.io/playground-step-library/#) टूल एक विज़ुअल इंटरफ़ेस देता है, जिसमें आप स्टेप को ड्रैग करके या उन पर क्लिक करके WordPress Playground के लिए ब्लूप्रिंट बना सकते हैं। आप [अपने खुद के स्टेप भी बना सकते हैं](https://github.com/akirk/playground-step-library/#contributing)!

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
