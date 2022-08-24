export interface NxSonarqubeGeneratorSchema {
  name: string;
  hostUrl: string;
  projectKey: string;
  skipTargetDefaults?: boolean;
}
