import type { ComponentType, ReactNode } from 'react';
import { Icon } from '@wordpress/components';
import { __, _x } from '@wordpress/i18n';
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
	TransferTool,
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
		get label() {
			return _x('New', 'dock navigation item', 'playground-website');
		},
		get ariaLabel() {
			return __('New Playground', 'playground-website');
		},
		icon: <Icon icon={plus} size={24} />,
		isPrimary: true,
		group: 'main',
		get title() {
			return __('New Playground', 'playground-website');
		},
		get description() {
			return __(
				'Spin up a fresh Playground or start from a Blueprint.',
				'playground-website'
			);
		},
		layout: 'default',
		fixedHeight: true,
	},
	{
		section: 'playgrounds',
		get label() {
			return __('Playgrounds', 'playground-website');
		},
		get ariaLabel() {
			return __('Your Playgrounds', 'playground-website');
		},
		icon: <Icon icon={grid} size={22} />,
		group: 'main',
		get title() {
			return __('Your Playgrounds', 'playground-website');
		},
		get description() {
			return __(
				'Switch between your recent and saved Playgrounds.',
				'playground-website'
			);
		},
		layout: 'default',
	},
	{
		section: 'settings',
		get label() {
			return __('Site Settings', 'playground-website');
		},
		get ariaLabel() {
			return __('Site Settings', 'playground-website');
		},
		icon: <Icon icon={wordpress} size={24} />,
		group: 'main',
		get title() {
			return __('Site Settings', 'playground-website');
		},
		get description() {
			return __(
				'Change this Playground’s WordPress, PHP, language, and network settings.',
				'playground-website'
			);
		},
		layout: 'compact',
		Panel: SettingsTool,
		panelClassName: css.tabContents,
	},
	{
		section: 'share',
		get label() {
			return _x('Export', 'dock navigation item', 'playground-website');
		},
		get ariaLabel() {
			return _x('Export', 'dock navigation item', 'playground-website');
		},
		icon: <Icon icon={external} size={24} />,
		group: 'main',
		get title() {
			return _x('Export', 'dock navigation item', 'playground-website');
		},
		description: '',
		layout: 'compact',
	},
	{
		section: 'blueprint',
		get label() {
			return __('Blueprint', 'playground-website');
		},
		get ariaLabel() {
			return __('Current Blueprint', 'playground-website');
		},
		icon: <DockBlueprintIcon />,
		group: 'developer',
		get title() {
			return __('Blueprint', 'playground-website');
		},
		get description() {
			return __(
				'Review and edit the Blueprint that describes this Playground.',
				'playground-website'
			);
		},
		layout: 'editor',
		Panel: BlueprintTool,
		panelClassName: css.blueprintWrapper,
	},
	{
		section: 'database',
		get label() {
			return __('Database', 'playground-website');
		},
		get ariaLabel() {
			return __('Database', 'playground-website');
		},
		icon: <DockDatabaseIcon />,
		group: 'developer',
		get title() {
			return __('Database', 'playground-website');
		},
		get description() {
			return __(
				'Inspect and edit the SQLite database behind this Playground.',
				'playground-website'
			);
		},
		layout: 'default',
		Panel: DatabaseTool,
		panelClassName: `${css.tabContents} ${css.toolTabContents}`,
	},
	{
		section: 'terminal',
		get label() {
			return __('Terminal', 'playground-website');
		},
		get ariaLabel() {
			return __('Terminal', 'playground-website');
		},
		icon: <DockTerminalIcon />,
		group: 'developer',
		get title() {
			return __('Terminal', 'playground-website');
		},
		get description() {
			return __(
				'Run PHP snippets or WP-CLI commands in this Playground.',
				'playground-website'
			);
		},
		layout: 'wide',
		Panel: TerminalTool,
		panelClassName: `${css.tabContents} ${css.toolTabContents}`,
	},
	{
		section: 'files',
		get label() {
			return __('Files', 'playground-website');
		},
		get ariaLabel() {
			return __('Files', 'playground-website');
		},
		icon: <Icon icon={page} size={24} />,
		group: 'developer',
		get title() {
			return __('Files', 'playground-website');
		},
		get description() {
			return __(
				'Browse and edit the active Playground filesystem.',
				'playground-website'
			);
		},
		layout: 'editor',
		Panel: FilesTool,
		panelClassName: `${css.tabContents} ${css.fileBrowserTab}`,
	},
	{
		section: 'logs',
		get label() {
			return __('Logs', 'playground-website');
		},
		get ariaLabel() {
			return __('Logs', 'playground-website');
		},
		icon: <Icon icon={list} size={24} />,
		group: 'developer',
		get title() {
			return __('PHP error log', 'playground-website');
		},
		get description() {
			return __(
				'Errors, warnings, and notices from your site.',
				'playground-website'
			);
		},
		layout: 'wide',
		Panel: LogsTool,
		panelClassName: `${css.tabContents} ${css.toolTabContents}`,
	},
	{
		section: 'mail',
		get label() {
			return __('Email', 'playground-website');
		},
		get ariaLabel() {
			return __('Email', 'playground-website');
		},
		icon: <Icon icon={envelope} size={24} />,
		group: 'developer',
		get title() {
			return __('Email', 'playground-website');
		},
		get description() {
			return __(
				'Preview messages sent by this Playground.',
				'playground-website'
			);
		},
		layout: 'editor',
		fixedHeight: true,
		Panel: MailTool,
		panelClassName: `${css.tabContents} ${css.mailTab}`,
	},
	{
		section: 'transfer',
		get label() {
			return __('Clone site', 'playground-website');
		},
		get ariaLabel() {
			return __('Clone site', 'playground-website');
		},
		icon: <Icon icon={external} size={24} />,
		group: 'hidden',
		get title() {
			return __('Clone a WordPress site', 'playground-website');
		},
		get description() {
			return __(
				'Copy a live site into a new Playground with Reprint. Your live site stays unchanged.',
				'playground-website'
			);
		},
		layout: 'default',
		Panel: TransferTool,
		panelClassName: `${css.tabContents} ${css.toolTabContents}`,
	},
	{
		section: 'save',
		get label() {
			return __('Store permanently', 'playground-website');
		},
		get ariaLabel() {
			return __('Store permanently', 'playground-website');
		},
		group: 'hidden',
		get title() {
			return __('Store permanently', 'playground-website');
		},
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
