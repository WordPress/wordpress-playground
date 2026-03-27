import { PHP, proxyFileSystem, setPhpIniEntries } from '@php-wasm/universal';
import { loadWebRuntime, generateCertificate } from '../../lib';

(window as any).PHP = PHP;
(window as any).loadWebRuntime = loadWebRuntime;
(window as any).proxyFileSystem = proxyFileSystem;
(window as any).setPhpIniEntries = setPhpIniEntries;
(window as any).generateCertificate = generateCertificate;
