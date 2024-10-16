import sonarScanExecutor from './executor';
import {
  DependencyType,
  ExecutorContext,
  ProjectGraph,
  readJsonFile,
} from '@nx/devkit';
import * as sonarQubeScanner from 'sonarqube-scanner';
import * as fs from 'fs';
import { determinePaths } from './utils/utils';

let projectGraph: ProjectGraph;
let context: ExecutorContext;

class MockError extends Error {}

jest.mock('@nx/devkit', () => ({
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  ...jest.requireActual<any>('@nx/devkit'),
  readCachedProjectGraph: jest.fn().mockImplementation(() => {
    throw new Error('readCachedProjectGraph error');
  }),
  createProjectGraphAsync: jest
    .fn()
    .mockImplementation(async () => projectGraph),
  readJsonFile: jest.fn().mockImplementation(() => {
    throw new MockError('not implemented for this test');
  }),
}));

jest.mock('sonarqube-scanner');

describe('Scan Executor', (): void => {
  let jestConfig: string;

  beforeEach((): void => {
    (readJsonFile as jest.MockedFunction<typeof readJsonFile>).mockReset();

    projectGraph = {
      dependencies: {
        app1: [
          {
            type: DependencyType.static,
            source: 'app1',
            target: 'lib1',
          },
          {
            type: DependencyType.static,
            source: 'app1',
            target: 'lib2',
          },
          {
            type: DependencyType.implicit,
            source: 'app1',
            target: 'lib3',
          },
        ],
        lib1: [
          {
            type: DependencyType.static,
            source: 'lib1',
            target: 'lib2',
          },
          {
            type: DependencyType.implicit,
            source: 'lib1',
            target: 'lib3',
          },
        ],
        lib2: [
          {
            type: DependencyType.static,
            source: 'lib2',
            target: 'lib3',
          },
        ],
      },
      nodes: {
        app1: {
          name: 'app1',
          type: 'app',
          data: {
            root: 'apps/app1',
            sourceRoot: 'apps/app1/src',
            targets: {
              test: {
                executor: '',
                options: {
                  jestConfig: 'jest.config.ts',
                },
              },
            },
          },
        },
        lib1: {
          name: 'lib1',
          type: 'lib',
          data: {
            root: 'libs/lib1',
            sourceRoot: 'libs/lib1/src',
            targets: {
              test: {
                executor: '',
                options: {
                  jestConfig: 'jest.config.ts',
                },
              },
            },
          },
        },
        lib2: {
          name: 'lib2',
          type: 'lib',
          data: {
            root: 'libs/lib2',
            sourceRoot: 'libs/lib2/src',
            targets: {
              test: {
                executor: '',
                options: {
                  jestConfig: 'jest.config.ts',
                },
              },
            },
          },
        },
        lib3: {
          name: 'lib3',
          type: 'lib',
          data: {
            root: 'libs/lib3',
            sourceRoot: 'libs/lib3/src',
            targets: {
              test: {
                executor: '',
                options: {
                  jestConfig: 'jest.config.ts',
                },
              },
            },
          },
        },
      },
    };

    context = {
      cwd: '',
      isVerbose: false,
      root: '',
      projectName: 'app1',
      nxJsonConfiguration: {},
      projectGraph: projectGraph,
      projectsConfigurations: {
        version: 2,
        projects: {
          app1: {
            root: 'apps/app1',
            sourceRoot: 'apps/app1/src',
            targets: {
              test: {
                executor: '@nx/jest:jest',
                options: {
                  jestConfig: 'jest.config.ts',
                },
              },
            },
          },
          lib1: {
            root: 'libs/lib1',
            sourceRoot: 'libs/lib1/src',
            targets: {
              test: {
                executor: '@nx/jest:jest',
                options: {
                  jestConfig: 'jest.config.ts',
                },
              },
            },
          },
          lib2: {
            root: 'libs/lib2',
            sourceRoot: 'libs/lib2/src',
            targets: {
              test: {
                executor: '@nx/jest:jest',
                options: {
                  jestConfig: 'jest.config.ts',
                },
              },
            },
          },
          lib3: {
            root: 'libs/lib3',
            sourceRoot: 'libs/lib3/src',
            targets: {
              test: {
                executor: '@nx/jest:jest',
                options: {
                  jestConfig: 'jest.config.ts',
                },
              },
            },
          },
        },
      },
    };

    jestConfig = `export default {
      displayName: 'app1',
      preset: '../../jest.preset.js',
      globals: {
        'ts-jest': {
          tsconfig: '<rootDir>/tsconfig.spec.json',
        },
      },
      transform: {
        '^.+\\\\.[tj]s$': 'ts-jest',
      },
      moduleFileExtensions: ['ts', 'js', 'html', 'json'],
      coverageDirectory: '../../coverage/apps/app1',
    };`;

    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
  });

  afterEach((): void => {
    jest.clearAllMocks();
  });

  it('should scan project and dependencies & skip projects with no test target', async () => {
    jest.spyOn(fs, 'readFileSync').mockReturnValue(jestConfig);
    sonarQubeScanner.mockResolvedValue(true);

    const newContext = { ...context };
    newContext.projectsConfigurations.projects['app1'].targets = {};

    const output = await sonarScanExecutor(
      {
        hostUrl: 'url',
        projectKey: 'key',
        qualityGate: true,
      },
      newContext
    );
    expect(output.success).toBe(true);
  });

  it('should skip dependency if jest.config.ts does not exist', async () => {
    sonarQubeScanner.mockResolvedValue(true);
    jest.spyOn(fs, 'readFileSync').mockReturnValue(jestConfig);
    jest.spyOn(fs, 'existsSync').mockReturnValue(false);

    const output = await sonarScanExecutor(
      {
        hostUrl: 'url',
        projectKey: 'key',
        qualityGate: true,
      },
      context
    );
    expect(output.success).toBe(true);
  });

  it('should scan project and dependencies & skip projects with no jestConfig', async () => {
    jest.spyOn(fs, 'readFileSync').mockReturnValue(jestConfig);
    sonarQubeScanner.mockResolvedValue(true);

    const newContext = { ...context };
    newContext.projectsConfigurations.projects['app1'].targets.test.options = {};

    const output = await sonarScanExecutor(
      {
        hostUrl: 'url',
        projectKey: 'key',
        qualityGate: true,
      },
      newContext
    );
    expect(output.success).toBe(true);
  });

  it('should scan project and dependencies & skip projects with no coverageDirectory', async () => {
    jest.spyOn(fs, 'readFileSync').mockReturnValue('');

    sonarQubeScanner.mockResolvedValue(true);

    const output = await sonarScanExecutor(
      {
        hostUrl: 'url',
        projectKey: 'key',
        qualityGate: true,
      },
      context
    );
    expect(output.success).toBe(true);
  });

  it('should error on sonar scanner issue', async () => {
    jest.spyOn(fs, 'readFileSync').mockReturnValue(jestConfig);
    sonarQubeScanner.async.mockImplementation(() => {
      throw new Error();
    });

    const output = await sonarScanExecutor(
      {
        hostUrl: 'url',
        projectKey: 'key',
      },
      context
    );
    expect(output.success).toBeFalsy();
  });

  it('should return jest config coverage directory path', async () => {
    const paths = await determinePaths(
      {
        hostUrl: 'url',
        projectKey: 'key',
      },
      context
    );
    expect(paths.lcovPaths.includes('coverage/apps/app1/lcov.info')).toBe(true);
  });

  it('should return project test config coverage directory path', async () => {
    const testContext = JSON.parse(JSON.stringify(context)) as typeof context;
    testContext.projectsConfigurations.projects.app1.targets.test.options.coverageDirectory =
      'coverage/test/apps/app1';
    const paths = await determinePaths(
      {
        hostUrl: 'url',
        projectKey: 'key',
      },
      testContext
    );
    expect(paths.lcovPaths.includes('coverage/test/apps/app1/lcov.info')).toBe(
      true
    );
  });
});
