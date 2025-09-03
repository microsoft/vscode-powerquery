# Performance Monitoring Implementation

This document describes the performance monitoring system implemented for the Power Query Language Server Protocol (LSP) to help identify and diagnose performance bottlenecks.

## Overview

The performance tracking system monitors the execution time of key LSP operations and provides detailed diagnostics through the language server console. This helps identify slow operations that may be causing user experience issues.

## Features

### 1. **Automatic Performance Tracking**
- Tracks execution time for all major LSP operations:
  - `onCompletion` - Autocompletion requests
  - `onDefinition` - Go-to-definition requests
  - `onHover` - Hover information requests
  - `documentSymbols` - Document symbol extraction
  - `getDocumentDiagnostics` - Document validation and diagnostics

### 2. **Real-time Monitoring**
- Logs start and completion of each operation
- Identifies slow operations (> 1 second by default)
- Tracks errors and operation failures
- Provides unique operation IDs for debugging

### 3. **Performance Metrics**
- **Count**: Number of times each operation was executed
- **Average Time**: Mean execution time across all calls
- **Max Time**: Longest execution time recorded
- **Min Time**: Shortest execution time recorded
- **Total Time**: Cumulative execution time
- **Error Rate**: Percentage of operations that failed

### 4. **Periodic Reporting**
- Generates performance reports every 60 seconds (configurable)
- Reports operations averaging > 1 second (configurable threshold)
- Accessible via console logs in VS Code Output panel

## Configuration

The performance tracker is initialized in `server.ts` with the following default settings:

```typescript
PerformanceUtils.initializePerformanceTracker(
    connection,
    1000, // 1 second threshold for slow operations
    60000, // 1 minute reporting interval
);
```

### Parameters:
- **slowOperationThreshold**: Operations taking longer than this (in ms) are flagged as slow
- **reportingInterval**: How often (in ms) to generate performance reports

## Usage

### Viewing Performance Logs

1. Open VS Code
2. Go to **View** → **Output**
3. Select **Power Query Language Server** from the dropdown
4. Performance logs will appear with `[PERF]` prefix

### Manual Performance Reports

You can trigger manual performance reports using custom LSP commands:

#### Get Performance Report
```json
{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "powerquery/getPerformanceReport",
    "params": {}
}
```

#### Clear Performance Metrics
```json
{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "powerquery/clearPerformanceMetrics",
    "params": {}
}
```

## Log Examples

### Operation Start/Complete
```
[PERF] Starting operation: onCompletion (onCompletion_1756934123456_0.123)
[PERF] Completed operation: onCompletion in 234.56ms (onCompletion_1756934123456_0.123)
```

### Slow Operation Warning
```
[PERF] Slow operation: documentSymbols took 1542.33ms (documentSymbols_1756934123789_0.456)
```

### Performance Report
```
[PERF] === Performance Report ===
[PERF] documentSymbols: count=45, avg=892.34ms, max=1542.33ms, min=123.45ms, total=40155.30ms, errors=2 (4.4%)
[PERF] onCompletion: count=123, avg=234.56ms, max=567.89ms, min=45.67ms, total=28850.88ms, errors=0 (0.0%)
[PERF] onHover: count=67, avg=156.78ms, max=345.67ms, min=23.45ms, total=10504.26ms, errors=1 (1.5%)
[PERF] Operations averaging > 1000ms:
[PERF]   documentSymbols: 892.34ms average (45 calls)
[PERF] === End Performance Report ===
```

## Troubleshooting Performance Issues

### Common Slow Operations

1. **Document Symbols (`documentSymbols`)**
   - Often the slowest operation for large files
   - Consider implementing incremental symbol updates
   - Check if PQLS-level caching is enabled

2. **Diagnostics (`getDocumentDiagnostics`)**
   - Can be slow for complex validation
   - Monitor frequency of validation requests
   - Consider debouncing document changes

3. **Autocompletion (`onCompletion`)**
   - May be slow with large library symbol sets
   - Check library loading and caching efficiency

### Performance Optimization Tips

1. **Enable Workspace Caching**
   - Ensure `PQLS.AnalysisSettings.isWorkspaceCacheAllowed` is enabled
   - This caches parsed states and analysis results

2. **Monitor Error Rates**
   - High error rates may indicate parsing or validation issues
   - Errors can impact performance due to retry mechanisms

3. **Review Large File Handling**
   - Operations on large Power Query files may naturally take longer
   - Consider implementing size-based optimizations

## Implementation Details

### Files Modified
- `server/src/performanceUtils.ts` - New performance tracking module
- `server/src/server.ts` - Integration with LSP operations

### Architecture
- **PerformanceTracker Class**: Core tracking functionality
- **Global Tracker Instance**: Shared across all operations
- **Cleanup Handlers**: Proper disposal on server shutdown
- **Console Logging**: Uses `connection.console` for diagnostics

### Thread Safety
- Performance tracking is designed for single-threaded LSP operations
- No concurrent access concerns in typical LSP usage

## Future Enhancements

1. **Performance Regression Detection**
   - Baseline performance tracking
   - Alerts for significant performance degradation

2. **Memory Usage Tracking**
   - Monitor memory consumption patterns
   - Identify memory leaks or excessive usage

3. **Client-Side Performance**
   - Track client-side request timing
   - End-to-end performance visibility

4. **Performance Profiles**
   - Different thresholds for different operation types
   - Adaptive thresholds based on file size or complexity
