---
slug: /contributing/coding-standards
title: कोडिंग सिद्धांत
description: Playground के कोडिंग सिद्धांतों का ब्योरा, जिनमें मददगार एरर मैसेज, छोटा पब्लिक API और ब्लूप्रिंट पर ज़ोर है।
---

<!-- # Coding principles -->

# कोडिंग सिद्धांत

<!-- ## Error messages -->

## एरर मैसेज {#error-messages}

<!-- A good error message informs the user of the following steps to take. Any ambiguity in errors thrown by Playground [Public APIs](/developers/apis/) will prompt the developers to open issues. -->

एक अच्छा एरर मैसेज उपयोगकर्ता को बताता है कि आगे क्या करना है। Playground के [पब्लिक API](/developers/apis/) से आने वाले एरर में ज़रा भी अस्पष्टता हो, तो डेवलपर्स इश्यू खोलने लगेंगे।

<!--
Consider a network error, for example—can we infer the type of error and display a relevant message summarizing the next steps?

-   **Network error**: "Your internet connection twitched. Try to reload the page.
-   **404**: "Could not find the file".
-   **403**: "The server blocked access to the file".
-   **CORS**: clarify it's a browser security feature and add a link to a detailed explanation (on MDN or another reliable source). Suggest the user move their file somewhere else, like `raw.githubusercontent.com`, and link to a resource explaining how to set up CORS headers on their servers.
-->

उदाहरण के लिए, किसी नेटवर्क एरर को लें: क्या हम एरर का प्रकार पहचानकर उससे जुड़ा ऐसा मैसेज दिखा सकते हैं, जो संक्षेप में आगे के कदम बताए?

- **नेटवर्क एरर**: "आपका इंटरनेट कनेक्शन कुछ देर के लिए टूट गया। पेज को फिर से लोड करके देखें।"
- **404**: "फ़ाइल नहीं मिली"।
- **403**: "सर्वर ने फ़ाइल तक पहुँच रोक दी"।
- **CORS**: साफ़ बताएँ कि यह ब्राउज़र की एक सुरक्षा सुविधा है, और विस्तृत जानकारी का लिंक जोड़ें (MDN या किसी दूसरे भरोसेमंद स्रोत पर)। उपयोगकर्ता को सुझाव दें कि वे अपनी फ़ाइल किसी और जगह रखें, जैसे `raw.githubusercontent.com`, और ऐसे संसाधन का लिंक दें जिसमें बताया गया हो कि अपने सर्वर पर CORS हेडर कैसे सेट करें।

<!-- We handle code formatting and linting automatically. Relax, type away, and let the machines do the work. -->

कोड की फ़ॉर्मैटिंग और लिंटिंग हम अपने-आप करते हैं। आराम से कोड लिखें, बाकी काम मशीनों पर छोड़ दें।

<!-- ## Public API -->

## पब्लिक API {#public-api}

<!-- Playground aims to keep the narrowest possible API scope. -->

Playground की कोशिश रहती है कि उसके API का दायरा जितना हो सके उतना छोटा रहे।

<!-- Public APIs are easy to add and hard to remove. It only takes one PR to introduce a new API, but it may take a thousand to remove it, especially if other projects have already consumed it. -->

पब्लिक API जोड़ना आसान है और हटाना मुश्किल। नया API लाने में बस एक PR लगता है, लेकिन उसे हटाने में हज़ार PR लग सकते हैं, खासकर तब जब दूसरे प्रोजेक्ट उसका उपयोग करने लगे हों।

<!-- -   Don't expose unnecessary functions, classes, constants, or other components. -->

- ग़ैरज़रूरी फ़ंक्शन, क्लास, कॉन्स्टेंट या दूसरे कंपोनेंट सार्वजनिक न करें।

<!-- ## Blueprints -->

## ब्लूप्रिंट {#blueprints}

<!-- [Blueprints](/blueprints/getting-started) are the primary way to interact with Playground. These JSON files describe a set of steps that Playground executes in order. -->

[ब्लूप्रिंट](/blueprints/getting-started) Playground के साथ काम करने का मुख्य तरीका हैं। ये JSON फ़ाइलें चरणों का एक सेट बताती हैं, जिन्हें Playground क्रम से चलाता है।

<!-- ### Guidelines -->

### दिशानिर्देश {#guidelines}

<!-- Blueprint steps should be **concise and focused**. They should do one thing and do it well. -->

ब्लूप्रिंट के चरण **संक्षिप्त और केंद्रित** होने चाहिए। हर चरण एक ही काम करे और उसे अच्छी तरह करे।

<!--
-   If you need to create a new step, try refactoring an existing one first.
-   If that's not enough, ensure the new step delivers a new capability. Don't replicate the functionality of existing steps.
-   Assume the step would be called more than once.
-   Assume it would run in a specific order.
-   Add unit tests to verify that.
-->

- अगर आपको नया चरण बनाना है, तो पहले किसी मौजूदा चरण को रीफ़ैक्टर करके देखें।
- अगर उससे काम न बने, तो पक्का करें कि नया चरण कोई नई क्षमता लाए। मौजूदा चरणों की कार्यक्षमता को दोहराएँ नहीं।
- मानकर चलें कि चरण एक से ज़्यादा बार चलाया जाएगा।
- मानकर चलें कि वह एक तय क्रम में चलेगा।
- इसकी पुष्टि के लिए यूनिट टेस्ट जोड़ें।

<!-- Blueprints should be **intuitive and straightforward**. -->

ब्लूप्रिंट **सहज और सीधे-सादे** होने चाहिए।

<!--
-   Don't require arguments that can be optional.
-   Use plain argument. For example, `slug` instead of `path`.
-   Define constants in virtual JSON files—don't modify PHP files.
-   Define a TypeScript type for the Blueprint. That's how Playground generates its JSON schema.
-   Write a function to handle a Blueprint step. Accept the argument of the type you defined.
-   Provide a usage example in the doc string. It's automatically reflected in the docs.
-->

- जो आर्गुमेंट वैकल्पिक हो सकते हैं, उन्हें ज़रूरी न बनाएँ।
- सीधे-सादे आर्गुमेंट इस्तेमाल करें। उदाहरण के लिए, `path` की जगह `slug`।
- कॉन्स्टेंट वर्चुअल JSON फ़ाइलों में तय करें, PHP फ़ाइलों में बदलाव न करें।
- ब्लूप्रिंट के लिए एक TypeScript टाइप तय करें। Playground इसी टाइप से ब्लूप्रिंट का JSON स्कीमा बनाता है।
- ब्लूप्रिंट के किसी चरण को संभालने के लिए एक फ़ंक्शन लिखें। वह आपके तय किए गए टाइप का आर्गुमेंट ले।
- डॉकस्ट्रिंग में उपयोग का एक उदाहरण दें। वह अपने-आप दस्तावेज़ में दिख जाता है।
