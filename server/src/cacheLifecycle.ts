// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

export interface CacheLifecycle {
    clearAnalysisCache: () => void;
    clearLibraryCache: () => void;
    invalidateAnalysisCache: (uri: string) => void;
}

export function clearAnalysisAndLibraryCaches(cacheLifecycle: CacheLifecycle): void {
    cacheLifecycle.clearLibraryCache();
    cacheLifecycle.clearAnalysisCache();
}

export function invalidateClosedDocumentCache(cacheLifecycle: CacheLifecycle, uri: string): void {
    cacheLifecycle.invalidateAnalysisCache(uri);
}
