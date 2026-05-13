---
title: Ano ang mga Blueprints?
slug: /blueprints/tutorial/what-are-blueprints-what-you-can-do-with-them
description: Alamin kung ano ang mga Blueprints at kung paano nila i-configure ang WordPress Playground. Tuklasin ang mga benepisyo ng paggamit ng JSON para sa instant na pag-setup ng site.
---

# Ano ang mga Blueprint, at ano-ano ang mga pwede mong gawin?

Sa WordPress Playground maaari kang gumawa ng buong website, kasama ang mga plugin, theme, content (mga post, page, taxonomy, at comment), settings (pangalan ng site, mga user, permalinks, at marami pang iba), atbp. Pwede kang makabuo ng WooCommerce store na kumpleto sa mga produkto, magazine na may mga artikulo, corporate blog na may maraming user, at iba pa.

Ang mga Blueprint ay mga `JSON` file na maaari mong gamitin para i-configure ang mga Playground instance.

Ang mga Blueprint ay sumusuporta sa mga advanced na use case, tulad ng file system at database manipulation, at binibigyan ka ng fine-grained control sa instance na ginagawa mo. Ginagamit ng WordPress Test Team ang Playground sa [6.5 beta release cycle](https://wordpress.org/news/2024/03/wordpress-6-5-release-candidate-2/), na gumagawa ng Blueprint na naglo-load ng pinakabagong version, ilang testing plugin, at dummy data.

## Isang simpleng halimbawa

Ang isang Blueprint ay maaaring magmukhang ganito:

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

Ang Blueprint sa itaas ay nag-i-install ng _Akismet_ at _Gutenberg_ plugin at ang _Twenty Nineteen_ theme, nagse-set ng pangalan at description ng site, at pinapagana ang WordPress debugging mode.

## Ang mga benepisyo ng mga Blueprint

Ang mga Blueprint ay isang napakahalagang tool para sa pagbuo ng mga WordPress site sa pamamagitan ng Playground

- **Flexibility**: ang mga developer ay maaaring gumawa ng granular adjustments sa build process.
- **Consistency**: tiyakin na bawat bagong site ay nagsisimula sa parehong configuration.
- **Lightweight**: maliit na text file na madaling i-store at i-transfer.
- **Transparency**: Ang isang Blueprint ay kasama ang lahat ng command na kailangan para makabuo ng snapshot ng WordPress site. Maaari mong basahin ito at maintindihan kung paano nabuo ang site.
- **Productivity**: binabawasan ang time-consuming na proseso ng manual na pag-setup ng bagong WordPress site. Sa halip na mag-install at mag-configure ng mga theme at plugin para sa bawat bagong project, mag-apply ng Blueprint at i-set ang lahat sa isang proseso.
- **Up-to-date dependencies**: kunin ang pinakabagong version ng WordPress, particular na plugin, o theme. Ang iyong snapshot ay palaging up-to-date sa pinakabagong features at security fixes.
- **Collaboration**: ang mga `JSON` file ay madaling i-review sa mga tool tulad ng GitHub. I-share ang mga Blueprint sa iyong team o WordPress community. Pinapayagan ang iba na gamitin ang iyong well-configured na setup.
- **Experimentation and Learning**: Para sa mga baguhan sa WordPress o naghahanap para mag-experiment ng iba't ibang configuration, ang mga Blueprint ay nagbibigay ng ligtas at madaling paraan para subukan ang mga bagong setup nang walang "pagkasira" ng live site.
- **WordPress.org integration**: magbigay ng [demo ng iyong plugin](https://developer.wordpress.org/plugins/wordpress-org/previews-and-blueprints/) sa WordPress plugin directory, o preview sa [Theme Trac ticket](https://meta.trac.wordpress.org/ticket/7382).
- **Spinning a development environment**: Ang bagong developer sa team ay maaaring mag-download ng Blueprint, magpatakbo ng hypothetical na `wp up` command, at makakuha ng fresh na development environment—na may lahat ng kailangan nila. Ang buong CI/CD process ay maaaring muling gamitin ang parehong Blueprint.

<div class="callout callout-info">

**Higit Pang Mga Resource**

Bisitahin ang mga link na ito para matuto pa tungkol sa (walang hanggang) mga posibilidad ng mga Blueprint:

- [Introduction to WordPress Playground](https://developer.wordpress.org/news/2024/04/05/introduction-to-playground-running-wordpress-in-the-browser/)
- I-embed ang pre-configured na WordPress site sa iyong website gamit ang [WordPress Playground Block](https://wordpress.org/plugins/interactive-code-block/).
- [Mga halimbawa ng Blueprint](/blueprints/examples)
- [Mga demo at app na ginawa gamit ang mga Blueprint](/resources#apps-built-with-wordpress-playground)

</div>
