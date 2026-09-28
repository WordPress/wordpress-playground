---
slug: /contributing/releases
title: પેકેજો રિલીઝ કરવા
description: પ્લેગ્રાઉન્ડ પેકેજો npm પર કેવી રીતે રિલીઝ કરવામાં આવે છે, અને નવા પેકેજો ઉમેરતી વખતે શું કરવું તે અંગેની માહિતી.
---

<!--
# Releasing packages
-->

# પેકેજો રિલીઝ કરવા

<!--
Playground publishes its packages to npm using automated CI workflows. This page explains how the release process works and what you need to know when adding new packages.
-->

પ્લેગ્રાઉન્ડ તેના પેકેજોને ઓટોમેટેડ CI વર્કફ્લોનો ઉપયોગ કરીને npm પર પ્રકાશિત કરે છે. આ પેજ સમજાવે છે કે રિલીઝ પ્રક્રિયા કેવી રીતે કાર્ય કરે છે અને નવા પેકેજો ઉમેરતી વખતે તમારે શું જાણવાની જરૂર છે.

<!--
## Automated releases
-->

## ઓટોમેટેડ રિલીઝ

<!--
The npm packages are published automatically every Monday via GitHub Actions, or manually by maintainers using the workflow dispatch. The workflow bumps versions using [Lerna](https://lerna.js.org/), tags the release, and publishes all public packages to npm.
-->

npm પેકેજો દર સોમવારે GitHub Actions દ્વારા આપમેળે પ્રકાશિત થાય છે, અથવા મેન્ટેનર્સ દ્વારા વર્કફ્લો ડિસ્પેચ (workflow dispatch) નો ઉપયોગ કરીને મેન્યુઅલી પ્રકાશિત કરવામાં આવે છે. આ વર્કફ્લો [Lerna](https://lerna.js.org/) નો ઉપયોગ કરીને વર્ઝન અપડેટ કરે છે, રિલીઝને ટેગ કરે છે અને તમામ સાર્વજનિક પેકેજોને npm પર પ્રકાશિત કરે છે.

<!--
The CI authenticates with npm using [OpenID Connect (OIDC) trusted publishing](https://docs.npmjs.com/generating-provenance-statements#publishing-packages-with-provenance-via-github-actions). This is more secure than using long-lived npm tokens because it generates short-lived credentials for each workflow run and ties package provenance directly to the GitHub repository.
-->

CI એ [OpenID Connect (OIDC) ટ્રસ્ટેડ પબ્લિશિંગ](https://docs.npmjs.com/generating-provenance-statements#publishing-packages-with-provenance-via-github-actions) નો ઉપયોગ કરીને npm સાથે ઓથેન્ટિકેટ થાય છે. લાંબા ગાળાના npm ટોકન્સનો ઉપયોગ કરવા કરતાં આ વધુ સુરક્ષિત છે કારણ કે તે દરેક વર્કફ્લો રન માટે ટૂંકા ગાળાના ક્રેડેન્શિયલ્સ જનરેટ કરે છે અને પેકેજ પ્રોવેનન્સ (provenance) ને સીધું GitHub રિપોઝિટરી સાથે જોડે છે.

<!--
## Adding a new package
-->

## નવું પેકેજ ઉમેરવું

<!--
When you add a new npm package to the monorepo, the automated release workflow won't be able to publish it on the first run. This is an npm security feature: OIDC trusted publishing only works for packages that already exist and have been configured to trust the GitHub repository.
-->

જ્યારે તમે મોનોરેપોમાં નવું npm પેકેજ ઉમેરો છો, ત્યારે ઓટોમેટેડ રિલીઝ વર્કફ્લો તેને પ્રથમ રનમાં પ્રકાશિત કરી શકશે નહીં. આ એક npm સુરક્ષા સુવિધા છે: OIDC ટ્રસ્ટેડ પબ્લિશિંગ ફક્ત એવા પેકેજો માટે જ કાર્ય કરે છે જે પહેલેથી અસ્તિત્વમાં હોય અને GitHub રિપોઝિટરી પર વિશ્વાસ કરવા માટે કન્ફિગર થયેલા હોય.

<!--
Here's what you need to do:
-->

તમારે નીચે મુજબના પગલાં લેવાની જરૂર છે:

<!--
### 1. Publish the package manually
-->

### ૧. પેકેજને મેન્યુઅલી પબ્લિશ કરો

<!--
First, authenticate with npm on your local machine:
-->

સૌપ્રથમ, તમારા લોકલ મશીન પર npm સાથે ઓથેન્ટિકેટ કરો:

```bash
npm login
```

<!--
Then publish the package for the first time:
-->

ત્યારબાદ પેકેજને પ્રથમ વખત પ્રકાશિત કરો:

```bash
cd packages/your-new-package
npm publish --access public
```

<!--
This creates the package on the npm registry under your account.
-->

આ તમારા એકાઉન્ટ હેઠળ npm રજિસ્ટ્રી પર પેકેજ બનાવે છે.

<!--
### 2. Configure trusted publishing
-->

### ૨. ટ્રસ્ટેડ પબ્લિશિંગ કન્ફિગર કરો

<!--
After the initial publish, go to the package's settings on npmjs.com and set up OIDC trusted publishing:
-->

પ્રારંભિક પબ્લિશ કર્યા પછી, npmjs.com પર પેકેજના સેટિંગ્સમાં જાઓ અને OIDC ટ્રસ્ટેડ પબ્લિશિંગ સેટ કરો:

<!--
1. Navigate to your package on [npmjs.com](https://www.npmjs.com)
2. Go to **Settings** → **Configure Trusted Publishers**
3. Add a new trusted publisher with these settings. All of them are case-sensitive!
    - **Repository owner**: `WordPress`
    - **Repository name**: `wordpress-playground`
    - **Workflow filename**: `publish-npm-packages.yml`
    - **Environment**: `npm`
-->

1. [npmjs.com](https://www.npmjs.com) પર તમારા પેકેજ પર જાઓ
2. **Settings** → **Configure Trusted Publishers** પર જાઓ
3. આ સેટિંગ્સ સાથે નવો ટ્રસ્ટેડ પબ્લિશર ઉમેરો. આ તમામ કેસ-સેન્સિટિવ (case-sensitive) છે!
    - **Repository owner**: `WordPress`
    - **Repository name**: `wordpress-playground`
    - **Workflow filename**: `publish-npm-packages.yml`
    - **Environment**: `npm`

<!--
![Setting up OIDC trusted publishing on npm](/img/php-wasm-node-oidc.webp)
-->

![npm પર OIDC ટ્રસ્ટેડ પબ્લિશિંગ સેટ કરવું](/img/php-wasm-node-oidc.webp)

<!--
### 3. Transfer ownership (if needed)
-->

### ૩. માલિકી ટ્રાન્સફર કરો (જો જરૂરી હોય તો)

<!--
If you published under your personal account, transfer the package to the `@aspect` organization or ensure the appropriate team has publish access.
-->

જો તમે તમારા વ્યક્તિગત એકાઉન્ટ હેઠળ પેકેજ પ્રકાશિત કર્યું હોય, તો પેકેજને `@aspect` સંસ્થા (organization) માં ટ્રાન્સફર કરો અથવા ખાતરી કરો કે સંબંધિત ટીમને પબ્લિશ કરવાની ઍક્સેસ છે.

<!--
Once configured, subsequent releases will work automatically through the CI workflow.
-->

એકવાર કન્ફિગર થઈ ગયા પછી, ભવિષ્યની તમામ રિલીઝ CI વર્કફ્લો દ્વારા આપમેળે કામ કરશે.

<!--
## Why OIDC can't publish new packages
-->

## શા માટે OIDC નવા પેકેજો પ્રકાશિત કરી શકતું નથી

<!--
npm's OIDC implementation requires the package to already exist before a trusted publisher can be configured. This is a chicken-and-egg situation by design—it prevents someone from hijacking a package name through a GitHub workflow before the legitimate owner can claim it.
-->

npm નું OIDC ઇમ્પ્લીમેન્ટેશન એ બાબતની આવશ્યકતા રાખે છે કે ટ્રસ્ટેડ પબ્લિશર કન્ફિગર કરી શકાય તે પહેલાં પેકેજ પહેલેથી જ અસ્તિત્વમાં હોવું જોઈએ. ડિઝાઇન મુજબ આ મરઘી-અને-ઇંડા જેવી (chicken-and-egg) પરિસ્થિતિ છે—જે કોઈ વ્યક્તિ વાસ્તવિક માલિક તેનો દાવો કરે તે પહેલાં GitHub વર્કફ્લો દ્વારા પેકેજના નામનું અનધિકૃત અધિગ્રહણ (hijack) ન કરે તે અટકાવે છે.

<!--
The manual first publish establishes ownership, and trusted publishing then provides secure, token-free authentication for all future releases.
-->

પ્રથમ વખત મેન્યુઅલ પબ્લિશ કરવાથી માલિકી સ્થાપિત થાય છે, અને ત્યારબાદ ટ્રસ્ટેડ પબ્લિશિંગ ભવિષ્યની તમામ રિલીઝ માટે સુરક્ષિત અને ટોકન-મુક્ત ઓથેન્ટિકેશન (authentication) પૂરું પાડે છે.
