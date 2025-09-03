// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as LS from "vscode-languageserver/node";

interface PerformanceMetric {
    readonly count: number;
    readonly totalTime: number;
    readonly maxTime: number;
    readonly minTime: number;
    readonly averageTime: number;
    readonly errors: number;
}

interface PerformanceEntry {
    count: number;
    totalTime: number;
    maxTime: number;
    minTime: number;
    errors: number;
}

/**
 * Performance tracker for monitoring LSP operation performance
 */
export class PerformanceTracker {
    private readonly metrics: Map<string, PerformanceEntry> = new Map<string, PerformanceEntry>();
    private readonly connection: LS.Connection;
    private readonly slowOperationThreshold: number;
    private readonly reportingInterval: number;
    private reportingTimer?: NodeJS.Timeout;
    private requestCounter: number = 0;

    constructor(
        connection: LS.Connection,
        slowOperationThreshold: number = 1000, // ms
        reportingInterval: number = 60000, // ms (1 minute)
    ) {
        this.connection = connection;
        this.slowOperationThreshold = slowOperationThreshold;
        this.reportingInterval = reportingInterval;
        this.startPeriodicReporting();
    }

    /**
     * Get the next request ID for correlation with LSP traces
     */
    private getNextRequestId(): string {
        this.requestCounter += 1;

        return `REQ-${this.requestCounter}`;
    }

    /**
     * Track the performance of an asynchronous operation
     */
    async track<T>(operation: string, fn: () => Promise<T>, requestId?: string): Promise<T> {
        const start: number = performance.now();
        const correlationId: string = requestId || this.getNextRequestId();
        const operationId: string = `${operation}_${Date.now()}_${Math.random()}`;

        this.connection.console.log(`[PERF] Starting operation: ${operation} (${operationId}) [${correlationId}]`);

        try {
            const result: T = await fn();
            const duration: number = performance.now() - start;
            this.recordMetric(operation, duration, false);

            if (duration > this.slowOperationThreshold) {
                this.connection.console.warn(
                    `[PERF] Slow operation: ${operation} took ${duration.toFixed(
                        2,
                    )}ms (${operationId}) [${correlationId}]`,
                );
            } else {
                this.connection.console.log(
                    `[PERF] Completed operation: ${operation} in ${duration.toFixed(
                        2,
                    )}ms (${operationId}) [${correlationId}]`,
                );
            }

            return result;
        } catch (error) {
            const duration: number = performance.now() - start;
            const isCancellation: boolean = this.isCancellationError(error);

            this.recordMetric(operation, duration, !isCancellation); // Don't count cancellation as error

            if (isCancellation) {
                this.connection.console.log(
                    `[PERF] Operation was cancelled: ${operation} after ${duration.toFixed(
                        2,
                    )}ms (${operationId}) [${correlationId}]`,
                );
            } else {
                this.connection.console.error(
                    `[PERF] Failed operation: ${operation} after ${duration.toFixed(
                        2,
                    )}ms (${operationId}) [${correlationId}] - Error: ${error}`,
                );
            }

            throw error;
        }
    }

    /**
     * Track the performance of a synchronous operation
     */
    trackSync<T>(operation: string, fn: () => T, requestId?: string): T {
        const start: number = performance.now();
        const correlationId: string = requestId || this.getNextRequestId();
        const operationId: string = `${operation}_${Date.now()}_${Math.random()}`;

        this.connection.console.log(`[PERF] Starting sync operation: ${operation} (${operationId}) [${correlationId}]`);

        try {
            const result: T = fn();
            const duration: number = performance.now() - start;
            this.recordMetric(operation, duration, false);

            if (duration > this.slowOperationThreshold) {
                this.connection.console.warn(
                    `[PERF] Slow sync operation: ${operation} took ${duration.toFixed(
                        2,
                    )}ms (${operationId}) [${correlationId}]`,
                );
            } else {
                this.connection.console.log(
                    `[PERF] Completed sync operation: ${operation} in ${duration.toFixed(
                        2,
                    )}ms (${operationId}) [${correlationId}]`,
                );
            }

            return result;
        } catch (error) {
            const duration: number = performance.now() - start;
            const isCancellation: boolean = this.isCancellationError(error);

            this.recordMetric(operation, duration, !isCancellation); // Don't count cancellation as error

            if (isCancellation) {
                this.connection.console.log(
                    `[PERF] Sync operation was cancelled: ${operation} after ${duration.toFixed(
                        2,
                    )}ms (${operationId}) [${correlationId}]`,
                );
            } else {
                this.connection.console.error(
                    `[PERF] Failed sync operation: ${operation} after ${duration.toFixed(
                        2,
                    )}ms (${operationId}) [${correlationId}] - Error: ${error}`,
                );
            }

            throw error;
        }
    }

    /**
     * Get performance metrics for a specific operation
     */
    getMetrics(operation: string): PerformanceMetric | undefined {
        const entry: PerformanceEntry | undefined = this.metrics.get(operation);

        if (!entry) {
            return undefined;
        }

        return {
            count: entry.count,
            totalTime: entry.totalTime,
            maxTime: entry.maxTime,
            minTime: entry.minTime,
            averageTime: entry.count > 0 ? entry.totalTime / entry.count : 0,
            errors: entry.errors,
        };
    }

    /**
     * Get all performance metrics
     */
    getAllMetrics(): ReadonlyMap<string, PerformanceMetric> {
        const result: Map<string, PerformanceMetric> = new Map<string, PerformanceMetric>();

        for (const [operation, entry] of this.metrics) {
            result.set(operation, {
                count: entry.count,
                totalTime: entry.totalTime,
                maxTime: entry.maxTime,
                minTime: entry.minTime,
                averageTime: entry.count > 0 ? entry.totalTime / entry.count : 0,
                errors: entry.errors,
            });
        }

        return result;
    }

