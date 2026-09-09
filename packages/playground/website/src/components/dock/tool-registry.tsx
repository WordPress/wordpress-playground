import type { ComponentType, ReactNode } from 'react';
import { Icon } from '@wordpress/components';
import {
	envelope,
	external,
	grid,
	list,
	page,
	plus,
	wordpress,
} from '@wordpress/icons';
import { DockBlueprintIcon, DockDatabaseIcon, DockTerminalIcon } from './icons';
import {
	SettingsTool,
	FilesTool,
	BlueprintTool,
	DatabaseTool,
	TerminalTool,
	LogsTool,
	MailTool,
} from '../site-manager/site-info-panel/site-tool-renderers';
import type { SiteToolPanelProps } from '../site-manager/site-info-panel/site-tool-renderers';
import css from '../site-manager/site-info-panel/style.module.css';

type DockToolDefinition = {
	section: string;
	group: 'main' | 'developer' | 'hidden';
	label: string;
	ariaLabel: string;
	icon?: ReactNode;
	isPrimary?: boolean;
	title: string;
	description: string;
	layout: 'default' | 'compact' | 'editor' | 'wide';
	fixedHeight?: boolean;
	Panel?: ComponentType<SiteToolPanelProps>;
	panelClassName?: string;
};

/** Navigation, pane presentation, and retained rendering share these tool definitions. */
const definitions = [
	{
		section: 'new',
		label: 'New',
		ariaLabel: 'New Playground',
		icon: <Icon icon={plus} size={24} />,
		isPrimary: true,
		group: 'main',
		title: 'New Playground',
		description: 'Spin up a fresh Playground or start from a Blueprint.',
		layout: 'default',
		fixedHeight: true,
	},
	{
		section: 'playgrounds',
		label: 'Playgrounds',
		ariaLabel: 'Your Playgrounds',
		icon: <Icon icon={grid} size={22} />,
		group: 'main',
		title: 'Your Playgrounds',
		description: 'Switch between your recent and saved Playgrounds.',
		layout: 'default',
	},
	{
		section: 'settings',
		label: 'Site Settings',
		ariaLabel: 'Site Settings',
		icon: <Icon icon={wordpress} size={24} />,
		group: 'main',
		title: 'Site Settings',
		description:
			'Change this Playground’s WordPress, PHP, language, and network settings.',
		layout: 'compact',
		Panel: SettingsTool,
		panelClassName: css.tabContents,
	},
	{
		section: 'share',
		label: 'Export',
		ariaLabel: 'Export',
		icon: <Icon icon={external} size={24} />,
		group: 'main',
		title: 'Export',
		description: '',
		layout: 'compact',
	},
	{
		section: 'blueprint',
		label: 'Blueprint',
		ariaLabel: 'Current Blueprint',
		icon: <DockBlueprintIcon />,
		group: 'developer',
		title: 'Blueprint',
		description:
			'Review and edit the Blueprint that describes this Playground.',
		layout: 'editor',
		Panel: BlueprintTool,
		panelClassName: css.blueprintWrapper,
	},
	{
		section: 'database',
		label: 'Database',
		ariaLabel: 'Database',
		icon: <DockDatabaseIcon />,
		group: 'developer',
		title: 'Database',
		description:
			'Inspect and edit the SQLite database behind this Playground.',
		layout: 'default',
		Panel: DatabaseTool,
		panelClassName: `${css.tabContents} ${css.toolTabContents}`,
	},
	{
		section: 'terminal',
		label: 'Terminal',
		ariaLabel: 'Terminal',
		icon: <DockTerminalIcon />,
		group: 'developer',
		title: 'Terminal',
		description: 'Run PHP snippets or WP-CLI commands in this Playground.',
		layout: 'wide',
		Panel: TerminalTool,
		panelClassName: `${css.tabContents} ${css.toolTabContents}`,
	},
	{
		section: 'files',
		label: 'Files',
		ariaLabel: 'Files',
		icon: <Icon icon={page} size={24} />,
		group: 'developer',
		title: 'Files',
		description: 'Browse and edit the active Playground filesystem.',
		layout: 'editor',
		Panel: FilesTool,
		panelClassName: `${css.tabContents} ${css.fileBrowserTab}`,
	},
	{
		section: 'logs',
		label: 'Logs',
		ariaLabel: 'Logs',
		icon: <Icon icon={list} size={24} />,
		group: 'developer',
		title: 'PHP error log',
		description: 'Errors, warnings, and notices from your site.',
		layout: 'wide',
		Panel: LogsTool,
		panelClassName: `${css.tabContents} ${css.toolTabContents}`,
	},
	{
		section: 'mail',
		label: 'Email',
		ariaLabel: 'Email',
		icon: <Icon icon={envelope} size={24} />,
		group: 'developer',
		title: 'Email',
		description: 'Preview messages sent by this Playground.',
		layout: 'editor',
		fixedHeight: true,
		Panel: MailTool,
		panelClassName: `${css.tabContents} ${css.mailTab}`,
	},
	{
		section: 'save',
		label: 'Store permanently',
		ariaLabel: 'Store permanently',
		group: 'hidden',
		title: 'Store permanently',
		description: '',
		layout: 'compact',
	},
] as const satisfies readonly DockToolDefinition[];

export type DockToolSection = (typeof definitions)[number]['section'];
type SiteToolDefinition = Extract<
	(typeof definitions)[number],
	{ Panel: ComponentType<SiteToolPanelProps> }
>;
export type SiteToolSection = SiteToolDefinition['section'];
export const DOCK_TOOLS: readonly (DockToolDefinition & {
	section: DockToolSection;
})[] = definitions;
export const SITE_TOOLS = definitions.filter(
	(tool): tool is SiteToolDefinition => 'Panel' in tool
);

export function getDockTool(section: DockToolSection) {
	return DOCK_TOOLS.find((tool) => tool.section === section)!;
}

export function isSiteToolSection(
	section: DockToolSection
): section is SiteToolSection {
	return Boolean(getDockTool(section).Panel);
}
