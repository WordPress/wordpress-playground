/**
 * A wrapper file that polyfills global APIs for Node.js
 * and re-exports everything from the main PHP module.
 */

import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder as any;
global.TextDecoder = TextDecoder as any;

export * from './php';

export async function getPHPLoaderModule(version = '8.2') {
    switch (version) {
        case '8.2':
            // @ts-ignore
            return await import(`../php/php-8.2.node.js`);
        case '8.1':
            // @ts-ignore
            return await import(`../php/php-8.1.node.js`);
        case '8.0':
            // @ts-ignore
            return await import(`../php/php-8.0.node.js`);
        case '7.4':
            // @ts-ignore
            return await import(`../php/php-7.4.node.js`);
        case '7.3':
            // @ts-ignore
            return await import(`../php/php-7.3.node.js`);
        case '7.2':
            // @ts-ignore
            return await import(`../php/php-7.2.node.js`);
        case '7.1':
            // @ts-ignore
            return await import(`../php/php-7.1.node.js`);
        case '7.0':
            // @ts-ignore
            return await import(`../php/php-7.0.node.js`);
        case '5.6':
            // @ts-ignore
            return await import('../php/php-5.6.node.js');
    }
    throw new Error(`Unsupported PHP version ${version}`);
}
