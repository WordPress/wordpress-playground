---
title: Playwright और WordPress Playground के साथ E2E परीक्षण
slug: /guides/e2e-testing-with-playwright
description: Playwright और Playground CLI का उपयोग करके WordPress प्लगइन और थीम के लिए एंड-टू-एंड परीक्षण सेट अप करें।
sidebar_class_name: navbar-build-item
---

<!-- End-to-end testing verifies that your WordPress plugin or theme works correctly from a user's perspective — clicking buttons, filling forms, and navigating pages in a real browser. This guide shows how to combine [Playwright](https://playwright.dev/) with the [WordPress Playground CLI](/developers/local-development/wp-playground-cli) to write reliable E2E tests without Docker, databases, or manual setup. -->

एंड-टू-एंड परीक्षण यह जाँचता है कि आपका WordPress प्लगइन या थीम उपयोगकर्ता के नज़रिए से सही ढंग से काम करता है या नहीं, जैसे असली ब्राउज़र में बटन क्लिक करना, फ़ॉर्म भरना और पेजों पर जाना। यह गाइड दिखाती है कि Docker, डेटाबेस या मैन्युअल सेटअप के बिना भरोसेमंद E2E परीक्षण लिखने के लिए [Playwright](https://playwright.dev/) को [WordPress Playground CLI](/developers/local-development/wp-playground-cli) के साथ कैसे जोड़ें।

<div class="callout callout-info">

<!-- This guide assumes familiarity with WordPress plugin or theme development. For an introduction to using Playground in your development workflow, see [WordPress Playground for Plugin Developers](/guides/for-plugin-developers). For Blueprint configuration details, see [Blueprints Getting Started](/blueprints/getting-started). -->

यह गाइड मानकर चलती है कि आप WordPress प्लगइन या थीम डेवलपमेंट से परिचित हैं। अपने डेवलपमेंट वर्कफ़्लो में Playground के उपयोग के परिचय के लिए [प्लगइन डेवलपर के लिए WordPress Playground](/guides/for-plugin-developers) देखें। ब्लूप्रिंट कॉन्फ़िगरेशन की जानकारी के लिए [Blueprints के साथ शुरुआत](/blueprints/getting-started) देखें।

</div>

<!-- ## Prerequisites -->

## ज़रूरी चीज़ें {#prerequisites}

<!--
- **Node.js 20.18** or later
- A WordPress plugin/theme or an entire WordPress site to test
- **Recommended:** enable the `@typescript-eslint/no-floating-promises` ESLint rule to catch missing `await` on async Playwright calls
-->

- **Node.js 20.18** या उसके बाद का संस्करण
- परीक्षण के लिए एक WordPress प्लगइन/थीम या पूरी WordPress साइट
- **सुझाव:** async Playwright कॉल में छूटे हुए `await` पकड़ने के लिए `@typescript-eslint/no-floating-promises` ESLint नियम सक्षम करें

<!-- ## Project setup -->

## प्रोजेक्ट सेटअप {#project-setup}

<!-- ### Install dependencies -->

### डिपेंडेंसी स्थापित करें {#install-dependencies}

<!-- From your plugin or theme root directory: -->

अपने प्लगइन या थीम की रूट डायरेक्टरी से:

```bash
npm init -y
npm install --save-dev @playwright/test @wp-playground/cli
npx playwright install chromium
```

<!-- This installs Playwright as the test runner, the Playground CLI for creating WordPress instances, and the Chromium browser for test execution. -->

इससे टेस्ट रनर के रूप में Playwright, WordPress इंस्टेंस बनाने के लिए Playground CLI, और परीक्षण चलाने के लिए Chromium ब्राउज़र स्थापित हो जाते हैं।

<!-- ### Configure Playwright -->

### Playwright कॉन्फ़िगर करें {#configure-playwright}

<!-- Create a `playwright.config.ts` file in your project root: -->

अपने प्रोजेक्ट के रूट में एक `playwright.config.ts` फ़ाइल बनाएँ:

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: './tests/e2e',
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: 1,
	reporter: 'html',
	timeout: 120_000,
	expect: {
		timeout: 30_000,
	},
	use: {
		screenshot: 'only-on-failure',
		trace: 'on-first-retry',
	},
});
```

<!-- WordPress Playground needs more time to start than a typical web app. The 120-second test timeout and 30-second assertion timeout account for WordPress boot time and page loads. Setting `workers: 1` prevents port conflicts when multiple tests share a Playground server. -->

WordPress Playground को शुरू होने में किसी आम वेब ऐप से ज़्यादा समय लगता है। 120 सेकंड का परीक्षण टाइमआउट और 30 सेकंड का असर्शन टाइमआउट WordPress के बूट होने और पेज लोड होने के समय को ध्यान में रखकर रखे गए हैं। `workers: 1` सेट करने से तब पोर्ट टकराव नहीं होते, जब कई परीक्षण एक ही Playground सर्वर साझा करते हैं।

<div class="callout callout-tip">

<!-- **Using baseURL with dynamic ports** -->

**डायनामिक पोर्ट के साथ baseURL का उपयोग**

<!-- By default, Playground uses port `9400` when it is free. To use a different port, pass `port: [NEW_PORT_NUMBER]` in the `runCLI` options: -->

डिफ़ॉल्ट रूप से, पोर्ट `9400` खाली होने पर Playground उसी का उपयोग करता है। कोई दूसरा पोर्ट उपयोग करने के लिए `runCLI` विकल्पों में `port: [NEW_PORT_NUMBER]` पास करें:

```typescript
const cli = await runCLI({ command: 'server', port: 9500, blueprint });
```

<!-- Then add `baseURL: "http://localhost:9500"` to the `use` section above. Playwright runs `.spec` and `.test` files by default. Set `testMatch` if your test files use a different naming pattern. -->

फिर ऊपर के `use` सेक्शन में `baseURL: "http://localhost:9500"` जोड़ें। Playwright डिफ़ॉल्ट रूप से `.spec` और `.test` फ़ाइलें चलाता है। अगर आपकी परीक्षण फ़ाइलों के नाम किसी दूसरे पैटर्न पर हैं, तो `testMatch` सेट करें।

</div>

<div class="callout callout-tip">

<!-- The WordPress Playground project uses even longer timeouts (300s test, 60s assertion) for its own tests. Start with the values above and increase if your CI environment is slower. -->

WordPress Playground प्रोजेक्ट अपने परीक्षणों के लिए इससे भी लंबे टाइमआउट (300s परीक्षण, 60s असर्शन) का उपयोग करता है। ऊपर दिए गए मानों से शुरू करें, और अगर आपका CI एनवायरनमेंट धीमा है, तो उन्हें बढ़ाएँ।

</div>

<!-- ### First test file -->

### पहली परीक्षण फ़ाइल {#first-test-file}

<!-- Create `tests/e2e/plugin.spec.ts`: -->

एक नई फ़ाइल `tests/e2e/plugin.spec.ts` बनाएँ:

```typescript
import { test, expect } from '@playwright/test';
import { runCLI, type RunCLIServer } from '@wp-playground/cli';

