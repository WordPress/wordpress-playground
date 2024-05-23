import { Remote } from 'comlink';
import { isLocalPHP } from './is-local-php';
import { IsomorphicLocalPHP, UniversalPHP } from './universal-php';

export function isRemotePHP(
	playground: UniversalPHP
): playground is Remote<IsomorphicLocalPHP> {
	return !isLocalPHP(playground);
}
