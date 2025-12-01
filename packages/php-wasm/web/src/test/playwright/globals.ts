import { PHP } from '@php-wasm/universal';
import { loadWebRuntime } from '../../lib';

(window as any).PHP = PHP;
(window as any).loadWebRuntime = loadWebRuntime;
