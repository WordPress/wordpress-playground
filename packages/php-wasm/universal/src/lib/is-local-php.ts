import { BasePHP } from './base-php';
import { IsomorphicLocalPHP, UniversalPHP } from './universal-php';

export function isLocalPHP(
	playground: UniversalPHP
): playground is IsomorphicLocalPHP {
	return !(playground instanceof BasePHP);
}
