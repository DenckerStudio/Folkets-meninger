import * as migration_20261018_104121_initial from './20261018_104121_initial';
import * as migration_20261018_130000_payload_391_users_auth from './20261018_130000_payload_391_users_auth';
import * as migration_20261020_120000_users_account_lock_columns from './20261020_120000_users_account_lock_columns';
import * as migration_20261020_150000_content_feedback_send_job from './20261020_150000_content_feedback_send_job';
import * as migration_20261027_120000_posts_expired_at from './20261027_120000_posts_expired_at';

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
  {
    up: migration_20261020_120000_users_account_lock_columns.up,
    down: migration_20261020_120000_users_account_lock_columns.down,
    name: '20261020_120000_users_account_lock_columns',
  },
  {
    up: migration_20261020_150000_content_feedback_send_job.up,
    down: migration_20261020_150000_content_feedback_send_job.down,
    name: '20261020_150000_content_feedback_send_job',
  },
  {
    up: migration_20261027_120000_posts_expired_at.up,
    down: migration_20261027_120000_posts_expired_at.down,
    name: '20261027_120000_posts_expired_at',
  },
];