let cli: RunCLIServer;

test.beforeAll(async () => {
	cli = await runCLI({
		command: 'server',
		blueprint: {
			preferredVersions: { php: '8.3', wp: 'latest' },
			login: true,
		},
	});
});

test.afterAll(async () => {
	await cli?.[Symbol.asyncDispose]();
});

test('WordPress dashboard loads', async ({ page }) => {
	await page.goto(`${cli.serverUrl}/wp-admin/`);
	// WordPress core admin elements lack ARIA roles — CSS selectors are acceptable here
	await expect(page.locator('#wpbody-content')).toBeVisible();
	await expect(page).toHaveTitle(/Dashboard/);
});
```

<!-- Run the test: -->

परीक्षण चलाएँ:

```bash
npx playwright test
```

<!-- ## Choosing locators -->

## लोकेटर चुनना {#choosing-locators}

<!-- Playwright provides several ways to find elements on the page. Prefer locators that reflect how users see the page, falling back to CSS selectors only when necessary. -->

Playwright पेज पर एलिमेंट ढूँढने के कई तरीके देता है। ऐसे लोकेटर को प्राथमिकता दें, जो पेज को उसी तरह दर्शाएँ जैसे उपयोगकर्ता उसे देखते हैं, और CSS सेलेक्टर का सहारा सिर्फ़ तब लें, जब ज़रूरी हो।

<!-- **Locator priority** (most to least preferred): -->

**लोकेटर की प्राथमिकता** (सबसे ज़्यादा से सबसे कम पसंदीदा):

<!--
1. `page.getByRole()` — buttons, headings, links, form controls
2. `page.getByLabel()` — form inputs with associated labels
3. `page.getByText()` — visible text content
4. `page.getByTestId()` — elements with `data-testid` attributes you add to your plugin
5. `page.locator()` — CSS or XPath selectors as a last resort
-->

1. `page.getByRole()`: बटन, हेडिंग, लिंक, फ़ॉर्म कंट्रोल
2. `page.getByLabel()`: जुड़े हुए लेबल वाले फ़ॉर्म इनपुट
3. `page.getByText()`: दिखने वाली टेक्स्ट सामग्री
4. `page.getByTestId()`: आपके प्लगइन में जोड़े गए `data-testid` एट्रिब्यूट वाले एलिमेंट
5. `page.locator()`: आख़िरी उपाय के रूप में CSS या XPath सेलेक्टर

<!-- ### WordPress-specific guidance -->

### WordPress से जुड़े सुझाव {#wordpress-specific-guidance}

<!-- In the WordPress admin, some core elements (admin bar, meta boxes) rely on IDs and CSS classes rather than ARIA roles. However, many elements work well with semantic locators. This means: -->

WordPress एडमिन में कुछ कोर एलिमेंट (एडमिन बार, मेटा बॉक्स) ARIA रोल के बजाय ID और CSS क्लास पर निर्भर करते हैं। फिर भी, कई एलिमेंट सिमैंटिक लोकेटर के साथ अच्छी तरह काम करते हैं। इसका मतलब है:

<!--
- **Use semantic locators** for buttons, headings, links, form fields, and admin menu items — WordPress renders standard `<button>`, `<input>`, `<a>`, and `<h1>` elements that `getByRole` and `getByLabel` can find.
- **Use `data-testid`** for your own plugin markup — you control the HTML, so add testable attributes.
- **Use CSS selectors** for WordPress core layout elements like `#wpadminbar` or `#wpbody-content` — these lack ARIA alternatives.
-->

