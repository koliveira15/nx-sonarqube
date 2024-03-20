import * as fs from 'fs';
import * as path from 'path';

interface Property {
  type: string;
  default?: any;
  description: string;
}

interface JSONSchema {
  title: string;
  description: string;
  example: string;
  properties: { [key: string]: Property };
  required: string[];
}

function readJSONFile(filename: string): JSONSchema {
  const data = fs.readFileSync(filename, 'utf8');
  return JSON.parse(data);
}

function sortProperties(jsonObject: JSONSchema): string[] {
  const requiredProperties = jsonObject.required.sort();
  const remainingProperties = Object.keys(jsonObject.properties)
    .filter((property) => !requiredProperties.includes(property))
    .sort();
  return [...requiredProperties, ...remainingProperties];
}

function jsonToMarkdown(jsonObject: JSONSchema, isExecutor: boolean): string {
  let markdown =
    '---\n' + `title: '${jsonObject.title}'\n` + 'editUrl: false\n' + '---\n';
  if (isExecutor) {
    markdown += `\nimport { Code } from '@astrojs/starlight/components';\n`;
    markdown += `import exampleFile from '${jsonObject.example}';\n\n`;
  } else {
    markdown += '\n';
  }
  markdown += `${jsonObject.description}\n\n`;

  markdown += '## Example\n\n';
  if (isExecutor) {
    markdown += `<Code code={exampleFile} lang="json" title="project.json"/>\n\n`;
  } else {
    markdown +=
      '```sh\nnpx nx g @koliveira15/nx-sonarqube:' +
      jsonObject.title +
      '\n```\n\n';
  }

  markdown += `## Options\n\n`;
  const sortedProperties = sortProperties(jsonObject);
  for (const key of sortedProperties) {
    markdown += `### ${key}\n\n`;
    if (jsonObject.required.includes(key)) {
      markdown += '`Required`\n\n';
    }
    markdown += `**Type**: \`${jsonObject.properties[key].type}\`\n\n`;
    if (jsonObject.properties[key].default) {
      markdown += `**Default**: ${jsonObject.properties[key].default}\n\n`;
    }
    markdown += `${jsonObject.properties[key].description}\n\n`;
  }

  return markdown;
}

function main(): void {
  const schemas: JSONSchema[] = [
    readJSONFile('packages/nx-sonarqube/executors.json'),
    readJSONFile('packages/nx-sonarqube/generators.json'),
  ];

  for (const schema of schemas) {
    if (!schema) {
      console.error('Error reading schema file');
      return;
    }

    const isExecutor = 'executors' in schema;
    const schemaProperty = isExecutor
      ? (schema as any).executors
      : (schema as any).generators;

    for (const schemaKey in schemaProperty) {
      if (Object.prototype.hasOwnProperty.call(schemaProperty, schemaKey)) {
        const tool = schemaProperty[schemaKey];
        if (tool.schema) {
          const schemaPath = path.resolve(
            'packages/nx-sonarqube/',
            tool.schema.replace('./', '')
          );
          const markdown = jsonToMarkdown(readJSONFile(schemaPath), isExecutor);
          const markdownBasePath = 'apps/docs-site/src/content/docs/reference/';
          const markdownToolPath = isExecutor
            ? `${markdownBasePath}Executors`
            : `${markdownBasePath}Generators`;
          const markdownFileName = `${markdownToolPath}/${schemaKey}.mdx`;
          fs.writeFileSync(markdownFileName, markdown, 'utf8');
          console.log(`Schema converted and saved to ${markdownFileName}`);
        } else {
          console.warn(`No schema path provided for tool ${schemaKey}`);
        }
      }
    }
  }
}

main();
