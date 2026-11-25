---
title: WordPress Playground एजेंट स्किल का उपयोग
slug: /guides/agent-skill-wp-playground
description: अपने कोडिंग एजेंट से WordPress Playground के वर्कफ़्लो ऑटोमेट करने के लिए wp-playground एजेंट स्किल स्थापित करें और उसका उपयोग करें।
---

<!-- # Using the WordPress Playground Agent Skill -->

# WordPress Playground एजेंट स्किल का उपयोग

<!-- Want an AI assistant that already knows how to spin up WordPress instances, run Blueprints, and debug plugins? The **wp-playground** agent skill teaches coding agents the WordPress Playground CLI and browser workflows. You describe what you need in plain language. The agent handles the commands. -->

क्या आप ऐसा AI सहायक चाहते हैं जो पहले से जानता हो कि WordPress इंस्टेंस कैसे शुरू करें, Blueprint कैसे चलाएँ और प्लगइन डीबग कैसे करें? **wp-playground** एजेंट स्किल कोडिंग एजेंट को WordPress Playground CLI और ब्राउज़र के वर्कफ़्लो सिखाती है। आप आसान भाषा में बताते हैं कि आपको क्या चाहिए। कमांड एजेंट संभालता है।

<!-- Your coding agent reads the skill reference — a document with CLI flags, procedures, and troubleshooting steps — before responding. This ensures Playground commands run correctly. -->

जवाब देने से पहले आपका कोडिंग एजेंट स्किल का संदर्भ पढ़ता है। यह एक दस्तावेज़ है, जिसमें CLI फ़्लैग, प्रक्रियाएँ और समस्याएँ सुलझाने के चरण हैं। इससे पक्का होता है कि Playground की कमांड सही ढंग से चलें।

<!-- ## Prerequisites -->

## ज़रूरी चीज़ें {#prerequisites}

<!-- Before installing the skill, confirm you have: -->

स्किल स्थापित करने से पहले पक्का करें कि आपके पास ये हैं:

<!--
| Requirement | Minimum version       | Check command   |
| ----------- | --------------------- | --------------- |
| Node.js     | 22.20                 | `node -v`       |
| npm / npx   | Included with Node.js | `npx --version` |
-->

| ज़रूरत    | न्यूनतम संस्करण      | जाँचने की कमांड |
| --------- | -------------------- | --------------- |
| Node.js   | 22.20                | `node -v`       |
| npm / npx | Node.js के साथ शामिल | `npx --version` |

<!-- The `npx skills` CLI needs Node.js 22.20 or later. The Playground CLI itself runs on Node.js 20.18 or later. -->

Node.js 22.20 या उसके बाद का संस्करण `npx skills` CLI के लिए ज़रूरी है। Playground CLI खुद Node.js 20.18 या उसके बाद के संस्करण पर चलता है।

<!-- You also need a coding agent that supports agent skills: Antigravity, Claude Code, Codex, Copilot, Cursor, or Gemini CLI. Make sure your CLI or IDE runs the latest version. Output quality depends on your chosen model. -->

आपको एक ऐसा कोडिंग एजेंट भी चाहिए जो एजेंट स्किल का समर्थन करता हो: Antigravity, Claude Code, Codex, Copilot, Cursor या Gemini CLI। पक्का करें कि आपका CLI या IDE नवीनतम संस्करण पर चल रहा हो। आउटपुट की गुणवत्ता आपके चुने हुए मॉडल पर निर्भर करती है।

<!-- ## Installation -->

## स्थापना {#installation}

<!-- ### 1. Install via terminal -->

### 1. टर्मिनल से स्थापित करें {#1-install-via-terminal}

<!-- Install the skill using the `npx skills` CLI. Add the `blueprint` skill too: the wp-playground skill hands Blueprint authoring to it. -->

स्किल को `npx skills` CLI से स्थापित करें। साथ में `blueprint` स्किल भी जोड़ें: wp-playground स्किल Blueprint लिखने का काम उसी को सौंपती है।

```bash
npx skills add wordpress/agent-skills --skill wp-playground blueprint
```

<!-- The CLI asks which coding agents to install to, and whether to install in the project or globally. In a project install, Claude Code skills go into `.claude/skills/`. Codex, Cursor, GitHub Copilot, Gemini CLI, and Antigravity share `.agents/skills/`. -->

