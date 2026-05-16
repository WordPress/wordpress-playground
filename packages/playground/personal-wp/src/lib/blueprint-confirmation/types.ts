export type BlueprintWarningSeverity = 'warning' | 'danger';

export type BlueprintWarning = {
	severity: BlueprintWarningSeverity;
	title: string;
	description: string;
	stepIndex?: number;
};

export type BlueprintAnalysisResult = {
	warnings: BlueprintWarning[];
};
