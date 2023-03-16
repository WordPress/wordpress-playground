import type { PlaygroundClient } from '@wp-playground/playground-client';

import React, { ReactElement, Ref, useMemo } from 'react';
import type {
  ProgressObserver,
  ProgressObserverEvent,
} from '@wp-playground/php-wasm-progress';

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
