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
  skipImplicitDeps?: boolean;
  testInclusions?: string;
  tsConfig?: string;
  verbose?: boolean;
  extra?: { [option: string]: string };
}
