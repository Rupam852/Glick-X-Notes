/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
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
import { Loader2 } from 'lucide-react';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import { Note } from './types';

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'login' | 'signup' | 'forgot-password' | 'dashboard' | 'settings' | 'editor'>('login');
  const [editingNote, setEditingNote] = useState<Note | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (user) {
        setView('dashboard');
      } else {
        setView('login');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

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
            onSwitchToSignup={() => setView('signup')} 
            onForgotPassword={() => setView('forgot-password')}
            onSuccess={() => setView('dashboard')} 
          />
        )}
        {view === 'signup' && (
          <SignupForm 
            onSwitchToLogin={() => setView('login')} 
            onSuccess={() => setView('dashboard')} 
          />
        )}
        {view === 'forgot-password' && (
          <ForgotPasswordForm 
            onBackToLogin={() => setView('login')} 
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
        onBack={() => setView('dashboard')} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col md:flex-row">
      <Sidebar user={user} activeView={view} onViewChange={setView} />
      
      <main className="flex-1 overflow-y-auto pb-24 md:pb-0">
        {view === 'dashboard' && (
          <Dashboard 
            user={user}
            onEditNote={(note) => {
              setEditingNote(note);
              setView('editor');
            }}
            onNewNote={() => {
              setEditingNote(null);
              setView('editor');
            }}
          />
        )}
        {view === 'settings' && <Settings user={user} />}
      </main>

      <BottomNav 
        activeView={view} 
        onViewChange={setView} 
        onNewNote={() => {
          setEditingNote(null);
          setView('editor');
        }} 
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

