// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// Stripped down presentation of the dataflow.json format

export interface DataflowModel {
    name: string;
    "ppdf:dataflowId": string;
    culture: string;
    modifiedTime: Date;
    "pbi:mashup": Mashup;
}

export interface Mashup {
    document: string;
}
