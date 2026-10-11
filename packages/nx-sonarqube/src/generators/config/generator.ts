import {
  formatFiles,
  NxJsonConfiguration,
  readProjectConfiguration,
  Tree,
  updateJson,
  updateProjectConfiguration,
} from '@nx/devkit';
import { NxSonarqubeGeneratorSchema } from './schema';

export default async function (
  tree: Tree,
  options: NxSonarqubeGeneratorSchema,
) {
  updateGitIgnore(tree);
  if (!options.skipTargetDefaults) {
    updateTargetDefaults(tree);
  }
  updateProjectConfig(tree, options);
  await formatFiles(tree);
}

function updateGitIgnore(tree: Tree): void {
  const ignoreFile = '.gitignore';

  if (tree.exists(ignoreFile)) {
    let gitIgnore = tree.read('.gitignore').toString('utf-8');
    if (!gitIgnore.includes('.scannerwork')) {
      gitIgnore += '\n# Sonar\n.scannerwork';
      tree.write(ignoreFile, gitIgnore);
    }
  }
}

function updateTargetDefaults(tree: Tree): void {
  updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
    json.targetDefaults ??= {};
    if (!json.targetDefaults.sonar) {
      json.targetDefaults.sonar = {
        dependsOn: ['^test', 'test'],
      };
    }
    if (!json.targetDefaults.test) {
      json.targetDefaults.test = {
        dependsOn: ['^test'],
      };
    }
    return json;
  });
}

function updateProjectConfig(
  tree: Tree,
  options: NxSonarqubeGeneratorSchema,
): void {
  const projectConfiguration = readProjectConfiguration(tree, options.name);

  if (projectConfiguration.targets.sonar) {
    throw new Error(
      `Project "${options.name}" already has a "sonar" target configured`,
    );
  } else {
    projectConfiguration.targets.sonar = {
      executor: '@gduquenne/nx-sonarqube:scan',
      options: {
        hostUrl: options.hostUrl,
        projectKey: options.projectKey,
      },
    };
    updateProjectConfiguration(tree, options.name, projectConfiguration);
  }
}