- बटन, हेडिंग, लिंक, फ़ॉर्म फ़ील्ड और एडमिन मेन्यू आइटम के लिए **सिमैंटिक लोकेटर का उपयोग करें**। WordPress सामान्य `<button>`, `<input>`, `<a>` और `<h1>` एलिमेंट रेंडर करता है, जिन्हें `getByRole` और `getByLabel` ढूँढ सकते हैं।
- अपने प्लगइन के मार्कअप के लिए **`data-testid` का उपयोग करें**। HTML आपके नियंत्रण में है, इसलिए परीक्षण में काम आने वाले एट्रिब्यूट जोड़ें।
- WordPress कोर के लेआउट एलिमेंट, जैसे `#wpadminbar` या `#wpbody-content`, के लिए **CSS सेलेक्टर का उपयोग करें**, क्योंकि इनके कोई ARIA विकल्प नहीं हैं।

<!-- ### Same element, three approaches -->

### एक ही एलिमेंट, तीन तरीके {#same-element-three-approaches}

```typescript
// ✅ Preferred: semantic locator (works because WP renders a real <button>)
await page.getByRole('button', { name: 'Save Changes' }).click();

// ⚠️ Acceptable: test ID you added to your plugin markup
await page.getByTestId('save-settings').click();

// ❌ Avoid: brittle CSS selector tied to WordPress markup
await page.locator('#submit').click();
```

<div class="callout callout-tip">

<!-- **Generate locators automatically** -->

**लोकेटर अपने-आप बनाएँ**

<!-- From your plugin or theme root directory, start a Playground server with `npx @wp-playground/cli server --auto-mount --login`. It mounts and activates your project. In a second terminal, run `npx playwright codegen localhost:9400/wp-admin/` to open a browser and record interactions. If the server prints a different port, use that one. Playwright generates locator code as you click, helping you discover which semantic locators work for each element. -->

अपने प्लगइन या थीम की रूट डायरेक्टरी से `npx @wp-playground/cli server --auto-mount --login` चलाकर एक Playground सर्वर शुरू करें। यह आपके प्रोजेक्ट को माउंट और सक्रिय करता है। दूसरे टर्मिनल में `npx playwright codegen localhost:9400/wp-admin/` चलाएँ, ताकि एक ब्राउज़र खुले और आपके इंटरैक्शन रिकॉर्ड हों। अगर सर्वर कोई दूसरा पोर्ट दिखाए, तो उसी का उपयोग करें। आप जैसे-जैसे क्लिक करते हैं, Playwright लोकेटर कोड बनाता जाता है, जिससे आपको पता चलता है कि हर एलिमेंट के लिए कौन-से सिमैंटिक लोकेटर काम करते हैं।

</div>

<!-- ## Auto-waiting and web-first assertions -->

## अपने-आप इंतज़ार और वेब-फ़र्स्ट असर्शन {#auto-waiting-and-web-first-assertions}

<!-- Playwright locators wait automatically for elements to appear, become visible, and become actionable. You do not need manual `waitForSelector` calls in most cases. -->

Playwright लोकेटर एलिमेंट के पेज पर आने, दिखाई देने और कार्रवाई के लिए तैयार होने तक अपने-आप इंतज़ार करते हैं। ज़्यादातर मामलों में आपको मैन्युअल `waitForSelector` कॉल की ज़रूरत नहीं होती।

<!-- ### Web-first assertions -->

### वेब-फ़र्स्ट असर्शन {#web-first-assertions}

<!-- Web-first assertions auto-retry until the condition passes or the timeout expires. Always prefer them over manual checks: -->

वेब-फ़र्स्ट असर्शन तब तक अपने-आप दोबारा कोशिश करते हैं, जब तक शर्त पूरी न हो जाए या टाइमआउट ख़त्म न हो जाए। मैन्युअल जाँच के बजाय हमेशा इन्हें प्राथमिकता दें:

```typescript
// ✅ Web-first assertion (auto-retries until visible or timeout)
await expect(page.getByText('Settings saved')).toBeVisible();

// ❌ Manual check (no retry — flaky if the element appears after a delay)
expect(await page.getByText('Settings saved').isVisible()).toBe(true);
```

<!-- ### Soft assertions -->

### सॉफ़्ट असर्शन {#soft-assertions}

<!-- Use `expect.soft()` to check multiple things on one page without stopping at the first failure. All failures appear in the test report: -->

