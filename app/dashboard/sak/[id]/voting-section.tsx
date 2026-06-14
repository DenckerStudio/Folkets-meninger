'use client';

import { useState, useEffect, useRef } from 'react';
import { ThumbsUp, ThumbsDown, Minus, CheckCircle, LogIn } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/hooks/use-auth';
import Link from 'next/link';

function AnimatedPercent({ value, initialValue = 0 }: { value: number, initialValue?: number }) {
  const [displayValue, setDisplayValue] = useState(initialValue);
  const currentDisplayValue = useRef(initialValue);

  useEffect(() => {
    let startTimestamp: number;
    let animationFrameId: number;
    const duration = 1000;
    const startValue = currentDisplayValue.current;
    
    if (startValue === value) return;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      
      const springish = 1 - Math.exp(-progress * 6);
      const nextValue = progress === 1 
        ? value 
        : Math.round(startValue + (value - startValue) * springish);
      
      setDisplayValue(nextValue);
      currentDisplayValue.current = nextValue;
      
      if (progress < 1) {
        animationFrameId = window.requestAnimationFrame(step);
      }
    };
    
    animationFrameId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(animationFrameId);
  }, [value]);

  return <>{displayValue}%</>;
}

interface VotingSectionProps {
  initialVotes: {
    for: number;
    against: number;
    abstain: number;
    total: number;
  };
  sakId: string;
  sakTitle?: string;
  sakSummary?: string;
}

