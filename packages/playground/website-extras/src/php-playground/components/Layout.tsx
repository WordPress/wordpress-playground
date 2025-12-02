/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { AsyncWritableFilesystem } from '@wp-playground/storage';
import clsx from 'clsx';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import type { ImperativePanelHandle } from 'react-resizable-panels';

import styles from './Layout.module.css';
import terminalStyles from './terminal/Terminal.module.css';
import { Controls } from './Controls';
import { EditorHost, type EditorHostHandle } from './EditorHost';
import { HelpModal } from './HelpModal';
import FileExplorerSidebar from './file-explorer/FileExplorerSidebar';
import FileExplorerPlaceholder from './file-explorer/FileExplorerPlaceholder';
import { PlaygroundManager } from './PlaygroundManager';
import { TerminalWrapper } from './terminal/Terminal';
import { useAppSelector } from '../hooks';
import AddressBar from '../../components/address-bar';
import { DEFAULT_WORKSPACE_DIR } from '../constants';
import type { PlaygroundClient } from '@wp-playground/remote';

/**
 * Wraps a PlaygroundClient to satisfy AsyncWritableFilesystem interface
 * which requires EventTarget methods.
 */
class ClientFilesystemWrapper
	extends EventTarget
	implements AsyncWritableFilesystem
{
	private client: PlaygroundClient;

	constructor(client: PlaygroundClient) {
		super();
		this.client = client;
	}
	isDir(path: string) {
		return this.client.isDir(path);
	}
	fileExists(path: string) {
		return this.client.fileExists(path);
	}
	async read(path: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer> }> {
		const buffer = await this.client.readFileAsBuffer(path);
		return {
			arrayBuffer: async () => buffer.buffer,
		};
	}
	readFileAsText(path: string) {
		return this.client.readFileAsText(path);
	}
	listFiles(path: string) {
		return this.client.listFiles(path);
	}
	writeFile(path: string, data: string | Uint8Array) {
		return this.client.writeFile(path, data);
	}
	mkdir(path: string) {
		return this.client.mkdir(path);
	}
	rmdir(path: string, options?: { recursive?: boolean }) {
		return this.client.rmdir(path, options);
	}
	mv(source: string, destination: string) {
		return this.client.mv(source, destination);
	}
	unlink(path: string) {
		return this.client.unlink(path);
	}
}

export const Layout = () => {
	const [isHelpOpen, setHelpOpen] = useState(false);
	const [isTerminalCollapsed, setTerminalCollapsed] = useState(false);
	const [terminalResizeToken, setTerminalResizeToken] = useState(0);
	const terminalPanelRef = useRef<ImperativePanelHandle | null>(null);
	const playgroundClient = useAppSelector(
		(state) => state.playground.client ?? undefined
	);
	const bootStatus = useAppSelector((state) => state.playground.bootStatus);
	const currentPath = useAppSelector((state) => state.playground.currentPath);
	const [previewUrl, setPreviewUrl] = useState('');
	const [selectedDirPath, setSelectedDirPath] = useState<string | null>(
		DEFAULT_WORKSPACE_DIR
	);
	const [forceSelectedPath, setForceSelectedPath] = useState<string | null>(
		null
	);
	const editorHostRef = useRef<EditorHostHandle | null>(null);

	const filesystem = useMemo(() => {
		if (!playgroundClient) {
			return null;
		}
		return new ClientFilesystemWrapper(playgroundClient);
	}, [playgroundClient]);

	useEffect(() => {
		const previousTitle = document.title;
		document.title = 'WordPress PHP Playground';
		return () => {
			document.title = previousTitle;
		};
	}, []);

	useEffect(() => {
		if (!playgroundClient) {
			return;
		}
		let cancelled = false;
		(async () => {
			try {
				const url = await playgroundClient.getCurrentURL();
				if (!cancelled) setPreviewUrl(url || '');
			} catch (e) {
				void e;
			}
			try {
				await playgroundClient.onNavigation((url) => {
					setPreviewUrl(url);
				});
			} catch (e) {
				void e;
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [playgroundClient]);

	return (
		<div id="php-playground-react-root" className={styles.root}>
			<PlaygroundManager />
			<PanelGroup direction="horizontal" id="app" className={styles.app}>
				<Panel minSize={16} defaultSize={16} collapsible>
					<div className={styles.editorPane}>
						{bootStatus === 'ready' && filesystem ? (
							<FileExplorerSidebar
								filesystem={filesystem}
								currentPath={currentPath}
								selectedDirPath={selectedDirPath}
								setSelectedDirPath={setSelectedDirPath}
								forceSelectedPath={forceSelectedPath}
								setForceSelectedPath={setForceSelectedPath}
							/>
						) : (
							<FileExplorerPlaceholder />
						)}
					</div>
				</Panel>
				<PanelResizeHandle className={styles.horizontalHandle} />
				<Panel minSize={40}>
					<div className={styles.editorPane}>
						<Controls onHelpClick={() => setHelpOpen(true)} />
						<PanelGroup
							direction="vertical"
							className={styles.editorSplitGroup}
						>
							<Panel
								defaultSize={60}
								minSize={30}
								style={{ overflow: 'auto' }}
							>
								<div className={styles.editorContent}>
									{currentPath && (
										<div
											className={styles.filePathBar}
											title={currentPath}
										>
											<span
												className={styles.filePathText}
											>
												{currentPath}
											</span>
										</div>
									)}
									<EditorHost ref={editorHostRef} />
								</div>
							</Panel>
							<PanelResizeHandle
								className={styles.verticalHandle}
							/>
							<Panel
								ref={terminalPanelRef}
								minSize={15}
								collapsible
								onCollapse={() => setTerminalCollapsed(true)}
								onExpand={() => setTerminalCollapsed(false)}
								onResize={() =>
									setTerminalResizeToken((token) => token + 1)
								}
								className={terminalStyles.terminalPanel}
							>
								<section
									id="terminalSection"
									className={clsx(
										terminalStyles.terminalSection,
										{
											[terminalStyles.terminalSectionCollapsed]:
												isTerminalCollapsed,
										}
									)}
									aria-label="Playground terminal"
								>
									<div
										className={terminalStyles.terminalPane}
									>
										<TerminalWrapper
											playgroundClient={playgroundClient}
											isCollapsed={isTerminalCollapsed}
											resizeToken={terminalResizeToken}
										/>
									</div>
								</section>
							</Panel>
						</PanelGroup>
					</div>
				</Panel>
				<PanelResizeHandle className={styles.horizontalHandle} />
				<Panel minSize={15}>
					<div id="previewPane" className={styles.previewPane}>
						{bootStatus === 'ready' && playgroundClient ? (
							<div style={{ padding: '6px 8px' }}>
								<AddressBar
									url={previewUrl}
									onUpdate={(newUrl: string) =>
										playgroundClient.goTo(newUrl)
									}
								/>
							</div>
						) : null}
						<iframe
							id="preview"
							title="WordPress Playground"
							className={styles.preview}
						/>
					</div>
				</Panel>
			</PanelGroup>
			<HelpModal
				isOpen={isHelpOpen}
				onRequestClose={() => setHelpOpen(false)}
			/>
		</div>
	);
};
