---
slug: /contributing/contributor-day
title: WordCamp Contributor Day
description: Gabay kung paano mag-ambag sa WordPress Playground, at kung paano ka nito matutulungan sa Contributor Day.
---

<!--
# WordCamp Contributor Day
-->

# WordCamp Contributor Day

<!--
WordCamp Contributor Day is an event where the WordPress community comes together to contribute to the WordPress project. This guide focuses on how you can contribute to the WordPress Playground project or how the Playground can assist you in contributing to WordPress Core.
-->

Ang WordCamp Contributor Day ay isang event kung saan nagsasama-sama ang komunidad ng WordPress para mag-ambag sa proyektong WordPress. Nakatuon ang gabay na ito sa kung paano ka makapag-aambag sa proyektong WordPress Playground, o kung paano ka matutulungan ng Playground sa pag-aambag sa WordPress Core.

<!--
## Who Can Contribute?
-->

## Sino ang Maaaring Mag-ambag?

<!--
Some events will have a dedicated table for the project. The WordPress Playground contributor tables welcome all kinds of contributions, not just from developers. Whether you are a writer, coder, tester, plugin or theme developer, marketer, site owner, or any other type of user, you are encouraged to contribute.
-->

May ilang event na may dedicated table para sa proyekto. Malugod na tinatanggap ng WordPress Playground contributor table ang lahat ng uri ng kontribusyon, hindi lang mula sa mga developer. Kung ikaw ay writer, coder, tester, plugin o theme developer, marketer, site owner, o anupamang uri ng user, hinihikayat kang mag-ambag.

<!--
We value diverse contributions across various areas, including community building, testing, documentation, and design.
-->

Pinahahalagahan namin ang iba't ibang kontribusyon sa maraming larangan, kabilang ang community building, testing, dokumentasyon, at disenyo.

<!--
## How to Contribute to the Playground Project
-->

## Paano Mag-ambag sa Proyektong Playground

<!--
This section outlines how you can contribute directly to the WordPress Playground project and its associated tools:
-->

Binabalangkas ng seksyon na ito kung paano ka direktang makapag-aambag sa proyektong WordPress Playground at sa mga kaugnay nitong tool:

<!--
- **Documentation:** Enhance our documentation by improving existing content, developing new guides, or translating materials into different languages.
- **Blueprints:** Create plugin demos for plugins at the WordPress Plugin repository, or develop new Blueprints to enrich our project documentation.
- **Testing the Playground Environment:** Engage in testing the WordPress Playground project itself. You can do this by carefully crafting new issues that describe problems you encounter and suggesting actionable solutions. Test our WordPress web instance (the playground.wordpress.net site), or explore the various applications powered by Playground. Test these tools, observe their functionality, and provide detailed feedback.
- **Product Feedback:** Your insights are invaluable for improving the Playground experience. This includes general feedback on the web instance, the application, and any server-side tools.
-->

- **Dokumentasyon:** Pagandahin ang aming dokumentasyon sa pamamagitan ng pagpapabuti ng umiiral na content, paggawa ng bagong gabay, o pagsasalin ng materyales sa iba't ibang wika.
- **Blueprints:** Gumawa ng plugin demo para sa mga plugin sa WordPress Plugin repository, o mag-develop ng bagong Blueprint para pagyamanin ang dokumentasyon ng proyekto.
- **Pagsubok sa Playground Environment:** Makilahok sa pagsubok sa mismong proyektong WordPress Playground. Magagawa mo ito sa pamamagitan ng maingat na paggawa ng bagong isyu na naglalarawan sa mga problemang naranasan mo at nagmumungkahi ng actionable na solusyon. Subukan ang aming WordPress web instance (ang site na playground.wordpress.net), o tuklasin ang iba't ibang application na pinapagana ng Playground. Subukan ang mga tool na ito, obserbahan ang kanilang functionality, at magbigay ng detalyadong feedback.
- **Product Feedback:** Napakahalaga ng iyong insight para mapabuti ang Playground experience. Kasama rito ang pangkalahatang feedback sa web instance, sa application, at sa anumang server-side tool.

<!--
All feedback, including reported issues and test results, can be submitted through our GitHub repository.
-->

Ang lahat ng feedback, kabilang ang naiulat na isyu at test result, ay maaaring isumite sa aming GitHub repository.

<!--
### Follow-up and Continued Engagement
-->

### Follow-up at Patuloy na Pakikilahok

