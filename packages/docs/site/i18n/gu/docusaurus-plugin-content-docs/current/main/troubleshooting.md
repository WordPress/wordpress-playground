---
title: ટ્રબલશૂટિંગ
slug: /troubleshooting
description: બુટ નિષ્ફળતાઓ, SQLite સમસ્યાઓ, બ્રાઉઝર સ્ટોરેજ અને સેવ કરેલ પ્લેગ્રાઉન્ડ પુનઃપ્રાપ્તિ સહિત સામાન્ય વર્ડપ્રેસ પ્લેગ્રાઉન્ડ વેબસાઇટ ભૂલોનું નિદાન કરો.
---

<!--
# Troubleshooting WordPress Playground
-->

# વર્ડપ્રેસ પ્લેગ્રાઉન્ડ ટ્રબલશૂટિંગ

<!--
This page covers errors from the Playground website itself, saved Playgrounds,
browser storage, and WordPress boot. For Blueprint-specific errors, see
[Troubleshoot and debug Blueprints](/blueprints/troubleshoot-and-debug).
-->

આ પેજ પ્લેગ્રાઉન્ડ વેબસાઇટ, સેવ કરેલા પ્લેગ્રાઉન્ડ્સ, બ્રાઉઝર સ્ટોરેજ અને વર્ડપ્રેસ બુટ (boot) સંબંધિત ભૂલોને આવરી લે છે. બ્લુપ્રિન્ટ સંબંધિત ચોક્કસ ભૂલો માટે, [બ્લુપ્રિન્ટ્સ ટ્રબલશૂટ અને ડિબગ કરો](/blueprints/troubleshoot-and-debug) જુઓ.

<!--
## Playground looks broken
-->

## પ્લેગ્રાઉન્ડ બરાબર કામ કરતું નથી

<!--
Try these first:
-->

સૌ પ્રથમ આ ઉપાયો અજમાવી જુઓ:

<!--
- Use the Playground **Refresh page** button instead of refreshing the browser tab. Browser refresh (Cmd+R or F5) starts the whole Playground app again.
- Open the same URL in a private window to rule out saved-site or browser-storage state.
- Disable browser extensions that block JavaScript, WebAssembly, storage, workers, or network requests.
- Check browser developer tools for Console and Network errors.
- If the URL includes `?site-slug=...`, try removing that query parameter to start a new autosaved Playground. Use `?storage=temp` when you need a truly temporary site.
-->

- બ્રાઉઝર ટેબને રિફ્રેશ કરવાને બદલે પ્લેગ્રાઉન્ડના **Refresh page** (પેજ રિફ્રેશ કરો) બટનનો ઉપયોગ કરો. બ્રાઉઝર રિફ્રેશ (Cmd+R અથવા F5) કરવાથી આખી પ્લેગ્રાઉન્ડ એપ ફરીથી શરૂ થાય છે.
- સેવ કરેલી સાઇટ અથવા બ્રાઉઝર સ્ટોરેજની સ્થિતિને ચકાસવા માટે આ જ URL ને પ્રાઇવેટ વિન્ડોમાં ખોલો.
- JavaScript, WebAssembly, સ્ટોરેજ, વર્કર્સ અથવા નેટવર્ક વિનંતીઓ (network requests) ને અવરોધતા બ્રાઉઝર એક્સટેન્શન્સને અક્ષમ (disable) કરો.
- Console અને Network ભૂલો માટે બ્રાઉઝર ડેવલપર ટૂલ્સ તપાસો.
- જો URL માં `?site-slug=...` શામેલ હોય, તો નવું ઓટોસેવ થયેલું પ્લેગ્રાઉન્ડ શરૂ કરવા માટે તે ક્વેરી પેરામીટરને દૂર કરવાનો પ્રયાસ કરો. જ્યારે તમને ખરેખર અસ્થાયી (temporary) સાઇટની જરૂર હોય ત્યારે `?storage=temp` નો ઉપયોગ કરો.

<!--
## A clean site says the MySQL extension is missing
-->

## નવી સાઇટ પર MySQL એક્સ્ટેન્શન ખૂટે છે તેવો સંદેશ દેખાય છે

<!--
You may see a WordPress error page like this:
-->

તમને આ પ્રકારનું વર્ડપ્રેસ એરર પેજ દેખાઈ શકે છે:

<!--
```text
Your PHP installation appears to be missing the MySQL extension which is required by WordPress.
```
-->

