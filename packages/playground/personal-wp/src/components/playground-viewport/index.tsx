import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import {
	type BlueprintV1Declaration,
	compileBlueprintV1,
	runBlueprintV1Steps,
} from '@wp-playground/blueprints';
import { ProgressTracker } from '@php-wasm/progress';
import { logger } from '@php-wasm/logger';

import css from './style.module.css';
import welcomeStrings from './welcome-strings.json';
import {
	selectActiveSiteError,
	selectActiveSiteErrorDetails,
	getActiveClientInfo,
	useActiveSite,
	useAppDispatch,
	useAppSelector,
} from '../../lib/state/redux/store';
import { removeClientInfo } from '../../lib/state/redux/slice-clients';
import { bootSiteClient } from '../../lib/state/redux/boot-site-client';
import { selectSiteBySlug } from '../../lib/state/redux/slice-sites';
import {
	getMainTabUnavailableMessage,
	markMainTabReady,
	refreshMainTabStatus,
	requestRemoteBlueprintInstall,
	setInstallBlueprintRequestCallback,
} from '../../lib/state/redux/tab-coordinator';
import classNames from 'classnames';
import { SiteErrorModal } from '../site-error-modal';
import { setSiteManagerOpen } from '../../lib/state/redux/slice-ui';
import { playgroundLogo } from '@wp-playground/components';
import { isAppBasePath } from '../../lib/state/url/app-base-url';
import Button from '../button';
import {
	getBlueprintInstallPreview,
	getBlueprintInstallSource,
	prepareBlueprintForRemoteInstall,
	resolveBlueprintForInstallExecution,
	shouldSkipBlueprintInstallConfirmation,
} from './blueprint-install';
import type { BlueprintInstallPreview } from './blueprint-install';
import { isAllowedBlueprintUrl } from '../../lib/blueprint-url';
// @ts-ignore
import { corsProxyUrl } from 'virtual:cors-proxy-url';

export const PlaygroundViewport = () => {
	const activeSite = useActiveSite();
	return activeSite ? <SeamlessViewport siteSlug={activeSite.slug} /> : null;
};

