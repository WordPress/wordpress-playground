---
title: પ્લગइન ડેવલપર્સ માટે વર્ડપ્રેસ પ્લેગ્રાઉન્ડ
slug: /guides/for-plugin-developers
description: પ્લગઇન ડેવલપર્સ માટે એક માર્ગદર્શિકા જે તેમના પ્લગઇન્સ બનાવવા, પરીક્ષણ કરવા અને તમકીલ લાઇવ ડેમો બનાવવા માટે પ્લેગ્રાઉન્ડ નો ઉપયોગ કરે છે.
---

વર્ડપ્રેસ પ્લેગ્રાઉન્ડ એક નવીન સાધન છે જે પ્લગઇન ડેવલપર્સને તેમના પ્લગઇન્સ સીધું બ્રાઉઝર પરિવેશમાં બનાવવા, પરીક્ષણ કરવા અને પ્રદર્શિત કરવા દે છે.

આ માર્ગદર્શિકા તમને બતાવશે કે તમારી પ્લગઇન ડેવલપમેન્ટ વર્કફ્લો સુધારવા, તમારા પ્લગઇનને દર્શાવવા માટે લાઇવ ડેમો બનાવવા અને તમારા પ્લગઇન પરીક્ષણ અને સમીક્ષા સરળ બનાવવા માટે વર્ડપ્રેસ પ્લેગ્રાઉન્ડ નો ઉપયોગ કેવી રીતે કરવો તે શીખવશે.

<div class="callout callout-info">

તમારા ઉત્પાદોને વર્ડપ્રેસ પ્લેગ્રાઉન્ડ સાથે કેવી રીતે [બનાવવું](/about/build), [પરીક્ષણ કરવું](/about/test), અને [લોંચ કરવું](/about/launch) તે જાણો [પ્લેગ્રાઉન્ડ વિશે](/about) વિભાગમાં.

</div>

## પ્લેગ્રાઉન્ડ ઇન્સ્ટન્સ સાથે પ્લગઇન લોડ કરવું

### વર્ડપ્રેસ થીમ્સ ડિરેક્ટરીમાં પ્લગઇન

