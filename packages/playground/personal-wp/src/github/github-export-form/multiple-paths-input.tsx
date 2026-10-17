import React, { useState } from 'react';
import css from './style.module.css';
import Button from '../../components/button';

interface MultiplePathsInputProps {
	onChange: (paths: string[]) => void;
	initialValue: string[];
}

const MultiplePathsInput: React.FC<MultiplePathsInputProps> = ({
	onChange,
	initialValue,
}) => {
	const [customPaths, setCustomPaths] = useState(
		!initialValue?.length ? [''] : initialValue
	);

	const handleAddPath = (e: any) => {
		e.preventDefault();
		setCustomPaths([...customPaths, '']);
	};

	const handleRemovePath = (index: number) => {
		const paths = [...customPaths];
		paths.splice(index, 1);
		if (paths.length === 0) {
			paths.push('');
		}
		setCustomPaths(paths);
	};

	const handlePathChange = (index: number, value: string) => {
		const paths = [...customPaths];
		paths[index] = value;
		setCustomPaths(paths);
	};

	// Call the onChange callback whenever the paths change
	React.useEffect(() => {
		onChange(customPaths);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [customPaths]);

	return (
		<div className={css.multiplsPaths}>
			{customPaths.map((path, index) => (
				<div key={index} className={css.multipleInputsRow}>
					<input
						type="text"
						className={css.repoInput}
						value={path}
						onChange={(e) =>
							handlePathChange(index, e.target.value)
						}
					/>
					{customPaths.length > 1 && (
						<Button
							className={css.multipleInputsRemoveButton}
							onClick={() => handleRemovePath(index)}
						>
							-
						</Button>
					)}
				</div>
			))}
			<Button
				onClick={handleAddPath}
				className={css.multipleInputsAddButton}
			>
				+ Add path
			</Button>
		</div>
	);
};

export default MultiplePathsInput;