function getWelcomeHtml(): string {
	return `
<div class="stage">
<style>
  ${getCardStageCss()}

  /* Positions + rotations. rotate is a plain CSS property (not in keyframes)
     so the transition can smoothly animate it to 0 on card open. */
  .c1 { top: 4%;  left: 4%;   rotate: -2deg;  animation: drift-in 1s cubic-bezier(0.16,1,0.3,1) 0.8s forwards; }
  .c1 .icon { background: #fef0e8; color: #c44b2c; }
  .c2 { top: 2%;  right: 6%;  rotate:  2.5deg; animation: drift-in 1s cubic-bezier(0.16,1,0.3,1) 1.4s forwards; }
  .c2 .icon { background: #e8f0e3; color: #5a7a3f; }
  .c3 { top: 26%; left: 12%;  rotate: -1.5deg; animation: drift-in 1s cubic-bezier(0.16,1,0.3,1) 2.3s forwards; }
  .c3 .icon { background: #e8ecf4; color: #3f5a7a; }
  .c4 { top: 26%; right: 4%;  rotate:  1.5deg; animation: drift-in 1s cubic-bezier(0.16,1,0.3,1) 3.0s forwards; }
  .c4 .icon { background: #f4e8ef; color: #7a3f5f; }
  .c5 { top: 48%; left: 6%;   rotate: -2.5deg; animation: drift-in 1s cubic-bezier(0.16,1,0.3,1) 1.1s forwards; }
  .c5 .icon { background: #fef5e0; color: #a8762a; }
  .c6 { top: 50%; right: 10%; rotate:  2deg;   animation: drift-in 1s cubic-bezier(0.16,1,0.3,1) 2.0s forwards; }
  .c6 .icon { background: #eae4f2; color: #5a3f7a; }
  .c7 { top: 72%; left: 14%;  rotate: -1deg;   animation: drift-in 1s cubic-bezier(0.16,1,0.3,1) 1.7s forwards; }
  .c7 .icon { background: #e0f0ee; color: #2a7a6e; }
  .c8 { top: 72%; right: 6%;  rotate:  2.5deg; animation: drift-in 1s cubic-bezier(0.16,1,0.3,1) 2.6s forwards; }
  .c8 .icon { background: #f5e3e0; color: #a54a3a; }
  .c9 { top: 14%; left: 26%; rotate:  1.5deg; animation: drift-in 1s cubic-bezier(0.16,1,0.3,1) 1.9s forwards; }
  .c9 .icon { background: #f0ece3; color: #7a6040; }

  #t1:checked ~ .field .c1, #t2:checked ~ .field .c2,
  #t3:checked ~ .field .c3, #t4:checked ~ .field .c4,
  #t5:checked ~ .field .c5, #t6:checked ~ .field .c6,
  #t7:checked ~ .field .c7, #t8:checked ~ .field .c8,
  #t9:checked ~ .field .c9 {
    rotate: 0deg !important;
    width: min(240px, calc(100vw - 48px)) !important;
    z-index: 20 !important;
    box-shadow: 0 2px 4px rgba(31,29,26,0.06), 0 16px 40px rgba(31,29,26,0.14) !important;
  }

  #t1:checked ~ .field .c1 .card-detail, #t2:checked ~ .field .c2 .card-detail,
  #t3:checked ~ .field .c3 .card-detail, #t4:checked ~ .field .c4 .card-detail,
  #t5:checked ~ .field .c5 .card-detail, #t6:checked ~ .field .c6 .card-detail,
  #t7:checked ~ .field .c7 .card-detail, #t8:checked ~ .field .c8 .card-detail,
  #t9:checked ~ .field .c9 .card-detail {
    max-height: 260px;
  }

  /* Bottom cards expand upward so they stay on screen */
  #t7:checked ~ .field .c7,
  #t8:checked ~ .field .c8 { transform: translateY(-140px) !important; }

  @media (min-width: 640px) {
    .c1 { top: 4%;  left: 2%;   right: auto; }
    .c2 { top: 2%;  left: 36%;  right: auto; }
    .c3 { top: 4%;  left: auto; right: 2%;   }
    .c4 { top: 40%; left: auto; right: 2%;   }
    .c5 { top: 38%; left: 6%;   right: auto; }
    .c6 { top: 40%; left: 37%;  right: auto; }
    .c7 { top: 72%; left: 12%;  right: auto; }
    .c8 { top: 72%; left: auto; right: 4%;   }
    .c9 { top: 72%; left: 37%;  right: auto; }
    #t1:checked ~ .field .c1, #t2:checked ~ .field .c2,
    #t3:checked ~ .field .c3, #t4:checked ~ .field .c4,
    #t5:checked ~ .field .c5, #t6:checked ~ .field .c6,
    #t7:checked ~ .field .c7, #t8:checked ~ .field .c8,
    #t9:checked ~ .field .c9 {
      width: min(280px, calc(100vw - 64px)) !important;
    }
    #t7:checked ~ .field .c7,
    #t8:checked ~ .field .c8,
    #t9:checked ~ .field .c9 { transform: translateY(-140px) !important; }
  }
</style>

  <input type="radio" name="card-panel" id="t0" class="card-toggle" checked>
  <input type="radio" name="card-panel" id="t1" class="card-toggle">
  <input type="radio" name="card-panel" id="t2" class="card-toggle">
  <input type="radio" name="card-panel" id="t3" class="card-toggle">
  <input type="radio" name="card-panel" id="t4" class="card-toggle">
  <input type="radio" name="card-panel" id="t5" class="card-toggle">
  <input type="radio" name="card-panel" id="t6" class="card-toggle">
  <input type="radio" name="card-panel" id="t7" class="card-toggle">
  <input type="radio" name="card-panel" id="t8" class="card-toggle">
  <input type="radio" name="card-panel" id="t9" class="card-toggle">

  <div class="eyebrow"><span class="pulse"></span>Preparing your space</div>
  <h1 class="headline">A small world,<br>just for <em>you</em>.</h1>
  <p class="intro">Install the tools you need — a reading list, a contacts app, a journal — and they're yours alone, in this tab.</p>

  <div class="field">
    <div class="threads">
      <svg viewBox="0 0 480 400" preserveAspectRatio="none">
        <path d="M 90 60 Q 200 100 240 180"/>
        <path d="M 380 50 Q 300 120 280 200"/>
        <path d="M 120 180 Q 220 240 200 320"/>
        <path d="M 400 220 Q 340 280 320 340"/>
        <path d="M 240 180 Q 260 240 200 320"/>
      </svg>
    </div>

    <label class="card c1" for="t1">
      <div class="card-front">
        <div class="icon">✎</div>
        <div class="text"><div class="label">Journal</div><div class="sub">private notes</div></div>
      </div>
      <div class="card-detail"><div class="detail-inner">
        <label class="detail-close" for="t0">×</label>
        <div class="detail-label">Apr 3 · private entry</div>
        <p class="detail-body" style="color:var(--ink-faint);font-size:10px;margin-bottom:4px">no cloud · no account</p>
        <p class="detail-body">Everything written here stays on this device. Close the tab, come back later — your entries are still here.</p>
      </div></div>
    </label>

    <label class="card c2" for="t2">
      <div class="card-front">
        <div class="icon">★</div>
        <div class="text"><div class="label">Reading list</div><div class="sub">save &amp; revisit</div></div>
      </div>
      <div class="card-detail"><div class="detail-inner">
        <label class="detail-close" for="t0">×</label>
        <div class="detail-label">3 saved</div>
        <ul class="detail-list">
          <li><div class="li-main"><div>What is digital sovereignty?</div><div class="li-sub">Owning your tools, not renting them</div></div></li>
          <li><div class="li-main"><div>The sandbox is the feature</div><div class="li-sub">Why running in a browser changes everything</div></div></li>
          <li style="color:var(--ink-faint)"><div class="li-main"><div>Moving to a real host, one day</div></div></li>
        </ul>
      </div></div>
    </label>

    <label class="card c3" for="t3">
      <div class="card-front">
        <div class="icon">✦</div>
        <div class="text"><div class="label">Install apps</div><div class="sub">tap + to browse</div></div>
      </div>
      <div class="card-detail"><div class="detail-inner">
        <label class="detail-close" for="t0">×</label>
        <div class="detail-label">How to install</div>
        <p class="detail-body">Tap <strong>+</strong> to browse journals, contacts, reading lists, and more. Install is instant — no server needed.</p>
      </div></div>
    </label>

    <label class="card c4" for="t4">
      <div class="card-front">
        <div class="icon">♥</div>
        <div class="text"><div class="label">Contacts</div><div class="sub">people you know</div></div>
      </div>
      <div class="card-detail"><div class="detail-inner">
        <label class="detail-close" for="t0">×</label>
        <div class="detail-label">Personal CRM</div>
        <ul class="detail-list">
          <li><div class="li-main"><div>Notes on people</div><div class="li-sub">birthdays, context, last talked — your way</div></div></li>
          <li><div class="li-main"><div>No cloud sync</div><div class="li-sub">contact notes never leave this device</div></div></li>
          <li><div class="li-main"><div>Install from the store</div><div class="li-sub">search for a contacts or CRM plugin</div></div></li>
        </ul>
      </div></div>
    </label>

    <label class="card c5" for="t5">
      <div class="card-front">
        <div class="icon">◐</div>
        <div class="text"><div class="label">Site Tools</div><div class="sub">bottom-left corner</div></div>
      </div>
      <div class="card-detail"><div class="detail-inner">
        <label class="detail-close" for="t0">×</label>
        <div class="detail-label">Always there</div>
        <ul class="detail-list">
          <li><div class="li-main li-done">Install apps</div><span class="li-note li-done">✓ from the store</span></li>
          <li><div class="li-main">Manage files</div><span class="li-note">browse &amp; edit</span></li>
          <li><div class="li-main">View logs</div><span class="li-note">see what's up</span></li>
          <li><div class="li-main">Restore a backup</div><span class="li-note">if needed</span></li>
        </ul>
      </div></div>
    </label>

    <label class="card c6" for="t6">
      <div class="card-front">
        <div class="icon">◎</div>
        <div class="text"><div class="label">Daily backups</div><div class="sub">automatic</div></div>
      </div>
      <div class="card-detail"><div class="detail-inner">
        <label class="detail-close" for="t0">×</label>
        <div class="detail-label">How it works</div>
        <p class="detail-body">A copy downloaded to your device daily. Change the schedule in Site Tools.</p>
        <div class="detail-sep"></div>
        <p class="detail-body">If this tab is ever cleared, point Site Tools at your saved file to restore everything.</p>
      </div></div>
    </label>

    <label class="card c7" for="t7">
      <div class="card-front">
        <div class="icon">◆</div>
        <div class="text"><div class="label">Bookmark this</div><div class="sub">it's your WordPress</div></div>
      </div>
      <div class="card-detail"><div class="detail-inner">
        <label class="detail-close" for="t0">×</label>
        <div class="detail-label">Don't lose this</div>
        <ul class="detail-list">
          <li>⭐ Bookmark this page — it's your WordPress now</li>
          <li>The Site Tools icon is in the bottom-left corner</li>
          <li>Export and move to any host, one day</li>
        </ul>
      </div></div>
    </label>

    <label class="card c9" for="t9">
      <div class="card-front">
        <div class="icon">♨</div>
        <div class="text"><div class="label">Recipes</div><div class="sub">save your favorites</div></div>
      </div>
      <div class="card-detail"><div class="detail-inner">
        <label class="detail-close" for="t0">×</label>
        <div class="detail-label">Your private online space</div>
        <p class="detail-body" style="color:var(--ink-faint);font-size:10px;margin-bottom:6px">WordPress · Playground · your apps</p>
        <p class="detail-body">Combine in one browser tab. Add apps to taste. Bookmark and serve — no server, no sign-up required.</p>
      </div></div>
    </label>

    <label class="card c8" for="t8">
      <div class="card-front">
        <div class="icon">⊙</div>
        <div class="text"><div class="label">Your data</div><div class="sub">stays here</div></div>
      </div>
      <div class="card-detail"><div class="detail-inner">
        <label class="detail-close" for="t0">×</label>
        <div class="detail-label">Where it lives</div>
        <ul class="detail-list">
          <li><span style="color:var(--accent);font-weight:600;min-width:14px">1</span><div class="li-main"><div>No sign-up needed</div><div class="li-sub">— not even an email address</div></div></li>
          <li><span style="color:var(--accent);font-weight:600;min-width:14px">2</span><div class="li-main"><div>No hosting plan</div><div class="li-sub">— runs entirely in this tab</div></div></li>
          <li><span style="color:var(--accent);font-weight:600;min-width:14px">3</span><div class="li-main"><div>Portable, eventually</div><div class="li-sub">— move to any host, same data</div></div></li>
        </ul>
      </div></div>
    </label>
  </div>

  <div class="footer">
    <span class="status">Setting things up…</span>
  </div>
</div>
`;
}

