import { spawn } from 'node:child_process';
export async function startMemoryServer() {
  const url = 'http://127.0.0.1:3101';
  try {
    await fetch(url, { signal: AbortSignal.timeout(1000) });
    throw new Error(
      'Port 3101 is already serving; refusing to reuse an unrelated server',
    );
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Port 3101'))
      throw error;
  }
  const child = spawn(
    process.execPath,
    [
      'node_modules/next/dist/bin/next',
      'start',
      '--hostname',
      '127.0.0.1',
      '--port',
      '3101',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  let log = '';
  let failure: string | undefined;
  child.stdout.on('data', (chunk) => {
    log += String(chunk);
  });
  child.stderr.on('data', (chunk) => {
    log += String(chunk);
  });
  child.on('error', (error) => {
    failure = error.message;
  });
  async function close() {
    if (child.exitCode !== null || child.signalCode) return;
    await new Promise<void>((resolve) => {
      child.once('exit', () => resolve());
      child.kill('SIGTERM');
    });
  }
  try {
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
      if (failure || child.exitCode !== null) throw new Error(failure ?? log);
      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(1000),
        });
        if (response.ok) return { close, log: () => log };
      } catch {
        /* Startup not ready yet. */
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Server startup timeout: ${log}`);
  } catch (error) {
    await close();
    throw error;
  }
}
