import React from 'react';
import { LayoutDashboard, Settings, Plus } from 'lucide-react';
import { sound } from '../utils/sound';

interface BottomNavProps {
  activeView: string;
  onViewChange: (view: any) => void;
  onNewNote: () => void;
}

export default function BottomNav({ activeView, onViewChange, onNewNote }: BottomNavProps) {
  return (
    <div className="md:hidden fixed bottom-0 left-0 w-full bg-white/90 dark:bg-[#0c1220]/90 backdrop-blur-xl border-t border-slate-200/80 dark:border-slate-800/80 px-12 py-3 flex items-center justify-between z-40 pb-[calc(10px+env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(0,0,0,0.04)]">
      <button
        onClick={() => {
          sound.playPop();
          onViewChange('dashboard');
        }}
        className={`p-2 rounded-xl transition-all cursor-pointer flex flex-col items-center gap-1 ${activeView === 'dashboard' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
      >
        <LayoutDashboard className="w-5 h-5" />
        <span className="text-[10px] font-bold uppercase tracking-wider">Home</span>
      </button>
      
      {/* Absolute centered and elevated floating button */}
      <div className="absolute left-1/2 -translate-x-1/2 -top-5">
        <button
          onClick={() => {
            sound.playPop();
            onNewNote();
          }}
          className="bg-gradient-to-tr from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white p-3.5 rounded-2xl shadow-xl shadow-indigo-500/30 border-4 border-white dark:border-[#0c1220] cursor-pointer active:scale-90 transition-all flex items-center justify-center"
        >
          <Plus className="w-6 h-6 stroke-[3]" />
        </button>
      </div>

      <button
        onClick={() => {
          sound.playPop();
          onViewChange('settings');
        }}
        className={`p-2 rounded-xl transition-all cursor-pointer flex flex-col items-center gap-1 ${activeView === 'settings' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
      >
        <Settings className="w-5 h-5" />
        <span className="text-[10px] font-bold uppercase tracking-wider">Settings</span>
      </button>
    </div>
  );
}
