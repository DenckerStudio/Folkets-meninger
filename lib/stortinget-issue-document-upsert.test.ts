import assert from 'node:assert/strict';
import {
  logStortingetIssueDocumentUpsertError,
  upsertStortingetIssueDocument,
} from './stortinget-issue-document-upsert';

async function main(): Promise<void> {
  const logged: string[] = [];
  const originalError = console.error;
  console.error = (message?: unknown, ...rest: unknown[]) => {
    logged.push([message, ...rest].map(String).join(' '));
  };

  try {
    logStortingetIssueDocumentUpsertError('200506', 'refs-doc', null);
    assert.equal(logged.length, 0);

    logStortingetIssueDocumentUpsertError('200507', 'doc-a', {
      code: '42703',
      message: 'column "chunks_status" of relation "stortinget_issue_documents" does not exist',
    });
    assert.equal(logged.length, 1);
    assert.match(logged[0] ?? '', /\[document-ingest\]/);
    assert.match(logged[0] ?? '', /issue_id=200507/);
    assert.match(logged[0] ?? '', /document_id=doc-a/);
    assert.match(logged[0] ?? '', /code=42703/);
    assert.match(logged[0] ?? '', /chunks_status/);

    logged.length = 0;
    const mockService = {
      from: (table: string) => {
        assert.equal(table, 'stortinget_issue_documents');
        return {
          upsert: async () => ({
            error: { code: '23505', message: 'duplicate key value violates unique constraint' },
          }),
        };
      },
    };

    await upsertStortingetIssueDocument(
      mockService as never,
      '200506',
      'mock-doc',
      { issue_id: '200506', document_id: 'mock-doc', chunks_status: 'none' },
    );
    assert.equal(logged.length, 1);
    assert.match(logged[0] ?? '', /code=23505/);
  } finally {
    console.error = originalError;
  }

  console.log('stortinget-issue-document-upsert.test.ts: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});