```text
Your PHP installation appears to be missing the MySQL extension which is required by WordPress.
```

<!--
In Playground, this usually means WordPress did not load the SQLite integration
that lets WordPress run without MySQL. Playground runs WordPress in WebAssembly
and uses SQLite instead of a MySQL server.
-->

પ્લેગ્રાઉન્ડમાં, આનો સામાન્ય અર્થ એ છે કે વર્ડપ્રેસે SQLite ઇન્ટિગ્રેશન લોડ કર્યું નથી જે વર્ડપ્રેસને MySQL વિના ચલાવવાની મંજૂરી આપે છે. પ્લેગ્રાઉન્ડ વર્ડપ્રેસને WebAssembly માં ચલાવે છે અને MySQL સર્વરને બદલે SQLite નો ઉપયોગ કરે છે.

<!--
Try these steps:
-->

આ પગલાં અજમાવી જુઓ:

<!--
- Start a fresh Playground at https://playground.wordpress.net/ to confirm the public site can boot.
- If the URL includes a saved site, remove `?site-slug=...` and load a new Playground. Add `?storage=temp` only when you need an ephemeral site.
- If this happened after importing a ZIP, confirm the import did not include a custom `wp-content/db.php` that overrides Playground's SQLite setup.
- If this happened in the CLI, do not use `--skip-sqlite-setup` unless you provide your own database integration.
- If this happened with a Blueprint, see the [Blueprint troubleshooting page](/blueprints/troubleshoot-and-debug).
-->

- સાર્વજનિક સાઇટ બુટ થઈ શકે છે તેની ખાતરી કરવા માટે https://playground.wordpress.net/ પર નવું પ્લેગ્રાઉન્ડ શરૂ કરો.
- જો URL માં સેવ કરેલી સાઇટ શામેલ હોય, તો `?site-slug=...` દૂર કરો અને નવું પ્લેગ્રાઉન્ડ લોડ કરો. જ્યારે તમને અસ્થાયી સાઇટની જરૂર હોય ત્યારે જ `?storage=temp` ઉમેરો.
- જો આવું ZIP ઇમ્પોર્ટ કર્યા પછી થયું હોય, તો ખાતરી કરો કે ઇમ્પોર્ટમાં કસ્ટમ `wp-content/db.php` શામેલ નથી જે પ્લેગ્રાઉન્ડના SQLite સેટઅપને ઓવરરાઇડ કરે છે.
- જો આવું CLI માં થયું હોય, જ્યાં સુધી તમે તમારું પોતાનું ડેટાબેઝ ઇન્ટિગ્રેશન પ્રદાન ન કરો ત્યાં સુધી `--skip-sqlite-setup` નો ઉપયોગ કરશો નહીં.
- જો આવું બ્લુપ્રિન્ટ સાથે થયું હોય, તો [બ્લુપ્રિન્ટ ટ્રબલશૂટિંગ પેજ](/blueprints/troubleshoot-and-debug) જુઓ.

<!--
If you are writing a Blueprint and need to add the SQLite integration plugin,
`plugins` goes at the top level:
-->

જો તમે બ્લુપ્રિન્ટ લખી રહ્યા છો અને તેમાં SQLite ઇન્ટિગ્રેશન પ્લગઇન ઉમેરવાની જરૂર હોય, તો `plugins` ટોચના સ્તરે આવે છે:

<!--
```json
{
	"preferredVersions": {
		"php": "8.3",
		"wp": "latest"
	},
	"plugins": ["sqlite-database-integration"],
	"steps": [
		{
			"step": "login",
			"username": "admin"
		}
	]
}
```
-->

```json
{
	"preferredVersions": {
		"php": "8.3",
		"wp": "latest"
	},
	"plugins": ["sqlite-database-integration"],
	"steps": [
		{
			"step": "login",
			"username": "admin"
		}
	]
}
```

<!--
## Error connecting to the SQLite database
-->

## SQLite ડેટાબેઝ સાથે કનેક્ટ કરવામાં ભૂલ

<!--
This means Playground loaded the SQLite integration, but WordPress still could
not connect to the database.
-->

આનો અર્થ એ છે કે પ્લેગ્રાઉન્ડે SQLite ઇન્ટિગ્રેશન લોડ કર્યું છે, પરંતુ વર્ડપ્રેસ હજુ પણ ડેટાબેઝ સાથે કનેક્ટ થઈ શક્યું નથી.

