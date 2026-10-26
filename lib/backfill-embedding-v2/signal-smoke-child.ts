import { installBackfillSignalHandlers } from './shutdown';

installBackfillSignalHandlers(async () => {
  process.stdout.write('signal-smoke: ok\n');
});

setImmediate(() => {
  process.emit('SIGTERM');
});
