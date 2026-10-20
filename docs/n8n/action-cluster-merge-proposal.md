# Forslag: slå sammen action_clusters (fase 3+)

**Status:** kun design — ingen migrasjon i atomic-PR. `related_issue_id` forblir uendret i fase 2.

## Problem

n8n kan oppdage at to `action_key`-verdier beskriver samme reelle aksjon (navnevariant, alias-domene, manuell re-klynging). I dag er `action_key` unik; duplikater gir parallelle klynger.

## Foreslått modell

### `action_clusters.merged_into`

- Nullable `uuid` FK → `action_clusters(id)` ON DELETE SET NULL.
- Når satt, er raden **arkivert** som alias: kilder flyttes til target, admin viser kun target.

### `action_cluster_aliases`

| Kolonne | Type | Merknad |
|---------|------|---------|
| `alias_key` | `text` PRIMARY KEY | Tidligere eller alternativ `action_key` |
| `cluster_id` | `uuid` NOT NULL FK → `action_clusters` | Kanonisk klynge |
| `created_at` | `timestamptz` | |

### RPC `merge_action_clusters(p_target_action_key text, p_source_action_keys text[])`

Kun `service_role`. I én transaksjon:

1. Løs `p_target_action_key` og hver source til `cluster_id` (via `action_clusters.action_key` eller `action_cluster_aliases.alias_key`).
2. Avvis hvis target er `merged_into` eller låst (`decided_by` / `drafted` / `rejected`) uten admin-flagg.
3. `UPDATE action_sources SET cluster_id = target_id WHERE cluster_id IN (source_ids)`.
4. `INSERT INTO action_cluster_aliases` for hver source `action_key`.
5. `UPDATE action_clusters SET merged_into = target_id, last_seen_at = now() WHERE id IN (source_ids)`.
6. Kjør samme **recalc** som `upsert_action_capture` (`independent_publishers`, `max_confidence` fra kilder).

### `upsert_action_capture` (fremtidig)

Ved lookup:

```sql
SELECT id FROM action_clusters WHERE action_key = $key AND merged_into IS NULL
UNION
SELECT a.cluster_id FROM action_cluster_aliases a WHERE a.alias_key = $key;
```

Ny capture på et alias-key oppdaterer kanonisk klynge uten å gjenopprette duplikat-rad.

## Admin / Oppfanget

- Liste: filtrer `merged_into IS NULL`.
- Valgfritt: vis «slått inn i …» på historikk-rad for support.

## Ikke i scope nå

- Automatisk merge i n8n (kun manuell RPC eller senere admin-UI).
- Endring av `related_issue_id` / Stortinget-kobling.
