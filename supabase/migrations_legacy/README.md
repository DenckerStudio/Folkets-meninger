# Historical incremental migrations

These SQL files were applied incrementally on hosted Supabase projects before the
repo switched to a **single squashed migration** for local development.

| Use case | What to run |
|----------|-------------|
| **Local Docker** (`supabase db reset`) | `supabase/migrations/20260806120000_folkets_stemme_schema.sql` + `supabase/seed.sql` |
| **Existing hosted DB** | Do not re-run the squashed file. Repair or extend schema via new SQL in the hosted SQL editor, or add a new dated migration only if you adopt incremental pushes again. |
| **Reference / audit** | Files here preserve the original order and intent of each change. |

Filenames are timestamp-prefixed in application order.
