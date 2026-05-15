"use strict";(globalThis.webpackChunkdocusaurus_classic_typescript=globalThis.webpackChunkdocusaurus_classic_typescript||[]).push([[4714],{1930(e,t,p){p.r(t),p.d(t,{assets:()=>x,contentTitle:()=>u,default:()=>j,frontMatter:()=>h,metadata:()=>n,toc:()=>m});const n=JSON.parse('{"id":"main/guides/php-code-snippets","title":"PHP code snippets and embeds","description":"Embed editable, runnable PHP and WordPress examples in any web page using the <php-snippet> web component.","source":"@site/docs/main/guides/php-code-snippets.md","sourceDirName":"main/guides","slug":"/guides/php-code-snippets","permalink":"/wordpress-playground/fr/guides/php-code-snippets","draft":false,"unlisted":false,"editUrl":"https://github.com/WordPress/wordpress-playground/tree/trunk/packages/docs/site/docs/main/guides/php-code-snippets.md","tags":[],"version":"current","frontMatter":{"title":"PHP code snippets and embeds","slug":"/guides/php-code-snippets","description":"Embed editable, runnable PHP and WordPress examples in any web page using the <php-snippet> web component.","sidebar_class_name":"navbar-build-item"},"sidebar":"mainSidebar","previous":{"title":"\ud83d\udcd6 Guides","permalink":"/wordpress-playground/fr/guides"},"next":{"title":"Using the WordPress Playground Agent Skill","permalink":"/wordpress-playground/fr/guides/agent-skill-wp-playground"}}');var s=p(6870),r=p(5569),i=p(6326);const a="https://playground.wordpress.net/php-code-snippet.js",o={full:String.raw`<script id="product-card-blueprint" type="application/json">
{
  "steps": [
    {
      "step": "writeFile",
      "path": "/wordpress/wp-content/mu-plugins/product-cards.php",
      "data": "<?php\nfunction docs_render_product_card(array $product): string {\n    return sprintf(\n        '<article class=\"product-card\"><h3>%s</h3><p>$%0.2f</p></article>',\n        esc_html($product['name']),\n        $product['price']\n    );\n}\n"
    }
  ]
}
</script>

<php-snippet name="product-card.php" blueprint="product-card-blueprint">
  <script type="application/x-php">
<?php
require '/wordpress/wp-load.php';

$products = [
    [ 'name' => 'Canvas Tote', 'price' => 24 ],
    [ 'name' => 'Coffee & Code Mug', 'price' => 16.5 ],
];

foreach ( $products as $product ) {
    echo docs_render_product_card( $product ) . "\n";
}
  </script>
  <script type="text/expected-output">
<article class="product-card"><h3>Canvas Tote</h3><p>$24.00</p></article>
<article class="product-card"><h3>Coffee &amp; Code Mug</h3><p>$16.50</p></article>
  </script>
</php-snippet>`,hello:String.raw`<php-snippet name="hello.php">
  <script type="application/x-php">
<?php
echo "Hello from PHP " . phpversion();
  </script>
  <script type="text/expected-output">
Hello from PHP 8.4.x
  </script>
</php-snippet>`,htmlApi:String.raw`<php-snippet name="html-api.php">
  <script type="application/x-php">
<?php
require '/wordpress/wp-load.php';

$html = '<img src="hero.jpg" alt="Hero">';
$tags = new WP_HTML_Tag_Processor( $html );

if ( $tags->next_tag( 'img' ) ) {
    $tags->set_attribute( 'loading', 'lazy' );
}

echo $tags->get_updated_html();
  </script>
  <script type="text/expected-output">
<img src="hero.jpg" alt="Hero" loading="lazy">
  </script>
</php-snippet>`,sum:String.raw`<php-snippet name="sum.php" expected-output="42">&lt;?php echo 20 + 22;</php-snippet>`,siteTitle:String.raw`<php-snippet name="site-title.php">
  <script type="application/x-php">
<?php
require '/wordpress/wp-load.php';

update_option( 'blogname', 'Snippet Docs' );
echo get_bloginfo( 'name' );
  </script>
  <script type="text/expected-output">
Snippet Docs
  </script>
</php-snippet>`,purePhp:String.raw`<php-snippet name="pure-php.php" wp="none">
  <script type="application/x-php">
<?php
echo "WordPress installed: ";
echo file_exists( '/wordpress/wp-load.php' ) ? 'yes' : 'no';
  </script>
  <script type="text/expected-output">
WordPress installed: no
  </script>
</php-snippet>`,scratch:String.raw`<php-snippet name="scratch.php">
  <script type="application/x-php">
<?php
$numbers = range( 1, 5 );
echo array_sum( $numbers );
  </script>
  <script type="text/expected-output">
15
 </script>
</php-snippet>`,readOnly:String.raw`<php-snippet name="reference.php" readonly>
  <script type="application/x-php">
<?php
echo "This example can run, but the code is locked.";
  </script>
  <script type="text/expected-output">
This example can run, but the code is locked.
  </script>
</php-snippet>`,precomputed:String.raw`<php-snippet name="precomputed.php">
  <script type="application/x-php">
<?php
echo "2 + 2 = " . ( 2 + 2 );
  </script>
  <script type="text/expected-output">
2 + 2 = 4
  </script>
</php-snippet>`,oneLine:String.raw`<php-snippet name="one-line.php" expected-output="Ready">
  <script type="application/x-php">
<?php echo "Ready";
  </script>
</php-snippet>`,greeting:String.raw`<script id="setup-blueprint-preview" type="application/json">
{
  "steps": [
    {
      "step": "writeFile",
      "path": "/wordpress/wp-content/mu-plugins/helpers.php",
      "data": "<?php\nfunction docs_greet($name) { return 'Hello, ' . $name; }\n"
    }
  ]
}
</script>

<php-snippet name="greeting.php" blueprint="setup-blueprint-preview">
  <script type="application/x-php">
<?php
require '/wordpress/wp-load.php';
echo docs_greet( 'Ada' );
  </script>
  <script type="text/expected-output">
Hello, Ada
  </script>
</php-snippet>`,withSelector:String.raw`<script id="setup-blueprint-selector-preview" type="application/json">
{
  "steps": [
    {
      "step": "writeFile",
      "path": "/wordpress/wp-content/mu-plugins/helpers.php",
      "data": "<?php\nfunction docs_greet($name) { return 'Hello, ' . $name; }\n"
    }
  ]
}
</script>

<php-snippet blueprint="#setup-blueprint-selector-preview" name="with-selector.php">
  <script type="application/x-php">
<?php
require '/wordpress/wp-load.php';
echo docs_greet( 'Grace' );
  </script>
  <script type="text/expected-output">
Hello, Grace
  </script>
</php-snippet>`,enum:String.raw`<php-snippet name="enum.php" php="8.4">
  <script type="application/x-php">
<?php
enum Status {
    case Draft;
    case Published;
}

echo Status::Published->name;
  </script>
  <script type="text/expected-output">
Published
  </script>
</php-snippet>`,wpVersion:String.raw`<php-snippet name="wp-version.php" wp="6.8">
  <script type="application/x-php">
<?php
require '/wordpress/wp-load.php';
echo get_bloginfo( 'version' );
  </script>
  <script type="text/expected-output">
6.8
  </script>
</php-snippet>`,illustration:String.raw`<php-snippet name="illustration.php" runnable="false">
  <script type="application/x-php">
<?php
// This fragment is shown for discussion, not execution.
add_filter( 'the_content', 'docs_filter_content' );
  </script>
</php-snippet>`};function c({html:e}){return(0,i.useEffect)(()=>{if(document.querySelector(`script[src="${a}"]`))return;const e=document.createElement("script");e.type="module",e.src=a,document.head.appendChild(e)},[]),(0,s.jsx)("div",{className:"php-code-snippet-live-example",dangerouslySetInnerHTML:{__html:e}})}function l({name:e}){return(0,s.jsx)(c,{html:o[e]})}function d(){return(0,s.jsx)(c,{html:o.full})}const h={title:"PHP code snippets and embeds",slug:"/guides/php-code-snippets",description:"Embed editable, runnable PHP and WordPress examples in any web page using the <php-snippet> web component.",sidebar_class_name:"navbar-build-item"},u="PHP code snippets and embeds",x={},m=[{value:"Try it",id:"try-it",level:2},{value:"Start with one snippet",id:"start-with-one-snippet",level:2},{value:"Write PHP safely in HTML",id:"write-php-safely-in-html",level:2},{value:"Use WordPress APIs",id:"use-wordpress-apis",level:2},{value:"Edit examples in place",id:"edit-examples-in-place",level:2},{value:"Show output before Run",id:"show-output-before-run",level:2},{value:"Prepare a site with a Blueprint",id:"prepare-a-site-with-a-blueprint",level:2},{value:"Load PHP from another file",id:"load-php-from-another-file",level:2},{value:"Pin PHP or WordPress versions",id:"pin-php-or-wordpress-versions",level:2},{value:"Show code without running it",id:"show-code-without-running-it",level:2},{value:"Self-host the runtime",id:"self-host-the-runtime",level:2},{value:"Runtime sharing",id:"runtime-sharing",level:2},{value:"Security and CSP",id:"security-and-csp",level:2},{value:"Standalone PHP Playground",id:"standalone-php-playground",level:2},{value:"Which embed should you use?",id:"which-embed-should-you-use",level:2},{value:"Troubleshooting",id:"troubleshooting",level:2}];function g(e){const t={a:"a",blockquote:"blockquote",code:"code",h1:"h1",h2:"h2",header:"header",li:"li",ol:"ol",p:"p",pre:"pre",table:"table",tbody:"tbody",td:"td",th:"th",thead:"thead",tr:"tr",ul:"ul",...(0,r.R)(),...e.components};return(0,s.jsxs)(s.Fragment,{children:[(0,s.jsx)(t.header,{children:(0,s.jsx)(t.h1,{id:"php-code-snippets-and-embeds",children:"PHP code snippets and embeds"})}),"\n",(0,s.jsxs)(t.p,{children:["Use ",(0,s.jsx)(t.code,{children:"<php-snippet>"})," when you want readers to run PHP or WordPress code directly\nfrom a docs page, tutorial, blog post, or demo. It renders a syntax-highlighted\ncode block with a Run button and starts a real Playground runtime only when the\nreader asks for it."]}),"\n",(0,s.jsx)(t.p,{children:"The runtime is shared across matching snippets on the same page, so a tutorial\ncan include several runnable examples without starting WordPress over and over."}),"\n",(0,s.jsx)(t.h2,{id:"try-it",children:"Try it"}),"\n",(0,s.jsx)(t.p,{children:"The example below is editable and runnable. It also uses a Blueprint to install\na small mu-plugin before the snippet runs, so the PHP code can call a helper\nfunction that did not exist in the default WordPress install."}),"\n",(0,s.jsx)(d,{}),"\n",(0,s.jsx)(t.p,{children:"Here is the complete embed:"}),"\n",(0,s.jsx)(t.pre,{children:(0,s.jsx)(t.code,{className:"language-html",children:'<script type="module" src="https://playground.wordpress.net/php-code-snippet.js"><\/script>\n\n<script id="product-card-blueprint" type="application/json">\n\t{\n\t\t"steps": [\n\t\t\t{\n\t\t\t\t"step": "writeFile",\n\t\t\t\t"path": "/wordpress/wp-content/mu-plugins/product-cards.php",\n\t\t\t\t"data": "<?php\\nfunction docs_render_product_card(array $product): string {\\n    return sprintf(\\n        \'<article class=\\"product-card\\"><h3>%s</h3><p>$%0.2f</p></article>\',\\n        esc_html($product[\'name\']),\\n        $product[\'price\']\\n    );\\n}\\n"\n\t\t\t}\n\t\t]\n\t}\n<\/script>\n\n<php-snippet name="product-card.php" blueprint="product-card-blueprint">\n\t<script type="application/x-php">\n\t\t<?php\n\t\trequire \'/wordpress/wp-load.php\';\n\n\t\t$products = [\n\t\t    [ \'name\' => \'Canvas Tote\', \'price\' => 24 ],\n\t\t    [ \'name\' => \'Coffee & Code Mug\', \'price\' => 16.5 ],\n\t\t];\n\n\t\tforeach ( $products as $product ) {\n\t\t    echo docs_render_product_card( $product ) . "\\n";\n\t\t}\n\t<\/script>\n\t<script type="text/expected-output">\n\t\t<article class="product-card"><h3>Canvas Tote</h3><p>$24.00</p></article>\n\t\t<article class="product-card"><h3>Coffee &amp; Code Mug</h3><p>$16.50</p></article>\n\t<\/script>\n</php-snippet>\n'})}),"\n",(0,s.jsx)(t.p,{children:"Use this pattern when each example should start from the same prepared site:\nhelper functions, mu-plugins, options, themes, demo files, or sample content."}),"\n",(0,s.jsx)(t.h2,{id:"start-with-one-snippet",children:"Start with one snippet"}),"\n",(0,s.jsxs)(t.p,{children:["For a basic runnable example, add the component script once and place PHP inside\n",(0,s.jsx)(t.code,{children:"<php-snippet>"}),":"]}),"\n",(0,s.jsx)(l,{name:"hello"}),"\n",(0,s.jsx)(t.pre,{children:(0,s.jsx)(t.code,{className:"language-html",children:'<script type="module" src="https://playground.wordpress.net/php-code-snippet.js"><\/script>\n\n<php-snippet name="hello.php">\n\t<script type="application/x-php">\n\t\t<?php\n\t\techo "Hello from PHP " . phpversion();\n\t<\/script>\n\t<script type="text/expected-output">\n\t\tHello from PHP 8.4.x\n\t<\/script>\n</php-snippet>\n'})}),"\n",(0,s.jsx)(t.p,{children:"The script itself is small. PHP, WordPress, and the WASM runtime are fetched\nlater, after the first Run click. The expected output appears before Run and is\nreplaced with the exact PHP version after execution."}),"\n",(0,s.jsx)(t.h2,{id:"write-php-safely-in-html",children:"Write PHP safely in HTML"}),"\n",(0,s.jsxs)(t.p,{children:["Put inline PHP in a ",(0,s.jsx)(t.code,{children:'<script type="application/x-php">'})," child. Browsers ignore\nscript tags with unknown types, which means PHP strings can contain HTML without\nescaping every ",(0,s.jsx)(t.code,{children:"<"})," character."]}),"\n",(0,s.jsx)(l,{name:"htmlApi"}),"\n",(0,s.jsx)(t.pre,{children:(0,s.jsx)(t.code,{className:"language-html",children:'<php-snippet name="html-api.php">\n\t<script type="application/x-php">\n\t\t<?php\n\t\trequire \'/wordpress/wp-load.php\';\n\n\t\t$html = \'<img src="hero.jpg" alt="Hero">\';\n\t\t$tags = new WP_HTML_Tag_Processor( $html );\n\n\t\tif ( $tags->next_tag( \'img\' ) ) {\n\t\t    $tags->set_attribute( \'loading\', \'lazy\' );\n\t\t}\n\n\t\techo $tags->get_updated_html();\n\t<\/script>\n\t<script type="text/expected-output">\n\t\t<img src="hero.jpg" alt="Hero" loading="lazy">\n\t<\/script>\n</php-snippet>\n'})}),"\n",(0,s.jsx)(t.p,{children:"Very short snippets can also be written as text, as long as PHP opening tags are\nescaped:"}),"\n",(0,s.jsx)(l,{name:"sum"}),"\n",(0,s.jsx)(t.pre,{children:(0,s.jsx)(t.code,{className:"language-html",children:'<php-snippet name="sum.php" expected-output="42"> &lt;?php echo 20 + 22; </php-snippet>\n'})}),"\n",(0,s.jsx)(t.h2,{id:"use-wordpress-apis",children:"Use WordPress APIs"}),"\n",(0,s.jsxs)(t.p,{children:["Snippets run in a real WordPress installation by default. Load WordPress with\n",(0,s.jsx)(t.code,{children:"require '/wordpress/wp-load.php'"}),", then call core APIs as usual."]}),"\n",(0,s.jsx)(l,{name:"siteTitle"}),"\n",(0,s.jsx)(t.pre,{children:(0,s.jsx)(t.code,{className:"language-html",children:"<php-snippet name=\"site-title.php\">\n\t<script type=\"application/x-php\">\n\t\t<?php\n\t\trequire '/wordpress/wp-load.php';\n\n\t\tupdate_option( 'blogname', 'Snippet Docs' );\n\t\techo get_bloginfo( 'name' );\n\t<\/script>\n\t<script type=\"text/expected-output\">\n\t\tSnippet Docs\n\t<\/script>\n</php-snippet>\n"})}),"\n",(0,s.jsxs)(t.p,{children:["If your example is pure PHP and does not need WordPress, use ",(0,s.jsx)(t.code,{children:'wp="none"'})," to skip\nthe WordPress download and boot step:"]}),"\n",(0,s.jsx)(l,{name:"purePhp"}),"\n",(0,s.jsx)(t.pre,{children:(0,s.jsx)(t.code,{className:"language-html",children:'<php-snippet name="pure-php.php" wp="none">\n\t<script type="application/x-php">\n\t\t<?php\n\t\techo "WordPress installed: ";\n\t\techo file_exists( \'/wordpress/wp-load.php\' ) ? \'yes\' : \'no\';\n\t<\/script>\n\t<script type="text/expected-output">\n\t\tWordPress installed: no\n\t<\/script>\n</php-snippet>\n'})}),"\n",(0,s.jsx)(t.h2,{id:"edit-examples-in-place",children:"Edit examples in place"}),"\n",(0,s.jsx)(t.p,{children:"Runnable snippets are editable by default. The edited code is kept only in the\ncurrent page session; refreshing restores the original snippet."}),"\n",(0,s.jsx)(l,{name:"scratch"}),"\n",(0,s.jsx)(t.pre,{children:(0,s.jsx)(t.code,{className:"language-html",children:'<php-snippet name="scratch.php">\n\t<script type="application/x-php">\n\t\t<?php\n\t\t$numbers = range( 1, 5 );\n\t\techo array_sum( $numbers );\n\t<\/script>\n\t<script type="text/expected-output">\n\t\t15\n\t<\/script>\n</php-snippet>\n'})}),"\n",(0,s.jsxs)(t.p,{children:["Editable snippets also run with ",(0,s.jsx)(t.code,{children:"Ctrl+Enter"})," or ",(0,s.jsx)(t.code,{children:"Cmd+Enter"})," while the editor is\nfocused."]}),"\n",(0,s.jsxs)(t.p,{children:["Use ",(0,s.jsx)(t.code,{children:"readonly"})," for runnable examples that should be copied or run as-is:"]}),"\n",(0,s.jsx)(l,{name:"readOnly"}),"\n",(0,s.jsx)(t.pre,{children:(0,s.jsx)(t.code,{className:"language-html",children:'<php-snippet name="reference.php" readonly>\n\t<script type="application/x-php">\n\t\t<?php\n\t\techo "This example can run, but the code is locked.";\n\t<\/script>\n\t<script type="text/expected-output">\n\t\tThis example can run, but the code is locked.\n\t<\/script>\n</php-snippet>\n'})}),"\n",(0,s.jsxs)(t.p,{children:[(0,s.jsx)(t.code,{children:'editable="false"'})," works as a compatibility alias for ",(0,s.jsx)(t.code,{children:"readonly"}),"."]}),"\n",(0,s.jsx)(t.h2,{id:"show-output-before-run",children:"Show output before Run"}),"\n",(0,s.jsx)(t.p,{children:"Use expected output when you want the result visible immediately. The placeholder\nis replaced with real runtime output after the reader clicks Run."}),"\n",(0,s.jsx)(l,{name:"precomputed"}),"\n",(0,s.jsx)(t.pre,{children:(0,s.jsx)(t.code,{className:"language-html",children:'<php-snippet name="precomputed.php">\n\t<script type="application/x-php">\n\t\t<?php\n\t\techo "2 + 2 = " . ( 2 + 2 );\n\t<\/script>\n\t<script type="text/expected-output">\n\t\t2 + 2 = 4\n\t<\/script>\n</php-snippet>\n'})}),"\n",(0,s.jsxs)(t.p,{children:["For one-line output, use the ",(0,s.jsx)(t.code,{children:"expected-output"})," attribute:"]}),"\n",(0,s.jsx)(l,{name:"oneLine"}),"\n",(0,s.jsx)(t.pre,{children:(0,s.jsx)(t.code,{className:"language-html",children:'<php-snippet name="one-line.php" expected-output="Ready">\n\t<script type="application/x-php">\n\t\t<?php echo "Ready";\n\t<\/script>\n</php-snippet>\n'})}),"\n",(0,s.jsx)(t.h2,{id:"prepare-a-site-with-a-blueprint",children:"Prepare a site with a Blueprint"}),"\n",(0,s.jsxs)(t.p,{children:["Use ",(0,s.jsx)(t.code,{children:"blueprint"})," when snippets need setup before the PHP code runs. Put a JSON\n",(0,s.jsx)(t.a,{href:"/blueprints/",children:"Blueprint"})," in the page and point snippets at it by id or CSS\nselector."]}),"\n",(0,s.jsx)(l,{name:"greeting"}),"\n",(0,s.jsx)(t.pre,{children:(0,s.jsx)(t.code,{className:"language-html",children:'<script id="setup-blueprint" type="application/json">\n\t{\n\t\t"steps": [\n\t\t\t{\n\t\t\t\t"step": "writeFile",\n\t\t\t\t"path": "/wordpress/wp-content/mu-plugins/helpers.php",\n\t\t\t\t"data": "<?php\\nfunction docs_greet($name) { return \'Hello, \' . $name; }\\n"\n\t\t\t}\n\t\t]\n\t}\n<\/script>\n\n<php-snippet name="greeting.php" blueprint="setup-blueprint">\n\t<script type="application/x-php">\n\t\t<?php\n\t\trequire \'/wordpress/wp-load.php\';\n\t\techo docs_greet( \'Ada\' );\n\t<\/script>\n\t<script type="text/expected-output">\n\t\tHello, Ada\n\t<\/script>\n</php-snippet>\n'})}),"\n",(0,s.jsx)(t.p,{children:"The selector form is useful when generated markup cannot guarantee simple ids:"}),"\n",(0,s.jsx)(l,{name:"withSelector"}),"\n",(0,s.jsx)(t.pre,{children:(0,s.jsx)(t.code,{className:"language-html",children:'<php-snippet blueprint="#setup-blueprint" name="with-selector.php">\n\t<script type="application/x-php">\n\t\t<?php\n\t\trequire \'/wordpress/wp-load.php\';\n\t\techo docs_greet( \'Grace\' );\n\t<\/script>\n\t<script type="text/expected-output">\n\t\tHello, Grace\n\t<\/script>\n</php-snippet>\n'})}),"\n",(0,s.jsxs)(t.p,{children:["Prefer ",(0,s.jsx)(t.code,{children:'<script type="application/json">'})," for Blueprints. Its contents are raw\ntext, so embedded PHP strings such as ",(0,s.jsx)(t.code,{children:"<?php"})," are safe. A ",(0,s.jsx)(t.code,{children:"<template>"})," can work,\nbut its contents are parsed as HTML; if you use one, escape ",(0,s.jsx)(t.code,{children:"<"})," in embedded PHP\nstrings as ",(0,s.jsx)(t.code,{children:"\\u003c"}),"."]}),"\n",(0,s.jsx)(t.h2,{id:"load-php-from-another-file",children:"Load PHP from another file"}),"\n",(0,s.jsxs)(t.p,{children:["Use ",(0,s.jsx)(t.code,{children:"src"})," when the PHP source should live in a separate file:"]}),"\n",(0,s.jsx)(t.pre,{children:(0,s.jsx)(t.code,{className:"language-html",children:'<php-snippet name="external-example.php" src="/snippets/external-example.php" expected-output="Loaded from an external file"></php-snippet>\n'})}),"\n",(0,s.jsxs)(t.p,{children:["The URL resolves from the page that contains the snippet. If the file is hosted\non another origin, serve it with an ",(0,s.jsx)(t.code,{children:"Access-Control-Allow-Origin"})," header that\nallows the documentation page."]}),"\n",(0,s.jsxs)(t.p,{children:[(0,s.jsx)(t.code,{children:"src"})," loads only the snippet body. Use a Blueprint when you need support files,\nplugins, options, or other setup before the snippet runs. The ",(0,s.jsx)(t.code,{children:"expected-output"}),"\nattribute is still useful with ",(0,s.jsx)(t.code,{children:"src"})," when you already know what the external PHP\nfile prints."]}),"\n",(0,s.jsx)(t.h2,{id:"pin-php-or-wordpress-versions",children:"Pin PHP or WordPress versions"}),"\n",(0,s.jsxs)(t.p,{children:["The default PHP version is ",(0,s.jsx)(t.code,{children:"8.4"}),", and the default WordPress version is ",(0,s.jsx)(t.code,{children:"latest"}),".\nSet ",(0,s.jsx)(t.code,{children:"php"})," or ",(0,s.jsx)(t.code,{children:"wp"})," when the example depends on a specific version."]}),"\n",(0,s.jsx)(l,{name:"enum"}),"\n",(0,s.jsx)(t.pre,{children:(0,s.jsx)(t.code,{className:"language-html",children:'<php-snippet name="enum.php" php="8.4">\n\t<script type="application/x-php">\n\t\t<?php\n\t\tenum Status {\n\t\t    case Draft;\n\t\t    case Published;\n\t\t}\n\n\t\techo Status::Published->name;\n\t<\/script>\n\t<script type="text/expected-output">\n\t\tPublished\n\t<\/script>\n</php-snippet>\n'})}),"\n",(0,s.jsx)(l,{name:"wpVersion"}),"\n",(0,s.jsx)(t.pre,{children:(0,s.jsx)(t.code,{className:"language-html",children:'<php-snippet name="wp-version.php" wp="6.8">\n\t<script type="application/x-php">\n\t\t<?php\n\t\trequire \'/wordpress/wp-load.php\';\n\t\techo get_bloginfo( \'version\' );\n\t<\/script>\n\t<script type="text/expected-output">\n\t\t6.8\n\t<\/script>\n</php-snippet>\n'})}),"\n",(0,s.jsxs)(t.p,{children:["See the ",(0,s.jsx)(t.a,{href:"/developers/apis/query-api/#available-options",children:"Query API reference"}),"\nfor available PHP and WordPress versions."]}),"\n",(0,s.jsx)(t.h2,{id:"show-code-without-running-it",children:"Show code without running it"}),"\n",(0,s.jsxs)(t.p,{children:["Set ",(0,s.jsx)(t.code,{children:'runnable="false"'})," for fragments that should be highlighted but not\nexecuted, such as incomplete examples or code that depends on external services."]}),"\n",(0,s.jsx)(l,{name:"illustration"}),"\n",(0,s.jsx)(t.pre,{children:(0,s.jsx)(t.code,{className:"language-html",children:'<php-snippet name="illustration.php" runnable="false">\n\t<script type="application/x-php">\n\t\t<?php\n\t\t// This fragment is shown for discussion, not execution.\n\t\tadd_filter( \'the_content\', \'docs_filter_content\' );\n\t<\/script>\n</php-snippet>\n'})}),"\n",(0,s.jsx)(t.h2,{id:"self-host-the-runtime",children:"Self-host the runtime"}),"\n",(0,s.jsxs)(t.p,{children:["Most pages should use the hosted runtime from ",(0,s.jsx)(t.code,{children:"https://playground.wordpress.net"}),".\nSet ",(0,s.jsx)(t.code,{children:"playground-origin"})," when developing Playground itself, testing a self-hosted\ndeployment, or pinning examples to infrastructure you control."]}),"\n",(0,s.jsx)(t.pre,{children:(0,s.jsx)(t.code,{className:"language-html",children:'<php-snippet name="local-runtime.php" playground-origin="http://localhost:5400">\n\t<script type="application/x-php">\n\t\t<?php\n\t\techo phpversion();\n\t<\/script>\n\t<script type="text/expected-output">\n\t\t8.4.x\n\t<\/script>\n</php-snippet>\n'})}),"\n",(0,s.jsx)(t.h2,{id:"runtime-sharing",children:"Runtime sharing"}),"\n",(0,s.jsx)(t.p,{children:"The first Run click on a page:"}),"\n",(0,s.jsxs)(t.ol,{children:["\n",(0,s.jsx)(t.li,{children:"Loads the Playground client."}),"\n",(0,s.jsxs)(t.li,{children:["Creates a hidden iframe pointed at ",(0,s.jsx)(t.code,{children:"remote.html"}),"."]}),"\n",(0,s.jsxs)(t.li,{children:["Boots PHP, and WordPress unless the snippet uses ",(0,s.jsx)(t.code,{children:'wp="none"'}),"."]}),"\n",(0,s.jsx)(t.li,{children:"Runs the snippet code and writes stdout into the output panel."}),"\n"]}),"\n",(0,s.jsxs)(t.p,{children:["Later runs reuse an existing runtime when ",(0,s.jsx)(t.code,{children:"playground-origin"}),", ",(0,s.jsx)(t.code,{children:"php"}),", ",(0,s.jsx)(t.code,{children:"wp"}),", and\nthe resolved Blueprint JSON all match. This keeps related snippets fast while\nstill isolating examples that need different setup."]}),"\n",(0,s.jsx)(t.h2,{id:"security-and-csp",children:"Security and CSP"}),"\n",(0,s.jsx)(t.p,{children:"Snippet PHP runs inside the Playground runtime iframe, not in the parent page.\nThe parent page still loads the web component script and creates the hidden\nruntime iframe."}),"\n",(0,s.jsx)(t.p,{children:"If your site has a Content Security Policy, allow:"}),"\n",(0,s.jsxs)(t.ul,{children:["\n",(0,s.jsxs)(t.li,{children:["The module script from ",(0,s.jsx)(t.code,{children:"https://playground.wordpress.net"}),"."]}),"\n",(0,s.jsx)(t.li,{children:"The hidden iframe from the same origin."}),"\n",(0,s.jsx)(t.li,{children:"Network requests for the PHP, WordPress, and Playground runtime assets."}),"\n"]}),"\n",(0,s.jsxs)(t.p,{children:["For stricter environments, self-host the snippet script and use\n",(0,s.jsx)(t.code,{children:"playground-origin"})," to point snippets at your deployment."]}),"\n",(0,s.jsx)(t.h2,{id:"standalone-php-playground",children:"Standalone PHP Playground"}),"\n",(0,s.jsx)(t.p,{children:"Use the standalone PHP Playground when you want a full-page editor, a shareable\nURL, or an iframe instead of inline examples:"}),"\n",(0,s.jsxs)(t.blockquote,{children:["\n",(0,s.jsx)(t.p,{children:(0,s.jsx)(t.a,{href:"https://playground.wordpress.net/php-playground.html",children:"playground.wordpress.net/php-playground.html"})}),"\n"]}),"\n",(0,s.jsx)(t.p,{children:"You can embed it directly:"}),"\n",(0,s.jsx)(t.pre,{children:(0,s.jsx)(t.code,{className:"language-html",children:'<iframe src="https://playground.wordpress.net/php-playground.html#eyJjb2RlIjoiPD9waHBcblxuZWNobyBcIkkgYW0gYSBjb2RlIHNuaXBwZXQhXCI7XG4iLCJwaHAiOiI4LjQifQ==" width="100%" height="600"></iframe>\n'})}),"\n",(0,s.jsxs)(t.p,{children:["The URL fragment is a base64-encoded JSON payload with ",(0,s.jsx)(t.code,{children:"code"}),", ",(0,s.jsx)(t.code,{children:"php"}),", and ",(0,s.jsx)(t.code,{children:"wp"}),"\nfields."]}),"\n",(0,s.jsx)(t.h2,{id:"which-embed-should-you-use",children:"Which embed should you use?"}),"\n",(0,s.jsxs)(t.table,{children:[(0,s.jsx)(t.thead,{children:(0,s.jsxs)(t.tr,{children:[(0,s.jsx)(t.th,{children:"Use case"}),(0,s.jsx)(t.th,{children:"Use"})]})}),(0,s.jsxs)(t.tbody,{children:[(0,s.jsxs)(t.tr,{children:[(0,s.jsx)(t.td,{children:"Several runnable examples in one article"}),(0,s.jsx)(t.td,{children:(0,s.jsx)(t.code,{children:"<php-snippet>"})})]}),(0,s.jsxs)(t.tr,{children:[(0,s.jsx)(t.td,{children:"A tutorial step where readers should edit code inline"}),(0,s.jsx)(t.td,{children:(0,s.jsx)(t.code,{children:"<php-snippet>"})})]}),(0,s.jsxs)(t.tr,{children:[(0,s.jsx)(t.td,{children:"Shared setup across examples"}),(0,s.jsx)(t.td,{children:(0,s.jsx)(t.code,{children:'<php-snippet blueprint="...">'})})]}),(0,s.jsxs)(t.tr,{children:[(0,s.jsx)(t.td,{children:"A pure PHP language example"}),(0,s.jsx)(t.td,{children:(0,s.jsx)(t.code,{children:'<php-snippet wp="none">'})})]}),(0,s.jsxs)(t.tr,{children:[(0,s.jsx)(t.td,{children:"A runnable example that should not be edited"}),(0,s.jsx)(t.td,{children:(0,s.jsx)(t.code,{children:"<php-snippet readonly>"})})]}),(0,s.jsxs)(t.tr,{children:[(0,s.jsx)(t.td,{children:"A single full-page editor with a shareable URL"}),(0,s.jsx)(t.td,{children:"Standalone PHP Playground"})]}),(0,s.jsxs)(t.tr,{children:[(0,s.jsx)(t.td,{children:"A complete WordPress site preview"}),(0,s.jsx)(t.td,{children:"Standard Playground iframe"})]})]})]}),"\n",(0,s.jsx)(t.h2,{id:"troubleshooting",children:"Troubleshooting"}),"\n",(0,s.jsx)(t.p,{children:"If the snippet does not render, check that the module script loaded and that the\nbrowser supports custom elements."}),"\n",(0,s.jsxs)(t.p,{children:["If Run never finishes, open DevTools and check failed requests for ",(0,s.jsx)(t.code,{children:"remote.html"}),",\nPHP ",(0,s.jsx)(t.code,{children:".wasm"})," files, WordPress zip files, Blueprint resources, or cross-origin\n",(0,s.jsx)(t.code,{children:"src"})," files."]}),"\n",(0,s.jsxs)(t.p,{children:["If a Blueprint-backed snippet cannot find helper functions, confirm the\n",(0,s.jsx)(t.code,{children:"blueprint"})," attribute points to the right element and that the JSON is valid."]}),"\n",(0,s.jsx)(t.p,{children:"If output differs from the expected placeholder, trust the runtime output. The\nplaceholder is static documentation; Run executes the current code against the\nselected PHP, WordPress, and Blueprint setup."})]})}function j(e={}){const{wrapper:t}={...(0,r.R)(),...e.components};return t?(0,s.jsx)(t,{...e,children:(0,s.jsx)(g,{...e})}):g(e)}},5569(e,t,p){p.d(t,{R:()=>i,x:()=>a});var n=p(6326);const s={},r=n.createContext(s);function i(e){const t=n.useContext(r);return n.useMemo(function(){return"function"==typeof e?e(t):{...t,...e}},[t,e])}function a(e){let t;return t=e.disableParentContext?"function"==typeof e.components?e.components(s):e.components||s:i(e.components),n.createElement(r.Provider,{value:t},e.children)}}}]);