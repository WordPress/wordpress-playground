import type { SupportedPHPVersion } from '@php-wasm/universal';
import { SupportedPHPVersionsList } from '@php-wasm/universal';
import css from './style.module.css';
import { CheckboxControl, SelectControl } from '@wordpress/components';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import classNames from 'classnames';
import { __experimentalVStack as VStack } from '@wordpress/components';
import { useSupportedWordPressVersions } from './use-supported-wordpress-versions';
import { randomSiteName } from '../../../lib/state/redux/random-site-name';

type ConfigurableFields = Record<
	keyof SiteFormData & ('name' | 'wpVersion' | 'language' | 'multisite'),
	boolean
>;

export interface SiteSettingsFormProps {
	onSubmit: (data: any) => void;
	header?: React.ReactNode;
	footer?: React.ReactNode;
	enabledFields?: ConfigurableFields;
	defaultValues?: Partial<SiteFormData>;
}

export interface SiteFormData {
	name: string;
	phpVersion: SupportedPHPVersion;
	wpVersion: string;
	language: string;
	withExtensions: boolean;
	withNetworking: boolean;
	multisite: boolean;
}

export function UnconnectedSiteSettingsForm({
	onSubmit,
	header,
	footer,
	defaultValues = {},
	enabledFields = {
		name: true,
		wpVersion: true,
		language: true,
		multisite: true,
	},
}: SiteSettingsFormProps) {
	defaultValues = {
		name: randomSiteName(),
		phpVersion: '8.0',
		wpVersion: 'latest',
		language: '',
		withExtensions: true,
		withNetworking: true,
		multisite: false,
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
		<form onSubmit={handleSubmit(onSubmit)} className="site-settings-form">
			{header}
			<VStack spacing={3} className={css.formSection}>
				<Controller
					control={control}
					name="wpVersion"
					rules={{
						required: {
							message: 'WordPress Version is required',
							value: true,
						},
					}}
					disabled={!enabledFields.wpVersion}
					render={({ field: { onChange, ...rest } }) => (
						<div>
							<SelectControl
								size="compact"
								__nextHasNoMarginBottom={true}
								label="WordPress Version"
								labelPosition="side"
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
											label: `${supportedWPVersions[version]}`,
											value: version,
										})),
									]
								}
								onChange={(value, extra) => {
									onChange(extra?.event);
								}}
								{...rest}
							/>

							{enabledFields.wpVersion && (
								<a
									href="https://wordpress.github.io/wordpress-playground/blueprints/examples#load-an-older-wordpress-version"
									target="_blank"
									rel="noreferrer"
									style={{ fontSize: '0.9em' }}
								>
									Need an older version?
								</a>
							)}
						</div>
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
							size="compact"
							__nextHasNoMarginBottom={true}
							label="PHP Version"
							labelPosition="side"
							help={errors.phpVersion?.message}
							className={classNames(css.addSiteInput, {
								[css.invalidInput]: !!errors.phpVersion,
							})}
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

				<Controller
					control={control}
					name="language"
					render={({ field: { onChange, ...rest } }) => (
						<SelectControl
							size="compact"
							__nextHasNoMarginBottom={true}
							label="Language"
							labelPosition="side"
							help={errors.language?.message}
							className={classNames(css.addSiteInput, {
								[css.invalidInput]: !!errors.language,
							})}
							disabled={!enabledFields.language}
							options={[
								// @TODO: Let's extract this to a
								// dedicated module and add a test
								// (or build step) to ensure that
								// all supported locales are included.
								{ value: 'af', label: 'Afrikaans' },
								{ value: 'ar', label: 'Arabic' },
								{
									value: 'ary',
									label: 'Moroccan Arabic',
								},
								{ value: 'as', label: 'Assamese' },
								{ value: 'bel', label: 'Belarusian' },
								{ value: 'bg_BG', label: 'Bulgarian' },
								{
									value: 'bn_BD',
									label: 'Bengali (Bangladesh)',
								},
								{ value: 'bo', label: 'Tibetan' },
								{ value: 'bs_BA', label: 'Bosnian' },
								{ value: 'ca', label: 'Catalan' },
								{ value: 'ceb', label: 'Cebuano' },
								{
									value: 'ckb',
									label: 'Kurdish (Sorani)',
								},
								{ value: 'cs_CZ', label: 'Czech' },
								{ value: 'cy', label: 'Welsh' },
								{ value: 'da_DK', label: 'Danish' },
								{
									value: 'de_AT',
									label: 'German (Austria)',
								},
								{
									value: 'de_CH',
									label: 'German (Switzerland)',
								},
								{
									value: 'de_CH_informal',
									label: 'German (Switzerland, Informal)',
								},
								{ value: 'de_DE', label: 'German' },
								{
									value: 'de_DE_formal',
									label: 'German (Formal)',
								},
								{ value: 'dzo', label: 'Dzongkha' },
								{ value: 'el', label: 'Greek' },
								{
									value: 'en_AU',
									label: 'English (Australia)',
								},
								{
									value: 'en_CA',
									label: 'English (Canada)',
								},
								{
									value: 'en_GB',
									label: 'English (UK)',
								},
								{
									value: 'en_NZ',
									label: 'English (New Zealand)',
								},
								{
									value: '',
									label: 'English (United States)',
								},
								{
									value: 'en_ZA',
									label: 'English (South Africa)',
								},
								{ value: 'eo', label: 'Esperanto' },
								{
									value: 'es_AR',
									label: 'Spanish (Argentina)',
								},
								{
									value: 'es_CL',
									label: 'Spanish (Chile)',
								},
								{
									value: 'es_CO',
									label: 'Spanish (Colombia)',
								},
								{
									value: 'es_CR',
									label: 'Spanish (Costa Rica)',
								},
								{
									value: 'es_ES',
									label: 'Spanish (Spain)',
								},
								{
									value: 'es_GT',
									label: 'Spanish (Guatemala)',
								},
								{
									value: 'es_MX',
									label: 'Spanish (Mexico)',
								},
								{
									value: 'es_PE',
									label: 'Spanish (Peru)',
								},
								{
									value: 'es_UY',
									label: 'Spanish (Uruguay)',
								},
								{
									value: 'es_VE',
									label: 'Spanish (Venezuela)',
								},
								{ value: 'et', label: 'Estonian' },
								{ value: 'eu', label: 'Basque' },
								{ value: 'fa_IR', label: 'Persian' },
								{ value: 'fi', label: 'Finnish' },
								{
									value: 'fr_BE',
									label: 'French (Belgium)',
								},
								{
									value: 'fr_CA',
									label: 'French (Canada)',
								},
								{
									value: 'fr_FR',
									label: 'French (France)',
								},
								{ value: 'fur', label: 'Friulian' },
								{
									value: 'gd',
									label: 'Scottish Gaelic',
								},
								{ value: 'gl_ES', label: 'Galician' },
								{ value: 'gu', label: 'Gujarati' },
								{ value: 'haz', label: 'Hazaragi' },
								{ value: 'he_IL', label: 'Hebrew' },
								{ value: 'hi_IN', label: 'Hindi' },
								{ value: 'hr', label: 'Croatian' },
								{
									value: 'hsb',
									label: 'Upper Sorbian',
								},
								{ value: 'hu_HU', label: 'Hungarian' },
								{ value: 'hy', label: 'Armenian' },
								{ value: 'id_ID', label: 'Indonesian' },
								{ value: 'is_IS', label: 'Icelandic' },
								{ value: 'it_IT', label: 'Italian' },
								{ value: 'ja', label: 'Japanese' },
								{ value: 'jv_ID', label: 'Javanese' },
								{ value: 'kab', label: 'Kabyle' },
								{ value: 'ka_GE', label: 'Georgian' },
								{ value: 'kk', label: 'Kazakh' },
								{ value: 'km', label: 'Khmer' },
								{ value: 'kn', label: 'Kannada' },
								{ value: 'ko_KR', label: 'Korean' },
								{ value: 'lo', label: 'Lao' },
								{ value: 'lt_LT', label: 'Lithuanian' },
								{ value: 'lv', label: 'Latvian' },
								{ value: 'mk_MK', label: 'Macedonian' },
								{ value: 'ml_IN', label: 'Malayalam' },
								{ value: 'mn', label: 'Mongolian' },
								{ value: 'mr', label: 'Marathi' },
								{ value: 'ms_MY', label: 'Malay' },
								{
									value: 'my_MM',
									label: 'Myanmar (Burmese)',
								},
								{
									value: 'nb_NO',
									label: 'Norwegian (Bokmål)',
								},
								{ value: 'ne_NP', label: 'Nepali' },
								{
									value: 'nl_BE',
									label: 'Dutch (Belgium)',
								},
								{ value: 'nl_NL', label: 'Dutch' },
								{
									value: 'nl_NL_formal',
									label: 'Dutch (Formal)',
								},
								{
									value: 'nn_NO',
									label: 'Norwegian (Nynorsk)',
								},
								{ value: 'oci', label: 'Occitan' },
								{ value: 'pa_IN', label: 'Punjabi' },
								{ value: 'pl_PL', label: 'Polish' },
								{ value: 'ps', label: 'Pashto' },
								{
									value: 'pt_AO',
									label: 'Portuguese (Angola)',
								},
								{
									value: 'pt_BR',
									label: 'Portuguese (Brazil)',
								},
								{
									value: 'pt_PT',
									label: 'Portuguese (Portugal)',
								},
								{
									value: 'pt_PT_ao90',
									label: 'Portuguese (Portugal, AO90)',
								},
								{ value: 'rhg', label: 'Rohingya' },
								{ value: 'ro_RO', label: 'Romanian' },
								{ value: 'ru_RU', label: 'Russian' },
								{ value: 'sah', label: 'Sakha' },
								{ value: 'si_LK', label: 'Sinhala' },
								{ value: 'skr', label: 'Saraiki' },
								{ value: 'sk_SK', label: 'Slovak' },
								{ value: 'sl_SI', label: 'Slovenian' },
								{ value: 'snd', label: 'Sindhi' },
								{ value: 'sq', label: 'Albanian' },
								{ value: 'sr_RS', label: 'Serbian' },
								{ value: 'sv_SE', label: 'Swedish' },
								{ value: 'sw', label: 'Swahili' },
								{ value: 'szl', label: 'Silesian' },
								{ value: 'tah', label: 'Tahitian' },
								{ value: 'ta_IN', label: 'Tamil' },
								{ value: 'te', label: 'Telugu' },
								{ value: 'th', label: 'Thai' },
								{ value: 'tl', label: 'Tagalog' },
								{ value: 'tr_TR', label: 'Turkish' },
								{ value: 'tt_RU', label: 'Tatar' },
								{ value: 'ug_CN', label: 'Uighur' },
								{ value: 'uk', label: 'Ukrainian' },
								{ value: 'ur', label: 'Urdu' },
								{ value: 'uz_UZ', label: 'Uzbek' },
								{ value: 'vi', label: 'Vietnamese' },
								{
									value: 'zh_CN',
									label: 'Chinese (China)',
								},
								{
									value: 'zh_HK',
									label: 'Chinese (Hong Kong)',
								},
								{
									value: 'zh_TW',
									label: 'Chinese (Taiwan)',
								},
							].sort((a, b) => a.label.localeCompare(b.label))}
							onChange={(value, extra) => {
								onChange(extra?.event);
							}}
							{...rest}
						/>
					)}
				/>

				<Controller
					control={control}
					name="withNetworking"
					render={({ field: { onChange, ref, ...rest } }) => (
						<CheckboxControl
							label="Allow network access"
							onChange={(isChecked) => {
								setValue('withNetworking', isChecked);
							}}
							{...rest}
							value={rest.value ? 'true' : 'false'}
							checked={rest.value}
						/>
					)}
				/>

				<Controller
					control={control}
					name="multisite"
					disabled={!enabledFields.multisite}
					render={({ field: { onChange, ref, ...rest } }) => (
						<CheckboxControl
							label="Create a multisite network"
							onChange={(isChecked) => {
								setValue('multisite', isChecked);
							}}
							{...rest}
							value={rest.value ? 'true' : 'false'}
							checked={rest.value}
						/>
					)}
				/>

				<Controller
					control={control}
					name="withExtensions"
					render={({ field: { onChange, ref, ...rest } }) => (
						<CheckboxControl
							label="Load PHP extensions"
							onChange={(isChecked) => {
								setValue('withExtensions', isChecked);
							}}
							help="~6MB (libxml, openssl, mbstring, iconv, gd)"
							{...rest}
							value={rest.value ? 'true' : 'false'}
							checked={rest.value}
						/>
					)}
				/>
			</VStack>
			{footer}
		</form>
	);
}
