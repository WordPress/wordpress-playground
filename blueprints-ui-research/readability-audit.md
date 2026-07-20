# Blueprint editor readability audit

## What the screen is for

This is not a workflow builder and it is not a friendlier view of a JSON Schema.
It is a **WordPress site manifest**: a person should be able to see what a site is
made from, change one part, and still remember the rest of the site.

The primary loop is short:

1. Understand the whole site.
2. Choose one familiar part.
3. Change or add one thing.
4. Return to the same overview with the change reflected there.

Blueprint v2 remains the lossless source of truth. The visual editor groups it
into seven familiar concepts: **Site, Themes & fonts, Plugins, Content, Users,
Open in Playground, and Custom setup**.

## Short-fuse scan test

In ten seconds, without opening anything, a person should be able to answer:

- Which WordPress/PHP setup and starting state will be used?
- Which theme is active?
- Which plugins, content, and people are included?
- Where does the site open, and as whom?
- Is there custom or high-impact setup to review?
- What do I click to change one of those things?

The current paper/site-card directions fail this test. They are attractive at
rest, but require interpretation before action.

## Read this first

The three failures that matter most:

1. **There is no stable map.** Themes, plugins, users, content, and runtime
   choices use different visual languages and move in and out of view.
2. **The interface hides the way through.** Small muted copy, hover-only tools,
   and ambiguous clickable objects make every next action a guess.
3. **Inputs are mixed with outcomes.** Source files and ordered setup work sit
   beside the parts of the resulting WordPress site, so people must understand
   implementation details before they can make an ordinary change.

**Decision:** use the Guide rail on wide screens and its Expand-in-place form on
narrow screens. Keep JSON as a synchronized peer, not as an escape hatch.

## Cognitive-load problems

### 1. The hierarchy starts with decoration, not the job

- The miniature browser, large title, metadata line, avatars, and theme caption
  occupy the strongest part of the page before the inventory begins.
- The browser preview looks actionable, but its purpose is ambiguous: theme,
  landing page, preview, or navigation.
- Theme and people are embedded in the hero while plugins and content are below.
  Equivalent parts therefore do not look or behave alike.
- “Bill of materials” is visually quieter than the site name, but the bill is the
  actual editing model.

**Correction:** begin with a stable seven-part bill. Site identity is context,
not a hero.

### 2. Too many visual grammars must be learned

The current concepts mix:

- a mini browser;
- inline sentence controls;
- avatar controls;
- icon tiles;
- file trees;
- numbered recipes;
- settings rows;
- fine-print developer lines;
- hover-only tools;
- popovers and inline inspectors.

Each grammar may be reasonable alone. Together they make the user repeatedly ask
“how does this part work?”

**Correction:** one navigation grammar, one inventory-row grammar, and one local
details grammar across the entire editor.

### 3. Readability is being purchased with low contrast and small type

- Important summaries use small gray text that is difficult to scan quickly.
- Mono type is used for ordinary product information, adding visual noise without
  adding meaning.
- Several labels and actions sit around 11–13px.
- Long, low-contrast lines require careful reading instead of recognition.
- Hairlines, muted text, and whitespace do most of the grouping; when any one of
  them becomes hard to perceive, the structure collapses.

**Correction:** 16px body copy, 14px minimum supporting copy, dark secondary text,
plain system type, and hierarchy expressed by position and weight before color.

### 4. The high-level map is incomplete

- Empty parts disappear or are reduced to detached “add” links near the bottom.
- “Files & media” and “Fonts” appear as afterthoughts rather than as contents of a
  recognizable part.
- Settings, recipes, and custom code overlap conceptually.
- A theme is in the hero, users are avatars, and runtime settings are fragments of
  a sentence, so there is no single place to audit the full Blueprint.
- The overview does not call out high-impact behavior such as SQL, resets, or
  after-setup code.

**Correction:** every one of the seven parts stays visible, including empty ones.
Each gets one factual summary of at most two chunks.

