---
title: MCP के ज़रिए AI सहायकों के साथ WordPress Playground का उपयोग करें
slug: /guides/ai-assistants-mcp
description: जानें कि WordPress Playground MCP सर्वर का उपयोग कब करें, यह Playground CLI से कैसे अलग है, और AI सहायक के साथ ब्राउज़र में WordPress डेमो कैसे चलाएँ।
---

<!-- # Use WordPress Playground with AI assistants through MCP -->

# MCP के ज़रिए AI सहायकों के साथ WordPress Playground का उपयोग करें

<!-- The WordPress Playground MCP server lets an AI assistant connect to a real Playground site running in your browser. After the connection is open, you can ask the assistant to navigate WordPress, inspect pages, reproduce issues, and explain what it finds. -->

WordPress Playground MCP सर्वर की मदद से कोई AI सहायक आपके ब्राउज़र में चल रही असली Playground साइट से जुड़ सकता है। कनेक्शन खुलने के बाद आप सहायक से कह सकते हैं कि वह WordPress में अलग-अलग जगह जाए, पेजों की जाँच करे, समस्याओं को दोहराकर देखे और जो मिले उसे समझाए।

<!-- Use this guide to configure the MCP server and work with Playground through natural language. For background on the architecture, see [Connect AI coding agents to WordPress Playground with MCP](https://make.wordpress.org/playground/2026/03/17/connect-ai-coding-agents-to-wordpress-playground-with-mcp/). -->

MCP सर्वर कॉन्फ़िगर करने और आम बोलचाल की भाषा में Playground के साथ काम करने के लिए इस गाइड का उपयोग करें। आर्किटेक्चर की पृष्ठभूमि के लिए [MCP के साथ AI कोडिंग एजेंट को WordPress Playground से जोड़ें](https://make.wordpress.org/playground/2026/03/17/connect-ai-coding-agents-to-wordpress-playground-with-mcp/) देखें।

<!-- MCP is most useful when the site itself matters: a saved Playground, a persistent browser-backed site, a My WordPress-style site, or a demo where you want the assistant to act like a remote control for the browser. If you are working from a terminal-based coding agent and you mainly need local automation, the Playground CLI is usually simpler and less ambiguous. -->

MCP सबसे ज़्यादा तब काम आता है जब साइट खुद मायने रखती हो: सहेजा हुआ Playground, ब्राउज़र में सहेजी रहने वाली स्थायी साइट, My WordPress जैसी साइट, या ऐसा डेमो जिसमें आप चाहते हैं कि सहायक ब्राउज़र के रिमोट कंट्रोल की तरह काम करे। अगर आप टर्मिनल में चलने वाले कोडिंग एजेंट के साथ काम कर रहे हैं और आपको मुख्य रूप से लोकल ऑटोमेशन चाहिए, तो Playground CLI आमतौर पर ज़्यादा आसान और कम उलझन वाला होता है।

<!-- ## What MCP adds to Playground -->

## MCP से Playground में क्या जुड़ता है {#what-mcp-adds-to-playground}

<!-- MCP, or Model Context Protocol, gives your AI assistant control over the Playground site that is open in your browser. Instead of only describing a task, the assistant can act on the site: -->

MCP यानी Model Context Protocol आपके AI सहायक को उस Playground साइट पर नियंत्रण देता है, जो आपके ब्राउज़र में खुली है। सहायक सिर्फ़ काम के बारे में बताने के बजाय साइट पर खुद काम कर सकता है:

<!--
- Get the exact Playground URL to open in your browser
- List your available Playground sites
- Open, rename, or save a Playground site
- Open another browser-managed Playground site in a new tab
- Navigate to WordPress admin and front-end URLs
- Follow redirects and report the final URL
- Make authenticated WordPress REST API requests
- Read and write files inside the Playground filesystem
- Run PHP inside the Playground site
- Request pages and inspect the response
- List the emails the site has sent
-->

- अपने ब्राउज़र में खोलने के लिए Playground का सटीक URL पाना
- आपकी उपलब्ध Playground साइटों की सूची दिखाना
- किसी Playground साइट को खोलना, उसका नाम बदलना या उसे सहेजना
- ब्राउज़र में प्रबंधित कोई दूसरी Playground साइट नए टैब में खोलना
- WordPress एडमिन और फ़्रंट-एंड के URL पर जाना
- रीडायरेक्ट के साथ आगे बढ़ना और आखिरी URL बताना
- प्रमाणीकरण के साथ WordPress REST API अनुरोध भेजना
- Playground फ़ाइल सिस्टम के अंदर फ़ाइलें पढ़ना और लिखना
- Playground साइट के अंदर PHP चलाना
- पेजों का अनुरोध करना और जवाब की जाँच करना
- साइट से भेजे गए ईमेल की सूची दिखाना

<!-- This is especially useful when the task depends on the browser state: logged-in admin screens, settings pages, REST API requests, and redirects. -->

यह ख़ास तौर पर तब काम आता है जब काम ब्राउज़र की स्थिति पर निर्भर हो: लॉग इन किए हुए एडमिन स्क्रीन, सेटिंग्स पेज, REST API अनुरोध और रीडायरेक्ट।

<!-- ## Good use cases for MCP -->

## MCP के अच्छे उपयोग {#good-use-cases-for-mcp}

<!-- Use MCP when you want an assistant to work with a visible, browser-managed WordPress site: -->

जब आप चाहते हैं कि सहायक किसी दिखने वाली, ब्राउज़र में प्रबंधित WordPress साइट के साथ काम करे, तब MCP का उपयोग करें:

<!--
- Guide you through a settings screen: "Show me how to configure this WooCommerce option."
- Create a browser-based demo: "Build a simple recipe page and show me the result."
- Build a block theme: "Create a block theme with a custom header and front-page template, activate it, and show me the result."
- Work with a persistent site: "Use my saved Playground site" or "Use my site on My WordPress."
- Reproduce a bug: "Follow these steps and summarize the error."
- Test a redirect or URL: "Open this page and tell me where the browser ends up."
- Inspect a running site: "Find the admin screen that matches this plugin feature."
-->

- किसी सेटिंग्स स्क्रीन पर आपको रास्ता दिखाना: "मुझे दिखाएँ कि यह WooCommerce विकल्प कैसे कॉन्फ़िगर करें।"
- ब्राउज़र में चलने वाला डेमो बनाना: "एक आसान रेसिपी पेज बनाएँ और मुझे नतीजा दिखाएँ।"
- ब्लॉक थीम बनाना: "कस्टम हेडर और फ़्रंट-पेज टेम्पलेट वाली एक ब्लॉक थीम बनाएँ, उसे सक्रिय करें और मुझे नतीजा दिखाएँ।"
- स्थायी साइट के साथ काम करना: "मेरी सहेजी हुई Playground साइट का उपयोग करें" या "My WordPress पर मेरी साइट का उपयोग करें।"
- बग को दोहराकर देखना: "ये चरण पूरे करें और त्रुटि का सारांश बताएँ।"
- रीडायरेक्ट या URL परखना: "यह पेज खोलें और बताएँ कि ब्राउज़र आखिर में कहाँ पहुँचता है।"
- चल रही साइट की जाँच करना: "वह एडमिन स्क्रीन ढूँढें जो इस प्लगइन फ़ीचर से जुड़ी है।"

<!-- MCP is less useful when the job is mostly local automation, such as running the same Blueprint repeatedly, mounting a plugin from your filesystem, or testing a version matrix. Use the Playground CLI for those workflows or [write tests using `runCLI`](/guides/e2e-testing-with-playwright#first-test-file). -->

जब काम ज़्यादातर लोकल ऑटोमेशन का हो, जैसे एक ही ब्लूप्रिंट को बार-बार चलाना, अपने फ़ाइल सिस्टम से प्लगइन माउंट करना या संस्करणों के मैट्रिक्स पर परीक्षण करना, तब MCP उतना काम का नहीं है। ऐसे वर्कफ़्लो के लिए Playground CLI का उपयोग करें या [`runCLI` से परीक्षण लिखें](/guides/e2e-testing-with-playwright#first-test-file)।

<!-- ## Before you start -->

## शुरू करने से पहले {#before-you-start}

<!-- You need: -->

आपको इनकी ज़रूरत है:

<!--
- Node.js and npm installed on the same computer as your browser, with `npx` available to your AI assistant
- An AI assistant or coding agent that supports local stdio MCP servers, configured using the [setup instructions below](#set-up-the-mcp-server)
-->

- उसी कंप्यूटर पर स्थापित Node.js और npm जिस पर आपका ब्राउज़र है, और `npx` जिसे आपका AI सहायक चला सके
- ऐसा AI सहायक या कोडिंग एजेंट जो लोकल stdio MCP सर्वर का समर्थन करता हो और [नीचे दिए गए सेटअप निर्देशों](#set-up-the-mcp-server) के अनुसार कॉन्फ़िगर किया गया हो

<!-- You do not need to open Playground or create a site beforehand. During connection, your assistant provides the Playground URL to open in your browser. The default URL starts a temporary site you can use for testing. -->

आपको पहले से Playground खोलने या साइट बनाने की ज़रूरत नहीं है। कनेक्ट करते समय आपका सहायक वह Playground URL देता है, जिसे आपको अपने ब्राउज़र में खोलना है। डिफ़ॉल्ट URL एक अस्थायी साइट शुरू करता है, जिसका उपयोग आप परीक्षण के लिए कर सकते हैं।

<div class="callout callout-tip">

<!-- **Save important demos first** -->

**ज़रूरी डेमो पहले सहेजें**

<!-- If you are preparing a demo, ask your assistant to save the current Playground site to browser storage before making many changes. Saved Playgrounds can be reopened from **Your Playgrounds** in the Dock. -->

अगर आप डेमो तैयार कर रहे हैं, तो बहुत सारे बदलाव करने से पहले अपने सहायक से कहें कि वह मौजूदा Playground साइट को ब्राउज़र स्टोरेज में सहेज दे। सहेजे गए Playground, Dock में **Your Playgrounds** से फिर से खोले जा सकते हैं।

</div>

<div class="callout callout-warning">

<!-- **Confirm which site the assistant is using** -->

**पक्का करें कि सहायक कौन-सी साइट उपयोग कर रहा है**

<!-- You can have multiple Playground sites and multiple connected browser tabs. You can also connect more than one server or browser automation tool to the same assistant. That flexibility is useful, but it can get confusing. Before making changes, ask the assistant to list the connected sites and confirm the active site name. -->

आपके पास कई Playground साइटें और कई जुड़े हुए ब्राउज़र टैब हो सकते हैं। आप एक ही सहायक से एक से ज़्यादा सर्वर या ब्राउज़र ऑटोमेशन टूल भी जोड़ सकते हैं। यह सुविधा काम की है, लेकिन इससे उलझन हो सकती है। बदलाव करने से पहले सहायक से जुड़ी हुई साइटों की सूची माँगें और सक्रिय साइट का नाम पक्का करें।

</div>

<!-- ## Set up the MCP server -->

## MCP सर्वर सेट अप करें {#set-up-the-mcp-server}

<!-- Choose the configuration for your AI assistant. The assistant starts `@wp-playground/mcp` as a local process and communicates with it over stdio. -->

अपने AI सहायक के लिए कॉन्फ़िगरेशन चुनें। सहायक `@wp-playground/mcp` को एक लोकल प्रोसेस के रूप में शुरू करता है और stdio के ज़रिए उससे संवाद करता है।

<!-- By default, the MCP server works with the Playground website at `playground.wordpress.net` and does not connect to My WordPress. To use a My WordPress site, add `--url=https://my.wordpress.net/` after `@wp-playground/mcp`, in the command or in the `args` list. -->

डिफ़ॉल्ट रूप से MCP सर्वर `playground.wordpress.net` पर Playground वेबसाइट के साथ काम करता है और My WordPress से नहीं जुड़ता। My WordPress साइट का उपयोग करने के लिए, कमांड में या `args` सूची में `@wp-playground/mcp` के बाद `--url=https://my.wordpress.net/` जोड़ें।

<!-- ### Claude Code -->

### Claude Code {#claude-code}

<!-- Run this command in your terminal: -->

अपने टर्मिनल में यह कमांड चलाएँ:

```bash
claude mcp add --transport stdio --scope user wordpress-playground -- npx -y @wp-playground/mcp
```

<!-- Use `--scope user` to make the server available across your projects, or `--scope local` for the current project only. -->

सर्वर को अपने सभी प्रोजेक्ट में उपलब्ध कराने के लिए `--scope user` का उपयोग करें, या सिर्फ़ मौजूदा प्रोजेक्ट के लिए `--scope local` का।

<!-- ### Codex -->

### Codex {#codex}

<!-- Run this command in your terminal: -->

अपने टर्मिनल में यह कमांड चलाएँ:

```bash
codex mcp add wordpress-playground -- npx -y @wp-playground/mcp
```

<!-- ### JSON configuration -->

### JSON कॉन्फ़िगरेशन {#json-configuration}

<!-- For Claude Code, add the following to `.mcp.json` in your project. For Claude Desktop, add it to `claude_desktop_config.json`. If the file already has an `mcpServers` object, add the `wordpress-playground` entry to it. -->

Claude Code के लिए, अपने प्रोजेक्ट की `.mcp.json` फ़ाइल में नीचे दिया गया कोड जोड़ें। Claude Desktop के लिए, इसे `claude_desktop_config.json` में जोड़ें। अगर फ़ाइल में पहले से `mcpServers` ऑब्जेक्ट है, तो उसी में `wordpress-playground` एंट्री जोड़ें।

```json
{
	"mcpServers": {
		"wordpress-playground": {
			"command": "npx",
			"args": ["-y", "@wp-playground/mcp"]
		}
	}
}
```

<!-- After saving the configuration, restart your assistant if needed to load the server, then follow the connection steps below. You do not need to start the MCP server separately. -->

कॉन्फ़िगरेशन सहेजने के बाद, सर्वर लोड करने के लिए ज़रूरत हो तो अपने सहायक को रीस्टार्ट करें, फिर नीचे दिए गए कनेक्शन के चरण पूरे करें। MCP सर्वर को अलग से शुरू करने की ज़रूरत नहीं है।

<!-- ## Connect an AI assistant to the Playground MCP -->

## AI सहायक को Playground MCP से जोड़ें {#connect-an-ai-assistant-to-the-playground-mcp}

<!-- 1. Open your AI assistant. -->

1. अपना AI सहायक खोलें।

<!-- 2. Ask it to connect to WordPress Playground: -->

2. उससे WordPress Playground से जुड़ने के लिए कहें:

    ```text
    Open WordPress Playground and connect it to the MCP server.
    ```

<!-- 3. The assistant should provide or open a Playground URL that includes an `mcp-port` parameter. -->

3. सहायक को ऐसा Playground URL देना या खोलना चाहिए, जिसमें `mcp-port` पैरामीटर हो।

<!-- 4. Open that URL in your browser if the assistant does not open it automatically. -->

4. अगर सहायक वह URL अपने-आप नहीं खोलता, तो उसे अपने ब्राउज़र में खोलें।

<!-- 5. Ask the assistant to list the available Playground sites: -->

5. सहायक से उपलब्ध Playground साइटों की सूची दिखाने के लिए कहें:

    ```text
    List my available Playground sites and tell me which one is active.
    ```

<!-- 6. Choose the Playground site you want to use: -->

6. वह Playground साइट चुनें, जिसका आप उपयोग करना चाहते हैं:

    ```text
    Use my saved WooCommerce demo site and open the WordPress admin dashboard.
    ```

<!-- If the assistant says no browser tab is connected, open the MCP Playground URL it provides and try again. -->

अगर सहायक कहता है कि कोई ब्राउज़र टैब जुड़ा नहीं है, तो उसका दिया हुआ MCP Playground URL खोलें और फिर से कोशिश करें।

<!-- ## MCP vs CLI -->

## MCP बनाम CLI {#mcp-vs-cli}

<!-- WordPress Playground has two complementary products: the Playground website and the Playground CLI. The website is the browser experience at [playground.wordpress.net](https://playground.wordpress.net/). The CLI is the local environment for development, scripting, and CI workflows. -->

WordPress Playground के दो पूरक प्रोडक्ट हैं: Playground वेबसाइट और Playground CLI। वेबसाइट [playground.wordpress.net](https://playground.wordpress.net/) पर ब्राउज़र में मिलने वाला अनुभव है। CLI डेवलपमेंट, स्क्रिप्टिंग और CI वर्कफ़्लो के लिए लोकल एनवायरनमेंट है।

<!-- The choice depends on what you want the AI assistant to control. -->

इनमें से क्या चुनें, यह इस पर निर्भर करता है कि आप AI सहायक से किस चीज़ को नियंत्रित करवाना चाहते हैं।

<!-- With MCP, the assistant can make authenticated WordPress REST API requests to the connected site without manually configuring authentication. It can also use the `playground_navigate` tool to change the page displayed in the browser and report the final URL after redirects. -->

MCP के साथ सहायक, प्रमाणीकरण को मैन्युअल रूप से कॉन्फ़िगर किए बिना, जुड़ी हुई साइट पर प्रमाणीकरण के साथ WordPress REST API अनुरोध भेज सकता है। वह ब्राउज़र में दिख रहा पेज बदलने और रीडायरेक्ट के बाद आखिरी URL बताने के लिए `playground_navigate` टूल का उपयोग भी कर सकता है।

<!-- From the CLI, comparable HTTP requests usually require a tool such as `curl` and are unauthenticated unless you configure authentication yourself. The CLI also does not control the page displayed in a user's browser. -->

CLI से ऐसे ही HTTP अनुरोधों के लिए आमतौर पर `curl` जैसे टूल की ज़रूरत होती है, और जब तक आप खुद प्रमाणीकरण कॉन्फ़िगर न करें, ये अनुरोध बिना प्रमाणीकरण के होते हैं। CLI उपयोगकर्ता के ब्राउज़र में दिख रहे पेज को नियंत्रित भी नहीं करता।
