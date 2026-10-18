import * as migration_20261018_104121_initial from './20261018_104121_initial';
import * as migration_20261018_130000_payload_391_users_auth from './20261018_130000_payload_391_users_auth';

export const migrations = [
  {
    up: migration_20261018_104121_initial.up,
    down: migration_20261018_104121_initial.down,
    name: '20261018_104121_initial',
  },
  {
    up: migration_20261018_130000_payload_391_users_auth.up,
    down: migration_20261018_130000_payload_391_users_auth.down,
    name: '20261018_130000_payload_391_users_auth',
  },
];
