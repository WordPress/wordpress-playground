import { ApiItem, ApiModel, ExcerptToken } from '@microsoft/api-extractor-model';
export interface DocumentedType {
    name: string;
    docUrl: string;
}
export default class TypeResolver {
    private readonly _apiModel;
    private readonly _getLinkForApiItem;
    constructor(apiModel: ApiModel, getLinkForApiItem: (item: ApiItem) => string);
    resolveTypeDocumentation(type: ExcerptToken | string): DocumentedType | null;
    resolveCanonicalReference(token: ExcerptToken): string | undefined;
    resolveNativeToken(token: string): DocumentedType | null;
}
