import React from 'react';

type SelectorProps = {
	name: string;
	versions: string[];
};

export default function VersionSelector(props: SelectorProps) {
	return (
		<select
			id={props.name + '-version'}
			onChange={(event) => {
				const url = new URL(window.location.toString());
				url.searchParams.set(props.name, event.target.value);
				window.location.assign(url);
			}}
		>
			{props.versions.map((value) => (
				<option
					selected={
						new URL(window.location.toString()).searchParams.get(
							props.name
						) === value
					}
					value={value}
				>
					{props.name.toString().toUpperCase() + ' ' + value}
				</option>
			))}
		</select>
	);
}