### 5. The interface relies on hidden knowledge

- Controls and carets appear on hover, which makes the resting state calm but the
  editing model undiscoverable.
- A person must infer that a tile, screenshot, avatar, underlined token, or entire
  row is clickable.
- “Recipes,” “Run PHP,” constants, activation options, and raw permalink strings
  expose implementation vocabulary before the user asks for it.
- Source mechanisms such as Git, URLs, uploads, inline files, and Blueprint paths
  can become a taxonomy the user has to understand before adding an item.

**Correction:** keep visible actions visible. Start with the material (“Add
plugin”), then ask **From where?** only when needed. Put technical choices behind
one local **More settings** disclosure.

### 6. Drill-down changes the page more than the user's mental state

- Opening an inspector pushes later content far down the page.
- Popovers detach the choice from the item being edited.
- A long page can leave the user with no persistent indication of the other parts.
- Different categories open in different ways, so backtracking is inconsistent.
- The selected state is subtle and can be lost among pale surfaces.

**Correction:** preserve the bill while one part changes. Keep only one material
open. Closing it must restore the same part, scroll position, and keyboard focus.

### 7. The screen offers too many plausible next actions

- Global Run/JSON controls, category Add actions, edit links, source links,
  “change theme,” code links, and hover removals compete.
- Repeated plus signs make every empty or editable area demand attention.
- Some labels describe mechanics (“Edit code”) while others describe outcomes
  (“Change theme”), so action priority is unclear.

**Correction:** one primary global action. Within a focused part, one visible
“Add …” action. In an add confirmation, **Add to Blueprint** is the only primary
button.

### 8. The category model is still too close to implementation

- Data resources are not a part of the resulting site; they are the provenance of
  a plugin, theme, import, font, or file.
- A Step Library item is not necessarily a persistent “recipe.” It may simply set
  the site title, add a plugin, create content, or retain ordered final work.
- Keeping “Recipes” beside “Custom code” creates two escape hatches whose boundary
  must be learned.

**Correction:** a library entry should dissolve into the bill. It updates a
field, adds a normal material, or appears under **Custom setup → After setup**.
The friendly UI never needs a permanent Steps or Recipes section.

### 9. Large and imported Blueprints are not safely summarized

- Names alone do not reveal inactive plugins, unknown JSON, destructive actions,
  or an unusual source.
- Tile layouts become tall and difficult to compare as collections grow.
- Unsupported imported fields risk either disappearing from the friendly view or
  turning every row into an expert form.

**Correction:** summaries prioritize exceptions: `1 inactive`, `includes SQL`,
or `1 item in JSON`. Preserve unsupported data and provide a direct JSON route.

### 10. Touch, zoom, and keyboard use expose the hidden affordances

- Hover-only controls have no touch equivalent.
- Small inline links and plus controls miss comfortable target sizes.
- Wide inline metadata does not reflow cleanly.
- Visual order can diverge from keyboard order when popovers and overlays appear.

**Correction:** 44px targets, real buttons and disclosures, visible focus, logical
DOM order, and a narrow-screen section chooser that preserves the same seven-part
map.

### 11. Unclear commit and recovery behavior consumes working memory

- A person cannot tell whether a change is already in the Blueprint, only in an
  open editor, or still waiting for confirmation.
- Immediate removal without Undo makes every click feel risky.
- Closing an editor, pressing Escape, or clicking the background must not silently
  commit or discard work.
- A visual editor and JSON view that can drift force the user to remember which
  one is current.
- Reloading or navigating away without a dirty-state warning can destroy a long
  editing session.

**Correction:** autosave one canonical Blueprint document, show truthful
Saved/Saving/Unsaved state, provide Undo for add/edit/remove, make Cancel and
Escape non-committing, and keep visual and JSON views live-synchronized.

### 12. “Files” and “media” are not interchangeable

