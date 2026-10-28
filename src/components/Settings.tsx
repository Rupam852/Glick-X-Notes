import React, { useState, useEffect } from 'react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { User as FirebaseUser } from 'firebase/auth';
import { 
  User as UserIcon, Mail, Copy, Check, LogOut, Trash2, Camera, 
  Loader2, Sparkles, BookOpen, PenTool, Calendar, Sun, Moon, 
  Volume2, VolumeX, Palette, Bell
} from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { useTheme } from '../contexts/ThemeContext';
import { sound } from '../utils/sound';
import { motion, AnimatePresence } from 'motion/react';
import AIConfigModal from './AIConfigModal';
import { getAIConfig } from '../services/aiService';

export default function Settings({ user, onSignOut }: { user: FirebaseUser; onSignOut?: () => void }) {
  const { showToast } = useToast();
  const { theme, setTheme } = useTheme();
  
  const [copied, setCopied] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(sound.isEnabled());
  const [showAIModal, setShowAIModal] = useState(false);
  
  // Stats state
  const [stats, setStats] = useState({ totalNotes: 0, totalWords: 0, activeDays: 1 });

  // Confirmation States
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [confirmDeleteText, setConfirmDeleteText] = useState('');

  useEffect(() => {
    if (!user) return;

    const fetchUserDataAndStats = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setUserData(userDoc.data());
        }

        const notesQuery = query(collection(db, 'notes'), where('userId', '==', user.uid));
        const notesSnapshot = await getDocs(notesQuery);
        
        let words = 0;
        notesSnapshot.docs.forEach(d => {
          const bodyText = (d.data().body || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
          words += bodyText ? bodyText.split(/\s+/).filter(w => w).length : 0;
        });

        const creationTime = user.metadata.creationTime ? new Date(user.metadata.creationTime) : new Date();
        const activeDays = Math.max(1, Math.ceil((Date.now() - creationTime.getTime()) / (1024 * 60 * 60 * 24)));

        setStats({
          totalNotes: notesSnapshot.size,
          totalWords: words,
          activeDays
        });

      } catch (error) {
        console.error('Error fetching settings data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserDataAndStats();
  }, [user?.uid]);

  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    sound.playPop();
    setTheme(newTheme);
    showToast(`Switched to ${newTheme === 'light' ? 'Light' : 'Dark'} mode`, 'info');
  };

  const handleSoundToggle = () => {
    const next = !soundEnabled;
    sound.setEnabled(next);
    setSoundEnabled(next);
    if (next) {
      sound.playPop();
      showToast('Sound effects enabled', 'success');
    } else {
      showToast('Sound effects muted', 'info');
    }
  };

  const copyId = () => {
    if (user) {
      sound.playTick();
      navigator.clipboard.writeText(user.uid);
      setCopied(true);
      showToast('User ID copied to clipboard', 'success');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 500 * 1024) {
      showToast('Profile picture must be less than 500KB', 'error');
      return;
    }

    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      try {
        await setDoc(doc(db, 'users', user.uid), {
          photoURL: base64,
          updatedAt: serverTimestamp()
        }, { merge: true });
        setUserData((prev: any) => ({ ...prev, photoURL: base64 }));
        sound.playPop();
        showToast('Profile picture updated', 'success');
      } catch (error) {
        showToast('Failed to update profile picture', 'error');
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteAllClick = () => {
    sound.playPop();
    setShowDeleteAllConfirm(true);
  };

  const handleDeleteAllConfirm = async () => {
    setShowDeleteAllConfirm(false);
    if (!user) return;
    
    setDeleting(true);
    try {
      const notesQuery = query(collection(db, 'notes'), where('userId', '==', user.uid));
      const notesSnapshot = await getDocs(notesQuery);

      if (notesSnapshot.empty) {
        showToast('No notes found to delete', 'info');
        return;
      }

      for (const noteDoc of notesSnapshot.docs) {
        const noteId = noteDoc.id;
        const attachmentsQuery = collection(db, `notes/${noteId}/attachments`);
        const attachmentsSnapshot = await getDocs(attachmentsQuery);
        const batch = writeBatch(db);
        attachmentsSnapshot.docs.forEach((attachmentDoc) => {
          batch.delete(attachmentDoc.ref);
        });
        batch.delete(noteDoc.ref);
        await batch.commit();
      }

      sound.playSwoosh();
      setStats(prev => ({ ...prev, totalNotes: 0, totalWords: 0 }));
      showToast('All notes have been successfully deleted', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'notes/multiple');
      showToast('Failed to delete notes', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteAccountClick = () => {
    sound.playPop();
    setConfirmDeleteText('');
    setShowDeleteAccountConfirm(true);
  };

  const handleDeleteAccountConfirm = async () => {
    if (confirmDeleteText !== 'DELETE MY ACCOUNT') {
      showToast('Please type the confirmation text exactly to proceed', 'error');
      return;
    }

    setShowDeleteAccountConfirm(false);
    if (!user) return;

    setDeletingAccount(true);
    try {
      const notesQuery = query(collection(db, 'notes'), where('userId', '==', user.uid));
      const notesSnapshot = await getDocs(notesQuery);

      for (const noteDoc of notesSnapshot.docs) {
        const noteId = noteDoc.id;
        const attachmentsQuery = collection(db, `notes/${noteId}/attachments`);
        const attachmentsSnapshot = await getDocs(attachmentsQuery);
        const batch = writeBatch(db);
        attachmentsSnapshot.docs.forEach((attachmentDoc) => {
          batch.delete(attachmentDoc.ref);
        });
        batch.delete(noteDoc.ref);
        await batch.commit();
      }

      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        const batch = writeBatch(db);
        batch.delete(userDocRef);
        await batch.commit();
      }

      sound.playSwoosh();
      await user.delete();
      showToast('Your account and data have been permanently deleted.', 'success');
    } catch (error: any) {
      console.error('Error deleting account:', error);
      if (error.code === 'auth/requires-recent-login') {
        showToast('For security reasons, please Sign Out, Sign In again, and then try deleting your account.', 'error');
      } else {
        showToast(error.message || 'Failed to delete account. Please try again.', 'error');
      }
    } finally {
      setDeletingAccount(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 select-none">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8 select-none">
      
      {/* Settings Title Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
          Workspace Settings
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Personalize your appearance, account profile, and cloud storage preferences.
        </p>
      </div>

      {/* 🎨 Theme & Appearance Section (Light / Dark Mode Selection) */}
      <div className="bg-[#fafbfc]/90 dark:bg-slate-900/40 border border-slate-200/70 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs space-y-5 backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/70 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/60 rounded-xl text-indigo-600 dark:text-indigo-400">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Theme & Appearance</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Choose between soft eye-care light or deep dark mode. Default is soft light mode.
              </p>
            </div>
          </div>
        </div>

        {/* Visual Theme Selector Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Light Mode Card */}
          <button
            onClick={() => handleThemeChange('light')}
            className={`p-4 rounded-xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-3 ${
              theme === 'light'
                ? 'bg-gradient-to-br from-[#fafbfc] to-indigo-50/40 border-indigo-500 shadow-md ring-2 ring-indigo-500/20'
                : 'bg-slate-50/70 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                  <Sun className="w-4 h-4" />
                </div>
                <span className="font-bold text-sm text-slate-800 dark:text-slate-200">Light Mode</span>
              </div>
              {theme === 'light' && (
                <span className="px-2 py-0.5 bg-indigo-600 text-white text-[10px] font-bold rounded-full">
                  Active (Default)
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Eye-care warm alabaster & soft paper tones designed to eliminate glare and eye fatigue.
            </p>
          </button>

          {/* Dark Mode Card */}
          <button
            onClick={() => handleThemeChange('dark')}
            className={`p-4 rounded-xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-3 ${
              theme === 'dark'
                ? 'bg-gradient-to-br from-slate-900 to-indigo-950/40 border-indigo-500 shadow-md ring-2 ring-indigo-500/20'
                : 'bg-slate-50/70 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-900/60 text-indigo-300 rounded-lg">
                  <Moon className="w-4 h-4" />
                </div>
                <span className="font-bold text-sm text-slate-800 dark:text-slate-200">Dark Mode</span>
              </div>
              {theme === 'dark' && (
                <span className="px-2 py-0.5 bg-indigo-600 text-white text-[10px] font-bold rounded-full">
                  Active
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Deep slate & OLED background with glowing ambient highlights for low light.
            </p>
          </button>
        </div>

        {/* 🔊 Audio Micro-Interactions Toggle */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-850">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300">
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Micro-Interaction Audio</p>
              <p className="text-[11px] text-slate-400">Play pleasant haptic pop tones on clicks, pins, and actions</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => sound.playPop()}
              className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline px-2 py-1"
            >
              Test Sound
            </button>
            <button
              onClick={handleSoundToggle}
              className={`w-11 h-6 rounded-full transition-colors p-0.5 cursor-pointer ${
                soundEnabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                soundEnabled ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>
        </div>

      </div>

      {/* 🤖 AI Configuration Section */}
      <div className="bg-[#fafbfc]/90 dark:bg-slate-900/40 border border-slate-200/70 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs space-y-4 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-xl text-white shadow-md shadow-indigo-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-slate-900 dark:text-white">AI Engine Configuration</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">
                  {getAIConfig().mode === 'custom' ? 'Custom Engine' : 'Default Engine'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Configure smart assistance, test model latency, or connect your personal Google Gemini API key.
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowAIModal(true)}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm shadow-indigo-500/20 cursor-pointer shrink-0"
          >
            <Sparkles className="w-4 h-4" />
            Manage AI Engine
          </button>
        </div>
      </div>

      {/* 📊 Intelligent Workspace Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="relative overflow-hidden bg-[#fafbfc]/90 dark:bg-slate-900/35 border border-slate-200/70 dark:border-slate-800/80 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40 rounded-xl text-indigo-600 dark:text-indigo-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Total Notes</p>
              <h4 className="text-2xl font-black text-slate-800 dark:text-white">{stats.totalNotes}</h4>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden bg-[#fafbfc]/90 dark:bg-slate-900/35 border border-slate-200/70 dark:border-slate-800/80 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-50 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900/40 rounded-xl text-purple-600 dark:text-purple-400">
              <PenTool className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Words Written</p>
              <h4 className="text-2xl font-black text-slate-800 dark:text-white">{stats.totalWords}</h4>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden bg-[#fafbfc]/90 dark:bg-slate-900/35 border border-slate-200/70 dark:border-slate-800/80 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-pink-50 dark:bg-pink-950/40 border border-pink-100 dark:border-pink-900/40 rounded-xl text-pink-600 dark:text-pink-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Days Active</p>
              <h4 className="text-2xl font-black text-slate-800 dark:text-white">{stats.activeDays} days</h4>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Profile Card & Info */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-[#fafbfc]/90 dark:bg-slate-900/35 border border-slate-200/70 dark:border-slate-800/80 rounded-2xl p-6 space-y-6 shadow-xs">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="relative">
                <div className="w-24 h-24 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white overflow-hidden shadow-lg border-2 border-white dark:border-slate-800">
                  {userData?.photoURL ? (
                    <img src={userData.photoURL} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon className="w-12 h-12" />
                  )}
                </div>
                <label className="absolute bottom-0 right-0 p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg cursor-pointer transition-all">
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                  <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} disabled={uploading} />
                </label>
              </div>
              
              <div className="text-center sm:text-left space-y-1">
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                  {userData?.displayName || 'Glick User'}
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium flex items-center gap-1.5 justify-center sm:justify-start">
                  <Mail className="w-4 h-4 text-slate-400" />
                  {user?.email}
                </p>
                <div className="pt-2">
                  <button
                    onClick={copyId}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied UID' : 'Copy User ID'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons Panel */}
        <div className="bg-[#fafbfc]/90 dark:bg-slate-900/35 border border-slate-200/70 dark:border-slate-800/80 rounded-2xl p-6 flex flex-col justify-between shadow-xs">
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Workspace Actions
            </h3>
            
            <div className="space-y-2">
              <button 
                onClick={() => {
                  if (onSignOut) {
                    onSignOut();
                  } else {
                    sound.playSwoosh();
                    auth.signOut();
                  }
                }} 
                className="w-full flex items-center gap-3 p-3.5 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-950/40 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-xl transition-all cursor-pointer text-slate-700 dark:text-slate-300 font-bold text-xs uppercase tracking-wider"
              >
                <LogOut className="w-4 h-4 text-slate-400" />
                Sign Out
              </button>

              <button 
                onClick={handleDeleteAllClick}
                disabled={deleting}
                className="w-full flex items-center gap-3 p-3.5 bg-rose-50 hover:bg-rose-100 dark:bg-red-950/20 dark:hover:bg-red-900/20 border border-rose-200 dark:border-red-900/30 rounded-xl transition-all cursor-pointer text-rose-600 dark:text-red-400 font-bold text-xs uppercase tracking-wider disabled:opacity-50"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {deleting ? 'Purging data...' : 'Clear All Notes'}
              </button>
            </div>
          </div>

          <button 
            onClick={handleDeleteAccountClick}
            disabled={deleting || deletingAccount}
            className="w-full flex items-center justify-center gap-2 mt-6 p-3.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-all cursor-pointer text-xs font-bold uppercase tracking-wider shadow-md shadow-rose-600/10 disabled:opacity-50"
          >
            {deletingAccount ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Delete Account
          </button>
        </div>

      </div>

      {/* Delete All Notes Confirmation Modal */}
      <AnimatePresence>
        {showDeleteAllConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowDeleteAllConfirm(false)}
            className="fixed inset-0 z-[150] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 text-center"
            >
              <div className="flex justify-center">
                <div className="p-4 bg-rose-100 dark:bg-red-950/40 text-rose-600 dark:text-red-500 rounded-full">
                  <Trash2 className="w-8 h-8" />
                </div>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Delete All Notes</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium leading-relaxed">
                  Are you sure you want to delete all notes inside this workspace? This action cannot be undone.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  onClick={() => setShowDeleteAllConfirm(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 font-bold py-3 rounded-xl transition-all cursor-pointer text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAllConfirm}
                  className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold py-3 rounded-xl shadow-lg transition-all cursor-pointer text-sm"
                >
                  Purge Notes
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reusable Double-Verification Deletion Modal */}
      <AnimatePresence>
        {showDeleteAccountConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowDeleteAccountConfirm(false)}
            className="fixed inset-0 z-[150] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="max-w-md w-full bg-white dark:bg-slate-900 border border-rose-200 dark:border-red-900/30 rounded-3xl p-6 shadow-2xl space-y-6"
            >
              <div className="flex justify-center text-center flex-col items-center space-y-2">
                <div className="p-4 bg-rose-100 dark:bg-red-950/40 text-rose-600 dark:text-red-500 rounded-full">
                  <Trash2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">Critical Verification</h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs font-medium leading-relaxed text-center">
                  To permanently destroy your account and completely erase all cloud database records, please type the confirmation code below:
                </p>
              </div>

              <div className="bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 p-4 rounded-xl text-center select-all">
                <code className="text-rose-600 dark:text-red-400 font-mono font-black tracking-widest text-sm">DELETE MY ACCOUNT</code>
              </div>

              <div className="space-y-1.5">
                <input
                  type="text"
                  placeholder="Type verification text..."
                  value={confirmDeleteText}
                  onChange={(e) => setConfirmDeleteText(e.target.value)}
                  className="w-full text-center px-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 focus:border-rose-500 outline-none text-slate-900 dark:text-slate-100 rounded-xl transition-all font-mono font-black placeholder:text-slate-400 tracking-wider text-sm focus:ring-1 focus:ring-rose-500"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  onClick={() => setShowDeleteAccountConfirm(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-bold py-3 rounded-xl transition-all cursor-pointer text-xs uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccountConfirm}
                  disabled={confirmDeleteText !== 'DELETE MY ACCOUNT'}
                  className="flex-1 bg-rose-600 hover:bg-rose-500 disabled:bg-rose-300 dark:disabled:bg-red-950/40 disabled:text-rose-100 text-white font-bold py-3 rounded-xl shadow-lg transition-all cursor-pointer text-xs uppercase tracking-wider disabled:cursor-not-allowed"
                >
                  Confirm Destroy
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Configuration Modal */}
      <AIConfigModal 
        isOpen={showAIModal} 
        onClose={() => setShowAIModal(false)} 
      />
    </div>
  );
}