function getWhatsNewHtml(): string {
	const { tips, changelog } = welcomeStrings;
	const tip = tips[Math.floor(Math.random() * tips.length)];

	const cards = [
		{
			icon: '💡',
			iconBg: '#fef5e0',
			iconColor: '#a8762a',
			label: 'Tip',
			sub: 'for your site',
			detail: tip,
			top: '8%',
			left: '4%',
			right: '',
			rotate: '-2deg',
			delay: '0.6s',
			bottom: false,
		},
		...changelog.map((entry, i) => {
			const variants = [
				{
					icon: '✦',
					iconBg: '#e8ecf4',
					iconColor: '#3f5a7a',
					top: '5%',
					left: '',
					right: '6%',
					rotate: '2deg',
					delay: '1.0s',
					bottom: false,
				},
				{
					icon: '◎',
					iconBg: '#e8f0e3',
					iconColor: '#5a7a3f',
					top: '50%',
					left: '8%',
					right: '',
					rotate: '-1.5deg',
					delay: '0.8s',
					bottom: true,
				},
				{
					icon: '◆',
					iconBg: '#f4e8ef',
					iconColor: '#7a3f5f',
					top: '52%',
					left: '',
					right: '10%',
					rotate: '2.5deg',
					delay: '1.3s',
					bottom: true,
				},
			];
			const v = variants[i % variants.length];
			return {
				...v,
				label: entry.title,
				sub: "what's new",
				detail: entry.text,
			};
		}),
	];

	const radios = cards
		.map(
			(_, i) =>
				`<input type="radio" name="card-panel" id="t${i + 1}" class="card-toggle">`
		)
		.join('\n  ');

	const expandSel = cards
		.map((_, i) => `#t${i + 1}:checked ~ .field .c${i + 1}`)
		.join(', ');
	const detailSel = cards
		.map((_, i) => `#t${i + 1}:checked ~ .field .c${i + 1} .card-detail`)
		.join(', ');
	const bottomSel = cards
		.map((c, i) =>
			c.bottom ? `#t${i + 1}:checked ~ .field .c${i + 1}` : ''
		)
		.filter(Boolean)
		.join(', ');

	const cardsHtml = cards
		.map((c, i) => {
			const sideStyle = c.left ? `left:${c.left}` : `right:${c.right}`;
			const style = `top:${c.top};${sideStyle};rotate:${c.rotate};animation:drift-in 1s cubic-bezier(0.16,1,0.3,1) ${c.delay} forwards`;
			return `
    <label class="card c${i + 1}" for="t${i + 1}" style="${style}">
      <div class="card-front">
        <div class="icon" style="background:${c.iconBg};color:${c.iconColor}">${c.icon}</div>
        <div class="text"><div class="label">${c.label}</div><div class="sub">${c.sub}</div></div>
      </div>
      <div class="card-detail"><div class="detail-inner">
        <label class="detail-close" for="t0">×</label>
        <p class="detail-body">${c.detail}</p>
      </div></div>
    </label>`;
		})
		.join('');

	return `
<div class="stage">
<style>
  ${getCardStageCss()}

  ${expandSel} {
    rotate: 0deg !important;
    width: min(240px, calc(100vw - 48px)) !important;
    z-index: 20 !important;
    box-shadow: 0 2px 4px rgba(31,29,26,0.06), 0 16px 40px rgba(31,29,26,0.14) !important;
  }
  ${detailSel} { max-height: 260px; }
  ${bottomSel ? `${bottomSel} { transform: translateY(-140px) !important; }` : ''}

  .tour-link {
    font-size: 11px; color: var(--ink-faint); text-decoration: none;
    border-bottom: 1px solid var(--thread); padding-bottom: 1px;
  }
  .tour-link:hover { color: var(--ink-soft); }

  @media (min-width: 640px) {
    ${expandSel} { width: min(280px, calc(100vw - 64px)) !important; }
    ${bottomSel ? `${bottomSel} { transform: translateY(-140px) !important; }` : ''}
  }
</style>

  <input type="radio" name="card-panel" id="t0" class="card-toggle" checked>
  ${radios}

  <div class="eyebrow"><span class="pulse"></span>Your site is loading</div>
  <h1 class="headline">Welcome <em>back.</em></h1>

  <div class="field">
${cardsHtml}
  </div>

  <div class="footer">
    <span class="status">Loading your site…</span>
    <a href="?welcome" class="tour-link">First time here? See the intro →</a>
  </div>
</div>
`;
}

