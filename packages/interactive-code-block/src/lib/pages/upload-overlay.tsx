import * as React from '@wordpress/element';
import { useRef } from '@wordpress/element';

const UploadOverlay = ({ onFileSelected }) => {
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleFileChange = async (event) => {
		await onFileSelected(event.target.files[0]);
		event.target.value = null;
	};

	return (
		<input
			type="file"
			accept="*"
			onChange={handleFileChange}
			style={{
				position: 'absolute',
				top: 0,
				left: 0,
				bottom: 0,
				right: 0,
				opacity: 0,
				cursor: 'pointer',
			}}
			ref={fileInputRef}
		/>
	);
};

export default UploadOverlay;