CLI पूछता है कि किन कोडिंग एजेंट के लिए स्थापित करना है, और प्रोजेक्ट में स्थापित करना है या ग्लोबल रूप से। प्रोजेक्ट में स्थापित करने पर Claude Code की स्किल `.claude/skills/` में जाती हैं। Codex, Cursor, GitHub Copilot, Gemini CLI और Antigravity एक ही `.agents/skills/` डायरेक्टरी का उपयोग करते हैं।

<!-- ### 2. Install manually -->

### 2. मैन्युअल रूप से स्थापित करें {#2-install-manually}

<!-- Without `--skills`, the install command installs all skills. It replaces each matching skill folder, so back up any local changes in those folders first. To install only `wp-playground` and `blueprint`, add `--skills=wp-playground,blueprint` to the install command. -->

स्थापित करने वाली कमांड `--skills` के बिना सभी स्किल स्थापित करती है। यह मेल खाने वाले हर स्किल फ़ोल्डर को बदल देती है, इसलिए पहले उन फ़ोल्डरों में किए गए अपने लोकल बदलावों का बैकअप ले लें। सिर्फ़ `wp-playground` और `blueprint` स्थापित करने के लिए, स्थापित करने वाली कमांड में `--skills=wp-playground,blueprint` जोड़ें।

```bash
# Clone agent-skills
git clone https://github.com/WordPress/agent-skills.git
cd agent-skills

# Build the distribution
node shared/scripts/skillpack-build.mjs --clean --targets=codex,vscode,claude,cursor,antigravity

# Install into your WordPress project
node shared/scripts/skillpack-install.mjs --dest=../your-wp-project --targets=codex,vscode,claude,cursor,antigravity

# Go to your WordPress project
cd ../your-wp-project
```

<!-- This copies all skills, including `blueprint`, into: -->

इससे `blueprint` सहित सभी स्किल इन डायरेक्टरी में कॉपी हो जाती हैं:

<!--
- `.github/skills/` for VS Code / GitHub Copilot
- `.claude/skills/` for Claude Code
- `.cursor/skills/` for Cursor
- `.agents/skills/` for Antigravity and Gemini CLI
- `.codex/skills/` for Codex
-->

- VS Code / GitHub Copilot के लिए `.github/skills/`
- Claude Code के लिए `.claude/skills/`
- Cursor के लिए `.cursor/skills/`
- Antigravity और Gemini CLI के लिए `.agents/skills/`
- Codex के लिए `.codex/skills/`

<!-- After a manual install, verify that the skill directory exists for your agent: -->

मैन्युअल रूप से स्थापित करने के बाद जाँच लें कि आपके एजेंट के लिए स्किल डायरेक्टरी मौजूद है:

<!--
| Agent          | Skill directory                 |
| -------------- | ------------------------------- |
| Claude Code    | `.claude/skills/wp-playground/` |
| Gemini CLI     | `.agents/skills/wp-playground/` |
| GitHub Copilot | `.github/skills/wp-playground/` |
| Cursor         | `.cursor/skills/wp-playground/` |
| Antigravity    | `.agents/skills/wp-playground/` |
| Codex          | `.codex/skills/wp-playground/`  |
-->

| एजेंट          | स्किल डायरेक्टरी                |
| -------------- | ------------------------------- |
| Claude Code    | `.claude/skills/wp-playground/` |
| Gemini CLI     | `.agents/skills/wp-playground/` |
| GitHub Copilot | `.github/skills/wp-playground/` |
| Cursor         | `.cursor/skills/wp-playground/` |
| Antigravity    | `.agents/skills/wp-playground/` |
| Codex          | `.codex/skills/wp-playground/`  |

<!-- After a project install with `npx skills`, check `.claude/skills/wp-playground/` for Claude Code and `.agents/skills/wp-playground/` for the other agents. A global install puts skills in your home directory instead. Run `npx skills list`, or `npx skills ls -g` for a global install, to see what is installed. -->

प्रोजेक्ट में `npx skills` से स्थापित करने के बाद, Claude Code के लिए `.claude/skills/wp-playground/` और बाकी एजेंट के लिए `.agents/skills/wp-playground/` जाँचें। ग्लोबल रूप से स्थापित करने पर स्किल इसके बजाय आपकी होम डायरेक्टरी में जाती हैं। क्या स्थापित है, यह देखने के लिए `npx skills list` चलाएँ, या ग्लोबल स्थापना के लिए `npx skills ls -g` चलाएँ।

<!-- Some agents also support listing skills directly: -->

कुछ एजेंट सीधे स्किल की सूची दिखाने की सुविधा भी देते हैं:

```bash
# Claude Code
claude /skills

# Gemini CLI
gemini /skills list
```

<!-- ## Use the skill in the terminal -->

