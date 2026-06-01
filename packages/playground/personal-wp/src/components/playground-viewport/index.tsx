import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, RefObject } from 'react';
import {
	type BlueprintV1Declaration,
	compileBlueprintV1,
	runBlueprintV1Steps,
} from '@wp-playground/blueprints';
import { ProgressTracker, type ProgressDetails } from '@php-wasm/progress';
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
	setUserBlueprintInstallCallback,
} from '../../lib/state/redux/tab-coordinator';
import classNames from 'classnames';
import { SiteErrorModal } from '../site-error-modal';
import {
	setBlueprintInstallMessage,
	setSiteManagerOpen,
} from '../../lib/state/redux/slice-ui';
import { playgroundLogo } from '@wp-playground/components';
import { isAppBasePath } from '../../lib/state/url/app-base-url';
import Button from '../button';
import {
	getBlueprintInstallPreview,
	getBlueprintInstallSource,
	getTrustedBlueprintInstallSource,
	prepareBlueprintForRemoteInstall,
	resolveBlueprintForInstallExecution,
	shouldSkipBlueprintInstallConfirmation,
} from './blueprint-install';
import type { BlueprintInstallPreview } from './blueprint-install';
import { isAllowedBlueprintUrl } from '../../lib/blueprint-url';
import {
	getBlueprintUsageStatsProperties,
	getSiteUsageStatsProperties,
	logPersonalWpEvent,
} from '../../lib/personalwp/usage-stats';
import type {
	BlueprintInstallUsageStatsRequestSource,
	BlueprintInstallUsageStatsTrigger,
} from '../../lib/personalwp/usage-stats';
// @ts-ignore
import { corsProxyUrl } from 'virtual:cors-proxy-url';

export const PlaygroundViewport = () => {
	const activeSite = useActiveSite();
	return activeSite ? <SeamlessViewport siteSlug={activeSite.slug} /> : null;
};

type IconTheme = 'blue' | 'green' | 'red' | 'neutral' | 'sky' | 'amber';

const ICON_THEMES: Record<
	IconTheme,
	{ lightBg: string; lightColor: string; darkBg: string; darkColor: string }
> = {
	blue: {
		lightBg: '#e7eaff',
		lightColor: '#3858e9',
		darkBg: '#1f2542',
		darkColor: '#9eb3ff',
	},
	green: {
		lightBg: '#ebf3e7',
		lightColor: '#45741e',
		darkBg: '#1e2c1a',
		darkColor: '#a3d57c',
	},
	red: {
		lightBg: '#fcebec',
		lightColor: '#b32d2e',
		darkBg: '#3a1f21',
		darkColor: '#ff8e8f',
	},
	neutral: {
		lightBg: '#f0f0f1',
		lightColor: '#1e1e1e',
		darkBg: '#2a2a2c',
		darkColor: '#e8e8e8',
	},
	sky: {
		lightBg: '#e0f0f7',
		lightColor: '#2271b1',
		darkBg: '#1a2730',
		darkColor: '#7ec0e3',
	},
	amber: {
		lightBg: '#fcf3e0',
		lightColor: '#826a00',
		darkBg: '#332a18',
		darkColor: '#e8c574',
	},
};

