import { ScanExecutorSchema } from '../schema';

import {
  createProjectGraphAsync,
  DependencyType,
  ExecutorContext,
  joinPathFragments,
  logger,
  ProjectGraph,
  readCachedProjectGraph,
} from '@nrwl/devkit';
import { readFileSync } from 'fs';
import { tsquery } from '@phenomnomnominal/tsquery';
import { execSync } from 'child_process';
import * as sonarQubeScanner from 'sonarqube-scanner';
import { TargetConfiguration } from 'nx/src/config/workspace-json-project-json';
interface OptionMarshaller {
  Options(): { [option: string]: string };
}

export declare type WorkspaceLibrary = {
  name: string;
  type: DependencyType | string;
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

export async function determinePaths(
  options: ScanExecutorSchema,
  context: ExecutorContext
): Promise<{ lcovPaths: string; sources: string }> {
  const sources: string[] = [];
  const lcovPaths: string[] = [];
  const deps = await getDependentPackagesForProject(context.projectName);
  const projectConfiguration = context.workspace.projects[context.projectName];
  deps.workspaceLibraries.push({
    name: context.projectName,
    type: DependencyType.static,
    sourceRoot: projectConfiguration.sourceRoot,
    testTarget: projectConfiguration.targets.test,
  });

  deps.workspaceLibraries
    .filter((project) =>
      options.skipImplicitDeps
        ? project.type === DependencyType.static
        : project.type === DependencyType.static ||
          project.type === DependencyType.implicit
    )
    .forEach((dep) => {
      sources.push(dep.sourceRoot);

      if (dep.testTarget) {
        if (dep.testTarget.options.coverageDirectory) {
          lcovPaths.push(
            joinPathFragments(
              dep.testTarget.options.coverageDirectory
                .replace(new RegExp(/'/g), '')
                .replace(/^(?:\.\.\/)+/, ''),
              'lcov.info'
            )
          );
        } else if (dep.testTarget.options.jestConfig) {
          const jestConfigPath = dep.testTarget.options.jestConfig;
          const jestConfig = readFileSync(jestConfigPath, 'utf-8');
          const ast = tsquery.ast(jestConfig);
          const nodes = tsquery(
            ast,
            'Identifier[name="coverageDirectory"] ~ StringLiteral',
            { visitAllChildren: true }
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
              `Skipping ${context.projectName} as it does not have a coverageDirectory in ${jestConfigPath}`
            );
          }
        } else {
          logger.warn(
            `Skipping ${context.projectName} as it does not have a jestConfig`
          );
        }
      } else {
        logger.warn(
          `Skipping ${context.projectName} as it does not have a test target`
        );
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

  logger.log(`Included sources: ${paths.sources}`);
  if (!options.qualityGate) logger.warn(`Skipping quality gate check`);

  let branch = '';
  if (options.branches) {
    branch = execSync('git rev-parse --abbrev-ref HEAD').toString();
  }
  const scannerOptions = getScannerOptions(
    options,
    paths.sources,
    paths.lcovPaths,
    branch
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
  options: ScanExecutorSchema,
  sources: string,
  lcovPaths: string,
  branch: string
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
    'sonar.projectVersion': options.projectVersion,
    'sonar.qualitygate.timeout': options.qualityGateTimeout,
    'sonar.qualitygate.wait': String(options.qualityGate),
    'sonar.scm.provider': 'git',
    'sonar.sources': sources,
    'sonar.sourceEncoding': 'UTF-8',
    'sonar.tests': sources,
    'sonar.test.inclusions': options.testInclusions,
    'sonar.typescript.tsconfigPath': 'tsconfig.base.json',
    'sonar.verbose': String(options.verbose),
  };
  if (options.branches) {
    scannerOptions['sonar.branch.name'] = branch;
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
        sourceRoot: projectGraph.nodes[dependency.target].data.sourceRoot,
        testTarget: projectGraph.nodes[dependency.target].data.targets.test,
      });
      collectDependencies(projectGraph, dependency.target, dependencies, seen);
    }
  });

  return dependencies;
}
