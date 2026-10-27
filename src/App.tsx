/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
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
import { ToastProvider, useToast } from './contexts/ToastContext';
import { Note } from './types';
import { sound } from './utils/sound';
import SmartBackGesture from './components/SmartBackGesture';
import { triggerSmartBack } from './utils/smartBackNavigation';

function AppContent() {
  const { showToast } = useToast();
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

  const userRef = useRef<User | null>(null);
  const isInitialAuthCheck = useRef(true);
  const authTransitionTimer = useRef<NodeJS.Timeout | null>(null);

  // Unified auth transition animator (guarantees spinner displays first, blocking dashboard)
  const startAuthTransition = useCallback((type: 'signin' | 'signout', name?: string) => {
    if (authTransitionTimer.current) clearTimeout(authTransitionTimer.current);
    if (type === 'signin') sound.playPop();
    else sound.playSwoosh();

    const targetUser = name || auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || '';
    setTransitionUser(targetUser);
    setAuthTransition(type);

    authTransitionTimer.current = setTimeout(() => {
      setAuthTransition(null);
      // Immediately reset scroll to top so target page never opens scrolled down
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;

      if (type === 'signin') {
        setView('dashboard');
        sessionStorage.setItem('glick_notes_view', 'dashboard');
        window.history.replaceState({ view: 'dashboard', editingNote: null }, '');
      } else {
        setView('landing');
        sessionStorage.setItem('glick_notes_view', 'landing');
        window.history.replaceState({ view: 'landing', editingNote: null }, '');
      }
    }, type === 'signin' ? 1200 : 900);
  }, []);

  useEffect(() => {
    // Safety fallback timeout so the app never hangs indefinitely on cold start/slow network
    const fallbackTimer = setTimeout(() => {
      setLoading(false);
    }, 2500);

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      clearTimeout(fallbackTimer);
      
      const isInitial = isInitialAuthCheck.current;
      isInitialAuthCheck.current = false;

      const isFreshSignIn = !isInitial && !!currentUser && !userRef.current;
      userRef.current = currentUser;

      if (isFreshSignIn) {
        startAuthTransition('signin', currentUser.displayName || currentUser.email?.split('@')[0] || '');
      }

      setUser(currentUser);
      
      const savedView = sessionStorage.getItem('glick_notes_view');
      let parsedNote = null;
      try {
        const savedNote = sessionStorage.getItem('glick_notes_editing_note');
        parsedNote = savedNote && savedNote !== 'undefined' ? JSON.parse(savedNote) : null;
      } catch (e) {
        console.error("Error parsing editing note on auth change:", e);
      }

      if (currentUser) {
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

    return () => {
      clearTimeout(fallbackTimer);
      if (authTransitionTimer.current) clearTimeout(authTransitionTimer.current);
      unsubscribe();
    };
  }, [startAuthTransition]);

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

  // Sync state with browser history + Smart modal interception
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      // 1. If an active modal, sheet, or popup is open, close it without changing view
      const modalHandled = triggerSmartBack();
      if (modalHandled) {
        window.history.pushState({ view, editingNote }, '');
        return;
      }

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
  }, [user, view, editingNote]);

  // Reset scroll to top on any view switch
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [view]);

  // Wrapper for setView that also updates history and sessionStorage
  const navigateTo = useCallback((newView: typeof view, note: Note | null = null) => {
    // Only push state if it's a different view or note
    if (view === newView && editingNote?.id === note?.id) return;
    
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

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

  const lastBackPressTimeRef = useRef<number>(0);

  // 🛡️ Global Smart Back Gesture handler (Edge swipe & Programmatic Back)
  const handleSmartBackGesture = useCallback(() => {
    // 1. Check if any active modal or sheet consumes the gesture
    const handledByModal = triggerSmartBack();
    if (handledByModal) return;

    // 2. Hierarchical View navigation
    if (view === 'editor' || view === 'settings') {
      navigateTo('dashboard');
      return;
    }

    if (view === 'login' || view === 'signup' || view === 'forgot-password') {
      navigateTo('landing');
      return;
    }

    // 3. Root views: Dashboard (logged in) or Landing (guest)
    if (view === 'dashboard' || view === 'landing') {
      const now = Date.now();
      if (now - lastBackPressTimeRef.current < 2500) {
        // Double-back within 2.5s -> allow browser exit
        window.history.back();
      } else {
        lastBackPressTimeRef.current = now;
        showToast('Swipe or press back again to exit', 'info');
      }
    }
  }, [view, navigateTo, showToast]);

  // Smooth Sign In transition with centered modal popup and spinner
  const handleLoginSuccess = useCallback((userName?: string) => {
    startAuthTransition('signin', userName);
  }, [startAuthTransition]);

  // Smooth Sign Out transition with centered modal popup and spinner
  const handleInitiateSignOut = useCallback(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    startAuthTransition('signout');
    setTimeout(async () => {
      try {
        await auth.signOut();
        sessionStorage.clear();
      } catch (e) {
        console.error("Sign out error:", e);
      }
    }, 700);
  }, [startAuthTransition]);

  // Priority 1: Auth Transition Modal (blocks Dashboard from appearing until transition completes)
  if (authTransition === 'signin' || authTransition === 'signout') {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0b0f19] flex items-center justify-center p-4 select-none">
        <AuthTransitionModal type={authTransition} userName={transitionUser} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0b0f19] flex flex-col items-center justify-center p-4 select-none">
        <div className="relative flex items-center justify-center mb-5">
          {/* Subtle static track */}
          <div className="w-20 h-20 rounded-full border border-slate-200/80 dark:border-slate-800" />
          {/* Spinning ring */}
          <div className="absolute w-20 h-20 rounded-full border-[3px] border-transparent border-t-indigo-600 border-r-blue-500 animate-spin" />
          {/* Logo center */}
          <div className="absolute w-14 h-14 rounded-full p-2 bg-[#080d19] dark:bg-slate-950 shadow-lg border border-slate-700/60 dark:border-slate-800 flex items-center justify-center">
            <img 
              src="/favicon.png?v=4" 
              alt="Glick Notes" 
              className="w-full h-full object-contain filter drop-shadow-[0_2px_8px_rgba(99,102,241,0.4)]" 
            />
          </div>
        </div>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wider uppercase animate-pulse">
          Loading Glick Notes...
        </p>
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
        <>
          <SmartBackGesture onBack={handleSmartBackGesture} />
          <LandingPage 
            onLogin={() => navigateTo('login')}
            onSignup={() => navigateTo('signup')}
          />
        </>
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
      <>
        <SmartBackGesture onBack={handleSmartBackGesture} />
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
        </AuthLayout>
      </>
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
      <>
        <SmartBackGesture onBack={handleSmartBackGesture} />
        <NoteEditor 
          user={user}
          note={editingNote} 
          onBack={() => navigateTo('dashboard')} 
          onSave={(updatedNote) => {
            setEditingNote(updatedNote);
            sessionStorage.setItem('glick_notes_editing_note', JSON.stringify(updatedNote));
            window.history.replaceState({ view: 'editor', editingNote: updatedNote }, '');
          }}
        />
      </>
    );
  }

  return (
    <>
      <SmartBackGesture onBack={handleSmartBackGesture} />
      <div className="min-h-screen bg-[#f2f4f7] dark:bg-[#0b0f19] text-slate-800 dark:text-slate-100 flex flex-col md:flex-row transition-colors duration-200">
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
              onNewNote={() => {
                const defaultFolder = (selectedFolder !== 'all' && selectedFolder !== 'pinned') ? selectedFolder : 'all';
                navigateTo('editor', { folder: defaultFolder } as any);
              }}
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
          onNewNote={() => {
            const defaultFolder = (selectedFolder !== 'all' && selectedFolder !== 'pinned') ? selectedFolder : 'all';
            navigateTo('editor', { folder: defaultFolder } as any);
          }} 
        />
      </div>
    </>
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

