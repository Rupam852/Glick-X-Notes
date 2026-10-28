import React from 'react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { 
  LayoutDashboard, Settings, LogOut, FileText, Star, 
  Briefcase, Heart, Lightbulb, Archive, Folder, ChevronRight 
} from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { doc, onSnapshot } from 'firebase/firestore';
import { User as FirebaseUser } from 'firebase/auth';
import { sound } from '../utils/sound';

export interface FolderItem {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

export const NOTE_FOLDERS: FolderItem[] = [
  { id: 'all', name: 'All Notes', icon: FileText, color: 'text-indigo-500' },
  { id: 'pinned', name: 'Pinned & Starred', icon: Star, color: 'text-amber-500' },
  { id: 'work', name: 'Work & Projects', icon: Briefcase, color: 'text-sky-500' },
  { id: 'personal', name: 'Personal & Life', icon: Heart, color: 'text-emerald-500' },
  { id: 'ideas', name: 'Ideas & Brainstorm', icon: Lightbulb, color: 'text-yellow-500' },
  { id: 'archive', name: 'Archive', icon: Archive, color: 'text-slate-400' },
];

interface SidebarProps {
  user: FirebaseUser;
  activeView: string;
  onViewChange: (view: any) => void;
  selectedFolder?: string;
  onFolderChange?: (folderId: string) => void;
  folderCounts?: Record<string, number>;
  onSignOut?: () => void;
}

export default function Sidebar({ 
  user, 
  activeView, 
  onViewChange, 
  selectedFolder = 'all',
  onFolderChange,
  folderCounts = {},
  onSignOut
}: SidebarProps) {
  const { showToast } = useToast();
  const [userData, setUserData] = React.useState<any>(null);

  const getInitials = (name: string) => {
    if (!name) return 'G';
    const cleanName = name.includes('@') ? name.split('@')[0] : name;
    const parts = cleanName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0][0].toUpperCase();
  };

  React.useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (doc) => {
      if (doc.exists()) {
        setUserData(doc.data());
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}`, true);
    });
    return () => unsubscribe();
  }, [user.uid]);

  const handleSelectFolder = (folderId: string) => {
    sound.playPop();
    if (onFolderChange) {
      onFolderChange(folderId);
    }
    if (activeView !== 'dashboard') {
      onViewChange('dashboard');
    }
  };

  const handleNavClick = (view: string) => {
    sound.playPop();
    onViewChange(view);
  };

  return (
    <aside className="hidden md:flex flex-col w-64 lg:w-72 bg-[#f8f9fb]/95 dark:bg-[#0c1220]/95 backdrop-blur-xl border-r border-slate-200/70 dark:border-slate-800/80 h-screen sticky top-0 p-4 lg:p-5 space-y-5 lg:space-y-6 select-none shadow-[2px_0_12px_rgba(15,23,42,0.02)] transition-colors duration-200">
      
      {/* Brand Logo & Title */}
      <div className="flex items-center gap-3 px-2 pt-1">
        <div className="w-9 h-9 flex items-center justify-center shrink-0">
          <img src="/favicon.png?v=5" alt="Logo" className="w-full h-full object-contain filter drop-shadow-[0_2px_8px_rgba(99,102,241,0.35)] select-none" />
        </div>
        <div>
          <h1 className="text-lg font-black text-slate-900 dark:text-white tracking-tight leading-tight">
            Glick X Notes
          </h1>
          <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
            Workspace Pro
          </span>
        </div>
      </div>

      {/* Main Navigation */}
      <div className="space-y-1">
        <button
          onClick={() => handleNavClick('dashboard')}
          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all duration-150 font-semibold text-sm cursor-pointer ${
            activeView === 'dashboard' && selectedFolder === 'all'
              ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 font-bold shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <LayoutDashboard className="w-4.5 h-4.5 text-indigo-500" />
            <span>Dashboard</span>
          </div>
          {folderCounts['all'] !== undefined && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              {folderCounts['all']}
            </span>
          )}
        </button>

        <button
          onClick={() => handleNavClick('settings')}
          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all duration-150 font-semibold text-sm cursor-pointer ${
            activeView === 'settings'
              ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 font-bold shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <Settings className="w-4.5 h-4.5 text-slate-400" />
            <span>Settings</span>
          </div>
        </button>
      </div>

      {/* 🗂️ Notebooks / Folders Section Hierarchy */}
      <div className="flex-1 overflow-y-auto space-y-1 pr-1 -mr-1">
        <div className="flex items-center justify-between px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          <span className="flex items-center gap-1.5">
            <Folder className="w-3.5 h-3.5 text-indigo-400" /> Notebooks
          </span>
          <span className="text-[10px] font-medium text-slate-400">Hierarchy</span>
        </div>

        {NOTE_FOLDERS.map((folder) => {
          const Icon = folder.icon;
          const isSelected = activeView === 'dashboard' && selectedFolder === folder.id;
          const count = folderCounts[folder.id] ?? 0;

          return (
            <button
              key={folder.id}
              onClick={() => handleSelectFolder(folder.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer group ${
                isSelected
                  ? 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-l-[3px] border-indigo-600 dark:border-indigo-400 pl-[11px] font-bold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-850/60 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <Icon className={`w-4 h-4 shrink-0 ${folder.color}`} />
                <span className="truncate">{folder.name}</span>
              </div>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md transition-colors ${
                isSelected
                  ? 'bg-indigo-600 text-white dark:bg-indigo-500'
                  : 'text-slate-400 dark:text-slate-500 bg-slate-150/70 dark:bg-slate-800/80 group-hover:text-slate-700 dark:group-hover:text-slate-300'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* User Profile Footer Card */}
      <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800 space-y-3">
        <div className="bg-slate-100/70 dark:bg-slate-900/60 p-3 rounded-2xl border border-slate-200/60 dark:border-slate-800/70 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-extrabold text-xs overflow-hidden border border-white/80 dark:border-slate-700 bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 shadow-sm shrink-0 select-none">
            {userData?.photoURL ? (
              <img src={userData.photoURL} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              getInitials(userData?.displayName || user?.email || 'G')
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-800 dark:text-white truncate">
              {userData?.displayName || 'Glick X User'}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
              {user?.email}
            </p>
          </div>
        </div>

        <button 
          onClick={() => {
            if (onSignOut) {
              onSignOut();
            } else {
              sound.playSwoosh();
              auth.signOut();
            }
          }} 
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all font-bold cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>

    </aside>
  );
}