function iconStyle(theme: IconTheme): string {
	const t = ICON_THEMES[theme];
	return `background:light-dark(${t.lightBg},${t.darkBg});color:light-dark(${t.lightColor},${t.darkColor})`;
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

function getPublicAssetUrl(path: string): string {
	const baseUrl = import.meta.env.BASE_URL.endsWith('/')
		? import.meta.env.BASE_URL
		: `${import.meta.env.BASE_URL}/`;
	return `${baseUrl}${path.replace(/^\//, '')}`;
}

const NEW_USER_CARDS: Array<{
	icon: string;
	theme: IconTheme;
	label: string;
	sub: string;
	detailLabel?: string;
	detail: string;
}> = [
	{
		icon: '✎',
		theme: 'blue',
		label: 'Journal',
		sub: 'private notes',
		detail: `
        <div class="entry-date">no cloud · no account</div>
        <div class="entry-title">A room of one's own, in a browser tab.</div>
        <div class="entry-body">No account, no password, no <span class="hl">"choose a plan"</span> screen. Everything written here stays on this device.</div>
      `,
	},
	{
		icon: '★',
		theme: 'green',
		label: 'Reading list',
		sub: 'save & revisit',
		detailLabel: '3 saved',
		detail: `
        <div class="reading-item"><span class="dot">●</span><div><div class="title">What is digital sovereignty?</div><div class="meta">Owning your tools, not renting them</div></div></div>
        <div class="reading-item"><span class="dot">●</span><div><div class="title">The sandbox is the feature</div><div class="meta">Why running in a browser changes everything</div></div></div>
        <div class="reading-item"><span class="dot">○</span><div><div class="title">Moving to a real host, one day</div><div class="meta">When you outgrow a single tab</div></div></div>
      `,
	},
	{
		icon: '✦',
		theme: 'blue',
		label: 'Install apps',
		sub: 'tap + to browse',
		detailLabel: 'How to install',
		detail: `
        <div class="recipe-name">Your first install</div>
        <div class="recipe-meta">Tap + · Instant · No server needed</div>
        <div class="recipe-section">From the home screen</div>
        <ul class="recipe-list"><li>Tap the <strong>+</strong> button</li><li>Browse reading lists, contacts, notes…</li><li>Install is instant — no setup</li></ul>
        <div class="recipe-section">Open source &amp; yours</div>
        <ul class="recipe-list"><li>Apps run inside your WordPress</li><li>Your data stays with you</li></ul>
      `,
	},
	{
		icon: '♥',
		theme: 'red',
		label: 'Contacts',
		sub: 'people you know',
		detailLabel: 'Personal CRM',
		detail: `
        <div class="contact-card"><div class="contact-avatar">C</div><div class="contact-info"><div class="contact-name">Keep context</div><div class="contact-note">notes, birthdays, last talked — your way</div></div></div>
        <div class="contact-card"><div class="contact-avatar">L</div><div class="contact-info"><div class="contact-name">Local only</div><div class="contact-note">contact notes never leave this device</div></div></div>
        <div class="contact-card"><div class="contact-avatar">P</div><div class="contact-info"><div class="contact-name">Any plugin works</div><div class="contact-note">install a contacts or CRM plugin from the store</div></div></div>
      `,
	},
	{
		icon: '◐',
		theme: 'neutral',
		label: 'Site Tools',
		sub: 'bottom-left corner',
		detailLabel: 'Always there',
		detail: `
        <div class="habit-row"><div class="habit-check done"></div><div class="habit-label done">Install apps</div><div class="habit-streak">from the store</div></div>
        <div class="habit-row"><div class="habit-check"></div><div class="habit-label">Manage files</div><div class="habit-streak">browse &amp; edit</div></div>
        <div class="habit-row"><div class="habit-check"></div><div class="habit-label">View logs</div><div class="habit-streak">see what's up</div></div>
        <div class="habit-row"><div class="habit-check"></div><div class="habit-label">Restore a backup</div><div class="habit-streak">if needed</div></div>
      `,
	},
	{
		icon: '◎',
		theme: 'sky',
		label: 'Daily backups',
		sub: 'automatic',
		detail: `
        <div class="wiki-term">backup</div>
        <div class="wiki-pron">/ˈbakˌəp/ · noun</div>
        <div class="wiki-def"><span class="num">1.</span>A copy of your WordPress, downloaded to your device daily. Change the schedule in Site Tools.<br><br><span class="num">2.</span>If this tab is ever cleared, open Site Tools and point it at your saved file to restore everything.</div>
      `,
	},
	{
		icon: '◆',
		theme: 'amber',
		label: 'Bookmark this',
		sub: "it's your WordPress",
		detailLabel: "Don't lose this",
		detail: `
        <a class="bookmark"><span class="bm-title">⭐ Bookmark this page — it's your WordPress now</span><span class="bm-url">Add to bookmarks so you can always come back</span></a>
        <a class="bookmark"><span class="bm-title">What the Site Tools icon does</span><span class="bm-url">The floating icon in the bottom-left corner</span></a>
        <a class="bookmark"><span class="bm-title">Move to a real host, one day</span><span class="bm-url">Export and take your data anywhere</span></a>
      `,
	},
	{
		icon: '⊙',
		theme: 'blue',
		label: 'Your data',
		sub: 'stays here',
		detailLabel: 'Where it lives',
		detail: `
        <div class="track"><span class="track-num">1</span><div class="track-info"><div class="track-title">No sign-up needed</div><div class="track-artist">— not even an email address</div></div></div>
        <div class="track"><span class="track-num">2</span><div class="track-info"><div class="track-title">No hosting plan</div><div class="track-artist">— runs entirely in this tab</div></div></div>
        <div class="track"><span class="track-num">3</span><div class="track-info"><div class="track-title">Portable, eventually</div><div class="track-artist">— move to any host, same data</div></div></div>
      `,
	},
	{
		icon: '⚙',
		theme: 'sky',
		label: 'Booting up',
		sub: 'behind the scenes',
		detailLabel: 'No server, just your browser',
		detail: `
        <div class="habit-row boot-step bs1"><div class="habit-check"></div><div class="habit-label">Prepare WASM environment</div></div>
        <div class="habit-row boot-step bs2"><div class="habit-check"></div><div class="habit-label">Download PHP runtime</div></div>
        <div class="habit-row boot-step bs3"><div class="habit-check"></div><div class="habit-label">Download WordPress</div></div>
        <div class="habit-row boot-step bs4"><div class="habit-check"></div><div class="habit-label">Set up your private database</div></div>
        <div class="habit-row boot-step bs5"><div class="habit-check"></div><div class="habit-label">Start your site</div></div>
      `,
	},
];

function renderCard(
	card: (typeof NEW_USER_CARDS)[number],
	index: number,
	idPrefix: string
): string {
	const n = index + 1;
	const detailHeader =
		'detailLabel' in card
			? `<div class="detail-label">${card.detailLabel}</div>`
			: '';
	return `
      <label class="card c${n}" for="${idPrefix}${n}">
        <div class="card-front">
          <div class="icon" style="${iconStyle(card.theme)}">${card.icon}</div>
          <div class="text"><div class="label">${card.label}</div><div class="sub">${card.sub}</div></div>
        </div>
        <div class="card-detail"><div class="detail-inner">
          <label class="detail-close" for="${idPrefix}0">×</label>
          ${detailHeader}
          ${card.detail}
        </div></div>
      </label>`;
}

function renderIntroPanelInner(
	idPrefix: string,
	radioName: string,
	opts: { backToggle?: boolean } = {}
): string {
	const radios = NEW_USER_CARDS.map(
		(_, i) =>
			`<input type="radio" name="${radioName}" id="${idPrefix}${
				i + 1
			}" class="card-toggle">`
	).join('\n    ');

	const backToggle = opts.backToggle
		? `<label for="show-intro" class="back-toggle">← Back to what's new</label>`
		: '';

	return `
    <input type="radio" name="${radioName}" id="${idPrefix}0" class="card-toggle" checked>
    ${radios}

    <h1 class="headline">A small world,<br>just for <em>you</em>.</h1>
    ${backToggle}
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
      ${NEW_USER_CARDS.map((c, i) => renderCard(c, i, idPrefix)).join('\n      ')}
    </div>
`;
}

function getIntroPanelCss(idPrefix: string, scope: string): string {
	const s = scope ? `${scope} ` : '';
	const expandSel = NEW_USER_CARDS.map(
		(_, i) => `#${idPrefix}${i + 1}:checked ~ .field .c${i + 1}`
	).join(',\n  ');
	const detailSel = NEW_USER_CARDS.map(
		(_, i) =>
			`#${idPrefix}${i + 1}:checked ~ .field .c${i + 1} .card-detail`
	).join(',\n  ');

	return `
  /* Positions + rotations — rotate excluded from keyframes so transition owns it.
     Top values are deliberately jittered between siblings so cards don't sit in
     rigid horizontal rows. */
  ${s}.c1 { top: 3%;  left: 4%;   rotate: -2deg;  animation: drift-in 1s cubic-bezier(0.16,1,0.3,1) 0.8s forwards; }
  ${s}.c2 { top: 9%;  right: 6%;  rotate:  2.5deg; animation: drift-in 1s cubic-bezier(0.16,1,0.3,1) 1.4s forwards; }
  ${s}.c3 { top: 23%; left: 12%;  rotate: -1.5deg; animation: drift-in 1s cubic-bezier(0.16,1,0.3,1) 2.3s forwards; }
  ${s}.c4 { top: 30%; right: 4%;  rotate:  1.5deg; animation: drift-in 1s cubic-bezier(0.16,1,0.3,1) 3.0s forwards; }
  ${s}.c5 { top: 45%; left: 6%;   rotate: -2.5deg; animation: drift-in 1s cubic-bezier(0.16,1,0.3,1) 1.1s forwards; }
  ${s}.c6 { top: 53%; right: 10%; rotate:  2deg;   animation: drift-in 1s cubic-bezier(0.16,1,0.3,1) 2.0s forwards; }
  ${s}.c7 { top: 68%; left: 14%;  rotate: -1deg;   animation: drift-in 1s cubic-bezier(0.16,1,0.3,1) 1.7s forwards; }
  ${s}.c8 { top: 75%; right: 6%;  rotate:  2.5deg; animation: drift-in 1s cubic-bezier(0.16,1,0.3,1) 2.6s forwards; }
  ${s}.c9 { top: 14%; left: 26%;  rotate:  1.5deg; animation: drift-in 1s cubic-bezier(0.16,1,0.3,1) 1.9s forwards; }

  ${expandSel} {
    rotate: 0deg !important;
    width: min(240px, calc(100vw - 48px)) !important;
    z-index: 20 !important;
    box-shadow: 0 2px 4px var(--shadow-md), 0 16px 40px var(--shadow-xl) !important;
  }

  ${detailSel} {
    max-height: 260px;
  }

  /* Install-apps card has the most detail content; bump its max-height so the
     last bullet doesn't get clipped. */
  #${idPrefix}3:checked ~ .field .c3 .card-detail { max-height: 340px; }

  /* Bottom cards expand upward so they stay on screen */
  #${idPrefix}7:checked ~ .field .c7,
  #${idPrefix}8:checked ~ .field .c8 { transform: translateY(-140px) !important; }

  @media (min-width: 640px) {
    ${s}.c1 { top: 4%;  left: 2%;   right: auto; }
    ${s}.c2 { top: 0%;  left: 36%;  right: auto; }
    ${s}.c3 { top: 8%;  left: auto; right: 2%;   }
    ${s}.c4 { top: 38%; left: auto; right: 2%;   }
    ${s}.c5 { top: 36%; left: 6%;   right: auto; }
    ${s}.c6 { top: 44%; left: 37%;  right: auto; }
    ${s}.c7 { top: 70%; left: 12%;  right: auto; }
    ${s}.c8 { top: 73%; left: auto; right: 4%;   }
    ${s}.c9 { top: 76%; left: 37%;  right: auto; }
    ${expandSel} { width: min(280px, calc(100vw - 64px)) !important; }
    #${idPrefix}7:checked ~ .field .c7,
    #${idPrefix}8:checked ~ .field .c8,
    #${idPrefix}9:checked ~ .field .c9 { transform: translateY(-140px) !important; }
  }
`;
}

function getSwapCss(): string {
	return `
  .welcome-back-panel, .intro-panel {
    display: flex;
    flex-direction: column;
    flex: 1;
    position: relative;
    z-index: 1;
    min-height: 0;
  }
  .stage:has(#show-intro) .intro-panel { display: none; }
  .stage:has(#show-intro:checked) .welcome-back-panel { display: none; }
  .stage:has(#show-intro:checked) .intro-panel { display: flex; }
  #show-intro { display: none; }

  .intro-toggle, .back-toggle {
    display: inline-block;
    width: max-content;
    max-width: 100%;
    font-size: 12px;
    color: var(--ink-soft);
    text-decoration: none;
    cursor: pointer;
    margin-bottom: 16px;
    padding-bottom: 1px;
    border-bottom: 1px solid var(--thread);
    opacity: 0;
    animation: rise 0.8s ease-out 0.4s forwards;
    user-select: none;
  }
  .intro-toggle:hover, .back-toggle:hover {
    color: var(--accent);
    border-color: var(--accent);
  }
`;
}

function getWelcomeHtml(): string {
	return `
<div class="stage">
<style>
  ${getCardStageCss()}
  ${getIntroPanelCss('i', '.intro-panel')}
  ${getSwapCss()}
</style>
  <div class="intro-panel">${renderIntroPanelInner('i', 'icard')}</div>
</div>
`;
}

function getWhatsNewHtml(): string {
	const { tips, changelog } = welcomeStrings;
	const tip = escapeHtml(tips[Math.floor(Math.random() * tips.length)]);

	const cards: Array<{
		icon: string;
		theme: IconTheme;
		label: string;
		sub: string;
		detail: string;
		top: string;
		left: string;
		right: string;
		rotate: string;
		delay: string;
		bottom: boolean;
	}> = [
		{
			icon: '💡',
			theme: 'amber',
			label: 'Tip',
			sub: 'for your site',
			detail: tip,
			top: '6%',
			left: '4%',
			right: '',
			rotate: '-2deg',
			delay: '0.6s',
			bottom: false,
		},
		...changelog.map((entry, i) => {
			// Top values intentionally offset from the tip card so the layout
			// doesn't read as rigid 2x2 pairs.
			const variants: Array<{
				icon: string;
				theme: IconTheme;
				top: string;
				left: string;
				right: string;
				rotate: string;
				delay: string;
				bottom: boolean;
			}> = [
				{
					icon: '✦',
					theme: 'blue',
					top: '14%',
					left: '',
					right: '6%',
					rotate: '2deg',
					delay: '1.0s',
					bottom: false,
				},
				{
					icon: '◎',
					theme: 'green',
					top: '46%',
					left: '8%',
					right: '',
					rotate: '-1.5deg',
					delay: '0.8s',
					bottom: true,
				},
				{
					icon: '◆',
					theme: 'sky',
					top: '56%',
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
				label: escapeHtml(entry.title),
				sub: "what's new",
				detail: escapeHtml(entry.text),
			};
		}),
	];

	const radios = cards
		.map(
			(_, i) =>
				`<input type="radio" name="wcard" id="w${i + 1}" class="card-toggle">`
		)
		.join('\n    ');

	const expandSel = cards
		.map((_, i) => `#w${i + 1}:checked ~ .field .c${i + 1}`)
		.join(', ');
	const detailSel = cards
		.map((_, i) => `#w${i + 1}:checked ~ .field .c${i + 1} .card-detail`)
		.join(', ');
	const bottomSel = cards
		.map((c, i) =>
			c.bottom ? `#w${i + 1}:checked ~ .field .c${i + 1}` : ''
		)
		.filter(Boolean)
		.join(', ');

	const cardsHtml = cards
		.map((c, i) => {
			const sideStyle = c.left ? `left:${c.left}` : `right:${c.right}`;
			const style = `top:${c.top};${sideStyle};rotate:${c.rotate};animation:drift-in 1s cubic-bezier(0.16,1,0.3,1) ${c.delay} forwards`;
			return `
      <label class="card c${i + 1}" for="w${i + 1}" style="${style}">
        <div class="card-front">
          <div class="icon" style="${iconStyle(c.theme)}">${c.icon}</div>
          <div class="text"><div class="label">${c.label}</div><div class="sub">${c.sub}</div></div>
        </div>
        <div class="card-detail"><div class="detail-inner">
          <label class="detail-close" for="w0">×</label>
          <p class="detail-body">${c.detail}</p>
        </div></div>
      </label>`;
		})
		.join('');

	return `
<div class="stage">
<style>
  ${getCardStageCss()}
  ${getIntroPanelCss('i', '.intro-panel')}
  ${getSwapCss()}

  ${expandSel} {
    rotate: 0deg !important;
    width: min(240px, calc(100vw - 48px)) !important;
    z-index: 20 !important;
    box-shadow: 0 2px 4px var(--shadow-md), 0 16px 40px var(--shadow-xl) !important;
  }
  ${detailSel} { max-height: 260px; }
  ${bottomSel ? `${bottomSel} { transform: translateY(-140px) !important; }` : ''}

  @media (min-width: 640px) {
    ${expandSel} { width: min(280px, calc(100vw - 64px)) !important; }
    ${bottomSel ? `${bottomSel} { transform: translateY(-140px) !important; }` : ''}
  }
</style>
  <input type="checkbox" id="show-intro">

  <div class="welcome-back-panel">
    <input type="radio" name="wcard" id="w0" class="card-toggle" checked>
    ${radios}

    <h1 class="headline">Welcome <em>back.</em></h1>
    <label for="show-intro" class="intro-toggle">First time here? See the intro →</label>

    <div class="field">${cardsHtml}
    </div>
  </div>

  <div class="intro-panel">${renderIntroPanelInner('i', 'icard', {
		backToggle: true,
  })}</div>
</div>
`;
}

function getCardStageCss(): string {
	const interFontUrl = getPublicAssetUrl('fonts/inter-latin.woff2');
	const ebGaramondFontUrl = getPublicAssetUrl(
		'fonts/eb-garamond-latin-normal.woff2'
	);
	const ebGaramondItalicFontUrl = getPublicAssetUrl(
		'fonts/eb-garamond-latin-italic.woff2'
	);

	return `
  @font-face {
    font-family: 'Inter';
    font-style: normal;
    font-weight: 400 600;
    font-display: swap;
    src: url('${interFontUrl}') format('woff2');
  }
  @font-face {
    font-family: 'EB Garamond';
    font-style: normal;
    font-weight: 400 500;
    font-display: swap;
    src: url('${ebGaramondFontUrl}') format('woff2');
  }
  @font-face {
    font-family: 'EB Garamond';
    font-style: italic;
    font-weight: 400 500;
    font-display: swap;
    src: url('${ebGaramondItalicFontUrl}') format('woff2');
  }

  :host,
  .stage {
    color-scheme: light dark;
    --bg: light-dark(#ffffff, #18181a);
    --bg-warm: light-dark(#f6f7f7, #242427);
    --card-bg: light-dark(#ffffff, #242427);
    --ink: light-dark(#1e1e1e, #e8e8e8);
    --ink-soft: light-dark(#50575e, #a8acb0);
    --ink-faint: light-dark(#8c8f94, #6c7075);
    --accent: light-dark(#3858e9, #9eb3ff);
    --accent-on: light-dark(#ffffff, #1a1a1c);
    --accent-tint: light-dark(rgba(56, 88, 233, 0.05), rgba(158, 179, 255, 0.06));
    --accent-tint-strong: light-dark(rgba(56, 88, 233, 0.12), rgba(158, 179, 255, 0.18));
    --thread: light-dark(rgba(30, 30, 30, 0.08), rgba(232, 232, 232, 0.12));
    --shadow-sm: light-dark(rgba(31, 29, 26, 0.04), rgba(0, 0, 0, 0.3));
    --shadow-md: light-dark(rgba(31, 29, 26, 0.06), rgba(0, 0, 0, 0.4));
    --shadow-lg: light-dark(rgba(31, 29, 26, 0.12), rgba(0, 0, 0, 0.55));
    --shadow-xl: light-dark(rgba(30, 30, 30, 0.14), rgba(0, 0, 0, 0.6));
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
    font-family: 'Inter', system-ui, sans-serif;
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
      radial-gradient(ellipse at 30% 20%, var(--accent-tint), transparent 60%),
      radial-gradient(ellipse at 70% 80%, var(--accent-tint), transparent 60%);
    pointer-events: none;
    z-index: 0;
  }

  .headline {
    font-family: 'EB Garamond', serif;
    font-size: 40px;
    font-weight: 400;
    line-height: 1.05;
    letter-spacing: -0.015em;
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
    background: var(--card-bg);
    border: 1px solid var(--thread);
    border-radius: 14px;
    box-shadow: 0 1px 2px var(--shadow-sm), 0 8px 24px var(--shadow-md);
    overflow: hidden;
    /* rotate is intentionally absent from drift-in keyframes so this
       transition owns it and can override animation fill-mode on expand */
    transition:
      rotate     0.4s cubic-bezier(0.34, 1.56, 0.64, 1),
      width      0.3s cubic-bezier(0.4, 0, 0.2, 1),
      transform  0.3s ease,
      box-shadow 0.2s ease;
  }
  .card:hover { box-shadow: 0 1px 3px var(--shadow-md), 0 10px 30px var(--shadow-lg); }

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

  .card-toggle { display: none; position: absolute; }

  /* Journal */
  .entry-date { font-size: 10px; color: var(--ink-faint); letter-spacing: 0.04em; text-transform: uppercase; margin-bottom: 6px; }
  .entry-title { font-size: 13px; font-weight: 500; line-height: 1.3; color: var(--ink); margin-bottom: 8px; }
  .entry-body { font-size: 11.5px; line-height: 1.55; color: var(--ink-soft); }
  .entry-body .hl { background: var(--accent-tint-strong); padding: 0 3px; color: var(--ink); }

  /* Reading list */
  .reading-item {
    display: flex; gap: 8px; padding: 6px 0;
    border-bottom: 1px dashed var(--thread); font-size: 11px; line-height: 1.4;
  }
  .reading-item:last-child { border-bottom: none; }
  .reading-item .dot { color: var(--accent); font-size: 12px; line-height: 1; margin-top: 2px; }
  .reading-item .title { color: var(--ink); font-weight: 500; }
  .reading-item .meta { color: var(--ink-faint); font-size: 10px; margin-top: 2px; }

  /* Recipe */
  .recipe-name { font-size: 13px; font-weight: 600; color: var(--ink); margin-bottom: 2px; }
  .recipe-meta { font-size: 10px; color: var(--ink-faint); letter-spacing: 0.04em; text-transform: uppercase; margin-bottom: 10px; }
  .recipe-section {
    font-size: 10px; font-weight: 600; color: var(--ink-soft);
    letter-spacing: 0.06em; text-transform: uppercase; margin: 6px 0 3px;
  }
  .recipe-list { font-size: 11.5px; line-height: 1.6; color: var(--ink-soft); list-style: none; }
  .recipe-list li::before { content: '—'; color: var(--accent); margin-right: 6px; }

  /* Contacts */
  .contact-card { display: flex; gap: 10px; align-items: flex-start; padding: 6px 0; }
  .contact-avatar {
    width: 28px; height: 28px; border-radius: 50%; background: var(--bg-warm);
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 600; color: var(--ink-soft); flex-shrink: 0;
  }
  .contact-info { flex: 1; font-size: 11px; line-height: 1.4; }
  .contact-name { color: var(--ink); font-weight: 500; }
  .contact-note { color: var(--ink-faint); font-size: 10px; font-style: italic; }

  /* Site Tools habits */
  .habit-row { display: flex; align-items: center; gap: 8px; padding: 6px 0; font-size: 11.5px; }
  .habit-check { width: 16px; height: 16px; border: 1.5px solid light-dark(rgba(31,29,26,0.2), rgba(232,232,232,0.25)); border-radius: 4px; flex-shrink: 0; position: relative; }
  .habit-check.done { background: var(--accent); border-color: var(--accent); }
  .habit-check.done::after {
    content: '✓'; position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
    color: var(--accent-on); font-size: 10px; font-weight: 600;
  }
  .habit-label { color: var(--ink-soft); flex: 1; }
  .habit-label.done { color: var(--ink); text-decoration: line-through; text-decoration-color: var(--ink-faint); }
  .habit-streak { font-size: 10px; color: var(--ink-faint); }

  /* Boot progress: checkmarks fill in over time, regardless of expansion
     state, so opening the card late shows progress already made. Timings
     are a visual narrative, not real progress. */
  .boot-step .habit-check::after {
    content: '✓';
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
    color: var(--accent-on); font-size: 10px; font-weight: 600;
    opacity: 0;
  }
  .boot-step .habit-check {
    animation: boot-fill 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  }
  .boot-step .habit-check::after {
    animation: boot-mark 0.3s ease-out forwards;
  }
  .boot-step .habit-label {
    animation: boot-strike 0.3s ease-out forwards;
  }
  @keyframes boot-fill {
    to { background: var(--accent); border-color: var(--accent); }
  }
  @keyframes boot-mark { to { opacity: 1; } }
  @keyframes boot-strike {
    to {
      color: var(--ink);
      text-decoration: line-through;
      text-decoration-color: var(--ink-faint);
    }
  }
  .boot-step.bs1 .habit-check,
  .boot-step.bs1 .habit-check::after,
  .boot-step.bs1 .habit-label { animation-delay: 1s; }
  .boot-step.bs2 .habit-check,
  .boot-step.bs2 .habit-check::after,
  .boot-step.bs2 .habit-label { animation-delay: 3s; }
  .boot-step.bs3 .habit-check,
  .boot-step.bs3 .habit-check::after,
  .boot-step.bs3 .habit-label { animation-delay: 6s; }
  .boot-step.bs4 .habit-check,
  .boot-step.bs4 .habit-check::after,
  .boot-step.bs4 .habit-label { animation-delay: 9s; }
  .boot-step.bs5 .habit-check,
  .boot-step.bs5 .habit-check::after,
  .boot-step.bs5 .habit-label { animation-delay: 12s; }

  /* Backups wiki */
  .wiki-term { font-size: 15px; font-weight: 600; color: var(--ink); margin-bottom: 2px; }
  .wiki-pron { font-size: 10px; color: var(--ink-faint); font-style: italic; margin-bottom: 8px; }
  .wiki-def { font-size: 11.5px; line-height: 1.55; color: var(--ink-soft); }
  .wiki-def .num { font-weight: 600; color: var(--accent); margin-right: 4px; }

  /* Bookmark tiles */
  .bookmark { display: block; padding: 7px 9px; margin-bottom: 5px; border-radius: 6px; font-size: 11px; line-height: 1.4; background: var(--bg-warm); }
  .bookmark .bm-title { color: var(--ink); font-weight: 500; display: block; }
  .bookmark .bm-url { color: var(--accent); font-size: 9.5px; letter-spacing: 0.02em; }

  /* Your data tracks */
  .track { display: flex; align-items: center; gap: 8px; padding: 5px 0; font-size: 11px; }
  .track-num { font-size: 14px; font-weight: 600; color: var(--accent); width: 14px; flex-shrink: 0; }
  .track-info { flex: 1; line-height: 1.3; }
  .track-title { color: var(--ink); font-weight: 500; }
  .track-artist { color: var(--ink-faint); font-size: 10px; }

  @media (min-width: 640px) {
    .stage { padding: 48px 48px 32px; }
    .headline { font-size: 52px; }
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
	const [isBooting, setIsBooting] = useState(true);
	const [isBootReady, setIsBootReady] = useState(false);
	const [loadingInteracted, setLoadingInteracted] = useState(false);
	const [bootProgress, setBootProgress] = useState<ProgressDetails>(
		getInitialBootProgress
	);
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
	const runtimeConfigString = JSON.stringify(
		site?.metadata.runtimeConfiguration
	);
	const activeSiteError = useAppSelector(selectActiveSiteError);
	const activeSiteSlug = useAppSelector((state) => state.ui.activeSite?.slug);
	const hasActiveSiteError = activeSiteError && activeSiteSlug === siteSlug;

	const loadingScreenHtml = useMemo(
		() =>
			isReturningUser && !forceWelcome
				? getWhatsNewHtml()
				: getWelcomeHtml(),
		[forceWelcome, isReturningUser, siteSlug]
	);

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

	const setBlueprintInstallStatus = useCallback(
		(message: string | null) => {
			setInstallingBlueprint(message);
			dispatch(setBlueprintInstallMessage(message));
		},
		[dispatch]
	);

	const scheduleInstallBannerReset = useCallback(() => {
		clearInstallBannerResetTimeout();
		installBannerResetTimeoutRef.current = setTimeout(() => {
			installBannerResetTimeoutRef.current = null;
			setBlueprintInstallStatus(null);
		}, 3000);
	}, [clearInstallBannerResetTimeout, setBlueprintInstallStatus]);

	useEffect(() => {
		return clearInstallBannerResetTimeout;
	}, [clearInstallBannerResetTimeout]);

	useEffect(() => {
		return () => {
			dispatch(setBlueprintInstallMessage(null));
		};
	}, [dispatch]);

	useEffect(() => {
		setIsBooting(true);
		setIsBootReady(false);
		setLoadingInteracted(false);
		setBootProgress(getInitialBootProgress());
	}, [siteSlug, runtimeConfigString]);

	const handleBootProgress = useCallback((progress: ProgressDetails) => {
		setBootProgress(progress);
	}, []);

	const handleBootReady = useCallback(() => {
		setIsBootReady(true);
	}, []);

	const handleLoadingInteract = useCallback(() => {
		setLoadingInteracted(true);
	}, []);

	const showReadyButton = isBootReady && loadingInteracted;

	useEffect(() => {
		if (isBootReady && !loadingInteracted) {
			setIsBooting(false);
		}
	}, [isBootReady, loadingInteracted]);

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
				setBlueprintInstallStatus('Installing\u2026');
				const { blueprint, declaration } =
					await resolveBlueprintForInstallExecution(
						blueprintUrl,
						corsProxyUrl
					);
				const title = declaration.meta?.title || 'app';
				setBlueprintInstallStatus(`Installing ${title}\u2026`);

				const progress = new ProgressTracker();
				progress.addEventListener('progress', ((e: CustomEvent) => {
					const caption = e.detail?.caption;
					if (caption) {
						setBlueprintInstallStatus(caption);
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
					setBlueprintInstallStatus('Opening app\u2026');
					await playground.goTo(declaration.landingPage);
				}
				if (site?.metadata.storage !== 'none') {
					logPersonalWpEvent('blueprint_installed', {
						...getSiteUsageStatsProperties(site.metadata),
						trigger: options.usageStatsTrigger ?? 'app-request',
						...(options.usageStatsRequestSource
							? {
									request_source:
										options.usageStatsRequestSource,
								}
							: {}),
						...getBlueprintUsageStatsProperties(
							declaration,
							blueprintUrl,
							{
								requestSource: options.usageStatsRequestSource,
							}
						),
					});
				}
			} catch (e) {
				logger.error('Failed to apply blueprint:', e);
				setBlueprintInstallStatus('Installation failed');
				scheduleInstallBannerReset();
				return {
					status: 'error',
					error: getErrorMessage(e),
				};
			}
			setBlueprintInstallStatus('App installed');
			scheduleInstallBannerReset();
			return { status: 'success' };
		},
		[
			clearInstallBannerResetTimeout,
			playground,
			scheduleInstallBannerReset,
			setBlueprintInstallStatus,
			site,
		]
	);

	const applyBlueprintInMainTab = useCallback(
		async (
			blueprintUrl: string,
			options: ApplyBlueprintInMainTabOptions = {}
		): Promise<InstallBlueprintResult> => {
			clearInstallBannerResetTimeout();
			try {
				setBlueprintInstallStatus('Installing app\u2026');
				const install = await prepareBlueprintForRemoteInstall(
					blueprintUrl,
					corsProxyUrl
				);
				const result = await requestRemoteBlueprintInstall(
					siteSlug,
					install.blueprintUrl,
					{
						usageStatsRequestSource:
							options.usageStatsRequestSource,
					}
				);
				if (result.status === 'error') {
					setBlueprintInstallStatus('Installation failed');
					scheduleInstallBannerReset();
				} else {
					if (install.landingPage) {
						if (!playground) {
							setBlueprintInstallStatus('Installation failed');
							scheduleInstallBannerReset();
							return {
								status: 'error',
								error: 'The app was installed, but this tab could not open it.',
							};
						}
						setBlueprintInstallStatus('Opening app\u2026');
						await playground.goTo(install.landingPage);
					}
					setBlueprintInstallStatus('App installed');
					scheduleInstallBannerReset();
				}
				return result;
			} catch (e) {
				setBlueprintInstallStatus('Installation failed');
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
			setBlueprintInstallStatus,
			siteSlug,
		]
	);

	const installBlueprintFromUserAction = useCallback(
		async (blueprintUrl: string): Promise<InstallBlueprintResult> => {
			if (hasLocalRuntimeClient) {
				return applyBlueprint(blueprintUrl);
			}
			if (!isDependentMode) {
				return {
					status: 'error',
					error: 'Playground is not ready.',
				};
			}

			const status = await refreshMainTabStatus();
			if (status !== 'connected') {
				return {
					status: 'error',
					error: getMainTabUnavailableMessage(status),
				};
			}
			return applyBlueprintInMainTab(blueprintUrl);
		},
		[
			applyBlueprint,
			applyBlueprintInMainTab,
			hasLocalRuntimeClient,
			isDependentMode,
		]
	);

	useEffect(() => {
		if (!hasLocalRuntimeClient) {
			return;
		}
		setInstallBlueprintRequestCallback((blueprintUrl, options) =>
			applyBlueprint(blueprintUrl, {
				allowNavigation: false,
				usageStatsTrigger: 'dependent-tab-request',
				usageStatsRequestSource: options?.usageStatsRequestSource,
			})
		);
		void markMainTabReady();
		return () => {
			setInstallBlueprintRequestCallback(null);
		};
	}, [applyBlueprint, hasLocalRuntimeClient]);

	useEffect(() => {
		setUserBlueprintInstallCallback(installBlueprintFromUserAction);
		return () => {
			setUserBlueprintInstallCallback(null);
		};
	}, [installBlueprintFromUserAction]);

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
		const usageStatsRequestSource =
			getUsageStatsRequestSourceForInstallMessage(
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
				? await applyBlueprint(blueprintUrl, {
						usageStatsRequestSource,
					})
				: await applyBlueprintInMainTab(blueprintUrl, {
						usageStatsRequestSource,
					})),
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
				isLoading={isBooting}
				onBootProgress={handleBootProgress}
				onBootReady={handleBootReady}
			/>
			{isBooting && !hasActiveSiteError ? (
				<LoadingScreen
					html={loadingScreenHtml}
					progress={bootProgress}
					onInteract={handleLoadingInteract}
					showReadyButton={showReadyButton}
					onStart={() => setIsBooting(false)}
				/>
			) : null}
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

function getInitialBootProgress(): ProgressDetails {
	return {
		progress: 0,
		caption: 'Preparing WordPress',
	};
}

function LoadingScreen({
	html,
	progress,
	onInteract,
	showReadyButton,
	onStart,
}: {
	html: string;
	progress: ProgressDetails;
	onInteract: () => void;
	showReadyButton: boolean;
	onStart: () => void;
}) {
	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (event.key !== 'Enter' && event.key !== ' ') {
			return;
		}
		onInteract();
	};

	return (
		<div
			className={css.loadingScreen}
			tabIndex={0}
			onClick={onInteract}
			onKeyDown={handleKeyDown}
			onPointerDown={onInteract}
			onTouchStart={onInteract}
			onWheel={onInteract}
		>
			<LoadingScreenHtml html={html} />
			<LoadingProgress
				progress={progress}
				showReadyButton={showReadyButton}
				onStart={onStart}
			/>
		</div>
	);
}

const LoadingScreenHtml = memo(function LoadingScreenHtml({
	html,
}: {
	html: string;
}) {
	const hostRef = useRef<HTMLDivElement>(null);
	const renderedHtmlRef = useRef<string | null>(null);

	useEffect(() => {
		if (renderedHtmlRef.current === html) {
			return;
		}
		const host = hostRef.current;
		if (!host) {
			return;
		}
		const shadowRoot =
			host.shadowRoot ?? host.attachShadow({ mode: 'open' });
		shadowRoot.replaceChildren(...getSanitizedLoadingScreenNodes(html));
		renderedHtmlRef.current = html;
	}, [html]);

	return <div ref={hostRef} className={css.loadingScreenHtml} />;
});

function getSanitizedLoadingScreenNodes(html: string): Node[] {
	const doc = new DOMParser().parseFromString(html, 'text/html');
	doc.querySelectorAll('script, iframe, object, embed').forEach((node) => {
		node.remove();
	});
	doc.body.querySelectorAll('*').forEach((node) => {
		for (const attribute of Array.from(node.attributes)) {
			const name = attribute.name.toLowerCase();
			if (name.startsWith('on') || name === 'srcdoc') {
				node.removeAttribute(attribute.name);
			}
		}
	});
	return Array.from(doc.body.childNodes);
}

function LoadingProgress({
	progress,
	showReadyButton,
	onStart,
}: {
	progress: ProgressDetails;
	showReadyButton: boolean;
	onStart: () => void;
}) {
	const progressValue = Math.max(0, Math.min(100, progress.progress));

	return (
		<div
			className={css.loadingProgress}
			role="progressbar"
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={Math.round(progressValue)}
			aria-valuetext={progress.caption}
			aria-label="Loading WordPress"
		>
			{showReadyButton ? (
				<button className={css.loadingReadyButton} onClick={onStart}>
					WordPress is ready - click to start
				</button>
			) : (
				<>
					<div
						className={css.loadingProgressCaption}
						aria-live="polite"
					>
						{progress.caption}
					</div>
					<div className={css.loadingProgressTrack}>
						<div
							className={css.loadingProgressBar}
							style={{ width: `${progressValue}%` }}
						/>
					</div>
				</>
			)}
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
	usageStatsTrigger?: Exclude<BlueprintInstallUsageStatsTrigger, 'url'>;
	usageStatsRequestSource?: BlueprintInstallUsageStatsRequestSource;
};

type ApplyBlueprintInMainTabOptions = {
	usageStatsRequestSource?: BlueprintInstallUsageStatsRequestSource;
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

function getUsageStatsRequestSourceForInstallMessage(
	event: MessageEvent,
	iframe: HTMLIFrameElement | null,
	currentUrl: string | undefined
): BlueprintInstallUsageStatsRequestSource | undefined {
	for (const location of [
		getWindowLocation(event.source),
		getWindowLocation(iframe?.contentWindow),
		currentUrl,
	]) {
		const source = getTrustedBlueprintInstallSource(location);
		if (source) {
			return source;
		}
	}
	return undefined;
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
	isLoading = false,
	onBootProgress,
	onBootReady,
}: {
	siteSlug: string;
	iframeRef?: RefObject<HTMLIFrameElement>;
	isLoading?: boolean;
	onBootProgress?: (progress: ProgressDetails) => void;
	onBootReady?: () => void;
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
				onProgress: onBootProgress,
				onReady: onBootReady,
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
				className={classNames('playground-viewport', css.fullSize, {
					[css.viewportLoading]: isLoading,
				})}
				aria-hidden={isLoading}
				tabIndex={isLoading ? -1 : undefined}
				{...(isLoading ? { inert: '' } : {})}
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
