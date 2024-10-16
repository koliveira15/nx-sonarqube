import sonarScanExecutor from './executor';
import {
  DependencyType,
  ExecutorContext,
  ProjectGraph,
  readJsonFile,
} from '@nx/devkit';
import * as sonarQubeScanner from 'sonarqube-scanner';
import { determinePaths } from './utils/utils';
import { ScanExecutorSchema } from "./schema";
import * as fs from "fs";

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
  let viteConfig: string;
  let commonOptions: Partial<ScanExecutorSchema> & Pick<ScanExecutorSchema, 'hostUrl' | 'projectKey'>;

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
                executor: '@nx/vite:test',
                options: {
                  reportsDirectory: "../../coverage/apps/app1"
                },
              },
            },
          },
          lib1: {
            root: 'libs/lib1',
            sourceRoot: 'libs/lib1/src',
            targets: {
              test: {
                executor: '@nx/vite:test',
                options: {
                  reportsDirectory: "../../coverage/apps/app1"
                },
              },
            },
          },
          lib2: {
            root: 'libs/lib2',
            sourceRoot: 'libs/lib2/src',
            targets: {
              test: {
                executor: '@nx/vite:test',
                options: {
                  reportsDirectory: "../../coverage/apps/app1"
                },
              },
            },
          },
          lib3: {
            root: 'libs/lib3',
            sourceRoot: 'libs/lib3/src',
            targets: {
              test: {
                executor: '@nx/vite:test',
                options: {
                  reportsDirectory: "../../coverage/apps/app1"
                },
              },
            },
          },
        },
      },
    };
    commonOptions = {
      hostUrl: 'url',
      projectKey: 'key',
    };
    viteConfig = `
      import { defineConfig, UserConfig } from 'vite';

      export default defineConfig(
        (): UserConfig => ({
          test: {
            coverage: {
              reportsDirectory: '../../vite-coverage/apps/app1',
            },
          },
        }),
      );
      `;
  });

  afterEach((): void => {
    jest.clearAllMocks();
  });

  it('should scan project and dependencies & skip projects with no test target', async () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true)
    jest.spyOn(fs, 'readFileSync').mockReturnValue(viteConfig);
    sonarQubeScanner.mockResolvedValue(true);

    const newContext = { ...context };
    newContext.projectsConfigurations.projects['app1'].targets = {};

    const output = await sonarScanExecutor(
      {
        ...commonOptions,
        qualityGate: true,
      },
      newContext
    );
    expect(output.success).toBe(true);
  });

  it('should scan project and dependencies & skip projects with no vitest config', async () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true)
    jest.spyOn(fs, 'readFileSync').mockReturnValue(viteConfig);
    sonarQubeScanner.mockResolvedValue(true);

    const newContext = { ...context };
    newContext.projectsConfigurations.projects['app1'].targets.test.options = {};

    const output = await sonarScanExecutor(
      {
        ...commonOptions,
        qualityGate: true,
      },
      newContext
    );
    expect(output.success).toBe(true);
  });

  it('should scan project and dependencies & skip projects with no reportsDirectory', async () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true)
    jest.spyOn(fs, 'readFileSync').mockReturnValue(viteConfig)
    sonarQubeScanner.mockResolvedValue(true);

    const newContext = { ...context };
    newContext.projectsConfigurations.projects['app1'].targets.test.options = {
      coverage: true
    };

    const output = await sonarScanExecutor(
      {
        ...commonOptions,
        qualityGate: true,
      },
      context
    );
    expect(output.success).toBe(true);
  });

  it('should scan project and dependencies & skip projects with no vite config file', async () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(false)
    sonarQubeScanner.mockResolvedValue(true);

    const newContext = { ...context };
    newContext.projectsConfigurations.projects['app1'].targets.test.options = {
      coverage: true
    };

    const output = await sonarScanExecutor(
      {
        ...commonOptions,
        qualityGate: true,
      },
      context
    );
    expect(output.success).toBe(true);
  });

  it('should scan project and dependencies & skip projects with a vite config file without a reportsDirectory', async () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true)
    jest.spyOn(fs, 'readFileSync').mockReturnValue(`
      import { defineConfig, UserConfig } from 'vite';

      export default defineConfig(
        (): UserConfig => ({
          test: {
            coverage: {},
          },
        }),
      );
      `)
    sonarQubeScanner.mockResolvedValue(true);

    const newContext = { ...context };
    newContext.projectsConfigurations.projects['app1'].targets.test.options = {
      coverage: true
    };

    const output = await sonarScanExecutor(
      {
        ...commonOptions,
        qualityGate: true,
      },
      context
    );
    expect(output.success).toBe(true);
  });

  it('should error on sonar scanner issue', async () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true)
    jest.spyOn(fs, 'readFileSync').mockReturnValue(viteConfig)
    sonarQubeScanner.async.mockImplementation(() => {
      throw new Error();
    });

    const output = await sonarScanExecutor(
      commonOptions,
      context
    );
    expect(output.success).toBe(false);
  });

  it('should return vitest config coverage directory path', async () => {
    const paths = await determinePaths(
      commonOptions,
      context
    );
    expect(paths.lcovPaths.includes('coverage/apps/app1/lcov.info')).toBe(true);
  });

  it('should return project test config coverage directory path (from the options)', async () => {
    const testContext = JSON.parse(JSON.stringify(context)) as typeof context;
    testContext.projectsConfigurations.projects.app1.targets.test.options.reportsDirectory =
      'coverage/test/apps/app1';
    const paths = await determinePaths(
      commonOptions,
      testContext
    );
    expect(paths.lcovPaths.includes('coverage/test/apps/app1/lcov.info')).toBe(
      true
    );
  });

  it('should return project test config coverage directory path (from the option "configFile")', async () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true)
    jest.spyOn(fs, 'readFileSync').mockReturnValue(`
      import { defineConfig, UserConfig } from 'vite';

      export default defineConfig(
        (): UserConfig => ({
          test: {
            coverage: {
              reportsDirectory: '../../vite-custom-coverage/apps/app1',
            },
          },
        }),
      );
      `)
    const testContext = JSON.parse(JSON.stringify(context)) as typeof context;
    testContext.projectsConfigurations.projects.app1.targets.test.options = {
      configFile: '../../vite-custom-coverage/apps/app1'
    };

    const paths = await determinePaths(
      commonOptions,
      testContext
    );
    expect(paths.lcovPaths.includes('vite-custom-coverage/apps/app1/lcov.info')).toBe(
      true
    );
  });

  it('should return project test config coverage directory path (from the project vite config file)', async () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true)
    jest.spyOn(fs, 'readFileSync').mockReturnValue(viteConfig)
    const testContext = JSON.parse(JSON.stringify(context)) as typeof context;
    testContext.projectsConfigurations.projects.app1.targets.test.options = undefined;

    const paths = await determinePaths(
      commonOptions,
      testContext
    );
    expect(paths.lcovPaths.includes('vite-coverage/apps/app1/lcov.info')).toBe(
      true
    );
  });

  it('should return project test config coverage directory path (from the root vite.config.ts file)', async () => {
    jest.spyOn(fs, 'existsSync').mockReturnValueOnce(false).mockReturnValue(true)
    jest.spyOn(fs, 'readFileSync').mockReturnValue(viteConfig)
    const testContext = JSON.parse(JSON.stringify(context)) as typeof context;
    testContext.projectsConfigurations.projects.app1.targets.test.options = {};

    const paths = await determinePaths(
      commonOptions,
      testContext
    );
    expect(paths.lcovPaths.includes('vite-coverage/apps/app1/lcov.info')).toBe(
      true
    );
  });

  it('should return project test config coverage directory path (from the root vite.config.js file)', async () => {
    jest.spyOn(fs, 'existsSync').mockReturnValueOnce(false).mockReturnValue(true)
    jest.spyOn(fs, 'readFileSync').mockReturnValue(viteConfig)
    const testContext = JSON.parse(JSON.stringify(context)) as typeof context;
    testContext.projectsConfigurations.projects.app1.targets.test.options = {};

    const paths = await determinePaths(
      commonOptions,
      testContext
    );
    expect(paths.lcovPaths.includes('vite-coverage/apps/app1/lcov.info')).toBe(
      true
    );
  });
});
