export interface ScanExecutorSchema {
  hostUrl: string;
  projectKey: string;
  branches?: boolean;
  exclusions?: string;
  login?: string;
  organization?: string;
  password?: string;
  projectName?: string;
  projectVersion?: string;
  qualityGate?: boolean;
  qualityGateTimeout?: string;
  skipImplicitDeps?: boolean;
}
