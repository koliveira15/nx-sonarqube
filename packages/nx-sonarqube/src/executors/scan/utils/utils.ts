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
import { execSync } from 'child_process';
import * as sonarQubeScanner from 'sonarqube-scanner';
import { TargetConfiguration } from 'nx/src/config/workspace-json-project-json';

export declare type WorkspaceLibrary = {
  name: string;
  type: DependencyType | string;
  sourceRoot: string;
  testTarget?: TargetConfiguration;
};

async function determinePaths(
  options: ScanExecutorSchema,
  context: ExecutorContext
): Promise<{ lcovPaths: string; sources: string }> {
  const sources: string[] = [];
  const lcovPaths: string[] = [];
  const deps = await getDependentPackagesForProject(context.projectName);

  logger.info(`Found ${deps.workspaceLibraries.length} workspace libraries depending on ${context.projectName}`)

  const projectConfiguration = context.workspace.projects[context.projectName];
  deps.workspaceLibraries.push({
    name: context.projectName,
    type: DependencyType.static,
    sourceRoot: projectConfiguration.sourceRoot,
    testTarget: projectConfiguration.targets.test,
  });

  deps.workspaceLibraries
    .filter((project):boolean =>
      options.skipImplicitDeps
        ? project.type === DependencyType.static
        : project.type === DependencyType.static ||
          project.type === DependencyType.implicit
    )
    .forEach((dep):void => {
      sources.push(dep.sourceRoot);

      if (dep.testTarget) {
        if (dep.testTarget.options.reportsDirectory) {
          const lcovPath: string = joinPathFragments(
            dep.testTarget.options.reportsDirectory
              .replace(new RegExp(/'/g), '')
              .replace(/^(?:\.\.\/)+/, ''),
            'lcov.info'
          );

          logger.info(`Found a report file => ${lcovPath}`)
          lcovPaths.push(lcovPath);
        } else {
          logger.warn(
            `Skipping ${context.projectName} as it does not have a reportsDirectory`
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
) {
  const paths = await determinePaths(options, context);

  logger.log(`Included sources: ${paths.sources}`);
  if (!options.qualityGate) logger.warn(`Skipping quality gate check`);

  let scannerOptions: { [option: string]: string } = {
    'sonar.exclusions': options.exclusions,
    'sonar.javascript.lcov.reportPaths': paths.lcovPaths,
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
    'sonar.sources': paths.sources,
    'sonar.sourceEncoding': 'UTF-8',
    'sonar.tests': paths.sources,
    'sonar.test.inclusions': options.testInclusions,
    'sonar.typescript.tsconfigPath': 'tsconfig.base.json',
    'sonar.verbose': String(options.verbose),
    'sonar.projectBaseDir': options.projectBaseDir,
    'sonar.pullrequest.github.summary_comment': String(options.gitHubPullRequestSummaryComment)
  };

  if (options.branches) {
    scannerOptions = {
      'sonar.branch.name': execSync(
        'git rev-parse --abbrev-ref HEAD'
      ).toString(),
      ...scannerOptions,
    };
  }

  await sonarQubeScanner.async({
    serverUrl: options.hostUrl,
    options: scannerOptions,
  });
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

  (projectGraph.dependencies[name] ?? []).forEach((dependency): void => {
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
