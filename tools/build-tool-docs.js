const fs = require('fs');
const path = require('path');
function readJSONFile(filename) {
  try {
    const data = fs.readFileSync(filename, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading ${filename}: ${error}`);
    return null;
  }
}
function jsonToMarkdown(jsonObject, isExecutor) {
  let markdown = '---\n' + `title: '${jsonObject.title}'\n` + '---\n\n';
  if (isExecutor) {
    markdown += `import { Code } from '@astrojs/starlight/components';\n`;
    markdown += `import exampleFile from '${jsonObject.example}';\n\n`;
  } else {
    markdown += '\n'
  }
  markdown += `${jsonObject.description}\n\n`;

  markdown += '## Example\n\n';
  if (isExecutor) {
    markdown += `<Code code={exampleFile} lang="json" title="project.json"/>\n\n`;
  } else {
    markdown += "```sh\nnpx nx g @koliveira15/nx-sonarqube:" + jsonObject.title + "\n```\n\n";
  }

  markdown += `## Options\n\n`;
  const properties = jsonObject.properties;
  for (const key in properties) {
    if (properties.hasOwnProperty(key)) {
      markdown += `### ${key}\n\n`;
      if (jsonObject.required.includes(key)) {
        markdown += '`Required`\n\n';
      }
      markdown += `**Type**: \`${properties[key].type}\`\n\n`;
      if (properties[key].default) {
        markdown += `**Default**: ${properties[key].default}\n\n`;
      }
      markdown += `${properties[key].description}\n\n`;
    }
  }

  return markdown;
}
function main() {
  const schemas = [
    readJSONFile('packages/nx-sonarqube/executors.json'),
    readJSONFile('packages/nx-sonarqube/generators.json'),
  ];

  for (const schema of schemas) {
    if (!schema) {
      console.error('Error reading schema file');
      return;
    }

    const isExecutor = 'executors' in schema;
    const schemaProperty = isExecutor ? schema.executors : schema.generators;

    for (const schemaKey in schemaProperty) {
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

main();
