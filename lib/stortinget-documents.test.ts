import assert from 'node:assert/strict';
import {
  groupSakDocumentsByKind,
  parseSakDocuments,
  SAK_DOCUMENT_KIND_LABELS,
} from './stortinget-documents';

const sampleDetail = {
  id: 200311,
  publikasjon_referanse_liste: [
    {
      eksport_id: null,
      lenke_tekst: 'Prop. 94 S (2025-2026)',
      lenke_url: 'http://www.regjeringen.no/id/PRP202520260094000DDDEPIS',
      type: 1,
      undertype: 'proposisjon',
    },
    {
      eksport_id: 'inns-202526-448s',
      lenke_tekst: 'Innst. 448 S (2025-2026)',
      lenke_url:
        '//www.stortinget.no/no/Saker-og-publikasjoner/Publikasjoner/Innstillinger/Stortinget/2025-2026/inns-202526-448s/',
      type: 6,
      undertype: 'storting',
    },
    {
      eksport_id: 'refs-202526-06-16',
      lenke_tekst: 'Stortingsreferat 16.06.2026',
      lenke_url:
        '//www.stortinget.no/no/Saker-og-publikasjoner/Publikasjoner/Referater/Stortinget/2025-2026/refs-202526-06-16/1',
      type: 10,
      undertype: 'storting',
    },
    {
      eksport_id: 'refs-202526-06-16',
      lenke_tekst: 'Stortingsreferat 16.06.2026',
      lenke_url:
        '//www.stortinget.no/no/Saker-og-publikasjoner/Publikasjoner/Referater/Stortinget/2025-2026/refs-202526-06-16/voteringer#160626-1',
      type: 10,
      undertype: 'storting',
    },
  ],
};

const documents = parseSakDocuments(sampleDetail);
assert.equal(documents.length, 4);

const prop = documents.find((doc) => doc.title.startsWith('Prop.'));
assert.ok(prop);
assert.equal(prop.viewable, false);
assert.equal(prop.kind, 'lovforslag');
assert.match(prop.id, /^external-/);

const innst = documents.find((doc) => doc.exportId === 'inns-202526-448s');
assert.ok(innst);
assert.equal(innst.viewable, true);
assert.equal(innst.kind, 'innstilling');

const referatIds = documents
  .filter((doc) => doc.kind === 'referat')
  .map((doc) => doc.id);
assert.equal(referatIds.length, 2);
assert.notEqual(referatIds[0], referatIds[1]);

const groups = groupSakDocumentsByKind(documents);
assert.equal(groups[0]?.kind, 'lovforslag');
assert.equal(groups[0]?.label, SAK_DOCUMENT_KIND_LABELS.lovforslag);

console.log('stortinget-documents.test.ts: ok');
