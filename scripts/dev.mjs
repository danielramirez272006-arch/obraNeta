import { spawn } from 'node:child_process';

const api = spawn('npm', ['--workspace', '@obraneta/api', 'run', 'dev'], {
  stdio: 'inherit',
  shell: true
});

const web = spawn('npm', ['--workspace', '@obraneta/web', 'run', 'dev'], {
  stdio: 'inherit',
  shell: true
});

function shutdown() {
  api.kill();
  web.kill();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

