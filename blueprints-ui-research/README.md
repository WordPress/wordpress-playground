# A visual Blueprints editor for WordPress Playground — research + 6 design directions

**What this is:** research toward a UI Blueprint editor (in Playground or a companion linked from the main UI), plus six clickable design directions to react to — led by a **Bill of Materials** (Design 6). Open [`index.html`](./index.html) for the visual tour; open the files in [`mockups/`](./mockups/) to click around. This doc is the written record behind them.

**Sample used throughout:** a WooCommerce demo store — `plugins: ["woocommerce"]` · `activeTheme: "storefront"` · a `content` WXR import · one custom `runPHP` tweak. All field names are the real Blueprint schema.

---

## TL;DR — the recommendation

You don't need a builder from zero. Alex Kirk's Step Library already proves the palette-and-canvas builder; a real editor is **shipping right now** in the 2026 Dock UI (this branch). The open question is *UX shape*, and here two independent research passes — a survey of comparable products and a survey of progressive-disclosure patterns — **converged on the same answer**, which also matches what the team already decided over three years of discussion:

> Model the Blueprint as a **bill of materials** — the site as a parts list grouped by what users already know (**Plugins, Themes, Content, Users, Settings, Custom code**), each a **single list with a ＋**. Never one card per item, never a label that echoes the schema. Keep a **Custom code** category as the escape hatch, let power users flip the whole document to **round-trip-synced raw JSON**, and make it **correct-by-construction** (the UI can only emit valid Blueprints) with **lenient** validation. **At rest it's one line per category (readable at a glance); open a line to drill in while the rest stay as summaries** — a focus accordion, so the whole site stays legible even as you edit one part.

That's **Design 6 (Bill of Materials)** as the primary editing surface, its **Materials ⇄ JSON** toggle as the developer view, and **Design 3 (Guided Start)** as the non-dev on-ramp. **Design 1 (Recipe Cards)** is the alternative "steps = Gutenberg blocks" model; **Design 4 (AI)** and **Design 5 (Notebook)** are *layers on top* — an entry mode and a sharing/teaching format — not competing editors.

**Why aggregate-by-category, not step-by-step:** a user doesn't think in `installPlugin` steps; they think "my site needs these plugins, this theme, this content, these people." An earlier per-step form (Design 2's form half) mirrored the schema one-node-per-card and was rightly rejected as useless to both audiences — the Bill of Materials replaces it. **v2's declarative shape is what makes this clean**: `plugins[]`, `activeTheme`, `content[]`, `users[]`, `siteOptions` map almost 1:1 to the human categories, and Playground works out the execution order.

**Two things fold cleanly into this model** (both shown in the minimal mockup):

- **Data resources → one "Source" control.** v2 can point at bytes many ways (a wordpress.org slug, a URL, a Git repo, an uploaded file, inline content). Instead of exposing that zoo as separate concepts, every "Add" and every item's options use the *same* picker — **WordPress.org · URL · GitHub · Upload · Paste** — and uploaded/pasted bytes collect in a **Files** lane, referenceable by many items. One vocabulary, everywhere.
- **Step library → "Recipes", distributed.** We're not editing "steps," so the library is reframed as **Recipes** (named outcomes). A recipe that produces a *thing* (githubPlugin, sampleContent, createUser) surfaces as an **Add option inside its category** — a GitHub plugin is just a plugin with a Git source, i.e. the resources point above. A recipe that's a *behavior* (disable welcome guides, show admin notice) lives in a **Recipes** lane, one tier above raw **Custom code**, and can "show the code" it compiles to. Net framing, high→low: **Materials (nouns) → Recipes (named outcomes) → Custom code (raw)**. The word "step" never reaches the user.

A full node-graph canvas (n8n/Make style) was **considered and rejected**: both passes flag it as overkill for a *linear* sequence. Its one great idea — the per-field *value ⇄ expression* escape hatch — is folded into the item rows.

---

## The six designs

