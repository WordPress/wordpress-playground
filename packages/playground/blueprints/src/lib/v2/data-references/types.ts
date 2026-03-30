import type { Semaphore } from '@php-wasm/util';
import type { ExecutionContextBackend } from '../types';

export interface DataReferenceResolverConfig {
	semaphore?: Semaphore;
	corsProxy?: string;
	executionContext?: ExecutionContextBackend;
}
