module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  transform: {
    '^.+\\.[tj]sx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
      useESM: false,
    }],
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(uuid|jose|jwks-rsa)/)',
  ],
  moduleNameMapper: {
    '^(\\./.*)\\.js$': '$1',
    '^(\\../.*)\\.js$': '$1',
  },
};
