import { ScanExecutorSchema } from '../schema';
import {
  createProjectGraphAsync,
  DependencyType,
  ExecutorContext,
  joinPathFragments,
  logger,
  ProjectGraph,
  readCachedProjectGraph,
  readJsonFile,
} from '@nx/devkit';
import { ast, query, ScriptKind } from '@phenomnomnominal/tsquery';
import * as sonarQubeScanner from 'sonarqube-scanner';
import { TargetConfiguration } from 'nx/src/config/workspace-json-project-json';
import { existsSync, readFileSync } from 'fs';

interface OptionMarshaller {
  Options(): { [option: string]: string };
}

enum TestRunner {
  Jest,
  Vitest,
}

export declare type WorkspaceLibrary = {
  name: string;
  type: DependencyType | string;
  projectRoot: string;
  sourceRoot: string;
  testTarget?: TargetConfiguration;
};
class ExtraMarshaller implements OptionMarshaller {
  private readonly options: { [option: string]: string };
  constructor(options: { [option: string]: string }) {
    this.options = options;
  }
  Options(): { [p: string]: string } {
    return this.options;
  }
}
class EnvMarshaller implements OptionMarshaller {
  Options(): { [p: string]: string } {
    return Object.keys(process.env)
      .filter((e) => e.startsWith('SONAR'))
      .reduce((option, env) => {
        let sonarEnv = env.toLowerCase();
        sonarEnv = sonarEnv.replace(/_/g, '.');
        option[sonarEnv] = process.env[env];
        return option;
      }, {});
  }
}

function getTestRunner(project: WorkspaceLibrary): TestRunner {
  let testRunner: TestRunner;
  const executor = project.testTarget.executor;

  if (executor.includes('vite')) {
    testRunner = TestRunner.Vitest;
  } else if (executor.includes('jest')) {
    testRunner = TestRunner.Jest;
  } else if (executor.includes('run-commands')) {
    // project crystal
    const command = project.testTarget.options.command;
    if (command.includes('vitest')) {
      testRunner = TestRunner.Vitest;
    } else if (command.includes('jest')) {
      testRunner = TestRunner.Jest;
    }
  }
  return testRunner;
}

type CoverageDirectoryName = 'coverageDirectory' | 'reportsDirectory';

function getCoverageDirectoryName(
  testRunner: TestRunner
): CoverageDirectoryName {
  let coverageDirectory: CoverageDirectoryName;
  if (testRunner === TestRunner.Vitest) {
    coverageDirectory = 'reportsDirectory';
  } else if (testRunner === TestRunner.Jest) {
    coverageDirectory = 'coverageDirectory';
  }
  return coverageDirectory;
}

