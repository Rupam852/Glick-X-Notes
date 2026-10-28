import React, { useState } from 'react';
import { auth, db } from '../firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Mail, ArrowRight, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';

interface ForgotPasswordFormProps {
  onBackToLogin: () => void;
}

export default function ForgotPasswordForm({ onBackToLogin }: ForgotPasswordFormProps) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    const formattedEmail = email.trim().toLowerCase();

    try {
      // 1. Verify if email exists in the users collection first
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', formattedEmail));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        setError('This email is not registered with our app. Please sign up first.');
        setLoading(false);
        return;
      }

      // 2. Send password reset email
      await sendPasswordResetEmail(auth, formattedEmail);
      setSuccess(true);
    } catch (err: any) {
      if (err.code === 'auth/invalid-email') {
        setError('Invalid email format. Please check your spelling.');
      } else {
        setError(err.message || 'Failed to send reset email. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center space-y-6">
        <div className="flex justify-center">
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-full animate-bounce">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
          </div>
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Check your email</h3>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            We've sent a password reset link to <span className="font-semibold text-slate-900 dark:text-slate-200">{email}</span>.
          </p>
        </div>
        <button
          onClick={onBackToLogin}
          className="w-full bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 font-extrabold py-3.5 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-xs"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Login
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleResetPassword} className="space-y-5">
        <div className="space-y-2">
          <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-slate-950/80 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800/80 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-950 transition-all outline-none font-medium"
            />
          </div>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="flex items-center gap-2.5 text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 p-3.5 rounded-xl"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <p>{error}</p>
          </motion.div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-indigo-500 via-violet-600 to-pink-600 hover:from-indigo-400 hover:via-violet-500 hover:to-pink-500 text-white font-black py-3.5 rounded-xl hover:-translate-y-0.5 active:translate-y-0 shadow-lg shadow-indigo-500/20 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
        >
          {loading ? 'Sending link...' : 'Send Reset Link'}
          <ArrowRight className="w-4.5 h-4.5" />
        </button>

        <button
          type="button"
          onClick={onBackToLogin}
          className="w-full text-center text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors pt-2 cursor-pointer flex items-center justify-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Login
        </button>
      </form>
    </div>
  );
}
