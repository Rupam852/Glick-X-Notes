import React from 'react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { LayoutDashboard, Settings, LogOut, User, Copy, Check, FileText } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { collection, getDocs, writeBatch, doc, onSnapshot } from 'firebase/firestore';
import { User as FirebaseUser } from 'firebase/auth';

interface SidebarProps {
  user: FirebaseUser;
  activeView: string;
  onViewChange: (view: any) => void;
}

export default function Sidebar({ user, activeView, onViewChange }: SidebarProps) {
  const { showToast } = useToast();
  const [copied, setCopied] = React.useState(false);
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

  const copyId = () => {
    if (user) {
      navigator.clipboard.writeText(user.uid);
      setCopied(true);
      showToast('User ID copied to clipboard', 'success');
      setTimeout(() => setCopied(false), 2000);
    }
  };



  return (
    <div className="hidden md:flex flex-col w-72 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 h-screen sticky top-0 p-6 space-y-8">
      <div className="flex items-center gap-3 px-2">
        <div className="w-10 h-10 bg-slate-950 rounded-xl flex items-center justify-center shadow-lg border border-slate-800/80 overflow-hidden">
          <img src="/favicon.png" alt="Logo" className="w-full h-full object-cover" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Glick X Notes</h1>
      </div>

      <div className="flex-1 space-y-1">
        <button
          onClick={() => onViewChange('dashboard')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-semibold cursor-pointer ${activeView === 'dashboard' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 dark:text-slate-400'}`}
        >
          <LayoutDashboard className="w-5 h-5" />
          Dashboard
        </button>
        <button
          onClick={() => onViewChange('settings')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-semibold cursor-pointer ${activeView === 'settings' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 dark:text-slate-400'}`}
        >
          <Settings className="w-5 h-5" />
          Settings
        </button>
      </div>

      <div className="space-y-4">
        {/* User Profile Card */}
        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-extrabold text-xs overflow-hidden border-2 border-white dark:border-slate-700 bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 shadow-md shrink-0 select-none">
              {userData?.photoURL ? (
                <img src={userData.photoURL} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                getInitials(userData?.displayName || user?.email || 'G')
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{userData?.displayName || 'Glick X User'}</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{user?.email}</p>
            </div>
          </div>
          
          <div className="space-y-1 pt-3 border-t border-slate-100 dark:border-slate-700">
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <span>Device ID</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <code className="text-[10px] text-slate-600 dark:text-slate-300 truncate flex-1 font-mono">{user?.uid}</code>
              <button onClick={copyId} className="text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer">
                {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button onClick={() => auth.signOut()} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all font-semibold cursor-pointer">
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