पहली विफलता पर रुके बिना एक ही पेज पर कई चीज़ें जाँचने के लिए `expect.soft()` का उपयोग करें। सभी विफलताएँ परीक्षण रिपोर्ट में दिखती हैं:

```typescript
await expect.soft(page.getByLabel('API Key')).toHaveValue('test-key-123');
await expect.soft(page.getByText('Settings saved')).toBeVisible();
await expect.soft(page.getByRole('heading', { level: 1 })).toContainText('Settings');
```

<!-- ## Writing tests -->

## परीक्षण लिखना {#writing-tests}

<!-- ### Starting a Playground server -->

### Playground सर्वर शुरू करना {#starting-a-playground-server}

<!-- The `runCLI` function starts a local Playground server and returns an object with `serverUrl` (the URL string) and `server` (the HTTP server instance). When your tests finish, call `[Symbol.asyncDispose]()` on the returned object to stop the server and clean up its resources. Pass a Blueprint to configure the WordPress instance: -->

फ़ंक्शन `runCLI` एक लोकल Playground सर्वर शुरू करता है और एक ऑब्जेक्ट लौटाता है, जिसमें `serverUrl` (URL स्ट्रिंग) और `server` (HTTP सर्वर इंस्टेंस) होते हैं। परीक्षण पूरे होने पर सर्वर बंद करने और उसके संसाधन साफ़ करने के लिए लौटाए गए ऑब्जेक्ट पर `[Symbol.asyncDispose]()` कॉल करें। WordPress इंस्टेंस को कॉन्फ़िगर करने के लिए एक ब्लूप्रिंट पास करें:

```typescript
const cli = await runCLI({
	command: 'server',
	blueprint: {
		preferredVersions: { php: '8.3', wp: 'latest' },
		login: true,
		steps: [
			{
				step: 'installPlugin',
				pluginData: {
					resource: 'wordpress.org/plugins',
					slug: 'woocommerce',
				},
			},
		],
	},
});
```

<!-- #### Server lifecycle: shared vs. per-test -->

#### सर्वर लाइफ़साइकल: साझा या हर परीक्षण के लिए अलग {#server-lifecycle-shared-vs-per-test}

<!-- **Shared server (`beforeAll`/`afterAll`)** — one Playground instance serves all tests in a describe block. Faster, but tests can affect each other: -->

**साझा सर्वर (`beforeAll`/`afterAll`)**: एक ही Playground इंस्टेंस किसी describe ब्लॉक के सभी परीक्षणों के लिए काम करता है। यह तेज़ है, लेकिन परीक्षण एक-दूसरे पर असर डाल सकते हैं:

```typescript
test.describe('Plugin settings', () => {
	test.beforeAll(async () => {
		cli = await runCLI({ command: 'server', blueprint });
	});
	test.afterAll(async () => {
		await cli?.[Symbol.asyncDispose]();
	});
	// Tests share the same WordPress instance
});
```

<!-- **Per-test server (`beforeEach`/`afterEach`)** — each test gets a fresh instance. Slower, but fully isolated: -->

**हर परीक्षण के लिए अलग सर्वर (`beforeEach`/`afterEach`)**: हर परीक्षण को एक नया इंस्टेंस मिलता है। यह धीमा है, लेकिन पूरी तरह अलग-थलग है:

```typescript
test.beforeEach(async () => {
	cli = await runCLI({ command: 'server', blueprint });
});
test.afterEach(async () => {
	await cli?.[Symbol.asyncDispose]();
});
```

<!-- Use shared servers when tests only read state (checking pages render). Use per-test servers when tests modify state (creating posts, changing settings). -->

जब परीक्षण सिर्फ़ स्थिति पढ़ते हैं (पेजों के रेंडर होने की जाँच), तब साझा सर्वर का उपयोग करें। जब परीक्षण स्थिति बदलते हैं (पोस्ट बनाना, सेटिंग्स बदलना), तब हर परीक्षण के लिए अलग सर्वर का उपयोग करें।

<!-- ### Using Blueprints as test fixtures -->

### ब्लूप्रिंट को परीक्षण फ़िक्स्चर के रूप में इस्तेमाल करना {#using-blueprints-as-test-fixtures}

<!-- Blueprints define the WordPress state each test scenario needs. Here are common patterns: -->

ब्लूप्रिंट हर परीक्षण परिदृश्य के लिए ज़रूरी WordPress स्थिति तय करते हैं। यहाँ कुछ आम पैटर्न दिए गए हैं:

<!-- #### Installing a plugin from wordpress.org -->

#### प्लगइन को wordpress.org से स्थापित करना {#installing-a-plugin-from-wordpressorg}

```typescript
const blueprint = {
	preferredVersions: { php: '8.3', wp: 'latest' },
	login: true,
	steps: [
		{
			step: 'installPlugin',
			pluginData: {
				resource: 'wordpress.org/plugins',
				slug: 'contact-form-7',
			},
		},
	],
};
```

<!-- #### Installing a local plugin -->