export default function VotingSection({ initialVotes, sakId, sakTitle, sakSummary }: VotingSectionProps) {
  const [votes, setVotes] = useState(initialVotes);
  const [userVote, setUserVote] = useState<'for' | 'against' | 'abstain' | null>(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingVote, setIsLoadingVote] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    let cancelled = false;

    async function loadVoteState() {
      try {
        const res = await fetch(`/api/vote?issueId=${encodeURIComponent(sakId)}`);
        const data = await res.json();
        if (cancelled) return;

        setVotes({
          for: data.for ?? 0,
          against: data.against ?? 0,
          abstain: data.abstain ?? 0,
          total: data.total ?? (data.for ?? 0) + (data.against ?? 0) + (data.abstain ?? 0),
        });

        if (data.userVote && ['for', 'against', 'abstain'].includes(data.userVote)) {
          setUserVote(data.userVote);
        }
      } catch {
        // Keep server-rendered initial totals on failure
      } finally {
        if (!cancelled) setIsLoadingVote(false);
      }
    }

    loadVoteState();
    return () => {
      cancelled = true;
    };
  }, [sakId, user?.id]);

  const handleVote = async (type: 'for' | 'against' | 'abstain') => {
    if (userVote || isSubmitting) return;
    
    if (!user) {
      setError('Du må logge inn for å stemme.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issueId: sakId,
          vote: type,
          title: sakTitle,
          summary: sakSummary,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409 && data.userVote) {
          setUserVote(data.userVote);
        }
        setError(data.error || 'Kunne ikke registrere stemme.');
        setIsSubmitting(false);
        return;
      }

      setUserVote(data.userVote ?? type);
      if (data.totals) {
        const totals = data.totals;
        setVotes({
          for: totals.for || 0,
          against: totals.against || 0,
          abstain: totals.abstain || 0,
          total: (totals.for || 0) + (totals.against || 0) + (totals.abstain || 0),
        });
      } else {
        setVotes(prev => ({
          ...prev,
          [type]: prev[type] + 1,
          total: prev.total + 1
        }));
      }
    } catch (e) {
      setError('En feil oppstod. Prøv igjen.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const total = votes.total || 1;
  const forPercent = Math.round((votes.for / total) * 100);
  const againstPercent = Math.round((votes.against / total) * 100);
  const abstainPercent = Math.round((votes.abstain / total) * 100);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Hva mener du?</h2>

      {isLoadingVote && user && (
        <p className="text-center text-sm text-gray-400 mb-4">Laster din stemme…</p>
      )}
      
      {!user && (
        <div className="mb-6 text-center">
          <Link href="/auth/login" className="inline-flex items-center text-sm text-indigo-600 hover:text-indigo-500 font-medium">
            <LogIn className="w-4 h-4 mr-1.5" />
            Logg inn for å stemme
          </Link>
        </div>
      )}

      {error && (
        <div className="mb-6 text-center text-sm font-medium text-red-600 bg-red-50 py-2 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mb-8">
        <motion.button 
          whileTap={!userVote ? { scale: 0.95 } : {}}
          whileHover={!userVote ? { scale: 1.02 } : {}}
          onClick={() => handleVote('for')}
          disabled={userVote !== null || isSubmitting || isLoadingVote}
          aria-pressed={userVote === 'for'}
          aria-label="Stem for"
          className={`relative flex flex-col items-center justify-center py-6 px-4 rounded-xl border-2 transition-all duration-200 ${
            userVote === 'for' 
              ? 'border-emerald-500 bg-emerald-100 text-emerald-800 shadow-md ring-2 ring-emerald-500 ring-offset-2' 
              : userVote !== null
                ? 'border-gray-100 bg-gray-50 text-gray-400 opacity-50 cursor-not-allowed'
                : 'border-emerald-100 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-200 cursor-pointer'
          }`}
        >
          {userVote === 'for' && (
            <motion.div 
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", bounce: 0.6 }}
              className="absolute top-3 right-3"
            >
              <CheckCircle className="w-6 h-6 text-white fill-emerald-500" />
            </motion.div>
          )}
          <motion.div
            animate={userVote === 'for' ? { scale: [1, 1.2, 1], rotate: [0, -10, 10, 0] } : {}}
            transition={{ duration: 0.5 }}
          >
            <ThumbsUp className={`w-8 h-8 mb-2 ${userVote === 'for' ? 'fill-emerald-200' : ''}`} />
          </motion.div>
          <span className="font-semibold">For</span>
        </motion.button>

        <motion.button 
          whileTap={!userVote ? { scale: 0.95 } : {}}
          whileHover={!userVote ? { scale: 1.02 } : {}}
          onClick={() => handleVote('abstain')}
          disabled={userVote !== null || isSubmitting || isLoadingVote}
          aria-pressed={userVote === 'abstain'}
          aria-label="Stem avstår"
          className={`relative flex flex-col items-center justify-center py-6 px-4 rounded-xl border-2 transition-all duration-200 ${
            userVote === 'abstain' 
              ? 'border-gray-400 bg-gray-200 text-gray-800 shadow-md ring-2 ring-gray-400 ring-offset-2' 
              : userVote !== null
                ? 'border-gray-100 bg-gray-50 text-gray-400 opacity-50 cursor-not-allowed'
                : 'border-gray-100 bg-gray-50 text-gray-700 hover:bg-gray-100 hover:border-gray-200 cursor-pointer'
          }`}
        >
          {userVote === 'abstain' && (
            <motion.div 
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", bounce: 0.6 }}
              className="absolute top-3 right-3"
            >
              <CheckCircle className="w-6 h-6 text-white fill-gray-600" />
            </motion.div>
          )}
          <motion.div
            animate={userVote === 'abstain' ? { scale: [1, 1.2, 1] } : {}}
            transition={{ duration: 0.4 }}
          >
            <Minus className={`w-8 h-8 mb-2 ${userVote === 'abstain' ? 'stroke-gray-800' : ''}`} />
          </motion.div>
          <span className="font-semibold">Avstår</span>
        </motion.button>

        <motion.button 
          whileTap={!userVote ? { scale: 0.95 } : {}}
          whileHover={!userVote ? { scale: 1.02 } : {}}
          onClick={() => handleVote('against')}
          disabled={userVote !== null || isSubmitting || isLoadingVote}
          aria-pressed={userVote === 'against'}
          aria-label="Stem mot"
          className={`relative flex flex-col items-center justify-center py-6 px-4 rounded-xl border-2 transition-all duration-200 ${
            userVote === 'against' 
              ? 'border-rose-500 bg-rose-100 text-rose-800 shadow-md ring-2 ring-rose-500 ring-offset-2' 
              : userVote !== null
                ? 'border-gray-100 bg-gray-50 text-gray-400 opacity-50 cursor-not-allowed'
                : 'border-rose-100 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:border-rose-200 cursor-pointer'
          }`}
        >
          {userVote === 'against' && (
            <motion.div 
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", bounce: 0.6 }}
              className="absolute top-3 right-3"
            >
              <CheckCircle className="w-6 h-6 text-white fill-rose-500" />
            </motion.div>
          )}
          <motion.div
            animate={userVote === 'against' ? { scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] } : {}}
            transition={{ duration: 0.5 }}
          >
            <ThumbsDown className={`w-8 h-8 mb-2 ${userVote === 'against' ? 'fill-rose-200' : ''}`} />
          </motion.div>
          <span className="font-semibold">Mot</span>
        </motion.button>
      </div>

      <AnimatePresence>
        {userVote && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 text-center text-sm font-medium text-indigo-600 bg-indigo-50 py-2 rounded-lg"
          >
            Takk for din stemme! Den er registrert og anonymisert.
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider text-center">Folkets mening hittil</h3>
        {votes.total > 0 ? (
          <>
            <div className="h-4 flex rounded-full overflow-hidden bg-gray-100 shadow-inner">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${forPercent}%` }} 
                transition={{ type: 'spring', bounce: 0, duration: 1 }}
                className="bg-emerald-500 relative flex items-center justify-center" 
                title={`For: ${forPercent}%`}
              >
                {forPercent > 10 && <span className="text-[10px] font-bold text-white opacity-80"><AnimatedPercent value={forPercent} /></span>}
              </motion.div>
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${abstainPercent}%` }} 
                transition={{ type: 'spring', bounce: 0, duration: 1 }}
                className="bg-gray-400 relative flex items-center justify-center" 
                title={`Avstår: ${abstainPercent}%`}
              >
                {abstainPercent > 10 && <span className="text-[10px] font-bold text-white opacity-80"><AnimatedPercent value={abstainPercent} /></span>}
              </motion.div>
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${againstPercent}%` }} 
                transition={{ type: 'spring', bounce: 0, duration: 1 }}
                className="bg-rose-500 relative flex items-center justify-center" 
                title={`Mot: ${againstPercent}%`}
              >
                {againstPercent > 10 && <span className="text-[10px] font-bold text-white opacity-80"><AnimatedPercent value={againstPercent} /></span>}
              </motion.div>
            </div>
            <div className="flex justify-between text-sm text-gray-600 font-medium px-1">
              <span className="text-emerald-600">For</span>
              <span className="text-gray-500">Avstår</span>
              <span className="text-rose-600">Mot</span>
            </div>
          </>
        ) : (
          <p className="text-center text-sm text-gray-400">Ingen har stemt ennå. Vær den første!</p>
        )}
        <p className="text-center text-xs text-gray-400 mt-4">
          Din stemme lagres anonymt i tråd med GDPR.
        </p>
      </div>
    </div>
  );
}
