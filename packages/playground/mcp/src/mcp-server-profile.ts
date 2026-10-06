export interface McpServerPromptDefinition {
	name: string;
	title: string;
	description: string;
	text: string;
}

export interface McpServerDefinition {
	name: string;
	description: string;
	prompts: McpServerPromptDefinition[];
}
