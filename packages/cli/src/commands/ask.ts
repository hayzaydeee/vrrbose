import chalk from 'chalk';
import { askAgent } from '../client.js';

export async function askCommand(query: string, opts: { json?: boolean }): Promise<void> {
  try {
    const response = await askAgent(query, 'cli');

    if (opts.json) {
      console.log(JSON.stringify(response, null, 2));
      return;
    }

    console.log(response.answer);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (process.stdout.isTTY) {
      console.error(chalk.red('Error: ') + msg);
    } else {
      console.error(`Error: ${msg}`);
    }
    process.exit(2);
  }
}
