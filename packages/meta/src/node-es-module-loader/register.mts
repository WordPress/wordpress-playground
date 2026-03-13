import { register, enableCompileCache } from 'module';

// Enable V8 code cache to speed up subsequent module loads.
// The cache is stored in a platform-managed directory and
// persists across process restarts.
enableCompileCache?.();

register('./loader.mts', new URL(import.meta.url));
