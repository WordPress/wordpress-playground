---
slug: /developers/local-development/vscode-extension
---

# VS કોડ એક્સટેન્શન

<!--
# VS Code extension
-->

[VS કોડ એક્સટેન્શન](https://marketplace.visualstudio.com/items?itemName=WordPressPlayground.wordpress-playground) નો ઉપયોગ કરીને શૂન્ય-સેટઅપ ડેવલપમેન્ટ વાતાવરણ શરૂ કરો, અને Apache અથવા MySQL ઇન્સ્ટોલ કર્યા વિના તમારા પ્લગઇન અથવા થીમને સ્થાનિક રીતે વિકસાવો.

<!--
# VS Code extensionStart a zero-setup development environment using the [VS Code extension](https://marketplace.visualstudio.com/items?itemName=WordPressPlayground.wordpress-playground), and develop your plugin or theme locally without installing Apache or MySQL.
-->

મુખ્ય વિશેષતાઓ:

<!--
Key Features:
-->

- **સંકલિત વિકાસ**: VS કોડની અંદર સીધા વર્ડપ્રેસ સાઇટ્સ વિકસાવો.
- **ઉપયોગમાં સરળતા**: સંકલિત સાધનો સાથે વિકાસ કાર્યપ્રવાહને સરળ બનાવે છે.

<!--
-   **Integrated Development**: Develop WordPress sites directly within VS Code.
-   **Ease of Use**: Simplifies the development workflow with integrated tools.
-->

:::info **દસ્તાવેજીકરણ**

VS કોડ એક્સટેન્શન એક અલગ GitHub રિપોઝીટરીમાં જાળવવામાં આવે છે, [પ્લેગ્રાઉન્ડ ટૂલ્સ](https://github.com/WordPress/playground-tools/). તમે નવીનતમ દસ્તાવેજો [dedicated README ફાઇલ](https://github.com/WordPress/playground-tools/blob/trunk/packages/vscode-extension/README.md) માં શોધી શકો છો.

:::

<!--
:::info **Documentation**

The VS Code extension is maintained in a different GitHub repository, [Playground Tools](https://github.com/WordPress/playground-tools/). You can find the latest documentation in the [dedicated README file](https://github.com/WordPress/playground-tools/blob/trunk/packages/vscode-extension/README.md).

:::
-->

## સ્થાપન અને ઉપયોગ:

<!--
## Installation and Usage:
-->

૧. **એક્સટેન્શન ઇન્સ્ટોલ કરો**: VS કોડ એક્સટેન્શન માર્કેટપ્લેસમાં “વર્ડપ્રેસ પ્લેગ્રાઉન્ડ” શોધો અને તેને ઇન્સ્ટોલ કરો.
૨. **સેટઅપ**: તમારા ડેવલપમેન્ટ એન્વાયર્નમેન્ટને ગોઠવવા માટે એક્સટેન્શનમાં આપેલી સેટઅપ સૂચનાઓનું પાલન કરો.
૩. **ડેવલપ અને ડીબગ**: તમારી વર્ડપ્રેસ સાઇટને ડેવલપ અને ડીબગ કરવા માટે ઇન્ટિગ્રેટેડ ટૂલ્સનો ઉપયોગ કરો.

<!--
1.  **Install the Extension**: Search for “WordPress Playground” in the VS Code extensions marketplace and install it.
2.  **Setup**: Follow the setup instructions provided in the extension to configure your development environment.
3.  **Develop and Debug**: Use the integrated tools to develop and debug your WordPress site.
-->

આ એક્સટેન્શન PHP ના પોર્ટેબલ WebAssembly વર્ઝન સાથે આવે છે અને SQLite નો ઉપયોગ કરવા માટે વર્ડપ્રેસ ને સેટ કરે છે. એકવાર ઇન્સ્ટોલ થઈ ગયા પછી, તમારે ફક્ત VS કોડમાં **Start Wordpress Server** બટન પર ક્લિક કરવાનું છે:

<!--
The extension ships with a portable WebAssembly version of PHP and sets up WordPress to use SQLite. Once installed, all you have to do is click the **Start WordPress Server** button in VS Code:
-->

import Image from '@theme/IdealImage';
import vsCodeScreenshot from '@site/static/img/start-wordpress-server.png';

<div style={{maxWidth:350}}><Image img={vsCodeScreenshot} /></div>
