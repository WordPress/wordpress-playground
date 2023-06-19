import css from './style.module.css';

type SelectProps = {
	options: Record<string, string>;
	selected?: string;
} & React.SelectHTMLAttributes<HTMLSelectElement>;

export default function Select(props: SelectProps) {
	return (
		<select className={css.select} defaultValue={props.selected} {...props}>
			{Object.entries(props.options).map(([label, value]) => (
				<option value={value} key={value}>
					{label}
				</option>
			))}
		</select>
	);
}
