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
import { determinePaths, getScannerOptions } from './utils/utils';
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

describe('Scan Executor', () => {
  let jestConfig: string;
  let defaultPackageJson: string;
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
            files: [],
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
            files: [],
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
            files: [],
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
            files: [],
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
    defaultPackageJson = `{
    "version":"1.0.0"
    }
    `;

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
    (readJsonFile as jest.MockedFunction<typeof readJsonFile>).mockReset();
  });

  afterEach(() => {
    delete process.env['SONAR_PROJECTVERSION'];
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
    testContext.workspace.projects.app1.targets.test.options.coverageDirectory =
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

  it('should override environment variable over options over extra ', async () => {
    (
      readJsonFile as jest.MockedFunction<typeof readJsonFile>
    ).mockImplementation(() => {
      return {};
    });
    sonarQubeScanner.async.mockResolvedValue(true);
    process.env['SONAR_BRANCH'] = 'main';
    process.env['SONAR_LOG_LEVEL_EXTENDED'] = 'DEBUG';
    process.env['SONAR_VERBOSE'] = 'true';

    const output = getScannerOptions(
      context,
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
      'src/',
      'coverage/apps',
      ''
    );

    expect(output['sonar.branch']).toBe('main');
    expect(output['sonar.verbose']).toBe('true');
    expect(output['sonar.log.level']).toBe('DEBUG');
    expect(output['sonar.log.level.extended']).toBe('DEBUG');
    expect(output['sonar.test.inclusions']).toBe('include');
  });
  it('should return app package json', async () => {
    const packageJson = {
      version: '1.1.1',
    };
    (
      readJsonFile as jest.MockedFunction<typeof readJsonFile>
    ).mockImplementation((p, options) => {
      if (p == 'apps/app1/package.json') {
        return packageJson;
      }
      throw new MockError(
        `mocked Implementation expected apps/app1/package.json. provided path:${p}`
      );
    });
    const output = getScannerOptions(
      context,
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
      'src/',
      'coverage/apps',
      ''
    );

    expect(output['sonar.projectVersion']).toBe(packageJson.version);
  });
  it('should return root package json', async () => {
    const packageJson = {
      version: '2.1.2',
    };
    (
      readJsonFile as jest.MockedFunction<typeof readJsonFile>
    ).mockImplementation((p, options) => {
      if (p != 'package.json') {
        throw new MockError(
          `mocked expecting a package.json as path. given path:${p}`
        );
      }
      return packageJson;
    });
    const output = getScannerOptions(
      context,
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
      'src/',
      'coverage/apps',
      ''
    );

    expect(output['sonar.projectVersion']).toBe(packageJson.version);
  });
  it('should return options version', async () => {
    const packageVersion = '3.3.3';
    (
      readJsonFile as jest.MockedFunction<typeof readJsonFile>
    ).mockImplementation(() => {
      return JSON.parse(defaultPackageJson);
    });
    const output = getScannerOptions(
      context,
      {
        hostUrl: 'url',
        verbose: false,
        projectKey: 'key',
        qualityGate: true,
        organization: 'org',
        projectVersion: packageVersion,
        testInclusions: 'include',
        extra: {
          'sonar.test.inclusions': 'dontInclude',
          'sonar.log.level': 'DEBUG',
        },
      },
      'src/',
      'coverage/apps',
      ''
    );

    expect(output['sonar.projectVersion']).toBe(packageVersion);
  });
  it('should return env variable version', async () => {
    (
      readJsonFile as jest.MockedFunction<typeof readJsonFile>
    ).mockImplementation(() => {
      return {};
    });
    sonarQubeScanner.async.mockResolvedValue(true);
    process.env['SONAR_BRANCH'] = 'main';
    process.env['SONAR_LOG_LEVEL_EXTENDED'] = 'DEBUG';
    process.env['SONAR_VERBOSE'] = 'true';
    process.env['SONAR_PROJECTVERSION'] = '1.1.1';

    const output = getScannerOptions(
      context,
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
      'src/',
      'coverage/apps',
      ''
    );

    expect(output['sonar.branch']).toBe('main');
    expect(output['sonar.verbose']).toBe('true');
    expect(output['sonar.log.level']).toBe('DEBUG');
    expect(output['sonar.log.level.extended']).toBe('DEBUG');
    expect(output['sonar.test.inclusions']).toBe('include');
    expect(output['sonar.projectVersion']).toBe('1.1.1');
  });
  it('should return no version', async () => {
    (
      readJsonFile as jest.MockedFunction<typeof readJsonFile>
    ).mockImplementation(() => JSON.parse('{}'));
    const output = getScannerOptions(
      context,
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
      'src/',
      'coverage/apps',
      ''
    );

    expect(output['sonar.projectVersion']).toBe('');
  });
  it('should return no version 2', async () => {
    (
      readJsonFile as jest.MockedFunction<typeof readJsonFile>
    ).mockImplementation((path, options) => {
      throw new MockError('this mock is supposed to fail on every call');
    });
    const output = getScannerOptions(
      context,
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
      'src/',
      'coverage/apps',
      ''
    );

    expect(output['sonar.projectVersion']).toBe('');
  });
});
