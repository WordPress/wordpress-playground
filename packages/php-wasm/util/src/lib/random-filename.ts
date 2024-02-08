import { randomString } from './random-string';

export function randomFilename() {
	return randomString(36, '-_');
}
