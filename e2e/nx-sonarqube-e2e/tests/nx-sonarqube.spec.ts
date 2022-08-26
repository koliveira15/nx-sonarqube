import {
  cleanup,
  ensureNxProject,
  runCommand,
  runNxCommandAsync,
  uniq,
} from '@nrwl/nx-plugin/testing';

describe('nx-sonarqube e2e', () => {
  beforeAll(() => {
    ensureNxProject('@koliveira15/nx-sonarqube', 'dist/packages/nx-sonarqube');
  });

  afterAll(() => {
    runNxCommandAsync('reset');
    cleanup();
  });

  it('should configure nx-sonarqube', async () => {
    const project = uniq('nx-sonarqube');
    const hostUrl = 'https://sonarcloud.io';
    const projectKey = 'lib-a';
    runCommand('npm i -D @nrwl/js');
    await runNxCommandAsync(`generate @nrwl/js:lib --name ${project}`);
    await runNxCommandAsync(
      `generate @koliveira15/nx-sonarqube:config --name ${project} --hostUrl ${hostUrl} --projectKey ${projectKey}`
    );
    const result = await runNxCommandAsync(`sonar ${project}`);
    expect(result.stdout).toContain(`Included source: libs/${project}/src`);
  }, 120000);

  // describe('--directory', () => {
  //   it('should create src in the specified directory', async () => {
  //     const project = uniq('nx-sonarqube');
  //     await runNxCommandAsync(
  //       `generate @koliveira15/nx-sonarqube:nx-sonarqube ${project} --directory subdir`
  //     );
  //     expect(() =>
  //       checkFilesExist(`libs/subdir/${project}/src/index.ts`)
  //     ).not.toThrow();
  //   }, 120000);
  // });
  //
  // describe('--tags', () => {
  //   it('should add tags to the project', async () => {
  //     const projectName = uniq('nx-sonarqube');
  //     ensureNxProject(
  //       '@koliveira15/nx-sonarqube',
  //       'dist/packages/nx-sonarqube'
  //     );
  //     await runNxCommandAsync(
  //       `generate @koliveira15/nx-sonarqube:nx-sonarqube ${projectName} --tags e2etag,e2ePackage`
  //     );
  //     const project = readJson(`libs/${projectName}/project.json`);
  //     expect(project.tags).toEqual(['e2etag', 'e2ePackage']);
  //   }, 120000);
  // });
});
