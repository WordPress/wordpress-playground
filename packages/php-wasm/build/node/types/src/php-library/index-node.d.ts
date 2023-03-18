/**
 * A wrapper file that polyfills global APIs for Node.js
 * and re-exports everything from the main PHP module.
 */
import type { PHPLoaderModule } from './php';
export * from './php';
export declare function getPHPLoaderModule(version?: string): Promise<PHPLoaderModule>;
