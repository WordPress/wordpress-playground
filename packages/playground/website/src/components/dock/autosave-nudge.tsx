import { useEffect, useRef, useState } from 'react';
import { Button, Icon, Popover } from '@wordpress/components';
import { close, wordpress } from '@wordpress/icons';
import { logger } from '@php-wasm/logger';
import {
	getActiveClientInfo,
	useAppDispatch,
	useAppSelector,
} from '../../lib/state/redux/store';
import { selectSiteBySlug } from '../../lib/state/redux/slice-sites';
import {
	addDeclinedAutosaveRestoreFingerprint,
	closeAutosaveNudgePanel,
	dismissAutosaveNudge,
	setAutosaveNudgeMuted,
} from '../../lib/state/redux/slice-ui';
import { useSitesAPI } from '../../lib/state/redux/site-management-api-middleware';
import { writeAutosaveNudgeMuted } from '../../lib/autosave-nudge-muted';
import { getRelativeDate } from '../../lib/get-relative-date';
import css from './autosave-nudge.module.css';

/**
 * The restore-a-recent-autosave panel. When Playground starts fresh from a setup
 * URL but a recent autosave of the same Playground exists, this auto-opens once
 * as a Popover anchored to the dock's Playgrounds tool (the home for recovery),
 * pointing at one clear action — Restore — with honest wording about what an
 * autosave is. A quiet link mutes the proactive cues (this panel + the dot)
 * without disabling the safety net: autosaves stay restorable from Your
 * Playgrounds. The dot on the Playgrounds tool persists after this panel
 * closes, and clears when the user visits Your Playgrounds — seeing the list
 * is acknowledging the cue (see the dock's openSection).
 */
