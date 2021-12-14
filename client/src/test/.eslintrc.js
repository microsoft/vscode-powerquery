module.exports = {
    rules: {
        // Allow use of any to simplify test code
        "@typescript-eslint/no-explicit-any": "off",
        // Not a concern for test suite code
        "security/detect-object-injection": "off",
    },
};
