import sonarScanExecutor from './executor';
import { DependencyType, ExecutorContext, ProjectGraph } from '@nrwl/devkit';
import * as fs from 'fs';
import * as sonarQubeScanner from 'sonarqube-scanner';
import * as childProcess from 'child_process';
import { ScanExecutorSchema } from './schema';
import { scanner } from './utils/utils';

let projectGraph: ProjectGraph;
let context: ExecutorContext;

jest.mock('@nrwl/devkit', () => ({
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  ...jest.requireActual<any>('@nrwl/devkit'),
  readCachedProjectGraph: jest.fn().mockImplementation(() => {
    throw new Error('readCachedProjectGraph error');
  }),
  createProjectGraphAsync: jest
    .fn()
    .mockImplementation(async () => projectGraph),
}));

jest.mock('sonarqube-scanner');

describe('Scan Executor', () => {
  let jestConfig: string;

  beforeEach(() => {
    context = {
      cwd: '',
      isVerbose: false,
      root: '',
      projectName: 'app1',
      workspace: {
        version: 2,
        projects: {
          app1: {
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
          lib1: {
            root: 'libs/lib1',
            sourceRoot: 'libs/lib1/src',
            targets: {
              test: {
                executor: '@nrwl/jest:jest',
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
                executor: '@nrwl/jest:jest',
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
                executor: '@nrwl/jest:jest',
                options: {
                  jestConfig: 'jest.config.ts',
                },
              },
            },
          },
        },
      },
    };

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

  afterEach(() => {
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

  it('should scan project and dependencies with branch name', async () => {
    jest.spyOn(fs, 'readFileSync').mockReturnValue(jestConfig);
    sonarQubeScanner.mockResolvedValue(true);

    jest.spyOn(childProcess, 'execSync').mockReturnValue('feature/my-branch');

    const output = await sonarScanExecutor(
      {
        hostUrl: 'url',
        projectKey: 'key',
        branches: true,
        qualityGate: true,
      },
      context
    );
    expect(output.success).toBe(true);
  });

  it('should scan project and dependencies & skip projects with no test target', async () => {
    jest.spyOn(fs, 'readFileSync').mockReturnValue(jestConfig);
    sonarQubeScanner.mockResolvedValue(true);

    const newContext = { ...context };
    newContext.workspace.projects['app1'].targets = {};

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

  it('should scan project and dependencies & skip projects with no jestConfig', async () => {
    jest.spyOn(fs, 'readFileSync').mockReturnValue(jestConfig);
    sonarQubeScanner.mockResolvedValue(true);

    const newContext = { ...context };
    newContext.workspace.projects['app1'].targets.test.options = {};

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

  it('should override environment variable over options over extra ', async () => {
    jest.spyOn(fs, 'readFileSync').mockReturnValue(jestConfig);
    sonarQubeScanner.async.mockResolvedValue(true);
    process.env['SONAR_BRANCH'] = 'main';
    process.env['SONAR_VERBOSE'] = 'true';
    const output = await scanner(
      {
        hostUrl: 'url',
        verbose: false,
        projectKey: 'key',
        qualityGate: true,
        organization: 'org',
        testInclusions: 'include',
        extra: {
          'sonar.test.inclusions': 'dontInclude',
          'sonar.log.level': 'DEBUG',
        },
      },
      context
    );

    expect(output.success).toBe(true);
    expect(output.scannerOptions['sonar.branch']).toBe('main');
    expect(output.scannerOptions['sonar.verbose']).toBe('true');
    expect(output.scannerOptions['sonar.log.level']).toBe('DEBUG');
    expect(output.scannerOptions['sonar.test.inclusions']).toBe('include');
  });
});
