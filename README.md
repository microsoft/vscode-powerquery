# Power Query SDK for VS Code

Provides a language service for the [Power Query / M formula language](https://powerquery.microsoft.com/), and (eventually) feature parity with the [Power Query SDK for Visual Studio](https://marketplace.visualstudio.com/items?itemName=Dakahn.PowerQuerySDK).

[![lerna](https://img.shields.io/badge/maintained%20with-lerna-cc00ff.svg)](https://lerna.js.org/)

## How to build

This repo uses [Lerna](https://lerna.js.org/) to manage sub-package dependencies.

1. install lerna globally:

```cmd
npm install --global lerna
```

2. install package dependencies and create symlinks:

```cmd
lerna bootstrap
```

3. build all packages:

```cmd
lerna run build
```

## How to run tests

```cmd
lerna run test
```

## How to clean

**Warning:** Because of the symlinks created by lerna, you should not run `git clean` commands to remove package dependencies. Instead, you should use lerna's [`clean`](https://github.com/lerna/lerna/tree/master/commands/clean#readme) command.

```cmd
lerna clean
```

## Generate vscode extension

Install the [vsce](https://code.visualstudio.com/api/working-with-extensions/publishing-extension) CLI utility.

```cmd
npm install --global vsce
```

Generate vsix package:

```cmd
vsce package
```

## Contributing

This project welcomes contributions and suggestions. Most contributions require you to agree to a
Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us
the rights to use your contribution. For details, visit https://cla.microsoft.com.

When you submit a pull request, a CLA-bot will automatically determine whether you need to provide
a CLA and decorate the PR appropriately (e.g., label, comment). Simply follow the instructions
provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.
