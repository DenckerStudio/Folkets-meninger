import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Calendar, MessageSquare, User } from 'lucide-react';
import { STORTINGET_ACTIVE_SESSION_ID } from '@/lib/stortinget-config';
import {
  findSporsmalById,
  formatSporsmalDate,
  formatSporsmalStatus,
  getSporsmalEmner,
  getSporsmalFraNavn,
  getSporsmalTitle,
  isSporsmalBesvart,
  sporsmalTypeLabel,
} from '@/lib/stortinget-sporsmal';
import { routes } from '@/lib/routes';

export const revalidate = 3600;

export default async function SporsmalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await findSporsmalById(id, STORTINGET_ACTIVE_SESSION_ID);

  if (!result) {
    notFound();
  }

  const { item: question, type } = result;
  const title = getSporsmalTitle(question);
  const fraNavn = getSporsmalFraNavn(question);
  const emner = getSporsmalEmner(question);
  const besvart = isSporsmalBesvart(question);
  const sendt = formatSporsmalDate(question.sendt_dato) ?? formatSporsmalDate(question.datert_dato);
  const besvartDato = formatSporsmalDate(question.besvart_dato);
  const statusLabel = formatSporsmalStatus(question.status);
  const fullText = question.tittel || question.sporsmal || '';

  return (
    <div className="space-y-8 pb-12">
      <Link href={routes.sporsmal} className="inline-flex items-center text-indigo-600 font-medium text-sm">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Tilbake til spørsmål
      </Link>

      <article className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm space-y-6">
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">
            {sporsmalTypeLabel(type)}
          </span>
          <span
            className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              besvart ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
            }`}
          >
            {besvart ? 'Besvart' : 'Ubesvart'}
          </span>
          {statusLabel && (
            <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
              {statusLabel}
            </span>
          )}
        </div>

        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>

        {fullText.length > 200 && (
          <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">{fullText}</div>
        )}

        <dl className="grid sm:grid-cols-2 gap-4 text-sm">
          {fraNavn && (
            <div className="flex gap-2">
              <User className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <dt className="text-gray-500">Fra</dt>
                <dd className="font-medium text-gray-900">
                  {question.sporsmal_fra?.id ? (
                    <Link href={routes.politiker(question.sporsmal_fra.id)} className="hover:text-indigo-600">
                      {fraNavn}
                      {question.sporsmal_fra.parti?.navn ? ` (${question.sporsmal_fra.parti.navn})` : ''}
                    </Link>
                  ) : (
                    fraNavn
                  )}
                </dd>
              </div>
            </div>
          )}
          {question.sporsmal_til_minister_tittel && (
            <div className="flex gap-2">
              <User className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <dt className="text-gray-500">Til</dt>
                <dd className="font-medium text-gray-900">{question.sporsmal_til_minister_tittel}</dd>
              </div>
            </div>
          )}
          {sendt && (
            <div className="flex gap-2">
              <Calendar className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <dt className="text-gray-500">Dato</dt>
                <dd className="font-medium text-gray-900">{sendt}</dd>
              </div>
            </div>
          )}
          {besvartDato && (
            <div className="flex gap-2">
              <Calendar className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <dt className="text-gray-500">Besvart</dt>
                <dd className="font-medium text-gray-900">
                  {besvartDato}
                  {question.besvart_av_minister_tittel ? ` av ${question.besvart_av_minister_tittel}` : ''}
                </dd>
              </div>
            </div>
          )}
        </dl>

        {emner.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Emner</p>
            <div className="flex flex-wrap gap-2">
              {emner.map((emne) => (
                <span key={emne} className="inline-flex px-2.5 py-1 rounded-lg bg-gray-100 text-sm text-gray-700">
                  {emne}
                </span>
              ))}
            </div>
          </div>
        )}

        <Link
          href={routes.forumNew()}
          className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-500"
        >
          <MessageSquare className="w-4 h-4" />
          Diskuter i forum
        </Link>
      </article>
    </div>
  );
}