## टर्मिनल में स्किल का उपयोग करें {#use-the-skill-in-the-terminal}

<!-- With the skill installed, describe your WordPress environment to your coding agent. The agent builds the Blueprint, runs the CLI commands, and starts the server. -->

स्किल स्थापित होने के बाद, अपने कोडिंग एजेंट को बताएँ कि आपको कैसा WordPress एनवायरनमेंट चाहिए। एजेंट Blueprint बनाता है, CLI कमांड चलाता है और सर्वर शुरू करता है।

<!-- Open your coding agent in the terminal and type your request: -->

टर्मिनल में अपना कोडिंग एजेंट खोलें और अपना अनुरोध टाइप करें:

```
> Run a WordPress instance with my plugin mounted
```

<!-- The agent reads the skill reference, detects your project layout, and runs `server --auto-mount`. The instance starts at `http://localhost:9400`. -->

एजेंट स्किल का संदर्भ पढ़ता है, आपके प्रोजेक्ट का ढाँचा पहचानता है और `server --auto-mount` चलाता है। इंस्टेंस `http://localhost:9400` पर शुरू होता है।

<!-- ### Generating content on the fly -->

### तुरंत सामग्री बनाना {#generating-content-on-the-fly}

<!-- Need sample data for testing or a demo? Describe the content structure you want: -->

परीक्षण या डेमो के लिए नमूना डेटा चाहिए? आपको जैसी सामग्री चाहिए, उसकी संरचना बताएँ:

```
> Run a WordPress with 10 published posts
```

<!-- The agent creates a Blueprint with a `runPHP` step that generates the posts using `wp_insert_post()`. -->

एजेंट एक Blueprint बनाता है, जिसमें एक `runPHP` चरण होता है। यह चरण `wp_insert_post()` का उपयोग करके पोस्ट बनाता है।

<!-- More examples: -->

कुछ और उदाहरण:

```
> Run a WordPress with 3 users where each user has 3 posts
```

```
> Start a WordPress instance with 5 pages and a custom menu linking to all of them
```

```
> Create a WordPress site with 20 posts across 4 categories
```

<!-- Each prompt produces a complete Blueprint that runs locally, handling user creation, role assignment, post generation, and taxonomy setup through Blueprint steps. -->

हर प्रॉम्प्ट से एक पूरा Blueprint बनता है, जो लोकल रूप से चलता है। यह Blueprint चरणों के ज़रिए उपयोगकर्ता बनाना, भूमिकाएँ देना, पोस्ट बनाना और टैक्सोनॉमी सेटअप करना संभालता है।

<!-- ### Version compatibility testing -->

### संस्करण संगतता परीक्षण {#version-compatibility-testing}

<!-- Does your plugin work on older PHP versions? Ask directly: -->

क्या आपका प्लगइन PHP के पुराने संस्करणों पर काम करता है? सीधे पूछें:

```
> Test my plugin on WordPress 6.3 with PHP 7.4
```

```
> Run my theme on the latest WordPress nightly with PHP 8.5
```

<!-- The agent adds `--wp` and `--php` flags to match your request. Common combinations: -->

आपके अनुरोध के हिसाब से एजेंट `--wp` और `--php` फ़्लैग जोड़ता है। आम संयोजन:

<!--
| Scenario          | What to ask                                                 |
| ----------------- | ----------------------------------------------------------- |
| Latest stable     | "Run a WordPress instance" (defaults to latest WP, PHP 8.3) |
| Minimum supported | "Test my plugin on WordPress 6.3 with PHP 7.4"              |
| Upcoming release  | "Run the WordPress nightly build"                           |
| Legacy PHP        | "Start WordPress with PHP 7.4"                              |
-->

| स्थिति                  | क्या पूछें                                                      |
| ----------------------- | --------------------------------------------------------------- |
| नवीनतम स्थिर संस्करण    | "Run a WordPress instance" (डिफ़ॉल्ट रूप से नवीनतम WP, PHP 8.3) |
| न्यूनतम समर्थित संस्करण | "Test my plugin on WordPress 6.3 with PHP 7.4"                  |
| आने वाली रिलीज़         | "Run the WordPress nightly build"                               |
| पुराना PHP              | "Start WordPress with PHP 7.4"                                  |

<!-- ### Complex scenarios -->

### जटिल स्थितियाँ {#complex-scenarios}

<!-- Combine multiple requirements in a single prompt: -->

एक ही प्रॉम्प्ट में कई ज़रूरतें एक साथ बताएँ:

