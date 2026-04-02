# Copilot Instructions

## Build, Test, and Lint

This is a multi-package monorepo (root, `client/`, `server/`, `scripts/`). Each has its own `node_modules` and `package.json`. The root `npm install` runs `npm install-clean` in all sub-packages via `postinstall`.

```shell
npm install          # install all packages (root + client + server + scripts)
npm run build        # TypeScript compile all packages
npm run lint         # ESLint all packages

# Server unit tests (mocha, no build dependency)
npm run test:server

# Client UI tests (vscode-test-electron, requires webpack first)
npm run webpack-prod
npm run test:client

# Run a single server test file directly
cd server
npx mocha --require ts-node/register src/test/<file>.test.ts

# Package the extension
npm run vsix
```

## Architecture

This is a VS Code extension providing Language Server Protocol (LSP) support for the Power Query / M formula language.

**Client** (`client/src/extension.ts`): Activates the extension, starts the language server over **Node IPC**, and manages the library symbol system. Exposes a `PowerQueryApi` for other extensions.

**Server** (`server/src/server.ts`): Handles LSP requests — completion, hover, definition, formatting, diagnostics, rename, folding, document symbols, semantic tokens, and signature help. Request handling follows a consistent pattern: fetch document → create cancellation token → build a `PQLS.Analysis` → call the analysis API → map results to LSP types. Errors go through `ErrorUtils.handleError`.

**Scripts** (`scripts/`): Standalone benchmark/tooling utilities, not part of the extension runtime.

**Core dependencies** (Microsoft-owned, all three are used across the codebase):

- `@microsoft/powerquery-parser` — Lexer, parser, and type validation
- `@microsoft/powerquery-language-services` — Higher-level language service (Analysis, completions, hover, etc.)
- `@microsoft/powerquery-formatter` — Code formatter (server-side only)

### Library Symbol System

External library symbols allow users to extend the M standard library with custom function definitions loaded from JSON files on disk. The flow:

1. User configures `powerquery.client.additionalSymbolsDirectories` setting
2. `LibrarySymbolManager` scans directories for `.json` files, parses them via `LibrarySymbolUtils`
3. `LibrarySymbolClient` sends symbols to the server via custom LSP requests (`powerquery/addLibrarySymbols`, `powerquery/removeLibrarySymbols`)
4. Server merges external symbols with built-in standard/SDK library in `SettingsUtils.getLibrary()`

### Local Development with Sibling Packages

Use `npm run link:start` to develop against locally-built copies of the parser, formatter, and language-services packages (via `npm link`). Use `npm run link:stop` to revert to published npm versions.

## Code Conventions

**TypeScript strictness** — The ESLint config enforces rules that are stricter than typical TypeScript projects:

- `explicit-function-return-type`: All functions must have explicit return type annotations
- `typedef`: Required on variables, parameters, properties, arrow parameters, and destructuring
- `no-floating-promises`: All promises must be awaited or handled
- `switch-exhaustiveness-check`: Switch statements must cover all cases
- `sort-imports`: Imports must be sorted (separated groups allowed, case-insensitive)
- `no-plusplus`: Use `+= 1` instead of `++`
- `object-shorthand`: Always use shorthand properties/methods
- `arrow-body-style`: Use concise arrow function bodies (no braces for single expressions)
- `curly`: Always use braces for control flow, even single-line

**Formatting** (Prettier): 120 char line width, 4-space indent, trailing commas, no parens on single arrow params.

**Import aliases**: The codebase uses `PQP` for powerquery-parser, `PQLS` for powerquery-language-services, and `PQF` for powerquery-formatter.

**Testing**: Server tests use Mocha (`describe`/`it`) with Chai `expect` and Node `assert`. Client tests use VS Code's test runner (`suite`/`test` TDD-style).
