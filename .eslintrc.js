module.exports = {
    root: true,
    parser: "@typescript-eslint/parser",
    plugins: ["@typescript-eslint", "security", "prettier"],
    extends: [
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended",
        "plugin:prettier/recommended",
        "plugin:security/recommended",
    ],
    rules: {
        "@typescript-eslint/no-inferrable-types": "off",
        "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
        "@typescript-eslint/typedef": [
            "warn",
            {
                arrowParameter: false,
                variableDeclaration: true,
                variableDeclarationIgnoreFunction: true,
            },
        ],
        "prettier/prettier": ["warn"],
        "security/detect-non-literal-fs-filename": "off",
    },
};