<!--
While many tasks are completed during the event, your contribution journey doesn't have to end there. You are welcome to continue working on your issues or pull requests after Contributor Day. We anticipate ongoing activity from contributors who take on tasks beyond the event. Please note that if a pull request shows no activity for one month, it may be considered abandoned and subsequently closed.
-->

Maraming gawain ang natatapos sa event, ngunit hindi kailangang doon magtapos ang iyong pag-aambag. Malugod kang inaanyayahan na ipagpatuloy ang trabaho sa iyong isyu o pull request pagkatapos ng Contributor Day. Inaasahan namin ang patuloy na aktibidad mula sa mga kontribyutor na tumatanggap ng gawain lampas sa event. Pakitandaan na kung walang aktibidad ang isang pull request sa loob ng isang buwan, maaari itong ituring na abandoned at isara.

<!--
### Getting Help and Staying Engaged
-->

### Paghingi ng Tulong at Pananatiling Aktibo

<!--
During Contributor Day, you can find direct assistance and interact with us at the dedicated Playground table. For continuous support and community interaction, you can connect with us on the `#playground` channel on WordPress Slack or via GitHub.
-->

Sa Contributor Day, maaari kang humingi ng tuwirang tulong at makipag-ugnayan sa amin sa dedicated Playground table. Para sa tuloy-tuloy na support at community interaction, makakabit ka sa amin sa `#playground` channel sa WordPress Slack o sa GitHub.

<!--
## How to use Playground at Contributor Day
-->

## Paano gamitin ang Playground sa Contributor Day

