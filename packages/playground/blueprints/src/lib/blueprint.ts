import {
	SupportedPHPExtensionBundle,
	SupportedPHPVersion,
} from '@php-wasm/universal';
import { StepDefinition } from './steps';
import { FileReference } from './resources';

export interface Blueprint {
	/**
	 * The URL to navigate to after the blueprint has been run.
	 */
	landingPage?: string;
	/**
	 * Optional description. It doesn't do anything but is exposed as
	 * a courtesy to developers who may want to document which blueprint
	 * file does what.
	 *
	 * @deprecated Use meta.description instead.
	 */
	description?: string;
	/**
	 * Optional metadata. Used by the Blueprints gallery at https://github.com/WordPress/blueprints
	 */
	meta?: {
		/**
		 * A clear and concise name for your Blueprint.
		 */
		title: string;
		/**
		 * A brief explanation of what your Blueprint offers.
		 */
		description?: string;
		/**
		 * A GitHub username of the author of this Blueprint.
		 */
		author: string;
		/**
		 * Relevant categories to help users find your Blueprint in the future Blueprints section on WordPress.org.
		 */
		categories?: string[];
	};
	/**
	 * The preferred PHP and WordPress versions to use.
	 */
	preferredVersions?: {
		/**
		 * The preferred PHP version to use.
		 * If not specified, the latest supported version will be used
		 */
		php: SupportedPHPVersion | 'latest';
		/**
		 * The preferred WordPress version to use.
		 * If not specified, the latest supported version will be used
		 */
		wp: string | 'latest';
	};
	features?: {
		/** Should boot with support for network request via wp_safe_remote_get? */
		networking?: boolean;
	};

	/**
	 * PHP Constants to define on every request
	 * @deprecated This experimental option will change without warning.
	 *             Use `steps` instead.
	 */
	constants?: Record<string, string>;

	/**
	 * WordPress plugins to install and activate
	 * @deprecated This experimental option will change without warning.
	 *             Use `steps` instead.
	 */
	plugins?: Array<string | FileReference>;

	/**
	 * WordPress site options to define
	 * @deprecated This experimental option will change without warning.
	 *             Use `steps` instead.
	 */
	siteOptions?: Record<string, string> & {
		/** The site title */
		blogname?: string;
	};

	/**
	 * User to log in as.
	 * If true, logs the user in as admin/password.
	 */
	login?:
		| boolean
		| {
				username: string;
				password: string;
		  };

	/**
	 * The PHP extensions to use.
	 */
	phpExtensionBundles?: SupportedPHPExtensionBundle[];
	/**
	 * The steps to run after every other operation in this Blueprint was
	 * executed.
	 */
	steps?: Array<StepDefinition | string | undefined | false | null>;
}