function getCardStageCss(): string {
	return `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter+Tight:wght@400;500;600&display=swap');

  :root {
    --bg: #f5f1ea;
    --bg-warm: #ede7dc;
    --ink: #1f1d1a;
    --ink-soft: #5a554c;
    --ink-faint: #a8a197;
    --accent: #c44b2c;
    --thread: rgba(31, 29, 26, 0.08);
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  /* position: fixed + inset: 0 escapes the welcome-content 680px container.
     z-index: 4 keeps it below the ProgressBar pill (z-index: 6). */
  .stage {
    position: fixed;
    inset: 0;
    z-index: 4;
    background: var(--bg);
    color: var(--ink);
    font-family: 'Inter Tight', system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
    display: flex;
    flex-direction: column;
    padding: 48px 24px 28px;
    max-width: none;
  }

  .stage::before {
    content: '';
    position: fixed;
    inset: 0;
    background:
      radial-gradient(ellipse at 30% 20%, rgba(196, 75, 44, 0.04), transparent 60%),
      radial-gradient(ellipse at 70% 80%, rgba(232, 148, 120, 0.05), transparent 60%);
    pointer-events: none;
    z-index: 0;
  }

  .eyebrow {
    font-size: 12px;
    color: var(--ink-soft);
    letter-spacing: 0.04em;
    margin-bottom: 12px;
    opacity: 0;
    animation: rise 0.8s ease-out 0.1s forwards;
    position: relative;
    z-index: 1;
  }
  .eyebrow .pulse {
    display: inline-block;
    width: 6px;
    height: 6px;
    background: var(--accent);
    border-radius: 50%;
    margin-right: 8px;
    vertical-align: middle;
    animation: blink 1.6s ease-in-out infinite;
  }
  @keyframes blink {
    0%, 100% { opacity: 0.35; }
    50%       { opacity: 1; }
  }

  .headline {
    font-family: 'Instrument Serif', serif;
    font-size: 38px;
    font-weight: 400;
    line-height: 1.05;
    letter-spacing: -0.01em;
    margin-bottom: 10px;
    opacity: 0;
    animation: rise 0.9s ease-out 0.3s forwards;
    position: relative;
    z-index: 1;
  }
  .headline em { font-style: italic; color: var(--accent); }

  .intro {
    font-size: 14px;
    line-height: 1.5;
    color: var(--ink-soft);
    max-width: 360px;
    margin-bottom: 20px;
    opacity: 0;
    animation: rise 0.9s ease-out 0.5s forwards;
    position: relative;
    z-index: 1;
  }

  @keyframes rise {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .field {
    flex: 1;
    position: relative;
    min-height: 320px;
    margin: 0 -24px;
    overflow: hidden;
  }

  /* Let expanded cards grow past the field boundary */
  .stage:has(.card-toggle:checked) .field { overflow: visible; }

  .threads {
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: 0;
    animation: fade-in 1.2s ease-out 3.8s forwards;
  }
  .threads svg { width: 100%; height: 100%; }
  .threads path { fill: none; stroke: var(--thread); stroke-width: 1; stroke-dasharray: 3 4; }
  @keyframes fade-in { to { opacity: 1; } }

  .card {
    position: absolute;
    width: 180px;
    opacity: 0;
    cursor: pointer;
    display: block;
    background: #fff;
    border-radius: 14px;
    box-shadow: 0 1px 2px rgba(31, 29, 26, 0.04), 0 8px 24px rgba(31, 29, 26, 0.06);
    overflow: hidden;
    /* rotate is intentionally absent from drift-in keyframes so this
       transition owns it and can override animation fill-mode on expand */
    transition:
      rotate     0.4s cubic-bezier(0.34, 1.56, 0.64, 1),
      width      0.3s cubic-bezier(0.4, 0, 0.2, 1),
      transform  0.3s ease,
      box-shadow 0.2s ease;
  }
  .card:hover { box-shadow: 0 1px 3px rgba(31, 29, 26, 0.06), 0 10px 30px rgba(31, 29, 26, 0.12); }

  .card-front {
    height: 66px;
    padding: 14px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .card-front .icon {
    width: 34px; height: 34px;
    border-radius: 9px;
    display: flex; align-items: center; justify-content: center;
    font-size: 17px; flex-shrink: 0;
  }
  .card-front .label { font-size: 13px; font-weight: 500; color: var(--ink); letter-spacing: -0.005em; }
  .card-front .sub   { font-size: 10px; color: var(--ink-faint); margin-top: 2px; letter-spacing: 0.02em; }

  .card-detail {
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.38s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .detail-inner { padding: 10px 14px 14px; border-top: 1px solid var(--thread); }

  .detail-close {
    display: block; float: right; clear: right;
    margin: 0 0 6px 8px;
    width: 20px; height: 20px;
    border-radius: 50%;
    background: var(--bg-warm); color: var(--ink-soft);
    font-size: 12px; line-height: 20px; text-align: center;
    cursor: pointer; font-style: normal;
  }

  .detail-label {
    font-size: 10px; font-weight: 600; color: var(--ink-faint);
    letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 7px;
  }
  .detail-body { font-size: 11.5px; color: var(--ink-soft); line-height: 1.55; margin-bottom: 6px; }
  .detail-body strong { color: var(--ink); font-weight: 500; }
  .detail-sep { height: 1px; background: var(--thread); margin: 8px 0; }

  .detail-list { list-style: none; padding: 0; margin: 0; }
  .detail-list li {
    padding: 5px 0; border-bottom: 1px solid var(--thread);
    font-size: 11px; color: var(--ink); display: flex; gap: 6px; align-items: flex-start;
  }
  .detail-list li:last-child { border-bottom: none; }
  .detail-list .li-main { flex: 1; }
  .detail-list .li-sub  { font-size: 10px; color: var(--ink-faint); margin-top: 2px; }
  .detail-list .li-note { font-size: 10px; color: var(--ink-faint); margin-left: auto; white-space: nowrap; }
  .detail-list .li-done { color: var(--accent); }

  /* Only translate + scale + opacity — rotate excluded so transition owns it */
  @keyframes drift-in {
    0%   { opacity: 0; translate: 0 16px; scale: 0.94; }
    100% { opacity: 1; translate: 0 0;    scale: 1;    }
  }

  .footer {
    margin-top: 14px;
    opacity: 0;
    animation: rise 0.8s ease-out 0.7s forwards;
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .status { font-size: 11px; color: var(--ink-soft); letter-spacing: 0.04em; }

  .card-toggle { display: none; position: absolute; }

  @media (min-width: 640px) {
    .stage { padding: 48px 48px 32px; }
    .headline { font-size: 48px; }
    .intro { max-width: 460px; }
    .card { width: 220px; }
    .card-front { height: 78px; }
    .card-front .icon { width: 40px; height: 40px; font-size: 20px; }
    .card-front .label { font-size: 14px; }
    .card-front .sub   { font-size: 11px; }
  }
  `;
}

