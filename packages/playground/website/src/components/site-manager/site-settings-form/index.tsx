import type { SupportedPHPVersion } from '@php-wasm/universal';
import { SupportedPHPVersionsList } from '@php-wasm/universal';
import css from './style.module.css';
import { Button, CheckboxControl, SelectControl } from '@wordpress/components';
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

export interface SiteSettingsFormProps {
	onSubmit: (data: any) => void;
	formFields?: Partial<Record<keyof SiteFormData, boolean>>;
	submitButtonText?: string;
	defaultValues?: Partial<SiteFormData>;
}

export interface SiteFormData {
	name: string;
	phpVersion: SupportedPHPVersion;
	wpVersion: string;
	// @TODO:
	language: string;
	withExtensions: boolean;
	withNetworking: boolean;
}

export default function SiteSettingsForm({
	onSubmit,
	submitButtonText,
	defaultValues = {},
	formFields = {
		name: true,
		phpVersion: true,
		wpVersion: true,
		language: true,
		withExtensions: true,
		withNetworking: true,
	},
}: SiteSettingsFormProps) {
	defaultValues = {
		name: randomSiteName(),
		phpVersion: '8.0',
		wpVersion: 'latest',
		language: '',
		withExtensions: true,
		withNetworking: true,
		...defaultValues,
	};
	const {
		handleSubmit,
		setValue,
		getValues,
		control,
		formState: { errors },
	} = useForm<SiteFormData>({
		defaultValues,
	});

	const { supportedWPVersions, latestWPVersion } =
		useSupportedWordPressVersions();

	useEffect(() => {
		if (
			latestWPVersion &&
			['', 'latest'].includes(getValues('wpVersion'))
		) {
			setValue('wpVersion', latestWPVersion);
		}
	}, [latestWPVersion, setValue, getValues]);

	return (
		<form onSubmit={handleSubmit(onSubmit)}>
			<VStack spacing={4}>
				{formFields.name && (
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
				)}
				<HStack justify="space-between">
					{formFields.wpVersion && (
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
						/* @TODO: Add this back in */
						/* <br />
					<a
						href="https://wordpress.github.io/wordpress-playground/blueprints/examples#load-an-older-wordpress-version"
						target="_blank"
						rel="noreferrer"
						style={{ fontSize: '0.9em' }}
					>
						Need an older version?
					</a> */
					)}

					{formFields.language && (
						<Controller
							control={control}
							name="language"
							render={({ field: { onChange, ...rest } }) => (
								<SelectControl
									label="Language"
									help={errors.language?.message}
									className={classNames(css.addSiteInput, {
										[css.invalidInput]: !!errors.language,
									})}
									options={[
										// @TODO: Use the correct WordPress language codes, add more languages.
										{ label: 'English', value: '' },
										{ label: 'French', value: 'fr_FR' },
										{ label: 'Spanish', value: 'es_ES' },
										{ label: 'German', value: 'de_DE' },
										{ label: 'Italian', value: 'it_IT' },
										{ label: 'Portuguese', value: 'pt_BR' },
										{ label: 'Russian', value: 'ru_RU' },
										{ label: 'Turkish', value: 'tr_TR' },
										{ label: 'Chinese', value: 'zh_CN' },
										// { label: 'Japanese', value: 'ja_JP' },
										{ label: 'Korean', value: 'ko_KR' },
										{ label: 'Arabic', value: 'ar_AR' },
										{ label: 'Dutch', value: 'nl_NL' },
										{ label: 'Polish', value: 'pl_PL' },
										// { label: 'Swedish', value: 'sv_SE' },
										{ label: 'Finnish', value: 'fi_FI' },
										{ label: 'Danish', value: 'da_DK' },
										{ label: 'Norwegian', value: 'no_NO' },
										// { label: 'Czech', value: 'cs_CZ' },
										{ label: 'Slovak', value: 'sk_SK' },
										{ label: 'Slovenian', value: 'sl_SI' },
										{ label: 'Croatian', value: 'hr_HR' },
										{ label: 'Hungarian', value: 'hu_HU' },
										{ label: 'Romanian', value: 'ro_RO' },
										{ label: 'Bulgarian', value: 'bg_BG' },
									].sort((a, b) =>
										a.label.localeCompare(b.label)
									)}
									onChange={(value, extra) => {
										onChange(extra?.event);
									}}
									{...rest}
								/>
							)}
						/>
					)}
					{formFields.phpVersion && (
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
					)}
				</HStack>
				{formFields.withExtensions && (
					<Controller
						control={control}
						name="withExtensions"
						render={({ field: { onChange, ...rest } }) => (
							<CheckboxControl
								label="Load extensions: libxml, openssl, mbstring, iconv, gd. Uncheck to save ~6MB of initial downloads."
								onChange={(isChecked) => {
									setValue('withExtensions', isChecked);
								}}
								{...rest}
								value={rest.value ? 'true' : 'false'}
								checked={rest.value}
							/>
						)}
					/>
				)}
				{formFields.withNetworking && (
					<Controller
						control={control}
						name="withNetworking"
						render={({ field: { onChange, ...rest } }) => (
							<CheckboxControl
								label="Network access (e.g. for browsing plugins)"
								onChange={(isChecked) => {
									setValue('withNetworking', isChecked);
								}}
								{...rest}
								value={rest.value ? 'true' : 'false'}
								checked={rest.value}
							/>
						)}
					/>
				)}
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
						{submitButtonText}
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
