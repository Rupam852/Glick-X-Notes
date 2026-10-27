/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import AuthLayout from './components/AuthLayout';
import LoginForm from './components/LoginForm';
import SignupForm from './components/SignupForm';
import ForgotPasswordForm from './components/ForgotPasswordForm';
import Dashboard from './components/Dashboard';
import NoteEditor from './components/NoteEditor';
import Sidebar from './components/Sidebar';
import BottomNav from './components/BottomNav';
import Settings from './components/Settings';
import LandingPage from './components/LandingPage';
import EmailVerification from './components/EmailVerification';
import EmailActionHandler from './components/EmailActionHandler';
import AuthTransitionModal from './components/AuthTransitionModal';
import { Loader2 } from 'lucide-react';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import { Note } from './types';
import { sound } from './utils/sound';

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [folderCounts, setFolderCounts] = useState<Record<string, number>>({});
  const [authTransition, setAuthTransition] = useState<'signin' | 'signout' | null>(null);
  const [transitionUser, setTransitionUser] = useState<string>('');
  
  // Read initial view from sessionStorage, default to 'landing'
  const [view, setView] = useState<'landing' | 'login' | 'signup' | 'forgot-password' | 'dashboard' | 'settings' | 'editor'>(() => {
    const savedView = sessionStorage.getItem('glick_notes_view');
    return (savedView as any) || 'landing';
  });

  const [editingNote, setEditingNote] = useState<Note | null>(() => {
    try {
      const savedNote = sessionStorage.getItem('glick_notes_editing_note');
      return savedNote && savedNote !== 'undefined' ? JSON.parse(savedNote) : null;
    } catch (e) {
      console.error("Error parsing editing note on init:", e);
      return null;
    }
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      
      const savedView = sessionStorage.getItem('glick_notes_view');
      let parsedNote = null;
      try {
        const savedNote = sessionStorage.getItem('glick_notes_editing_note');
        parsedNote = savedNote && savedNote !== 'undefined' ? JSON.parse(savedNote) : null;
      } catch (e) {
        console.error("Error parsing editing note on auth change:", e);
      }

      if (user) {
        // If logged in, check if the saved view is a valid logged-in view
        if (savedView === 'settings' || savedView === 'editor' || savedView === 'dashboard') {
          setView(savedView as any);
          setEditingNote(parsedNote);
          window.history.replaceState({ view: savedView, editingNote: parsedNote }, '');
        } else {
          // Default to dashboard
          setView('dashboard');
          sessionStorage.setItem('glick_notes_view', 'dashboard');
          window.history.replaceState({ view: 'dashboard', editingNote: null }, '');
        }
      } else {
        // If not logged in, check if the saved view is a valid guest view
        if (savedView === 'login' || savedView === 'signup' || savedView === 'forgot-password' || savedView === 'landing') {
          setView(savedView as any);
          window.history.replaceState({ view: savedView, editingNote: null }, '');
        } else {
          // Default to landing
          setView('landing');
          sessionStorage.setItem('glick_notes_view', 'landing');
          window.history.replaceState({ view: 'landing', editingNote: null }, '');
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Listen to user's notes in real-time to compute folder counts for the sidebar
  useEffect(() => {
    if (!user) {
      setFolderCounts({});
      return;
    }

    const q = query(collection(db, 'notes'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const counts: Record<string, number> = {
        all: snapshot.size,
        pinned: 0,
        work: 0,
        personal: 0,
        ideas: 0,
        archive: 0
      };

      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.pinned) counts.pinned++;
        const tags = (data.tags || []).map((t: string) => t.toLowerCase());
        const folder = data.folder || '';
        if (folder === 'work' || tags.some((t: string) => t.includes('work') || t.includes('project'))) counts.work++;
        if (folder === 'personal' || tags.some((t: string) => t.includes('personal') || t.includes('life'))) counts.personal++;
        if (folder === 'ideas' || tags.some((t: string) => t.includes('idea') || t.includes('brainstorm'))) counts.ideas++;
        if (folder === 'archive') counts.archive++;
      });

      setFolderCounts(counts);
    });

    return () => unsubscribe();
  }, [user]);

  // Sync state with browser history
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (event.state) {
        const { view: targetView, editingNote: targetNote } = event.state;
        setView(targetView);
        setEditingNote(targetNote);
        
        sessionStorage.setItem('glick_notes_view', targetView);
        if (targetNote) {
          sessionStorage.setItem('glick_notes_editing_note', JSON.stringify(targetNote));
        } else {
          sessionStorage.removeItem('glick_notes_editing_note');
        }
      } else {
        const defaultView = user ? 'dashboard' : 'landing';
        setView(defaultView);
        setEditingNote(null);
        
        sessionStorage.setItem('glick_notes_view', defaultView);
        sessionStorage.removeItem('glick_notes_editing_note');
      }
    };

    window.addEventListener('popstate', handlePopState);
  
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [user]);

  // Wrapper for setView that also updates history and sessionStorage
  const navigateTo = useCallback((newView: typeof view, note: Note | null = null) => {
    // Only push state if it's a different view or note
    if (view === newView && editingNote?.id === note?.id) return;
    
    setView(newView);
    setEditingNote(note);
    
    sessionStorage.setItem('glick_notes_view', newView);
    if (note) {
      sessionStorage.setItem('glick_notes_editing_note', JSON.stringify(note));
    } else {
      sessionStorage.removeItem('glick_notes_editing_note');
    }
    
    window.history.pushState({ view: newView, editingNote: note }, '');
  }, [view, editingNote]);

  // Smooth Sign In transition with centered modal popup and spinner
  const handleLoginSuccess = useCallback((userName?: string) => {
    sound.playPop();
    setTransitionUser(userName || auth.currentUser?.displayName || '');
    setAuthTransition('signin');
    setTimeout(() => {
      setAuthTransition(null);
      navigateTo('dashboard');
    }, 1100);
  }, [navigateTo]);

  // Smooth Sign Out transition with centered modal popup and spinner
  const handleInitiateSignOut = useCallback(() => {
    sound.playSwoosh();
    setAuthTransition('signout');
    setTimeout(async () => {
      try {
        await auth.signOut();
      } finally {
        setTimeout(() => {
          setAuthTransition(null);
          navigateTo('landing');
        }, 300);
      }
    }, 900);
  }, [navigateTo]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f8fc] dark:bg-[#0b0f19] flex items-center justify-center p-4">
        <AuthTransitionModal type="signin" userName="" />
      </div>
    );
  }

  // Check if current URL parameters indicate a Firebase Auth Action Link (like email verification or password reset)
  const urlParams = new URLSearchParams(window.location.search);
  const oobCode = urlParams.get('oobCode');
  const mode = urlParams.get('mode');

  if (mode && oobCode) {
    return (
      <EmailActionHandler 
        onContinue={() => {
          // Clear query parameters from URL and redirect to login
          window.history.replaceState({}, document.title, window.location.pathname);
          navigateTo('login');
        }}
      />
    );
  }

  if (!user) {
    if (view === 'landing') {
      return (
        <LandingPage 
          onLogin={() => navigateTo('login')}
          onSignup={() => navigateTo('signup')}
        />
      );
    }

    const getTitle = () => {
      switch (view) {
        case 'login': return "Welcome Back";
        case 'signup': return "Create Account";
        case 'forgot-password': return "Reset Password";
        default: return "Welcome Back";
      }
    };

    const getSubtitle = () => {
      switch (view) {
        case 'login': return "Please enter your details to sign in";
        case 'signup': return "Join Glick X Notes to secure your digital identity";
        case 'forgot-password': return "We'll send you a link to reset your password";
        default: return "Please enter your details to sign in";
      }
    };

    return (
      <AuthLayout 
        title={getTitle()} 
        subtitle={getSubtitle()}
      >
        {view === 'login' && (
          <LoginForm 
            onSwitchToSignup={() => navigateTo('signup')} 
            onForgotPassword={() => navigateTo('forgot-password')} 
            onSuccess={handleLoginSuccess} 
          />
        )}
        {view === 'signup' && (
          <SignupForm 
            onSwitchToLogin={() => navigateTo('login')} 
            onSuccess={handleLoginSuccess} 
          />
        )}
        {view === 'forgot-password' && (
          <ForgotPasswordForm 
            onBackToLogin={() => navigateTo('login')} 
          />
        )}
        <AuthTransitionModal type={authTransition} userName={transitionUser} />
      </AuthLayout>
    );
  }

  // Intercept and enforce email verification
  if (user && !user.emailVerified) {
    return (
      <EmailVerification 
        onVerified={() => {
          if (auth.currentUser) {
            setUser(Object.assign(Object.create(Object.getPrototypeOf(auth.currentUser)), auth.currentUser));
          }
        }}
      />
    );
  }

  if (view === 'editor') {
    return (
      <NoteEditor 
        user={user}
        note={editingNote} 
        onBack={() => {
          // Instead of setView, we go back in history if possible
          // or just navigate to dashboard and push state
          window.history.back();
        }} 
        onSave={(updatedNote) => {
          setEditingNote(updatedNote);
          sessionStorage.setItem('glick_notes_editing_note', JSON.stringify(updatedNote));
          window.history.replaceState({ view: 'editor', editingNote: updatedNote }, '');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f8fc] dark:bg-[#0b0f19] text-slate-800 dark:text-slate-100 flex flex-col md:flex-row transition-colors duration-200">
      <Sidebar 
        user={user} 
        activeView={view} 
        onViewChange={(v) => navigateTo(v)} 
        selectedFolder={selectedFolder}
        onFolderChange={(f) => setSelectedFolder(f)}
        folderCounts={folderCounts}
        onSignOut={handleInitiateSignOut}
      />
      
      <main className="flex-1 overflow-y-auto pb-24 md:pb-0">
        {view === 'dashboard' && (
          <Dashboard 
            user={user}
            onEditNote={(note) => navigateTo('editor', note)}
            onNewNote={() => navigateTo('editor', null)}
            selectedFolder={selectedFolder}
            onFolderChange={(f) => setSelectedFolder(f)}
          />
        )}
        {view === 'settings' && (
          <Settings user={user} onSignOut={handleInitiateSignOut} />
        )}
      </main>

      <BottomNav 
        activeView={view} 
        onViewChange={(v) => navigateTo(v)} 
        onNewNote={() => navigateTo('editor', null)} 
      />

      {/* Centered Smooth Auth Transition Popup Modal */}
      <AuthTransitionModal type={authTransition} userName={transitionUser} />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </ThemeProvider>
  );
}