function SeamlessViewport({ siteSlug }: { siteSlug: string }) {
	const site = useAppSelector((state) => selectSiteBySlug(state, siteSlug));
	const dispatch = useAppDispatch();
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const siteManagerIsOpen = useAppSelector(
		(state) => state.ui.siteManagerIsOpen
	);
	const firstTemporarySiteCreated = useAppSelector(
		(state) => state.sites.firstTemporarySiteCreated
	);
	const clientInfo = useAppSelector(getActiveClientInfo);
	const url = clientInfo?.url;
	const playground = clientInfo?.client;
	const isDependentMode = clientInfo?.isDependentMode ?? false;
	const mainTabStatus =
		clientInfo?.mainTabStatus ??
		(isDependentMode ? 'missing' : 'connected');
	const hasLocalRuntimeClient = !isDependentMode && !!playground;
	const isReturningUser =
		site?.metadata.storage === 'opfs' && !firstTemporarySiteCreated;
	const forceWelcome = new URLSearchParams(window.location.search).has(
		'welcome'
	);

	const welcomeHtml =
		isReturningUser && !forceWelcome ? getWhatsNewHtml() : getWelcomeHtml();

	const [installingBlueprint, setInstallingBlueprint] = useState<
		string | null
	>(null);
	const [blueprintInstallDialogRequest, setBlueprintInstallDialogRequest] =
		useState<BlueprintInstallDialogRequest | null>(null);
	const installBannerResetTimeoutRef = useRef<ReturnType<
		typeof setTimeout
	> | null>(null);
	const blueprintInstallDialogResolverRef = useRef<
		((confirmed: boolean) => void) | null
	>(null);

	const clearInstallBannerResetTimeout = useCallback(() => {
		if (installBannerResetTimeoutRef.current) {
			clearTimeout(installBannerResetTimeoutRef.current);
			installBannerResetTimeoutRef.current = null;
		}
	}, []);

	const scheduleInstallBannerReset = useCallback(() => {
		clearInstallBannerResetTimeout();
		installBannerResetTimeoutRef.current = setTimeout(() => {
			installBannerResetTimeoutRef.current = null;
			setInstallingBlueprint(null);
		}, 3000);
	}, [clearInstallBannerResetTimeout]);

	useEffect(() => {
		return clearInstallBannerResetTimeout;
	}, [clearInstallBannerResetTimeout]);

	const requestBlueprintInstallConfirmation = useCallback(
		(blueprintUrl: string): Promise<boolean> => {
			blueprintInstallDialogResolverRef.current?.(false);
			return new Promise((resolve) => {
				blueprintInstallDialogResolverRef.current = resolve;
				setBlueprintInstallDialogRequest({ blueprintUrl });
			});
		},
		[]
	);

	const closeBlueprintInstallDialog = useCallback((confirmed: boolean) => {
		const resolve = blueprintInstallDialogResolverRef.current;
		blueprintInstallDialogResolverRef.current = null;
		setBlueprintInstallDialogRequest(null);
		resolve?.(confirmed);
	}, []);

	useEffect(() => {
		return () => {
			blueprintInstallDialogResolverRef.current?.(false);
			blueprintInstallDialogResolverRef.current = null;
		};
	}, []);

	// Apply a blueprint in-place on the running instance.
	const applyBlueprint = useCallback(
		async (
			blueprintUrl: string,
			options: ApplyBlueprintOptions = {}
		): Promise<InstallBlueprintResult> => {
			if (!playground) {
				return {
					status: 'error',
					error: 'Playground is not ready.',
				};
			}
			const allowNavigation = options.allowNavigation ?? true;
			clearInstallBannerResetTimeout();
			try {
				setInstallingBlueprint('Installing\u2026');
				const { blueprint, declaration } =
					await resolveBlueprintForInstallExecution(
						blueprintUrl,
						corsProxyUrl
					);
				const title = declaration.meta?.title || 'app';
				setInstallingBlueprint(`Installing ${title}\u2026`);

				const progress = new ProgressTracker();
				progress.addEventListener('progress', ((e: CustomEvent) => {
					const caption = e.detail?.caption;
					if (caption) {
						setInstallingBlueprint(caption);
					}
				}) as EventListener);

				const compiled = await compileBlueprintV1(blueprint, {
					corsProxy: corsProxyUrl,
					progress,
				});
				await runBlueprintV1Steps(
					compiled,
					getBlueprintRunnerClient(
						playground,
						declaration,
						allowNavigation
					)
				);
				if (allowNavigation && declaration.landingPage) {
					await playground.goTo(declaration.landingPage);
				}
			} catch (e) {
				logger.error('Failed to apply blueprint:', e);
				setInstallingBlueprint('Installation failed');
				scheduleInstallBannerReset();
				return {
					status: 'error',
					error: getErrorMessage(e),
				};
			}
			setInstallingBlueprint(null);
			return { status: 'success' };
		},
		[clearInstallBannerResetTimeout, playground, scheduleInstallBannerReset]
	);

	const applyBlueprintInMainTab = useCallback(
		async (blueprintUrl: string): Promise<InstallBlueprintResult> => {
			clearInstallBannerResetTimeout();
			try {
				setInstallingBlueprint('Installing in the active tab\u2026');
				const install = await prepareBlueprintForRemoteInstall(
					blueprintUrl,
					corsProxyUrl
				);
				const result = await requestRemoteBlueprintInstall(
					siteSlug,
					install.blueprintUrl
				);
				if (result.status === 'error') {
					setInstallingBlueprint('Installation failed');
					scheduleInstallBannerReset();
				} else {
					if (install.landingPage) {
						if (!playground) {
							setInstallingBlueprint('Installation failed');
							scheduleInstallBannerReset();
							return {
								status: 'error',
								error: 'The app was installed, but this tab could not open it.',
							};
						}
						setInstallingBlueprint('Opening app\u2026');
						await playground.goTo(install.landingPage);
					}
					setInstallingBlueprint(null);
				}
				return result;
			} catch (e) {
				setInstallingBlueprint('Installation failed');
				scheduleInstallBannerReset();
				return {
					status: 'error',
					error: getErrorMessage(e),
				};
			}
		},
		[
			clearInstallBannerResetTimeout,
			playground,
			scheduleInstallBannerReset,
			siteSlug,
		]
	);

	useEffect(() => {
		if (!hasLocalRuntimeClient) {
			return;
		}
		setInstallBlueprintRequestCallback((blueprintUrl) =>
			applyBlueprint(blueprintUrl, {
				allowNavigation: false,
			})
		);
		void markMainTabReady();
		return () => {
			setInstallBlueprintRequestCallback(null);
		};
	}, [applyBlueprint, hasLocalRuntimeClient]);

	// Handle relay messages from WordPress plugins.
	useEffect(() => {
		function handleMessage(event: MessageEvent) {
			const relayValidation = getRelayMessageValidation(
				event,
				iframeRef.current
			);
			if (!relayValidation.isValid) {
				return;
			}

			const installBlueprintMessage = getInstallBlueprintMessageData(
				relayValidation.data
			);
			if (installBlueprintMessage) {
				void installBlueprintFromRelay(event, installBlueprintMessage);
			}
		}
		window.addEventListener('message', handleMessage);
		return () => {
			window.removeEventListener('message', handleMessage);
		};
	}, [
		applyBlueprint,
		applyBlueprintInMainTab,
		hasLocalRuntimeClient,
		isDependentMode,
		requestBlueprintInstallConfirmation,
		siteSlug,
		url,
	]);

	async function installBlueprintFromRelay(
		event: MessageEvent,
		message: InstallBlueprintMessageData
	) {
		const { blueprintUrl, requestId } = message;
		let installLocally = hasLocalRuntimeClient;
		if (!installLocally) {
			if (!isDependentMode) {
				postInstallBlueprintResult(event, {
					blueprintUrl,
					requestId,
					status: 'error',
					error: 'Playground is not ready.',
				});
				return;
			}

			const status = await refreshMainTabStatus();
			if (status !== 'connected') {
				postInstallBlueprintResult(event, {
					blueprintUrl,
					requestId,
					status: 'error',
					error: getMainTabUnavailableMessage(status),
				});
				return;
			}
			installLocally = false;
		}

		const skipConfirmation = shouldSkipConfirmationForInstallMessage(
			event,
			iframeRef.current,
			url
		);
		if (
			!skipConfirmation &&
			!(await requestBlueprintInstallConfirmation(blueprintUrl))
		) {
			postInstallBlueprintResult(event, {
				blueprintUrl,
				requestId,
				status: 'cancelled',
			});
			return;
		}

		postInstallBlueprintResult(event, {
			blueprintUrl,
			requestId,
			...(installLocally
				? await applyBlueprint(blueprintUrl)
				: await applyBlueprintInMainTab(blueprintUrl)),
		});
	}

	// Reflect the WordPress URL in the browser's address bar.
	useEffect(() => {
		if (!url) {
			return;
		}
		const browserUrl =
			window.location.origin + (url.startsWith('/') ? url : '/' + url);
		if (browserUrl !== window.location.href) {
			window.history.pushState({}, '', browserUrl);
		}
	}, [url]);

	useEffect(() => {
		if (!playground) {
			return;
		}
		function handlePopState() {
			const pathname = isAppBasePath(window.location.pathname)
				? '/'
				: window.location.pathname;
			void playground?.goTo(pathname + window.location.search);
		}
		window.addEventListener('popstate', handlePopState);
		return () => window.removeEventListener('popstate', handlePopState);
	}, [playground]);

	return (
		<div className={css.seamlessWrapper}>
			{installingBlueprint && (
				<div className={css.installBanner}>{installingBlueprint}</div>
			)}
			{blueprintInstallDialogRequest && (
				<BlueprintInstallDialog
					blueprintUrl={blueprintInstallDialogRequest.blueprintUrl}
					onClose={closeBlueprintInstallDialog}
				/>
			)}
			<JustViewport
				siteSlug={siteSlug}
				iframeRef={iframeRef}
				welcomeHtml={welcomeHtml}
			/>
			<MainTabRecoveryNotice
				isDependentMode={isDependentMode}
				mainTabStatus={mainTabStatus}
			/>
			<div
				className={classNames(css.sidebarLatch, {
					[css.sidebarLatchHidden]: siteManagerIsOpen,
				})}
			>
				<Button
					variant="browser-chrome"
					aria-label={
						siteManagerIsOpen
							? 'Close Site Tools'
							: 'Open Site Tools'
					}
					aria-pressed={siteManagerIsOpen}
					className={css.sidebarLatchButton}
					onClick={() => {
						dispatch(setSiteManagerOpen(!siteManagerIsOpen));
					}}
				>
					{playgroundLogo({ width: 24, height: 24 })}
				</Button>
			</div>
		</div>
	);
}