#### लोकल प्लगइन स्थापित करना {#installing-a-local-plugin}

<!-- Mount your local plugin directory into the Playground instance: -->

अपने लोकल प्लगइन की डायरेक्टरी को Playground इंस्टेंस में माउंट करें:

```typescript
const cli = await runCLI({
	command: 'server',
	mount: [
		{
			hostPath: './',
			vfsPath: '/wordpress/wp-content/plugins/my-plugin',
		},
	],
	blueprint: {
		preferredVersions: { php: '8.3', wp: 'latest' },
		login: true,
		steps: [
			{
				step: 'activatePlugin',
				pluginPath: 'my-plugin/my-plugin.php',
			},
		],
	},
});
```

<!-- This maps your current directory to the plugin path inside WordPress, then activates the plugin. Changes to your local files are reflected immediately. The user can set the `autoMount` property to identify plugins and themes, but the `mount` property will provide more control to the user to set different folders in the project. -->

यह आपकी मौजूदा डायरेक्टरी को WordPress के अंदर प्लगइन के पाथ पर मैप करता है, फिर प्लगइन को सक्रिय करता है। आपकी लोकल फ़ाइलों में किए गए बदलाव तुरंत दिखते हैं। उपयोगकर्ता प्लगइन और थीम पहचानने के लिए `autoMount` प्रॉपर्टी सेट कर सकता है, लेकिन `mount` प्रॉपर्टी प्रोजेक्ट के अलग-अलग फ़ोल्डर सेट करने के लिए उपयोगकर्ता को ज़्यादा नियंत्रण देगी।

<!-- #### Setting options and creating content -->

#### विकल्प सेट करना और सामग्री बनाना {#setting-options-and-creating-content}

```typescript
const blueprint = {
	login: true,
	steps: [
		{
			step: 'setSiteOptions',
			options: {
				blogname: 'Test Site',
				permalink_structure: '/%postname%/',
			},
		},
		{
			step: 'runPHP',
			code: `<?php
        require '/wordpress/wp-load.php';
        wp_insert_post([
          'post_title' => 'Test Post',
          'post_content' => '<!-- wp:paragraph --><p>Hello World</p><!-- /wp:paragraph -->',
          'post_status' => 'publish',
        ]);
      `,
		},
	],
};
```

<div class="callout callout-tip">

