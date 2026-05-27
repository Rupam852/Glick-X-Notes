import React from 'react';
import { LayoutDashboard, Settings, Plus } from 'lucide-react';

interface BottomNavProps {
  activeView: string;
  onViewChange: (view: any) => void;
  onNewNote: () => void;
}

export default function BottomNav({ activeView, onViewChange, onNewNote }: BottomNavProps) {
  return (
    <div className="md:hidden fixed bottom-0 left-0 w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-t border-slate-100 dark:border-slate-800 px-12 py-3 flex items-center justify-between z-40 pb-[calc(10px+env(safe-area-inset-bottom))]">
      <button
        onClick={() => onViewChange('dashboard')}
        className={`p-2 rounded-xl transition-all cursor-pointer flex flex-col items-center gap-1 ${activeView === 'dashboard' ? 'text-indigo-600' : 'text-slate-400'}`}
      >
        <LayoutDashboard className="w-6 h-6" />
        <span className="text-[10px] font-bold uppercase tracking-tighter">Home</span>
      </button>
      
      {/* Absolute centered and elevated floating button */}
      <div className="absolute left-1/2 -translate-x-1/2 -top-5">
        <button
          onClick={onNewNote}
          className="bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-2xl shadow-xl shadow-indigo-500/30 dark:shadow-none border-4 border-white dark:border-slate-900 cursor-pointer active:scale-90 transition-all flex items-center justify-center"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      <button
        onClick={() => onViewChange('settings')}
        className={`p-2 rounded-xl transition-all cursor-pointer flex flex-col items-center gap-1 ${activeView === 'settings' ? 'text-indigo-600' : 'text-slate-400'}`}
      >
        <Settings className="w-6 h-6" />
        <span className="text-[10px] font-bold uppercase tracking-tighter">Profile</span>
      </button>
    </div>
  );
}
