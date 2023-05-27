import {
  addProjectConfiguration,
  NxJsonConfiguration,
  readProjectConfiguration,
  Tree,
  updateJson,
  updateProjectConfiguration,
} from '@nx/devkit';
import sonarQubeConfigGenerator from './generator';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

describe('Configuration generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'my-app', {
      root: 'apps/my-app',
      targets: {},
    });
    updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
      json.targetDefaults = {};
      return json;
    });
  });

  it('should generate target', async () => {
    await sonarQubeConfigGenerator(tree, {
      name: 'my-app',
      hostUrl: 'sonar.url.com',
      projectKey: 'my-app-key',
      skipTargetDefaults: false,
    });
    expect(
      readProjectConfiguration(tree, 'my-app').targets.sonar
    ).toBeDefined();
  });

  it('should add git ignores', async () => {
    tree.write('.gitignore', '');
    await sonarQubeConfigGenerator(tree, {
      name: 'my-app',
      hostUrl: 'sonar.url.com',
      projectKey: 'my-app-key',
      skipTargetDefaults: false,
    });
    expect(tree.read('.gitignore').toString()).toContain('.scannerwork');
  });

  it('should error if project has sonar config already', async () => {
    expect.assertions(1);
    updateProjectConfiguration(tree, 'my-app', {
      root: 'apps/my-app',
      targets: {
        sonar: {
          executor: '',
          options: {},
        },
      },
    });
    await sonarQubeConfigGenerator(tree, {
      name: 'my-app',
      hostUrl: 'sonar.url.com',
      projectKey: 'my-app-key',
      skipTargetDefaults: false,
    }).catch((e) => {
      expect(e).toBeDefined();
    });
  });
});
