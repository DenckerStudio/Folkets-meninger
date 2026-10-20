import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { OppfangetFilterInput } from './filters';
import {
  OPPFANGET_PIPELINE_EMPTY_TITLE,
  shouldShowOppfangetFilterEmpty,
  shouldShowOppfangetPipelineEmpty,
} from './view-state';
import type { OppfangetListResponse } from './types';

const emptyList: OppfangetListResponse = {
  rows: [],
  counts: {
    oppfanget: 0,
    under_terskel: 0,
    utkast_laget: 0,
    publisert: 0,
    avvist: 0,
  },
  tableMissing: false,
  tableMissingMessage: null,
  previewMock: false,
};

const noFilters: OppfangetFilterInput = {};

assert.equal(
  shouldShowOppfangetPipelineEmpty(emptyList, noFilters, false),
  true,
  'pipeline empty when 0 rows and no filters',
);
assert.equal(
  shouldShowOppfangetFilterEmpty(emptyList, { q: 'x' }, false),
  true,
  'filter empty when 0 rows and active filter',
);
assert.equal(
  shouldShowOppfangetPipelineEmpty(emptyList, { q: 'x' }, false),
  false,
);

const client = readFileSync(
  join(process.cwd(), 'app/dashboard/admin/oppfanget/admin-oppfanget-client.tsx'),
  'utf-8',
);
assert.match(client, /OPPFANGET_PIPELINE_EMPTY_TITLE/);
assert.match(client, /router\.replace/);
assert.match(client, /buildOppfangetAdminPath/);
assert.equal(OPPFANGET_PIPELINE_EMPTY_TITLE, 'Ingenting oppfanget ennå');

console.log('admin/oppfanget/empty-state.test.ts: ok');
