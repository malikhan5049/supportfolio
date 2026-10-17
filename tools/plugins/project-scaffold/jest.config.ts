import type { Config } from 'jest';

export default {
  displayName: 'project-scaffold',
  preset: '../../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }]
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../../../coverage/tools/plugins/project-scaffold',
  testMatch: ['**/*.spec.ts']
} satisfies Config;
