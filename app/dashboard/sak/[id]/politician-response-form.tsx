'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

export default function PoliticianResponseForm({ sakId }: { sakId?: string }) {
  const { user } = useAuth();
  const [isVerifiedPolitician, setIsVerifiedPolitician] = useState(false);
  const [response, setResponse] = useState('');
  const [isPublished, setIsPublished] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!user) {
      setIsVerifiedPolitician(false);
      return;
    }

    fetch('/api/user/politician-status')
      .then(res => res.json())
      .then(data => setIsVerifiedPolitician(data.isVerified || false))
      .catch(() => setIsVerifiedPolitician(false));
  }, [user]);

  if (!isVerifiedPolitician) return null;

  if (isPublished) {
    return (
      <div className="bg-emerald-50 rounded-2xl shadow-sm border border-emerald-100 p-6 mb-8">
        <div className="flex items-center text-emerald-800 font-medium mb-2">
          <ShieldCheck className="w-5 h-5 mr-2" />
          Ditt offisielle svar er publisert
        </div>
        <p className="text-emerald-700 text-sm">
          Svaret ditt er nå synlig for velgerne og bidrar til en mer opplyst debatt.
        </p>
      </div>
    );
  }

  const handlePublish = async () => {
    if (!response.trim() || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/politician/response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stortinget_issue_id: sakId,
          content: response.trim(),
        }),
      });

      if (res.ok) {
        setIsPublished(true);
      }
    } catch (e) {
      console.error('Failed to publish response:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-indigo-100 p-8 mb-8">
      <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
        <MessageSquare className="w-5 h-5 mr-2 text-indigo-600" />
        Publiser ditt offisielle svar
      </h2>
      <p className="text-gray-600 mb-4 text-sm">
        Som verifisert politiker kan du forklare din eller ditt partis stilling til denne saken. Svaret vil bli fremhevet med et verifiseringsmerke.
      </p>
      <textarea 
        rows={4} 
        value={response}
        onChange={(e) => setResponse(e.target.value)}
        className="w-full border border-gray-300 rounded-xl p-4 focus:ring-indigo-500 focus:border-indigo-500 mb-4 text-sm"
        placeholder="Skriv din forklaring her..."
      ></textarea>
      <div className="flex justify-end">
        <button 
          onClick={handlePublish}
          disabled={!response.trim() || isSubmitting}
          className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Publiserer...' : 'Publiser svar'}
        </button>
      </div>
    </div>
  );
}
