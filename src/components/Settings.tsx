import React, { useState, useEffect } from 'react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { User as FirebaseUser } from 'firebase/auth';
import { User as UserIcon, Mail, Shield, Copy, Check, LogOut, Trash2, Camera, Moon, Sun, Loader2 } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { motion, AnimatePresence } from 'motion/react';

export default function Settings({ user }: { user: FirebaseUser }) {

  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);

  useEffect(() => {
    if (!user) return;

    const fetchUserData = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setUserData(userDoc.data());
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
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

      // Delete notes one by one to ensure sub-collections are also cleaned up
      // Note: For very large amounts of data, a cloud function would be better
      for (const noteDoc of notesSnapshot.docs) {
        const noteId = noteDoc.id;
        
        // 1. Get all attachments for this note
        const attachmentsQuery = collection(db, `notes/${noteId}/attachments`);
        const attachmentsSnapshot = await getDocs(attachmentsQuery);
        
        const batch = writeBatch(db);
        
        // 2. Add attachments to batch deletion
        attachmentsSnapshot.docs.forEach((attachmentDoc) => {
          batch.delete(attachmentDoc.ref);
        });
        
        // 3. Add the note itself to batch deletion
        batch.delete(noteDoc.ref);
        
        await batch.commit();
      }

      showToast('All notes have been successfully deleted', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'notes/multiple');
      showToast('Failed to delete notes', 'error');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Settings</h1>

      <div className="space-y-6">
        {/* Profile Card */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="relative">
              <div className="w-24 h-24 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 overflow-hidden border-4 border-white dark:border-slate-700 shadow-lg">
                {userData?.photoURL ? (
                  <img src={userData.photoURL} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <UserIcon className="w-12 h-12" />
                )}
              </div>
              <label className="absolute bottom-0 right-0 p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg cursor-pointer transition-all">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} disabled={uploading} />
              </label>
            </div>
            <div className="text-center sm:text-left">
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{userData?.displayName || 'AuthHub User'}</h3>
              <p className="text-slate-500 dark:text-slate-400">{user?.email}</p>
            </div>
          </div>

          <div className="space-y-4 pt-6 border-t border-slate-100 dark:border-slate-700">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">User ID</label>
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <code className="text-xs text-slate-600 dark:text-slate-300 font-mono truncate mr-4">{user?.uid}</code>
                <button onClick={copyId} className="text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer">
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1 italic">Use this ID to access your data from any device.</p>
            </div>
          </div>
        </div>


        {/* Account Actions */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 space-y-4">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Account Actions</h3>
          <div className="space-y-2">
            <button onClick={() => auth.signOut()} className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-xl transition-all cursor-pointer">
              <div className="flex items-center gap-3 text-slate-700 dark:text-slate-300 font-semibold">
                <LogOut className="w-5 h-5 text-slate-400" />
                Sign Out
              </div>
              <Check className="w-4 h-4 text-slate-200" />
            </button>
            <button 
              onClick={handleDeleteAllClick}
              disabled={deleting}
              className="w-full flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-xl transition-all cursor-pointer text-red-600 dark:text-red-400 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-3">
                {deleting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                {deleting ? 'Deleting Notes...' : 'Delete All Data'}
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Reusable Premium Delete All Confirmation Modal */}
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
                  Are you sure you want to delete all your notes? This action cannot be undone.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  onClick={() => setShowDeleteAllConfirm(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 font-bold py-3 rounded-xl transition-all cursor-pointer text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAllConfirm}
                  className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-red-600/10 hover:shadow-red-600/20 active:translate-y-0 transition-all cursor-pointer text-sm"
                >
                  Delete All
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
