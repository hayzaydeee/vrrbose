import chalk from 'chalk';
import { getSessions, getSession } from '../client.js';

export async function replayCommand(sessionId: string | undefined, opts: { open?: boolean; json?: boolean }): Promise<void> {
  try {
    if (!sessionId) {
      // List sessions
      const sessions = await getSessions(10);

      if (opts.json) {
        console.log(JSON.stringify(sessions, null, 2));
        return;
      }

      const isTTY = process.stdout.isTTY;
      console.log(isTTY ? chalk.bold('Sessions') : 'Sessions');
      for (const s of sessions) {
        const date = new Date(s.startedAt).toISOString().slice(0, 16);
        const dur = s.endedAt ? `${Math.round((s.endedAt - s.startedAt) / 60000)}m` : 'ongoing';
        const score = s.score?.toFixed(0) ?? '-';
        console.log(`  ${s.id.slice(0, 8)}  ${date}  ${dur}  commits:${s.commitCount}  score:${score}`);
      }
      return;
    }

    const { session, events } = await getSession(sessionId);

    if (opts.json) {
      console.log(JSON.stringify({ session, events }, null, 2));
      return;
    }

    const isTTY = process.stdout.isTTY;
    console.log(isTTY ? chalk.bold(`Session ${session.id.slice(0, 8)}`) : `Session ${session.id.slice(0, 8)}`);
    console.log(`  Started : ${new Date(session.startedAt).toISOString().slice(0, 16)}`);
    if (session.endedAt) console.log(`  Ended   : ${new Date(session.endedAt).toISOString().slice(0, 16)}`);
    console.log(`  Commits : ${session.commitCount}`);
    console.log(`  Score   : ${session.score?.toFixed(1) ?? 'n/a'}`);

    console.log('\nEvents:');
    for (const e of events) {
      const ts = new Date(e.timestamp).toISOString().slice(0, 16);
      console.log(`  ${ts}  ${e.type.padEnd(20)}  ${JSON.stringify(e.payload).slice(0, 60)}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Error: ${msg}`);
    process.exit(2);
  }
}