| # | Direction | Audience | Foregrounds | Backed by |
|---|-----------|----------|-------------|-----------|
| **6** | [**Bill of Materials · minimal**](./mockups/07-bom-minimal.html) | **★ recommended primary** | whole site as a one-line-per-category manifest; open one line to drill in, the rest stay as summaries (focus accordion); two-level drill-down; list + ＋ per category; Materials⇄JSON. *(Fuller "everything expanded" variant: [06](./mockups/06-bill-of-materials.html).)* | package manifests · settings apps · Figma layers · v2 declarative schema |
| **1** | [**Recipe Cards**](./mockups/01-recipe-cards.html) | alternative: steps = blocks | inline-edited plain-language step cards; Advanced reveal; escape hatch; status dots | Gutenberg · Alex Kirk Step Library |
| **2** | [**Form ⇄ Code split**](./mockups/02-form-code-split.html) | developer round-trip | round-trip sync; jump-to-node; lenient validation; merged "full config" lens — *its form half is superseded by #6; the code round-trip lives on as #6's JSON toggle* | Stoplight · GitLab CI · Ryan Welcher's WP Director |
| **3** | [**Guided Start**](./mockups/03-guided-start.html) | non-dev on-ramp | goal → prefilled starter → editor; Preferred/Custom fork; record-from-site | Shopify · Vercel · Local by Flywheel · GitHub starter workflows |
| **4** | [**AI Conversational Builder**](./mockups/04-ai-builder.html) | entry layer | describe → editable cards; "explain this"; "what's missing?"; escape to JSON | Matías/Artur AI thread · Alex Kirk "AI instructions" · PLAYGRD-610 |
| **5** | [**Notebook Blueprint**](./mockups/05-notebook.html) | share & teach | prose + step capsules + first-class code cells; per-cell show-code | Observable · Jupyter · "WordPress Recipes" |

Each mockup has an **"about this design"** panel pinned to the bottom explaining the pattern and the evidence.

---

## Part 1 — What everyone has already said and built

This idea has a **~3-year history and at least eight distinct builders**. The single most important context: Adam's own [2023 Coordination Thread: Playground builder](https://playgroundp2.wordpress.com/2023/11/21/coordination-thread-playground-builder/), created *"to closely coordinate all Automattic efforts around creating a user interface for building Playground sites"* — with the stated risk *"A bad outcome is we end up building similar features many times over."* That fear largely came true, which makes **consolidation** the real job, not novelty.

### Named positions

