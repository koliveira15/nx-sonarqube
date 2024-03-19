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
  skipDependencyTypes?: Array<'implicit' | 'static' | 'dynamic'>;
  skipProjects?: string[];
  skipPaths?: string[];
  skipTags?: string[];
  testInclusions?: string;
  tsConfig?: string;
  verbose?: boolean;
  extra?: { [option: string]: string };
}
