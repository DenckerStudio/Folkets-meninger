import * as migration_20261018_104121_initial from './20261018_104121_initial';

export const migrations = [
  {
    up: migration_20261018_104121_initial.up,
    down: migration_20261018_104121_initial.down,
    name: '20261018_104121_initial'
  },
];
