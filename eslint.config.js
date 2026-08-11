const tsParser = require('@typescript-eslint/parser')
const tsPlugin = require('@typescript-eslint/eslint-plugin')

module.exports = [
    {
        ignores: ['coverage/**', 'dist/**', 'node_modules/**'],
    },
    {
        files: ['**/*.{js,ts}'],
        languageOptions: {
            ecmaVersion: 2018,
            parser: tsParser,
            sourceType: 'module',
        },
        plugins: {
            '@typescript-eslint': tsPlugin,
        },
        rules: {
            '@typescript-eslint/no-use-before-define': 'off',
            'no-use-before-define': 'off',
        },
    },
]
