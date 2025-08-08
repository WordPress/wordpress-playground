---
title: Tungkol sa Playground
slug: /about
---

# Tungkol sa WordPress Playground

## Ano ang WordPress Playground?

**Ang WordPress Playground ay ang platform na nagpapahintulot sa iyo na patakbuhin ang WordPress kaagad sa anumang device nang hindi kailangan ng host**. Pinapayagan kang mag-eksperimento at matuto tungkol sa WordPress nang hindi naaapektuhan ang iyong live na website. Isa itong virtual na sandbox kung saan maaari kang maglaro sa iba't ibang feature, disenyo, at setting sa isang ligtas at kontroladong kapaligiran.

Ang WordPress Playground ang iyong lugar para mag:

-   [Build](/about/build): Makakatulong ang WordPress Playground na lumikha ng mga produkto gamit ang WordPress. Gamitin ito kung saan ka pinakamahusay magtrabaho, maging sa browser, Node.js, mobile apps, VS Code, o iba pa.
-   [Test](/about/test): I-upgrade ang iyong QA process gamit ang WordPress Playground. Mabilis na subukan ang iyong mga plugin o theme, mag-eksperimento sa isang pribadong sandbox, at lumikha ng PRs mula sa iyong WP Playground instance papunta sa anumang repo.
-   [Launch](/about/launch): Gamitin ang WordPress Playground upang ipakita ang iyong produkto, hayaan ang mga user subukan ito nang live, o ilunsad ito sa App Store nang walang delay.

## Bakit WordPress Playground?

### Sumubok ng mga theme at plugin agad-agad

Sa WordPress Playground, maaari mong tuklasin ang anumang [theme](https://developer.wordpress.org/themes/getting-started/what-is-a-theme/). Maaari kang pumili mula sa malawak na seleksyon ng mga theme at makita kung paano ito lumilitaw sa iyong site. Maaari mo ring baguhin ang mga kulay, font, layout, at iba pang visual na elemento upang lumikha ng natatanging disenyo.  
Bilang karagdagan sa mga theme, maaari ka ring mag-eksperimento sa mga plugin. Sa WordPress Playground, maaari mong i-install at subukan ang iba't ibang plugin upang makita kung paano ito gumagana at kung ano ang maibibigay nito sa iyong site. Pinapayagan ka nitong tuklasin at maunawaan ang mga kakayahan ng WordPress nang hindi nag-aalala sa pagbasag ng ano man.

### Gumawa ng content kahit saan

Isa pang mahusay na feature ng WordPress Playground ay ang kakayahang lumikha at mag-edit ng content. Maaari kang magsulat ng blog post, gumawa ng mga pahina, at magdagdag ng media tulad ng larawan at video sa iyong site. Tinutulungan ka nitong maunawaan kung paano maayos i-organisa at istruktura ang iyong content.

Ang content na iyong nilikha ay limitado sa Playground sa iyong device at mawawala kapag umalis ka, kaya malaya kang mag-eksperimento nang hindi nagri-risk ng pagbasag ng totoong site.

Pero tandaan! Maaari mo ring ikonekta ang iyong Playground instance sa isang GitHub repo at gumawa ng PR upang mapanatili ang mga pagbabagong iyon.

### Napaka-ligtas nito

Sa kabuuan, nagbibigay ang WordPress Playground ng isang walang risk na kapaligiran para sa mga baguhan upang matuto at magkaroon ng hands-on na karanasan sa WordPress. Tinutulungan ka nitong magkaroon ng kumpiyansa at kaalaman bago gumawa ng pagbabago sa iyong live na website.

:::tip
Tingnan ang [mga gabay section](/guides) upang malaman kung paano mas mapapakinabangan ang WordPress Playground sa pag-test ng iyong mga theme at plugin at paglikha ng content on the fly.
:::

## Paano gumagana ang WordPress Playground?

Kapag unang beses mong ginamit ang WordPress Playground, bibigyan ka ng hiwalay na espasyo kung saan maaari kang lumikha at mag-customize ng sarili mong WordPress website. Ang espasyong ito ay ganap na hiwalay sa iyong aktwal na website.

### Streamed, hindi served

Ang WordPress na nakikita mo kapag binuksan mo ang Playground sa browser ay isang WordPress na dapat gumana tulad ng anumang WordPress, na may [ilang limitasyon](/developers/limitations) at ang mahalagang eksepsyon na hindi ito permanenteng server na may internet address na maglilimita ng koneksyon sa ilang third-party na serbisyo (automation, sharing, analysis, email, backups, atbp.) sa isang patuloy na paraan.

Ang loading screen at progress bar na nakikita mo sa Playground ay kinabibilangan ng streaming ng mga pundamental na teknolohiyang iyon papunta sa iyong browser at mga configuration step mula sa [WordPress Blueprints](/blueprints) (tingnan ang [mga halimbawa](/blueprints/examples)), upang ang isang buong server, WordPress software, Theme & Plugin solutions, at mga instruction sa configuration ay ma-stream nang over-the-wire.

## Ano ang pinagkaiba ng Playground sa pagpapatakbo ng WordPress sa web server o lokal na desktop app?

Matagal nang umaasa ang mga web application tulad ng WordPress sa teknolohiya ng server [para patakbuhin ang logic](/developers/architecture/wasm-php-overview) at [mag-imbak ng data](/developers/architecture/wordpress#sqlite).

Ang paggamit ng mga teknolohiyang iyon ay nangangahulugang kailangang patakbuhin ang web server na konektado sa internet o gamitin ang mga teknolohiyang iyon sa desktop service o app (minsan tinatawag na "WordPress local environment") na umaasa sa virtual server na may naka-install na teknolohiya o sa mga teknolohiyang naka-install sa kasalukuyang device.

Ang Playground ay isang bago at natatanging paraan upang i-stream ang mga teknolohiyang server—kabilang ang WordPress (at WP-CLI)—bilang mga file na maaari nang patakbuhin sa browser.
