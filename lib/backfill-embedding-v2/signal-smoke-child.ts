import { installBackfillSignalHandlers } from './shutdown';

installBackfillSignalHandlers(async () => {
  console.log('signal-smoke: ok');
});

setImmediate(() => {
  process.kill(process.pid, 'SIGTERM');
});
