/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*.test.ts?(x)'],
  // Coverage-Ziel gilt für Business-Logik; reine Verdrahtung (Clients, Konstanten) ausgenommen.
  collectCoverageFrom: [
    'lib/**/*.ts',
    'stores/**/*.ts',
    'features/**/*.ts',
    '!**/*.d.ts',
    '!**/index.ts',
    '!lib/{env,supabase,storage,queryClient,theme}.ts',
  ],
  coverageThreshold: {
    global: { lines: 70, branches: 70, functions: 70, statements: 70 },
  },
};
