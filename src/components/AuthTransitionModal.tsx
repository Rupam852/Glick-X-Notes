import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LogOut, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';

interface AuthTransitionModalProps {
  type: 'signin' | 'signout' | null;
  userName?: string;
}

export default function AuthTransitionModal({ type, userName }: AuthTransitionModalProps) {
  if (!type) return null;

  const isSignOut = type === 'signout';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-xl select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.85, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: -15 }}
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
        className="relative max-w-sm w-full bg-white/95 dark:bg-[#101726]/95 border border-slate-200/80 dark:border-slate-800/90 rounded-3xl p-8 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] text-center space-y-6 overflow-hidden"
      >
        {/* Ambient background glow behind card */}
        <div 
          className={`absolute -top-16 -right-16 w-44 h-44 rounded-full blur-3xl pointer-events-none ${
            isSignOut ? 'bg-rose-500/15' : 'bg-indigo-500/20'
          }`} 
        />
        <div 
          className={`absolute -bottom-16 -left-16 w-44 h-44 rounded-full blur-3xl pointer-events-none ${
            isSignOut ? 'bg-amber-500/15' : 'bg-blue-500/20'
          }`} 
        />

        {/* Central Round App Logo with Outer Rotating Spinner */}
        <div className="relative flex items-center justify-center pt-2 pb-1">
          {/* Subtle static circular track */}
          <div className="absolute w-24 h-24 rounded-full border border-slate-200/60 dark:border-slate-800/80" />

          {/* Rotating outer spinner ring around the round logo */}
          <div 
            className={`absolute w-24 h-24 rounded-full border-[3px] border-transparent animate-spin ${
              isSignOut 
                ? 'border-t-rose-500 border-r-amber-500/70 border-b-rose-400/20' 
                : 'border-t-indigo-600 border-r-blue-500 border-b-purple-500/30'
            }`} 
            style={{ animationDuration: '1.1s' }}
          />

          <div className="relative w-14 h-14 flex items-center justify-center z-10">
            <img 
              src="/favicon.png?v=5" 
              alt="Glick Logo" 
              className="w-full h-full object-contain select-none filter drop-shadow-[0_3px_12px_rgba(99,102,241,0.4)]" 
            />

            {/* Corner status icon badge */}
            <div 
              className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center shadow-md border-2 border-white dark:border-[#101726] ${
                isSignOut ? 'bg-rose-500 text-white' : 'bg-indigo-600 text-white'
              }`}
            >
              {isSignOut ? (
                <LogOut className="w-3 h-3 stroke-[2.5]" />
              ) : (
                <Sparkles className="w-3 h-3 fill-white" />
              )}
            </div>
          </div>
        </div>

        {/* Text Header */}
        <div className="space-y-1.5 relative z-10">
          <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
            {isSignOut ? 'Signing Out...' : `Welcome${userName ? `, ${userName}` : ''}!`}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
            {isSignOut 
              ? 'Securing your session and saving state to cloud'
              : 'Opening your workspace and synchronizing notes'}
          </p>
        </div>

        {/* Sleek loading pill badge */}
        <div className="pt-1 flex justify-center relative z-10">
          <div 
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] font-bold tracking-wide shadow-xs ${
              isSignOut
                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
            }`}
          >
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>{isSignOut ? 'Closing session...' : 'Loading Dashboard...'}</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
