# Scripts

## BenchmarkFile

Runs an lex/parse/inspection on a given file at the given location. Position is given in the form of `lineNumber:columnNumber`, where the first possible position is `0:0`.

### Example

`.\node_modules\.bin\ts-node .\src\benchmarkFile.ts C:\git\vscode-powerquery\scripts\foo.pq 12:45`
