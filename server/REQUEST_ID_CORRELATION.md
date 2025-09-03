# Request ID Correlation Enhancement

## 🎯 **Objective**
Add LSP request correlation IDs to PERF logging to match operations with their corresponding LSP request/response pairs in trace logs.

## 🔍 **Problem Analysis**

### **Previous PERF Logs (Without Correlation):**
```
[PERF] Starting operation: documentSymbols (documentSymbols_1756936452000_0.6725661629460663)
[PERF] Completed operation: documentSymbols in 4.34ms (documentSymbols_1756936452000_0.6725661629460663)
```

### **LSP Trace Messages:**
```
[Trace - 5:54:01 PM] Sending request 'textDocument/documentSymbol - (10)'.
[Trace - 5:54:12 PM] Received response 'textDocument/documentSymbol - (10)' in 10883ms.
```

### **Missing Correlation:**
- **No way to match** PERF logs to specific LSP requests
- **Difficult to correlate** performance metrics with trace timing
- **Hard to debug** which specific request had performance issues

## ✅ **Solution Implemented**

### **1. Request ID Generation**
Added request counter and correlation ID generator:

```typescript
// Request correlation tracking for performance monitoring
let requestIdCounter: number = 0;

function getNextRequestId(operation: string): string {
    requestIdCounter += 1;
    return `${operation}-(${requestIdCounter})`;
}
```

### **2. Enhanced Performance Tracking**
Updated `PerformanceTracker` class methods to accept optional `requestId`:

```typescript
// Before
async track<T>(operation: string, fn: () => Promise<T>): Promise<T>

// After  
async track<T>(operation: string, fn: () => Promise<T>, requestId?: string): Promise<T>
```

### **3. Enhanced Log Output**
All PERF messages now include correlation ID:

```typescript
// Before
this.connection.console.log(`[PERF] Starting operation: ${operation} (${operationId})`);

// After
this.connection.console.log(`[PERF] Starting operation: ${operation} (${operationId}) [${correlationId}]`);
```

### **4. Handler Integration**
Updated key LSP handlers to generate and pass request IDs:

```typescript
function documentSymbols(params, cancellationToken) {
    const requestId: string = getNextRequestId("textDocument/documentSymbol");
    
    return globalRequestManager.deduplicateRequest(requestKey, () =>
        PerformanceUtils.trackOperation("documentSymbols", () => {
            // operation logic...
        }, requestId),
    );
}
```

## 📊 **Expected Enhanced Log Output**

### **Document Symbols Request:**
```
LSP Trace:
[Trace - 5:54:01 PM] Sending request 'textDocument/documentSymbol - (10)'.

PERF Logs:
[PERF] Starting operation: documentSymbols (documentSymbols_1756936452000_0.6725661629460663) [textDocument/documentSymbol-(10)]
[PERF] Completed operation: documentSymbols in 4.34ms (documentSymbols_1756936452000_0.6725661629460663) [textDocument/documentSymbol-(10)]

LSP Trace:
[Trace - 5:54:12 PM] Received response 'textDocument/documentSymbol - (10)' in 10883ms.
```

### **Diagnostics Request:**
```
LSP Trace:
[Trace - 5:53:33 PM] Sending request 'textDocument/diagnostic - (1)'.

PERF Logs:
[PERF] Starting operation: getDocumentDiagnostics (getDocumentDiagnostics_1756936414340_0.5820825408637931) [textDocument/diagnostic-(1)]
[PERF] Operation was cancelled: getDocumentDiagnostics after 0.19ms (getDocumentDiagnostics_1756936414340_0.5820825408637931) [textDocument/diagnostic-(1)]

LSP Trace:
[Trace - 5:54:13 PM] Received response 'textDocument/diagnostic - (1)' in 38169ms.
```

### **Cancellation Correlation:**
```
LSP Trace:
[Trace - 5:54:13 PM] Sending notification '$/cancelRequest'.

PERF Logs:
[PERF] Operation was cancelled: getDocumentDiagnostics after 0.19ms (getDocumentDiagnostics_1756936453557_0.7793971400373866) [textDocument/diagnostic-(21)]

LSP Trace:
[Trace - 5:54:13 PM] Received response 'textDocument/diagnostic - (21)' in 1566ms.
```

## 🔧 **Implementation Details**

### **Enhanced Handlers:**
- ✅ **documentSymbols**: `textDocument/documentSymbol-(N)`
- ✅ **getDocumentDiagnostics**: `textDocument/diagnostic-(N)`
- 🔄 **Pending**: onCompletion, onDefinition, onHover, onSignatureHelp

### **Request ID Format:**
- **Pattern**: `{operation}-(n)` where n is sequential counter
- **Examples**: 
  - `textDocument/documentSymbol-(10)`
  - `textDocument/diagnostic-(1)`
  - `textDocument/completion-(5)`

### **Log Format Enhancement:**
```
[PERF] {status}: {operation} {timing} ({operationId}) [{requestId}]
```

## 🚀 **Benefits**

### **1. Enhanced Debugging:**
- **Direct correlation** between PERF logs and LSP traces
- **Easy identification** of which specific request had performance issues
- **Clear tracking** of request lifecycle from send → process → respond

### **2. Performance Analysis:**
- **Match timing discrepancies** between LSP trace timing and actual processing time
- **Identify bottlenecks** by correlating multiple performance operations for same request
- **Track request duplication** by observing multiple PERF operations with same request ID

### **3. Cancellation Tracking:**
- **Correlate cancellation requests** with specific operations being cancelled
- **Validate cancellation effectiveness** by matching cancel notifications with operation logs
- **Debug cancellation issues** by tracking request ID through cancellation flow

## 📝 **Files Modified**

### **Performance Utils (`server/src/performanceUtils.ts`):**
- Added `requestCounter` and `getNextRequestId()` method
- Enhanced `track()` and `trackSync()` methods with optional `requestId` parameter
- Updated all log messages to include correlation ID in `[requestId]` format

### **Server (`server/src/server.ts`):**
- Added module-level request counter and `getNextRequestId()` function  
- Updated `documentSymbols()` handler with request ID generation and correlation
- Updated `getDocumentDiagnostics()` handler with request ID generation and correlation

### **Global Functions:**
- Enhanced `trackOperation()` and `trackOperationSync()` to accept optional `requestId`

## ⏭ **Next Steps**

### **Immediate:**
1. **Test with new trace** - Request IDs should now appear in PERF logs
2. **Validate correlation** - Match PERF logs with LSP trace request/response pairs
3. **Verify semantic tokens disable** - No more `powerquery/semanticTokens` requests

### **Future Enhancements:**
1. **Complete remaining handlers** - onCompletion, onDefinition, onHover, etc.
2. **Client-side correlation** - Add request tracking on client side as well
3. **Performance dashboard** - Use correlation IDs for advanced performance analytics

---

**Summary**: PERF logs now include correlation IDs that match LSP request patterns, enabling precise correlation between performance tracking and LSP request/response pairs. This will dramatically improve debugging and performance analysis capabilities.
