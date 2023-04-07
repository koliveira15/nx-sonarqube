export interface ScanExecutorSchema {
  hostUrl: string;
  projectKey: string;
  branches?: boolean;
  exclusions?: string;
  organization?: string;
  projectName?: string;
  projectVersion?: string;
  qualityGate?: boolean;
  qualityGateTimeout?: string;
  skipImplicitDeps?: boolean;
  testInclusions?: string;
  verbose?: boolean;
  projectBaseDir?: string;
  gitHubPullRequestSummaryComment?: boolean;
  pullRequestProvider?: string;
  pullRequestBranch: string;
  pullRequestKey: string;
  pullRequestBase: string;
}