```
> Create a WordPress site with WooCommerce, 3 product categories,
  10 sample products, and 2 customer accounts — running on PHP 8.2
```

```
> Run a WordPress instance with my plugin mounted, debug mode enabled,
  and 5 test posts that include featured images
```

<!-- The agent breaks these into the right sequence of Blueprint steps and CLI flags. Each request produces a fully configured, running instance. -->

एजेंट इन्हें Blueprint चरणों और CLI फ़्लैग के सही क्रम में बाँट देता है। हर अनुरोध से एक पूरी तरह कॉन्फ़िगर किया हुआ, चलता हुआ इंस्टेंस मिलता है।

<!-- ## How the skill works -->

## स्किल कैसे काम करती है {#how-the-skill-works}

<!-- The wp-playground skill is a set of Markdown files that your coding agent loads into its context when your request matches Playground-related patterns. The skill includes: -->

यह wp-playground स्किल Markdown फ़ाइलों का एक सेट है। जब आपका अनुरोध Playground से जुड़े पैटर्न से मेल खाता है, तब आपका कोडिंग एजेंट इन फ़ाइलों को अपने कॉन्टेक्स्ट में लोड करता है। स्किल में ये फ़ाइलें शामिल हैं:

<!--
- **SKILL.md** — The routing procedure: it identifies the workflow you need and loads only the matching reference, plus guardrails, verification checks, and failure modes.
- **references/cli.md** — Local runs with `@wp-playground/cli`: server, mounts, Blueprint execution, snapshots, and version switching.
- **references/debugging.md** — Xdebug setup, path mapping, logs, and stuck CLI runs.
- **references/website.md** — Browser-only workflows on playground.wordpress.net, such as Blueprint URLs and share links.
-->

- **SKILL.md**: रूटिंग की प्रक्रिया। यह पहचानती है कि आपको कौन-सा वर्कफ़्लो चाहिए और सिर्फ़ उससे मेल खाने वाला संदर्भ लोड करती है। इसमें सुरक्षा नियम, सत्यापन जाँच और विफलता की स्थितियाँ भी हैं।
- **references/cli.md**: `@wp-playground/cli` के साथ लोकल रूप से चलाना: सर्वर, माउंट, Blueprint चलाना, स्नैपशॉट और संस्करण बदलना।
- **references/debugging.md**: Xdebug सेटअप, पाथ मैपिंग, लॉग और अटके हुए CLI रन।
- **references/website.md**: playground.wordpress.net पर सिर्फ़ ब्राउज़र में होने वाले वर्कफ़्लो, जैसे Blueprint URL और शेयर लिंक।

<!-- The `references/webmcp.md`, `references/mcp.md`, and `references/sites-api.md` files cover the ways an agent can work with an open Playground site. Blueprint structure, steps, and authoring live in the separate `blueprint` skill, which the wp-playground skill uses for any Blueprint work. -->

कोई एजेंट किसी खुली Playground साइट के साथ किन तरीकों से काम कर सकता है, यह `references/webmcp.md`, `references/mcp.md` और `references/sites-api.md` फ़ाइलों में बताया गया है। Blueprint की संरचना, उसके चरण और उसे लिखने की जानकारी अलग `blueprint` स्किल में है। Blueprint से जुड़े हर काम के लिए wp-playground स्किल उसी का उपयोग करती है।

<!-- Your coding agent reads the files it needs before generating commands, ensuring correct flags and warning you about common pitfalls. -->

कमांड बनाने से पहले आपका कोडिंग एजेंट ज़रूरी फ़ाइलें पढ़ता है, ताकि फ़्लैग सही हों और वह आपको आम गलतियों से पहले ही सावधान कर सके।

<!-- ## Next steps -->

## आगे क्या करें {#next-steps}

<!--
- [WordPress Playground for Plugin Developers](/guides/for-plugin-developers) — Showcase and develop plugins with Playground
- [WordPress Playground for Theme Developers](/guides/for-theme-developers) — Build and demo themes using Playground
- [Playground documentation](/) — Full reference for APIs, architecture, and advanced configuration
-->

- [प्लगइन डेवलपर के लिए WordPress Playground](/guides/for-plugin-developers): Playground के साथ प्लगइन दिखाएँ और डेवलप करें
- [थीम डेवलपर के लिए WordPress Playground](/guides/for-theme-developers): Playground का उपयोग करके थीम बनाएँ और उनका डेमो दें
- [Playground दस्तावेज़](/): API, आर्किटेक्चर और एडवांस्ड कॉन्फ़िगरेशन का पूरा संदर्भ
