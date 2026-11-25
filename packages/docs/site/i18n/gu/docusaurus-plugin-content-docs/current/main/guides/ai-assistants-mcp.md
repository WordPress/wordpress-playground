---
title: MCP દ્વારા AI સહાયકો સાથે વર્ડપ્રેસ પ્લેગ્રાઉન્ડનો ઉપયોગ કરો
slug: /guides/ai-assistants-mcp
description: વર્ડપ્રેસ પ્લેગ્રાઉન્ડ MCP સર્વરનો ઉપયોગ ક્યારે કરવો, તે પ્લેગ્રાઉન્ડ CLI થી કેવી રીતે અલગ પડે છે, અને AI સહાયક સાથે બ્રાઉઝર આધારિત વર્ડપ્રેસ ડેમો કેવી રીતે ચલાવવા તે શીખો.
---

<!--
# Use WordPress Playground with AI assistants through MCP
-->

# MCP દ્વારા AI સહાયકો સાથે વર્ડપ્રેસ પ્લેગ્રાઉન્ડનો ઉપયોગ કરો

<!--
The WordPress Playground MCP server lets an AI assistant connect to a real Playground site running in your browser. After the connection is open, you can ask the assistant to navigate WordPress, inspect pages, reproduce issues, and explain what it finds.
-->

વર્ડપ્રેસ પ્લેગ્રાઉન્ડ MCP સર્વર AI સહાયકને તમારા બ્રાઉઝરમાં ચાલી રહેલી વાસ્તવિક પ્લેગ્રાઉન્ડ સાઇટ સાથે કનેક્ટ થવા દે છે. કનેક્શન સ્થપાયા પછી, તમે સહાયકને વર્ડપ્રેસ નેવિગેટ કરવા, પેજિસનું નિરીક્ષણ કરવા, સમસ્યાઓનું પુનરાવર્તન (reproduce) કરવા અને જે મળે તે સમજાવવા કહી શકો છો.

