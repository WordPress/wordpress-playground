---
slug: /contributing/contributor-day
---

# WordCamp Contributor Day

Ang [WordPress Playground VS Code extension](https://marketplace.visualstudio.com/items?itemName=WordPressPlayground.wordpress-playground) at ang [wp-now](https://www.npmjs.com/package/@wp-now/wp-now) ay nagpapadali sa proseso ng pag-set up ng lokal na WordPress environment. Pinapagana ng WordPress Playground pareho—hindi kailangan ng Docker, MySQL, o Apache.

Patuloy na basahin upang matutunan kung paano gamitin ang mga tool na ito para sa [local development](/developers/local-development/wp-now) kapag nag-aambag sa WordPress. Pansinin na ang extension at ang NPM package ay nasa development pa, at hindi pa fully supported ang lahat ng [Make WordPress teams](https://make.wordpress.org/).

## Pagsisimula

Para sa visual na nag-aaral, narito ang step-by-step na video tutorial. Kung mas gusto mong magbasa sa sarili mong bilis, lumaktaw sa nakasulat na gabay sa ibaba.

<iframe title="Getting Started with wp-now for WordPress development at Contributor Day" width="752" height="423" src="https://video.wordpress.com/embed/Gn7XOCAM?cover=1&amp;preloadContent=metadata&amp;useAverageColor=1&amp;hd=1&amp;metadata_token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJ3b3JkcHJlc3MuY29tIiwiaWF0IjoxNjg2MTQ4ODQ5LCJleHAiOjE2ODYzMjE2NDksImJsb2dfaWQiOiIyMDMxMjIxMTIiLCJndWlkIjoiR243WE9DQU0iLCJhdXRoIjoidmlkZW9wcmVzc19wbGF5YmFja190b2tlbiIsImFjY2VzcyI6InZpZGVvIiwiZXhwaXJlcyI6MTY4NjMyMTY0OX0.DJWVfePHl2nUKo8ziG81CK2VlG5Ui8vNg-dZJ7dOSq8" allow="fullscreen" loading="eager"></iframe>

### VS Code Playground extension

Ang [Visual Studio Code Playground extension](https://marketplace.visualstudio.com/items?itemName=WordPressPlayground.wordpress-playground) ay isang friendly na zero-setup development environment.

1. Buksan ang VS Code at pumunta sa tab na **Extensions** (**View > Extensions**).
2. Sa search bar, i-type ang _WordPress Playground_ at i-click ang **Install**.
3. Para makipag-ugnayan sa Playground, i-click ang bagong icon sa **Activity Bar** at pindutin ang button na **Start WordPress Server**.
4. Magbubukas ang isang bagong tab sa iyong browser sa loob ng ilang segundo.

### wp-now NPM package

Ang `@wp-now/wp-now` ay isang CLI tool na nagpapahintulot sa iyo na mag-spin up ng WordPress site gamit ang isang utos lamang. Hindi kailangan ang Docker, MySQL, o Apache.

#### Mga Kinakailangan

Nangangailangan ang `wp-now` ng Node.js at NPM. Kung hindi mo pa nai-install, [i-download at i-install](https://nodejs.org/en/download) muna pareho bago magsimula.

Depende sa Make WordPress team na iyong inaambagan, maaaring kailanganin mong gumamit ng ibang bersyon ng Node.js kaysa sa naka-install mo. Maaari mong gamitin ang Node Version Manager (NVM) upang magpalit ng bersyon. [Sundin ang installation guide dito](https://github.com/nvm-sh/nvm#installing-and-updating).

#### Patakbuhin ang wp-now

Hindi mo kailangang i-install ang `wp-now` globally para magamit ito. Pumunta sa direktoryo ng iyong plugin o theme at patakbuhin ang `wp-now` gamit ang mga sumusunod na utos:

```bash
cd my-plugin-or-theme-directory
npx @wp-now/wp-now start
```

## Mga Ideya para sa mga Kontribyutor

### Gumawa ng Gutenberg Pull Request (PR)

1. I-fork ang [Gutenberg repository](https://github.com/WordPress/gutenberg) sa iyong GitHub account.
2. I-clone ang forked repository para ma-download ang mga file.
3. I-install ang mga kinakailangang dependencies at i-build ang code sa development mode.

```bash
git clone git@github.com:WordPress/gutenberg.git
cd gutenberg
npm install
npm run dev
```

:::info

Kung hindi ka sigurado sa mga hakbang sa itaas, bisitahin ang opisyal na [Gutenberg Project Contributor Guide](https://developer.wordpress.org/block-editor/contributors/). Tandaan na sa pagkakataong ito, papalitan ng `wp-now` ang `wp-env`.

:::

Magbukas ng bagong terminal tab, pumunta sa Gutenberg directory, at simulan ang WordPress gamit ang `wp-now`:

```bash
cd gutenberg
npx @wp-now/wp-now start
```

Kapag handa ka na, i-commit at i-push ang iyong mga pagbabago sa iyong forked repository sa GitHub at magbukas ng Pull Request sa Gutenberg repository.

### Subukan ang isang Gutenberg PR

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
npx @wp-now/wp-now start
```

#### Subukan ang isang Gutenberg PR gamit ang Playground sa browser

Hindi mo kailangan ng lokal na development environment para subukan ang mga Gutenberg PR—gamitin ang Playground para gawin ito nang direkta sa browser.

1. Kopyahin ang ID ng PR na nais mong subukan (pumili mula sa [listahan ng open Pull Requests](https://github.com/WordPress/gutenberg/pulls)).
2. Buksan ang [Gutenberg PR Previewer](https://playground.wordpress.net/gutenberg.html) ng Playground at i-paste ang kinopyang ID.
3. Kapag na-click mo ang **Go**, susuriin ng Playground kung valid ang PR at magbubukas ng bagong tab na may kaugnay na PR, na nagpapahintulot sa iyong i-review ang mga iminungkahing pagbabago.

## Isalin ang mga WordPress Plugin gamit ang Playground sa browser

Maaari mong isalin ang suportadong mga WordPress Plugin sa pamamagitan ng pag-load ng plugin na nais mong isalin at paggamit ng Inline Translation. Kung idinagdag ng mga developer ng plugin ang opsyon, makikita mo ang **Translate Live** link sa itaas na kanang toolbar ng view ng pagsasalin. Maaari mong basahin ang tungkol sa kapanapanabik na bagong opsyon na ito sa [Polyglots blog post na ito](https://make.wordpress.org/polyglots/2023/05/08/translate-live-updates-to-the-translation-playground/).

## Humingi ng Tulong at Mag-ambag sa WordPress Playground

May tanong o ideya para sa bagong feature? Nakakita ng bug? May hindi gumana ayon sa inaasahan? Narito kami upang tumulong:

-   Sa Contributor Day, maaari mo kaming maabot sa **Playground table**.
-   Magbukas ng isyu sa [WordPress Playground GitHub repository](https://github.com/WordPress/wordpress-playground/issues/new). Kung naka-focus ka sa VS Code extension, NPM package, o mga plugin, magbukas ng isyu sa [Playground Tools repository](https://github.com/WordPress/playground-tools/issues/new).
-   Ibahagi ang iyong feedback sa [**#meta-playground** Slack channel](https://wordpress.slack.com/archives/C04EWKGDJ0K).
