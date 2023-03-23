import React from 'react';
import css from './style.module.css';

type SelectorProps = {
	name: string;
	versions: string[];
};

export default function VersionSelector(props: SelectorProps) {
	const selectedVersion = new URL(window.location.toString()).searchParams.get(
		props.name
	);
	return (
		<select
			className={css.btn}
			defaultValue={selectedVersion ? selectedVersion : props.versions[0] }
			id={props.name + '-version'}
			onChange={(event) => {
				const url = new URL(window.location.toString());
				url.searchParams.set(props.name, event.target.value);
				window.location.assign(url);
			}}
		>
			{props.versions.map((value) => (
				<option
					value={value}
					key={value}
				>
					{props.name.toString().toUpperCase() + ' ' + value}
				</option>
			))}
		</select>
	);
}
