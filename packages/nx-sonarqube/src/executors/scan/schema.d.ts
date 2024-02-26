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
  skipTypeDeps?: string[];
  skipProjects?: string[];
  skipPaths?: string[];
  testInclusions?: string;
  tsConfig?: string;
  verbose?: boolean;
  extra?: { [option: string]: string };
}
