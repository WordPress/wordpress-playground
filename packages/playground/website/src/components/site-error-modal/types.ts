import type {
	SiteError,
	SerializedSiteErrorDetails,
} from '../../lib/state/redux/slice-ui';
import type { SiteInfo } from '../../lib/state/redux/slice-sites';

export type BlueprintStepError = {
	stepNumber: number;
	step: Record<string, unknown>;
	stepJson: string;
	description: string;
	messages: string[];
	rawMessage: string;
};

export type PresentationHelpers = {
	deleteSite: () => void;
	restartWithoutPr: () => void;
	startWithoutBlueprint: () => Promise<void> | void;
	reload: () => void;
	startWithoutBlueprintBusy: boolean;
};

export interface SiteErrorModalProps {
	error: SiteError;
	siteSlug: string;
	site: SiteInfo;
	errorDetails?: SerializedSiteErrorDetails;
}
