We have JSPI and Asyncify builds of PHP WASM. This is because Safari
and Firefox don't yet support JSPI. However, we seem to always run PHP
in worker threads, which may allow polyfilling JSPI using Atomics and
SharedArrayBuffer.

Is that assumption correct?
Can we investigate what would it take to support this?
We can use COEP and COOP headers.
Analyze the possibilities, make a plan, and give me an evaluation.
