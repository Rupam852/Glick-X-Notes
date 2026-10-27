import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Shield, 
  Lock, 
  Sparkles, 
  ArrowRight, 
  Check, 
  ChevronDown, 
  Zap, 
  Cloud, 
  Database, 
  Smartphone, 
  Sun, 
  Moon, 
  FileText, 
  Edit3, 
  Folder, 
  Search, 
  Tag, 
  Eye, 
  Layers, 
  Palette, 
  Terminal, 
  Paperclip,
  CheckCircle2,
  Clock,
  Pin,
  Code2,
  Table,
  FileCode,
  Highlighter
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { sound } from '../utils/sound';

interface LandingPageProps {
  onLogin: () => void;
  onSignup: () => void;
}

export default function LandingPage({ onLogin, onSignup }: LandingPageProps) {
  const { theme, toggleTheme } = useTheme();
  const [faqOpen, setFaqOpen] = useState<number | null>(null);
  const [activeBentoTab, setActiveBentoTab] = useState<'editor' | 'organization' | 'security'>('editor');

  // Guarantee that Landing Page always loads at top (hero section)
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  const faqs = [
    {
      question: "Is my data secure in Glick X Notes?",
      answer: "Absolutely. Glick X Notes enforces robust, granular Firebase security rules, keeping your data entirely isolated. Your credentials and digital files (saved securely as base64 binaries) are inaccessible to anyone else, not even platform administrators."
    },
    {
      question: "Can I use Glick X Notes offline?",
      answer: "Yes! Powered by Firestore's local cache sync capabilities, Glick X Notes supports fully offline read/write. When you lose connection, your notes are safely stored in your local browser storage and seamlessly sync as soon as you are back online."
    },
    {
      question: "Does Glick X Notes support attachments?",
      answer: "Yes, you can attach any file, image, or document directly to your notes. Attachments are encoded as optimized Base64 data chunks within your secure database collection, ensuring high-speed access without needing external cloud storage buckets."
    },
    {
      question: "How do color codes and tags work?",
      answer: "Each note can be assigned custom vibrant colors (Indigo, Pink, Rose, Emerald, and Gold) and dynamic tags. You can filter, search, and sort through your notes instantly, making it perfect for managing different areas of your personal and professional life."
    },
    {
      question: "Can I host this on my own servers?",
      answer: "Yes, Glick X Notes is fully open-source and git-powered. You can clone our GitHub repository, plug in your own Firebase config files, and deploy to Vercel, Netlify, or any other server in minutes."
    }
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#070b14] text-slate-900 dark:text-slate-100 transition-colors duration-300 font-sans overflow-x-hidden selection:bg-indigo-500 selection:text-white relative">
      
      {/* Ambient Cyber Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:28px_28px] pointer-events-none -z-20" />
      
      {/* Ambient Gradient Glow Spheres */}
      <div className="absolute top-0 left-1/3 w-[640px] h-[640px] bg-indigo-500/10 dark:bg-indigo-600/10 rounded-full blur-[160px] pointer-events-none -z-10 animate-pulse duration-[10s]" />
      <div className="absolute top-96 right-1/4 w-[500px] h-[500px] bg-purple-500/10 dark:bg-purple-600/10 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="absolute bottom-1/3 left-10 w-[550px] h-[550px] bg-cyan-500/10 dark:bg-cyan-600/10 rounded-full blur-[160px] pointer-events-none -z-10" />

      {/* Floating Modern Header / Capsule Navbar */}
      <div className="sticky top-4 z-50 px-4 md:px-6 max-w-6xl mx-auto">
        <header className="backdrop-blur-2xl bg-white/80 dark:bg-[#0c1220]/80 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl md:rounded-full px-5 py-3 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)] transition-all">
          <div className="flex items-center justify-between">
            {/* Logo & Brand */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#080d19] dark:bg-slate-950 flex items-center justify-center shadow-md border border-slate-700/60 p-1.5 overflow-hidden shrink-0">
                <img src="/favicon.png?v=3" alt="Glick X Notes" className="w-full h-full object-contain" />
              </div>
              <span className="text-base md:text-lg font-black tracking-tight bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-800 dark:from-white dark:via-indigo-200 dark:to-slate-200 bg-clip-text text-transparent">
                Glick X Notes
              </span>
            </div>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-7 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <a href="#bento" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Workspace</a>
              <a href="#features" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Bento Grid</a>
              <a href="#security" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Zero-Trust</a>
              <a href="#faq" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">FAQs</a>
            </nav>

            {/* Actions: Theme Toggle & Auth Buttons */}
            <div className="flex items-center gap-2.5 shrink-0">
              {/* Theme Toggle Button */}
              <button
                onClick={() => {
                  sound.playPop();
                  toggleTheme();
                }}
                className="p-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-900/60 hover:bg-slate-200/80 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-all cursor-pointer shadow-xs flex items-center justify-center shrink-0"
                title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
                aria-label="Toggle theme"
              >
                {theme === 'light' ? (
                  <Moon className="w-4 h-4 text-slate-700 hover:text-indigo-600 transition-transform duration-200 hover:-rotate-12" />
                ) : (
                  <Sun className="w-4 h-4 text-amber-400 hover:text-amber-300 transition-transform duration-200 hover:rotate-45" />
                )}
              </button>

              <button 
                onClick={onLogin}
                className="text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 px-3 py-2 transition-colors cursor-pointer"
              >
                Sign In
              </button>
              <button 
                onClick={onSignup}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-md shadow-indigo-600/20 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                Get Started
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </header>
      </div>

      {/* Hero Section */}
      <section className="pt-20 pb-20 px-6 max-w-6xl mx-auto text-center relative">
        <div className="space-y-6 max-w-3xl mx-auto">
          
          {/* Subtle Modern Tagline Badge */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/5 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold tracking-wide shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '4s' }} />
            <span>Next-Gen Visual Workspace Pro • Free & Open-Source</span>
          </motion.div>

          {/* Impactful Minimalist Headline */}
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[1.08] text-slate-900 dark:text-white"
          >
            Capture brilliance. <br />
            <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 dark:from-indigo-400 dark:via-purple-300 dark:to-pink-400 bg-clip-text text-transparent">
              Organized with precision.
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-base sm:text-lg text-slate-600 dark:text-slate-400 max-w-xl mx-auto font-normal leading-relaxed"
          >
            A distraction-free, zero-latency thinking canvas. Engineered with rich typography, real-time Firebase reactivity, and client-bound security.
          </motion.p>

          {/* CTAs */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-3"
          >
            <button
              onClick={onSignup}
              className="w-full sm:w-auto px-7 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/25 active:scale-95 transition-all text-sm cursor-pointer flex items-center justify-center gap-2 group"
            >
              Start Free Notes
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <a
              href="#bento"
              className="w-full sm:w-auto px-7 py-3.5 bg-white dark:bg-slate-900/90 text-slate-800 dark:text-slate-200 border border-slate-200/90 dark:border-slate-800 font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-sm cursor-pointer flex items-center justify-center gap-2 shadow-xs"
            >
              Explore Bento Grid
            </a>
          </motion.div>

          {/* Minimal Metric Badges */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="flex flex-wrap items-center justify-center gap-3 pt-6 text-[11px] font-bold text-slate-500 dark:text-slate-400"
          >
            <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-100/80 dark:bg-slate-900/80 border border-slate-200/70 dark:border-slate-800/80 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              12ms Instant Cloud Sync
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-100/80 dark:bg-slate-900/80 border border-slate-200/70 dark:border-slate-800/80 rounded-lg">
              <Lock className="w-3 h-3 text-indigo-500" />
              Zero-Knowledge Firestore Auth
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-100/80 dark:bg-slate-900/80 border border-slate-200/70 dark:border-slate-800/80 rounded-lg">
              <Paperclip className="w-3 h-3 text-purple-500" />
              Base64 In-Database Attachments
            </div>
          </motion.div>
        </div>

        {/* Hero Interactive Workspace Mockup */}
        <motion.div 
          initial={{ opacity: 0, y: 35 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-14 max-w-5xl mx-auto relative"
        >
          {/* Ambient card drop glow */}
          <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 rounded-3xl blur-2xl opacity-60 pointer-events-none" />

          {/* Mockup Frame */}
          <div className="relative rounded-2xl md:rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-[#0c1220]/95 backdrop-blur-xl shadow-2xl overflow-hidden text-left">
            {/* Window title bar */}
            <div className="h-11 px-4 border-b border-slate-200/70 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900/60">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500/80" />
                <span className="w-3 h-3 rounded-full bg-amber-500/80" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
                <span className="ml-3 text-[11px] font-semibold text-slate-400 dark:text-slate-500 hidden sm:inline">
                  workspace / Q4 Project Architecture
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-400">
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Synchronized
                </span>
              </div>
            </div>

            {/* Inner Workspace Canvas */}
            <div className="p-6 md:p-8 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/80 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold">#architecture</span>
                    <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] font-bold">#q4-goals</span>
                    <span className="text-[11px] text-slate-400 font-medium ml-2 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Updated 2m ago
                    </span>
                  </div>
                  <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white">
                    Distributed Real-Time Notes Engine Architecture
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300">
                    Folder: Work
                  </span>
                </div>
              </div>

              {/* Sample Document Body with Markdown formatting & Code */}
              <div className="space-y-4 text-xs md:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
                <p>
                  Glick X Notes is designed around a <strong>zero-friction document model</strong>. Data is synchronized reactively using Firestore snapshot listeners and automatically encrypted per user credential UID.
                </p>

                {/* Simulated Code Block */}
                <div className="rounded-xl bg-slate-950 p-4 border border-slate-800 text-indigo-300 font-mono text-[11px] md:text-xs overflow-x-auto shadow-inner">
                  <span className="text-slate-500">// Real-time Firestore document subscriber</span><br />
                  <span className="text-pink-400">const</span> q = <span className="text-sky-300">query</span>(collection(db, <span className="text-emerald-300">'notes'</span>), <span className="text-sky-300">where</span>(<span className="text-emerald-300">'userId'</span>, <span className="text-emerald-300">'=='</span>, user.uid));<br />
                  <span className="text-indigo-400">onSnapshot</span>(q, (snapshot) =&gt; syncNotesBuffer(snapshot.docs));
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <span className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    384 words
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    2 attachments (PDF, Diagram)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* MODERN BENTO GRID FEATURE SHOWCASE */}
      <section id="bento" className="py-24 px-6 max-w-6xl mx-auto relative border-t border-slate-200/60 dark:border-slate-800/80">
        <div className="space-y-16">
          {/* Section Heading */}
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-[11px] uppercase font-black tracking-widest text-indigo-600 dark:text-indigo-400">
              Modern Bento Architecture
            </span>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white">
              Built for speed, clarity, and deep focus.
            </h2>
            <p className="text-sm md:text-base text-slate-500 dark:text-slate-400">
              Every detail is engineered to make capturing ideas effortless, elegant, and uncompromisingly secure.
            </p>
          </div>

          {/* THE BENTO GRID */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            
            {/* Bento Cell 1: Rich Text Canvas (Spans 2 columns) */}
            <div className="md:col-span-2 group relative rounded-3xl p-7 md:p-8 bg-white/90 dark:bg-[#0c1220]/90 border border-slate-200/80 dark:border-slate-800/80 hover:border-indigo-500/50 dark:hover:border-indigo-400/50 shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:shadow-[0_12px_36px_rgba(99,102,241,0.08)] transition-all duration-300 overflow-hidden flex flex-col justify-between">
              <div className="space-y-3 relative z-10">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                  <Edit3 className="w-5 h-5" />
                </div>
                <h3 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">
                  Distraction-Free Rich Text Canvas
                </h3>
                <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 max-w-md leading-relaxed">
                  Compose thoughts in a paper-feel document editor with full typography controls: customizable font sizes, code blocks, tables, highlights, and instant undo/redo stacks.
                </p>
              </div>

              {/* Interactive Visual Element: Editor Toolbar Pill */}
              <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800/80">
                <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-100/70 dark:bg-slate-900/80 rounded-2xl border border-slate-200/60 dark:border-slate-800 max-w-md">
                  <span className="p-1.5 rounded-lg bg-white dark:bg-slate-800 text-xs font-bold shadow-xs">Bold</span>
                  <span className="p-1.5 rounded-lg text-slate-500 text-xs font-semibold">Italic</span>
                  <span className="p-1.5 rounded-lg text-slate-500 text-xs font-semibold flex items-center gap-1"><Highlighter className="w-3.5 h-3.5 text-amber-500" /> Highlight</span>
                  <span className="p-1.5 rounded-lg text-slate-500 text-xs font-semibold flex items-center gap-1"><Table className="w-3.5 h-3.5 text-indigo-500" /> Table</span>
                  <span className="p-1.5 rounded-lg text-slate-500 text-xs font-semibold flex items-center gap-1"><Code2 className="w-3.5 h-3.5 text-pink-500" /> Code</span>
                </div>
              </div>
            </div>

            {/* Bento Cell 2: Smart Folder Organization (1 column) */}
            <div className="group relative rounded-3xl p-7 md:p-8 bg-white/90 dark:bg-[#0c1220]/90 border border-slate-200/80 dark:border-slate-800/80 hover:border-purple-500/50 dark:hover:border-purple-400/50 shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:shadow-[0_12px_36px_rgba(168,85,247,0.08)] transition-all duration-300 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
                  <Folder className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  Intelligent Filing & Folders
                </h3>
                <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  Glassmorphic folder selectors with live count badges. Instantly group notes by Work, Personal, Ideas, or Archive with single-click filtering.
                </p>
              </div>

              {/* Folder Pills Mockup */}
              <div className="mt-6 space-y-2">
                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-100/70 dark:bg-slate-900/60 text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500" /> Work Project</span>
                  <span className="text-[10px] bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md">8 notes</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-100/70 dark:bg-slate-900/60 text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-500" /> Ideas & Plans</span>
                  <span className="text-[10px] bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md">5 notes</span>
                </div>
              </div>
            </div>

            {/* Bento Cell 3: Military-Grade Zero-Trust Isolation (1 column) */}
            <div className="group relative rounded-3xl p-7 md:p-8 bg-white/90 dark:bg-[#0c1220]/90 border border-slate-200/80 dark:border-slate-800/80 hover:border-emerald-500/50 dark:hover:border-emerald-400/50 shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:shadow-[0_12px_36px_rgba(16,185,129,0.08)] transition-all duration-300 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                  <Shield className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  Zero-Trust User Bound
                </h3>
                <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  Cryptographically verified Firebase rules prevent database leaks. No administrator or automated crawler can access your records.
                </p>
              </div>

              {/* Security Shield Indicator */}
              <div className="mt-6 p-3 rounded-2xl bg-emerald-500/5 dark:bg-emerald-950/20 border border-emerald-500/20 flex items-center gap-3">
                <Lock className="w-5 h-5 text-emerald-500 shrink-0" />
                <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  <span>UID-Bound Row Security</span>
                  <p className="text-[9px] text-slate-400 font-mono">auth.uid == resource.data.userId</p>
                </div>
              </div>
            </div>

            {/* Bento Cell 4: Sub-Millisecond Search & Tags (Spans 2 columns) */}
            <div className="md:col-span-2 group relative rounded-3xl p-7 md:p-8 bg-white/90 dark:bg-[#0c1220]/90 border border-slate-200/80 dark:border-slate-800/80 hover:border-blue-500/50 dark:hover:border-blue-400/50 shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:shadow-[0_12px_36px_rgba(59,130,246,0.08)] transition-all duration-300 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                  <Search className="w-5 h-5" />
                </div>
                <h3 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">
                  Sub-Millisecond Search & Highlight
                </h3>
                <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 max-w-lg leading-relaxed">
                  Search across note titles, full body content, and metadata instantaneously with live in-card keyword highlighting. Filter down with categorized tags in real time.
                </p>
              </div>

              {/* Search Bar Interactive Mockup */}
              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80 space-y-2.5">
                <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-750 text-xs font-semibold text-slate-400">
                  <Search className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-850 dark:text-slate-100">database migration</span>
                  <span className="ml-auto text-[10px] font-mono bg-indigo-500/10 text-indigo-500 px-2 py-0.5 rounded">3 matches found</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2.5 py-0.5 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400 text-[10px] font-bold">#project</span>
                  <span className="px-2.5 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-bold">#urgent</span>
                  <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">#meeting</span>
                </div>
              </div>
            </div>

            {/* Bento Cell 5: Auto-Title & Duplicate Prevention (1 column) */}
            <div className="group relative rounded-3xl p-7 bg-white/90 dark:bg-[#0c1220]/90 border border-slate-200/80 dark:border-slate-800/80 hover:border-amber-500/50 dark:hover:border-amber-400/50 shadow-[0_4px_20px_rgba(0,0,0,0.02)] transition-all flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h4 className="text-lg font-bold text-slate-900 dark:text-white">Smart Auto-Title</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Extracts clean titles from your first line automatically, and resolves duplicate titles seamlessly (`Title (2)`).
                </p>
              </div>
              <div className="mt-4 p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/20 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                ✓ Never see "Untitled Note" again
              </div>
            </div>

            {/* Bento Cell 6: Base64 Multi-Media Attachments (1 column) */}
            <div className="group relative rounded-3xl p-7 bg-white/90 dark:bg-[#0c1220]/90 border border-slate-200/80 dark:border-slate-800/80 hover:border-pink-500/50 dark:hover:border-pink-400/50 shadow-[0_4px_20px_rgba(0,0,0,0.02)] transition-all flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-pink-500/10 text-pink-600 dark:text-pink-400 flex items-center justify-center font-bold">
                  <Paperclip className="w-5 h-5" />
                </div>
                <h4 className="text-lg font-bold text-slate-900 dark:text-white">In-Database Files</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Attach images, documents, and assets without configuring public buckets. Direct Base64 encoding.
                </p>
              </div>
              <div className="mt-4 p-2.5 rounded-xl bg-pink-500/5 border border-pink-500/20 text-[11px] font-bold text-pink-600 dark:text-pink-400">
                ✓ Drag, drop & instant preview
              </div>
            </div>

            {/* Bento Cell 7: Day & Night Ergonomics (1 column) */}
            <div className="group relative rounded-3xl p-7 bg-white/90 dark:bg-[#0c1220]/90 border border-slate-200/80 dark:border-slate-800/80 hover:border-cyan-500/50 dark:hover:border-cyan-400/50 shadow-[0_4px_20px_rgba(0,0,0,0.02)] transition-all flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center font-bold">
                  <Palette className="w-5 h-5" />
                </div>
                <h4 className="text-lg font-bold text-slate-900 dark:text-white">OLED Eye-Care</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Crafted for late-night inspiration and bright daylight focus with zero color distortion.
                </p>
              </div>
              <div className="mt-4 p-2.5 rounded-xl bg-cyan-500/5 border border-cyan-500/20 text-[11px] font-bold text-cyan-600 dark:text-cyan-400">
                ✓ High-contrast Obsidian Dark
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Security Architecture & Rules Deep Dive */}
      <section id="security" className="py-24 px-6 max-w-6xl mx-auto border-t border-slate-200/60 dark:border-slate-800/80">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <span className="text-[11px] uppercase font-black tracking-widest text-emerald-600 dark:text-emerald-400">
              Security Architecture
            </span>
            <h3 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
              Your private thoughts remain strictly yours.
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Unlike legacy note platforms that store unencrypted plain text in central tables, Glick X Notes executes atomic document validations on every single read and write.
            </p>

            <div className="space-y-3 pt-2">
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-white dark:bg-[#0c1220] border border-slate-200/70 dark:border-slate-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                <div className="text-xs text-slate-600 dark:text-slate-300">
                  <strong className="text-slate-900 dark:text-white block">Cryptographic User Identification</strong>
                  Requests lacking matching authentication credentials fail immediately at the edge.
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-white dark:bg-[#0c1220] border border-slate-200/70 dark:border-slate-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                <div className="text-xs text-slate-600 dark:text-slate-300">
                  <strong className="text-slate-900 dark:text-white block">Zero Admin Overrides</strong>
                  Database schemas physically prevent administrative reads on foreign user IDs.
                </div>
              </div>
            </div>
          </div>

          {/* Clean Terminal Window */}
          <div className="rounded-2xl border border-slate-800 bg-[#090d16] p-5 shadow-2xl font-mono text-xs text-slate-300">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              <span>firestore.rules (Edge Security)</span>
              <span className="text-emerald-400 flex items-center gap-1">
                <Lock className="w-3 h-3" /> Enforced
              </span>
            </div>
            <pre className="text-[11px] leading-relaxed text-slate-400 overflow-x-auto">
{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /notes/{noteId} {
      // 🔒 User Isolation Gate
      allow read, update, delete: if request.auth != null 
        && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null 
        && request.auth.uid == request.resource.data.userId;
      
      // 📎 Sandboxed Attachments
      match /attachments/{attachmentId} {
        allow read, write: if request.auth != null 
          && get(/databases/$(database)/documents/notes/$(noteId)).data.userId == request.auth.uid;
      }
    }
  }
}`}
            </pre>
          </div>
        </div>
      </section>

      {/* Accordion FAQ Section */}
      <section id="faq" className="py-24 px-6 max-w-4xl mx-auto border-t border-slate-200/60 dark:border-slate-800/80">
        <div className="space-y-12">
          <div className="text-center space-y-3">
            <span className="text-[11px] uppercase font-black tracking-widest text-indigo-600 dark:text-indigo-400">
              Clear Answers
            </span>
            <h3 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
              Frequently Asked Questions
            </h3>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, index) => (
              <div 
                key={index}
                className="bg-white/80 dark:bg-[#0c1220]/80 border border-slate-200/70 dark:border-slate-800/80 rounded-2xl overflow-hidden transition-all shadow-xs"
              >
                <button
                  onClick={() => setFaqOpen(faqOpen === index ? null : index)}
                  className="w-full px-6 py-4.5 flex items-center justify-between text-left font-bold text-sm md:text-base text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                >
                  <span>{faq.question}</span>
                  <ChevronDown 
                    className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${faqOpen === index ? 'rotate-180 text-indigo-600 dark:text-indigo-400' : ''}`} 
                  />
                </button>
                <AnimatePresence>
                  {faqOpen === index && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-5 pt-1 text-xs md:text-sm text-slate-500 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-800/60">
                        {faq.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Radiant Call-To-Action Banner */}
      <section className="py-20 px-6 max-w-6xl mx-auto">
        <div className="relative rounded-3xl overflow-hidden p-8 md:p-14 text-center bg-gradient-to-tr from-indigo-950 via-slate-950 to-[#070b14] border border-indigo-500/20 shadow-2xl">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-indigo-500/20 via-transparent to-transparent pointer-events-none" />
          
          <div className="relative z-10 max-w-2xl mx-auto space-y-6">
            <h3 className="text-3xl md:text-5xl font-black tracking-tight text-white">
              Ready to elevate how you think and write?
            </h3>
            <p className="text-sm md:text-base text-indigo-200/80 leading-relaxed font-normal">
              Experience the clarity of a modern visual workspace. Free forever, no credit card required.
            </p>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={onSignup}
                className="w-full sm:w-auto px-8 py-4 bg-white hover:bg-slate-100 text-slate-900 font-black rounded-xl shadow-xl active:scale-95 transition-all text-sm cursor-pointer"
              >
                Create Free Account
              </button>
              <button
                onClick={onLogin}
                className="w-full sm:w-auto px-8 py-4 bg-indigo-900/40 hover:bg-indigo-900/60 text-white border border-indigo-500/30 font-bold rounded-xl transition-all text-sm cursor-pointer"
              >
                Sign In to Workspace
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Clean Modern Footer */}
      <footer className="border-t border-slate-200/70 dark:border-slate-900/80 bg-white/60 dark:bg-[#070b14]/60 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 py-12 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#080d19] dark:bg-slate-950 flex items-center justify-center shadow-sm border border-slate-700/60 p-1 overflow-hidden shrink-0">
              <img src="/favicon.png?v=3" alt="Glick X Notes" className="w-full h-full object-contain" />
            </div>
            <span className="text-sm font-black tracking-tight text-slate-800 dark:text-slate-200">
              Glick X Notes
            </span>
            <span className="text-xs text-slate-400">© 2026. Free & Open Source.</span>
          </div>

          <div className="flex items-center gap-6 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>React 19</span>
            <span>TypeScript</span>
            <span>Firebase 12</span>
            <span>Tailwind CSS</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
