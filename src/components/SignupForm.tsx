import React, { useState } from 'react';
import { auth, db, googleProvider } from '../firebase';
import { createUserWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { Mail, Lock, User, ArrowRight, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { motion } from 'motion/react';

const GoogleIcon = () => (
  <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

interface SignupFormProps {
  onSwitchToLogin: () => void;
  onSuccess: () => void;
}

export default function SignupForm({ onSwitchToLogin, onSuccess }: SignupFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string; displayName?: string }>({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const errors: { email?: string; password?: string; displayName?: string } = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!displayName.trim()) {
      errors.displayName = 'Full Name is required';
    }

    if (!email) {
      errors.email = 'Email is required';
    } else if (!emailRegex.test(email)) {
      errors.email = 'Invalid email format';
    }

    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setError(null);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Create user document in Firestore
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        displayName: displayName,
        photoURL: user.photoURL || '',
        createdAt: serverTimestamp()
      });

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // Check if user exists in Firestore
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) {
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || '',
          photoURL: user.photoURL || '',
          createdAt: serverTimestamp()
        });
      } else {
        // Update photoURL if it's from Google
        await setDoc(doc(db, 'users', user.uid), {
          photoURL: user.photoURL || userDoc.data().photoURL || ''
        }, { merge: true });
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Google login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSignup} className="space-y-5">
        <div className="space-y-2">
          <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Full Name</label>
          <div className="relative">
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input
              type="text"
              required
              autoComplete="name"
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                if (fieldErrors.displayName) setFieldErrors(prev => ({ ...prev, displayName: undefined }));
              }}
              className={`w-full pl-11 pr-4 py-3.5 bg-slate-950/80 text-slate-100 border rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 outline-none font-medium ${
                fieldErrors.displayName ? 'border-red-500/80 focus:ring-red-500/10' : 'border-slate-800/80'
              }`}
            />
          </div>
          {fieldErrors.displayName && (
            <p className="text-xs text-red-400 font-semibold">{fieldErrors.displayName}</p>
          )}
        </div>

        <div className="space-y-2">
          <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Email Address</label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: undefined }));
              }}
              className={`w-full pl-11 pr-4 py-3.5 bg-slate-950/80 text-slate-100 border rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 outline-none font-medium ${
                fieldErrors.email ? 'border-red-500/80 focus:ring-red-500/10' : 'border-slate-800/80'
              }`}
            />
          </div>
          {fieldErrors.email && (
            <p className="text-xs text-red-400 font-semibold">{fieldErrors.email}</p>
          )}
        </div>

        <div className="space-y-2">
          <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Password</label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input
              type={showPassword ? 'text' : 'password'}
              required
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) setFieldErrors(prev => ({ ...prev, password: undefined }));
              }}
              className={`w-full pl-11 pr-12 py-3.5 bg-slate-950/80 text-slate-100 border rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 outline-none font-medium ${
                fieldErrors.password ? 'border-red-500/80 focus:ring-red-500/10' : 'border-slate-800/80'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {fieldErrors.password && (
            <p className="text-xs text-red-400 font-semibold">{fieldErrors.password}</p>
          )}
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="flex items-center gap-2.5 text-red-400 text-sm bg-red-950/20 border border-red-900/40 p-3.5 rounded-xl"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <p>{error}</p>
          </motion.div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-indigo-500 via-violet-600 to-pink-600 hover:from-indigo-400 hover:via-violet-500 hover:to-pink-500 text-white font-black py-3.5 rounded-xl hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
        >
          {loading ? 'Creating account...' : 'Create Account'}
          <ArrowRight className="w-4.5 h-4.5" />
        </button>
      </form>

      <div className="relative flex items-center justify-center py-2">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-800/60"></div>
        </div>
        <span className="relative px-4 py-1.5 bg-slate-900 border border-slate-800 rounded-full text-slate-500 uppercase tracking-widest text-[9px] font-black z-10">Or continue with</span>
      </div>

      <button
        onClick={handleGoogleLogin}
        disabled={loading}
        className="w-full bg-slate-950 hover:bg-slate-900/80 text-slate-200 border border-slate-800 hover:border-slate-700 font-bold py-3.5 rounded-xl hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 flex items-center justify-center gap-3 disabled:opacity-70 cursor-pointer"
      >
        <GoogleIcon />
        Sign up with Google
      </button>

      <p className="text-center text-sm text-slate-400">
        Already have an account?{' '}
        <button 
          onClick={onSwitchToLogin}
          className="text-indigo-400 font-extrabold hover:text-indigo-300 transition-colors cursor-pointer"
        >
          Sign in
        </button>
      </p>
    </div>
  );
}