<!--
Common causes:
-->

સામાન્ય કારણો:

<!--
- A saved Playground's browser storage is stale or incomplete.
- An imported site ZIP contains an incompatible database file or database drop-in.
- A mounted local directory is missing files that WordPress needs.
- Browser storage was cleared, evicted, or blocked.
-->

- સેવ કરેલા પ્લેગ્રાઉન્ડનું બ્રાઉઝર સ્ટોરેજ જૂનું (stale) અથવા અપૂર્ણ છે.
- ઇમ્પોર્ટ કરેલી સાઇટ ZIP માં અસંગત (incompatible) ડેટાબેઝ ફાઇલ અથવા ડેટાબેઝ ડ્રોપ-ઇન શામેલ છે.
- માઉન્ટ કરેલી લોકલ ડિરેક્ટરીમાંથી વર્ડપ્રેસ માટે જરૂરી ફાઇલો ખૂટે છે.
- બ્રાઉઝર સ્ટોરેજ સાફ કરવામાં આવ્યું હતું, ખાલી કરવામાં આવ્યું હતું અથવા બ્લોક કરવામાં આવ્યું હતું.

<!--
Recommended recovery:
-->

ભલામણ કરેલ પુનઃપ્રાપ્તિ પગલાં:

<!--
1. Start a fresh Playground without `site-slug`.
2. If the fresh site works, the issue is tied to the saved site or imported archive.
3. Export accessible files from the broken saved site using **Files**, **Export**, or a local directory copy, if available.
4. Re-import the site into a new Playground, or rebuild it from its Blueprint.
-->

1. `site-slug` વિના એક નવું પ્લેગ્રાઉન્ડ શરૂ કરો.
2. જો નવી સાઇટ કામ કરે છે, તો સમસ્યા સેવ કરેલી સાઇટ અથવા ઇમ્પોર્ટ કરેલ આર્કાઇવ સાથે જોડાયેલી છે.
3. ક્ષતિગ્રસ્ત સેવ કરેલી સાઇટમાંથી ઍક્સેસ કરી શકાય તેવી ફાઇલોને **Files**, **Export** નો ઉપયોગ કરીને અથવા જો ઉપલબ્ધ હોય તો લોકલ ડિરેક્ટરી કૉપિ દ્વારા એક્સપોર્ટ કરો.
4. સાઇટને નવા પ્લેગ્રાઉન્ડમાં ફરીથી ઇમ્પોર્ટ કરો, અથવા તેની બ્લુપ્રિન્ટમાંથી તેને ફરીથી બનાવો.

<!--
## NotAllowedError
-->

## NotAllowedError

<!--
`NotAllowedError` usually means the browser blocked an operation that requires
user permission or a supported browser context. In Playground, this often
relates to saved sites or local directory access.
-->

`NotAllowedError` નો સામાન્ય અર્થ એ છે કે બ્રાઉઝરે એવી પ્રક્રિયાને બ્લોક કરી દીધી છે કે જેને વપરાશકર્તાની પરવાનગી અથવા સમર્થિત બ્રાઉઝર સંદર્ભની જરૂર હોય છે. પ્લેગ્રાઉન્ડમાં, આ મોટાભાગે સેવ કરેલી સાઇટ્સ અથવા લોકલ ડિરેક્ટરી ઍક્સેસ સાથે સંબંધિત હોય છે.

<!--
You may see this exact message:
-->

તમને આ ચોક્કસ મેસેજ દેખાઈ શકે છે:

<!--
```text
The request is not allowed by the user agent or the platform in the current context.
```
-->

```text
The request is not allowed by the user agent or the platform in the current context.
```

<!--
Try:
-->

આ અજમાવી જુઓ:

<!--
- Open Playground in a normal top-level browser tab, not inside a restricted iframe.
- Reopen the site from **Your Playgrounds** in the Dock.
- If the site used a local directory, Playground cannot currently re-select the directory after its saved permission expires. The files remain on disk; use them directly or recreate the Playground from an exported ZIP or Blueprint, if available.
- Confirm the browser supports the file or storage API being used. Chrome and Edge generally have the broadest local directory support.
- Check whether private browsing mode, enterprise policy, or browser settings block storage access.
-->