export function AutosaveNudge({ anchor }: { anchor: HTMLElement | null }) {
	const dispatch = useAppDispatch();
	const sitesAPI = useSitesAPI();
	const nudge = useAppSelector((state) => state.ui.autosaveNudge);
	const panelOpen = useAppSelector(
		(state) => state.ui.autosaveNudgePanelOpen
	);
	// Hold the panel back until the freshly-started Playground has actually booted
	// (its client registers). Popping a "restore a different Playground" panel
	// while the loading screen is still teaching the new name splits attention
	// between two Playgrounds at once. So show only the loading card first, and
	// open this once the Playground is ready — the dot on the Playgrounds tool
	// still signals that a restore is available in the meantime.
	const activeClientReady = useAppSelector(
		(state) => !!getActiveClientInfo(state)
	);
	const panelReady = panelOpen && activeClientReady;
	const muted = useAppSelector((state) => state.ui.autosaveNudgeMuted);
	// Whether the current Playground failed to start (e.g. a download/boot error).
	const activeSiteError = useAppSelector(
		(state) => state.ui.activeSite?.error
	);
	const nudgeSite = useAppSelector((state) =>
		nudge ? selectSiteBySlug(state, nudge.siteSlug) : undefined
	);
	const [isRestoring, setIsRestoring] = useState(false);
	const [error, setError] = useState<string>();
	const panelRef = useRef<HTMLDivElement>(null);
	// Where the caret (the panel's tail) sits, in px from the panel's left
	// edge. Measured rather than centered: the shifted popover rarely centers
	// on the Playgrounds tool the tail points at.
	const [caretLeft, setCaretLeft] = useState<number | null>(null);

	useEffect(() => {
		if (muted || !nudge || !panelReady || !anchor || activeSiteError) {
			return;
		}
		// Track every frame while the panel is open: the dock re-centers as its
		// width settles (e.g. the save status swapping "Loading…" for longer
		// text) and the popover follows the anchor asynchronously, so any
		// one-shot measurement goes stale. Two rect reads per frame on a
		// short-lived panel is cheap; setState bails when the value is stable.
		//
		// Geometry note: every rect on the popover wears its entrance animation
		// (the root scales in from the anchor), so measuring rects mid-flight
		// would drag the caret along the edge. But the popover engine writes
		// its FINAL position into the root's inline transform — composed with
		// the entrance as e.g. `translateX(299px) translateY(504px)
		// translateY(2em) scale(0)` — so the translateX component is the
		// settled left from the very first frame. Parse that, and the caret
		// sits in its final panel-local spot immediately, riding the entrance
		// scale like any other child. Rects are only the fallback.
		let raf = 0;
		const measure = () => {
			const panel = panelRef.current;
			if (panel) {
				const root =
					(panel.closest('.components-popover') as HTMLElement) ??
					panel;
				const finalX = /translate(?:X|3d)?\(\s*(-?[\d.]+)px/.exec(
					root.style.transform || ''
				);
				let panelLeft = finalX
					? parseFloat(finalX[1])
					: root.getBoundingClientRect().left;
				for (
					let el: HTMLElement | null = panel;
					el && el !== root;
					el = el.offsetParent as HTMLElement | null
				) {
					panelLeft += el.offsetLeft;
				}
				const anchorRect = anchor.getBoundingClientRect();
				// Aim at the Playgrounds tool's center (the dot is its badge,
				// not the target), clamped clear of the panel's rounded
				// corners.
				const anchorCenterX = anchorRect.left + anchorRect.width / 2;
				const next =
					Math.round(
						Math.min(
							Math.max(anchorCenterX - panelLeft, 18),
							panel.offsetWidth - 18
						) * 2
					) / 2;
				setCaretLeft(next);
			}
			raf = window.requestAnimationFrame(measure);
		};
		raf = window.requestAnimationFrame(measure);
		return () => window.cancelAnimationFrame(raf);
	}, [muted, nudge, panelReady, anchor, activeSiteError]);

	// Once-per-prompt guard so the dismiss paths that can fire together (the ✕, the
	// click-away listener, and the Popover's own onClose) don't autosave the
	// current session more than once.
	const keptFingerprintRef = useRef<string | null>(null);

	// Keep the current fresh session safe before the user steps away from the
	// prompt: autosave it in place (no reboot) while protecting the older autosave
	// from pruning so it stays restorable.
	const keepCurrentSession = async () => {
		if (
			!nudge ||
			keptFingerprintRef.current === nudge.setupUrlFingerprint
		) {
			return;
		}
		keptFingerprintRef.current = nudge.setupUrlFingerprint;
		try {
			await sitesAPI.autosaveTemporarySite(undefined, {
				updateUrl: false,
				excludeFromPruning: [nudge.siteSlug],
			});
			dispatch(
				addDeclinedAutosaveRestoreFingerprint(nudge.setupUrlFingerprint)
			);
		} catch (restoreError) {
			keptFingerprintRef.current = null;
			logger.error(
				'Error autosaving the current Playground.',
				restoreError
			);
		}
	};

	// Dismissing the prompt — by the ✕, a click away, Escape, or losing focus to
	// the preview — all mean "keep what I'm working on": autosave the current
	// session in place, then hide the panel. The dot stays, so restoring the older
	// autosave is still one click away from Your Playgrounds.
	const dismiss = () => {
		void keepCurrentSession();
		dispatch(closeAutosaveNudgePanel());
	};
	// Hold the latest dismiss so the click-away effect can call it without
	// re-subscribing its listeners on every render.
	const dismissRef = useRef(dismiss);
	dismissRef.current = dismiss;

	// Dismiss on a click outside the panel. A document listener covers the dock
	// and surrounding chrome; a window-blur check covers clicks landing in the
	// WordPress preview iframe (whose clicks never reach the parent document).
	// The blur check is armed after a short delay so a focus shuffle during boot
	// doesn't close the panel the moment it opens.
	useEffect(() => {
		if (muted || !nudge || !panelReady || !anchor || activeSiteError) {
			return;
		}
		let blurArmed = false;
		const armTimer = window.setTimeout(() => {
			blurArmed = true;
		}, 300);
		const onPointerDown = (event: MouseEvent) => {
			const target = event.target;
			if (
				panelRef.current &&
				target instanceof Node &&
				!panelRef.current.contains(target)
			) {
				dismissRef.current();
			}
		};
		const onWindowBlur = () => {
			if (!blurArmed) {
				return;
			}
			window.setTimeout(() => {
				if (document.activeElement instanceof HTMLIFrameElement) {
					dismissRef.current();
				}
			}, 0);
		};
		document.addEventListener('mousedown', onPointerDown, true);
		window.addEventListener('blur', onWindowBlur);
		return () => {
			window.clearTimeout(armTimer);
			document.removeEventListener('mousedown', onPointerDown, true);
			window.removeEventListener('blur', onWindowBlur);
		};
	}, [muted, nudge, panelReady, anchor, activeSiteError]);

	// Don't offer to restore an autosave while the current Playground is in an
	// error state: the prompt is moot, and its buttons would sit behind the
	// start-error modal (so "Restore"/dismiss wouldn't even be clickable). Clear
	// it entirely — including the dock dot — so no autosave cue shows on an error.
	useEffect(() => {
		if (activeSiteError && nudge) {
			dispatch(dismissAutosaveNudge());
		}
	}, [activeSiteError, nudge, dispatch]);

	if (muted || !nudge || !panelReady || !anchor || activeSiteError) {
		return null;
	}

	const siteName = nudgeSite?.metadata.name || 'Your last session';
	const createdAt = new Date(nudge.whenCreated ?? Date.now());

	const handleRestore = async () => {
		setError(undefined);
		setIsRestoring(true);
		try {
			await sitesAPI.setActiveSite(nudge.siteSlug);
			dispatch(dismissAutosaveNudge());
		} catch (restoreError) {
			logger.error('Error restoring autosaved Playground.', restoreError);
			setError(
				'Could not restore the autosave. Open Your Playgrounds to try again.'
			);
		} finally {
			setIsRestoring(false);
		}
	};

	const handleMute = () => {
		void keepCurrentSession();
		writeAutosaveNudgeMuted(true);
		dispatch(setAutosaveNudgeMuted(true));
		dispatch(dismissAutosaveNudge());
	};

	return (
		<Popover
			anchor={anchor}
			placement="top-start"
			offset={12}
			// Open to the side of the Playgrounds tool instead of centered above
			// it, so the prompt points at its source without covering the main
			// content directly above the dock. Shift keeps it on-screen when the
			// tool sits near the left edge on mobile.
			shift
			focusOnMount={false}
			className={css.popover}
			onClose={dismiss}
		>
			<div
				className={css.panel}
				ref={panelRef}
				aria-label="Recent autosave"
			>
				<button
					type="button"
					className={css.close}
					aria-label="Dismiss recent autosave"
					onClick={dismiss}
				>
					<Icon icon={close} size={18} />
				</button>
				<p className={css.title}>Recent autosave</p>
				<div className={css.card}>
					<span className={css.icon} aria-hidden="true">
						<Icon icon={wordpress} size={26} />
					</span>
					<div className={css.cardBody}>
						<div className={css.name} title={siteName}>
							{siteName}
						</div>
						<div className={css.meta}>
							Autosaved {getRelativeDate(createdAt)}
						</div>
					</div>
				</div>
				<Button
					variant="primary"
					className={css.restore}
					onClick={handleRestore}
					disabled={isRestoring}
				>
					{isRestoring ? 'Restoring…' : 'Restore autosave'}
				</Button>
				{error && (
					<p className={css.error} role="alert">
						{error}
					</p>
				)}
				<p className={css.fine}>
					Kept in this browser as a periodic snapshot — not every
					change is saved.
				</p>
				<div className={css.foot}>
					<button
						type="button"
						className={css.link}
						onClick={handleMute}
					>
						Don’t notify me about autosaves
					</button>
				</div>
				<span
					className={css.caret}
					style={
						caretLeft === null
							? { opacity: 0 }
							: { left: `${caretLeft}px`, opacity: 1 }
					}
					aria-hidden="true"
				/>
			</div>
		</Popover>
	);
}
