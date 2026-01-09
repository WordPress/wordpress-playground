import { Spinner } from '../spinner';
import css from './style.module.css';

/**
 * Loading fallback component displayed while a modal chunk is loading
 */
export function ModalLoadingFallback() {
	return (
		<div className={css.fallback}>
			<div className={css.spinner}>
				<Spinner />
			</div>
			<p className={css.text}>Loading modal...</p>
		</div>
	);
}
