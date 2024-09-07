import type { SupportedPHPVersion } from '@php-wasm/universal';
import { SupportedPHPVersionsList } from '@php-wasm/universal';
import css from './style.module.css';
import { Button, SelectControl } from '@wordpress/components';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import classNames from 'classnames';
import {
	__experimentalInputControl as InputControl,
	__experimentalVStack as VStack,
	__experimentalHStack as HStack,
} from '@wordpress/components';
import { randomSiteName } from '../../../lib/site-storage';
import { useSupportedWordPressVersions } from './use-supported-wordpress-versions';

export interface AddSiteFormProps {
	onSubmit: (data: any) => void;
}

export interface AddSiteFormData {
	name: string;
	phpVersion: SupportedPHPVersion;
	wpVersion: string;
	// language: string;
}

export default function AddSiteForm({ onSubmit }: AddSiteFormProps) {
	const {
		handleSubmit,
		setValue,
		control,
		formState: { errors },
	} = useForm<AddSiteFormData>();

	// the defaultValues option seems broken, so we set the values manually
	useEffect(() => {
		setValue('name', randomSiteName());
		setValue('phpVersion', '8.0');
	}, [setValue]);

	const { supportedWPVersions, latestWPVersion } =
		useSupportedWordPressVersions();
	useEffect(() => {
		if (latestWPVersion) {
			setValue('wpVersion', latestWPVersion);
		}
	}, [latestWPVersion, setValue]);

	return (
		<form onSubmit={handleSubmit(onSubmit)}>
			<VStack spacing={4}>
				<VStack>
					<Controller
						control={control}
						name="name"
						rules={{
							required: {
								message: 'Site name is required',
								value: true,
							},
							maxLength: {
								message: 'Site name is too long',
								value: 80,
							},
						}}
						render={({ field: { onChange, ...rest } }) => (
							<InputControl
								label="Site name"
								placeholder="Site name"
								help={errors.name?.message}
								className={classNames(css.addSiteInput, {
									[css.invalidInput]: !!errors.name,
								})}
								autoFocus={true}
								data-1p-ignore
								onChange={(value, { event }) => {
									onChange(event);
								}}
								{...rest}
							/>
						)}
					/>
				</VStack>
				<HStack justify="space-between">
					<Controller
						control={control}
						name="wpVersion"
						rules={{
							required: {
								message: 'WordPress Version is required',
								value: true,
							},
						}}
						render={({ field: { onChange, ...rest } }) => (
							<SelectControl
								label="WordPress Version"
								help={errors.wpVersion?.message}
								className={classNames(css.addSiteInput, {
									[css.invalidInput]: !!errors.wpVersion,
								})}
								autoFocus={true}
								options={
									/*
									 * Without an empty option, React sometimes says
									 * the current selected version is "nightly" when
									 * `wp` is actually "6.4".
									 */
									[
										{
											label: '-- Select a version --',
											value: '',
										},
										...Object.keys(
											supportedWPVersions || {}
										).map((version) => ({
											label: `WordPress ${supportedWPVersions[version]}`,
											value: version,
										})),
									]
								}
								onChange={(value, extra) => {
									onChange(extra?.event);
								}}
								{...rest}
							/>
						)}
					/>
					<Controller
						control={control}
						name="phpVersion"
						rules={{
							required: {
								message: 'PHP Version is required',
								value: true,
							},
						}}
						render={({ field: { onChange, ...rest } }) => (
							<SelectControl
								label="PHP Version"
								help={errors.phpVersion?.message}
								className={classNames(css.addSiteInput, {
									[css.invalidInput]: !!errors.phpVersion,
								})}
								autoFocus={true}
								options={SupportedPHPVersionsList.map(
									(version) => ({
										label: `PHP ${version}`,
										value: version,
									})
								)}
								onChange={(value, extra) => {
									onChange(extra?.event);
								}}
								{...rest}
							/>
						)}
					/>
				</HStack>
				{/* @TODO: Discuss exposing storage type in the site creation form is a good idea.
						The "Local FS" option will require a complex interaction involving a directory picker.
				*/}
				{/* <VStack>
					<RadioControl
						label="Storage type"
						options={[
							{ label: 'None', value: 'none' },
							{ label: 'Browser', value: 'browser' },
							{ label: 'Local FS', value: 'local-fs' },
						]}
						{...register('storage', {
							required: {
								message: 'Storage type is required',
								value: true,
							},
						})}
					/>
					{'not-available' === onSelectLocalDirectory && (
						<span>
							<br />
							Not supported in this browser.
						</span>
					)}
					{'origin-mismatch' === onSelectLocalDirectory && (
						<span>
							<br />
							Not supported on this site.
						</span>
					)}
				</VStack> */}

				<div>
					<Button type="submit" variant="primary">
						Create site
					</Button>
				</div>
			</VStack>
		</form>
	);
}

// function useIsSameOriginAsPlayground(playground?: PlaygroundClient) {
// 	const [isSameOriginAsPlayground, setIsSameOriginAsPlayground] = useState<
// 		null | boolean
// 	>(null);

// 	useEffect(() => {
// 		if (!playground) return;
// 		(async () => {
// 			setIsSameOriginAsPlayground(
// 				new URL(await playground.absoluteUrl).origin ===
// 					window.location.origin
// 			);
// 		})();
// 	}, [playground]);

// 	return isSameOriginAsPlayground;
// }