- A file included so the Blueprint can install or run something is an input to
  the setup.
- A file imported into the WordPress Media Library is part of the resulting site.
- Combining both under “Files & media” makes it impossible to predict where a file
  will end up or whether site users will see it.

**Correction:** show Media Library items under Content. Show setup inputs only as
the **From** value of the material or action that consumes them; a separate file
browser may list reuse, but it is not another bill section.

## What to keep and what to reject from the previous directions

- **07 · minimal bill:** keep the uniform section rows, one-open-item rule,
  contextual source, and explicit Add to Blueprint confirmation. Add a persistent
  map, visible controls, Undo, and live JSON.
- **08 · site card:** keep live JSON, Undo, and one embedded run surface. Do not use
  the mini-browser, avatars, and scattered direct-manipulation controls as the
  primary editor; they hide where settings live.
- **09 · paper Blueprint:** keep it only as a possible read-only/share format. Its
  multiple notations, disappearing empty sections, and hover-revealed controls are
  the opposite of a predictable authoring tool.

## Design rules carried into all five versions

1. The same seven-part bill is always reachable and never reordered.
2. Each summary is one line, two chunks maximum, with no schema terms.
3. Focused layouts open only one part and material at a time; Continuous sheet
   is the deliberate bulk-edit exception.
4. Common fields are visible; **More settings** is the only local advanced layer.
5. Sources appear as a contextual **From** value, not as a top-level section.
6. Library additions merge into their truthful destination after confirmation.
7. Empty parts say **None** rather than disappearing.
8. High-impact or unknown setup is named in the overview.
9. No emoji, decorative status dots, tiny gray type, or hover-only actions.
10. JSON remains a peer view over the same lossless v2 document.
11. Add/edit/remove must be recoverable and must update every affected summary.

There is one implementation constraint behind the additions-library concept:
some current Step Library entries compile into procedural after-setup work rather
than declarative v2 materials. A semantic adapter may index their predicted
results under Content or Users, but the ordered action remains the serialized
truth. Without that adapter, keep the item under **Custom setup → After setup**
and cross-reference its expected results; never pretend it became top-level v2
content.

## Five versions

### 1. Guide rail — recommended

A fixed seven-line bill sits beside one focused editor. This is the clearest
answer to “drill down without losing the rest.” It uses width well and keeps the
interaction model ordinary.

**Tradeoff:** on a narrow Dock, the rail becomes the Expand-in-place ledger so
the full map remains visible without squeezing the editor.

### 2. Continuous sheet

The earlier build sheet returns as one complete scrolling document with a sticky
table of contents. It is the only proposal that keeps several sections available
for side-by-side reading and bulk editing.

**Tradeoff:** it is the longest and busiest version. The outline reduces
navigation cost but cannot reduce the amount of content in the document.

### 3. Expand in place

One continuous ledger shows all seven parts. The selected part opens directly
below its summary while the other rows remain in the document. This is the most
natural fit for narrow panes.

**Tradeoff:** a long open section can push later summaries below the viewport, so
item details must stay compact.

### 4. Readable summary

The resting view is seven plain-language sentences. Editing one opens a side
sheet while the complete description remains visible. This is strongest for
review, teaching, and handoff.

**Tradeoff:** prose must remain generated and literal; it must never soften or
omit technical behavior.

### 5. Column browser

A Finder-like view keeps parts, materials, and the selected material's settings
in adjacent columns. It is fast for large inventories and makes location
unmistakable.

**Tradeoff:** it uses the most width and exposes three levels at once, so it is
best as a power-user or large-Blueprint layout rather than the default. The
prototype fully demonstrates plugin editing; other inspectors stay read-only so
this direction tests the navigation model rather than seven duplicate forms.

The interactive comparison is in
[`mockups/10-readable-bom.html`](./mockups/10-readable-bom.html).

The JSON peer is intentionally read-only in this layout prototype. The product
requirement remains synchronized visual and source editing over one document.
