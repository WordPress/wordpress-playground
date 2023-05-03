import * as React from '@wordpress/element';
import classnames from 'classnames';
import {
	Button,
	Dropdown,
	MenuGroup,
	MenuItem,
	NavigableMenu,
} from '@wordpress/components';

interface ToolbarDropdownProps {
	options: {
		label: string;
		value: string;
	}[];
	optionsLabel?: string;
	icon?: {
		icon: string;
	};
	value: string;
	onChange: (value: string) => void;
}

/**
 * @typedef {Object} DropdownOption
 *
 * @property {string} label Option label.
 * @property {string} value Option value.
 */
/**
 * Dropdown for the editor toolbar.
 *
 * @param {Object}           props                Component props.
 * @param {DropdownOption[]} props.options        Dropdown options.
 * @param {string}           [props.optionsLabel] Options label.
 * @param {Object}           [props.icon]         Icon for the toolbar.
 * @param {string}           props.value          Current dropdown value.
 * @param {Function}         props.onChange       Dropdown change callback, which receive the new value as argument.
 *
 * @return {Object} React component.
 */
const ToolbarDropdown = ({
	options,
	optionsLabel,
	icon,
	value,
	onChange,
	...props
}: ToolbarDropdownProps) => {
	const selectedOption = options.find((option) => value === option.value);

	return (
		<Dropdown
			renderToggle={({ isOpen, onToggle }) => (
				<Button
					onClick={onToggle}
					icon={icon}
					aria-expanded={isOpen}
					aria-haspopup="true"
					children={selectedOption ? selectedOption.label : ''}
				/>
			)}
			renderContent={({ onClose }) => (
				<NavigableMenu role="menu">
					<MenuGroup label={optionsLabel}>
						{options.map((option) => {
							const isSelected =
								option.value === selectedOption?.value;
							return (
								<MenuItem
									key={option.value}
									role="menuitemradio"
									isSelected={isSelected}
									className={classnames(
										'syntaxhighlighter-toolbar-dropdown__option',
										{ 'is-selected': isSelected }
									)}
									onClick={() => {
										onChange(option.value);
										onClose();
									}}
									children={option.label}
								/>
							);
						})}
					</MenuGroup>
				</NavigableMenu>
			)}
			{...props}
		/>
	);
};

export default ToolbarDropdown;
