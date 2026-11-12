---
title: બ્લુપ્રિન્ટ્સ સાથે વર્ડપ્રેસમાં સામગ્રી ઇમ્પોર્ટ કરવી
slug: /guides/import-content-with-blueprints
description: નવા વર્ડપ્રેસ પ્લેગ્રાઉન્ડ ઇન્સ્ટન્સમાં સામગ્રી ઇમ્પોર્ટ કરવા માટે WXR, runPHP અને ZIP સ્નેપશોટની સરખામણી કરો.
---

<!--
# Importing content into WordPress with Blueprints
-->

# બ્લુપ્રિન્ટ્સ સાથે વર્ડપ્રેસમાં સામગ્રી ઇમ્પોર્ટ કરવી

<!--
A new WordPress Playground site starts with basic content. A Blueprint can help
fill that gap from a WordPress export file, generate content with WordPress APIs,
or restore a Playground ZIP snapshot.
-->

એક નવી વર્ડપ્રેસ પ્લેગ્રાઉન્ડ સાઇટ મૂળભૂત સામગ્રી (basic content) સાથે શરૂ થાય છે. બ્લુપ્રિન્ટ (Blueprint) વર્ડપ્રેસ એક્સપોર્ટ ફાઇલમાંથી ડેટા મેળવીને, વર્ડપ્રેસ API વડે સામગ્રી જનરેટ કરીને, અથવા પ્લેગ્રાઉન્ડ ZIP સ્નેપશોટને રિસ્ટોર કરીને તે ખાલી જગ્યા ભરવામાં મદદ કરી શકે છે.

<!--
This guide focuses on choosing a Blueprint content import method and presents a
small benchmark comparing three approaches. Importing data can be useful for
theme starter content, test fixtures, educational content, and other
demo-building strategies. For more options, see
[Providing content for your demo with Playground](/guides/providing-content-for-your-demo).
-->

આ માર્ગદર્શિકા બ્લુપ્રિન્ટ કન્ટેન્ટ ઇમ્પોર્ટ કરવાની પદ્ધતિ પસંદ કરવા પર ધ્યાન કેન્દ્રિત કરે છે અને ત્રણ અભિગમોની સરખામણી કરતો એક નાનો બેન્ચમાર્ક (benchmark) રજૂ કરે છે. થીમ સ્ટાર્ટર કન્ટેન્ટ, ટેસ્ટ ફિક્સ્ચર્સ, શૈક્ષણિક સામગ્રી અને અન્ય ડેમો-બિલ્ડિંગ વ્યૂહરચનાઓ માટે ડેટા ઇમ્પોર્ટ કરવો ઉપયોગી સાબિત થઈ શકે છે. વધુ વિકલ્પો માટે, [પ્લેગ્રાઉન્ડ સાથે તમારા ડેમો માટે સામગ્રી પૂરી પાડવી](/guides/providing-content-for-your-demo) જુઓ.

<!--
These approaches solve different problems:
-->

આ અભિગમો વિવિધ સમસ્યાઓનું નિરાકરણ કરે છે:

