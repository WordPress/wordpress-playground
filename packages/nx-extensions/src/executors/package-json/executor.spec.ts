import { PackageJsonExecutorSchema } from './schema';
import executor from './executor';

const options: PackageJsonExecutorSchema = {};

describe('PackageJson Executor', () => {
	it('can run', async () => {
		const output = await executor(options);
		expect(output.success).toBe(true);
	});
});