- પ્લેગ્રાઉન્ડને મર્યાદિત iframe ની અંદર નહીં, પણ સામાન્ય ટોપ-લેવલ બ્રાઉઝર ટેબમાં ખોલો.
- ડૉક (Dock) માં **Your Playgrounds** પરથી સાઇટને ફરીથી ખોલો.
- જો સાઇટે લોકલ ડિરેક્ટરીનો ઉપયોગ કર્યો હોય, તો તેની સાચવેલી પરવાનગી સમાપ્ત થયા પછી પ્લેગ્રાઉન્ડ હાલમાં ડિરેક્ટરીને ફરીથી પસંદ કરી શકતું નથી. ફાઇલો ડિસ્ક પર રહે છે; તેનો સીધો ઉપયોગ કરો અથવા જો ઉપલબ્ધ હોય તો એક્સપોર્ટ કરેલી ZIP કે બ્લુપ્રિન્ટમાંથી પ્લેગ્રાઉન્ડ ફરીથી બનાવો.
- વપરાઈ રહેલી ફાઇલ અથવા સ્ટોરેજ API ને બ્રાઉઝર સપોર્ટ કરે છે કે નહીં તેની પુષ્ટિ કરો. Chrome અને Edge સામાન્ય રીતે સૌથી વ્યાપક લોકલ ડિરેક્ટરી સપોર્ટ ધરાવે છે.
- પ્રાઇવેટ બ્રાઉઝિંગ મોડ, એન્ટરપ્રાઇઝ પૉલિસી અથવા બ્રાઉઝર સેટિંગ્સ સ્ટોરેજ ઍક્સેસને અવરોધે છે કે નહીં તે તપાસો.

<!--
## NoModificationAllowedError
-->

## NoModificationAllowedError

<!--
`NoModificationAllowedError` means the browser or filesystem refused a write.
This can happen when a saved local directory became read-only, permission was
lost, or browser storage is unavailable.
-->

`NoModificationAllowedError` નો અર્થ એ છે કે બ્રાઉઝર અથવા ફાઇલસિસ્ટમે રાઇટ (લખવાની પ્રક્રિયા) કરવાનો ઇનકાર કર્યો છે. આવું ત્યારે થઈ શકે છે જ્યારે સેવ કરેલી લોકલ ડિરેક્ટરી ફક્ત-વાંચી-શકાય (read-only) તેવી બની ગઈ હોય, પરવાનગી ગુમાવી દીધી હોય, અથવા બ્રાઉઝર સ્ટોરેજ અનુપલબ્ધ હોય.

<!--
You may see this exact message:
-->

તમને આ ચોક્કસ મેસેજ દેખાઈ શકે છે:

<!--
```text
An attempt was made to write to a file or directory which could not be modified due to the state of the underlying filesystem.
```
-->

```text
An attempt was made to write to a file or directory which could not be modified due to the state of the underlying filesystem.
```

<!--
Try:
-->

આ અજમાવી જુઓ:

<!--
- If the Playground still opens, use **Export → Download as .zip** before starting over.
- Check that the target folder still exists and is writable.
- Avoid system-protected folders or synced folders that temporarily lock files.
- Start a fresh Playground with `?storage=temp` if you only need a temporary test site.
- Use [Playground CLI](/developers/local-development/wp-playground-cli) for local development that needs reliable filesystem persistence.
-->

- જો પ્લેગ્રાઉન્ડ હજુ પણ ખુલે છે, તો ફરીથી શરૂ કરતાં પહેલાં **Export → Download as .zip** નો ઉપયોગ કરો.
- ખાતરી કરો કે લક્ષ્ય ફોલ્ડર હજુ પણ અસ્તિત્વમાં છે અને રાઇટેબલ (લખી શકાય તેવું) છે.
- સિસ્ટમ દ્વારા સુરક્ષિત ફોલ્ડર્સ અથવા સિંક કરેલા ફોલ્ડર્સ કે જે ફાઇલોને અસ્થાયી રૂપે લૉક કરે છે તેનાથી બચો.
- જો તમને ફક્ત અસ્થાયી ટેસ્ટ સાઇટની જરૂર હોય તો `?storage=temp` સાથે નવું પ્લેગ્રાઉન્ડ શરૂ કરો.
- વિશ્વસનીય ફાઇલસિસ્ટમ પર્સિસ્ટન્સની જરૂર હોય તેવા લોકલ ડેવલપમેન્ટ માટે [Playground CLI](/developers/local-development/wp-playground-cli) નો ઉપયોગ કરો.

<!--
## Saved Playground cannot reload
-->