<!--
Use this guide to configure the MCP server and work with Playground through natural language. For background on the architecture, see [Connect AI coding agents to WordPress Playground with MCP](https://make.wordpress.org/playground/2026/03/17/connect-ai-coding-agents-to-wordpress-playground-with-mcp/).
-->

MCP સર્વરને ગોઠવવા અને કુદરતી ભાષા (natural language) દ્વારા પ્લેગ્રાઉન્ડ સાથે કામ કરવા માટે આ માર્ગદર્શિકાનો ઉપયોગ કરો. આર્કિટેક્ચરની વિગતો માટે, [Connect AI coding agents to WordPress Playground with MCP](https://make.wordpress.org/playground/2026/03/17/connect-ai-coding-agents-to-wordpress-playground-with-mcp/) જુઓ.

<!--
MCP is most useful when the site itself matters: a saved Playground, a persistent browser-backed site, a My WordPress-style site, or a demo where you want the assistant to act like a remote control for the browser. If you are working from a terminal-based coding agent and you mainly need local automation, the Playground CLI is usually simpler and less ambiguous.
-->

જ્યારે સાઇટ પોતે મહત્વપૂર્ણ હોય ત્યારે MCP સૌથી વધુ ઉપયોગી છે: સેવ કરેલું પ્લેગ્રાઉન્ડ, પર્સિસ્ટન્ટ બ્રાઉઝર-બેક્ડ સાઇટ, My WordPress-શૈલીની સાઇટ, અથવા એવો ડેમો જ્યાં તમે ઇચ્છો કે સહાયક બ્રાઉઝર માટે રિમોટ કંટ્રોલની જેમ કાર્ય કરે. જો તમે ટર્મિનલ-આધારિત કોડિંગ એજન્ટમાંથી કામ કરી રહ્યા હોવ અને તમને મુખ્યત્વે લોકલ ઓટોમેશનની જરૂર હોય, તો પ્લેગ્રાઉન્ડ CLI સામાન્ય રીતે વધુ સરળ અને સ્પષ્ટ છે.

<!--
## What MCP adds to Playground
-->

## MCP પ્લેગ્રાઉન્ડમાં શું ઉમેરે છે (What MCP adds to Playground)

<!--
MCP, or Model Context Protocol, gives your AI assistant control over the Playground site that is open in your browser. Instead of only describing a task, the assistant can act on the site:
-->

MCP, અથવા મોડેલ કોન્ટેક્સ્ટ પ્રોટોકોલ (Model Context Protocol), તમારા AI સહાયકને તમારા બ્રાઉઝરમાં ખુલ્લી પ્લેગ્રાઉન્ડ સાઇટ પર નિયંત્રણ આપે છે. ફક્ત કાર્યનું વર્ણન કરવાને બદલે, સહાયક સાઇટ પર સીધા પગલાં લઈ શકે છે:

<!--
- Open the exact Playground URL needed to connect to the MCP server
- List your available Playground sites
- Open, rename, or save a Playground site
- Switch between browser-managed Playground sites
- Navigate to WordPress admin and front-end URLs
- Follow redirects and report the final URL
- Make authenticated WordPress REST API requests
- Read and write files inside the Playground filesystem
- Run PHP inside the Playground site
- Request pages and inspect the response
-->

- MCP સર્વર સાથે કનેક્ટ થવા માટે જરૂરી ચોક્કસ પ્લેગ્રાઉન્ડ URL ખોલવું
- તમારી ઉપલબ્ધ પ્લેગ્રાઉન્ડ સાઇટ્સની સૂચિ દર્શાવવી
- પ્લેગ્રાઉન્ડ સાઇટ ખોલવી, તેનું નામ બદલવું અથવા તેને સેવ કરવી
- બ્રાઉઝર-સંચાલિત પ્લેગ્રાઉન્ડ સાઇટ્સ વચ્ચે સ્વિચ કરવું
- વર્ડપ્રેસ એડમિન અને ફ્રન્ટ-એન્ડ URLs પર નેવિગેટ કરવું
- રીડાયરેક્ટ્સને ફોલો કરવા અને અંતિમ URL ની જાણ કરવી
- પ્રમાણિત (authenticated) વર્ડપ્રેસ REST API વિનંતીઓ કરવી
- પ્લેગ્રાઉન્ડ ફાઇલસિસ્ટમની અંદર ફાઇલો વાંચવી અને લખવી
- પ્લેગ્રાઉન્ડ સાઇટની અંદર PHP ચલાવવું
- પેજિસ માટે વિનંતી કરવી અને મળેલા પ્રતિસાદ (response) નું નિરીક્ષણ કરવું

<!--
This is especially useful when the task depends on the browser state: logged-in admin screens, settings pages, REST API requests, and redirects.
-->

જ્યારે કાર્ય બ્રાઉઝરની સ્થિતિ પર આધારિત હોય ત્યારે આ ખાસ કરીને ઉપયોગી છે: લૉગ-ઇન થયેલ એડમિન સ્ક્રીન્સ, સેટિંગ્સ પેજિસ, REST API વિનંતીઓ અને રીડાયરેક્ટ્સ.

<!--
## Good use cases for MCP
-->

## MCP માટે સારા ઉપયોગના કિસ્સાઓ (Good use cases for MCP)

<!--
Use MCP when you want an assistant to work with a visible, browser-managed WordPress site:
-->

જ્યારે તમે ઇચ્છતા હોવ કે સહાયક દૃશ્યમાન, બ્રાઉઝર-સંચાલિત વર્ડપ્રેસ સાઇટ સાથે કામ કરે ત્યારે MCP નો ઉપયોગ કરો:

<!--
- Guide you through a settings screen: "Show me how to configure this WooCommerce option."
- Create a browser-based demo: "Build a simple recipe page and show me the result."
- Build a block theme: "Create a block theme with a custom header and front-page template, activate it, and show me the result."
- Work with a persistent site: "Use my saved Playground site" or "Use the My WordPress site connected to my subscription."
- Reproduce a bug: "Follow these steps and summarize the error."
- Test a redirect or URL: "Open this page and tell me where the browser ends up."
- Inspect a running site: "Find the admin screen that matches this plugin feature."
-->

- સેટિંગ્સ સ્ક્રીન દ્વારા તમારું માર્ગદર્શન કરવું: "મને બતાવો કે આ WooCommerce વિકલ્પ કેવી રીતે ગોઠવવો."
- બ્રાઉઝર-આધારિત ડેમો બનાવવો: "એક સરળ રેસિપી પેજ બનાવો અને મને તેનું પરિણામ બતાવો."
- બ્લોક થીમ બનાવવી: "કસ્ટમ હેડર અને ફ્રન્ટ-પેજ ટેમ્પલેટ સાથે બ્લોક થીમ બનાવો, તેને સક્રિય કરો અને મને પરિણામ બતાવો."
- પર્સિસ્ટન્ટ સાઇટ સાથે કામ કરવું: "મારી સેવ કરેલી પ્લેગ્રાઉન્ડ સાઇટનો ઉપયોગ કરો" અથવા "મારા સબ્સ્ક્રિપ્શન સાથે જોડાયેલ My WordPress સાઇટનો ઉપયોગ કરો."
- ભૂલનું પુનરાવર્તન કરવું (Reproduce a bug): "આ પગલાં અનુસરો અને ભૂલનો સારાંશ આપો."
- રીડાયરેક્ટ અથવા URL નું પરીક્ષણ કરવું: "આ પેજ ખોલો અને મને કહો કે બ્રાઉઝર ક્યાં પહોંચે છે."
- ચાલતી સાઇટનું નિરીક્ષણ કરવું: "આ પ્લગઇન સુવિધા સાથે મેળ ખાતી એડમિન સ્ક્રીન શોધો."

<!--
MCP is less useful when the job is mostly local automation, such as running the same Blueprint repeatedly, mounting a plugin from your filesystem, or testing a version matrix. Use the Playground CLI for those workflows or [write tests using runCli](https://wordpress.github.io/wordpress-playground/guides/e2e-testing-with-playwright#first-test-file).
-->

જ્યારે કાર્ય મોટાભાગે લોકલ ઓટોમેશન હોય, જેમ કે એક જ બ્લુપ્રિન્ટને વારંવાર ચલાવવી, તમારી ફાઇલસિસ્ટમમાંથી પ્લગઇન માઉન્ટ કરવું, અથવા વર્ઝન મેટ્રિક્સનું પરીક્ષણ કરવું, ત્યારે MCP ઓછું ઉપયોગી છે. તે વર્કફ્લો માટે પ્લેગ્રાઉન્ડ CLI નો ઉપયોગ કરો અથવા [runCli નો ઉપયોગ કરીને ટેસ્ટ લખો](https://wordpress.github.io/wordpress-playground/guides/e2e-testing-with-playwright#first-test-file).

<!--
## Before you start
-->

## શરૂ કરતાં પહેલાં (Before you start)

<!--
You need:
-->

તમને જરૂર પડશે:

<!--
- Node.js and npm installed on the same computer as your browser, with `npx` available to your AI assistant
- An AI assistant or coding agent that supports local stdio MCP servers, configured using the [setup instructions below](#set-up-the-mcp-server)
-->

- તમારા બ્રાઉઝરની જેમ જ કમ્પ્યુટર પર Node.js અને npm ઇન્સ્ટોલ કરેલા હોવા જોઈએ, જેમાં તમારા AI સહાયક માટે `npx` ઉપલબ્ધ હોય
- એક AI સહાયક અથવા કોડિંગ એજન્ટ કે જે લોકલ stdio MCP સર્વર્સને સપોર્ટ કરે છે, જેને [નીચે આપેલ સેટઅપ સૂચનાઓ](#set-up-the-mcp-server) નો ઉપયોગ કરીને ગોઠવેલ હોય

<!--
You do not need to open Playground or create a site beforehand. During connection, your assistant provides the Playground URL to open in your browser. The default URL starts a temporary site you can use for testing.
-->

તમારે પહેલાથી પ્લેગ્રાઉન્ડ ખોલવાની કે સાઇટ બનાવવાની જરૂર નથી. કનેક્શન દરમિયાન, તમારો સહાયક તમારા બ્રાઉઝરમાં ખોલવા માટે પ્લેગ્રાઉન્ડ URL પ્રદાન કરે છે. ડિફૉલ્ટ URL એક અસ્થાયી (temporary) સાઇટ શરૂ કરે છે જેનો ઉપયોગ તમે પરીક્ષણ માટે કરી શકો છો.

<!--
<div class="callout callout-tip">

**Save important demos first**

If you are preparing a demo, ask your assistant to save the current Playground site to browser storage before making many changes. Saved Playgrounds can be reopened from the Playground Launch Panel.

</div>
-->

<div class="callout callout-tip">

**મહત્વપૂર્ણ ડેમો પહેલા સેવ કરો**

જો તમે ડેમો તૈયાર કરી રહ્યા હોવ, તો ઘણા ફેરફારો કરતાં પહેલાં તમારા સહાયકને વર્તમાન પ્લેગ્રાઉન્ડ સાઇટને બ્રાઉઝર સ્ટોરેજમાં સેવ કરવા કહો. સેવ કરેલા પ્લેગ્રાઉન્ડ્સ પ્લેગ્રાઉન્ડ લૉન્ચ પેનલમાંથી ફરીથી ખોલી શકાય છે.

</div>

<!--
<div class="callout callout-warning">

**Confirm which site the assistant is using**

You can have multiple Playground sites and multiple connected browser tabs. You can also connect more than one server or browser automation tool to the same assistant. That flexibility is useful, but it can get confusing. Before making changes, ask the assistant to list the connected sites and confirm the active site name.

</div>
-->

<div class="callout callout-warning">

**ખાતરી કરો કે સહાયક કઈ સાઇટનો ઉપયોગ કરી રહ્યો છે**

તમારી પાસે બહુવિધ પ્લેગ્રાઉન્ડ સાઇટ્સ અને બહુવિધ કનેક્ટેડ બ્રાઉઝર ટેબ્સ હોઈ શકે છે. તમે એક જ સહાયક સાથે એક કરતાં વધુ સર્વર અથવા બ્રાઉઝર ઓટોમેશન ટૂલ્સ પણ કનેક્ટ કરી શકો છો. આ સુગમતા ઉપયોગી છે, પરંતુ તે ગૂંચવણભરી બની શકે છે. ફેરફારો કરતાં પહેલાં, સહાયકને કનેક્ટેડ સાઇટ્સની સૂચિ આપવા અને સક્રિય સાઇટના નામની પુષ્ટિ કરવા કહો.

</div>

<!--
## Set up the MCP server
-->

## MCP સર્વર સેટ કરો {#set-up-the-mcp-server}

<!--
Choose the configuration for your AI assistant. The assistant starts `@wp-playground/mcp` as a local process and communicates with it over stdio.
-->

તમારા AI સહાયક માટે યોગ્ય રૂપરેખાંકન (configuration) પસંદ કરો. સહાયક `@wp-playground/mcp` ને લોકલ પ્રોસેસ તરીકે શરૂ કરે છે અને stdio દ્વારા તેની સાથે સંચાર કરે છે.

<!--
### Claude Code
-->

### Claude Code

<!--
Run this command in your terminal:
-->

તમારા ટર્મિનલમાં આ આદેશ (command) ચલાવો:

```bash
claude mcp add --transport stdio --scope user wordpress-playground -- npx -y @wp-playground/mcp
```

<!--
Use `--scope user` to make the server available across your projects, or `--scope local` for the current project only.
-->

સર્વરને તમારા બધા પ્રોજેક્ટ્સમાં ઉપલબ્ધ કરાવવા માટે `--scope user` નો ઉપયોગ કરો, અથવા ફક્ત વર્તમાન પ્રોજેક્ટ માટે `--scope local` નો ઉપયોગ કરો.

<!--
### Codex
-->

### Codex

<!--
Run this command in your terminal:
-->

તમારા ટર્મિનલમાં આ આદેશ ચલાવો:

```bash
codex mcp add wordpress-playground -- npx -y @wp-playground/mcp
```

<!--
### JSON configuration
-->

### JSON કન્ફિગરેશન (JSON configuration)

<!--
For Claude Code, add the following to `.mcp.json` in your project. For Claude Desktop, add it to `claude_desktop_config.json`. If the file already has an `mcpServers` object, add the `wordpress-playground` entry to it.
-->

Claude Code માટે, તમારા પ્રોજેક્ટમાં `.mcp.json` માં નીચે આપેલ વિગત ઉમેરો. Claude Desktop માટે, તેને `claude_desktop_config.json` માં ઉમેરો. જો ફાઇલમાં પહેલેથી જ `mcpServers` ઑબ્જેક્ટ હોય, તો તેમાં `wordpress-playground` એન્ટ્રી ઉમેરો.

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

<!--
After saving the configuration, restart your assistant if needed to load the server, then follow the connection steps below. You do not need to start the MCP server separately.
-->

કન્ફિગરેશન સેવ કર્યા પછી, સર્વર લોડ કરવા માટે જો જરૂર હોય તો તમારા સહાયકને પુનઃપ્રારંભ (restart) કરો, પછી નીચેના કનેક્શન પગલાં અનુસરો. તમારે MCP સર્વરને અલગથી શરૂ કરવાની જરૂર નથી.

<!--
## Connect an AI assistant to the Playground MCP
-->

## AI સહાયકને પ્લેગ્રાઉન્ડ MCP સાથે કનેક્ટ કરો

<!--
1. Open your AI assistant.
2. Ask it to connect to WordPress Playground:

    ```text
    Open WordPress Playground and connect it to the MCP server.
    ```

3. The assistant should provide or open a Playground URL that includes an `mcp-port` parameter.
4. Open that URL in your browser if the assistant does not open it automatically.
5. Ask the assistant to list the available Playground sites:

    ```text
    List my available Playground sites and tell me which one is active.
    ```

6. Choose the Playground site you want to use:

    ```text
    Use my saved WooCommerce demo site and open the WordPress admin dashboard.
    ```
-->

1. તમારો AI સહાયક ખોલો.
2. તેને વર્ડપ્રેસ પ્લેગ્રાઉન્ડ સાથે કનેક્ટ થવા માટે કહો:

    ```text
    Open WordPress Playground and connect it to the MCP server.
    ```

3. સહાયકે પ્લેગ્રાઉન્ડ URL પ્રદાન કરવું જોઈએ અથવા ખોલવું જોઈએ જેમાં `mcp-port` પેરામીટર શામેલ હોય.
4. જો સહાયક તેને આપમેળે ન ખોલે તો તમારા બ્રાઉઝરમાં તે URL ખોલો.
5. સહાયકને ઉપલબ્ધ પ્લેગ્રાઉન્ડ સાઇટ્સની સૂચિ આપવા માટે કહો:

    ```text
    List my available Playground sites and tell me which one is active.
    ```

6. તમે જે પ્લેગ્રાઉન્ડ સાઇટનો ઉપયોગ કરવા માંગો છો તે પસંદ કરો:

    ```text
    Use my saved WooCommerce demo site and open the WordPress admin dashboard.
    ```

<!--
If the assistant says no browser tab is connected, open the MCP Playground URL it provides and try again.
-->

જો સહાયક કહે કે કોઈ બ્રાઉઝર ટેબ કનેક્ટેડ નથી, તો તેણે આપેલ MCP પ્લેગ્રાઉન્ડ URL ખોલો અને ફરી પ્રયાસ કરો.

<!--
## MCP vs CLI
-->

## MCP વિરુદ્ધ CLI (MCP vs CLI)

<!--
WordPress Playground has two complementary products: the Playground website and the Playground CLI. The website is the browser experience at [playground.wordpress.net](https://playground.wordpress.net/). The CLI is the local environment for development, scripting, and CI workflows.
-->

વર્ડપ્રેસ પ્લેગ્રાઉન્ડ પાસે બે પૂરક પ્રોડક્ટ્સ છે: પ્લેગ્રાઉન્ડ વેબસાઇટ અને પ્લેગ્રાઉન્ડ CLI. વેબસાઇટ એ [playground.wordpress.net](https://playground.wordpress.net/) પરનો બ્રાઉઝર અનુભવ છે. CLI એ ડેવલપમેન્ટ, સ્ક્રિપ્ટીંગ અને CI વર્કફ્લો માટેનું લોકલ એન્વાયરનમેન્ટ છે.

<!--
The choice depends on what you want the AI assistant to control.
-->

પસંદગી એ બાબત પર આધાર રાખે છે કે તમે AI સહાયક પાસે શું નિયંત્રિત કરાવવા માંગો છો.

<!--
With MCP, the assistant can make authenticated WordPress REST API requests to the connected site without manually configuring authentication. It can also use the `playground_navigate` tool to change the page displayed in the browser and report the final URL after redirects.
-->

MCP સાથે, સહાયક પ્રમાણીકરણ (authentication) ને મેન્યુઅલી ગોઠવ્યા વિના કનેક્ટેડ સાઇટ પર પ્રમાણિત વર્ડપ્રેસ REST API વિનંતીઓ કરી શકે છે. તે બ્રાઉઝરમાં પ્રદર્શિત પેજને બદલવા અને રીડાયરેક્ટ્સ પછી અંતિમ URL ની જાણ કરવા માટે `playground_navigate` ટૂલનો ઉપયોગ પણ કરી શકે છે.

<!--
From the CLI, comparable HTTP requests usually require a tool such as `curl` and are unauthenticated unless you configure authentication yourself. The CLI also does not control the page displayed in a user's browser.
-->

CLI માંથી, સમાન HTTP વિનંતીઓ માટે સામાન્ય રીતે `curl` જેવા સાધનની જરૂર પડે છે અને જ્યાં સુધી તમે જાતે પ્રમાણીકરણ ગોઠવો નહીં ત્યાં સુધી તે અનઅધિકૃત (unauthenticated) હોય છે. ઉપરાંત, CLI વપરાશકર્તાના બ્રાઉઝરમાં પ્રદર્શિત પેજને નિયંત્રિત કરતું નથી.
