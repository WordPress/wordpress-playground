// eslint-disable-next-line @nx/enforce-module-boundaries
import { FileLockManagerForPosix } from '@php-wasm/node';
import { exposeAPI } from '@php-wasm/universal';
import { openSync, closeSync } from 'fs';
import type { TestWorkerAPI } from './file-lock-manager-tests';

const fileLockManager = new FileLockManagerForPosix();

// TODO: Fix this assignment if we proceed with these tests
// @ts-ignore
const api: TestWorkerAPI = fileLockManager as TestWorkerAPI;
api.openSync = openSync;
api.closeSync = closeSync;

// TODO: Fix type error
// @ts-ignore
exposeAPI(api, null, process as NodeProcess);
