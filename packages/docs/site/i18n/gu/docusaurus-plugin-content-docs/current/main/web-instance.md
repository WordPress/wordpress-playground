---
title: વેબ ઇન્સ્ટન્સ
slug: /web-instance
description: playground.wordpress.net પર વેબ ઈન્ટરફેસ માટે વિગતવાર માર્ગદર્શિકા, જેમાં ટૂલબાર, સેટિંગ્સ, અને ઇન્સ્ટન્સ મેનેજર કવર છે.
---

<!--
# WordPress Playground web instance {#wordpress-playground-web-instance}
-->

# વર્ડપ્રેસ પ્લેગ્રાઉન્ડ વેબ ઇન્સ્ટન્સ {#wordpress-playground-web-instance}

<!--
[https://playground.wordpress.net/](https://playground.wordpress.net/) lets developers run WordPress in a browser without a server. This environment makes testing plugins, themes, and features quick and easy.
-->

[https://playground.wordpress.net/](https://playground.wordpress.net/) ડેવલોપર્સને સર્વર વિના બ્રાઉઝરમાં વર્ડપ્રેસ ચલાવવાની મંજૂરી આપે છે. આ એન્વાયરનમેન્ટ પ્લગઈન્સ, થીમ્સ અને ફીચર્સના ટેસ્ટિંગને ઝડપી અને સરળ બનાવે છે.

<!--
Some key features:

- **Browser-based**: No local server setup required.
- **Instant Setup**: Run WordPress with a single click.
- **Testing Environment**: Ideal for testing plugins and themes.
-->

કેટલીક મુખ્ય વિશેષતાઓ:

- **બ્રાઉઝર આધારિત**: લોકલ સર્વર સેટઅપની જરૂર નથી.
- **ઇનસ્ટન્ટ સેટઅપ**: એક ક્લિકમાં વર્ડપ્રેસ ચલાવો.
- **ટેસ્ટિંગ એન્વાયરનમેન્ટ**: પ્લગઈન્સ અને થીમ્સ ટેસ્ટ કરવા માટે આદર્શ.

<!--
The [Query Params API](/developers/apis/query-api/) allows you to directly load specific configurations into a Playground instance. This includes setting a particular WordPress version, theme, or plugin. You can also define more complex setups using blueprints (see [examples here](/quick-start-guide#try-a-block-a-theme-or-a-plugin)).
-->

[ક્વેરી પેરામ્સ API](/developers/apis/query-api/) તમને પ્લેગ્રાઉન્ડ ઇન્સ્ટન્સમાં ચોક્કસ રૂપરેખાંકનો સીધા લોડ કરવાની મંજૂરી આપે છે. આમાં ચોક્કસ વર્ડપ્રેસ વર્ઝન, થીમ અથવા પ્લગઇન સેટ કરવાનો સમાવેશ થાય છે. તમે બ્લુપ્રીન્ટનો ઉપયોગ કરીને વધુ જટિલ સેટઅપ્સ પણ વ્યાખ્યાયિત કરી શકો છો ([અહીં ઉદાહરણો જુઓ](/quick-start-guide#try-a-block-a-theme-or-a-plugin)).

<!--
The Playground website includes toolbars that customize your instance and provide quick access to resources and utilities.
-->

પ્લેગ્રાઉન્ડ વેબસાઇટમાં ટૂલબાર્સ શામેલ છે જે તમારી ઇન્સ્ટન્સને કસ્ટમાઇઝ કરે છે અને સંસાધનો અને ઉપયોગિતાઓની ઝડપી ઍક્સેસ પ્રદાન કરે છે.

![Playground Toolbar Snapshot](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/about/playground-toolbar.webp)

<!--
## Customize Playground {#customize-playground}
-->

## પ્લેગ્રાઉન્ડ કસ્ટમાઇઝ કરો {#customize-playground}

<!--
On the toolbar, you'll find:

- **Playground Settings**: A panel for configuring your current instance, like PHP and WordPress versions.
- **Playground Dashboard**: This panel lets you manage WordPress Playground instances, save and export them, edit files from your WordPress instance, and create new Blueprints.
- **Playground Launch Panel**: The Launch Panel shows all the ways to launch a WordPress Playground instance.
-->

ટૂલબારમાં, તમને મળશે:

- **પ્લેગ્રાઉન્ડ સેટિંગ્સ**: PHP અને વર્ડપ્રેસ વર્ઝન જેવી તમારી વર્તમાન ઇન્સ્ટન્સને ગોઠવવા માટેનું પેનલ.
- **પ્લેગ્રાઉન્ડ ડેશબોર્ડ**: આ પેનલ તમને વર્ડપ્રેસ પ્લેગ્રાઉન્ડ ઇન્સ્ટન્સ મેનેજ કરવા, સેવ અને એક્સપોર્ટ કરવા, તમારી વર્ડપ્રેસ ઇન્સ્ટન્સમાંથી ફાઇલો એડિટ કરવા અને નવા બ્લુપ્રીન્ટ બનાવવાની મંજૂરી આપે છે.
- **પ્લેગ્રાઉન્ડ લૉન્ચ પેનલ**: લૉન્ચ પેનલ વર્ડપ્રેસ પ્લેગ્રાઉન્ડ ઇન્સ્ટન્સ લૉન્ચ કરવાની બધી રીતો બતાવે છે.

<!--
### Playground Settings {#playground-settings}
-->

### પ્લેગ્રાઉન્ડ સેટિંગ્સ {#playground-settings}

![snapshot of customize Playground window at Playground instance](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/about/playground-settings-panel.webp)

<!--
The **Playground Settings Panel** includes these [Query API options](/developers/apis/query-api#available-options):

- `wp`: Defines the WordPress version.
- `php`: Specifies the PHP version for the instance.
- `language`: Sets the WordPress instance language.
- `multisite`: Enables WordPress multisite support.
- `networking`: Enables network access to the WordPress Plugin Directory and WordPress APIs.
-->

**પ્લેગ્રાઉન્ડ સેટિંગ્સ પેનલ** માં આ [ક્વેરી API વિકલ્પો](/developers/apis/query-api#available-options) શામેલ છે:

- `wp`: વર્ડપ્રેસ વર્ઝન વ્યાખ્યાયિત કરે છે.
- `php`: ઇન્સ્ટન્સ માટે PHP વર્ઝન સ્પષ્ટ કરે છે.
- `language`: વર્ડપ્રેસ ઇન્સ્ટન્સની ભાષા સેટ કરે છે.
- `multisite`: વર્ડપ્રેસ મલ્ટીસાઇટ સપોર્ટ સક્ષમ કરે છે.
- `networking`: વર્ડપ્રેસ પ્લગઇન ડિરેક્ટરી અને વર્ડપ્રેસ API માટે નેટવર્ક ઍક્સેસ સક્ષમ કરે છે.

<!--
## Playground Manager {#playground-manager}
-->

## પ્લેગ્રાઉન્ડ મેનેજર {#playground-manager}

![Playground settings panel allow users to save export and edit the WordPress directly](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/about/playground-dashboard.webp)

<!--
This panel lets you manage Playground instances and provides access to the following panels:

- **Settings**: To manage the current Playground's settings
- **File Browser**: Built-in IDE for editing files, uploading plugins and themes, and live editing. Playground auto-reloads changes in real time.
- **Blueprint**: A Blueprint editor for creating, saving, and running Blueprints in your Playground web instance.
- **Database**: Tools for managing the database with Adminer and phpMyAdmin, and downloading as a `.sqlite` file.
- **Logs**: Displays log messages when something goes wrong.
-->

આ પેનલ તમને પ્લેગ્રાઉન્ડ ઇન્સ્ટન્સ મેનેજ કરવાની મંજૂરી આપે છે અને નીચેના પેનલ્સની ઍક્સેસ પ્રદાન કરે છે:

- **સેટિંગ્સ**: વર્તમાન પ્લેગ્રાઉન્ડની સેટિંગ્સ મેનેજ કરવા માટે
- **ફાઇલ બ્રાઉઝર**: ફાઇલો એડિટ કરવા, પ્લગઇન્સ અને થીમ્સ અપલોડ કરવા અને લાઇવ એડિટિંગ માટે બિલ્ટ-ઇન IDE. પ્લેગ્રાઉન્ડ રિયલ ટાઇમમાં ફેરફારો ઓટો-રીલોડ કરે છે.
- **બ્લુપ્રીન્ટ**: તમારી પ્લેગ્રાઉન્ડ વેબ ઇન્સ્ટન્સમાં બ્લુપ્રીન્ટ બનાવવા, સેવ કરવા અને ચલાવવા માટે બ્લુપ્રીન્ટ એડિટર.
- **ડેટાબેસ**: Adminer અને phpMyAdmin સાથે ડેટાબેસ મેનેજ કરવા અને `.sqlite` ફાઇલ તરીકે ડાઉનલોડ કરવાના સાધનો.
- **લૉગ્સ**: કંઈક ખોટું થાય ત્યારે લૉગ મેસેજ દર્શાવે છે.

![Save Playground Button](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/about/playground-dashboard-save.webp)

<!--
Click "Save" to create an instance and list it in the Playground Launch Panel. The Playground Dashboard also offers export and download options through the Additional actions menu:
-->

ઇન્સ્ટન્સ બનાવવા અને પ્લેગ્રાઉન્ડ લૉન્ચ પેનલમાં સૂચિબદ્ધ કરવા માટે "Save" પર ક્લિક કરો. પ્લેગ્રાઉન્ડ ડેશબોર્ડ Additional actions મેનૂ દ્વારા એક્સપોર્ટ અને ડાઉનલોડ વિકલ્પો પણ આપે છે:

<!--
### Additional actions menu {#additional-actions-menu}
-->

### એડિશનલ એક્શન્‍સ મેનુ {#additional-actions-menu}

![Additional actions Menu](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/about/additional-options-playground-dashboard.webp)

<!--
- **Export Pull Request to GitHub**: Export WordPress plugins, themes, and entire wp-content directories as pull requests to any public GitHub repository. Watch a [demo of this feature](https://www.youtube.com/watch?v=gKrij8V3nK0&t=2488s).
- **Download as .zip**: Creates a `.zip` file with the setup of the Playground instance, including any themes or plugins installed. This `.zip` excludes content and database changes.
-->

- **GitHub માં પુલ રિક્વેસ્ટ એક્સપોર્ટ કરો**: વર્ડપ્રેસ પ્લગઇન્સ, થીમ્સ અને સંપૂર્ણ wp-content ડિરેક્ટરીઝને કોઈપણ પબ્લિક GitHub રિપોઝીટરીમાં પુલ રિક્વેસ્ટ તરીકે એક્સપોર્ટ કરો. [આ ફીચરનો ડેમો](https://www.youtube.com/watch?v=gKrij8V3nK0&t=2488s) જુઓ.
- **zip તરીકે ડાઉનલોડ કરો**: પ્લેગ્રાઉન્ડ ઇન્સ્ટન્સના સેટઅપ સાથે `.zip` ફાઇલ બનાવે છે, જેમાં કોઈપણ ઇન્સ્ટોલ કરેલી થીમ્સ અથવા પ્લગઇન્સ શામેલ છે. આ `.zip` કન્ટેન્ટ અને ડેટાબેસ ફેરફારો શામેલ કરતું નથી.

<!--
### Blueprint Editor {#blueprint-editor}
-->

### બ્લુપ્રીન્ટ એડિટર {#blueprint-editor}

![Blueprint editor WordPress Playground](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/about/playground-blueprint-editor.webp)

<!--
The Blueprint editor replaced the older Blueprint builder, offering the ability to manage multiple Blueprints and code validation.
-->

બ્લુપ્રીન્ટ એડિટરે જૂના બ્લુપ્રીન્ટ બિલ્ડરને બદલ્યું, જે બહુવિધ બ્લુપ્રીન્ટ મેનેજ કરવાની અને કોડ વેલિડેશનની ક્ષમતા આપે છે.

<!--
### Launch Playground Panel {#launch-playground-panel}
-->

### પ્લેગ્રાઉન્ડ લૉન્ચ પેનલ {#launch-playground-panel}

![Playground Launch Panel](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dashboard/import-playground.webp)

<!--
This panel shows all the ways to launch WordPress Playground: import `.zip` files, load from GitHub repositories, and preview PRs from WordPress core and Gutenberg.

The Launch Panel also lists more than 40 blueprints from the Blueprint Gallery and your Saved Playgrounds.
-->

આ પેનલ વર્ડપ્રેસ પ્લેગ્રાઉન્ડ લૉન્ચ કરવાની બધી રીતો બતાવે છે: `.zip` ફાઇલો ઇમ્પોર્ટ કરો, GitHub રિપોઝીટરીઝમાંથી લોડ કરો, અને વર્ડપ્રેસ કોર અને Gutenberg માંથી PR પ્રીવ્યુ કરો.

લૉન્ચ પેનલ બ્લુપ્રીન્ટ ગેલેરીમાંથી 40 થી વધુ બ્લુપ્રીન્ટ અને તમારા સેવ કરેલા પ્લેગ્રાઉન્ડ પણ સૂચિબદ્ધ કરે છે.

<!--
:::caution

The site at https://playground.wordpress.net is there to support the community, but there are no guarantees it will continue to work if the traffic grows significantly.

If you need certain availability, you should [host your own WordPress Playground](/developers/architecture/host-your-own-playground).
:::
-->

:::caution

https://playground.wordpress.net પરની સાઇટ સમુદાયને સમર્થન આપવા માટે છે, પરંતુ ટ્રાફિક નોંધપાત્ર રીતે વધે તો તે કામ કરવાનું ચાલુ રાખશે તેની કોઈ ગેરંટી નથી.

જો તમને ચોક્કસ ઉપલબ્ધતાની જરૂર હોય, તો તમારે [તમારું પોતાનું વર્ડપ્રેસ પ્લેગ્રાઉન્ડ હોસ્ટ કરવું](/developers/architecture/host-your-own-playground) જોઈએ.
:::
