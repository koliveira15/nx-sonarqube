import {
  addProjectConfiguration,
  readNxJson,
  readProjectConfiguration,
  Tree,
  updateNxJson,
  updateProjectConfiguration,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import sonarQubeConfigGenerator from './generator';

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
      readProjectConfiguration(tree, 'my-app').targets.sonar,
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

  it('should not duplicate the git ignore entry', async () => {
    tree.write('.gitignore', '.scannerwork');
    await sonarQubeConfigGenerator(tree, {
      name: 'my-app',
      hostUrl: 'sonar.url.com',
      projectKey: 'my-app-key',
      skipTargetDefaults: false,
    });
    expect(tree.read('.gitignore').toString()).toBe('.scannerwork');
  });

  it('should skip target defaults', async () => {
    await sonarQubeConfigGenerator(tree, {
      name: 'my-app',
      hostUrl: 'sonar.url.com',
      projectKey: 'my-app-key',
      skipTargetDefaults: true,
    });
    expect(readNxJson(tree).targetDefaults).toEqual({});
  });

  it('should create target defaults when missing from nx.json', async () => {
    const { targetDefaults, ...nxJson } = readNxJson(tree);
    updateNxJson(tree, nxJson);
    await sonarQubeConfigGenerator(tree, {
      name: 'my-app',
      hostUrl: 'sonar.url.com',
      projectKey: 'my-app-key',
      skipTargetDefaults: false,
    });
    expect(readNxJson(tree).targetDefaults.sonar).toBeDefined();
  });

  it('should keep existing target defaults', async () => {
    const existing = {
      sonar: { dependsOn: ['custom'] },
      test: { cache: true },
    };
    updateNxJson(tree, { ...readNxJson(tree), targetDefaults: existing });
    await sonarQubeConfigGenerator(tree, {
      name: 'my-app',
      hostUrl: 'sonar.url.com',
      projectKey: 'my-app-key',
      skipTargetDefaults: false,
    });
    expect(readNxJson(tree).targetDefaults).toEqual(existing);
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
