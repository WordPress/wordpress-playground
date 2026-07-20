# Cognitive-load audit, round two — the short-fuse read

Round one (`readability-audit.md`) produced the five layout variants in
`mockups/10-readable-bom.html`. The verdict on them: still not readable enough.
This round audits everything that exists — 10's five variants plus what remains
of 08 and 09 — through one persona: a WordPress user with ADHD and no patience.
They don't read paragraphs. Their eyes go to whatever is biggest, bluest, or
most picture-like. Two dead ends and they close the tab.

Method: six critics (first contact, reading effort, action clarity, trust,
wayfinding, delight) worked from full-page screenshots of the real pixels,
producing 111 findings; a three-judge panel refuted or merged 63 of them.
The 48 that survived are written down here, grouped by what they do to the
reader. Screenshots are in `.ux-shots/round2/`.

## What this screen is for (unchanged)

A Blueprint is a description of a WordPress site that will exist after you
press Run. The editor's whole job is a three-step loop: see what the site is
made of → change one part → run it. Every finding below is a place where the
current designs tax that loop.

## The ten-second experience today

Open 10's guide rail: a gray admin panel. The name of my site is nowhere — a
16px "Product demo" next to a placeholder blue "B" square. A rail row says
"Open in Playground", so I click it — it's a settings form, not a launch.
A plugin says "Inactive" in alarm orange, so I click the word to switch it on —
it's dead text. A summary says "2 final actions · 1 setting in JSON" — I read it
three times and know nothing. There is no picture of the site anywhere in any
of the five variants. Meanwhile 08/09 — the pretty ones — show me the site
instantly, then hide every control behind hover, gray-ghost text, and jargon
("Bill of materials", "Recipes", "Constants"). Both generations fail the same
person differently: **10 is legible but anonymous and mislabeled; 08/09 are
warm but unreadable as instruments.**

## The problems

### A. Words that pretend to be actions, actions that pretend to be words

1. **A section is named "Open in Playground."** It reads as the launch button.
   Clicking it opens a settings category while the real launch is the blue Run
   button elsewhere. Three launch-sounding words compete on one screen (the
   section title, six row-level "Open" links, and Run) — in v3 one row literally
   reads "Open in Playground … Open".
2. **Six identical blue "Open" links** are the only row affordance in v3, and
   it's ambiguous whether the row or the word is the target.
3. **"Selected" is styled like the clickable "Open" links** but is inert state
   text. Click, nothing, trust gone.
4. **"Active" / "Inactive" look like toggles and are dead labels.** The only way
   to flip activation is a generic "Edit" one hop away — while v5 proves the
   honest control exists ("Activate this plugin" checkbox).
5. **"JSON" sits beside Run** — a bare file format in link-blue next to the
   primary action, no verb, perfect misclick bait.
6. **The one big button in v5's inspector says "Change"** — placed above the
   Version dropdown but it changes the *source*. The eye pairs it with the
   wrong noun.
7. **v4 has no Add anywhere.** Seven identical "Edit" links are the only
   controls on the sheet; the single most common job — add a plugin — has no
   visible entry point.
8. **v2's theme rows have no control at all.** You can see Twenty Twenty-Five
   sitting there and there is no way to make it the theme; the readable variant
   is the one where switching themes is impossible.
