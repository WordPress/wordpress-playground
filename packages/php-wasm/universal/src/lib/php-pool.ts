import { BasePHP } from './base-php';

export interface AcquiredPHP<PHP extends BasePHP> {
	php: PHP;
	release: () => void;
}

export class PHPPool<PHP extends BasePHP> {
	primary: PHP;
	instances: PHP[] = [];

	constructor(primary: PHP, replicas: PHP[]) {
		this.primary = primary;
		this.instances = [primary, ...replicas];
	}

	public async acquire(): Promise<AcquiredPHP<PHP>> {
		if (this.instances.length === 0) {
			throw new Error('No PHP instances available in the pool.');
		}
		const php = this.instances.shift()!;
		return {
			php,
			release: () => {
				this.instances.unshift(php);
			},
		};
	}
}
