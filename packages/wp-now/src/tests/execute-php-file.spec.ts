import fs from 'fs-extra';
import path from 'path';
import { executePHPFile } from '../execute-php-file';

const exampleDir = path.join(__dirname, 'execute-php-file');

test('php file execution in index mode', async () => {
  const resultFilePath = path.join(exampleDir, 'hello-world-result.txt')
  // reset result file
  fs.writeFileSync(resultFilePath, '');

  const result = await executePHPFile(path.join(exampleDir, 'hello-world.php'));

  expect(result.name).toBe('ExitStatus');
  expect(result.status).toBe(0);
  const output = fs.readFileSync(resultFilePath, 'utf8');
  expect(output).toBe('Hello World!');
});
