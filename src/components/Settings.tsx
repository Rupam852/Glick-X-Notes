import React, { useState, useEffect } from 'react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { User as FirebaseUser } from 'firebase/auth';
import { User as UserIcon, Mail, Copy, Check, LogOut, Trash2, Camera, Loader2, Sparkles, BookOpen, PenTool, Calendar } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { motion, AnimatePresence } from 'motion/react';

export default function Settings({ user }: { user: FirebaseUser }) {
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
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
        // 1. Fetch Profile Data
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setUserData(userDoc.data());
        }

        // 2. Compute Intelligent Statistics
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

  const copyId = () => {
    if (user) {
      navigator.clipboard.writeText(user.uid);
      setCopied(true);
      showToast('User ID copied to clipboard', 'success');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 500 * 1024) { // 500KB limit for profile pic
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
      // 1. Delete all user notes and subcollections
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

      // 2. Delete user doc in Firestore
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        const batch = writeBatch(db);
        batch.delete(userDocRef);
        await batch.commit();
      }

      // 3. Delete user from Auth
      await user.delete();
      showToast('Your account and all associated data have been permanently deleted.', 'success');
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
      <div className="flex items-center gap-2">
        <Sparkles className="w-6 h-6 text-indigo-400 animate-pulse" />
        <h1 className="text-3xl font-black bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
          Workspace Settings
        </h1>
      </div>

      {/* 📊 Premium Intelligent Stats Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="relative overflow-hidden bg-slate-900/25 border border-slate-850 rounded-2xl p-6 shadow-md">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl" />
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-950/40 border border-indigo-900/40 rounded-xl text-indigo-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total Notes</p>
              <h4 className="text-2xl font-black text-white">{stats.totalNotes}</h4>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden bg-slate-900/25 border border-slate-850 rounded-2xl p-6 shadow-md">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl" />
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-950/40 border border-purple-900/40 rounded-xl text-purple-400">
              <PenTool className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Words Written</p>
              <h4 className="text-2xl font-black text-white">{stats.totalWords}</h4>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden bg-slate-900/25 border border-slate-850 rounded-2xl p-6 shadow-md">
          <div className="absolute top-0 right-0 w-24 h-24 bg-pink-500/5 rounded-full blur-2xl" />
          <div className="flex items-center gap-3">
            <div className="p-3 bg-pink-950/40 border border-pink-900/40 rounded-xl text-pink-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Days Active</p>
              <h4 className="text-2xl font-black text-white">{stats.activeDays} days</h4>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile Card & Info */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-slate-900/25 border border-slate-850 rounded-2xl p-6 space-y-6">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="relative">
                <div className="w-24 h-24 bg-indigo-950/40 border border-indigo-900/30 rounded-full flex items-center justify-center text-indigo-400 overflow-hidden shadow-lg">
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
                <h3 className="text-2xl font-black text-slate-100">{userData?.displayName || 'Glick User'}</h3>
                <p className="text-slate-400 text-sm font-medium flex items-center gap-1.5 justify-center sm:justify-start">
                  <Mail className="w-4 h-4 text-slate-500" />
                  {user?.email}
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-6 border-t border-slate-900">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Secure UID Key</label>
              <div className="flex items-center justify-between p-3 bg-slate-950/60 rounded-xl border border-slate-850">
                <code className="text-xs text-slate-300 font-mono truncate mr-4">{user?.uid}</code>
                <button onClick={copyId} className="text-slate-400 hover:text-indigo-400 transition-colors cursor-pointer">
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons Panel */}
        <div className="bg-slate-900/25 border border-slate-850 rounded-2xl p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Workspace Core</h3>
            
            <div className="space-y-2">
              <button onClick={() => auth.signOut()} className="w-full flex items-center gap-3 p-4 bg-slate-950/40 hover:bg-slate-900 border border-slate-850 rounded-xl transition-all cursor-pointer text-slate-300 font-bold text-xs uppercase tracking-wider">
                <LogOut className="w-4 h-4 text-slate-500" />
                Sign Out
              </button>

              <button 
                onClick={handleDeleteAllClick}
                disabled={deleting}
                className="w-full flex items-center gap-3 p-4 bg-red-950/20 hover:bg-red-900/20 border border-red-900/30 rounded-xl transition-all cursor-pointer text-red-400 font-bold text-xs uppercase tracking-wider disabled:opacity-50"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {deleting ? 'Purging data...' : 'Clear All Notes'}
              </button>
            </div>
          </div>

          <button 
            onClick={handleDeleteAccountClick}
            disabled={deleting || deletingAccount}
            className="w-full flex items-center justify-center gap-2 mt-6 p-4 bg-red-600 hover:bg-red-500 text-white rounded-xl transition-all cursor-pointer text-xs font-bold uppercase tracking-wider shadow-lg shadow-red-600/10 disabled:opacity-50"
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
            className="fixed inset-0 z-[150] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="max-w-md w-full bg-slate-900 border border-slate-800 backdrop-blur-2xl rounded-3xl p-6 shadow-2xl space-y-6 text-center"
            >
              <div className="flex justify-center">
                <div className="p-4 bg-red-950/40 border border-red-900/30 text-red-500 rounded-full animate-pulse">
                  <Trash2 className="w-8 h-8" />
                </div>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-white">Delete All Notes</h3>
                <p className="text-slate-400 text-sm font-medium leading-relaxed">
                  Are you sure you want to delete all notes inside this workspace? This action cannot be undone.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  onClick={() => setShowDeleteAllConfirm(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-750 font-bold py-3 rounded-xl transition-all cursor-pointer text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAllConfirm}
                  className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl shadow-lg transition-all cursor-pointer text-sm"
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
            className="fixed inset-0 z-[150] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="max-w-md w-full bg-slate-900 border border-red-900/20 backdrop-blur-2xl rounded-3xl p-6 shadow-2xl space-y-6"
            >
              <div className="flex justify-center text-center flex-col items-center space-y-2">
                <div className="p-4 bg-red-950/40 border border-red-900/30 text-red-500 rounded-full animate-bounce">
                  <Trash2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black text-white">Critical Security Verification</h3>
                <p className="text-slate-400 text-xs font-medium leading-relaxed text-center">
                  To permanently destroy your account and completely erase all cloud database directories, please verify this action by typing exactly the code string below:
                </p>
              </div>

              <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl text-center select-all">
                <code className="text-red-400 font-mono font-black tracking-widest text-sm">DELETE MY ACCOUNT</code>
              </div>

              <div className="space-y-1.5">
                <input
                  type="text"
                  placeholder="Type verification text..."
                  value={confirmDeleteText}
                  onChange={(e) => setConfirmDeleteText(e.target.value)}
                  className="w-full text-center px-4 py-3 bg-slate-950 border border-slate-850 focus:border-red-500/50 outline-none text-slate-100 rounded-xl transition-all font-mono font-black placeholder:text-slate-700 tracking-wider text-sm focus:ring-1 focus:ring-red-500/20"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  onClick={() => setShowDeleteAccountConfirm(false)}
                  className="flex-1 bg-slate-850 hover:bg-slate-800 text-slate-300 border border-slate-750 font-bold py-3 rounded-xl transition-all cursor-pointer text-xs uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccountConfirm}
                  disabled={confirmDeleteText !== 'DELETE MY ACCOUNT'}
                  className="flex-1 bg-red-600 hover:bg-red-500 disabled:bg-red-950/40 disabled:text-red-900/40 disabled:border-transparent text-white border border-red-500/20 font-bold py-3 rounded-xl shadow-lg transition-all cursor-pointer text-xs uppercase tracking-wider disabled:cursor-not-allowed"
                >
                  Confirm Destroy
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
