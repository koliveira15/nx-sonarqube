import { ScanExecutorSchema } from './schema';
import * as sonarQubeScanner from 'sonarqube-scanner';
import {
  createProjectGraphAsync,
  DependencyType,
  ExecutorContext,
  joinPathFragments,
  logger,
} from '@nrwl/devkit';
import { tsquery } from '@phenomnomnominal/tsquery';
import { readFileSync } from 'fs';
import { execSync } from 'child_process';

export default async function sonarScanExecutor(
  options: ScanExecutorSchema,
  context: ExecutorContext
): Promise<{ success: boolean }> {
  let success = true;

  await scanner(options, context).catch((e) => {
    logger.error(
      `The SonarQube scan failed for project '${context.projectName}'. Error: ${e}`
    );
    success = false;
  });

  return {
    success: success,
  };
}

async function determinePaths(
  options: ScanExecutorSchema,
  context: ExecutorContext
): Promise<{ lcovPaths: string; sources: string }> {
  const sources: string[] = [];
  const lcovPaths: string[] = [];
  const graph = await createProjectGraphAsync();
  const targets = graph.dependencies[context.projectName].filter(
    (project) =>
      (options.skipImplicitDeps
        ? project.type === DependencyType.static
        : project.type === DependencyType.static ||
          project.type === DependencyType.implicit) &&
      !project.target.includes('npm:')
  );
  targets.push({
    type: DependencyType.static,
    target: context.projectName,
    source: context.projectName,
  });

  targets.forEach((target) => {
    const projectConfig = context.workspace.projects[target.target];
    const testTarget = projectConfig.targets.test;
    sources.push(projectConfig.sourceRoot);

    if (testTarget) {
      if (testTarget.options.jestConfig) {
        const jestConfigPath = projectConfig.targets.test.options.jestConfig;
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

async function scanner(options: ScanExecutorSchema, context: ExecutorContext) {
  const paths = await determinePaths(options, context);

  logger.log(`Included sources: ${paths.sources}`);
  if (!options.qualityGate) logger.warn(`Skipping quality gate check`);

  sonarQubeScanner({
    serverUrl: options.hostUrl,
    options: {
      'sonar.branch.name': options.branches
        ? execSync('git rev-parse --abbrev-ref HEAD').toString()
        : '',
      'sonar.exclusions': options.exclusions,
      'sonar.javascript.lcov.reportPaths': paths.lcovPaths,
      'sonar.language': 'ts',
      'sonar.login': options.login,
      'sonar.organization': options.organization,
      'sonar.password': options.password,
      'sonar.projectKey': options.projectKey,
      'sonar.projectName': options.projectName,
      'sonar.projectVersion': options.projectVersion,
      'sonar.qualitygate.timeout': options.qualityGateTimeout,
      'sonar.qualitygate.wait': String(options.qualityGate),
      'sonar.scm.provider': 'git',
      'sonar.sources': paths.sources,
      'sonar.sourceEncoding': 'UTF-8',
      'sonar.typescript.tsconfigPath': 'tsconfig.base.json',
      'sonar.verbose': 'true',
    },
  });
}