<!--
| Method                                                                        | Best for                                                                             | What it moves                                                                                 |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| [`importWxr`](#import-a-wordpress-xml-export-with-importwxr)                  | Portable content shared between WordPress sites without overwriting existing content | Posts, pages, custom post types, terms, authors, comments, and attachment references          |
| [`runPHP`](#generate-content-with-runphp)                                     | Small, deterministic fixtures and content that needs custom logic                    | Anything the PHP code creates through WordPress APIs                                          |
| [`importWordPressFiles`](#restore-a-playground-zip-with-importwordpressfiles) | Restoring a complete Playground demo                                                 | The database and any WordPress files present in the ZIP, such as plugins, themes, and uploads |
-->

| પદ્ધતિ (Method)                                                                | આના માટે શ્રેષ્ઠ છે                                                                    | તે શું ટ્રાન્સફર કરે છે                                                                      |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| [`importWxr`](#import-a-wordpress-xml-export-with-importwxr)                  | હાલની સામગ્રીને ઓવરરાઇટ કર્યા વિના વર્ડપ્રેસ સાઇટ્સ વચ્ચે શેર કરવા યોગ્ય પોર્ટેબલ સામગ્રી | પોસ્ટ્સ, પેજિસ, કસ્ટમ પોસ્ટ ટાઇપ્સ, ટર્મ્સ, લેખકો (authors), ટિપ્પણીઓ (comments) અને એટેચમેન્ટ સંદર્ભો |
| [`runPHP`](#generate-content-with-runphp)                                     | નાના, ચોક્કસ (deterministic) ફિક્સ્ચર્સ અને કસ્ટમ લૉજિકની જરૂર હોય તેવી સામગ્રી       | વર્ડપ્રેસ APIs દ્વારા PHP કોડ જે પણ બનાવે છે તે બધું                                         |
| [`importWordPressFiles`](#restore-a-playground-zip-with-importwordpressfiles) | સંપૂર્ણ પ્લેગ્રાઉન્ડ ડેમો રિસ્ટોર કરવા માટે                                            | ડેટાબેઝ અને ZIP માં હાજર કોઈપણ વર્ડપ્રેસ ફાઇલો, જેમ કે પ્લગઇન્સ, થીમ્સ અને અપલોડ્સ            |

<!--
If you only need posts and terms, start with WXR. If the content is generated or
depends on setup logic, use `runPHP`. If the database, media, plugins, themes,
and settings must be restored together, use a ZIP snapshot.
-->

જો તમને ફક્ત પોસ્ટ્સ અને ટર્મ્સની જરૂર હોય, તો WXR થી શરૂઆત કરો. જો સામગ્રી જનરેટ કરવામાં આવી હોય અથવા સેટઅપ લૉજિક પર આધાર રાખતી હોય, તો `runPHP` નો ઉપયોગ કરો. જો ડેટાબેઝ, મીડિયા, પ્લગઇન્સ, થીમ્સ અને સેટિંગ્સ એકસાથે રિસ્ટોર કરવાના હોય, તો ZIP સ્નેપશોટનો ઉપયોગ કરો.

<!--
## Import a WordPress XML export with `importWxr`
-->

## `importWxr` સાથે વર્ડપ્રેસ XML એક્સપોર્ટ ઇમ્પોર્ટ કરવું {#import-a-wordpress-xml-export-with-importwxr}

<!--
WordPress calls its XML export format WordPress eXtended RSS, or WXR. Create one
from **Tools > Export** in an existing WordPress site, then pass it to the
[`importWxr` step](/blueprints/steps).
-->

વર્ડપ્રેસ તેના XML એક્સપોર્ટ ફોર્મેટને WordPress eXtended RSS, અથવા WXR કહે છે. હાલની વર્ડપ્રેસ સાઇટમાં **Tools > Export** પરથી ફાઇલ બનાવો, અને પછી તેને [`importWxr` સ્ટેપ](/blueprints/steps) માં પાસ કરો.

<!--
This example expects `content.xml` next to `blueprint.json` in a
[Blueprint bundle](/blueprints/bundles):
-->

આ ઉદાહરણ [બ્લુપ્રિન્ટ બંડલ](/blueprints/bundles) માં `blueprint.json` ની બાજુમાં `content.xml` હોવાની અપેક્ષા રાખે છે:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"landingPage": "/wp-admin/edit.php",
	"preferredVersions": {
		"php": "8.3",
		"wp": "latest"
	},
	"login": true,
	"steps": [
		{
			"step": "importWxr",
			"file": {
				"resource": "bundled",
				"path": "/content.xml"
			},
			"fetchAttachments": false,
			"rewriteUrls": true,
			"importComments": false,
			"authorsMode": "default-author",
			"defaultAuthorUsername": "admin"
		}
	]
}
```

<!--
For a hosted file, replace the `bundled` resource with a
[`url` resource](/blueprints/steps/resources#urlreference). Set
`fetchAttachments` to `true` when the importer must download the media files
referenced by the WXR file. Network transfer can dominate the total setup time,
so the benchmark later in this guide disables attachment fetching.
-->

હોસ્ટ કરેલી ફાઇલ માટે, `bundled` રિસોર્સને [`url` રિસોર્સ](/blueprints/steps/resources#urlreference) સાથે બદલો. જ્યારે ઇમ્પોર્ટરે WXR ફાઇલ દ્વારા સંદર્ભિત મીડિયા ફાઇલો ડાઉનલોડ કરવાની હોય ત્યારે `fetchAttachments` ને `true` પર સેટ કરો. નેટવર્ક ટ્રાન્સફર કુલ સેટઅપ સમય પર નોંધપાત્ર અસર કરી શકે છે, તેથી આ માર્ગદર્શિકામાં આગળનો બેન્ચમાર્ક એટેચમેન્ટ ફેચિંગને અક્ષમ રાખે છે.

<!--
`importWxr` can also map imported authors to local users, create users, and
apply explicit URL replacements. See the
[`importWxr` options](/blueprints/steps) before importing content from
another domain.
-->

`importWxr` ઇમ્પોર્ટ કરેલા લેખકોને લોકલ યુઝર્સ સાથે મેપ કરી શકે છે, યુઝર્સ બનાવી શકે છે અને સ્પષ્ટ URL રિપ્લેસમેન્ટ લાગુ કરી શકે છે. અન્ય ડોમેનમાંથી સામગ્રી ઇમ્પોર્ટ કરતાં પહેલાં [`importWxr` વિકલ્પો](/blueprints/steps) જુઓ.

<!--
### Pros
-->

### ફાયદા (Pros)

<!--
- Uses WordPress's standard, portable content exchange format.
- Preserves post types, taxonomies, post meta, authors, comments, and content
  relationships represented in the export.
- Can fetch attachments and rewrite old content URLs for the new site.
- Keeps content separate from the destination's WordPress core, plugins,
  themes, and most site settings.
- Is easy to inspect, version, and edit manually in any text editor because the
  source is XML.
-->

- વર્ડપ્રેસના પ્રમાણભૂત, પોર્ટેબલ કન્ટેન્ટ એક્સચેન્જ ફોર્મેટનો ઉપયોગ કરે છે.
- એક્સપોર્ટમાં રજૂ કરાયેલ પોસ્ટ ટાઇપ્સ, ટેક્સૉનોમીઝ, પોસ્ટ મેટા, લેખકો, ટિપ્પણીઓ અને સામગ્રી સંબંધો (content relationships) જાળવી રાખે છે.
- નવી સાઇટ માટે એટેચમેન્ટ્સ મેળવી શકે છે અને જૂના કન્ટેન્ટના URLs ને ફરીથી લખી (rewrite) શકે છે.
- સામગ્રીને લક્ષ્ય સાઇટના વર્ડપ્રેસ કોર, પ્લગઇન્સ, થીમ્સ અને મોટાભાગના સાઇટ સેટિંગ્સથી અલગ રાખે છે.
- સોર્સ XML હોવાથી કોઈપણ ટેક્સ્ટ એડિટરમાં મેન્યુઅલી તપાસવું, વર્ઝનિંગ કરવું અને સંપાદિત કરવું સરળ છે.

<!--
### Cons
-->

### ગેરફાયદા (Cons)

<!--
- Does not clone the whole site. Plugins, themes, plugin tables, options, and
  files that are not represented in WXR need separate Blueprint steps.
- Attachment imports require network access and depend on the old media URLs
  remaining available.
- Large XML files use more parsing time and memory than restoring an existing
  SQLite database.
- Re-importing is additive, not a synchronization. The importer creates terms
  it cannot find and never removes existing content; it only skips a post when
  an existing one matches its title, author, and date.
- The Blueprint installs the WordPress Importer dependency automatically, which
  adds setup work before the WXR import starts.
-->

- આખી સાઇટને ક્લોન કરતું નથી. પ્લગઇન્સ, થીમ્સ, પ્લગઇન ટેબલ્સ, ઓપ્શન્સ અને ફાઇલો જે WXR માં રજૂ થતી નથી તેના માટે અલગ બ્લુપ્રિન્ટ સ્ટેપ્સની જરૂર પડે છે.
- એટેચમેન્ટ ઇમ્પોર્ટ માટે નેટવર્ક ઍક્સેસની જરૂર પડે છે અને તે જૂના મીડિયા URLs ઉપલબ્ધ રહેવા પર આધારિત છે.
- મોટી XML ફાઇલો હાલના SQLite ડેટાબેઝને રિસ્ટોર કરવા કરતાં વધુ પાર્સિંગ સમય અને મેમરી વાપરે છે.
- ફરીથી ઇમ્પોર્ટ કરવું એ ઉમેરાત્મક (additive) છે, સિંક્રનાઇઝેશન નથી. ઇમ્પોર્ટર તેને ન મળતી ટર્મ્સ બનાવે છે અને અસ્તિત્વમાં રહેલી સામગ્રીને ક્યારેય દૂર કરતું નથી; તે ફક્ત ત્યારે જ પોસ્ટને અવગણે છે જ્યારે હાલની પોસ્ટ તેના શીર્ષક, લેખક અને તારીખ સાથે મેળ ખાતી હોય.
- બ્લુપ્રિન્ટ WordPress Importer ડિપેન્ડન્સી આપમેળે ઇન્સ્ટોલ કરે છે, જે WXR ઇમ્પોર્ટ શરૂ થાય તે પહેલાં સેટઅપ કાર્ય વધારે છે.

<!--
## Generate content with `runPHP`
-->

## `runPHP` સાથે સામગ્રી જનરેટ કરવી {#generate-content-with-runphp}

<!--
The [`runPHP` step](/blueprints/steps) can call WordPress APIs directly.
Always load `/wordpress/wp-load.php` before calling functions such as
`wp_insert_post()`.
-->

[`runPHP` સ્ટેપ](/blueprints/steps) સીધા જ વર્ડપ્રેસ APIs ને કૉલ કરી શકે છે. `wp_insert_post()` જેવા ફંક્શન્સને કૉલ કરતાં પહેલાં હંમેશા `/wordpress/wp-load.php` લોડ કરો.

<!--
The following example creates the 100 posts used by the benchmark:
-->

નીચેનું ઉદાહરણ બેન્ચમાર્ક દ્વારા ઉપયોગમાં લેવાતી 100 પોસ્ટ્સ બનાવે છે:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"landingPage": "/wp-admin/edit.php",
	"preferredVersions": {
		"php": "8.3",
		"wp": "latest"
	},
	"login": true,
	"steps": [
		{
			"step": "runPHP",
			"code": "<?php\nrequire_once '/wordpress/wp-load.php';\n\nfor ( $index = 1; $index <= 100; $index++ ) {\n\t$result = wp_insert_post(\n\t\tarray(\n\t\t\t'post_title'   => 'Benchmark post ' . $index,\n\t\t\t'post_content' => '<!-- wp:paragraph --><p>Blueprint import benchmark content.</p><!-- /wp:paragraph -->',\n\t\t\t'post_status'  => 'publish',\n\t\t\t'post_type'    => 'post',\n\t\t),\n\t\ttrue\n\t);\n\tif ( is_wp_error( $result ) ) {\n\t\tthrow new RuntimeException( $result->get_error_message() );\n\t}\n}"
		}
	]
}
```

<!--
For larger programs, keep the code in a small plugin or split the setup across
focused steps instead of maintaining a very long JSON string. Use WordPress
APIs rather than writing directly to database tables so hooks, caches, and data
validation still run. Keep in mind that the code is not limited to content:
`runPHP` can do anything PHP can, including overwriting options or modifying
the database directly.
-->

મોટા પ્રોગ્રામ્સ માટે, ખૂબ લાંબી JSON સ્ટ્રિંગ જાળવવાને બદલે કોડને નાના પ્લગઇનમાં રાખો અથવા સેટઅપને ચોક્કસ સ્ટેપ્સમાં વિભાજિત કરો. ડેટાબેઝ ટેબલ્સમાં સીધું લખવાને બદલે વર્ડપ્રેસ APIs નો ઉપયોગ કરો જેથી હુક્સ (hooks), કેશ (caches) અને ડેટા વેલિડેશન યોગ્ય રીતે ચાલે. ધ્યાનમાં રાખો કે કોડ માત્ર સામગ્રી પૂરતો મર્યાદિત નથી: PHP જે કરી શકે છે તે બધું `runPHP` કરી શકે છે, જેમાં ઓપ્શન્સને ઓવરરાઇટ કરવું અથવા ડેટાબેઝમાં સીધો ફેરફાર કરવાનો પણ સમાવેશ થાય છે.

<!--
### Pros
-->

### ફાયદા (Pros)

<!--
- Provides complete control over the generated data and its relationships.
- Requires no content file and no network access.
- Can configure options, post meta, users, taxonomies, and plugin-specific data
  in the same operation.
- Works well for small test fixtures whose source of truth should remain code.
- Can be made idempotent by looking up existing records before creating them.
-->

- જનરેટ કરેલા ડેટા અને તેના સંબંધો પર સંપૂર્ણ નિયંત્રણ પ્રદાન કરે છે.
- કોઈ કન્ટેન્ટ ફાઇલ અથવા નેટવર્ક ઍક્સેસની જરૂર પડતી નથી.
- એક જ ઑપરેશનમાં ઑપ્શન્સ, પોસ્ટ મેટા, યુઝર્સ, ટેક્સૉનોમીઝ અને પ્લગઇન-વિશિષ્ટ ડેટા ગોઠવી શકે છે.
- નાના ટેસ્ટ ફિક્સ્ચર્સ માટે ઉત્તમ કાર્ય કરે છે જેનું સત્ય સ્રોત (source of truth) કોડ જ રહેવું જોઈએ.
- નવા રેકોર્ડ્સ બનાવતાં પહેલાં હાલના રેકોર્ડ્સ શોધીને આને આઇડેમ્પોટન્ટ (idempotent - પુનરાવર્તનથી ડુપ્લિકેટ ન બને તેવું) બનાવી શકાય છે.

<!--
### Cons
-->

### ગેરફાયદા (Cons)

<!--
- A Blueprint is trusted input. Only run PHP from a source you trust.
- The script must handle errors, reruns, dependencies, and partial failures.
- Code can become coupled to a plugin's APIs or database model.
- Creating many records one at a time still runs WordPress hooks and database
  writes for every record, so performance degrades as the dataset grows.
- Custom PHP is more verbose than exporting existing editorial content.
-->

- બ્લુપ્રિન્ટ એ વિશ્વસનીય ઇનપુટ છે. તમે વિશ્વાસ કરતા હોવ તેવા સ્ત્રોતમાંથી જ PHP ચલાવો.
- સ્ક્રિપ્ટે ભૂલો, પુનઃરન (reruns), ડિપેન્ડન્સીઝ અને આંશિક નિષ્ફળતાઓને સંભાળવી પડે છે.
- કોડ પ્લગઇનના APIs અથવા ડેટાબેઝ મોડેલ સાથે જોડાયેલો (coupled) બની શકે છે.
- એક પછી એક ઘણા રેકોર્ડ્સ બનાવવાથી દરેક રેકોર્ડ માટે વર્ડપ્રેસ હુક્સ અને ડેટાબેઝ રાઇટ્સ રન થાય છે, તેથી ડેટાસેટ વધવાની સાથે પર્ફોર્મન્સ ધીમું પડી શકે છે.
- હાલની એડિટોરિયલ સામગ્રી એક્સપોર્ટ કરવા કરતાં કસ્ટમ PHP લખવું વધુ લાંબુ (verbose) છે.

<!--
## Restore a Playground ZIP with `importWordPressFiles`
-->

## `importWordPressFiles` સાથે પ્લેગ્રાઉન્ડ ZIP રિસ્ટોર કરવું {#restore-a-playground-zip-with-importwordpressfiles}

<!--
The [`importWordPressFiles` step](/blueprints/steps) is a
site restore, not a content-only import. It unpacks top-level WordPress files
from a ZIP and replaces the corresponding paths in the new instance. A ZIP
created with Playground's **Download as zip** option includes `wp-content`, its
SQLite database, uploads, and a manifest used to adjust Playground scope URLs.
-->

[`importWordPressFiles` સ્ટેપ](/blueprints/steps) એ સાઇટ રિસ્ટોર છે, માત્ર-સામગ્રી ઇમ્પોર્ટ નથી. તે ZIP માંથી ટોપ-લેવલ વર્ડપ્રેસ ફાઇલોને અનપેક કરે છે અને નવા ઇન્સ્ટન્સમાં અનુરૂપ પાથ બદલે છે. પ્લેગ્રાઉન્ડના **Download as zip** વિકલ્પ વડે બનાવેલી ZIP માં `wp-content`, તેનો SQLite ડેટાબેઝ, અપલોડ્સ અને પ્લેગ્રાઉન્ડ સ્કોપ URLs ને એડજસ્ટ કરવા માટે વપરાતું મેનિફેસ્ટ શામેલ હોય છે.

<!--
Place the downloaded file next to `blueprint.json` and reference it as a bundled
resource:
-->

ડાઉનલોડ કરેલી ફાઇલને `blueprint.json` ની બાજુમાં મૂકો અને તેને બંડલ્ડ રિસોર્સ તરીકે સંદર્ભિત કરો:

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"landingPage": "/",
	"preferredVersions": {
		"php": "8.3",
		"wp": "latest"
	},
	"login": true,
	"steps": [
		{
			"step": "importWordPressFiles",
			"wordPressFilesZip": {
				"resource": "bundled",
				"path": "/site.zip"
			}
		}
	]
}
```

<!--
The ZIP may contain `wp-content` only, a complete WordPress directory, or a
WordPress directory nested inside a wrapper folder. Use `pathInZip` when the
archive contains several sites or when automatic root detection is not enough.
-->

ZIP માં ફક્ત `wp-content`, સંપૂર્ણ વર્ડપ્રેસ ડિરેક્ટરી, અથવા રેપર (wrapper) ફોલ્ડરની અંદર નેસ્ટેડ વર્ડપ્રેસ ડિરેક્ટરી હોઈ શકે છે. જ્યારે આર્કાઇવમાં ઘણી સાઇટ્સ હોય અથવા જ્યારે ઓટોમેટિક રૂટ ડિટેક્શન પૂરતું ન હોય ત્યારે `pathInZip` નો ઉપયોગ કરો.

<!--
Keep the source and destination WordPress, PHP, theme, and plugin versions
compatible. The step upgrades the imported database and adjusts Playground
scope URLs, but it is not a general migration tool for arbitrary production
server configurations.
-->

સોર્સ અને ડેસ્ટિનેશન વર્ડપ્રેસ, PHP, થીમ અને પ્લગઇન વર્ઝનને સુસંગત (compatible) રાખો. આ સ્ટેપ ઇમ્પોર્ટ કરેલા ડેટાબેઝને અપગ્રેડ કરે છે અને પ્લેગ્રાઉન્ડ સ્કોપ URLs ને સમાયોજિત કરે છે, પરંતુ તે મનસ્વી પ્રોડક્શન સર્વર કન્ફિગરેશન્સ માટે સામાન્ય સ્થળાંતર (migration) સાધન નથી.

<!--
### Pros
-->

### ફાયદા (Pros)

<!--
- Restores the database, uploads, plugins, themes, and settings together.
- Preserves plugin-specific tables and options that WXR cannot represent.
- Avoids recreating every post through WordPress APIs, which can be efficient
  for a prepared, repeatable demo.
- Works offline when the snapshot is bundled with the Blueprint.
- Produces the closest copy of the source Playground instance.
-->

- ડેટાબેઝ, અપલોડ્સ, પ્લગઇન્સ, થીમ્સ અને સેટિંગ્સને એકસાથે રિસ્ટોર કરે છે.
- પ્લગઇન-વિશિષ્ટ ટેબલ્સ અને ઑપ્શન્સને સાચવી રાખે છે જેને WXR રજૂ કરી શકતું નથી.
- વર્ડપ્રેસ APIs દ્વારા દરેક પોસ્ટને ફરીથી બનાવવાનું ટાળે છે, જે તૈયાર, પુનરાવર્તિત ડેમો માટે કાર્યક્ષમ હોઈ શકે છે.
- જ્યારે સ્નેપશોટ બ્લુપ્રિન્ટ સાથે બંડલ કરવામાં આવે ત્યારે ઑફલાઇન કાર્ય કરે છે.
- સોર્સ પ્લેગ્રાઉન્ડ ઇન્સ્ટન્સની સૌથી સચોટ કૉપિ તૈયાર કરે છે.

<!--
### Cons
-->

### ગેરફાયદા (Cons)

<!--
- Replaces any top-level paths present in the ZIP, so it can overwrite existing
  site state rather than merge content into it.
- Is larger, opaque, and harder to review or resolve in version-control merges.
- Couples the snapshot to its WordPress, PHP, theme, plugin, and database
  versions more tightly than WXR.
- Is unsuitable for importing selected posts into an existing site.
- Must only be restored from a trusted source; it can contain executable PHP
  and an entire database.
-->

- ZIP માં હાજર કોઈપણ ટોપ-લેવલ પાથને બદલે છે, તેથી તે સામગ્રીને મર્જ કરવાને બદલે હાલની સાઇટ સ્થિતિને ઓવરરાઇટ કરી શકે છે.
- તે મોટું, અપારદર્શક (opaque) છે અને વર્ઝન-કંટ્રોલ મર્જમાં રિવ્યૂ કરવું કે ઉકેલવું વધુ મુશ્કેલ છે.
- WXR ની તુલનામાં સ્નેપશોટને તેના વર્ડપ્રેસ, PHP, થીમ, પ્લગઇન અને ડેટાબેઝ વર્ઝન સાથે વધુ ચુસ્તપણે જોડે છે.
- અસ્તિત્વમાં રહેલી સાઇટમાં પસંદગીની પોસ્ટ્સ ઇમ્પોર્ટ કરવા માટે અયોગ્ય છે.
- ફક્ત વિશ્વસનીય સ્ત્રોતમાંથી જ રિસ્ટોર થવું જોઈએ; તેમાં એક્ઝિક્યુટેબલ PHP અને આખો ડેટાબેઝ હોઈ શકે છે.

<!--
### Test results for the different methods
-->

### વિવિધ પદ્ધતિઓ માટેના પરીક્ષણ પરિણામો (Test results for the different methods)

<!--
The following test results were measured on July 13, 2026, on an Apple M4 Pro with
24 GB of memory. It used Node.js 22.16, WordPress 7.0, PHP 8.3, 100 posts,
and five fresh-site rounds per method:
-->

નીચેના પરીક્ષણ પરિણામો 13 જુલાઈ, 2026 ના રોજ 24 GB મેમરી ધરાવતા Apple M4 Pro પર માપવામાં આવ્યા હતા. તેમાં Node.js 22.16, WordPress 7.0, PHP 8.3, 100 પોસ્ટ્સ અને પદ્ધતિ દીઠ પાંચ નવી-સાઇટ રાઉન્ડનો ઉપયોગ કરવામાં આવ્યો હતો:

<!--
| Method                       |     Input size | Median | Minimum | Maximum | Relative to fastest |
| ---------------------------- | -------------: | -----: | ------: | ------: | ------------------: |
| XML / `importWxr`            |      106.0 KiB | 2.21 s |  2.16 s |  2.25 s |               6.90x |
| PHP / `runPHP`               | Generated code | 2.78 s |  2.76 s |  2.80 s |               8.68x |
| ZIP / `importWordPressFiles` |       50.5 KiB | 320 ms |  318 ms |  322 ms |               1.00x |
-->

| પદ્ધતિ (Method)              | ઇનપુટ સાઇઝ (Input size) | મધ્યક (Median) | ન્યૂનતમ (Minimum) | મહત્તમ (Maximum) | સૌથી ઝડપીની સરખામણીમાં (Relative to fastest) |
| ---------------------------- | ----------------------: | -------------: | ----------------: | ---------------: | -------------------------------------------: |
| XML / `importWxr`            |               106.0 KiB |         2.21 s |            2.16 s |           2.25 s |                                        6.90x |
| PHP / `runPHP`               |          Generated code |         2.78 s |            2.76 s |           2.80 s |                                        8.68x |
| ZIP / `importWordPressFiles` |                50.5 KiB |         320 ms |            318 ms |           322 ms |                                        1.00x |

<!--
Treat these values as a reference from one machine, not a universal ranking.
The dataset shape matters: attachments favor a self-contained ZIP, complex
WordPress hooks can slow `runPHP`, and WXR's portability may be more important
than raw speed.
-->

આ મૂલ્યોને એક મશીનના સંદર્ભ તરીકે ગણો, સાર્વત્રિક રેન્કિંગ તરીકે નહીં. ડેટાસેટનું સ્વરૂપ મહત્વનું છે: એટેચમેન્ટ્સ સેલ્ફ-કન્ટેઇન્ડ ZIP માટે વધુ અનુકૂળ રહે છે, જટિલ વર્ડપ્રેસ હુક્સ `runPHP` ને ધીમું કરી શકે છે, અને WXR ની પોર્ટેબિલિટી કદાચ કાચી ઝડપ (raw speed) કરતાં વધુ મહત્વપૂર્ણ હોઈ શકે છે.

<!--
## Other content sources
-->

## અન્ય સામગ્રી સ્ત્રોતો (Other content sources)

<!--
Blueprints also support [`importThemeStarterContent`](/blueprints/steps)
for a theme's registered starter content and the
[`wp-cli` step](/blueprints/steps) for commands such as
`wp post generate`. They are useful when the theme or WP-CLI command is already
the canonical source of the demo data, but they are outside this content import
benchmark.
-->

બ્લુપ્રિન્ટ્સ થીમના રજિસ્ટર્ડ સ્ટાર્ટર કન્ટેન્ટ માટે [`importThemeStarterContent`](/blueprints/steps) અને `wp post generate` જેવા કમાન્ડ્સ માટે [`wp-cli` સ્ટેપ](/blueprints/steps) ને પણ સપોર્ટ કરે છે. જ્યારે થીમ અથવા WP-CLI કમાન્ડ પહેલેથી જ ડેમો ડેટાનો પ્રમાણભૂત સ્ત્રોત હોય ત્યારે તેઓ ઉપયોગી છે, પરંતુ તેઓ આ સામગ્રી ઇમ્પોર્ટ બેન્ચમાર્કની બહાર છે.
