import sonarScanExecutor from './executor';
import {
  DependencyType,
  ExecutorContext,
  ProjectGraph,
  readJsonFile,
} from '@nx/devkit';
import * as sonarQubeScanner from 'sonarqube-scanner';
import * as childProcess from 'child_process';
import * as fs from 'fs';
import { getScannerOptions } from './utils/utils';

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

describe('Scan Executor - Crystal', (): void => {
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
                executor: 'nx:run-commands',
                options: {
                  command: 'jest',
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
                executor: 'nx:run-commands',
                options: {
                  command: 'jest',
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
                executor: 'nx:run-commands',
                options: {
                  command: 'vitest',
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
                executor: 'nx:run-commands',
                options: {
                  command: 'vitest',
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
                executor: 'nx:run-commands',
                options: {
                  command: 'jest',
                },
              },
            },
          },
          lib1: {
            root: 'libs/lib1',
            sourceRoot: 'libs/lib1/src',
            targets: {
              test: {
                executor: 'nx:run-commands',
                options: {
                  command: 'jest',
                },
              },
            },
          },
          lib2: {
            root: 'libs/lib2',
            sourceRoot: 'libs/lib2/src',
            targets: {
              test: {
                executor: 'nx:run-commands',
                options: {
                  command: 'vitest',
                },
              },
            },
          },
          lib3: {
            root: 'libs/lib3',
            sourceRoot: 'libs/lib3/src',
            targets: {
              test: {
                executor: 'nx:run-commands',
                options: {
                  command: 'vitest',
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
  });

  afterEach((): void => {
    jest.clearAllMocks();
  });

  it('should scan project and dependencies', async () => {
    jest.spyOn(fs, 'readFileSync').mockReturnValue(jestConfig);
    sonarQubeScanner.mockResolvedValue(true);

    const output = await sonarScanExecutor(
      {
        hostUrl: 'url',
        projectKey: 'key',
        qualityGate: true,
        skipImplicitDeps: true,
      },
      context
    );
    expect(output.success).toBe(true);
  });
});
