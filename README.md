# @koliveira15/nx-sonarqube

![logo](https://i.ibb.co/R0bzqtP/nx-sonarqube.png)

## About

A Nx plugin that analyses a given project using [SonarQube](https://www.sonarqube.org)
/ [SonarCloud](https://sonarcloud.io).

![graph](https://i.ibb.co/qYb9vXk/graph.png)

To analyze "app-one", we need to know the project's dependencies. Using the Nx project graph,
we see that this project has three dependencies, two static and one implicit. With this information,
the plugin gathers the source and coverage paths for the analysis.

Sources:

- apps/app-one/src
- libs/lib-b/src
- libs/lib-c/src
- libs/libs-d/src

lcov Paths:

- coverage/apps/app-one/lcov.info
- coverage/libs/lib-b/lcov.info
- coverage/libs/lib-c/lcov.info
- coverage/libs/libs-d/lcov.info

## Usage

1. Install the package:
   ```bash
   npm i -D @koliveira15/nx-sonarqube
   ```
2. Execute the configuration generator to setup sonar for a given project:
   ```bash
   npx nx g @koliveira15/nx-sonarqube:config
   ```
3. Execute the sonar target for the given project:
   ```bash
   npx nx sonar my-project
   ```
   or
   ```bash
   npx nx affected --target sonar --parallel 1
   ```
   **Note:** Due to limitations with the scanner, you cannot run more than one scan in parallel

## Customization

Modify the executor options based on the configuration table below. These options are based on [Analysis Parameters](https://docs.sonarqube.org/latest/analysis/analysis-parameters/)

| Name               | Required | Description                                                                                                                                        | Default               |
| ------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| hostUrl            | Yes      | Sonar server URL                                                                                                                                   | http://localhost:9000 |
| projectKey         | Yes      | The project's unique key. Allowed characters are: letters, numbers, -, \_, . and :, with at least one non-digit.                                   |                       |
| branches           | No       | Include branch name in analysis                                                                                                                    | false                 |
| exclusions         | No       | Files to exclude from coverage                                                                                                                     |                       |
| login              | No       | The authentication token or login of a SonarQube user with either Execute Analysis permission on the project or Global Execute Analysis permission |                       |
| organization       | No       | Sonar organization                                                                                                                                 |                       |
| password           | No       | If you're using an authentication token, leave this blank. If you're using a login, this is the password that goes with your sonar.login username  |                       |
| projectName        | No       | Name of the project that will be displayed on the web interface                                                                                    |                       |
| projectVersion     | No       | The project version                                                                                                                                |                       |
| qualityGate        | No       | Forces the analysis step to poll the SonarQube instance and wait for the Quality Gate status                                                       | true                  |
| qualityGateTimeout | No       | Sets the number of seconds that the scanner should wait for a report to be processed                                                               | 300                   |
| skipImplicitDeps   | No       | Skips adding implicit dependencies to the project graph analysis                                                                                   | false                 |
