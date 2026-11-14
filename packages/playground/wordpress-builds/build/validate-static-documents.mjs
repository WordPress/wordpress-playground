import { fileURLToPath } from 'node:url';
import { validateWordPressStaticDocuments } from '../../../vite-extensions/static-release-documents.mjs';

await validateWordPressStaticDocuments(fileURLToPath(new URL('../public/', import.meta.url)));
console.log('WordPress static documents validated.');
