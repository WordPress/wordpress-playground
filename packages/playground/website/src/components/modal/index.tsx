import ReactModal from 'react-modal';
import css from './style.module.css';
import { Flex } from '@wordpress/components';

ReactModal.setAppElement('#root');

interface ModalProps extends ReactModal.Props {
	header?: string;
	styles?: ReactModal.Styles;
}
export const defaultStyles: ReactModal.Styles = {
	content: {
		top: '50%',
		left: '50%',
		right: 'auto',
		bottom: 'auto',
		marginRight: '-50%',
		transform: 'translate(-50%, -50%)',
		width: 400,
		maxWidth: '100vw',
		zIndex: 200,
		textAlign: 'center',
		color: '#000',
		border: '#000 1px solid',
		borderRadius: '6px',
		background: '#fff',
	},
	overlay: {
		background: '#1e2327d0',
		zIndex: 10,
	},
};
export default function Modal(props: ModalProps) {
	const styles = {
		overlay: { ...defaultStyles.overlay, ...props.styles?.overlay },
		content: { ...defaultStyles.content, ...props.styles?.content },
	};
	return (
		<ReactModal style={styles} {...props}>
			<Flex className={css.modalHeader} align={'center'} id="modal-content">
				{ props.header && <h2 tabIndex={0}>{props.header}</h2> }
				<button
					id="import-close-modal--btn"
					onClick={props.onRequestClose}
					className={`${css.btn} ${css.btnClose}`}
					aria-label="Close"
					title="Close"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						width="32"
						height="32"
						aria-hidden="true"
						focusable="false"
					>
						<path d="M13 11.8l6.1-6.3-1-1-6.1 6.2-6.1-6.2-1 1 6.1 6.3-6.5 6.7 1 1 6.5-6.6 6.5 6.6 1-1z"></path>
					</svg>
				</button>
			</Flex>
			<div className={css.modalInner}>
				{props.children}
			</div>
		</ReactModal>
	);
}
