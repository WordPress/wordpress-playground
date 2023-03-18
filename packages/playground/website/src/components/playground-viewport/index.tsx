import type { PlaygroundClient } from '@wp-playground/client';

import { Terminal } from 'xterm';
import 'xterm/css/xterm.css';
import React, {ReactElement, Ref, useMemo, Fragment, useRef, useEffect} from 'react';
import type {
	ProgressObserver,
	ProgressObserverEvent,
} from '@php-wasm/progress';

import css from './style.module.css';
import BrowserChrome from '../browser-chrome';
import ProgressBar from '../progress-bar';
import { usePlayground, useProgressObserver } from '../../lib/hooks';

interface PlaygroundViewportProps {
	isSeamless?: boolean;
	setupPlayground: (
		playground: PlaygroundClient,
		observer: ProgressObserver
	) => Promise<void>;
	toolbarButtons?: React.ReactElement[];
}

// Reload the page when the connection to the playground times out in the dev mode.
// There's a chance website server was booted faster than the playground server.
// @ts-ignore
const onConnectionTimeout = import.meta.env.DEV
	? () => window.location.reload()
	: undefined;

export default function PlaygroundViewport({
	isSeamless,
	setupPlayground,
	toolbarButtons,
}: PlaygroundViewportProps) {
	const { observer, progress } = useProgressObserver();
	const { playground, url, iframeRef } = usePlayground({
		async onConnected(api) {
			await setupPlayground(api, observer);
		},
		onConnectionTimeout,
	});

	const updatedToolbarButtons = useMemo(() => {
		if (isSeamless || !playground || !toolbarButtons?.length) {
			return;
		}
		return toolbarButtons.map((button, index) =>
			React.cloneElement(button as React.ReactElement, {
				key: index,
				playground,
			})
		) as ReactElement[];
	}, [isSeamless, playground, toolbarButtons]);

  const terminalContainer = useRef<HTMLDivElement>();
  const terminalRef = useRef<Terminal>();

  useEffect(() => {
    if (!terminalContainer.current) {
      return;
    }

    const term = new Terminal({ convertEol: true });
    terminalRef.current = term;

    term.open(terminalContainer.current);
    term.write('$ ');

    let command = '';

    term.onKey(({key, domEvent: evt }) => {
      console.log(key, evt.keyCode, evt.key);
      const printable = !evt.altKey && !evt.ctrlKey && !evt.metaKey;

      if (evt.keyCode === 8) {
        // Do not delete the prompt
        term.write('\b \b');
        command = command.slice(0, command.length - 1);
      } else if (printable) {
        if (key === '\r') {
          term.write('\n$ ');
          term.write(`Sending command: ${command}\n$ `);
          command = '';
        } else {
          term.write(evt.key);
          command += evt.key;
        }
      }
    });

    term.attachCustomKeyEventHandler((arg) => {
      if ((arg.metaKey || arg.ctrlKey) && arg.code === "KeyV" && arg.type === "keydown") {
        navigator.clipboard.readText()
          .then(text => {
            term.write(text);
            command += text;
          })
      }
      return true;
    });

    return () => {
      term.dispose();
    }
  }, [])

	if (isSeamless) {
		return (
			<ViewportWithLoading
				ready={!!playground}
				loadingProgress={progress}
				iframeRef={iframeRef}
			/>
		);
	}

	return (
    <Fragment>

		<BrowserChrome
			showAddressBar={!!playground}
			url={url}
			toolbarButtons={updatedToolbarButtons}
			onUrlChange={(url) => playground?.goTo(url)}
		>
			<ViewportWithLoading
				ready={!!playground}
				loadingProgress={progress}
				iframeRef={iframeRef}
			/>
		</BrowserChrome>
    <div ref={terminalContainer} />
    </Fragment>
	);
}

interface ViewportWithLoadingProps {
	iframeRef: Ref<HTMLIFrameElement>;
	loadingProgress: ProgressObserverEvent;
	ready: boolean;
}

const ViewportWithLoading = function LoadedViewportComponent({
	iframeRef,
	loadingProgress,
	ready,
}: ViewportWithLoadingProps) {
	return (
		<div className={css.fullSize}>
			<ProgressBar
				caption={loadingProgress.caption || 'Preparing WordPress...'}
				mode={loadingProgress.mode}
				percentFull={loadingProgress.progress}
				visible={!ready}
			/>
			<iframe
				title="Playground Viewport"
				className={css.fullSize}
				ref={iframeRef}
			></iframe>
		</div>
	);
};
