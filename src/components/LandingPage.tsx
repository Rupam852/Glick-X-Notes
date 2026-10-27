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
  Smartphone, 
  Sun, 
  Moon, 
  FileText, 
  Edit3, 
  Folder, 
  Search, 
  Tag, 
  Palette, 
  Paperclip,
  CheckCircle2,
  Clock,
  Highlighter,
  Heart,
  Smile,
  ListTodo,
  Quote,
  Lightbulb,
  Linkedin,
  Instagram,
  Github,
  Mail,
  X
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
  const [activeModal, setActiveModal] = useState<'privacy' | 'terms' | null>(null);

  // Guarantee that Landing Page always loads at top (hero section)
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  const faqs = [
    {
      question: "Is my personal data completely private?",
      answer: "Yes, 100%. Glick X Notes uses zero-knowledge account security. Your notes, images, and files belong strictly to your personal account and cannot be seen, tracked, or scanned by anyone else."
    },
    {
      question: "Can I use Glick X Notes when I am offline?",
      answer: "Yes! You can read, write, edit, and organize all your notes even without an internet connection. Everything saves securely in your browser and automatically syncs to the cloud the moment you reconnect."
    },
    {
      question: "Can I add photos and documents to my notes?",
      answer: "Yes! You can attach photos, images, PDFs, and documents directly to any note with instant drag-and-drop and one-click previews."
    },
    {
      question: "How do colors and tags help organize?",
      answer: "Every note can have vibrant custom colors (Indigo, Rose, Emerald, Amber, etc.) and tags like #work, #ideas, or #urgent. You can filter and find any note in seconds."
    },
    {
      question: "Is Glick X Notes free to use?",
      answer: "Yes, Glick X Notes is 100% free forever with no hidden subscriptions, no paywalls, and absolutely zero advertisements."
    }
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#070b14] text-slate-900 dark:text-slate-100 transition-colors duration-300 font-sans overflow-x-hidden selection:bg-indigo-500 selection:text-white relative">
      
      {/* 📐 DESIGNER GRAPH PAPER BOX LAYOUT (Visible Notebook Grid Lines) */}
      <div 
        className="absolute inset-0 pointer-events-none -z-20 bg-[linear-gradient(to_right,rgba(99,102,241,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(99,102,241,0.08)_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.07)_1px,transparent_1px)] bg-[size:32px_32px]" 
      />
      
      {/* 📐 Major Graph Grid Accent Lines (Every 4 Boxes) */}
      <div 
        className="absolute inset-0 pointer-events-none -z-20 bg-[linear-gradient(to_right,rgba(99,102,241,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(99,102,241,0.12)_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,rgba(99,102,241,0.14)_1px,transparent_1px),linear-gradient(to_bottom,rgba(99,102,241,0.14)_1px,transparent_1px)] bg-[size:128px_128px]" 
      />

      {/* Ambient Gradient Glow Spheres */}
      <div className="absolute top-0 left-1/3 w-[600px] h-[600px] bg-indigo-500/10 dark:bg-indigo-600/10 rounded-full blur-[160px] pointer-events-none -z-10 animate-pulse duration-[10s]" />
      <div className="absolute top-96 right-1/4 w-[450px] h-[450px] bg-purple-500/10 dark:bg-purple-600/10 rounded-full blur-[140px] pointer-events-none -z-10" />

      {/* Floating Modern Header / Capsule Navbar */}
      <div className="sticky top-4 z-50 px-4 md:px-6 max-w-6xl mx-auto">
        <header className="backdrop-blur-2xl bg-white/85 dark:bg-[#0c1220]/85 border border-slate-200/90 dark:border-slate-800/90 rounded-2xl md:rounded-full px-5 py-3 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)] transition-all">
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
              <a href="#workspace" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Workspace</a>
              <a href="#features" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Features</a>
              <a href="#privacy" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Privacy</a>
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
      <section className="pt-20 pb-16 px-6 max-w-6xl mx-auto text-center relative">
        <div className="space-y-6 max-w-3xl mx-auto">
          
          {/* Tagline Badge */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-indigo-500/25 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold tracking-wide shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '4s' }} />
            <span>Clean, Simple & 100% Free Personal Notes</span>
          </motion.div>

          {/* Impactful Headline */}
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

          {/* Clean Subtitle */}
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-base sm:text-lg text-slate-600 dark:text-slate-400 max-w-xl mx-auto font-normal leading-relaxed"
          >
            A beautifully minimal space to write, plan, and organize ideas. Lightning fast, completely private, and effortlessly synchronized across all your devices.
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
              Start Writing Free
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <a
              href="#workspace"
              className="w-full sm:w-auto px-7 py-3.5 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200/90 dark:border-slate-800 font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-sm cursor-pointer flex items-center justify-center gap-2 shadow-xs"
            >
              Explore Features
            </a>
          </motion.div>

          {/* Human-Centered Badges */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="flex flex-wrap items-center justify-center gap-3 pt-6 text-[11px] font-bold text-slate-500 dark:text-slate-400"
          >
            <div className="flex items-center gap-1.5 px-3 py-1 bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 rounded-lg shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Instant Sync Across Devices
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 rounded-lg shadow-xs">
              <Lock className="w-3 h-3 text-indigo-500" />
              100% Private & Protected
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 rounded-lg shadow-xs">
              <Paperclip className="w-3 h-3 text-purple-500" />
              Photos & Document Attachments
            </div>
          </motion.div>
        </div>

        {/* HERO WORKSPACE PREVIEW CARD (Inspiring, Human-Made, No Code Blocks!) */}
        <motion.div 
          id="workspace"
          initial={{ opacity: 0, y: 35 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-14 max-w-4xl mx-auto relative"
        >
          {/* Ambient card drop glow */}
          <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 rounded-3xl blur-2xl opacity-60 pointer-events-none" />

          {/* Window Frame */}
          <div className="relative rounded-2xl md:rounded-3xl border border-slate-200/90 dark:border-slate-800/90 bg-white/95 dark:bg-[#0c1220]/95 backdrop-blur-xl shadow-2xl overflow-hidden text-left">
            {/* Window title bar */}
            <div className="h-11 px-4 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/60">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500/80" />
                <span className="w-3 h-3 rounded-full bg-amber-500/80" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
                <span className="ml-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 hidden sm:inline">
                  workspace / Creative Strategy & Goals
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-400">
                <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 dark:bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Synchronized
                </span>
              </div>
            </div>

            {/* Note Content Area */}
            <div className="p-6 md:p-8 space-y-6">
              {/* Header inside note */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/80 pb-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold">#ideas</span>
                    <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] font-bold">#strategy</span>
                    <span className="px-2 py-0.5 rounded-md bg-pink-500/10 text-pink-600 dark:text-pink-400 text-[10px] font-bold">#launch</span>
                    <span className="text-[11px] text-slate-400 font-medium ml-2 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Updated 2m ago
                    </span>
                  </div>
                  <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white">
                    ✨ Product Launch Roadmap & Creative Strategy
                  </h2>
                </div>
                <div>
                  <span className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900">
                    Folder: Ideas
                  </span>
                </div>
              </div>

              {/* Note Body Text */}
              <div className="space-y-5 text-xs md:text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-normal">
                <p>
                  Every breakthrough begins with a clean slate. Glick X Notes lets you brainstorm ideas freely, organize your personal goals, and keep everyday tasks beautifully structured.
                </p>

                {/* Relatable Action Checklist (Replaced technical code snippet!) */}
                <div className="space-y-2.5 bg-slate-50/80 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/70 dark:border-slate-800/80">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Key Milestones
                  </span>
                  <div className="flex items-center gap-2.5 text-xs text-slate-800 dark:text-slate-200 font-medium">
                    <span className="w-4 h-4 rounded-md bg-indigo-600 text-white flex items-center justify-center text-[10px]"><Check className="w-3 h-3 stroke-[3]" /></span>
                    <span className="line-through text-slate-400">Finalize brand identity and origami logo design</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-xs text-slate-800 dark:text-slate-200 font-medium">
                    <span className="w-4 h-4 rounded-md bg-indigo-600 text-white flex items-center justify-center text-[10px]"><Check className="w-3 h-3 stroke-[3]" /></span>
                    <span className="line-through text-slate-400">Set up notebook folders and priority tags</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-xs text-slate-800 dark:text-slate-200 font-medium">
                    <span className="w-4 h-4 rounded-md border-2 border-indigo-500 bg-white dark:bg-slate-800 shrink-0" />
                    <span>Share launch roadmap and moodboard with team</span>
                  </div>
                </div>

                {/* Inspirational Quote Highlight */}
                <div className="p-3.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/20 border-l-4 border-indigo-500 text-xs italic text-indigo-950 dark:text-indigo-200 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 not-italic" />
                  <span>"Simplicity is about subtracting the obvious and adding the meaningful."</span>
                </div>

                {/* Bottom Note Info Footer */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 font-medium">
                      340 words
                    </span>
                    <span className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 font-medium flex items-center gap-1">
                      <Paperclip className="w-3 h-3 text-indigo-500" /> 2 attachments (Moodboard.png, Plan.pdf)
                    </span>
                  </div>
                  <span className="text-slate-400">Auto-saved to cloud</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* MODERN BENTO GRID (Clean, Asymmetric, Visual) */}
      <section id="features" className="py-24 px-6 max-w-6xl mx-auto relative border-t border-slate-200/70 dark:border-slate-800/80">
        <div className="space-y-16">
          {/* Section Heading */}
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-[11px] uppercase font-black tracking-widest text-indigo-600 dark:text-indigo-400">
              Modern Bento Grid
            </span>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white">
              Everything in its right place.
            </h2>
            <p className="text-sm md:text-base text-slate-600 dark:text-slate-400">
              A workspace thoughtfully designed around clarity, speed, and peace of mind.
            </p>
          </div>

          {/* THE BENTO GRID */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            
            {/* Bento Cell 1: Rich Text Canvas (Spans 2 columns) */}
            <div className="md:col-span-2 group relative rounded-3xl p-7 md:p-8 bg-white/90 dark:bg-[#0c1220]/90 border border-slate-200/90 dark:border-slate-800/90 hover:border-indigo-500/50 dark:hover:border-indigo-400/50 shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:shadow-[0_12px_36px_rgba(99,102,241,0.08)] transition-all duration-300 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                  <Edit3 className="w-5 h-5" />
                </div>
                <h3 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">
                  Distraction-Free Rich Writing Canvas
                </h3>
                <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 max-w-md leading-relaxed">
                  Compose effortlessly with paper-feel document styling, bold formatting, text highlighting, checklists, and flexible font sizes that feel natural.
                </p>
              </div>

              {/* Formatting Toolbar Pill */}
              <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800/80">
                <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-100/70 dark:bg-slate-900/80 rounded-2xl border border-slate-200/60 dark:border-slate-800 max-w-md">
                  <span className="p-1.5 rounded-lg bg-white dark:bg-slate-800 text-xs font-bold shadow-xs">Bold</span>
                  <span className="p-1.5 rounded-lg text-slate-500 text-xs font-semibold">Italic</span>
                  <span className="p-1.5 rounded-lg text-slate-500 text-xs font-semibold flex items-center gap-1"><Highlighter className="w-3.5 h-3.5 text-amber-500" /> Highlight</span>
                  <span className="p-1.5 rounded-lg text-slate-500 text-xs font-semibold flex items-center gap-1"><ListTodo className="w-3.5 h-3.5 text-indigo-500" /> Tasks</span>
                  <span className="p-1.5 rounded-lg text-slate-500 text-xs font-semibold flex items-center gap-1"><Palette className="w-3.5 h-3.5 text-pink-500" /> Color</span>
                </div>
              </div>
            </div>

            {/* Bento Cell 2: Intelligent Filing & Folders (1 column) */}
            <div className="group relative rounded-3xl p-7 md:p-8 bg-white/90 dark:bg-[#0c1220]/90 border border-slate-200/90 dark:border-slate-800/90 hover:border-purple-500/50 dark:hover:border-purple-400/50 shadow-[0_4px_20px_rgba(0,0,0,0.02)] transition-all flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
                  <Folder className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  Smart Folders & Filing
                </h3>
                <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Organize your life into clean categories like Work, Personal, Ideas, or Archive with real-time count badges.
                </p>
              </div>

              {/* Folder Pills Mockup */}
              <div className="mt-6 space-y-2">
                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-100/70 dark:bg-slate-900/60 text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500" /> Work Projects</span>
                  <span className="text-[10px] bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md">8 notes</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-100/70 dark:bg-slate-900/60 text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-500" /> Ideas & Plans</span>
                  <span className="text-[10px] bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md">5 notes</span>
                </div>
              </div>
            </div>

            {/* Bento Cell 3: 100% Private (1 column) */}
            <div className="group relative rounded-3xl p-7 md:p-8 bg-white/90 dark:bg-[#0c1220]/90 border border-slate-200/90 dark:border-slate-800/90 hover:border-emerald-500/50 dark:hover:border-emerald-400/50 shadow-[0_4px_20px_rgba(0,0,0,0.02)] transition-all flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                  <Shield className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  100% Personal & Private
                </h3>
                <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Your notes are locked to your personal account. Zero ads, zero tracking, and absolutely no selling of your data.
                </p>
              </div>

              {/* Clean privacy pill */}
              <div className="mt-6 p-3 rounded-2xl bg-emerald-500/5 dark:bg-emerald-950/20 border border-emerald-500/20 flex items-center gap-3">
                <Lock className="w-5 h-5 text-emerald-500 shrink-0" />
                <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  <span>Zero-Trust Privacy</span>
                  <p className="text-[10px] text-slate-400 font-normal">Only you have the key</p>
                </div>
              </div>
            </div>

            {/* Bento Cell 4: Sub-Millisecond Search & Tags (Spans 2 columns) */}
            <div className="md:col-span-2 group relative rounded-3xl p-7 md:p-8 bg-white/90 dark:bg-[#0c1220]/90 border border-slate-200/90 dark:border-slate-800/90 hover:border-blue-500/50 dark:hover:border-blue-400/50 shadow-[0_4px_20px_rgba(0,0,0,0.02)] transition-all flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                  <Search className="w-5 h-5" />
                </div>
                <h3 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">
                  Instant Search & Live Highlights
                </h3>
                <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 max-w-lg leading-relaxed">
                  Find any thought or note in milliseconds with live keyword highlighting and categorized tags.
                </p>
              </div>

              {/* Search Bar Interactive Mockup */}
              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80 space-y-2.5">
                <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-750 text-xs font-semibold text-slate-400">
                  <Search className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-850 dark:text-slate-100">travel packing list</span>
                  <span className="ml-auto text-[10px] bg-indigo-500/10 text-indigo-500 px-2 py-0.5 rounded font-bold">Found instantly</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2.5 py-0.5 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400 text-[10px] font-bold">#travel</span>
                  <span className="px-2.5 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-bold">#urgent</span>
                  <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">#ideas</span>
                </div>
              </div>
            </div>

            {/* Bento Cell 5: Smart Auto-Title (1 column) */}
            <div className="group relative rounded-3xl p-7 bg-white/90 dark:bg-[#0c1220]/90 border border-slate-200/90 dark:border-slate-800/90 hover:border-amber-500/50 dark:hover:border-amber-400/50 shadow-[0_4px_20px_rgba(0,0,0,0.02)] transition-all flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h4 className="text-lg font-bold text-slate-900 dark:text-white">Smart Auto-Title</h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Your first sentence automatically becomes your title. Duplicates like `Meeting (2)` resolve on their own.
                </p>
              </div>
              <div className="mt-4 p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/20 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                ✓ No more blank untitled notes
              </div>
            </div>

            {/* Bento Cell 6: Photos & Document Attachments (1 column) */}
            <div className="group relative rounded-3xl p-7 bg-white/90 dark:bg-[#0c1220]/90 border border-slate-200/90 dark:border-slate-800/90 hover:border-pink-500/50 dark:hover:border-pink-400/50 shadow-[0_4px_20px_rgba(0,0,0,0.02)] transition-all flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-pink-500/10 text-pink-600 dark:text-pink-400 flex items-center justify-center font-bold">
                  <Paperclip className="w-5 h-5" />
                </div>
                <h4 className="text-lg font-bold text-slate-900 dark:text-white">Photos & Files</h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Attach images, receipts, and PDFs directly into your notes. Fast preview and easy download anytime.
                </p>
              </div>
              <div className="mt-4 p-2.5 rounded-xl bg-pink-500/5 border border-pink-500/20 text-[11px] font-bold text-pink-600 dark:text-pink-400">
                ✓ Drag, drop & instant preview
              </div>
            </div>

            {/* Bento Cell 7: Day & Night Ergonomics (1 column) */}
            <div className="group relative rounded-3xl p-7 bg-white/90 dark:bg-[#0c1220]/90 border border-slate-200/90 dark:border-slate-800/90 hover:border-cyan-500/50 dark:hover:border-cyan-400/50 shadow-[0_4px_20px_rgba(0,0,0,0.02)] transition-all flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center font-bold">
                  <Palette className="w-5 h-5" />
                </div>
                <h4 className="text-lg font-bold text-slate-900 dark:text-white">Eye-Care Themes</h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Deep Obsidian Dark mode for late-night focus, and crisp paper Light mode for daylight productivity.
                </p>
              </div>
              <div className="mt-4 p-2.5 rounded-xl bg-cyan-500/5 border border-cyan-500/20 text-[11px] font-bold text-cyan-600 dark:text-cyan-400">
                ✓ Smooth, comfortable contrast
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* PRIVACY & SECURITY SECTION (Human & Visual, NO RAW CODE TERMINAL) */}
      <section id="privacy" className="py-24 px-6 max-w-6xl mx-auto border-t border-slate-200/70 dark:border-slate-800/80">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <span className="text-[11px] uppercase font-black tracking-widest text-emerald-600 dark:text-emerald-400">
              Privacy First
            </span>
            <h3 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
              Your private thoughts remain strictly yours.
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              We built Glick X Notes for ourselves first. That means no corporate tracking, no advertisements, and no sharing your personal notes with third parties.
            </p>

            <div className="space-y-3 pt-2">
              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-white dark:bg-[#0c1220] border border-slate-200/80 dark:border-slate-800 shadow-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                <div className="text-xs text-slate-600 dark:text-slate-300">
                  <strong className="text-slate-900 dark:text-white block font-bold mb-0.5">Isolated Personal Account</strong>
                  Only your authenticated login can access your dashboard and notebooks.
                </div>
              </div>
              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-white dark:bg-[#0c1220] border border-slate-200/80 dark:border-slate-800 shadow-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                <div className="text-xs text-slate-600 dark:text-slate-300">
                  <strong className="text-slate-900 dark:text-white block font-bold mb-0.5">Zero Ads & Zero Trackers</strong>
                  No cookies tracking your browsing, no marketing popups, ever.
                </div>
              </div>
            </div>
          </div>

          {/* Clean Visual Privacy Card (Replaced the code terminal!) */}
          <div className="rounded-3xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#090d16] p-8 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-44 h-44 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="space-y-6 relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Shield className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900 dark:text-white">Protected Workspace</h4>
                  <p className="text-xs text-slate-500">Always active & verified</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Cloud Sync Encryption</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Active
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Offline Local Storage</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Enabled
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Third-Party Tracking</span>
                  <span className="text-slate-400 font-bold">None</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Accordion FAQ Section */}
      <section id="faq" className="py-24 px-6 max-w-4xl mx-auto border-t border-slate-200/70 dark:border-slate-800/80">
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
                className="bg-white/90 dark:bg-[#0c1220]/90 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl overflow-hidden transition-all shadow-xs"
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
                      <div className="px-6 pb-5 pt-1 text-xs md:text-sm text-slate-600 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-800/60">
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
              Ready to organize your thoughts?
            </h3>
            <p className="text-sm md:text-base text-indigo-200/80 leading-relaxed font-normal">
              Experience the clarity of a modern visual workspace. Free forever, no credit card needed.
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
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-6">
          
          {/* Brand & Author */}
          <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#080d19] dark:bg-slate-950 flex items-center justify-center shadow-sm border border-slate-700/60 p-1 overflow-hidden shrink-0">
                <img src="/favicon.png?v=3" alt="Glick X Notes" className="w-full h-full object-contain" />
              </div>
              <span className="text-sm font-black tracking-tight text-slate-800 dark:text-slate-200">
                Glick X Notes
              </span>
            </div>
            <span className="hidden sm:inline text-slate-300 dark:text-slate-700">•</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Crafted by{' '}
              <a 
                href="https://github.com/Rupam852" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Rupam Bairagya
              </a>
            </span>
          </div>

          {/* Social Profiles & Support Email */}
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <a
              href="https://www.linkedin.com/in/rupam-bairagya"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn Profile"
              title="LinkedIn - Rupam Bairagya"
              className="p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 text-slate-600 dark:text-slate-300 hover:text-[#0A66C2] dark:hover:text-[#0A66C2] hover:border-[#0A66C2]/40 hover:bg-[#0A66C2]/10 transition-all shadow-xs"
            >
              <Linkedin className="w-4 h-4" />
            </a>

            <a
              href="https://github.com/Rupam852"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub Profile"
              title="GitHub - Rupam852"
              className="p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:border-slate-400/40 hover:bg-slate-200/50 dark:hover:bg-slate-800/80 transition-all shadow-xs"
            >
              <Github className="w-4 h-4" />
            </a>

            <a
              href="https://www.instagram.com/_rupambairagya_/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram Profile"
              title="Instagram - @_rupambairagya_"
              className="p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 text-slate-600 dark:text-slate-300 hover:text-[#E4405F] dark:hover:text-[#E4405F] hover:border-[#E4405F]/40 hover:bg-[#E4405F]/10 transition-all shadow-xs"
            >
              <Instagram className="w-4 h-4" />
            </a>

            <a
              href="mailto:rupambairagya08@gmail.com"
              aria-label="Contact Support"
              title="Support: rupambairagya08@gmail.com"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-500/40 hover:bg-indigo-500/10 transition-all shadow-xs"
            >
              <Mail className="w-3.5 h-3.5 text-indigo-500" />
              <span>Contact Support</span>
            </a>
          </div>

          {/* Legal Modals Links */}
          <div className="flex items-center gap-4 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <button
              onClick={() => setActiveModal('privacy')}
              className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors underline-offset-4 hover:underline cursor-pointer"
            >
              Privacy Policy
            </button>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <button
              onClick={() => setActiveModal('terms')}
              className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors underline-offset-4 hover:underline cursor-pointer"
            >
              Terms & Conditions
            </button>
          </div>
        </div>
      </footer>

      {/* Privacy Policy & Terms & Conditions Popup Modal */}
      <AnimatePresence>
        {activeModal && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 bg-slate-950/70 backdrop-blur-md">
            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-2xl max-h-[85vh] bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-slate-800/90 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                    {activeModal === 'privacy' ? <Shield className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                      {activeModal === 'privacy' ? 'Privacy Policy' : 'Terms & Conditions'}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Glick X Notes · Last Updated: October 2026
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setActiveModal(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  aria-label="Close Modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {activeModal === 'privacy' ? (
                  <>
                    <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center gap-2.5">
                      <Lock className="w-4 h-4 shrink-0 text-emerald-500" />
                      <span className="font-semibold text-xs">Zero Tracking Pledge: Your notes and personal data are strictly yours. We do not track, profile, or sell your information.</span>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white mb-1.5 text-sm sm:text-base">1. Information Collection</h4>
                      <p>Glick X Notes collects only the minimal data essential to provide the service: your authenticated account email/UID and the notes, attachments, tags, and folder categories you create.</p>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white mb-1.5 text-sm sm:text-base">2. Strict Zero-Trust Data Isolation</h4>
                      <p>All database reads and writes are cryptographically restricted to your authenticated user account via Firebase Firestore Security Rules. Nobody—including other registered users—can access or query your notes.</p>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white mb-1.5 text-sm sm:text-base">3. Local Storage & Offline Cache</h4>
                      <p>Your notes and preferences (such as dark/light theme) are cached locally in your device's browser memory (IndexedDB/LocalStorage) to empower seamless offline editing. This local data never leaves your device without your explicit sync.</p>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white mb-1.5 text-sm sm:text-base">4. Media & Attachment Storage</h4>
                      <p>Images, screenshots, and document attachments are stored as secure sandboxed Base64 data chunks within isolated sub-collections under your personal account hierarchy.</p>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white mb-1.5 text-sm sm:text-base">5. Your Rights & Data Deletion</h4>
                      <p>You maintain complete ownership of your content. You can edit, archive, or permanently delete any note or attachment at any time. When you delete a note, it is permanently purged.</p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                      <p className="text-xs text-slate-400">
                        For any privacy-related inquiries or assistance, contact developer <strong className="text-slate-600 dark:text-slate-300">Rupam Bairagya</strong> at <a href="mailto:rupambairagya08@gmail.com" className="text-indigo-500 underline font-semibold">rupambairagya08@gmail.com</a>.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-700 dark:text-indigo-300 flex items-center gap-2.5">
                      <Sparkles className="w-4 h-4 shrink-0 text-indigo-500" />
                      <span className="font-semibold text-xs">Free, open-source personal workspace designed for modern productivity and peace of mind.</span>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white mb-1.5 text-sm sm:text-base">1. Acceptance of Terms</h4>
                      <p>By accessing Glick X Notes or creating an account, you agree to these Terms and Conditions. If you disagree with any portion, please discontinue use of the application.</p>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white mb-1.5 text-sm sm:text-base">2. 100% Intellectual Property Rights</h4>
                      <p>You retain 100% full ownership, copyright, and intellectual property rights over any notes, documents, attachments, and ideas you write or store in Glick X Notes.</p>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white mb-1.5 text-sm sm:text-base">3. Acceptable Use</h4>
                      <p>You agree to use Glick X Notes lawfully and ethically. You may not attempt to reverse-engineer, exploit security rules, or distribute malicious or harmful materials using the platform.</p>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white mb-1.5 text-sm sm:text-base">4. Availability & Warranty Disclaimer</h4>
                      <p>Glick X Notes is provided "as is" and "as available" without warranties of any kind. While we strive for 100% uptime and offline data resilience, we recommend keeping regular backups of critical information.</p>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-base mb-1.5 text-sm sm:text-base">5. Contact & Inquiries</h4>
                      <p>Glick X Notes is maintained by Rupam Bairagya. If you have questions regarding these terms, please contact <a href="mailto:rupambairagya08@gmail.com" className="text-indigo-500 underline font-semibold">rupambairagya08@gmail.com</a>.</p>
                    </div>
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  © 2026 Glick X Notes · Crafted with care
                </span>
                <button
                  onClick={() => setActiveModal(null)}
                  className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 font-bold text-xs transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