function BlueprintInstallDialog({
	blueprintUrl,
	onClose,
}: {
	blueprintUrl: string;
	onClose: (confirmed: boolean) => void;
}) {
	const dialogRef = useRef<HTMLDialogElement>(null);
	const dialogResolvedRef = useRef(false);
	const source = getBlueprintInstallSource(blueprintUrl);
	const [previewState, setPreviewState] =
		useState<BlueprintInstallPreviewState>({
			status: 'loading',
		});

	const closeDialog = useCallback(
		(confirmed: boolean) => {
			if (dialogResolvedRef.current) {
				return;
			}
			dialogResolvedRef.current = true;
			onClose(confirmed);
		},
		[onClose]
	);

	useEffect(() => {
		const dialog = dialogRef.current;
		if (!dialog || dialog.open) {
			return;
		}
		dialog.showModal();
		return () => {
			if (dialog.open) {
				dialog.close();
			}
		};
	}, []);

	useEffect(() => {
		let cancelled = false;
		setPreviewState({ status: 'loading' });
		getBlueprintInstallPreview(blueprintUrl, corsProxyUrl)
			.then((preview) => {
				if (!cancelled) {
					setPreviewState({ status: 'ready', preview });
				}
			})
			.catch((error) => {
				if (!cancelled) {
					setPreviewState({
						status: 'error',
						error: getErrorMessage(error),
					});
				}
			});
		return () => {
			cancelled = true;
		};
	}, [blueprintUrl]);

	const preview =
		previewState.status === 'ready' ? previewState.preview : null;
	const canInstall = previewState.status === 'ready';
	const blueprintTitle = preview
		? preview.title
		: previewState.status === 'error'
			? 'Preview unavailable'
			: 'Loading app details...';
	const warnings = preview?.warnings || [];
	const visibleWarnings = warnings.slice(0, 3);
	const hasDangerWarning = warnings.some(
		(warning) => warning.severity === 'danger'
	);
	const hasWarning = warnings.some(
		(warning) => warning.severity === 'warning'
	);

	return (
		<dialog
			ref={dialogRef}
			className={css.blueprintInstallDialog}
			aria-labelledby="blueprint-install-dialog-title"
			aria-describedby="blueprint-install-dialog-description"
			onCancel={(event) => {
				event.preventDefault();
				closeDialog(false);
			}}
			onClose={() => {
				closeDialog(false);
			}}
		>
			<div className={css.blueprintInstallDialogContent}>
				<div className={css.blueprintInstallDialogHeader}>
					<h2 id="blueprint-install-dialog-title">Install app?</h2>
					<p id="blueprint-install-dialog-description">
						A WordPress page requested to install an app from{' '}
						<strong>{source.label}</strong>. This may change your
						site.
					</p>
				</div>

				<div className={css.blueprintInstallSummary}>
					<h3>
						{blueprintTitle}
						{preview?.author && <span> by {preview.author}</span>}
					</h3>
					{preview && (
						<p>
							{preview.description ?? 'No description provided.'}
						</p>
					)}
				</div>

				{warnings.length > 0 && (
					<div
						className={classNames(css.blueprintInstallWarnings, {
							[css.blueprintInstallWarningsDanger]:
								hasDangerWarning,
							[css.blueprintInstallWarningsWarning]:
								!hasDangerWarning && hasWarning,
						})}
					>
						<strong>
							{hasDangerWarning
								? 'Review high-risk actions'
								: hasWarning
									? 'Review app actions'
									: 'App actions'}
						</strong>
						<ul>
							{visibleWarnings.map((warning, index) => (
								<li key={index}>
									<span>{warning.title}</span>
									<p>{warning.description}</p>
								</li>
							))}
						</ul>
						{warnings.length > visibleWarnings.length && (
							<p>
								Open the details below to review the full
								configuration.
							</p>
						)}
					</div>
				)}

				{previewState.status === 'loading' && (
					<div className={css.blueprintInstallStatus}>
						Loading app details...
					</div>
				)}
				{previewState.status === 'error' && (
					<div className={css.blueprintInstallError} role="alert">
						Could not load app details: {previewState.error}
					</div>
				)}
				{preview && (
					<details className={css.blueprintInstallDetails}>
						<summary>View blueprint.json</summary>
						<pre tabIndex={0}>
							<code>{preview.json}</code>
						</pre>
					</details>
				)}

				<div className={css.blueprintInstallDialogActions}>
					<button type="button" onClick={() => closeDialog(false)}>
						Cancel
					</button>
					<button
						type="button"
						disabled={!canInstall}
						onClick={() => closeDialog(true)}
					>
						Install
					</button>
				</div>
			</div>
		</dialog>
	);
}