## સેવ કરેલું પ્લેગ્રાઉન્ડ ફરીથી લોડ થઈ શકતું નથી

<!--
Saved Playgrounds are stored in browser storage or in a local directory you
selected. They are not hosted on a remote server.
-->

સેવ કરેલા પ્લેગ્રાઉન્ડ્સ બ્રાઉઝર સ્ટોરેજમાં અથવા તમે પસંદ કરેલી લોકલ ડિરેક્ટરીમાં સંગ્રહિત થાય છે. તેઓ રિમોટ સર્વર પર હોસ્ટ થતા નથી.

<!--
If a saved Playground cannot reload:
-->

જો સેવ કરેલું પ્લેગ્રાઉન્ડ ફરીથી લોડ ન થઈ શકે:

<!--
- Confirm you are using the same browser and browser profile where it was saved.
- Check whether browser data was cleared or storage was disabled.
- If the site was saved to a local directory, confirm the directory still exists and has not moved.
- If the URL includes `?site-slug=...`, remove it to start a fresh autosaved Playground.
- Recreate the saved site from its original Blueprint or import ZIP if storage was lost.
-->

- ખાતરી કરો કે તમે તે જ બ્રાઉઝર અને બ્રાઉઝર પ્રોફાઇલનો ઉપયોગ કરી રહ્યા છો જ્યાં તેને સેવ કરવામાં આવ્યું હતું.
- બ્રાઉઝર ડેટા સાફ કરવામાં આવ્યો છે કે સ્ટોરેજ અક્ષમ કરવામાં આવ્યું છે તે તપાસો.
- જો સાઇટ લોકલ ડિરેક્ટરીમાં સેવ કરવામાં આવી હોય, તો ખાતરી કરો કે ડિરેક્ટરી હજુ પણ અસ્તિત્વમાં છે અને ખસેડવામાં આવી નથી.
- જો URL માં `?site-slug=...` શામેલ હોય, તો નવું ઓટોસેવ થયેલું પ્લેગ્રાઉન્ડ શરૂ કરવા માટે તેને દૂર કરો.
- જો સ્ટોરેજ ખોવાઈ ગયું હોય, તો સેવ કરેલી સાઇટને તેની મૂળ બ્લુપ્રિન્ટ અથવા ઇમ્પોર્ટ ZIP માંથી ફરીથી બનાવો.

<!--
## Browser storage and persistence
-->

## બ્રાઉઝર સ્ટોરેજ અને પર્સિસ્ટન્સ

<!--
New Playgrounds are autosaved when browser storage and saving are available. Open **Your Playgrounds** in the Dock to recover recent autosaves or saved Playgrounds. Playground keeps up to five recent autosaves.
-->

જ્યારે બ્રાઉઝર સ્ટોરેજ અને સેવિંગ ઉપલબ્ધ હોય ત્યારે નવા પ્લેગ્રાઉન્ડ્સ આપમેળે સેવ (autosaved) થાય છે. તાજેતરના ઓટોસેવ અથવા સેવ કરેલા પ્લેગ્રાઉન્ડ્સ પુનઃપ્રાપ્ત કરવા માટે ડૉક (Dock) માં **Your Playgrounds** ખોલો. પ્લેગ્રાઉન્ડ વધુમાં વધુ પાંચા તાજેતરના ઓટોસેવ જાળવી રાખે છે.

<!--
Click the **Autosaved** or **Unsaved** status in the Dock to open the storage
choices. Select **Save in browser storage**, or select **Save in a local
directory** and choose a directory dedicated to that Playground before
clicking **Save**. Matching files in the directory may be overwritten. Use
**Export** to download a portable ZIP. A browser refresh can recover a stored
or autosaved Playground, but `?storage=temp` creates a temporary Playground
that is discarded on refresh or tab close.
-->

સ્ટોરેજના વિકલ્પો ખોલવા માટે ડૉક (Dock) માં **Autosaved** અથવા **Unsaved** સ્ટેટસ પર ક્લિક કરો. **Save in browser storage** પસંદ કરો, અથવા **Save in a local directory** પસંદ કરો અને **Save** પર ક્લિક કરતાં પહેલાં તે પ્લેગ્રાઉન્ડ માટે સમર્પિત ડિરેક્ટરી પસંદ કરો. ડિરેક્ટરીમાં મેળ ખાતી ફાઇલો ઓવરરાઇટ થઈ શકે છે. પોર્ટેબલ ZIP ડાઉનલોડ કરવા માટે **Export** નો ઉપયોગ કરો. બ્રાઉઝર રિફ્રેશ સંગ્રહિત અથવા ઓટોસેવ કરેલા પ્લેગ્રાઉન્ડને પુનઃપ્રાપ્ત કરી શકે છે, પરંતુ `?storage=temp` એક અસ્થાયી પ્લેગ્રાઉન્ડ બનાવે છે જે રિફ્રેશ કરવાથી અથવા ટેબ બંધ કરવાથી કાઢી નાખવામાં આવે છે.

