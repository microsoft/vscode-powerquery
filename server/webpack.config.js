//@ts-check

"use strict";

const path = require("path");

/**@type {import('webpack').Configuration}*/
const config = {
    target: "node",
    entry: "./src/server.ts",
    output: {
        path: path.resolve(__dirname, "dist"),
        filename: "server.js",
        libraryTarget: "commonjs2",
        devtoolModuleFilenameTemplate: "../[resource-path]",
    },
    devtool: "source-map",
    externals: {
        vscode: "commonjs vscode",
        "vscode-languageserver/node": "commonjs vscode-languageserver/node",
    },
    infrastructureLogging: {
        level: "log",
    },
    resolve: {
        extensions: [".ts", ".js"],
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                exclude: /node_modules/,
                use: [
                    {
                        loader: "ts-loader",
                        options: {
                            configFile: "tsconfig.webpack.json",
                        },
                    },
                ],
            },
        ],
    },
};
module.exports = config;