9. **09's adders are ghost-gray placeholder text** ("+ Add a plugin…"), which
   reads as *disabled* everywhere else on the internet — and its setup row packs
   five click targets into one unbroken gray line ("+ Site option + Constant +
   PHP + SQL + WP-CLI"): five buttons wearing one trench coat.
10. **09 dropped the carets** 08 had on "PHP 8.3", so changing a version means
    clicking undecorated text on faith.
11. **"Blueprint at a glance" is styled as the first clickable rail cell** and
    is a dead label. It's the first thing everyone clicks.

### B. Tense and trust

12. **Nothing says what Run does.** No 10-variant explains that edits live in a
    document, that Run builds a fresh site, or whether anything is saved. The
    user hovers over the only blue button with zero idea of the blast radius.
    08/09's footer sentence ("Everything above ships as one blueprint.json —
    press Run to launch it") solved half of this and was dropped.
13. **Present-tense status for a site that does not exist.** Rows say "Active" /
    "Inactive" while the sentence one inch above says "will not be activated" —
    two tenses, one fact, and the orange styling turns a deliberate choice into
    an apparent error.
14. **Alarm orange marks a legitimate configuration** (Query Monitor stays off)
    on otherwise gray-blue screens. Orange means broken; the eye snaps to it and
    the user "fixes" something that was configured on purpose.
15. **App chrome and site payload are indistinguishable.** 08's "Custom code —
    Run PHP · Hide setup task list" reads as a toggle that hides a list in
    *this* editor. It is PHP that will run on the future site.
16. **"WordPress latest" is an unresolved moving target** while every other
    fact on the sheet is concrete. Latest as of when?
17. **v2 declares "Order matters only in this list" and offers no way to
    reorder.** A warning about a thing you cannot control.
18. **v2's sheet ends on a yellow warning** about the mockup's own limitations
    ("Environment type: local is shown only in JSON…"), and narrates its design
    rationale as body text ("There is no separate Resources section to
    manage."). The product apologizes for itself in its own voice.
19. **08 ships a roadmap note as UI copy** ("Coming to this concept:
    multisite…") — unclassifiable text reads as "this product is unfinished."

### C. Summaries that require decoding

20. **"2 final actions · 1 setting in JSON"** — the flagship offender. Final
    actions of what? Which setting? Why JSON? Compressed fragments that cannot
    be read aloud to a non-developer fail as summaries.
21. **"Products · Admin, external access"** reads like a security warning, not
    a description of where the site opens.
22. **Two glance-level rows contradict each other**: "Empty site" (Site row)
    vs "3 pages · 12 media files" (Content row). If the summary disagrees with
    itself, every row must be opened to be trusted — the exact cost the summary
    was meant to remove.
23. **"Starter content off"** — undefined term, and "off" is either dead text
    or an unclickable toggle.
24. **Category names are manufacturing/developer jargon**: "Bill of
    materials", "Recipes", "Constants", "WP-CLI". Each is a small "you're not
    smart enough for this page" slap, several per screen.
25. **Executable code lives in two differently-named sections** ("Recipes" and
    "Custom code"), with inconsistent viewers ("view code" / "edit code"), so
    one question — does custom code run? — requires reconciling two categories.
26. **Counts appear as number-words in the prose variants** ("three starter
    pages… twelve Media Library files") and digits elsewhere. Eyes grep for
    digits; the prose-heavy screens are precisely where they vanish.
27. **Facts set in monospace whisper "this is code"** for what should be
    glanceable badges ("logged in as admin · internet access on"), and 08/09
    name the same setting differently ("network on" vs "internet access on"),
    so it reads as two settings.

### D. The same fact, twice (or three times)

28. **Query Monitor's inactive state is written three times on one v1 screen**:
    rail subtitle, pane intro sentence, and the amber row label. Three reads,
    one fact — and the reader starts wondering if they're subtly different.
29. **A v1 row states its source twice in different words** ("Included with
    this Blueprint" subtitle + "File in this Blueprint" column), and the middle
    column has no header — guess-the-label.
30. **v5's columns echo instead of adding**: "2 plugins · Query Monitor
    inactive" renders in column 1 and again as column 2's header; WooCommerce's
    state renders in the row and again in column 3's header. Every rerun costs a
    "same thing or different thing?" check.
31. **v4 renders the blueprint name twice within 120px** (card header + H1).
32. **v2's Users table mixes a role into the user list** (says 2 users, shows
    3 rows) and its unlabeled status column speaks three vocabularies ("Signs
    in", "Created", "Available").

### E. Nothing to recognize, nowhere to land

33. **No 10-variant contains a single image of the site.** The largest visual
    object on every screen is the Run button. 08 answers "what does this site
    look like" in half a second with the Storefront screenshot; 10 never does.
34. **v4 contains zero images, icons, or color anchors** — a store with
    products and a storefront theme, presented as a legal document.
35. **The site's name is demoted to 16px** next to a generic blue "B" square;
    the serif letterhead that made 08/09 read as *your* document is gone.
36. **One blue means everything**: Run, JSON, every Edit, six Opens, selection
    highlights, the B avatar. When everything blue-shouts, nothing does — in 08
    the single saturated button was unmistakable.

### F. Layout that fights the scan

37. **v2 opens with a blank-form idiom** (text input + five dropdowns — "am I
    signing up for something?") and then changes layout grammar every section
    (form grid → three-column table → ordinal list → checkbox row): nothing
    learned in one section transfers to the next.
38. **v2 at real scale is a receipt**: 30 plugins, 40 pages, 6 users = thousands
    of pixels of undifferentiated rows.
39. **v3's map eats itself**: expanding Plugins pushes every other section
    below the fold; with 30 plugins the "map" is gone.
40. **v1 charges seven clicks to read the whole blueprint** (one pane at a
    time), then shows two rows floating in a half-empty pane. v4 answers the
    same question in one screen.
41. **v1's pane below two plugin rows is ~55% void.** Empty that big reads as
    broken, and broken reads as "leave".
42. **v5's visually dominant element is a Version dropdown for one plugin** —
    a leaf-level detail as the hero of a page about a whole site. Two blue
    selection highlights glow at once, and a header styled as a row invites a
    dead click. Finder columns to change a checkbox.
43. **08 gives equivalent things four different shapes** — plugins are 90px
    tiles, content is sparkle-tiles, setup is chevron rows, users are a 20px
    avatar dot — and the same sparkle glyph decorates both a content item and a
    script, so the icon means nothing. At 30 plugins the tile grid becomes a
    wall.
44. **08's card is two viewport-heights of scan** — 100px+ gaps, all content
    hugging the left column, the right half empty below the header.
45. **08 truncates captions beside empty space** ("12 products · gen…") —
    ellipsis where the meaning is, whitespace next door.
46. **09's Run hides in the far corner of the browser chrome** while the
    gorgeous card holds zero pressable-looking things; the hint to press Run is
    a footer sentence you must read. If you must read to find the button, the
    button failed.
47. **08/09's plugin tiles carry no state and no visible action** — the pretty
    stickers won't say whether Yoast is even on; meanwhile the ugly variants
    shout it. Recognition and honesty currently live in different mockups.
48. **v4's seventh sentence bundles three unrelated settings** ("Enable
    debugging, run 2 final actions including PHP, and preserve the environment
    type in JSON") and every sentence ends in an identical "Edit" — to change
    the PHP version you must read twice to click once.

## What must survive (the keepers)

The critics were unanimous on these; the five new versions all inherit them:

- **The theme screenshot in a mini-browser frame** — the fastest "what is
  this?" answer in the whole study. The single biggest source of 08's
  "beautiful" verdict.
- **Real plugin icons** — the only zero-reading answer to "what's installed."
- **The large serif site name** — one type choice that turns an admin record
  into a document you authored.
- **v4's bold-noun sentences** — skim only the bolds and you reconstruct the
  entire build. The best zero-training read anywhere in seven screenshots.
- **Count + anomaly summaries** ("2 plugins · 1 stays off") — facts in the map
  itself, provided the words are self-contained and plain.
- **One fixed Run button** that never moves, and only it is blue.
- **v5's "Activate this plugin" checkbox** — the honest, outcome-labeled
  control that should replace every status word.
- **The footer sentence** "Everything above is one blueprint.json — press Run
  to launch it" — the entire mental model in one line.
- **The plain-language consequence line next to any code** ("Add a WELCOME10
  coupon for testing").
- **v1's principle** that the bill stays visible while one part is edited —
  the execution failed, the principle holds.

## The reconciliation

The next design is not a compromise between 08 and 10 — it is v4's sentence
engine wearing 08's clothes, governed by one grammar and one tense:

1. **Future tense everywhere.** This describes a site that will exist after
   Run. Controls say what they'll do ("Activate after install"), never what
   abstractly "is".
2. **One visual grammar** for every thing in the site: artwork · name · one
   plain fact · one honest control. A plugin, a page, and a user are the same
   kind of row.
3. **Recognition first**: theme screenshot, plugin icons, serif title. Then
   digits. Then words — every one of them readable aloud to a non-developer.
4. **One blue thing per screen**: Run. Everything else is quiet ink.
5. **Visible affordances only** — no hover-reveals, no ghost-gray adders, no
   mechanic labels ("Edit", "Open", "JSON", "Change"), no dead controls.
6. **The map never moves**, whatever grows or opens.

## Five versions

Each mockup makes a different structural bet while sharing the constitution
above and identical seed data (same demo store, same 3 plugins, same content).

### 11 · Site sheet — `mockups/11-site-sheet.html`
The disciplined one-screen document. Whole Blueprint on one viewport: theme
preview + editable fact-pills up top, collections below in one uniform row
grammar, visible Add buttons, Run inside the sheet.
**Bet:** if the whole site fits one calm screen with one grammar, there is
nothing left to navigate. **Tradeoff:** density has a ceiling; giant
blueprints need inner scrolls.

### 12 · Seven sentences — `mockups/12-seven-sentences.html`
v4 done honestly: seven big bold-noun sentences, every value an inline
control, plugin favicons in the prose, details expand under their sentence.
**Bet:** reading is the interface when sentences are scannable and editable.
**Tradeoff:** prose must stay literal and generated; add-flows live one level
in.

### 13 · Pre-flight — `mockups/13-preflight.html`
The page is the answer to "what happens when I press Run": six future-tense
stages ending in the Run button like a checkout confirm.
**Bet:** temporal framing kills trust anxiety — the whole UI is Run's
consequence, so Run needs no explanation. **Tradeoff:** stage order implies
sequence where the format is declarative.

### 14 · One thing at a time — `mockups/14-one-thing.html`
A never-moving six-segment map (each segment carrying its own live fact), one
full-width canvas below showing a single section with at most four decisions.
**Bet:** ADHD load drops fastest when exactly one decision surface is visible
and the map never lies or moves. **Tradeoff:** whole-blueprint reading costs
one glance at the map instead of zero.

### 15 · Poster — `mockups/15-poster.html`
Zero navigation: a fixed non-scrolling grid of zones — hero preview, launch
facts, plugins, content, users, scripts — where nothing ever moves and all
editing happens in anchored popovers.
**Bet:** spatial memory beats any menu; every fact has a permanent home.
**Tradeoff:** the fixed grid is the least elastic at extreme scale.
