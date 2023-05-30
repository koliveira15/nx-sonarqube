import { checkFilesExist } from '@nx/plugin/testing';
import { execSync } from 'child_process';

describe('nx-sonarqube e2e', () => {
  it('should pass quality gate for repository', async () => {
    execSync(`npx nx sonar nx-sonarqube-e2e`);
    checkFilesExist(`coverage/packages/nx-sonarqube/lcov.info`);
  }, 300000);
});