<!-- Use the [Playground Step Library](https://akirk.github.io/playground-step-library/) or [Pootle Playground](https://pootleplayground.com/) to prototype your Blueprint configuration visually before adding it to your test code. -->

अपने परीक्षण कोड में जोड़ने से पहले अपने ब्लूप्रिंट कॉन्फ़िगरेशन का विज़ुअल प्रोटोटाइप बनाने के लिए [Playground Step Library](https://akirk.github.io/playground-step-library/) या [Pootle Playground](https://pootleplayground.com/) का उपयोग करें।

</div>

<!-- ### Testing WordPress admin pages -->

### WordPress एडमिन पेजों का परीक्षण {#testing-wordpress-admin-pages}

<!-- Navigate to admin pages and interact with the WordPress UI: -->

एडमिन पेजों पर जाएँ और WordPress UI के साथ इंटरैक्ट करें:

```typescript
test('plugin settings page saves options', async ({ page }) => {
	await page.goto(`${cli.serverUrl}/wp-admin/options-general.php?page=my-plugin`);

	await page.getByLabel('API Key').fill('test-key-123');
	await page.getByRole('button', { name: 'Save Changes' }).click();

	await expect(page.getByText('Settings saved')).toBeVisible();
	await expect(page.getByLabel('API Key')).toHaveValue('test-key-123');
});
```

<!-- #### Handling common admin UI elements -->

#### आम एडमिन UI एलिमेंट संभालना {#handling-common-admin-ui-elements}

```typescript
// Dismiss WordPress admin notices (WP adds aria-label to dismiss buttons)
await page.getByRole('button', { name: 'Dismiss this notice' }).first().click();

// Wait for admin bar to load — no ARIA role available, use locator
await page.locator('#wpadminbar').waitFor();

// Navigate via admin menu
await page.getByRole('link', { name: 'My Plugin' }).first().click();
```

<!-- ### Testing the front end -->

### फ़्रंट एंड का परीक्षण {#testing-the-front-end}

```typescript
test('plugin shortcode renders on front end', async ({ page }) => {
	// Navigate to a page with the shortcode
	await page.goto(`${cli.serverUrl}/?p=2`);

	// Recommend: add data-testid="my-plugin-widget" to your plugin markup
	await expect(page.getByTestId('my-plugin-widget')).toBeVisible();
	await expect(page.getByTestId('my-plugin-widget')).toContainText('Expected content');
	// Or use CSS if you don't control the markup:
	// await expect(page.locator(".my-plugin-widget")).toBeVisible();
});

test('theme displays post correctly', async ({ page }) => {
	await page.goto(`${cli.serverUrl}/test-post/`);

	await expect(page.getByRole('heading', { level: 1 })).toContainText('Test Post');
	await expect(page.getByText('Hello World', { exact: true })).toBeVisible();
});
```

<!-- ## Page Object Model pattern -->

## Page Object Model पैटर्न {#page-object-model-pattern}

<!-- The Page Object Model (POM) wraps page interactions into reusable classes. This reduces duplication and makes tests easier to maintain when your plugin UI changes. -->

Page Object Model (POM) पेज इंटरैक्शन को दोबारा इस्तेमाल होने वाली क्लास में समेटता है। इससे दोहराव कम होता है, और आपके प्लगइन का UI बदलने पर परीक्षणों को संभालना आसान हो जाता है।

```typescript
// tests/e2e/pages/plugin-settings.ts
import { type Page, type Locator, expect } from '@playwright/test';

export class PluginSettingsPage {
	readonly page: Page;
	readonly apiKeyInput: Locator;
	readonly saveButton: Locator;
	readonly successNotice: Locator;

	constructor(page: Page) {
		this.page = page;
		this.apiKeyInput = page.getByLabel('API Key');
		this.saveButton = page.getByRole('button', { name: 'Save Changes' });
		this.successNotice = page.getByText('Settings saved');
	}

	async goto(baseUrl: string) {
		await this.page.goto(`${baseUrl}/wp-admin/options-general.php?page=my-plugin`);
	}

	async setApiKey(key: string) {
		await this.apiKeyInput.fill(key);
		await this.saveButton.click();
	}

	async expectSaved() {
		await expect(this.successNotice).toBeVisible();
	}
}
```

<!-- Use the POM in tests: -->

परीक्षणों में POM का उपयोग करें:

```typescript
import { PluginSettingsPage } from './pages/plugin-settings';

test('save plugin settings', async ({ page }) => {
	const settings = new PluginSettingsPage(page);
	await settings.goto(cli.serverUrl);
	await settings.setApiKey('test-key-123');
	await settings.expectSaved();
});
```

<!-- The Playground project uses this pattern with a `WebsitePage` class that provides methods like `goto()`, `wordpress()`, and `getSiteTitle()` — encapsulating navigation and WordPress-specific interactions. -->

Playground प्रोजेक्ट इस पैटर्न का उपयोग `WebsitePage` क्लास के साथ करता है, जो `goto()`, `wordpress()` और `getSiteTitle()` जैसे मेथड देती है। ये मेथड नेविगेशन और WordPress से जुड़े इंटरैक्शन को एक जगह समेटते हैं।

<!-- ## Testing across PHP and WordPress versions -->

## अलग-अलग PHP और WordPress संस्करणों पर परीक्षण {#testing-across-php-and-wordpress-versions}

<!-- Parameterized tests cover multiple version combinations without duplicating test code: -->

पैरामीटराइज़्ड परीक्षणों से आप परीक्षण कोड दोहराए बिना संस्करणों के कई संयोजन कवर कर सकते हैं:

```typescript
const versionMatrix = [
	{ php: '8.1', wp: '6.5' },
	{ php: '8.2', wp: '6.7' },
	{ php: '8.3', wp: 'latest' },
] as const;

for (const { php, wp } of versionMatrix) {
	test.describe(`PHP ${php} + WP ${wp}`, () => {
		let versionCli: RunCLIServer;

		test.beforeAll(async () => {
			versionCli = await runCLI({
				command: 'server',
				mount: [
					{
						hostPath: './',
						vfsPath: '/wordpress/wp-content/plugins/my-plugin',
					},
				],
				blueprint: {
					preferredVersions: { php, wp },
					login: true,
					steps: [
						{
							step: 'activatePlugin',
							pluginPath: 'my-plugin/my-plugin.php',
						},
					],
				},
			});
		});

		test('admin page loads without errors', async ({ page }) => {
			await page.goto(`${versionCli.serverUrl}/wp-admin/options-general.php?page=my-plugin`);
			// WordPress core elements use CSS selectors — no ARIA roles available
			await expect(page.locator('.error')).not.toBeVisible();
			await expect(page.locator('#wpbody-content')).toBeVisible();
		});

		test('front-end output renders', async ({ page }) => {
			await page.goto(versionCli.serverUrl);
			await expect(page.getByTestId('my-plugin-widget')).toBeVisible();
		});

		test.afterAll(async () => {
			await versionCli?.[Symbol.asyncDispose]();
		});
	});
}
```

<!-- The `preferredVersions` property in the Blueprint controls which PHP and WordPress versions the Playground instance uses. Supported ranges: PHP 7.4–8.5, WordPress 6.3 and later, plus `latest`, `nightly`, and `beta`. For type-safe PHP version values, use the `SupportedPHPVersion` type from `@php-wasm/universal`. -->

ब्लूप्रिंट की `preferredVersions` प्रॉपर्टी तय करती है कि Playground इंस्टेंस PHP और WordPress के कौन-से संस्करण इस्तेमाल करता है। समर्थित रेंज: PHP 7.4–8.5, WordPress 6.3 और उसके बाद के संस्करण, साथ में `latest`, `nightly` और `beta`। टाइप-सेफ़ PHP संस्करण मानों के लिए `@php-wasm/universal` के `SupportedPHPVersion` टाइप का उपयोग करें।

<!-- ## Running tests in CI/CD -->

## CI/CD में परीक्षण चलाना {#running-tests-in-cicd}

<!-- ### GitHub Actions -->

### GitHub Actions {#github-actions}

<!-- Create `.github/workflows/e2e-tests.yml`: -->

एक नई फ़ाइल `.github/workflows/e2e-tests.yml` बनाएँ:

```yaml
name: E2E Tests

on:
    push:
        branches: [main]
    pull_request:
        branches: [main]

jobs:
    e2e:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v4

            - uses: actions/setup-node@v4
              with:
                  node-version: 20
                  cache: 'npm'

            - name: Install dependencies
              run: npm ci

            - name: Cache Playwright browsers
              uses: actions/cache@v4
              id: playwright-cache
              with:
                  path: ~/.cache/ms-playwright
                  key: playwright-${{ hashFiles('package-lock.json') }}

            - name: Install Playwright browsers
              if: steps.playwright-cache.outputs.cache-hit != 'true'
              run: npx playwright install chromium --with-deps

            - name: Run E2E tests
              run: npx playwright test

            - name: Upload test report
              uses: actions/upload-artifact@v4
              if: ${{ !cancelled() }}
              with:
                  name: playwright-report
                  path: playwright-report/
                  retention-days: 30
```

<!-- This workflow installs dependencies, downloads Chromium, runs the tests, and uploads the HTML report as an artifact. The `--with-deps` flag installs system libraries Chromium needs on Ubuntu. -->

यह वर्कफ़्लो डिपेंडेंसी स्थापित करता है, Chromium डाउनलोड करता है, परीक्षण चलाता है और HTML रिपोर्ट को आर्टिफ़ैक्ट के रूप में अपलोड करता है। `--with-deps` फ़्लैग वे सिस्टम लाइब्रेरी स्थापित करता है, जिनकी Ubuntu पर Chromium को ज़रूरत होती है।

<div class="callout callout-tip">

<!-- **Sharding for faster CI** -->

**तेज़ CI के लिए शार्डिंग**

<!-- Split tests across multiple CI jobs with Playwright's built-in sharding: -->

Playwright की बिल्ट-इन शार्डिंग से परीक्षणों को कई CI जॉब में बाँटें:

```bash
npx playwright test --shard=1/3
npx playwright test --shard=2/3
npx playwright test --shard=3/3
```

<!-- Create three parallel jobs in your workflow matrix, each running a different shard. This reduces total CI time proportionally. -->

अपने वर्कफ़्लो मैट्रिक्स में तीन समानांतर जॉब बनाएँ, जिनमें से हर एक अलग शार्ड चलाए। इससे CI का कुल समय उसी अनुपात में कम हो जाता है।

</div>

<div class="callout callout-info">

<!-- For manual PR testing alongside automated E2E tests, see [Adding PR Preview Buttons with GitHub Actions](/guides/github-action-pr-preview). -->

अपने-आप चलने वाले E2E परीक्षणों के साथ मैन्युअल PR परीक्षण के लिए [GitHub Actions से PR पूर्वावलोकन बटन जोड़ना](/guides/github-action-pr-preview) देखें।

</div>

<!-- ## Troubleshooting -->

## समस्या निवारण {#troubleshooting}

<!-- **Timeout errors** — Increase `timeout` in `playwright.config.ts`. WordPress boot time varies by environment. CI runners often need 120–180 seconds. -->

**टाइमआउट एरर**: `playwright.config.ts` में `timeout` बढ़ाएँ। WordPress के बूट होने का समय एनवायरनमेंट के हिसाब से अलग-अलग होता है। CI रनर को अक्सर 120–180 सेकंड चाहिए होते हैं।

<!-- **Port conflicts** — Let Playground auto-assign ports. Do not hardcode port numbers in your configuration. The `serverUrl` property returns the correct URL. -->

**पोर्ट टकराव**: Playground को पोर्ट अपने-आप तय करने दें। अपने कॉन्फ़िगरेशन में पोर्ट नंबर हार्डकोड न करें। `serverUrl` प्रॉपर्टी सही URL लौटाती है।

<!-- **Browser not found** — Run `npx playwright install chromium` to download the browser binary. On CI, add `--with-deps` for system libraries. -->

**ब्राउज़र नहीं मिला**: ब्राउज़र बाइनरी डाउनलोड करने के लिए `npx playwright install chromium` चलाएँ। CI पर सिस्टम लाइब्रेरी के लिए `--with-deps` जोड़ें।

<!-- **WordPress not loading** — Check your Blueprint syntax against the [Blueprint schema](https://playground.wordpress.net/blueprint-schema.json). Invalid steps fail silently in some cases. -->

**WordPress लोड नहीं हो रहा**: अपने ब्लूप्रिंट का सिंटैक्स [ब्लूप्रिंट स्कीमा](https://playground.wordpress.net/blueprint-schema.json) से मिलाकर जाँचें। कुछ मामलों में अमान्य चरण बिना कोई एरर दिखाए विफल हो जाते हैं।

<!-- **Tests pass locally but fail in CI** — CI runners have less memory and CPU. Increase timeouts, reduce parallel workers, and ensure `workers: 1` in the config. -->

**परीक्षण लोकल पर पास होते हैं, लेकिन CI में विफल होते हैं**: CI रनर के पास कम मेमोरी और CPU होते हैं। टाइमआउट बढ़ाएँ, समानांतर वर्कर कम करें, और पक्का करें कि कॉन्फ़िग में `workers: 1` हो।

<!-- ## Debugging tests -->

## परीक्षणों को डीबग करना {#debugging-tests}

<!-- When a test fails, Playwright provides several tools to investigate: -->

जब कोई परीक्षण विफल होता है, तो जाँच के लिए Playwright कई टूल देता है:

<!-- **Playwright Inspector** — step through tests interactively with a built-in debugger: -->

**Playwright Inspector**: बिल्ट-इन डीबगर से परीक्षणों को इंटरैक्टिव तरीके से एक-एक कदम चलाएँ:

```bash
npx playwright test --debug
```

<!-- **Trace viewer** — inspect a timeline of actions, DOM snapshots, and network requests from a failed test. With `trace: "on-first-retry"` in the config above, Playwright records a trace when it retries a failed test, which happens only in CI (`retries: 2`). It saves `trace.zip` in that test's folder under `test-results/`. To record traces locally, run `npx playwright test --trace on`. To open a trace, replace `<test-folder>` in this command with that folder's name: -->

**Trace viewer**: किसी विफल हुए परीक्षण की कार्रवाइयों की टाइमलाइन, DOM स्नैपशॉट और नेटवर्क अनुरोध देखें। ऊपर के कॉन्फ़िग में `trace: "on-first-retry"` होने पर Playwright तब ट्रेस रिकॉर्ड करता है, जब वह किसी विफल हुए परीक्षण को दोबारा चलाता है, और ऐसा सिर्फ़ CI में होता है (`retries: 2`)। वह `trace.zip` को `test-results/` के अंदर उस परीक्षण के फ़ोल्डर में सहेजता है। लोकल पर ट्रेस रिकॉर्ड करने के लिए `npx playwright test --trace on` चलाएँ। कोई ट्रेस खोलने के लिए इस कमांड में `<test-folder>` की जगह उस फ़ोल्डर का नाम डालें:

```bash
npx playwright show-trace test-results/<test-folder>/trace.zip
```

<!-- **UI mode** — run tests in a visual interface where you can watch, filter, and re-run them: -->

**UI मोड**: परीक्षणों को एक विज़ुअल इंटरफ़ेस में चलाएँ, जहाँ आप उन्हें देख, फ़िल्टर कर और दोबारा चला सकते हैं:

```bash
npx playwright test --ui
```

<!-- **Screenshot on failure** — the `screenshot: "only-on-failure"` setting in the config saves a screenshot whenever a test fails. Find screenshots in the `test-results/` directory. -->

**विफल होने पर स्क्रीनशॉट**: कॉन्फ़िग की `screenshot: "only-on-failure"` सेटिंग हर बार परीक्षण विफल होने पर एक स्क्रीनशॉट सहेजती है। स्क्रीनशॉट `test-results/` डायरेक्टरी में मिलते हैं।

<div class="callout callout-tip">

<!-- Combine `--debug` with a specific test file to focus your investigation: `npx playwright test tests/e2e/settings.spec.ts --debug` -->

अपनी जाँच को एक जगह केंद्रित करने के लिए `--debug` को किसी ख़ास परीक्षण फ़ाइल के साथ इस्तेमाल करें: `npx playwright test tests/e2e/settings.spec.ts --debug`

</div>

<!-- ## Next steps -->

## आगे क्या करें {#next-steps}

<!--
- [WordPress Playground CLI documentation](/developers/local-development/wp-playground-cli) — full CLI reference
- [Playwright documentation](https://playwright.dev/docs/intro) — test writing guide and API reference
- [Blueprints reference](/blueprints/steps) — all available Blueprint steps
- [Adding PR Preview Buttons](/guides/github-action-pr-preview) — combine automated tests with manual PR previews
-->

- [WordPress Playground CLI दस्तावेज़](/developers/local-development/wp-playground-cli): CLI का पूरा संदर्भ
- [Playwright दस्तावेज़](https://playwright.dev/docs/intro): परीक्षण लिखने की गाइड और API संदर्भ
- [Blueprints संदर्भ](/blueprints/steps): ब्लूप्रिंट के सभी उपलब्ध चरण
- [PR पूर्वावलोकन बटन जोड़ना](/guides/github-action-pr-preview): अपने-आप चलने वाले परीक्षणों को मैन्युअल PR पूर्वावलोकन के साथ जोड़ें
