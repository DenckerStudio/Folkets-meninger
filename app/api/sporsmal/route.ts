import { NextResponse } from 'next/server';
import { getSporsmalListe, type SporsmalType } from '@/lib/stortinget';
import { STORTINGET_ACTIVE_SESSION_ID } from '@/lib/stortinget-config';

export const dynamic = 'force-dynamic';

/** Read-only Stortinget open data; guests may call this without login (see middleware). */

function isSporsmalType(x: string | null): x is SporsmalType {
  return x === 'sporretimesporsmal' || x === 'interpellasjoner' || x === 'skriftligesporsmal';
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const typeParam = searchParams.get('type');
  const sesjonId = searchParams.get('sesjonId') || STORTINGET_ACTIVE_SESSION_ID;
  const status = searchParams.get('status') || undefined;

  if (!isSporsmalType(typeParam)) {
    return NextResponse.json(
      { error: "Ugyldig 'type'. Bruk: sporretimesporsmal | interpellasjoner | skriftligesporsmal" },
      { status: 400 }
    );
  }

  const sporsmal = await getSporsmalListe({ type: typeParam, sesjonId, status, nextRevalidateSeconds: 3600 });
  return NextResponse.json({ type: typeParam, sesjonId, status: status ?? null, sporsmal });
}

