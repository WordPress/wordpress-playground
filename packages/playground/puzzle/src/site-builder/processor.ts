import { siteName, post } from './api';
import omnisend from './blueprints/omnisend.json';
import google from './blueprints/google.json';
import jetpack from './blueprints/jetpack.json';
import elementor from './blueprints/elementor.json';
import yith from './blueprints/yith.json';
import dynamicOoo from './blueprints/dynamic-ooo.json';
import personalizewp from './blueprints/personalizewp.json';
import jetformbuilder from './blueprints/jetformbuilder.json';
import fastspring from './blueprints/fastspring.json';
import cookiebot from './blueprints/cookiebot.json';
import w3TotalCache from './blueprints/w3-total-cache.json';
import siteground from './blueprints/siteground.json';
import yoast from './blueprints/yoast.json';

export type Action = {
	title: string;
};
// TODO enable the rest of the actions once the blueprints are fixed
export const actions: { [key: string]: Action } = {
	multisite: {
		title: 'Multisite',
	},
	'site name': {
		title: 'Site Name',
	},
	post: {
		title: 'Post',
	},
	'/wp-admin/': {
		title: '/wp-admin/',
	},
	omnisend: {
		title: 'Omnisend',
	},
	google: {
		title: 'Google',
	},
	jetpack: {
		title: 'Jetpack',
	},
	elementor: {
		title: 'Elementor',
	},
	yith: {
		title: 'YITH',
	},
	'dynamic.ooo': {
		title: 'Dynamic.ooo',
	},
	personalizewp: {
		title: 'PersonalizeWP',
	},
	jetformbuilder: {
		title: 'JetFormBuilder',
	},
	fastspring: {
		title: 'Fastspring',
	},
	cookiebot: {
		title: 'Cookiebot',
	},
	'w3 total cache': {
		title: 'W3 Total Cache',
	},
	siteground: {
		title: 'SiteGround',
	},
	yoast: {
		title: 'Yoast',
	},
};

const actionBlueprints = {
	omnisend,
	google,
	jetpack,
	elementor,
	yith,
	'dynamic.ooo': dynamicOoo,
	personalizewp,
	jetformbuilder,
	fastspring,
	cookiebot,
	'w3 total cache': w3TotalCache,
	siteground,
	yoast,
};

export const getActions = (titles: string[]) => {
	return titles
		.map((item) => {
			item = item.toLowerCase();
			return Object.keys(actions).find((key) => item.includes(key));
		})
		.filter((item) => item !== undefined);
};

export const processImage = async (actions: string[]) => {
	if (actions === undefined || actions.length === 0) {
		throw new Error(
			'No puzzle pieces found. Please ensure the text is clear and try again.'
		);
	}

	const blueprint: any = (actions as string[]).reduce(
		(acc, action: string) =>
			mergeBlueprints([
				acc,
				actionBlueprints[action as keyof typeof actionBlueprints],
			]),
		{}
	);
	if (actions.includes('/wp-admin/')) {
		blueprint['landingPage'] = '/wp-admin/';
	}

	if (actions.includes('multisite')) {
		blueprint.steps = [
			{
				step: 'enableMultisite',
			},
			...blueprint.steps,
		];
		blueprint['landingPage'] = '/wp-admin/network/';
	}

	if (actions.includes('site name')) {
		blueprint.steps = [
			{
				step: 'setSiteOptions',
				options: {
					blogname: await siteName(),
				},
			},
			...blueprint.steps,
		];
	}

	if (actions.includes('post')) {
		const data = await post();
		blueprint.steps = [
			{
				step: 'runPHP',
				// $insert_post='${data.slug}'; is a hack to allow us to find this step and extract the slug
				code: `<?php require_once 'wordpress/wp-load.php'; wp_insert_post(array('post_title' => '${data.title}', 'post_content' => '${data.content}', 'post_slug' => '${data.slug}', 'post_status' => 'publish')); ?>`,
			},
			...blueprint.steps,
		];
		// override the landing page to open the post
		blueprint.landingPage = `/${data.slug}`;
	}

	// Add default steps
	blueprint.steps = [
		{
			step: 'login',
		},
		{
			step: 'writeFile',
			path: '/wordpress/wp-content/mu-plugins/rewrite.php',
			data: "<?php add_action( 'after_setup_theme', function() { global $wp_rewrite; $wp_rewrite->set_permalink_structure('/%postname%/'); $wp_rewrite->flush_rules(); } );",
		},
		{
			step: 'writeFile',
			path: '/wordpress/wp-content/mu-plugins/disable-elementor-onboarding.php',
			data: "<?php add_action( 'activate_plugin', function() { update_option('elementor_onboarded', true); } );",
		},
		{
			step: 'writeFile',
			path: '/wordpress/wp-content/mu-plugins/disable-yoast-onboarding.php',
			data: "<?php add_action( 'wpseo_activate', function() { $option_array = get_option('wpseo'); if ( $option_array && is_array( $option_array ) ) { $option_array['should_redirect_after_install_free'] = false; update_option( 'wpseo', $option_array ); } }, 1000 );",
		},
		...blueprint.steps,
	];
	return blueprint;
};

const excludedSteps = ['login'];

const mergeBlueprints = (blueprints: any[]) => {
	const newBlueprint: any = {
		phpExtensionBundles: ['kitchen-sink'],
		features: {
			networking: true,
		},
		steps: [],
	};

	const landingPages: string[] = [];
	let pluginsInstalled = 0;
	let themeInstalled = false;
	for (const blueprint of blueprints) {
		if (!blueprint) {
			continue;
		}
		if (blueprint.landingPage) {
			landingPages.push(blueprint.landingPage);
		}
		if (!blueprint.steps) {
			continue;
		}
		newBlueprint.steps = [
			...newBlueprint.steps,
			...blueprint.steps.filter(
				(step: any) => !excludedSteps.includes(step.step)
			),
		];

		pluginsInstalled += blueprint.steps.filter(
			(step: any) => step.step === 'installPlugin'
		).length;

		if (
			themeInstalled === false &&
			blueprint.steps.find((step: any) => step.step === 'installTheme')
		) {
			themeInstalled = true;
		}
	}

	// If multiple plugins are installed, go to the plugins list
	if (pluginsInstalled > 1) {
		newBlueprint.landingPage = '/wp-admin/plugins.php';
	}
	// If one landing page is defined, use it
	else if (themeInstalled) {
		newBlueprint.landingPage = '/';
	}
	// If multiple landing pages are defined, go to the first one
	else if (landingPages.length === 1) {
		newBlueprint.landingPage = landingPages[0];
	} else {
		newBlueprint.landingPage = '/';
	}

	return newBlueprint;
};