function MainTabRecoveryNotice({
	isDependentMode,
	mainTabStatus,
}: {
	isDependentMode: boolean;
	mainTabStatus: 'connected' | 'booting' | 'missing';
}) {
	if (!isDependentMode || mainTabStatus === 'connected') {
		return null;
	}

	const isMissing = mainTabStatus === 'missing';

	return (
		<div className={css.mainTabNotice} role="status" aria-live="polite">
			<div className={css.mainTabNoticeText}>
				<strong>
					{isMissing
						? 'The active WordPress tab was disconnected.'
						: 'The active WordPress tab is reconnecting.'}
				</strong>
				<span>
					{isMissing
						? ' This page is preserved, but WordPress cannot handle new requests until a tab reconnects.'
						: ' This page is preserved while WordPress starts again.'}
				</span>
			</div>
			{isMissing && (
				<div className={css.mainTabNoticeActions}>
					<button
						type="button"
						onClick={() => window.location.reload()}
					>
						Reload this tab
					</button>
					<button
						type="button"
						onClick={() =>
							window.open(
								window.location.href,
								'_blank',
								'noopener,noreferrer'
							)
						}
					>
						Open new tab
					</button>
				</div>
			)}
		</div>
	);
}

type RelayMessageData = {
	type: 'relay';
	relayType?: unknown;
	blueprintUrl?: unknown;
	requestId?: unknown;
};

type InstallBlueprintMessageData = {
	type: 'relay';
	relayType: 'install-blueprint';
	blueprintUrl: string;
	requestId?: string;
};

type BlueprintInstallDialogRequest = {
	blueprintUrl: string;
};

type BlueprintInstallPreviewState =
	| {
			status: 'loading';
	  }
	| {
			status: 'ready';
			preview: BlueprintInstallPreview;
	  }
	| {
			status: 'error';
			error: string;
	  };

