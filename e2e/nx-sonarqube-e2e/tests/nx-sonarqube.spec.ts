import { execSync } from 'child_process';

describe('nx-sonarqube e2e', () => {
  it('should use the sonar executor & pass quality gate for this repository', async () => {
    const result = execSync('npx nx sonar nx-sonarqube-e2e').toString();
    expect(result).toContain('QUALITY GATE STATUS: PASSED');
  }, 300000);
  console.log('test')
});
