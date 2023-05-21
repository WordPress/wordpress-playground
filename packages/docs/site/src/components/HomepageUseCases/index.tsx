import React from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';
import Link from '@docusaurus/Link';

type UseCaseItem = {
	title: string;
	href: string;
	Svg: React.ComponentType<React.ComponentProps<'svg'>>;
	description: JSX.Element;
};

const UseCaseList: UseCaseItem[] = [
	{
		title: 'Try Plugins and Blocks',
		href: '/docs/getting-started/how-to-do-X',
		Svg: require('@site/static/img/undraw_docusaurus_react.svg').default,
		description: (
			<>
				No need to install anything on your site – just load it in
				Playground.
			</>
		),
	},
	{
		title: 'Build Themes',
		href: '/docs/getting-started/how-to-do-X',
		Svg: require('@site/static/img/undraw_docusaurus_react.svg').default,
		description: <>Go directly to the site editor. No setup involved.</>,
	},
	{
		title: 'Live Product Demos',
		href: '/docs/getting-started/how-to-do-X',
		Svg: require('@site/static/img/undraw_docusaurus_mountain.svg').default,
		description: (
			<>Embed a live version of your plugin or theme on your site.</>
		),
	},
	{
		title: 'Test Pull Requests',
		href: '/docs/getting-started/how-to-do-X',
		Svg: require('@site/static/img/undraw_docusaurus_tree.svg').default,
		description: (
			<>
				Integrate your repo and enjoy single-click testing without a
				staging environment.
			</>
		),
	},
	{
		title: 'Test against multiple WP and PHP Versions',
		href: '/docs/getting-started/how-to-do-X',
		Svg: require('@site/static/img/undraw_docusaurus_tree.svg').default,
		description: <>Switch between versions with a click.</>,
	},
	{
		title: 'Develop Plugins',
		href: '/docs/getting-started/how-to-do-X',
		Svg: require('@site/static/img/undraw_docusaurus_react.svg').default,
		description: (
			<>
				Local development environments via a VS Code extension or a CLI
				tool.
			</>
		),
	},
	{
		title: 'Build Entire Apps',
		href: '/docs/getting-started/how-to-do-X',
		Svg: require('@site/static/img/undraw_docusaurus_react.svg').default,
		description: (
			<>
				Write a JSON Blueprint describing your WordPress app. Share a
				link. Done.
			</>
		),
	},
];

function UseCase({ title, Svg, description, href }: UseCaseItem) {
	return (
		<Link to={href} className={clsx('col col--4 homepage-link-tile')}>
			<div className="text--center">
				<Svg className={styles.useCaseSvg} role="img" />
			</div>
			<div className="text--center padding-horiz--md">
				<h3>{title}</h3>
				<p>{description}</p>
			</div>
		</Link>
	);
}

export default function HomepageUseCases(): JSX.Element {
	return (
		<section className={styles.useCases}>
			<div className="container margin-vert--lg">
				<div className="row margin-vert--lg">
					<h2 className="content-title">Versatile</h2>
				</div>
				<div className="row margin-vert--lg row--align-center">
					<div className="col col--8 col--offset-2">
						<p className="content-sub-title">
							Playground makes all kinds of difficult tasks easy.
							Leverage the unique zero-setup architecture and get
							things done faster.
						</p>
					</div>
				</div>
				<div className="row row--justify-center">
					{UseCaseList.map((props, idx) => (
						<UseCase key={idx} {...props} />
					))}
				</div>
			</div>
		</section>
	);
}
