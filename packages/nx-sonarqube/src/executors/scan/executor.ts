import { ScanExecutorSchema } from './schema';
import { ExecutorContext, logger } from '@nrwl/devkit';

import { scanner } from './utils/utils';
import _ from "lodash";

function trimQuotes(value: string): string {
  return _.trim(_.trim(value, '\''), '"');
}

export default async function (
  options: ScanExecutorSchema,
  context: ExecutorContext
): Promise<{ success: boolean }> {
  let success = true;

  const parsedOptions: ScanExecutorSchema = _.mapValues(options, (option: string | boolean): string | boolean => {
    if (_.isString(option)) {
      return trimQuotes(option);
    }

    return option;
  }) as ScanExecutorSchema;

  await scanner(parsedOptions, context).catch((e): void => {
    logger.error(
      `The SonarQube scan failed for project '${context.projectName}'. Error: ${e}`
    );
    success = false;
  });

  logger.info('Scanner finished');

  return {
    success: success,
  };
}
