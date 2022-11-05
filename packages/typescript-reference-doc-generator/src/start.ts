// Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
import { ApiDocumenterCommandLine } from './cli/ApiDocumenterCommandLine';

const parser: ApiDocumenterCommandLine = new ApiDocumenterCommandLine();

parser.execute().catch(console.error);