<!--
For longer-running local development, prefer the [Playground CLI](/developers/local-development/wp-playground-cli), which persists site files on disk.
-->

લાંબા સમય સુધી ચાલતા લોકલ ડેવલપમેન્ટ માટે, [Playground CLI](/developers/local-development/wp-playground-cli) ને પ્રાથમિકતા આપો, જે સાઇટ ફાઇલોને ડિસ્ક પર સાચવી રાખે છે.

<!--
See [the Dock guide](/web-instance) for the current Dock destinations and export workflow.
-->

હાલના ડૉક સ્થળો અને એક્સપોર્ટ વર્કફ્લો માટે [ડૉક માર્ગદર્શિકા](/web-instance) જુઓ.

<!--
## When to start fresh
-->

## નવેસરથી ક્યારે શરૂ કરવું

<!--
Start a fresh Playground when:
-->

આ પરિસ્થિતિઓમાં નવું પ્લેગ્રાઉન્ડ શરૂ કરો:

<!--
- You only need to test whether the public Playground site is working.
- The URL points to a saved `site-slug` that no longer loads.
- You are debugging whether an error comes from Playground itself or from a plugin, theme, Blueprint, or imported site.
- Browser storage or local directory access is suspected to be broken.
-->

- તમારે ફક્ત એ ચકાસવું હોય કે સાર્વજનિક પ્લેગ્રાઉન્ડ સાઇટ યોગ્ય રીતે કાર્ય કરી રહી છે કે નહીં.
- URL એવા સેવ કરેલા `site-slug` તરફ નિર્દેશ કરે છે જે હવે લોડ થતો નથી.
- તમે એ ડિબગ કરી રહ્યા હોવ કે ભૂલ પ્લેગ્રાઉન્ડમાંથી જ આવી રહી છે કે કોઈ પ્લગઇન, થીમ, બ્લુપ્રિન્ટ અથવા ઇમ્પોર્ટ કરેલી સાઇટમાંથી.
- બ્રાઉઝર સ્ટોરેજ અથવા લોકલ ડિરેક્ટરી ઍક્સેસ ક્ષતિગ્રસ્ત હોવાની શંકા હોય.

<!--
Use this URL for a clean site:
-->

નવી સાઇટ માટે આ URL નો ઉપયોગ કરો:

<!--
```text
https://playground.wordpress.net/
```
-->

```text
https://playground.wordpress.net/
```

<!--
## Report a Playground issue
-->

## પ્લેગ્રાઉન્ડ સમસ્યાની જાણ કરો

<!--
If the problem reproduces on a fresh Playground, please
[open an issue](https://github.com/WordPress/wordpress-playground/issues) and
include:
-->

જો સમસ્યા નવા પ્લેગ્રાઉન્ડ પર પણ ફરી ઉદ્ભવે છે, તો કૃપા કરીને
[એક ઇશ્યૂ ઓપન કરો](https://github.com/WordPress/wordpress-playground/issues) અને તેમાં નીચેની વિગતો શામેલ કરો:

<!--
- The full Playground URL.
- The browser and operating system.
- Whether you used a saved site, imported ZIP, Blueprint, local directory, or CLI.
- The exact error name and message.
- Console and Network details from browser developer tools.
-->

- સંપૂર્ણ પ્લેગ્રાઉન્ડ URL.
- બ્રાઉઝર અને ઓપરેટિંગ સિસ્ટમ.
- શું તમે સેવ કરેલી સાઇટ, ઇમ્પોર્ટ કરેલી ZIP, બ્લુપ્રિન્ટ, લોકલ ડિરેક્ટરી અથવા CLI નો ઉપયોગ કર્યો હતો.
- ચોક્કસ ભૂલનું નામ અને મેસેજ.
- બ્રાઉઝર ડેવલપર ટૂલ્સમાંથી Console અને Network વિગતો.
