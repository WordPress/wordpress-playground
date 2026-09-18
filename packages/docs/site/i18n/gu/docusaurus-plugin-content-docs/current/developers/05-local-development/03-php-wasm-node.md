---
title: php-wasm/node
slug: /developers/local-development/php-wasm-node
---

# Node.js માં વર્ડપ્રેસ પ્લેગ્રાઉન્ડનો ઉપયોગ

<!--
# Using WordPress Playground in Node.js
-->

WebAssembly પ્રોજેક્ટ તરીકે, તમે Node.js માં વર્ડપ્રેસ પ્લેગ્રાઉન્ડ નો પણ ઉપયોગ કરી શકો છો.

<!--
As a WebAssembly project, you can also use WordPress Playground in Node.js.
-->

જો તમને અંતર્ગત WebAssembly PHP રનટાઇમ પર સીધા નિયંત્રણની જરૂર હોય, તો [`@php-wasm/node` પેકેજ](https://npmjs.org/@php-wasm/node) પર એક નજર નાખો. તે વર્ડપ્રેસ પ્લેગ્રાઉન્ડ ટૂલ્સ દ્વારા ઉપયોગમાં લેવાતા Node.js લોડર અને રનટાઇમ ઇન્ટિગ્રેશન પૂરાં પાડે છે. કમ્પાઇલ કરેલા બાઇનરી `@php-wasm/node-8-4` જેવા વર્ઝન-વિશિષ્ટ પેકેજોમાં પ્રકાશિત થાય છે.

<!--
If you need direct control over the underlying WebAssembly PHP runtime, take a
look at the [@php-wasm/node package](https://npmjs.org/@php-wasm/node). It
provides the Node.js loader and runtime integrations used by WordPress
Playground tools. The compiled binaries are published in version-specific
packages such as `@php-wasm/node-8-4`.
-->

`@php-wasm/universal`, Node.js અને વેબ ઍડપ્ટર્સ, અને વર્ઝન-વિશિષ્ટ પેકેજો કેવી રીતે એકસાથે કામ કરે છે તે જાણવા માટે [PHP.wasm પેકેજો](/developers/architecture/php-wasm-packages) જુઓ. તે પેજ નાની ડિપેન્ડન્સી ફૂટપ્રિન્ટ સાથેના નીચલા-સ્તરના, એક-વર્ઝન સેટઅપને પણ સમજાવે છે.

<!--
See [PHP.wasm packages](/developers/architecture/php-wasm-packages) to learn
how `@php-wasm/universal`, the Node.js and web adapters, and the version-specific
packages fit together. That page also explains the lower-level, single-version
setup with a smaller dependency footprint.
-->

<div class="callout callout-info">

**API સંદર્ભ**

વર્ગો, કાર્યો, ઇન્ટરફેસ અને પ્રકાર ઉપનામોની [સંપૂર્ણ સૂચિ](/api/node) જુઓ.

</div>

<!--
<div class="callout callout-info">

**API reference**

Consult the [complete list](/api/node) of Classes, Functions, Interfaces, and Type Aliases.

</div>
-->

import PHPWASMNode from '@php-wasm/node/\README.md';

<PHPWASMNode />
