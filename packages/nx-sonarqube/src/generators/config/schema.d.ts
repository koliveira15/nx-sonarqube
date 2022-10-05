export interface NxSonarqubeGeneratorSchema {
  name: string;
  hostUrl: string;
  projectKey: string;
  skipTargetDefaults?: boolean;
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
