import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';
import { sendEmailVerification, signOut } from 'firebase/auth';
import { Mail, AlertCircle, LogOut, RefreshCw, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
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
      {/* High-end Cosmic Ambient Lighting */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none animate-pulse duration-[8s]" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-pink-500/10 rounded-full blur-[120px] pointer-events-none animate-pulse duration-[10s]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-[140px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-lg w-full bg-slate-900/40 border border-slate-800/80 backdrop-blur-3xl rounded-[2rem] shadow-[0_0_60px_-15px_rgba(99,102,241,0.3)] overflow-hidden relative z-10 p-8 md:p-10 text-center space-y-8"
      >
        {/* Futuristic Top Lip Neon Highlight */}
        <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-500 to-pink-500 opacity-60" />

        {/* Premium Rotating/Glow Envelope Frame */}
        <div className="flex justify-center">
          <div className="relative">
            {/* Ambient Backing Glow */}
            <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 rounded-3xl blur-xl opacity-30 animate-pulse" />
            <div className="w-24 h-24 bg-slate-950 border border-slate-850 rounded-3xl flex items-center justify-center shadow-2xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/10 via-transparent to-pink-500/10" />
              <Mail 
                className="w-10 h-10 text-indigo-400 group-hover:scale-110 transition-transform duration-300 animate-bounce" 
                style={{ animationDuration: '3s' }} 
              />
              {/* Premium overlapping Brand Logo Badge in corner */}
              <div className="absolute bottom-1 right-1 w-6.5 h-6.5 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-center overflow-hidden shadow-md">
                <img src="/favicon.png" alt="Glick Logo" className="w-full h-full object-cover" />
              </div>
            </div>
          </div>
        </div>

        {/* Header Block */}
        <div className="space-y-4">
          <h1 className="text-3.5xl font-black tracking-tight bg-gradient-to-r from-white via-indigo-100 to-pink-100 bg-clip-text text-transparent">
            Verify Your Email
          </h1>
          <p className="text-slate-400 text-sm font-medium leading-relaxed max-w-sm mx-auto">
            A verification link was dispatched to your address. Please click the link to confirm ownership and activate your workspace.
          </p>

          {/* Premium Email Address Pill Badge */}
          <div className="flex justify-center pt-2">
            <div className="px-4.5 py-2.5 bg-slate-950/80 border border-indigo-500/20 backdrop-blur-md rounded-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
              <span className="text-sm font-bold text-indigo-300 tracking-wide select-none">{auth.currentUser?.email}</span>
            </div>
          </div>
        </div>

        {/* Custom Actions Panel */}
        <div className="space-y-4 pt-2">
          {/* Primary High-Contrast Glow Action Button */}
          <button
            onClick={checkVerificationStatus}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-[0_0_30px_rgba(99,102,241,0.35)] active:translate-y-0.5 transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-sm uppercase tracking-wider font-black"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
            I Have Verified My Email
          </button>

          {/* Secondary Buttons Grid */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={resendVerificationEmail}
              disabled={resending || countdown > 0}
              className="flex-1 bg-slate-950/60 border border-slate-850 hover:bg-slate-900/60 text-slate-200 font-bold py-3.5 rounded-xl transition-all cursor-pointer text-xs uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
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
              className="flex items-center justify-center gap-2 bg-slate-950/30 hover:bg-slate-950/70 border border-slate-850 text-red-400 font-bold py-3.5 px-6 rounded-xl transition-all cursor-pointer text-xs uppercase tracking-wider"
            >
              <LogOut className="w-4 h-4 text-red-500" />
              Sign Out
            </button>
          </div>
        </div>

        {/* Premium Note helper */}
        <div className="p-4 bg-indigo-950/10 border border-indigo-950/35 rounded-2xl flex items-start gap-3 text-left backdrop-blur-sm">
          <AlertCircle className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
          <p className="text-xs text-slate-400 leading-relaxed font-medium">
            Didn't receive the email? Please check your <span className="text-indigo-300 font-bold">Spam or Junk folder</span>. The email is automatically dispatched from our Firebase Authentication system.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