    /**
     * Clear all performance metrics
     */
    clearMetrics(): void {
        this.metrics.clear();
        this.connection.console.log("[PERF] Performance metrics cleared");
    }

    /**
     * Generate a performance report
     */
    generateReport(): void {
        if (this.metrics.size === 0) {
            this.connection.console.log("[PERF] No performance data to report");

            return;
        }

        this.connection.console.log("[PERF] === Performance Report ===");

        interface MetricWithAverage extends PerformanceEntry {
            operation: string;
            averageTime: number;
        }

        const sortedMetrics: MetricWithAverage[] = Array.from(this.metrics.entries())
            .map(
                ([operation, entry]: [string, PerformanceEntry]): MetricWithAverage => ({
                    operation,
                    ...entry,
                    averageTime: entry.count > 0 ? entry.totalTime / entry.count : 0,
                }),
            )
            .sort((a: MetricWithAverage, b: MetricWithAverage) => b.averageTime - a.averageTime);

        for (const metric of sortedMetrics) {
            const errorRate: string = metric.count > 0 ? ((metric.errors / metric.count) * 100).toFixed(1) : "0.0";

            this.connection.console.log(
                `[PERF] ${metric.operation}: ` +
                    `count=${metric.count}, ` +
                    `avg=${metric.averageTime.toFixed(2)}ms, ` +
                    `max=${metric.maxTime.toFixed(2)}ms, ` +
                    `min=${metric.minTime.toFixed(2)}ms, ` +
                    `total=${metric.totalTime.toFixed(2)}ms, ` +
                    `errors=${metric.errors} (${errorRate}%)`,
            );
        }

        // Report on slowest operations
        const slowOperations: MetricWithAverage[] = sortedMetrics.filter(
            (m: MetricWithAverage) => m.averageTime > this.slowOperationThreshold,
        );

        if (slowOperations.length > 0) {
            this.connection.console.warn(`[PERF] Operations averaging > ${this.slowOperationThreshold}ms:`);

            for (const op of slowOperations) {
                this.connection.console.warn(
                    `[PERF]   ${op.operation}: ${op.averageTime.toFixed(2)}ms average (${op.count} calls)`,
                );
            }
        }

        this.connection.console.log("[PERF] === End Performance Report ===");
    }

    /**
     * Check if an error is a cancellation error
     */
    private isCancellationError(error: unknown): boolean {
        if (error instanceof Error) {
            // Check for cancellation-related error messages
            const message: string = error.message.toLowerCase();

            return message.includes("cancel") || message.includes("abort");
        }

        return false;
    }

    /**
     * Stop the performance tracker and clean up resources
     */
    dispose(): void {
        if (this.reportingTimer) {
            clearInterval(this.reportingTimer);
            this.reportingTimer = undefined;
        }

        // Generate final report
        this.generateReport();
        this.connection.console.log("[PERF] Performance tracker disposed");
    }

    private recordMetric(operation: string, duration: number, isError: boolean): void {
        const existing: PerformanceEntry | undefined = this.metrics.get(operation);

        if (existing) {
            existing.count += 1;
            existing.totalTime += duration;
            existing.maxTime = Math.max(existing.maxTime, duration);
            existing.minTime = Math.min(existing.minTime, duration);

            if (isError) {
                existing.errors += 1;
            }
        } else {
            this.metrics.set(operation, {
                count: 1,
                totalTime: duration,
                maxTime: duration,
                minTime: duration,
                errors: isError ? 1 : 0,
            });
        }
    }

    private startPeriodicReporting(): void {
        this.reportingTimer = setInterval(() => {
            this.generateReport();
        }, this.reportingInterval);
    }
}

// Global performance tracker instance
let globalPerformanceTracker: PerformanceTracker | undefined;

/**
 * Initialize the global performance tracker
 */
export function initializePerformanceTracker(
    connection: LS.Connection,
    slowOperationThreshold?: number,
    reportingInterval?: number,
): void {
    if (globalPerformanceTracker) {
        globalPerformanceTracker.dispose();
    }

    globalPerformanceTracker = new PerformanceTracker(connection, slowOperationThreshold, reportingInterval);
    connection.console.log("[PERF] Performance tracking initialized");
}

/**
 * Get the global performance tracker instance
 */
export function getPerformanceTracker(): PerformanceTracker | undefined {
    return globalPerformanceTracker;
}

/**
 * Dispose the global performance tracker
 */
export function disposePerformanceTracker(): void {
    if (globalPerformanceTracker) {
        globalPerformanceTracker.dispose();
        globalPerformanceTracker = undefined;
    }
}

/**
 * Convenience function to track an async operation using the global tracker
 */
export function trackOperation<T>(operation: string, fn: () => Promise<T>, requestId?: string): Promise<T> {
    if (globalPerformanceTracker) {
        return globalPerformanceTracker.track(operation, fn, requestId);
    } else {
        // Fallback to just executing the function if no tracker is available
        return fn();
    }
}

/**
 * Convenience function to track a sync operation using the global tracker
 */
export function trackOperationSync<T>(operation: string, fn: () => T, requestId?: string): T {
    if (globalPerformanceTracker) {
        return globalPerformanceTracker.trackSync(operation, fn, requestId);
    } else {
        // Fallback to just executing the function if no tracker is available
        return fn();
    }
}
