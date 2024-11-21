export interface ScanExecutorSchema {
  hostUrl: string;
  projectKey: string;
  branch?: string;
  exclusions?: string;
  organization?: string;
  projectName?: string;
  projectVersion?: string;
  qualityGate?: boolean;
  qualityGateTimeout?: string;
  // replace next lines with something like skipDeps?: 'all' | 'implicit' | 'none'; defaulting to 'none'
  skipImplicitDeps?: boolean;
  skipAllDeps?: boolean;
  testInclusions?: string;
  tsConfig?: string;
  verbose?: boolean;
  extra?: { [option: string]: string };
}