- **Antonio Sejas** — built the *first* Blueprints editor; vision *"the fastest way to start creating a custom Playground / WordPress site… pretty similar to codesandbox.io but for WordPress,"* command-palette to add steps, later pushed a free, no-account, WordPress.com-branded builder.
- **Sean Morris** — the autocompleting builder that became the official [`builder.html`](https://playground.wordpress.net/builder/builder.html).
- **Dennis Snell** — the sharpest and still-strongest design argument: *"I'd rather see us build a GUI builder where each step has a corresponding UI configuration… we don't need to validate because the UI will only create Blueprints that are correct by construction… The `@wordpress/components` seem fit for the job."*
- **Matías Ventura** — argued **AI should be the primary interface**, *"with AI in mind from day one,"* also to discover what Blueprint syntax can't yet express. **Artur Piszek** prototyped the GPT interfaces.
- **Joen A.** — the "WordPress kitchen"/shopping-cart idea: turn the wp.org directories into a builder.
- **Saxon Fletcher** — branding caution: should this be a *"WordPress builder"* that leads into Playground, not tied to Playground? (→ "WordPress Recipes".)
- **Francesco Bigiarini** (2026) — the clearest recent statement of the split: *"hide as many technical aspects as possible in a 'simple mode' and let the user mess with the code in an advanced mode,"* plus be **lenient** on validation (HTML-browser analogy: run valid steps, warn on invalid).
- **Adam** — held off building a full Playground-side GUI in 2023 (let community/AI lead) while keeping the autocompleted JSON editor devs asked for. Crucially, the architectural vision: *"The step library makes perfect sense in Gutenberg. Custom steps would be just custom blocks. Step blocks can be composable via patterns. Predefined sites with customizable parts are just partially synced patterns."* And a UX nuance that tempers the "inspector sidebar" pattern: **inline editing in the canvas**, because *"moving the inputs away from the canvas seems like friction."*

### The three use-cases Adam named (GitHub #1800)

1. **Add-Site form** — the full builder, basic settings by default. *(→ Design 3)*
2. **Fork site / Blueprint** — builder pre-populated, iterate. *(→ Design 3 entry point + Design 1)*
3. **Edit site settings** — runtime config only (can't change WP version after boot). *(a constraint, not a screen)*

`bgrgicak` in the same issue: *"a builder that allows users to visually adjust blueprints and modify JSON if they have more complex needs"* — both forms and drag-and-drop.

### Prior art inside the ecosystem

- **Alex Kirk's Step Library** ([repo](https://github.com/akirk/playground-step-library) · [live](https://akirk.github.io/playground-step-library/)) — the deepest community prior art. **73 steps (65 higher-level "custom" ones)** that compile down to native steps, with a `decompiler` that imports a native Blueprint or Playground URL back into editable steps, and a palette+canvas UI with live JSON preview and "Launch in Playground". 8 categories (Content, Plugins & Themes, Users & Settings, Theme Development, Code & Scripting, Import & Export, Admin & Debug, Advanced). Even ships `blueprintRecorder`/`blueprintExtractor` steps. **This is the model to build on, not around.**
- **lubusIN "Visual Blueprint Builder"** (Ajit Bohra, [repo](https://github.com/lubusIN/visual-blueprint-builder)) — block-based, uses DataViews/DataForm, inline contextual editing for a "bird's-eye view." The PR [#1755](https://github.com/WordPress/wordpress-playground/pull/1755) lineage Adam wanted to bootstrap `@wp-playground/components` from.
- **`builder.html`** — the official Ace-based autocompleting JSON editor (Sean Morris → Sejas lineage), now being superseded ([#3359](https://github.com/WordPress/wordpress-playground/issues/3359)).
- **jdevalk's [blueprint-builder](https://github.com/emilia-Capital/blueprint-builder)** — export an existing site *as* a Blueprint. The pragmatic answer to "reverse-engineer a Blueprint" ([#1809](https://github.com/WordPress/wordpress-playground/issues/1809)).
- **The recorder theme** ([#539](https://github.com/WordPress/wordpress-playground/issues/539)) — Adam's "Blueprint valet" (best-effort record wp-admin actions, fall back to full/diff export); Andrei Draganescu: *"visually recording a blueprint from my WP admin actions… would be amazing!"* even at 80/20. *(→ Design 3 entry point.)*
- **Adjacent product builders**: Ryan Welcher's **WP Director** (`DEVREL-1386` — a form-driven config panel that *replaces the raw JSON textarea* with a collapsed JSON preview; direct correct-by-construction prior art), the **wpcom Simple wizard** (`PLAYGRD-489`), **Studio** "start from a Blueprint" (`STU-624` et al.), and **AI generation** across Site Foundry/Big Sky (`RSM-2740`, `VIP-2384` canonical format, `PLAYGRD-610` Blueprint tool).

### Current (2026) in-product editor — the consolidation target

A real Blueprint editor is live in the Playground website's **Dock** (Fellyph Cintra's prototype), grouping the Blueprint editor + File browser into a collapsible bottom dock. Relevant PRs: [#3990](https://github.com/WordPress/wordpress-playground/pull/3990), [#4053](https://github.com/WordPress/wordpress-playground/pull/4053), [#4067](https://github.com/WordPress/wordpress-playground/pull/4067), [#3760](https://github.com/WordPress/wordpress-playground/pull/3760), [#3723](https://github.com/WordPress/wordpress-playground/pull/3723). **This branch (`adamziel/blueprints-ui-research`) is where the visual layer would go.**

### Codebase reality (what a visual editor slots into)

There is **no visual/form builder yet** — today's editors are raw-JSON CodeMirror with schema autocomplete + linting. But the plumbing is done:

- `packages/playground/website/src/components/blueprint-editor/BlueprintBundleEditor.tsx` — the core editor (CodeMirror + file explorer + validation panel + Run / Copy-URL / Download-Zip toolbar).
- The **Dock "Blueprint" tab** already exists ("Review and edit the Blueprint that describes this Playground") — so "linked in the main UI" is half-built.
- `json-schema-editor/blueprint-linter.ts` → `validateBlueprintDeclaration()` maps AJV errors to inline diagnostics. The Blueprint **JSON Schema is auto-generated from the TypeScript step types** — so a visual editor gets field enums, per-field JSDoc help, and live validation nearly for free.
- `personal-wp/src/lib/blueprint-confirmation/analyzer.ts` already renders steps in **plain language** — a head start on friendly labels.
- Run/preview is `PlaygroundRoute.newSite({hash})` / `{query:{'blueprint-url'}}` + `compileBlueprintForExecution()`.

**The format is Blueprint v2** — a declarative document: `plugins`, `activeTheme`/`themes`, `content`, `siteOptions`, `constants`, `wordpressVersion`/`phpVersion`, `applicationOptions["wordpress-playground"]` (landingPage, login, networkAccess), plus imperative `additionalStepsAfterExecution` for the escape-hatch steps. The mockups author v2 throughout. The editor is a **projection over the same filesystem-backed `blueprint.json`**, reusing `validateBlueprintDeclaration()`; the loader still reads older documents, but nothing in the UI needs to surface that.

---

## Part 2 — How comparable products solve "config-as-code with a friendly face"

The tension — friendly for non-devs, unbounded for devs — is not new. The transferable models:

**The closest analog cluster is text-first + inline assists** (Docker/VS Code, GitHub Actions, GitLab CI, CircleCI, Azure). They never replaced the config file; they *instrumented* it with schema-aware autocomplete, live validation, hover docs, and lint. Lesson: whatever the friendly layer, **keep the raw file first-class and canonical**.

The four best models to actually steal:

1. **Gutenberg — list view + inspector + code toggle over an ordered list of typed items.** A Blueprint *is* an ordered list of typed steps, exactly as a post is an ordered list of typed blocks. Reuse the whole mental model (and `@wordpress/components`): List View for reorder/nav, per-step config, a Patterns-style gallery for step bundles, per-step "Edit as JSON," a global Code Editor toggle. **Zero learning cost for the WordPress audience.**
2. **n8n — per-field "fixed ⇄ expression" toggle + live-preview split editor with a draggable data schema.** The dev-vs-user tension is really *per-field*. n8n keeps the escape present but out of the way, and its live result preview de-risks dropping to code. The single most transferable *control* in the survey.
3. **GitLab pipeline editor — Edit / Visualize / Validate / *Full configuration*.** Steal live schema validation in Edit, a Validate dry-run, and above all the **"Full configuration" merged lens** showing the resolved Blueprint after macros/imports expand — the best idea for a *composable* format.
4. **Stoplight Studio — bidirectional form↔code with jump-and-highlight.** The cleanest proof non-devs (form) and devs (raw JSON) can share one artifact with instant round-trip. Implement via a **data-schema / ui-schema split** (JSONForms/RJSF): your TS step types → JSON Schema (contract) + a thin ui-schema (labels, ordering, widgets, "advanced" grouping) → auto-generated friendly forms.

**Honorable mentions:** Local by Flywheel's **Preferred/Custom fork** (your exact audience split as one radio), Vercel's **detect-and-prefill** (never a blank form), Azure's **"Settings" link that re-opens a raw block in a form**, Zapier's **field "pills"** (friendly variable refs), Shopify's **setup checklist**. **Skip** the node-graph (Make/n8n canvas) until Blueprints branch.

Categories surveyed: Docker Desktop/VS Code, GitHub Actions + starter workflows, GitLab CI, CircleCI, Azure Pipelines, CloudFormation Designer, Terraform/Brainboard, Pulumi, Postman, Stoplight, RJSF/JSONForms, Retool/Appsmith/Budibase, Zapier, Make, n8n, IFTTT, Shopify, Vercel/Netlify, WP core install, Local, Typeform, Webflow, Gutenberg, Observable/Jupyter. (Links in the appendix.)

---

## Part 3 — Progressive-disclosure patterns that fit

Framing from NN/g: **progressive disclosure is hierarchical** (most users finish in the primary layer), **staged disclosure is linear** (a wizard). Hard rule: **never exceed two disclosure levels.** Get the *feature split* right (disclose everything frequently needed up front) and the *reveal control* obvious.

The patterns worth using, and where:

1. **Layered "Advanced" reveal** — common fields shown; the rest behind an in-place "Advanced" expander (2 levels max). → the step card's Basic → Advanced structure.
2. **Semantic / plain-language macro steps** — outcome-named steps ("Add 10 sample products") that transpile to primitives. Playground already has the machinery (Alex Kirk). The critical companion affordance: **"expand to primitives" / "explain this,"** which turns a leaky abstraction from a *wall* into a *door* (Spolsky's Law: every non-trivial abstraction leaks).
3. **Escape hatch / drop-to-code** — a `runPHP` cell in the *same* list as friendly steps, plus per-field expression toggles. Devs never hit a ceiling. Risk: if the friendly path is even slightly annoying, everything becomes `runPHP` — so the friendly path must be genuinely faster for the common case.
4. **Dual-mode round-trip (form ⇄ code)** — one in-memory source of truth; form is a projection, code is its serialization. Switching jumps to the same node.
5. **Templates → customize** — start from a working preset, then reveal knobs. "Configure" must land in the *real* editor, not a read-only dead end.
6. **Inspector / detail-on-demand** — list + contextual settings, with **status dots** on collapsed items so nothing important hides silently (Webflow). *(Tempered by Adam's "edit inline in the canvas" preference — see Design 1.)*
7. **Just-in-time help & inline validation** — dependent fields appear only when relevant (multisite → subdomain/subdirectory); help on focus; validate on blur, not on every keystroke.
8. **App-level Simple / Advanced mode** — the master switch (Francesco Bigiarini).

### Recommended layering (both research passes agreed)

**Inspector-style spine (but inline) + semantic macro cards with layered disclosure + dual-mode round-trip with an always-present escape hatch.**

1. **Foundation:** one `blueprint.json` validated against the auto-generated schema; everything on screen is a projection. (This is what makes dual-mode *safe*.)
2. **Spine:** a reorderable list of step cards. *(Edited inline, per Adam — not a detached inspector.)*
3. **Default language:** semantic macro cards, collapsed = plain-language outcome, expand = Advanced knobs, dependent fields appear only when relevant. Status dots kill "hidden but important."
4. **Dev empowerment:** global Form ⇄ JSON toggle with format-preserving, unknown-key-preserving round-trip; an always-present `runPHP` card; per-field expression toggle; **"expand macro to primitives"** on any semantic step.
5. **On-ramps:** templates gallery + a tiny first-run wizard for version selection — but the editor itself stays non-linear.

---

## Part 4 — The designs, and how they compose

- **Design 1 (Recipe Cards)** is the primary surface and directly realizes Adam's "steps = blocks, presets = patterns," edited inline. It's the friendly default: Simple mode hides the code-heavy cards, Advanced reveals them; each card layers Basic → Advanced → escape hatch; status dots flag non-default settings.
- **Design 2 (Form ⇄ Code)** is the *same document* flipped to the developer view — round-tripped, jump-to-node, lenient validation, plus the GitLab "Full configuration" merged lens for when macros/imports expand. This is where the JSON editor and the form finally become one thing (consolidation).
- **Design 3 (Guided Start)** is the non-dev on-ramp and Adam's "Add-Site form": goal → detected-and-prefilled starter → drop into Design 1. Preferred/Custom fork for runtime; entry points for Fork and Record-from-site cover the other two use-cases.
- **Design 4 (AI)** layers *over* 1–2 as an entry mode — describe → editable cards, with "explain" and "what's missing?" as anti-black-box guardrails. It's the concrete form of the long-running AI-first debate. Caveat: an AI that emits an unrunnable Blueprint is worse than a blank card, so pair with the same lenient validation.
- **Design 5 (Notebook)** is a *format*, not a competing editor — Blueprints as runnable tutorials/docs/bug-repros. It's the strongest expression of "Playground Blueprints of today → WordPress Recipes of tomorrow," and the cleanest home for the escape hatch (a legible code cell beside the prose that motivates it).

### Where it lives

The Dock "Blueprint" tab (this branch) is the natural home for **Designs 1 & 2** — a `[Cards | Code]` view toggle over the same `blueprint.json`. **Design 3** belongs in the "New Playground / Add Site" flow. **Design 4** is a mode within either. **Design 5** could be an export/share format or an alternate "read" view. Nothing here is a new standalone app — which is the whole point given the consolidation history.

---

## Anti-patterns to avoid (specific to config editors)

1. **Destructive mode-switch** — Form → Code → Form silently dropping constructs the form couldn't model. *Fix: JSON is source of truth; preserve unmodeled keys; only rewrite touched nodes.*
2. **Round-trip formatting churn** — re-serialization reorders keys / reflows whitespace, wrecking diffs and blame. *Fix: format-preserving serialization.*
3. **"Advanced" as a junk drawer** — split by real frequency of use; keep to two levels.
4. **Leaky abstraction with no downgrade** — every macro needs "expand to primitives" / "convert to Run PHP."
5. **Invalid-code lockout** — malformed JSON must not trap the user; keep the last-good form, never crash.
6. **Escape-hatch overuse** — make the friendly path genuinely faster than raw code for the common case.
7. **Hidden-but-important** — status dots + one-line summaries on collapsed items.

---

## Open questions worth deciding before building

1. **Declarative-first vs steps.** V2 makes most setup declarative (`plugins`, `activeTheme`, `content`, `activationOptions`), with `additionalStepsAfterExecution` for the imperative tail. How hard should the UI push people toward declarative fields before offering an escape-hatch step?
2. **Inline-canvas editing vs inspector** — Adam prefers inline; the industry default (Gutenberg/Figma/Webflow) is an inspector sidebar. Design 1 goes inline; worth prototyping both on touch/narrow screens.
3. **How much AI** — entry-mode layer (Design 4) vs primary interface (Matías's position). Recommend layer, revisit.
4. **Consolidate or add?** Strong recommendation: build the visual layer **into the Dock editor** and **reuse Alex Kirk's compiler model** for macro steps, rather than starting builder #9.
5. **Naming/scope** — "Blueprint editor" vs the broader "WordPress Recipes" framing (Saxon/Adam).

---

## Links appendix

### Internal design docs (P2)
- Coordination Thread: Playground builder — https://playgroundp2.wordpress.com/2023/11/21/coordination-thread-playground-builder/
- Local Environment: Exploration of Blueprint editor (Monaco PoC) — https://yolop2.wordpress.com/2024/02/14/local-environment-exploration-of-blueprint-editor/
- Create Sites from hosted Blueprints (Studio) — https://yolop2.wordpress.com/2025/07/14/feedback-request-create-sites-from-hosted-blueprints/
- Studio 2025 Q4 roadmap (Sejas free-builder comment) — https://studioapp2.wordpress.com/2025/09/24/studio-2025-q4-and-2026-q1-roadmap/

### GitHub — issues / PRs
- #1800 Consolidate Blueprint builders — https://github.com/WordPress/wordpress-playground/issues/1800
- #539 Blueprints Recorder — https://github.com/WordPress/wordpress-playground/issues/539
- #1809 Reverse-engineer a Blueprint from a site — https://github.com/WordPress/wordpress-playground/issues/1809
- #3359 Redirect builder → editor — https://github.com/WordPress/wordpress-playground/issues/3359
- #2592 Support Blueprints v2 on playground.wordpress.net — https://github.com/WordPress/wordpress-playground/issues/2592
- #1755 Prototype: Block-based Blueprints Editor — https://github.com/WordPress/wordpress-playground/pull/1755
- #773 Original builder.html — https://github.com/WordPress/wordpress-playground/pull/773
- Dock editor: #3990, #4053, #4067, #3760, #3723 — https://github.com/WordPress/wordpress-playground/pull/3990

### Community builders / prior art
- Alex Kirk Step Library — https://github.com/akirk/playground-step-library · https://akirk.github.io/playground-step-library/
- lubusIN Visual Blueprint Builder — https://github.com/lubusIN/visual-blueprint-builder
- Sean Morris builder — https://seanmorris.github.io/playground-blueprint-builder/
- Official builder.html — https://playground.wordpress.net/builder/builder.html
- jdevalk export-site-as-Blueprint — https://github.com/emilia-Capital/blueprint-builder

### Linear
- DEVREL-1386 Blueprint Configuration UI (Ryan Welcher / WP Director) — https://linear.app/a8c/issue/DEVREL-1386/blueprint-configuration-ui
- PLAYGRD-489 Wizard to aid blueprint creation — https://linear.app/a8c/issue/PLAYGRD-489/wizardtool-to-aid-in-blueprint-creation
- PLAYGRD-610 Blueprint tool (Playground AI) — https://linear.app/a8c/issue/PLAYGRD-610/blueprint-tool
- VIP-2384 Canonical Blueprint Format — https://linear.app/a8c/issue/VIP-2384/canonical-blueprint-format
- RSM-2740 AI blueprint generation pipeline — https://linear.app/a8c/issue/RSM-2740/wpcom-real-blueprint-generation-ai-site-builder-pipeline-playground

### Comparable products
- GitLab pipeline editor — https://docs.gitlab.com/ci/pipeline_editor/
- GitHub Actions starter workflows — https://github.com/actions/starter-workflows · https://docs.github.com/actions/writing-workflows/using-workflow-templates
- Stoplight Studio — https://stoplight.io/ · https://philsturgeon.com/reinventing-api-design-stoplight-studio/
- n8n expressions / Code node — https://docs.n8n.io/build/work-with-data/expressions-versus-data-nodes · https://docs.n8n.io/code/code-node/
- CloudFormation Designer — https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/working-with-templates-cfn-designer-walkthrough-createbasicwebserver.html
- Brainboard (Terraform diagram↔HCL) — https://docs.brainboard.co/cloud-design/code-edition · Pulumi Visual Import — https://www.pulumi.com/blog/visual-import/
- Postman params↔URL — https://learning.postman.com/docs/use/send-requests/create-requests/parameters
- JSONForms — https://jsonforms.io/docs/integrations/react · RJSF — https://rjsf-team.github.io/react-jsonschema-form/docs/
- Retool escape hatches — https://community.retool.com/t/keep-retool-customizable-via-js-escape-hatches/20675
- Gutenberg block editor — https://developer.wordpress.org/block-editor/getting-started/fundamentals/block-in-the-editor/
- Local by Flywheel — https://wpengine.com/blog/local-wordpress-development-environment-how-to/ · Vercel builds — https://vercel.com/docs/builds/configure-a-build · Shopify setup checklist — https://help.shopify.com/en/manual/intro-to-shopify/initial-setup/new-to-shopify-checklists/general-checklist
- Typeform Logic Map — https://help.typeform.com/hc/en-us/articles/5514792640916-Use-the-Logic-Map-to-add-Logic-to-your-forms · Webflow Navigator — https://university.webflow.com/videos/navigator
- Observable — https://observablehq.com/@observablehq/observable-for-jupyter-users

### Progressive-disclosure / UX
- NN/g Progressive Disclosure — https://www.nngroup.com/articles/progressive-disclosure/
- NN/g Toggle-Switch Guidelines — https://www.nngroup.com/articles/toggle-switch-guidelines/
- Deno "Your Low-Code Solution Needs an Escape Hatch" — https://deno.com/blog/low-code-needs-an-escape-hatch
- Joel Spolsky, The Law of Leaky Abstractions — https://www.joelonsoftware.com/2002/11/11/the-law-of-leaky-abstractions/
- USWDS complex forms — https://designsystem.digital.gov/patterns/complete-a-complex-form/progress-easily/

---

*Design research compiled July 2026 for the `adamziel/blueprints-ui-research` branch. Mockups are static HTML — no build step; just open them.*
