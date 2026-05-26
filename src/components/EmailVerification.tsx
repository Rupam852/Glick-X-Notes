import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';
import { sendEmailVerification, signOut } from 'firebase/auth';
import { Mail, ArrowRight, AlertCircle, CheckCircle2, LogOut, RefreshCw, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useToast } from '../contexts/ToastContext';

interface EmailVerificationProps {
  onVerified: () => void;
}

export default function EmailVerification({ onVerified }: EmailVerificationProps) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  // Check if verified by reloading user profile
  const checkVerificationStatus = async () => {
    setLoading(true);
    try {
      if (auth.currentUser) {
        await auth.currentUser.reload();
        if (auth.currentUser.emailVerified) {
          showToast('Email verified successfully! Welcome to Glick X Notes.', 'success');
          onVerified();
        } else {
          showToast('Email is not verified yet. Please check your inbox and click the verification link.', 'error');
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to check verification status.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Resend the email verification link
  const resendVerificationEmail = async () => {
    if (countdown > 0) return;
    setResending(true);
    try {
      if (auth.currentUser) {
        await sendEmailVerification(auth.currentUser);
        showToast('Verification email resent! Please check your inbox.', 'success');
        setCountdown(60); // 60-second cooldown
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to resend verification email.', 'error');
    } finally {
      setResending(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      showToast('Signed out successfully.', 'info');
    } catch (err: any) {
      showToast('Failed to sign out.', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Dynamic Glowing Ambient Blobs */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none animate-pulse duration-[8s]" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-pink-500/10 rounded-full blur-[100px] pointer-events-none animate-pulse duration-[10s]" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-lg w-full bg-slate-900/40 border border-slate-800/80 backdrop-blur-2xl rounded-[2rem] shadow-[0_0_50px_-12px_rgba(99,102,241,0.25)] overflow-hidden relative z-10 p-8 md:p-10 text-center space-y-8"
      >
        <div className="flex justify-center">
          <div className="w-20 h-20 bg-slate-950 rounded-3xl flex items-center justify-center shadow-lg border border-slate-800/80 overflow-hidden relative">
            <Mail className="w-10 h-10 text-indigo-400 animate-pulse" />
          </div>
        </div>

        <div className="space-y-3">
          <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-white via-indigo-100 to-pink-100 bg-clip-text text-transparent">
            Verify Your Email
          </h1>
          <p className="text-slate-400 text-sm font-medium leading-relaxed max-w-sm mx-auto">
            We sent a verification link to <span className="text-indigo-300 font-bold">{auth.currentUser?.email}</span>. Click the link inside the email to secure your account.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-4 pt-4">
          <button
            onClick={checkVerificationStatus}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-650/20 active:translate-y-0.5 transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
            I Have Verified My Email
          </button>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={resendVerificationEmail}
              disabled={resending || countdown > 0}
              className="flex-1 bg-slate-950/80 border border-slate-800 hover:bg-slate-900 text-slate-200 font-semibold py-3.5 rounded-xl transition-all cursor-pointer text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resending ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Resending...
                </span>
              ) : countdown > 0 ? (
                `Resend in ${countdown}s`
              ) : (
                'Resend Verification Link'
              )}
            </button>
            <button
              onClick={handleSignOut}
              className="flex items-center justify-center gap-2 bg-slate-950/40 hover:bg-slate-950/80 border border-slate-800/80 text-red-400 font-semibold py-3.5 px-6 rounded-xl transition-all cursor-pointer text-sm"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>

        {/* Quick Helper Note */}
        <div className="p-4 bg-slate-950/40 border border-slate-850/60 rounded-2xl flex items-start gap-3 text-left">
          <AlertCircle className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
          <p className="text-xs text-slate-400 leading-relaxed font-medium">
            Didn't receive the email? Please check your <span className="text-indigo-300 font-bold">Spam or Junk folder</span>. The email is sent from Firebase Authentication system.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
