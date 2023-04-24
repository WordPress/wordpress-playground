import { isLocalPHP } from './is-local-php';
import { IsomorphicRemotePHP, UniversalPHP } from './universal-php';

export function isRemotePHP(
	playground: UniversalPHP
): playground is IsomorphicRemotePHP {
	return !isLocalPHP(playground);
}
