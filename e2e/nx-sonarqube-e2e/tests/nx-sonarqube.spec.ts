import {
  ensureNxProject,
  readFile,
  readJson,
  runCommand,
  runNxCommandAsync,
  uniq,
} from '@nrwl/nx-plugin/testing';
import { writeFileSync } from 'fs';
import { updateFile } from '@nrwl/nx-plugin/src/utils/testing-utils/utils';
import { names } from '@nrwl/devkit';

const TIMEOUT = 120000;

describe('nx-sonarqube e2e', () => {
  const project = uniq('nx-sonarqube');
  const project2 = uniq('nx-sonarqube-two');
  const hostUrl = 'https://sonarcloud.io';
  const projectKey = 'lib-a'; // todo: create a specific e2e-project in sonar cloud instead
  const organization = 'koliveira15';
  const exclusions = '**/*.spec.ts';
  const token = '8f623bdce54e45f9b6108461b71427e371340d91'; // todo: better way to pass?

  beforeAll(async () => {
    ensureNxProject('@koliveira15/nx-sonarqube', 'dist/packages/nx-sonarqube');
    await buildLibraries([project, project2]);
    createDependency(project, project2);
    const jest = readFile(`jest.preset.js`).replace(
      'module.exports = { ...nxPreset };',
      `module.exports = {
  ...nxPreset,
  collectCoverage: true,
  coverageReporters: ["lcov"],
};`
    );
    updateFile(`jest.preset.js`, jest);
  }, TIMEOUT);

  afterAll(() => {
    runNxCommandAsync('reset');
  });

  // todo: create dep graph between two libs
  // todo: generate lcov reports
  it(
    'should configure nx-sonarqube',
    async () => {
      await runNxCommandAsync(
        `generate @koliveira15/nx-sonarqube:config --name ${project} --hostUrl ${hostUrl} --projectKey ${projectKey} --organization ${organization} --exclusions ${exclusions} --login ${token}`
      );
      const result = await runNxCommandAsync(`sonar ${project}`);
      expect(result.stdout).toContain(`Included sources: libs/${project}/src`);
    },
    TIMEOUT
  );
});

async function buildLibraries(projects: string[]) {
  runCommand('npm i -D @nrwl/js');
  for (let i = 0; i < projects.length; i++) {
    await runNxCommandAsync(`generate @nrwl/js:lib --name ${projects[i]}`);

    const projectPath = `libs/${projects[i]}/project.json`;
    const projectJson = readJson(projectPath);
    projectJson.targets.test.options.codeCoverage = true;
    writeFileSync(
      `tmp/nx-e2e/proj/${projectPath}`,
      JSON.stringify(projectJson, null, 2)
    );
  }
}

function createDependency(project: string, project2: string) {
  const declaration = names(project).propertyName;
  const importPath = names(project).fileName;
  const declaration2 = names(project2).propertyName;
  const importPath2 = names(project2).fileName;
  const content = `import {${declaration2}} from '@proj/${importPath2}';
                      export function ${declaration}(): string {
                        return ${declaration2}();
                    }`;
  const specContent = readFile(
    `libs/${project}/src/lib/${project}.spec.ts`
  ).replace(`.toEqual('${importPath}')`, `.toBeDefined();`);
  updateFile(`libs/${project}/src/lib/${project}.ts`, content);
  updateFile(`libs/${project}/src/lib/${project}.spec.ts`, specContent);
}
