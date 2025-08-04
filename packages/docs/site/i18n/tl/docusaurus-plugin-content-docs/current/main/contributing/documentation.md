---
slug: /contributing/documentation
---

# Mga Kontribusyon sa Dokumentasyon

Ang [dokumentasyon ng WordPress Playground](/) ay pinamamahalaan ng mga volunteer tulad mo, na sabik tumulong.

Lahat ng isyu na may kinalaman sa dokumentasyon ay nalabelan bilang [`[Type] Documentation`](https://github.com/WordPress/wordpress-playground/issues?q=is%3Aissue%20state%3Aopen%20label%3A%22%5BType%5D%20Documentation%22) o [`[Type] Developer Documentation`](https://github.com/WordPress/wordpress-playground/issues?q=is%3Aissue%20state%3Aopen%20label%3A%22%5BType%5D%20Developer%20Documentation%22) sa repositoryang [WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground). I-browse ang listahan ng mga bukas na isyu upang makita kung alin ang nais mong trabahuhin. Kung sa tingin mo ay may nawawala sa kasalukuyang dokumentasyon, magbukas ng isyu upang talakayin ang iyong mungkahi.

## Paano Ako Makakatulong?

Maaari kang mag-ambag sa pamamagitan ng [pagbubukas ng isyu sa repositoryo ng proyekto](https://github.com/WordPress/wordpress-playground/issues/new) at ilarawan kung ano ang nais mong idagdag o baguhin.

Kung kaya mo, isulat na ang content sa paglalarawan ng isyu, at ang mga kontribyutor ng proyekto ang bahala sa susunod na hakbang.

### Pag-fork, pag-edit nang lokal, at pagbubukas ng Pull Request

Kung pamilyar ka sa markdown, maaari mong [i-fork](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/fork-a-repo) ang `wordpress-playground` repo at magmungkahi ng mga pagbabago o bagong pahina ng dokumentasyon sa pamamagitan ng pagsusumite ng Pull Request.

Ang proseso ng paglikha ng branch upang magbukas ng bagong PR na may translated na mga pahina sa repositoryong [WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) ay katulad ng sa ibang WordPress repositories tulad ng Gutenberg:
https://developer.wordpress.org/block-editor/contributors/code/git-workflow/

Ang mga file ng dokumentasyon (`.md` files) ay nakaimbak sa GitHub repository ng Playground, [sa ilalim ng `/packages/docs/site/docs`](https://github.com/WordPress/wordpress-playground/tree/trunk/packages/docs/site/docs).

### Pag-edit sa browser

Kung naka-log in ka sa GitHub, maaari mo ring i-edit ang umiiral na mga file (o magdagdag ng bago) at magsumite ng PR nang direkta mula sa GitHub UI:

1. Hanapin ang pahinang nais mong i-edit o ang direktoryo ng kabanatang gusto mong idagdagan ng bagong pahina.
2. I-click ang button na **Add Files** para magdagdag ng bagong file, o i-click ang umiiral na file at pagkatapos ay i-click ang pencil icon upang i-edit ito.
3. Hihilingin sa iyo ng GitHub na i-fork ang repositoryo at lumikha ng bagong branch na may iyong mga pagbabago.
4. Buksan ang editor kung saan maaari mong gawin ang pagbabago.
5. Kapag tapos ka na, i-click ang button na **Commit Changes** at magsumite ng Pull Request.

Ayan na! Nakapag-ambag ka na sa dokumentasyon ng WordPress Playground.

Ang pamamaraang ito ay nangangahulugang hindi mo kailangang i-clone ang repositoryo, mag-set up ng lokal na development environment, o magpatakbo ng anumang utos.

May downside lang—hindi mo mare-preview ang iyong mga pagbabago. Basahin pa upang malaman kung paano suriin ang iyong mga pagbabago bago magsumite ng Pull Request.

### Lokal na preview

I-clone ang repositoryo at pumunta sa direktoryo sa iyong device. Patakbuhin ang mga sumusunod na utos:

```bash
npm install
npm run build:docs
npm run dev:docs
```

Magbubukas ang site ng dokumentasyon sa bagong browser tab at awtomatikong magre-refresh sa bawat pagbabago. Ipagpatuloy ang pag-edit ng kaukulang file sa iyong code editor at i-test ang pagbabago nang real-time.
