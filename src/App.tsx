/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import { auth } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
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
import { Loader2 } from 'lucide-react';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import { Note } from './types';

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'landing' | 'login' | 'signup' | 'forgot-password' | 'dashboard' | 'settings' | 'editor'>('landing');
  const [editingNote, setEditingNote] = useState<Note | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (user) {
        setView('dashboard');
        // Initialize history state for dashboard
        window.history.replaceState({ view: 'dashboard', editingNote: null }, '');
      } else {
        setView('landing');
        // Initial history state for landing
        window.history.replaceState({ view: 'landing', editingNote: null }, '');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Sync state with browser history
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (event.state) {
        const { view: targetView, editingNote: targetNote } = event.state;
        setView(targetView);
        setEditingNote(targetNote);
      } else {
        setView(user ? 'dashboard' : 'landing');
        setEditingNote(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
  
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [user]);

  // Wrapper for setView that also updates history
  const navigateTo = useCallback((newView: typeof view, note: Note | null = null) => {
    // Only push state if it's a different view or note
    if (view === newView && editingNote?.id === note?.id) return;
    
    setView(newView);
    setEditingNote(note);
    window.history.pushState({ view: newView, editingNote: note }, '');
  }, [view, editingNote]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">Initializing Glick X Notes...</p>
        </div>
      </div>
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
            onSuccess={() => navigateTo('dashboard')} 
          />
        )}
        {view === 'signup' && (
          <SignupForm 
            onSwitchToLogin={() => navigateTo('login')} 
            onSuccess={() => navigateTo('dashboard')} 
          />
        )}
        {view === 'forgot-password' && (
          <ForgotPasswordForm 
            onBackToLogin={() => navigateTo('login')} 
          />
        )}
      </AuthLayout>
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
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col md:flex-row">
      <Sidebar user={user} activeView={view} onViewChange={(v) => navigateTo(v)} />
      
      <main className="flex-1 overflow-y-auto pb-24 md:pb-0">
        {view === 'dashboard' && (
          <Dashboard 
            user={user}
            onEditNote={(note) => navigateTo('editor', note)}
            onNewNote={() => navigateTo('editor', null)}
          />
        )}
        {view === 'settings' && <Settings user={user} />}
      </main>

      <BottomNav 
        activeView={view} 
        onViewChange={(v) => navigateTo(v)} 
        onNewNote={() => navigateTo('editor', null)} 
      />
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

