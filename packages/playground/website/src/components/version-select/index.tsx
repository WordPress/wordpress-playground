import css from './style.module.css';

type SelectorProps = {
	name: string;
	versions: string[];
	selected?: string;
	default?: string;
};

export default function VersionSelector(props: SelectorProps) {
	let selected = props.selected;
	if (selected && !props.versions.includes(selected)) {
		selected = props.default;
	}
	if (selected && !props.versions.includes(selected)) {
		selected = props.versions[0];
	}

	return (
		<select
			className={css.select}
			defaultValue={selected}
			id={props.name + '-version'}
			onChange={(event) => {
				const url = new URL(window.location.toString());
				url.searchParams.set(props.name, event.target.value);
				window.location.assign(url);
			}}
		>
			{props.versions.map((value) => (
				<option value={value} key={value}>
					{props.name.toString().toUpperCase() + ' ' + value}
				</option>
			))}
		</select>
	);
}
