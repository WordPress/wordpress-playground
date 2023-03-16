import { BuiltScriptExecutorSchema } from './schema';
import executor from './executor';

const options: BuiltScriptExecutorSchema = {};

describe('CustomExecutable Executor', () => {
  it('can run', async () => {
    const output = await executor(options);
    expect(output.success).toBe(true);
  });
});