type ApplyBlueprintOptions = {
	allowNavigation?: boolean;
};

type InstallBlueprintResult = {
	status: 'success' | 'error';
	error?: string;
};

type InstallBlueprintResultMessage = {
	type: 'relay';
	relayType: 'install-blueprint-result';
	blueprintUrl: string;
	requestId?: string;
	status: InstallBlueprintResult['status'] | 'cancelled';
	error?: string;
};

function getRelayMessageValidation(
	event: MessageEvent,
	iframe: HTMLIFrameElement | null
):
	| {
			isValid: true;
			data: RelayMessageData;
	  }
	| {
			isValid: false;
			reason: string;
			data?: Partial<RelayMessageData>;
	  } {
	if (typeof event.data !== 'object' || event.data === null) {
		return { isValid: false, reason: 'invalid-data' };
	}
	const data = event.data as Partial<RelayMessageData>;
	if (data.type !== 'relay') {
		return { isValid: false, reason: 'not-relay', data };
	}
	if (!isMessageFromIframeTree(event, iframe)) {
		return { isValid: false, reason: 'unexpected-source', data };
	}
	if (event.origin !== window.location.origin) {
		return { isValid: false, reason: 'unexpected-origin', data };
	}
	return { isValid: true, data: { type: 'relay', ...data } };
}

function getInstallBlueprintMessageData(
	data: RelayMessageData
): InstallBlueprintMessageData | undefined {
	if (
		data.relayType !== 'install-blueprint' ||
		typeof data.blueprintUrl !== 'string' ||
		!isAllowedBlueprintUrl(data.blueprintUrl)
	) {
		return;
	}
	return {
		type: 'relay',
		relayType: 'install-blueprint',
		blueprintUrl: data.blueprintUrl,
		requestId: getRequestId(data),
	};
}

function getRequestId(data: RelayMessageData): string | undefined {
	return typeof data.requestId === 'string' ? data.requestId : undefined;
}

function shouldSkipConfirmationForInstallMessage(
	event: MessageEvent,
	iframe: HTMLIFrameElement | null,
	currentUrl: string | undefined
): boolean {
	return [
		getWindowLocation(event.source),
		getWindowLocation(iframe?.contentWindow),
		currentUrl,
	].some(shouldSkipBlueprintInstallConfirmation);
}

function getWindowLocation(
	source: MessageEventSource | Window | null | undefined
): string | undefined {
	if (!source || !('location' in source)) {
		return;
	}

	try {
		return (source as Window).location.href;
	} catch {
		return;
	}
}

function postInstallBlueprintResult(
	event: MessageEvent,
	result: Omit<InstallBlueprintResultMessage, 'type' | 'relayType'>
) {
	if (!event.source) {
		return;
	}
	(event.source as Window).postMessage(
		{
			type: 'relay',
			relayType: 'install-blueprint-result',
			...result,
		} satisfies InstallBlueprintResultMessage,
		event.origin
	);
}

function isMessageFromIframeTree(
	event: MessageEvent,
	iframe: HTMLIFrameElement | null
): boolean {
	if (!iframe?.contentWindow || !event.source) {
		return false;
	}
	if (event.source === iframe.contentWindow) {
		return true;
	}
	return isDescendantWindow(iframe.contentWindow, event.source);
}

function isDescendantWindow(
	root: Window,
	candidate: MessageEventSource
): boolean {
	try {
		for (let i = 0; i < root.frames.length; i++) {
			const child = root.frames[i];
			if (child === candidate || isDescendantWindow(child, candidate)) {
				return true;
			}
		}
	} catch {
		// Cross-origin frames are not inspectable and therefore not accepted.
	}
	return false;
}

function getBlueprintRunnerClient<T extends object>(
	playground: T,
	blueprint: BlueprintV1Declaration,
	allowNavigation: boolean
): T {
	if (allowNavigation && shouldAllowBlueprintRunnerRedirect(blueprint)) {
		return playground;
	}
	return withoutGoTo(playground);
}

function shouldAllowBlueprintRunnerRedirect(
	blueprint: BlueprintV1Declaration
): boolean {
	return !!blueprint.landingPage;
}

function withoutGoTo<T extends object>(playground: T): T {
	return new Proxy(playground, {
		get(target, property, receiver) {
			if (property === 'goTo') {
				return async () => undefined;
			}
			return Reflect.get(target, property, receiver);
		},
	});
}

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

export const JustViewport = function JustViewport({
	siteSlug,
	iframeRef: externalIframeRef,
	welcomeHtml,
}: {
	siteSlug: string;
	iframeRef?: RefObject<HTMLIFrameElement>;
	welcomeHtml?: string;
}) {
	const internalIframeRef = useRef<HTMLIFrameElement>(null);
	const iframeRef = externalIframeRef || internalIframeRef;
	const site = useAppSelector((state) => selectSiteBySlug(state, siteSlug))!;

	const dispatch = useAppDispatch();
	const runtimeConfigString = JSON.stringify(
		site.metadata.runtimeConfiguration
	);
	useEffect(() => {
		const iframe = iframeRef.current;
		if (!iframe) {
			return;
		}

		const abortController = new AbortController();
		dispatch(
			bootSiteClient(siteSlug, iframe, {
				signal: abortController.signal,
				clearUrlAfterBlueprintApplied: true,
				autoLogin: true,
				welcomeHtml,
			})
		);

		return () => {
			abortController.abort();
			dispatch(removeClientInfo(siteSlug));
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [siteSlug, iframeRef, runtimeConfigString]);

	const error = useAppSelector(selectActiveSiteError);
	const errorDetails = useAppSelector(selectActiveSiteErrorDetails);
	const activeSiteSlug = useAppSelector((state) => state.ui.activeSite?.slug);
	const showOverlay = error && activeSiteSlug === siteSlug;

	return (
		<>
			<iframe
				key={siteSlug}
				title="WordPress Playground wrapper (the actual WordPress site is in another, nested iframe)"
				className={classNames('playground-viewport', css.fullSize)}
				ref={iframeRef}
			/>
			{showOverlay ? (
				<SiteErrorModal
					error={error}
					siteSlug={siteSlug}
					site={site}
					errorDetails={errorDetails}
				/>
			) : null}
		</>
	);
};
