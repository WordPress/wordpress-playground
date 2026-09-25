// The runtime may import its code from a shared asset origin. WordPress and OPFS
// must still use the origin of the document/worker that executes that code.
export const wordPressSiteUrl = globalThis.location.origin;
// Hardcoded in wp.js:
export const DOCROOT = '/wordpress';
