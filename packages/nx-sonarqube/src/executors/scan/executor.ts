import { ScanExecutorSchema } from './schema';
import { ExecutorContext, logger } from '@nx/devkit';
import { scanner } from './utils/utils';

export default async function (
  options: ScanExecutorSchema,
  context: ExecutorContext
): Promise<{ success: boolean }> {
  let success = true;

  await scanner(options, context).catch((e): void => {
    logger.error(
      `The SonarQube scan failed for project '${context.projectName}'`
    );
    logger.error(e);

    success = false;
  });

  return {
    success: success,
  };
}
