import css from './style.module.css';
import {
	Button,
	Flex,
	FlexItem,
	__experimentalText as Text,
	__experimentalVStack as VStack,
	__experimentalHStack as HStack,
	Icon,
} from '@wordpress/components';
import { chevronLeft } from '@wordpress/icons';
import { DataViews } from '@wordpress/dataviews';
import type { Field, View } from '@wordpress/dataviews';
import classNames from 'classnames';
import { useState } from 'react';
import {
	selectArchivedSites,
	restoreSite,
} from '../../../lib/state/redux/slice-sites';
import { useAppDispatch, useAppSelector } from '../../../lib/state/redux/store';
import { setSiteManagerSection } from '../../../lib/state/redux/slice-ui';

type ArchivedSiteEntry = {
	name: string;
	slug: string;
	createdAt: string;
};

export function ArchivedSitesPanel({
	className,
	mobileUi,
}: {
	className?: string;
	mobileUi?: boolean;
}) {
	const [view, setView] = useState<View>({
		type: 'list',
		fields: ['header', 'description'],
	});

	const archivedSites = useAppSelector(selectArchivedSites);
	const dispatch = useAppDispatch();

	function onBackButtonClick() {
		dispatch(setSiteManagerSection('site-details'));
	}

	let indexEntries: ArchivedSiteEntry[] = archivedSites
		? archivedSites.map((site) => ({
				name: site.metadata.name,
				slug: site.slug,
				createdAt: site.metadata.whenCreated
					? new Date(site.metadata.whenCreated).toLocaleString(
							undefined,
							{
								dateStyle: 'short',
								timeStyle: 'short',
							}
					  )
					: '',
		  }))
		: [];

	if (view.search) {
		indexEntries = indexEntries.filter((entry) => {
			return [entry.name]
				.join(' ')
				.toLocaleLowerCase()
				.includes(view.search!.toLocaleLowerCase());
		});
	}

	const fields: Field<ArchivedSiteEntry>[] = [
		{
			id: 'header',
			label: 'Name',
			enableHiding: false,
			render: ({ item }: { item: ArchivedSiteEntry }) => {
				return (
					<HStack spacing={2} justify="space-between">
						<VStack spacing={0} style={{ flexGrow: 1 }}>
							<h3 className={css.archivedSiteTitle}>
								{item.name}
							</h3>
						</VStack>
						<Button variant="primary">Restore</Button>
					</HStack>
				);
			},
		},
		{
			id: 'description',
			label: 'Description',
			render: ({ item }: { item: ArchivedSiteEntry }) => {
				return <Text>{item.createdAt}</Text>;
			},
		},
	];

	return (
		<section
			className={classNames(className, css.archivedSitesPanel, {
				[css.isMobile]: mobileUi,
			})}
		>
			<Flex
				gap={0}
				direction="column"
				justify="flex-start"
				expanded={true}
			>
				<FlexItem
					className={css.padded}
					style={{ flexShrink: 0, paddingBottom: 0 }}
				>
					<Button
						variant="link"
						className={css.grayLinkDark}
						onClick={onBackButtonClick}
					>
						<Flex justify="flex-start" gap={2}>
							<FlexItem>
								<Icon icon={chevronLeft} size={38} />
							</FlexItem>
							<FlexItem>
								<h2 className={css.sectionTitle}>
									Archived Playgrounds
								</h2>
							</FlexItem>
						</Flex>
					</Button>
				</FlexItem>
				<FlexItem style={{ alignSelf: 'stretch', overflowY: 'scroll' }}>
					<div className={css.padded} style={{ paddingTop: 0 }}>
						<DataViews<ArchivedSiteEntry>
							data={indexEntries}
							view={view}
							onChangeView={setView}
							onChangeSelection={(newSelection: string[]) => {
								if (newSelection?.length) {
									dispatch(restoreSite(newSelection[0]));
								}
							}}
							search={true}
							fields={fields}
							header={null}
							getItemId={(item: ArchivedSiteEntry) => item?.slug}
							paginationInfo={{
								totalItems: indexEntries.length,
								totalPages: 1,
							}}
							defaultLayouts={{
								list: {},
							}}
						/>
					</div>
				</FlexItem>
			</Flex>
		</section>
	);
}
