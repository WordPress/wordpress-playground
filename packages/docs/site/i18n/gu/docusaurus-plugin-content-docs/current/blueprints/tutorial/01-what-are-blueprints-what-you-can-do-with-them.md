---
title: બ્લુપ્રિન્ટ્સ શું છે?
slug: /blueprints/tutorial/what-are-blueprints-what-you-can-do-with-them
description: બ્લુપ્રિન્ટ્સ શું છે અને તેઓ વર્ડપ્રેસ પ્લેગ્રાઉન્ડને કેવી રીતે ગોઠવે છે તે જાણો. ઇન્સ્ટન્ટ સાઇટ સેટઅપ માટે JSON નો ઉપયોગ કરવાના ફાયદાઓ શોધો.
---

# બ્લુપ્રિન્ટ્સ શું છે, અને તમે તેમની સાથે શું કરી શકો છો?

<!--
# What are Blueprints, and what can you do with them?
 -->

વર્ડપ્રેસ પ્લેગ્રાઉન્ડ વડે તમે પ્લગઇન્સ, થીમ્સ, સામગ્રી (પોસ્ટ્સ, પૃષ્ઠો, વર્ગીકરણ અને ટિપ્પણીઓ), સેટિંગ્સ (સાઇટનું નામ, વપરાશકર્તાઓ, પરમાલિંક્સ અને વધુ) વગેરે સહિત એક આખી વેબસાઇટ બનાવી શકો છો. તે તમને ઉત્પાદનો સાથે સંપૂર્ણ WooCommerce સ્ટોર, લેખોથી ભરેલું મેગેઝિન, બહુવિધ વપરાશકર્તાઓ સાથેનો કોર્પોરેટ બ્લોગ અને વધુ જનરેટ કરવાની મંજૂરી આપે છે.

<!--
With WordPress Playground you can create a whole website, including plugins, themes, content (posts, pages, taxonomy, and comments), settings (site name, users, permalinks, and more), etc. They allow you to generate a WooCommerce store complete with products, a magazine populated with articles, a corporate blog with multiple users, and more.
 -->

બ્લુપ્રિન્ટ્સ એ `JSON` ફાઇલો છે જેનો ઉપયોગ તમે પ્લેગ્રાઉન્ડ ઇન્સ્ટન્સને ગોઠવવા માટે કરી શકો છો.

<!--
Blueprints are `JSON` files that you can use to configure Playground instances.
 -->

