# powerquery-language-services

Provides language service related functionality for the [Power Query/M](https://docs.microsoft.com/en-us/power-query/) language.

## Things to note

Here is a rough list of potential performance and accuracy related intellisense improvements that could be made in the future.

### General

-   Incremental lexing on changes
-   Smarter caching to minimize parsing the document when changes are made
    -   Ideally, only the current code block / expression would be reparsed
    -   Symbols at document scope remebered

### Completion Items

-   Field name suggestions for options record when working with library functions

### Signature Help

-   Maintain cache when a function is found to avoid having to go out to the provider when user hits next parameter

## Contributing

See [Contributing section](https://github.com/microsoft/vscode-powerquery/blob/master/README.md#contributing) in parent project.
