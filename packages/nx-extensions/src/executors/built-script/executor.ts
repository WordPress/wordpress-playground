import { BuiltScriptExecutorSchema } from './schema';
import { spawnSync } from 'child_process';
import { join } from 'path';

// Weird, this is supposed to be a module, but it's not.
const dirname = __dirname;

export default async function runExecutor(
  options: BuiltScriptExecutorSchema
) {
  const args = [
    '--loader',
    join(dirname, 'loader.mjs'),
    options.scriptPath,
    ...(options.__unparsed__ || []),
  ]
  spawnSync('node', args, {
    stdio: 'inherit',
  });
  return {
    success: true
  };
}
