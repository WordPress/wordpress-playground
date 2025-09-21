---
title: wp-now
slug: /developers/local-development/wp-now
---

:::caution પેકેજ ડિપ્રિકેટેડ (deprecated) છે
NPM પેકેજ @wp-now/wp-now ડિપ્રિકેટેડ (deprecated) છે, ભવિષ્યમાં અપડેટ્સ પ્રાપ્ત થશે નહીં. તમારા ડેવલપર ફ્લો પર કમાન્ડ-લાઇન ટૂલનો ઉપયોગ કરવા માટે, NPM પેકેજ `@wp-playground/cli` નો ઉપયોગ કરો.
:::

<!--
:::caution Package deprecated
The NPM package @wp-now/wp-now is deprecated, won't receive updates in the future. To use a command-line tool on your developer flow, use the NPM package `@wp-playground/cli`.
:::
-->

# wp-now NPM પેકેજ

<!--
# wp-now NPM package
-->

[wp-now](https://www.npmjs.com/package/@wp-now/wp-now) એ એક કમાન્ડ-લાઇન ટૂલ છે જે સ્થાનિક રીતે વર્ડપ્રેસ ચલાવવાની પ્રક્રિયાને સરળ બનાવવા માટે રચાયેલ છે. તે ન્યૂનતમ રૂપરેખાંકન સાથે સ્થાનિક વર્ડપ્રેસ વાતાવરણ સેટ કરવાની ઝડપી અને સરળ રીત પ્રદાન કરે છે.

<!--
[wp-now](https://www.npmjs.com/package/@wp-now/wp-now) is a command-line tool designed to simplify the process of running WordPress locally. It provides a quick and easy way to set up a local WordPress environment with minimal configuration.
-->

મુખ્ય વિશેષતાઓ:

<!--
Key Features:
-->

-  **કમાન્ડ-લાઇન ઇન્ટરફેસ**: CLI સાથે આરામદાયક વિકાસકર્તાઓ માટે ઉપયોગમાં સરળ.
-  **ઝડપી સેટઅપ**: સેકન્ડોમાં સ્થાનિક વર્ડપ્રેસ વાતાવરણ સેટ કરો.
-  **કસ્ટમાઇઝેબલ**: ચોક્કસ વિકાસ જરૂરિયાતોને અનુરૂપ ગોઠવણી માટે પરવાનગી આપે છે.

<!--
-   **Command-line Interface**: Easy to use for developers comfortable with CLI.
-   **Quick Setup**: Set up a local WordPress environment in seconds.
-   **Customizable**: Allows for configuration to suit specific development needs.
-->

[`@wp-now/wp-now`](https://www.npmjs.com/package/@wp-now/wp-now) એ એક CLI ટૂલ છે જે એક જ આદેશથી વર્ડપ્રેસ સાઇટને સ્પિન કરે છે. [VS કોડ એક્સટેન્શન](/developers/local-development/vscode-extension) ની જેમ, તે PHP અને SQLite ના પોર્ટેબલ WebAssembly વર્ઝનનો ઉપયોગ કરે છે. કોઈ ડોકર, MySQL, અથવા Apache ની જરૂર નથી.

<!--
[`@wp-now/wp-now`](https://www.npmjs.com/package/@wp-now/wp-now) is a CLI tool to spin up a WordPress site with a single command. Similarly to the [VS Code extension](/developers/local-development/vscode-extension), it uses a portable WebAssembly version of PHP and SQLite. No Docker, MySQL, or Apache are required.
-->

:::info **દસ્તાવેજીકરણ**

`wp-now` એક અલગ GitHub રિપોઝીટરી, [પ્લેગ્રાઉન્ડ ટૂલ્સ](https://github.com/WordPress/playground-tools/) માં જાળવવામાં આવે છે. તમે નવીનતમ દસ્તાવેજીકરણ [સમર્પિત README ફાઇલ](https://github.com/WordPress/playground-tools/blob/trunk/packages/wp-now/README.md) માં શોધી શકો છો.

:::

<!--
:::info **Documentation**

`wp-now` is maintained in a different GitHub repository, [Playground Tools](https://github.com/WordPress/playground-tools/). You can find the latest documentation in the [dedicated README file](https://github.com/WordPress/playground-tools/blob/trunk/packages/wp-now/README.md).

:::
-->

## પ્લગઇન અથવા થીમ ડિરેક્ટરીમાં wp-now લોન્ચ કરો.

<!--
## Launch wp-now in a plugin or theme directory
-->

તમારા પ્લગઇન અથવા થીમ ડિરેક્ટરી પર જાઓ અને નીચેના આદેશો સાથે `wp-now` શરૂ કરો:

<!--
Navigate to your plugin or theme directory and start `wp-now` with the following commands:
-->

```bash
cd my-plugin-or-theme-directory
npx @wp-now/wp-now start
```

## વિકલ્પો સાથે `wp-content` ડિરેક્ટરીમાં wp-now લોન્ચ કરો.

<!--
## Launch wp-now in the `wp-content` directory with options
-->

તમે કોઈપણ `wp-content` ફોલ્ડરમાંથી `wp-now` પણ શરૂ કરી શકો છો. નીચેનું ઉદાહરણ PHP અને વર્ડપ્રેસ વર્ઝન બદલવા અને બ્લુપ્રિન્ટ ફાઇલ લોડ કરવા માટેના પરિમાણો પાસ કરે છે.

<!--
You can also start `wp-now` from any `wp-content` folder. The following example passes parameters for changing the PHP and WordPress versions and loading a blueprint file.
-->

```bash
cd my-wordpress-folder/wp-content
npx @wp-now/wp-now start --wp=6.4 --php=8.3 --blueprint=path/to/blueprint.json
```

## wp-now ને વૈશ્વિક સ્તરે ઇન્સ્ટોલ કરો

<!--
## Install wp-now globally
-->

વૈકલ્પિક રીતે, તમે કોઈપણ ડિરેક્ટરીમાંથી લોડ કરવા માટે વૈશ્વિક સ્તરે `@wp-now/wp-now` ઇન્સ્ટોલ કરી શકો છો:

<!--
Alternatively, you can install `@wp-now/wp-now` globally to load it from any directory:
-->

```bash
npm install -g @wp-now/wp-now
cd my-plugin-or-theme-directory
wp-now start
```
