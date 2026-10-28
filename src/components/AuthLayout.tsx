import { motion } from 'motion/react';
import { ReactNode } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { Sun, Moon } from 'lucide-react';

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle: string;
}

export default function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex items-center justify-center p-4 font-sans relative overflow-hidden transition-colors duration-200">
      {/* Background Tech Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#80808007_1px,transparent_1px),linear-gradient(to_bottom,#80808007_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none -z-20" />
      
      {/* Dynamic Glowing Ambient Blobs */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-500/15 dark:bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none animate-pulse duration-[8s]" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-pink-500/15 dark:bg-pink-500/10 rounded-full blur-[100px] pointer-events-none animate-pulse duration-[10s]" />

      {/* Floating Theme Toggle Switch at Top-Right */}
      <div className="absolute top-5 right-5 z-20">
        <button
          onClick={toggleTheme}
          type="button"
          aria-label="Toggle Light and Dark Mode"
          className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 shadow-sm hover:shadow-md transition-all active:scale-95 flex items-center gap-2 cursor-pointer backdrop-blur-md"
          title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
        >
          {theme === 'light' ? (
            <Moon className="w-4 h-4 text-slate-700" />
          ) : (
            <Sun className="w-4 h-4 text-amber-400" />
          )}
          <span className="text-xs font-bold hidden sm:inline">
            {theme === 'light' ? 'Dark' : 'Light'}
          </span>
        </button>
      </div>
      
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-lg w-full bg-white/90 dark:bg-slate-900/40 border border-slate-200/90 dark:border-slate-800/80 backdrop-blur-2xl rounded-[2rem] shadow-2xl shadow-indigo-500/5 dark:shadow-[0_0_50px_-12px_rgba(99,102,241,0.25)] overflow-hidden relative z-10 transition-colors duration-200"
      >
        <div className="p-8 md:p-10">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-white dark:bg-[#080d19] rounded-2xl flex items-center justify-center shadow-md dark:shadow-lg border border-slate-200 dark:border-slate-700/60 p-2.5 overflow-hidden">
              <img src="/favicon.png?v=4" alt="Logo" className="w-full h-full object-contain filter drop-shadow-[0_2px_8px_rgba(99,102,241,0.25)]" />
            </div>
          </div>
          
          <div className="text-center mb-8 space-y-2">
            <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-800 dark:from-white dark:via-indigo-100 dark:to-pink-100 bg-clip-text text-transparent">
              {title}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-normal">
              {subtitle}
            </p>
          </div>

          {children}
        </div>
      </motion.div>
    </div>
  );
}