<!--
Now we are going to cover how the Playground can assist you during the Contributor Day. The [WordPress Playground VS Code extension](https://marketplace.visualstudio.com/items?itemName=WordPressPlayground.wordpress-playground) and [@wp-playground/cli](https://www.npmjs.com/package/@wp-playground/cli) streamline the process of setting up a local WordPress environment. WordPress Playground powers both—no Docker, MySQL, or Apache required.
-->

Ngayon, tatalakayin namin kung paano ka matutulungan ng Playground sa Contributor Day. Ang [WordPress Playground VS Code extension](https://marketplace.visualstudio.com/items?itemName=WordPressPlayground.wordpress-playground) at ang [@wp-playground/cli](https://www.npmjs.com/package/@wp-playground/cli) ay nagpapadali sa proseso ng pag-set up ng lokal na WordPress environment. Pinapagana ng WordPress Playground ang pareho—hindi kailangan ng Docker, MySQL, o Apache.

<!--
Keep reading to learn how to use these tools for [local development](/developers/local-development/wp-playground-cli) when contributing to WordPress. Please note that the extension and the NPM package are under development, and not all [Make WordPress teams](https://make.wordpress.org/) are fully supported.
-->

Patuloy na basahin upang matutunan kung paano gamitin ang mga tool na ito para sa [local development](/developers/local-development/wp-playground-cli) kapag nag-aambag sa WordPress. Pansinin na ang extension at ang NPM package ay nasa development pa, at hindi pa fully supported ang lahat ng [Make WordPress teams](https://make.wordpress.org/).

<!--
## Getting Started
-->

## Pagsisimula

<!--
### VS Code Playground extension
-->

### VS Code Playground extension

<!--
The [Visual Studio Code Playground extension](https://marketplace.visualstudio.com/items?itemName=WordPressPlayground.wordpress-playground) is a friendly zero-setup development environment.
-->

Ang [Visual Studio Code Playground extension](https://marketplace.visualstudio.com/items?itemName=WordPressPlayground.wordpress-playground) ay isang friendly na zero-setup development environment.

<!--
1. Open VS Code and navigate to the **Extensions** tab (**View > Extensions**).
2. In the search bar, type _WordPress Playground_ and click **Install**.
3. To interact with Playground, click the new icon in the **Activity Bar** and hit the **Start WordPress Server** button.
4. A new tab will open in your browser within seconds.
-->

1. Buksan ang VS Code at pumunta sa tab na **Extensions** (**View > Extensions**).
2. Sa search bar, i-type ang _WordPress Playground_ at i-click ang **Install**.
3. Para makipag-ugnayan sa Playground, i-click ang bagong icon sa **Activity Bar** at pindutin ang button na **Start WordPress Server**.
4. Magbubukas ang isang bagong tab sa iyong browser sa loob ng ilang segundo.

<!--
### @wp-playground/cli NPM package
-->

### @wp-playground/cli NPM package

<!--
[`@wp-playground/cli`](/developers/local-development/wp-playground-cli) is a CLI tool that allows you to spin up a WordPress site with a single command. No Docker, MySQL, or Apache are required.
-->

Ang [`@wp-playground/cli`](/developers/local-development/wp-playground-cli) ay isang CLI tool na nagpapahintulot sa iyo na mag-spin up ng WordPress site gamit ang isang utos lamang. Hindi kailangan ang Docker, MySQL, o Apache.

<!--
#### Prerequisites
-->

#### Mga Kinakailangan

<!--
`@wp-playground/cli` requires Node.js 20.18 or newer and NPM. If you haven’t yet, [download and install](https://nodejs.org/en/download) both before you begin.
-->

Nangangailangan ang `@wp-playground/cli` ng Node.js 20.18 o mas bago at NPM. Kung hindi mo pa nai-install, [i-download at i-install](https://nodejs.org/en/download) muna pareho bago magsimula.

<!--
Depending on the Make WordPress team you contribute to, you may need a different Node.js version than the one you have installed. You can use Node Version Manager (NVM) to switch between versions. [Find the installation guide here](https://github.com/nvm-sh/nvm#installing-and-updating).
-->

Depende sa Make WordPress team na iyong inaambagan, maaaring kailanganin mong gumamit ng ibang bersyon ng Node.js kaysa sa naka-install mo. Maaari mong gamitin ang Node Version Manager (NVM) upang magpalit ng bersyon. [Sundin ang installation guide dito](https://github.com/nvm-sh/nvm#installing-and-updating).

<!--
#### Running `@wp-playground/cli`
-->

#### Pagpapatakbo ng `@wp-playground/cli`

<!--
You don’t have to install `@wp-playground/cli` on your device to use it. Navigate to your plugin or theme directory and start `@wp-playground/cli` with the following commands:
-->

Hindi mo kailangang i-install ang `@wp-playground/cli` sa iyong device para magamit ito. Pumunta sa direktoryo ng iyong plugin o theme at simulan ang `@wp-playground/cli` gamit ang mga sumusunod na utos:

```bash
cd my-plugin-or-theme-directory
npx @wp-playground/cli@latest server --auto-mount
```

<!--
## Ideas for contributors
-->

## Mga Ideya para sa mga Kontribyutor

<!--
### Create a Gutenberg Pull Request (PR)
-->

### Gumawa ng Gutenberg Pull Request (PR)

<!--
1. Fork the [Gutenberg repository](https://github.com/WordPress/gutenberg) in your GitHub account.
2. Then, clone the forked repository to download the files.
3. Install the necessary dependencies and build the code in development mode.
-->

1. I-fork ang [Gutenberg repository](https://github.com/WordPress/gutenberg) sa iyong GitHub account.
2. I-clone ang forked repository para ma-download ang mga file.
3. I-install ang mga kinakailangang dependencies at i-build ang code sa development mode.

```bash
git clone git@github.com:WordPress/gutenberg.git
cd gutenberg
npm install
npm run dev
```

<!--
<div class="callout callout-info">

If you’re unsure about the steps listed above, visit the official [Gutenberg Project Contributor Guide](https://developer.wordpress.org/block-editor/contributors/). Note that in this case, `@wp-playground/cli` replaces `wp-env`.

</div>
-->

<div class="callout callout-info">

Kung hindi ka sigurado sa mga hakbang sa itaas, bisitahin ang opisyal na [Gutenberg Project Contributor Guide](https://developer.wordpress.org/block-editor/contributors/). Tandaan na sa pagkakataong ito, papalitan ng `@wp-playground/cli` ang `wp-env`.

</div>

<!--
Open a new terminal terminal tab, navigate to the Gutenberg directory, and start WordPress using `@wp-playground/cli`:
-->

Magbukas ng bagong terminal tab, pumunta sa Gutenberg directory, at simulan ang WordPress gamit ang `@wp-playground/cli`:

```bash
cd gutenberg
npx @wp-playground/cli@latest server --auto-mount
```

<!--
When you’re ready, commit and push your changes to your forked repository on GitHub and open a Pull Request on the Gutenberg repository.
-->

Kapag handa ka na, i-commit at i-push ang iyong mga pagbabago sa iyong forked repository sa GitHub at magbukas ng Pull Request sa Gutenberg repository.

<!--
### Test a Gutenberg PR
-->

### Subukan ang isang Gutenberg PR

<!--
1. To test other Gutenberg PRs, checkout the branch associated with it.
2. Pull the latest changes to ensure your local copy is up to date.
3. Next, install the necessary dependencies, ensuring your testing environment matches the latest changes.
4. Finally, build the code in development mode.
-->

1. Para subukan ang ibang Gutenberg PR, i-checkout ang branch na kaugnay nito.
2. I-pull ang pinakabagong mga pagbabago upang siguraduhing up to date ang lokal mong kopya.
3. Susunod, i-install ang mga kinakailangang dependencies, siguraduhing tugma ang testing environment sa pinakabagong mga pagbabago.
4. Sa wakas, i-build ang code sa development mode.

```bash
# kopyahin ang branch-name mula sa GitHub #
git checkout branch-name
git pull
npm install
npm run dev

# Sa ibang terminal sa loob ng Gutenberg directory *
npx @wp-playground/cli@latest server --auto-mount
```

<!--
#### Test a Gutenberg PR with Playground in the browser
-->

#### Subukan ang isang Gutenberg PR gamit ang Playground sa browser

<!--
You don’t need a [local development environment](/developers/local-development/) to test Gutenberg PRs—use Playground to do it directly in the browser.
-->

Hindi mo kailangan ng [lokal na development environment](/developers/local-development/) para subukan ang mga Gutenberg PR—gamitin ang Playground para gawin ito nang direkta sa browser.

<!--
1. Copy the ID of the PR you’d like to test (pick one from the [list of open Pull Requests](https://github.com/WordPress/gutenberg/pulls)).
2. Open Playground’s [Gutenberg PR Previewer](https://playground.wordpress.net/gutenberg.html) and paste the ID you copied.
3. Once you click **Go**, Playground will verify the PR is valid and open a new tab with the relevant PR, allowing you to review the proposed changes.
-->

1. Kopyahin ang ID ng PR na nais mong subukan (pumili mula sa [listahan ng open Pull Requests](https://github.com/WordPress/gutenberg/pulls)).
2. Buksan ang [Gutenberg PR Previewer](https://playground.wordpress.net/gutenberg.html) ng Playground at i-paste ang kinopyang ID.
3. Kapag na-click mo ang **Go**, susuriin ng Playground kung valid ang PR at magbubukas ng bagong tab na may kaugnay na PR, na nagpapahintulot sa iyong i-review ang mga iminungkahing pagbabago.

<!--
## Translate WordPress Plugins with Playground in the browser
-->

## Isalin ang mga WordPress Plugin gamit ang Playground sa browser

<!--
You can translate supported WordPress Plugins by loading the plugin you want to translate and use Inline Translation. If the plugin developers have added the option, you'll find the **Translate Live** link on the top right toolbar of the translation view. You can read more about this exciting new option on [this Polyglots blog post](https://make.wordpress.org/polyglots/2023/05/08/translate-live-updates-to-the-translation-playground/).
-->

Maaari mong isalin ang suportadong mga WordPress Plugin sa pamamagitan ng pag-load ng plugin na nais mong isalin at paggamit ng Inline Translation. Kung idinagdag ng mga developer ng plugin ang opsyon, makikita mo ang **Translate Live** link sa itaas na kanang toolbar ng view ng pagsasalin. Maaari mong basahin ang tungkol sa kapanapanabik na bagong opsyon na ito sa [Polyglots blog post na ito](https://make.wordpress.org/polyglots/2023/05/08/translate-live-updates-to-the-translation-playground/).

<!--
## Get help and contribute to WordPress Playground
-->

## Humingi ng Tulong at Mag-ambag sa WordPress Playground

<!--
Have a question or an idea for a new feature? Found a bug? Something’s not working as expected? We’re here to help:
-->

May tanong o ideya para sa bagong feature? Nakakita ng bug? May hindi gumana ayon sa inaasahan? Narito kami upang tumulong:

<!--
- During Contributor Day, you can reach us at the **Playground table**.
- Open an issue on the [WordPress Playground GitHub repository](https://github.com/WordPress/wordpress-playground/issues/new). If your focus is the VS Code extension, NPM package, or the plugins, open an issue on the [Playground Tools repository](https://github.com/WordPress/playground-tools/issues/new).
- Share your feedback on the [**#playground** Slack channel](https://wordpress.slack.com/archives/C04EWKGDJ0K).
-->

- Sa Contributor Day, maaari mo kaming maabot sa **Playground table**.
- Magbukas ng isyu sa [WordPress Playground GitHub repository](https://github.com/WordPress/wordpress-playground/issues/new). Kung naka-focus ka sa VS Code extension, NPM package, o mga plugin, magbukas ng isyu sa [Playground Tools repository](https://github.com/WordPress/playground-tools/issues/new).
- Ibahagi ang iyong feedback sa [**#playground** Slack channel](https://wordpress.slack.com/archives/C04EWKGDJ0K).