બ્લુપ્રિન્ટ્સ ફાઇલ સિસ્ટમ અને ડેટાબેઝ મેનિપ્યુલેશન જેવા અદ્યતન ઉપયોગના કેસોને સપોર્ટ કરે છે, અને તમે જે ઇન્સ્ટન્સ બનાવો છો તેના પર તમને સૂક્ષ્મ નિયંત્રણ આપે છે. વર્ડપ્રેસ ટેસ્ટ ટીમ [6.5 બીટા રિલીઝ સાયકલ] (https://wordpress.org/news/2024/03/wordpress-6-5-release-candidate-2/) માં પ્લેગ્રાઉન્ડનો ઉપયોગ કરી રહી છે, એક બ્લુપ્રિન્ટ બનાવી રહી છે જે નવીનતમ સંસ્કરણ, ઘણા પરીક્ષણ પ્લગઇન્સ અને ડમી ડેટા લોડ કરે છે.

<!--
Blueprints support advanced use cases, like file system and database manipulation, and give you fine-grained control over the instance you create. The WordPress Test Team has been using Playground in [the 6.5 beta release cycle](https://wordpress.org/news/2024/03/wordpress-6-5-release-candidate-2/), creating a Blueprint that loads the latest version, several testing plugins, and dummy data.
 -->

## એક સરળ ઉદાહરણ

<!--
## A simple example
 -->

બ્લુપ્રિન્ટ કંઈક આના જેવું દેખાઈ શકે છે:

<!--
A Blueprint might look something like this:
 -->

```json
{
	"plugins": ["akismet", "gutenberg"],
	"steps": [
		{
			"step": "installTheme",
			"themeData": {
				"resource": "wordpress.org/themes",
				"slug": "twentynineteen"
			}
		}
	],
	"siteOptions": {
		"blogname": "マイブログ",
		"blogdescription": "Just another WordPress site"
	},
	"constants": {
		"WP_DEBUG": true
	}
}
```

<!--
```json
{
	"plugins": ["akismet", "gutenberg"],
	"steps": [
		{
			"step": "installTheme",
			"themeData": {
				"resource": "wordpress.org/themes",
				"slug": "twentynineteen"
			}
		}
	],
	"siteOptions": {
		"blogname": "My Blog",
		"blogdescription": "Just another WordPress site"
	},
	"constants": {
		"WP_DEBUG": true
	}
}
```
 -->

ઉપરોક્ત બ્લુપ્રિન્ટ _Akismet_ અને _Gutenberg_ પ્લગઇન્સ અને _Twenty Nineteen_ થીમ ઇન્સ્ટોલ કરે છે, સાઇટનું નામ અને વર્ણન સેટ કરે છે અને વર્ડપ્રેસ ડિબગીંગ મોડને સક્ષમ કરે છે.

<!--
The Blueprint above installs the _Akismet_ and _Gutenberg_ plugins and the _Twenty Nineteen_ theme, sets the site name and description, and enables the WordPress debugging mode.
 -->

## બ્લુપ્રિન્ટ્સના ફાયદા

<!--
## The benefits of Blueprints
 -->

પ્લેગ્રાઉન્ડ દ્વારા વર્ડપ્રેસ સાઇટ્સ બનાવવા માટે બ્લુપ્રિન્ટ્સ એક અમૂલ્ય સાધન છે.

<!--
Blueprints are an invaluable tool for building WordPress sites via Playground
 -->

- **સુગમતા**: વિકાસકર્તાઓ બિલ્ડ પ્રક્રિયામાં નાના ફેરફારો કરી શકે છે.
- **સુસંગતતા**: ખાતરી કરો કે દરેક નવી સાઇટ સમાન રૂપરેખાંકનથી શરૂ થાય છે.
- **હળવા**: નાની ટેક્સ્ટ ફાઇલો જે સંગ્રહિત અને સ્થાનાંતરિત કરવામાં સરળ છે.
- **પારદર્શિતા**: બ્લુપ્રિન્ટમાં વર્ડપ્રેસ સાઇટનો સ્નેપશોટ બનાવવા માટે જરૂરી બધા આદેશો શામેલ છે. તમે તેને વાંચી શકો છો અને સાઇટ કેવી રીતે બનાવવામાં આવે છે તે સમજી શકો છો.
- **ઉત્પાદકતા**: નવી વર્ડપ્રેસ સાઇટ મેન્યુઅલી સેટ કરવાની સમય માંગી લેતી પ્રક્રિયા ઘટાડે છે. દરેક નવા પ્રોજેક્ટ માટે થીમ્સ અને પ્લગઇન્સ ઇન્સ્ટોલ અને ગોઠવવાને બદલે, બ્લુપ્રિન્ટ લાગુ કરો અને એક પ્રક્રિયામાં બધું સેટ કરો.
- **અપ-ટુ-ડેટ ડિપેન્ડન્સી**: વર્ડપ્રેસ, ચોક્કસ પ્લગઇન અથવા થીમનું નવીનતમ સંસ્કરણ મેળવો. તમારો સ્નેપશોટ હંમેશા નવીનતમ સુવિધાઓ અને સુરક્ષા સુધારાઓ સાથે અદ્યતન રહે છે.
- **સહયોગ**: GitHub જેવા ટૂલ્સમાં `JSON` ફાઇલોની સમીક્ષા કરવી સરળ છે. તમારી ટીમ અથવા વર્ડપ્રેસ સમુદાય સાથે બ્લુપ્રિન્ટ શેર કરો. અન્ય લોકોને તમારા સારી રીતે ગોઠવેલા સેટઅપનો ઉપયોગ કરવાની મંજૂરી આપવી.
- **પ્રયોગ અને શિક્ષણ**: વર્ડપ્રેસમાં નવા હોય અથવા વિવિધ રૂપરેખાંકનો સાથે પ્રયોગ કરવા માંગતા હોય તેમના માટે, બ્લુપ્રિન્ટ્સ લાઇવ સાઇટને "તોડ્યા" વિના નવા સેટઅપ્સ અજમાવવાની સલામત અને સરળ રીત પૂરી પાડે છે.
- **WordPress.org એકીકરણ**: વર્ડપ્રેસ પ્લગઇન ડિરેક્ટરીમાં [તમારા પ્લગઇનનો ડેમો](https://developer.wordpress.org/plugins/wordpress-org/previews-and-blueprints/) અથવા [થીમ ટ્રેક ટિકિટ](https://meta.trac.wordpress.org/ticket/7382) માં પૂર્વાવલોકન ઓફર કરે છે.
- **ડેવલપમેન્ટ એન્વાયરમેન્ટ સ્થાપિત કરવું**: ટીમમાં એક નવો ડેવલપર બ્લુપ્રિન્ટ ડાઉનલોડ કરી શકે છે, કાલ્પનિક `wp up` આદેશ ચલાવી શકે છે, અને એક નવું ડેવલપર એન્વાયરમેન્ટ મેળવી શકે છે જેમાં તેમને જરૂરી દરેક વસ્તુ લોડ હોય છે. સમગ્ર CI/CD પ્રક્રિયા સમાન બ્લુપ્રિન્ટનો ફરીથી ઉપયોગ કરી શકે છે.

<!--
-   **Flexibility**: developers can make granular adjustments to the build process.
-   **Consistency**: ensure that every new site starts with the same configuration.
-   **Lightweight**: small text files that are easy to store and transfer.
-   **Transparency**: A Blueprint includes all the commands needed to build a snapshot of a WordPress site. You can read through it and understand how the site is built.
-   **Productivity**: reduces the time-consuming process of manually setting up a new WordPress site. Instead of installing and configuring themes and plugins for each new project, apply a Blueprint and set everything in one process.
-   **Up-to-date dependencies**: fetch the latest version of WordPress, a particular plugin, or a theme. Your snapshot is always up to date with the latest features and security fixes.
-   **Collaboration**: the `JSON` files are easy to review in tools like GitHub. Share Blueprints with your team or the WordPress community. Allowing others to use your well-configured setup.
-   **Experimentation and Learning**: For those new to WordPress or looking to experiment with different configurations, Blueprints provide a safe and easy way to try new setups without "breaking" a live site.
-   **WordPress.org integration**: offer a [demo of your plugin](https://developer.wordpress.org/plugins/wordpress-org/previews-and-blueprints/) in the WordPress plugin directory, or a preview in a [Theme Trac ticket](https://meta.trac.wordpress.org/ticket/7382).
-   **Spinning a development environment**: A new developer in the team could download the Blueprint, run a hypothetical `wp up` command, and get a fresh developer environments—loaded with everything they need. The entire CI/CD process can reuse the same Blueprint.
 -->

:::info **વધુ સંસાધનો**
બ્લુપ્રિન્ટ્સની (અનંત) શક્યતાઓ વિશે વધુ જાણવા માટે આ લિંક્સની મુલાકાત લો:

- [વર્ડપ્રેસ પ્લેગ્રાઉન્ડનો પરિચય](https://developer.wordpress.org/news/2024/04/05/introduction-to-playground-running-wordpress-in-the-browser/)
- [વર્ડપ્રેસ પ્લેગ્રાઉન્ડ બ્લોક](https://wordpress.org/plugins/interactive-code-block/) નો ઉપયોગ કરીને તમારી વેબસાઇટમાં પૂર્વ-રૂપરેખાંકિત વર્ડપ્રેસ સાઇટ એમ્બેડ કરો.
- [બ્લુપ્રિન્ટ્સ ઉદાહરણો](/blueprints/examples)
- [બ્લુપ્રિન્ટ્સ સાથે બનેલા ડેમો અને એપ્લિકેશન્સ](/resources#apps-built-with-wordpress-playground)
    :::

<!--
:::info **More Resources**
Visit these links to learn more about the (endless) possibilities of Blueprints:

-   [Introduction to WordPress Playground](https://developer.wordpress.org/news/2024/04/05/introduction-to-playground-running-wordpress-in-the-browser/)
-   Embed a pre-configured WordPress site in your website using the [WordPress Playground Block](https://wordpress.org/plugins/interactive-code-block/).
-   [Blueprints examples](/blueprints/examples)
-   [Demos and apps built with Blueprints](/resources#apps-built-with-wordpress-playground)

:::
 -->