વર્ડપ્રેસ પ્લેગ્રાઉન્ડ સાથે, તમે [વર્ડપ્રેસ પ્લગઈન્સ ડિરેક્ટરી](https://wordpress.org/plugins/) માંથી લગભગ કોઈપણ પ્લગઇન સાથે વર્ડપ્રેસ ઇન્સ્ટોલેશન ઝડપથી લોડ કરી શકો છો. તમારે ફક્ત પ્લેગ્રાઉન્ડ URL માં `પ્લગઇન` [ક્વેરી પેરામીટર](/developers/apis/query-api) ઉમેરવાની જરૂર છે અને વર્ડપ્રેસ ડિરેક્ટરીમાંથી પ્લગઈનનો સ્લગ મૂલ્ય તરીકે ઉપયોગ કરવો. ઉદાહરણ તરીકે: https://playground.wordpress.net/?plugin=create-block-theme

:::tip
તમે ક્વેરી પેરામીટર્સ દ્વારા અને પ્લગઈન પેરામીટર્સ ને પુનરાવર્તિત કરીને વર્ડપ્રેસ ડિરેક્ટરીમાંથી બહુવિધ પ્લગઈન્સ ઇન્સ્ટોલ અને સક્રિય કરી શકો છો. ઉદાહરણ તરીકે: https://playground.wordpress.net/?plugin=gutenberg&plugin=akismet&plugin=wordpress-seo.
:::

તમે પણ પ્લેગ્રાઉન્ડ ઇન્સ્ટન્સને પસ કરેલ [બ્લુપ્રિન્ટ](/blueprints/getting-started) ના [`પ્લગઇન ઇન્સ્ટોલ કરો` પગલું](/blueprints/steps#InstallPluginStep) સેટ કરીને વર્ડપ્રેસ પ્લગઈન ડિરેક્ટરીમાંથી કોઈપણ પ્લગઈન લોડ કરી શકો છો.

```json
{
	"landingPage": "/wp-admin/plugins.php",
	"login": true,
	"steps": [
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "wordpress.org/plugins",
				"slug": "gutenberg"
			}
		}
	]
}
```

[<kbd> બ્લુપ્રિન્ટ ચલાવો </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/plugins.php%22,%22login%22:true,%22steps%22:[{%22step%22:%22installPlugin%22,%22pluginData%22:{%22resource%22:%22wordpress.org/plugins%22,%22slug%22:%22gutenberg%22}}]})

બ્લુપ્રિન્ટ ને પ્લેગ્રાઉન્ડ ઇન્સ્ટન્સમાં [કેટલાક રીતે](/blueprints/using-blueprints) પસાર કરી શકાય છે.

### GitHub રિપોઝિટરીમાં પ્લગઇન

GitHub રિપોઝિટરીમાં સંગ્રહિત પ્લગઇન પણ બ્લુપ્રિન્ટ્સ દ્વારા પ્લેગ્રાઉન્ડ ઇન્સ્ટન્સમાં લોડ કરી શકાય છે.

[`પ્લગઇન ઇન્સ્ટોલ કરો` બ્લુપ્રિન્ટ પગલું](/blueprints/steps#installPlugin) ના `પ્લગઇન ડેટા` સંપત્તિ સાથે, તમે [`git:directory` સંસાધન](/blueprints/steps/resources#gitdirectoryreference) વ્યાખ્યાયિત કરી શકો છો જે પ્લેગ્રાઉન્ડ ઇન્સ્ટન્સમાં રિપોઝિટરીમાંથી ફાઇલોમાંથી પ્લગઇન બનાશે.

<div class="callout callout-info">

છેલ્લાં કેટલાક મહિનાથી, [GitHub proxy](https://playground.wordpress.net/proxy) એક અવિશ્વાસનીય રીતે ઉપયોગી સાધન હતું GitHub રિપોઝિટરીમાંથી પ્લગઈન લોડ કરવા માટે, કારણ કે તે તમને ચોક્કસ શાખા, ચોક્કસ ડિરેક્ટરી, ચોક્કસ commit, અથવા ચોક્કસ PR માંથી પ્લગઈન લોડ કરવા દે છે. પરંતુ પ્લેગ્રાઉન્ડ માં તાજેતરના સુધારો સાથે, આ વૈશિષ્ટ્ય આવશ્યક નથી. GitHub Proxy શીઘ્ર બંધ થશે, કૃપया તમારા blueprints ને `git:directory` સંસાધનમાં અપડેટ કરો.

</div>

ઉદાહરણ તરીકે, નીચેનો `blueprint.json` GitHub રિપોઝિટરીમાંથી પ્લગઈન ઇન્સ્ટોલ કરે છે:

```json
{
	"landingPage": "/wp-admin/admin.php?page=add-media-from-third-party-service",
	"login": true,
	"steps": [
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "git:directory",
				"url": "https://github.com/wptrainingteam/devblog-dataviews-plugin",
				"ref": "HEAD",
				"refType": "refname"
			}
		}
	]
}
```

:::tip
જો તમારો પ્લગઇન GitHub પર હોસ્ટ કરેલો છે, તો તમે પ્લેગ્રાઉન્ડ PR Preview GitHub Action નો ઉપયોગ કરીને તમારા pull requests માં સ્વચાલિતપણે પૂર્વદર્શન બટનો ઉમેરી શકો છો. આ સમીક્ષાકારોને કોઈ સેટআપ વિના તમારા પરિવર્તનો ચોક્કસ રીતે પરીક્ષણ કરવા દે છે. વધુ વિગતો માટે [GitHub Actions સાથે PR Preview બટનો ઉમેરવું](/guides/github-action-pr-preview) જુઓ.
:::

[<kbd> બ્લુપ્રિન્ટ ચલાવો </kbd>](https://playground.wordpress.net/#{%22landingPage%22:%22/wp-admin/admin.php?page=add-media-from-third-party-service%22,%22login%22:true,%22steps%22:[{%22step%22:%22installPlugin%22,%22pluginData%22:{%22resource%22:%22git:directory%22,%22url%22:%22https://github.com/wptrainingteam/devblog-dataviews-plugin%22,%22ref%22:%22HEAD%22,%22refType%22:%22refname%22}}],%22$schema%22:%22https://playground.wordpress.net/blueprint-schema.json%22,%22meta%22:{%22title%22:%22Empty%20Blueprint%22,%22author%22:%22https://github.com/akirk/playground-step-library%22}})

### GitHub માં ફાઈલ અથવા gist માં કોડ માંથી પ્લગઇન

[`ફાઈલ લખો`](/blueprints/steps#WriteFileStep) અને [`પ્લગઇન સક્રિય કરો`](/blueprints/steps#activatePlugin) પગલાંને જોડીને તમે પણ gist માં અથવા [GitHub માં ફાઇલ](https://raw.githubusercontent.com/WordPress/blueprints/trunk/blueprints/custom-post/books.php) માં સંગ્રહિત કોડમાંથી બનેલ પ્લગઈન સાથે WP પ્લેગ્રાઉન્ડ ઇન્સ્ટન્સ લોંચ કરી શકો છો:

```json
{
	"landingPage": "/wp-admin/plugins.php",
	"login": true,
	"steps": [
		{
			"step": "login"
		},
		{
			"step": "writeFile",
			"path": "/wordpress/wp-content/plugins/cpt-books.php",
			"data": {
				"resource": "url",
				"url": "https://raw.githubusercontent.com/WordPress/blueprints/trunk/blueprints/custom-post/books.php"
			}
		},
		{
			"step": "activatePlugin",
			"pluginPath": "cpt-books.php"
		}
	]
}
```

[<kbd> બ્લુપ્રિન્ટ ચલાવો </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/plugins.php%22,%22login%22:true,%22steps%22:[{%22step%22:%22login%22},{%22step%22:%22writeFile%22,%22path%22:%22/wordpress/wp-content/plugins/cpt-books.php%22,%22data%22:{%22resource%22:%22url%22,%22url%22:%22https://raw.githubusercontent.com/WordPress/blueprints/trunk/blueprints/custom-post/books.php%22}},{%22step%22:%22activatePlugin%22,%22pluginPath%22:%22cpt-books.php%22}]})

<div class="callout callout-info">

[Gist માંથી પ્લગઇન ઇન્સ્ટોલ કરો](https://playground.wordpress.net/builder/builder.html?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/install-plugin-from-gist/blueprint.json#{%22meta%22:{%22title%22:%22Install%20plugin%20from%20a%20gist%22,%22author%22:%22zieladam%22,%22description%22:%22Install%20and%20activate%20a%20WordPress%20plugin%20from%20a%20.php%20file%20stored%20in%20a%20gist.%22,%22categories%22:[%22plugins%22]},%22landingPage%22:%22/wp-admin/plugins.php%22,%22preferredVersions%22:{%22wp%22:%22beta%22,%22php%22:%228.0%22},%22steps%22:[{%22step%22:%22login%22},{%22step%22:%22writeFile%22,%22path%22:%22/wordpress/wp-content/plugins/0-plugin.php%22,%22data%22:{%22resource%22:%22url%22,%22url%22:%22https://gist.githubusercontent.com/ndiego/456b74b243d86c97cda89264c68cbdee/raw/ff00cf25e6eebe4f5a4eaecff10286f71e65340b/block-hooks-demo.php%22}},{%22step%22:%22activatePlugin%22,%22pluginName%22:%22Block%20Hooks%20Demo%22,%22pluginPath%22:%220-plugin.php%22}]}) ઉદાહરણ [બ્લુપ્રિન્ટ્સ ગેલેરી](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) માં દર્શાવેલ છે કે gist માંથી કોડમાંથી પ્લગઇન કેવી રીતે લોડ કરવું

</div>

## તમારા પ્લગઇન માટે બ્લુપ્રિન્ટ સાથે ડેમો સેટ અપ કરવું

જ્યારે વર્ડપ્રેસ પ્લેગ્રાઉન્ડ ઇન્સ્ટન્સમાં કેટલાક પ્લગઈન્સ સક્રિય કરેલા હોય તેવી લિંક પ્રદાન કરતી હો, તો તમે તે પ્લેગ્રાઉન્ડ ઇન્સ્ટન્સ માટે પ્રારંભિક સેટ અપ કસ્ટમાઇઝ કરવા માંગી શકો છો. પ્લેગ્રાઉન્ડ ના [બ્લુપ્રિન્ટ](/blueprints/getting-started) સાથે તમે પ્લગઈન્સ લોડ/સક્રિય કરી શકો છો અને પ્લેગ્રાઉન્ડ ઇન્સ્ટન્સ કોંફિગર કરી શકો છો.

:::tip

પ્લેગ્રાઉન્ડ પ્રોજેક્ટ દ્વારા પ્રદાન કરેલ કેટલાક ઉપયોગી સાધનો અને સંસાધનો છે:

- વાસ્તવિક-વિશ્વ કોડ ઉદાહરણો જોવા માટે [બ્લુપ્રિન્ટ્સ ગેલેરી](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) તપાસો વર્ડપ્રેસ પ્લેગ્રાઉન્ડ નો વિવિધ સેટ અપ સાથે વર્ડપ્રેસ સાઇટ લોંચ કરવા માટે.
- [વર્ડપ્રેસ પ્લેટ પ્લેટફોર્મ સ્ટેપ લાઇબ્રેરી](https://akirk.github.io/playground-step-library/#) સાધન બ્લુપ્રિન્ટ્ માટે પગલાંઓ ખેંચીને અથવા ક્લિક કરીને દ્રશ્ય ઇન્ટરફેસ પ્રદાન કરે છે. તમે તમારા પોતાના પગલાંઓ પણ બનાવી શકો છો!
- [બ્લુપ્રિન્ટ્સ બિલ્ડર](https://playground.wordpress.net/builder/builder.html) સાધન તમને તમારો બ્લુપ્રિન્ટ્ ઑનલાઇન સંપાદિત કરવા અને તેને સીધું પ્લેગ્રાઉન્ડ ઇન્સ્ટન્સમાં ચલાવવા દે છે.

:::

બ્લુપ્રિન્ટ્ ના ગુણધર્મો અને [`પગલાં`](/blueprints/steps) દ્વારા, તમે પ્લેગ્રાઉન્ડ ઇન્સ્ટન્સનું પ્રારંભિક સેટ કોંફિગર કરી શકો છો, તમારા પ્લગઈન્સને તમારા પ્લગઈનની આકર્ષણીય વૈશિષ્ટ્યો અને કાર્યક્ષમતા પ્રદર્શિત કરવા માટે જરૂરી સામગ્રી અને કોંફિગરેશન સાથે પ્રદાન કરે છે.

<div class="callout callout-info">

વર્ડપ્રેસ પ્લેગ્રાઉન્ડ સાથે મહાન ડેમો તમારે પ્લગઇન અને થીમ માટે ડિફોલ્ટ સામગ્રી લોડ કરવી પડશે, જેમાં ચિત્રો અને અન્ય એસેટ્સ શામેલ છે. વધુ જાણવા માટે [તમારા ડેમો માટે સામગ્રી પ્રદાન કરવું](/guides/providing-content-for-your-demo) માર્ગદર્શિકા તપાસો.

</div>

### `પ્લગઈન્સ`

જો તમારો પ્લગઇન અન્ય પ્લગઈન્સ પર આધારિત હોય તો તમે `પ્લગઈન્સ` શાર્ટહેન્ડનો ઉપયોગ કરીને તમારું અને જરૂરી અન્ય પ્લગઈન્સ ઇન્સ્ટોલ કરી શકો છો.

```json
{
	"landingPage": "/wp-admin/plugins.php",
	"plugins": ["gutenberg", "sql-buddy", "create-block-theme"],
	"login": true
}
```

[<kbd> બ્લુપ્રિન્ટ ચલાવો </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/plugins.php%22,%22plugins%22:[%22gutenberg%22,%22sql-buddy%22,%22create-block-theme%22],%22login%22:true})

### `ઉતરાણ પૃષ્ઠ`

જો તમારો પ્લગઇન સેટિંગ્સ દૃશ્ય અથવા ઓનબોર્ડિંગ વિઝાર્ડ ધરાવતો હોય તો તમે `ઉતરાણ પૃષ્ઠ` શાર્ટહેન્ડનો ઉપયોગ કરીને લોડ કરવા પર પ્લેગ્રાઉન્ડ ઇન્સ્ટન્સમાં કોઈપણ પૃષ્ઠ પર સ્વચાલિતપણે રીડાયરેક્ટ કરી શકો છો.

```json
{
	"landingPage": "/wp-admin/admin.php?page=my-custom-gutenberg-app",
	"login": true,
	"plugins": ["https://raw.githubusercontent.com/WordPress/block-development-examples/deploy/zips/data-basics-59c8f8.zip"]
}
```

[<kbd> બ્લુપ્રિન્ટ્ ચલાવો </kbd>](https://playground.wordpress.net/builder/builder.html#{%22landingPage%22:%22/wp-admin/admin.php?page=my-custom-gutenberg-app%22,%22login%22:true,%22plugins%22:[%22https://raw.githubusercontent.com/WordPress/block-development-examples/deploy/zips/data-basics-59c8f8.zip%22]})

### `ફાઈલ લખો`

[`ફાઈલ લખો` પગલું](/blueprints/steps#writeFile) સાથે તમે ઝાલીમાં ફાઇલો સૃષ્ટિ કર્યા વિના GitHub અથવા Gist પર સંગ્રહિત \*.php ફાઇલમાંથી સંગ્રહ કરેલ કોડને સંદર્ભીત કરીને કોઈપણ પ્લગઇન ફાઈલ બનાવી શકો છો.

અહીં **[Custom Post Types જનરેટ કરનાર પ્લગઇન](https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/custom-post/books.php)** નું ઉદાહરણ છે, જે `mu-plugins` ફોલ્ડરમાં મૂકવામાં આવ્યું છે તેથી કોડ લોડમાં સ્વચાલિતપણે ચલે છે:

```json
{
	"landingPage": "/wp-admin/",
	"login": true,
	"steps": [
		{
			"step": "writeFile",
			"path": "/wordpress/wp-content/mu-plugins/books.php",
			"data": {
				"resource": "url",
				"url": "https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/custom-post/books.php"
			}
		}
	]
}
```

## પ્લગઇન ડેવલપમેન્ટ

### પ્લેગ્રાઉન્ડ સાથે સ્થાનિક પ્લગઇન ડેવલપમેન્ટ અને પરીક્ષણ

તમારા સ્થાનિક વિકાસ પરિવેશમાં પ્લગઇન્સ ફોલ્ડરમાંથી, તમે તમારા પોતાના આદેશ લાઇન પ્રોગ્રામનો ઉપયોગ કરીને તમારા પ્લગઇન લોડ અને સક્રિય કરેલ પ્લેગ્રાઉન્ડ ઇન્સ્ટન્સ ઝડપથી લોડ કરી શકો છો.

તમારા પ્લગઇનના root ડિરેક્ટરીમાંથી [`@wp-playground/cli` આદેશ](/developers/local-development/wp-playground-cli) નો ઉપયોગ કરો.

[Visual Studio Code](https://code.visualstudio.com/) IDE સાથે, તમે તમારા પ્લગઇનના root ડિરેક્ટરીમાં કામ કરતી વખતે [Visual Studio Code એક્સટેન્શન](/developers/local-development/vscode-extension) નો પણ ઉપયોગ કરી શકો છો.

ઉદાહરણ તરીકે:

```bash
git clone git@github.com:wptrainingteam/devblog-dataviews-plugin.git
cd devblog-dataviews-plugin
npx @wp-playground/cli server --auto-mount
```

### તમારા સ્થાનિક પરિવર્તનો પ્લેગ્રાઉન્ડ ઇન્સ્ટન્સમાં જુઓ અને તમારા પરિવર્તનો સાથે GitHub repo માં સીધું PRs બનાવો

Google Chrome સાથે તમે પ્લેગ્રાઉન્ડ ઇન્સ્ટન્સને તમારા સ્થાનિક પ્લગઇનના કોડ અને તમારા પ્લગઇનના GitHub repo સાથે સિંક્રોનાઇઝ કરી શકો છો. આ જોડાણ સાથે તમે કરી શકો છો:

- તમારા સ્થાનિક પરિવર્તનો જીવંત જુઓ (પ્લેગ્રાઉન્ડ ઇન્સ્ટન્સમાં)
- GitHub repo માં તમારા પરિવર્તનો સાથે PRs બનાવો

અહીં આ વર્કફ્લો ક્રિયામાં માટે એક નાના ડેમો છે:

<iframe width="800" src="https://www.youtube.com/embed/UYK88eZqrjo" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
<p></p>

<div class="callout callout-info">

[પ્લેગ્રાઉન્ડ વિશે > Build > તમારા પ્લેગ્રાઉન્ડ ઇન્સ્ટન્સને સ્થાનિક ફોલ્ડર સાથે સમન્વય કરો અને GitHub Pull Requests બનાવો](/about/build#synchronize-your-playground-instance-with-a-local-folder-and-create-github-pull-requests) માટે વધુ માહિતી તપાસો.

</div>
