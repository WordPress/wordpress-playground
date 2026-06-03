/**
 * Preserves the historical worker-thread-v2 package entrypoint.
 *
 * Blueprint v2 now compiles in TypeScript before reaching the worker and uses
 * the same PHP worker implementation as Blueprint v1. Keep this tiny shim so
 * built packages still ship the stable worker-thread-v2 filename without
 * maintaining a second worker implementation.
 */
import '../blueprints-v1/worker-thread-v1';
