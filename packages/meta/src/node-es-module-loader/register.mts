import { register } from 'module';

register('./loader.mts', new URL(import.meta.url));
