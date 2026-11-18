// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect } from "chai";

import { CacheLifecycle, clearAnalysisAndLibraryCaches, invalidateClosedDocumentCache } from "../cacheLifecycle";

describe(`cacheLifecycle`, () => {
    it(`clears library and analysis caches`, () => {
        const invalidations: string[] = [];
        const cacheLifecycle: CacheLifecycle = createCacheLifecycle(invalidations);

        clearAnalysisAndLibraryCaches(cacheLifecycle);

        expect(invalidations).to.deep.equal(["library", "analysis"]);
    });

    it(`invalidates only the closed document`, () => {
        const invalidations: string[] = [];
        const cacheLifecycle: CacheLifecycle = createCacheLifecycle(invalidations);

        invalidateClosedDocumentCache(cacheLifecycle, "file:///closed.pq");

        expect(invalidations).to.deep.equal(["document:file:///closed.pq"]);
    });
});

function createCacheLifecycle(invalidations: string[]): CacheLifecycle {
    return {
        clearAnalysisCache: () => invalidations.push("analysis"),
        clearLibraryCache: () => invalidations.push("library"),
        invalidateAnalysisCache: (uri: string) => invalidations.push(`document:${uri}`),
    };
}