export async function determinePaths(
  options: ScanExecutorSchema,
  context: ExecutorContext
): Promise<{ lcovPaths: string; sources: string }> {
  const sources: string[] = [];
  const lcovPaths: string[] = [];
  const deps = await getDependentPackagesForProject(context.projectName);
  const projectConfiguration = context.projectsConfigurations.projects[context.projectName];
  deps.workspaceLibraries.push({
    name: context.projectName,
    type: DependencyType.static,
    projectRoot: projectConfiguration.root,
    sourceRoot: projectConfiguration.sourceRoot,
    testTarget: projectConfiguration.targets.test,
  });

  deps.workspaceLibraries
    .filter((project) =>
      options.skipImplicitDeps ? project.type !== DependencyType.implicit : true
    )
    .forEach((dep) => {
      if (dep.sourceRoot) {
        sources.push(dep.sourceRoot);
      } else {
        sources.push(dep.projectRoot);
      }

      if (dep.testTarget) {
        const testRunner: TestRunner = getTestRunner(dep);
        const coverageDirectoryName: CoverageDirectoryName =
          getCoverageDirectoryName(testRunner);

        if (dep.testTarget.options?.[coverageDirectoryName]) {
          lcovPaths.push(
            joinPathFragments(
              dep.testTarget.options[coverageDirectoryName]
                .replace(new RegExp(/'/g), '')
                .replace(/^(?:\.\.\/)+/, ''),
              'lcov.info'
            )
          );
        } else if (testRunner === TestRunner.Jest) {
          const jestConfigPath: string = joinPathFragments(
            context.root,
            dep.projectRoot,
            'jest.config.ts'
          );

          if (!existsSync(jestConfigPath)) {
            logger.warn(
              `Skipping ${dep.name} as the jest config file cannot be found`
            );
            return;
          }

          const jestConfig = readFileSync(jestConfigPath, 'utf-8');
          const astOutput = ast(jestConfig);
          const nodes = query(
            astOutput as unknown as string,
            'PropertyAssignment:has(Identifier[name="coverageDirectory"]) StringLiteral',
            ScriptKind.TS,
          );
          if (nodes.length) {
            lcovPaths.push(
              joinPathFragments(
                nodes[0]
                  .getText()
                  .replace(new RegExp(/'/g), '')
                  .replace(/^(?:\.\.\/)+/, ''),
                'lcov.info'
              )
            );
          } else {
            logger.warn(
              `Skipping ${dep.name} as it does not have a coverageDirectory in ${jestConfigPath}`
            );
          }
        } else if (TestRunner.Vitest) {
          const viteConfigPath: string = joinPathFragments(
            context.root,
            dep.projectRoot,
            'vite.config.ts'
          );

          if (!existsSync(viteConfigPath)) {
            logger.warn(
              `Skipping ${dep.name} as the vite config file cannot be found`
            );

            return;
          }

          const config = readFileSync(viteConfigPath, 'utf-8');
          const astOutput = ast(config);
          const nodes = query(
            astOutput as unknown as string,
            'PropertyAssignment:has(Identifier[name="reportsDirectory"]) StringLiteral',
            ScriptKind.TS
          );

          if (nodes.length) {
            lcovPaths.push(
              joinPathFragments(
                nodes[0]
                  .getText()
                  .replace(new RegExp(/'/g), '')
                  .replace(/^(?:\.\.\/)+/, ''),
                'lcov.info'
              )
            );
          } else {
            logger.warn(
              `Skipping ${dep.name} as it does not have a reportsDirectory in ${viteConfigPath}`
            );
          }
        }
      } else {
        logger.warn(`Skipping ${dep.name} as it does not have a test target`);
      }
    });

  return Promise.resolve({
    lcovPaths: lcovPaths.join(','),
    sources: sources.join(','),
  });
}

export async function scanner(
  options: ScanExecutorSchema,
  context: ExecutorContext
): Promise<{ success: boolean }> {
  const paths = await determinePaths(options, context);

  logger.log(`Included sources paths: ${paths.sources}`);
  logger.log(`Included lcov paths: ${paths.lcovPaths}`);

  if (!options.qualityGate) logger.warn(`Skipping quality gate check`);

  const scannerOptions = getScannerOptions(
    context,
    options,
    paths.sources,
    paths.lcovPaths
  );
  const success = await sonarQubeScanner.async({
    serverUrl: options.hostUrl,
    options: scannerOptions,
  });

  return {
    success: success,
  };
}
export function getScannerOptions(
  context: ExecutorContext,
  options: ScanExecutorSchema,
  sources: string,
  lcovPaths: string
): { [option: string]: string } {
  let scannerOptions: { [option: string]: string } = {
    'sonar.exclusions': options.exclusions,
    'sonar.javascript.lcov.reportPaths': lcovPaths,
    'sonar.language': 'ts',
    'sonar.login': process.env.SONAR_LOGIN,
    'sonar.organization': options.organization,
    'sonar.password': process.env.SONAR_PASSWORD,
    'sonar.projectKey': options.projectKey,
    'sonar.projectName': options.projectName,
    'sonar.projectVersion': projectPackageVersion(context, options),
    'sonar.qualitygate.timeout': options.qualityGateTimeout,
    'sonar.qualitygate.wait': String(options.qualityGate),
    'sonar.scm.provider': 'git',
    'sonar.sources': sources,
    'sonar.sourceEncoding': 'UTF-8',
    'sonar.tests': sources,
    'sonar.test.inclusions': options.testInclusions,
    'sonar.typescript.tsconfigPath': options.tsConfig,
    'sonar.verbose': String(options.verbose),
  };
  if (options.branch) {
    scannerOptions['sonar.branch.name'] = options.branch;
  }
  scannerOptions = combineOptions(
    new ExtraMarshaller(options.extra),
    new EnvMarshaller(),
    scannerOptions
  );
  return scannerOptions;
}
async function getDependentPackagesForProject(name: string): Promise<{
  workspaceLibraries: WorkspaceLibrary[];
}> {
  let projectGraph: ProjectGraph;

  try {
    projectGraph = readCachedProjectGraph();
  } catch (e) {
    projectGraph = await createProjectGraphAsync();
  }

  const { workspaceLibraries } = collectDependencies(projectGraph, name);

  return Promise.resolve({
    workspaceLibraries: [...workspaceLibraries.values()],
  });
}
function combineOptions(
  extraOptions: ExtraMarshaller,
  envOptions: EnvMarshaller,
  scannerOptions: { [option: string]: string }
): { [option: string]: string } {
  return {
    ...extraOptions.Options(),
    ...scannerOptions,
    ...envOptions.Options(),
  };
}

export function projectPackageVersion(
  context: ExecutorContext,
  options: ScanExecutorSchema
): string {
  const projectName = context.projectName;
  let version = options.projectVersion;
  if (version) {
    return version;
  }
  version = getPackageJsonVersion(context.projectsConfigurations.projects[projectName].root);
  if (version) {
    return version;
  }
  version = getPackageJsonVersion();
  return version;
}
function getPackageJsonVersion(dir = ''): string {
  let version = '';
  try {
    const packageJson = readJsonFile(joinPathFragments(dir, 'package.json'));
    version = packageJson.version;
    if (!version) {
      version = '';
    }
    logger.debug(
      `resolved package json from ${dir}, package version:${version}`
    );
  } catch (e) {
    logger.debug(
      `Unable to open file ${joinPathFragments(dir, 'package.json')}`
    );
  }
  return version;
}
function collectDependencies(
  projectGraph: ProjectGraph,
  name: string,
  dependencies = {
    workspaceLibraries: new Map<string, WorkspaceLibrary>(),
  },
  seen: Set<string> = new Set()
): {
  workspaceLibraries: Map<string, WorkspaceLibrary>;
} {
  if (seen.has(name)) {
    return dependencies;
  }
  seen.add(name);

  (projectGraph.dependencies[name] ?? []).forEach((dependency) => {
    if (!dependency.target.startsWith('npm:')) {
      dependencies.workspaceLibraries.set(dependency.target, {
        name: dependency.target,
        type: dependency.type,
        projectRoot: projectGraph.nodes[dependency.target].data.root,
        sourceRoot: projectGraph.nodes[dependency.target].data.sourceRoot,
        testTarget: projectGraph.nodes[dependency.target].data.targets.test,
      });
      collectDependencies(projectGraph, dependency.target, dependencies, seen);
    }
  });

  return dependencies;
}
