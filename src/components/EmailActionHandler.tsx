import React, { useEffect, useState } from 'react';
import { auth } from '../firebase';
import { applyActionCode } from 'firebase/auth';
import { CheckCircle2, XCircle, Loader2, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';

interface EmailActionHandlerProps {
  onContinue: () => void;
}

export default function EmailActionHandler({ onContinue }: EmailActionHandlerProps) {
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const handleActionCode = async () => {
      // Extract URL search parameters
      const urlParams = new URLSearchParams(window.location.search);
      const oobCode = urlParams.get('oobCode');
      const mode = urlParams.get('mode');

      if (mode !== 'verifyEmail' || !oobCode) {
        setStatus('error');
        setErrorMessage('Invalid action request. The link may be broken.');
        return;
      }

      try {
        await applyActionCode(auth, oobCode);
        setStatus('success');
      } catch (err: any) {
        console.error("Action code verification failed:", err);
        if (err.code === 'auth/invalid-action-code') {
          setErrorMessage('The verification link has expired or has already been used.');
        } else {
          setErrorMessage(err.message || 'Verification failed. Please try again.');
        }
        setStatus('error');
      }
    };

    handleActionCode();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Dynamic Cosmic Ambient Gradients */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none animate-pulse duration-[8s]" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-pink-500/10 rounded-full blur-[120px] pointer-events-none animate-pulse duration-[10s]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-[140px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-md w-full bg-slate-900/40 border border-slate-800/80 backdrop-blur-3xl rounded-[2.5rem] shadow-[0_0_60px_-15px_rgba(99,102,241,0.3)] overflow-hidden relative z-10 p-8 md:p-10 text-center space-y-8"
      >
        {/* Top Lip Neon Accent Line */}
        <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-500 to-pink-500 opacity-60" />

        {status === 'verifying' && (
          <div className="space-y-6 py-6">
            <div className="flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-xl animate-pulse" />
                <div className="w-20 h-20 bg-slate-950 border border-slate-850 rounded-full flex items-center justify-center shadow-2xl relative">
                  <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-white tracking-tight">Activating Workspace</h2>
              <p className="text-slate-400 text-sm max-w-xs mx-auto">
                Securing your connection and verifying your digital identity. Please wait...
              </p>
            </div>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-6">
            <div className="flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-emerald-500/25 rounded-full blur-xl animate-pulse" />
                <div className="w-20 h-20 bg-slate-950 border border-emerald-950 rounded-full flex items-center justify-center shadow-2xl relative">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-3xl font-black tracking-tight bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-400 bg-clip-text text-transparent">
                Account Verified!
              </h2>
              <p className="text-slate-400 text-sm font-medium leading-relaxed">
                Your email address has been successfully verified. Your Glick X workspace is now fully activated and secure.
              </p>
            </div>

            <button
              onClick={onContinue}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-[0_0_30px_rgba(16,185,129,0.3)] transition-all cursor-pointer text-sm uppercase tracking-wider font-black active:translate-y-0.5 duration-200"
            >
              Continue to Workspace
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-6">
            <div className="flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-red-500/20 rounded-full blur-xl animate-pulse" />
                <div className="w-20 h-20 bg-slate-950 border border-red-950 rounded-full flex items-center justify-center shadow-2xl relative">
                  <XCircle className="w-10 h-10 text-red-400" />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-2xl font-black tracking-tight bg-gradient-to-r from-red-400 to-pink-500 bg-clip-text text-transparent">
                Verification Failed
              </h2>
              <p className="text-slate-400 text-sm leading-relaxed max-w-xs mx-auto">
                {errorMessage || 'The verification link is invalid or has expired.'}
              </p>
            </div>

            <button
              onClick={onContinue}
              className="w-full flex items-center justify-center gap-2 bg-slate-950/60 border border-slate-850 hover:bg-slate-900/60 text-slate-200 font-bold py-4 rounded-xl transition-all cursor-pointer text-sm uppercase tracking-wider font-black active:translate-y-0.5 duration-200"
            >
              Return to Login
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
