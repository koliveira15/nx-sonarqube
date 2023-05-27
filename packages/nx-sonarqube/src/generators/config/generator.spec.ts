import {
  addProjectConfiguration,
  readNxJson,
  readProjectConfiguration,
  Tree,
  updateNxJson,
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
    updateNxJson(tree, {
      ...readNxJson(tree),
      targetDefaults: {},
    });
  });

  it('should generate target with target defaults', async () => {
    await sonarQubeConfigGenerator(tree, {
      name: 'my-app',
      hostUrl: 'sonar.url.com',
      projectKey: 'my-app-key',
      skipTargetDefaults: false,
    });

    const targetDefaults = readNxJson(tree).targetDefaults;
    expect(
      readProjectConfiguration(tree, 'my-app').targets.sonar
    ).toBeDefined();
    expect(targetDefaults.sonar).toBeDefined();
    expect(targetDefaults.test).toBeDefined();
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
