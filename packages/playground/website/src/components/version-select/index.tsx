import Select from '../select';

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
		<Select
			selected={selected}
			id={props.name + '-version'}
			onChange={(event) => {
				const url = new URL(window.location.toString());
				url.searchParams.set(props.name, event.target.value);
				window.location.assign(url);
			}}
			options={props.versions.reduce((acc, version) => {
				acc[props.name.toUpperCase() + ' ' + version] = version;
				return acc;
			}, {} as Record<string, string>)}
		/>
	);
}
