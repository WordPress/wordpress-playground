/**
 * TypeDoc Configuration
 * --------------------
 * This file configures TypeDoc, which generates documentation for our project.
 * It specifies which files to include, which to ignore, and which internal symbols
 * should not appear in the generated documentation.
 */

module.exports = {
  // JSON schema for validating TypeDoc configuration
  $schema: 'https://typedoc.org/schema.json',

  // Entry point strategy tells TypeDoc how to find files to document
  // 'packages' means each folder listed in entryPoints is treated as a separate entry
  entryPointStrategy: 'packages',

  // List of folders TypeDoc should generate documentation for
  entryPoints: [
    './packages/php-wasm/web',          // Web-specific PHP-Wasm features
    './packages/php-wasm/node',         // Node.js-specific PHP-Wasm features
    './packages/php-wasm/progress',     // Progress tracking utilities
    './packages/php-wasm/universal',    // Universal PHP-Wasm utilities
    './packages/php-wasm/util',         // General utility functions
    './packages/playground/blueprints', // Playground blueprint templates
    './packages/playground/client',     // Playground client-side code
  ],

  // Symbols intentionally not exported in the documentation
  intentionallyNotExported: [
    'WebClientMixin',             // Internal mixin used in the Web client
    'PlaygroundWorkerEndpoint',   // Internal worker endpoint class
  ],

  // Exclude external dependencies from documentation
  excludeExternals: true,
};
