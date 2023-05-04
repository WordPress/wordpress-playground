import * as React from '@wordpress/element';
import { useEntityRecords } from '@wordpress/core-data';
import { ToggleControl, Spinner, Flex, FlexItem } from '@wordpress/components';
import { Library } from '../../types';

interface LibrariesControlProps {
	selected: string[];
	librariesIncludedByScript?: string[];
	onChange: (selected: string[]) => void;
}

export default function LibrariesControl({
	selected,
	librariesIncludedByScript,
	onChange,
}: LibrariesControlProps) {
	const libraries = useEntityRecords<Library>(
		'interactive-code-block',
		'library'
	);

	if (libraries.records === null) {
		return <Spinner />;
	}

	if (!selected) {
		selected = [];
	}

	function toggleLibrary(id: string) {
		if (selected.includes(id)) {
			onChange(selected.filter((selectedId) => selectedId !== id));
		} else {
			onChange([...selected, id]);
		}
	}

	return (
		<Flex direction="column" gap={1}>
			{libraries.records.map((library) => {
				const isIncludedByScript = librariesIncludedByScript?.includes(
					library.id
				);
				if (isIncludedByScript) {
					return (
						<FlexItem key={library.id}>
							<ToggleControl
								label={`/${library.name}`}
								disabled={true}
								checked={true}
							/>
						</FlexItem>
					);
				}
				return (
					<FlexItem key={library.id}>
						<ToggleControl
							label={`/${library.name}`}
							onChange={() => toggleLibrary(library.id)}
							checked={selected.includes(library.id)}
						/>
					</FlexItem>
				);
			})}
		</Flex>
	);
}
