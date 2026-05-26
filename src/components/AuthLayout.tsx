import { motion } from 'motion/react';
import { ReactNode } from 'react';

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle: string;
}

export default function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans relative overflow-hidden">
      {/* Background Tech Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808007_1px,transparent_1px),linear-gradient(to_bottom,#80808007_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none -z-20" />
      
      {/* Dynamic Glowing Ambient Blobs */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none animate-pulse duration-[8s]" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-pink-500/10 rounded-full blur-[100px] pointer-events-none animate-pulse duration-[10s]" />
      
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-md w-full bg-slate-900/40 border border-slate-800/80 backdrop-blur-2xl rounded-[2rem] shadow-[0_0_50px_-12px_rgba(99,102,241,0.25)] overflow-hidden relative z-10"
      >
        <div className="p-8 md:p-10">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-slate-950 rounded-2xl flex items-center justify-center shadow-lg border border-slate-800/80 overflow-hidden">
              <img src="/favicon.png" alt="Logo" className="w-full h-full object-cover" />
            </div>
          </div>
          
          <div className="text-center mb-8 space-y-2">
            <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-white via-indigo-100 to-pink-100 bg-clip-text text-transparent">{title}</h1>
            <p className="text-slate-400 text-sm font-normal">{subtitle}</p>
          </div>

          {children}
        </div>
      </motion.div>
    </div>
  );
}
