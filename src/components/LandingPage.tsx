import { useState } from 'react';
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
  HelpCircle, 
  FileText, 
  Edit3, 
  Share2, 
  User, 
  Key,
  FolderOpen,
  Eye,
  Github,
  Award,
  LayoutDashboard,
  Settings,
  LogOut,
  Copy,
  Plus,
  Search,
  SortDesc,
  Calendar,
  Clock,
  ArrowLeft,
  Save,
  Loader2,
  Bold,
  Italic,
  Heading1,
  Quote,
  List,
  Link,
  Tag
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface LandingPageProps {
  onLogin: () => void;
  onSignup: () => void;
}

export default function LandingPage({ onLogin, onSignup }: LandingPageProps) {
  const { theme, toggleTheme } = useTheme();
  const [faqOpen, setFaqOpen] = useState<number | null>(null);


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
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-slate-100/30 to-white dark:from-slate-950 dark:to-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-500 font-sans overflow-x-hidden selection:bg-indigo-500 selection:text-white relative">
      {/* Premium Background Grid Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none -z-20" />
      
      {/* Background Orbs */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-indigo-300/30 dark:bg-indigo-900/10 rounded-full blur-[140px] pointer-events-none -z-10 animate-pulse duration-[8s]" />
      <div className="absolute top-1/3 right-1/4 w-[700px] h-[700px] bg-pink-300/25 dark:bg-pink-900/10 rounded-full blur-[160px] pointer-events-none -z-10 animate-pulse duration-[10s]" />
      <div className="absolute bottom-1/4 left-10 w-[500px] h-[500px] bg-emerald-300/20 dark:bg-emerald-900/5 rounded-full blur-[120px] pointer-events-none -z-10" />

      {/* Navigation */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/70 dark:bg-slate-950/70 border-b border-slate-200/50 dark:border-slate-800/40 transition-colors">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-500/30 flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-indigo-600 via-violet-600 to-pink-600 dark:from-indigo-400 dark:via-violet-400 dark:to-pink-400 bg-clip-text text-transparent">
              Glick X Notes
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600 dark:text-slate-300">
            <a href="#features" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Features</a>
            <a href="#security" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Security</a>
            <a href="#faq" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">FAQs</a>
          </nav>

          <div className="flex items-center gap-4">
            {/* Theme Toggle */}
            <button 
              onClick={toggleTheme}
              className="p-2.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300 transition-all cursor-pointer"
              title="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* Auth CTAs */}
            <button 
              onClick={onLogin}
              className="hidden sm:inline-flex text-sm font-semibold text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 px-4 py-2 transition-colors cursor-pointer"
            >
              Sign In
            </button>
            <button 
              onClick={onSignup}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-500/20 hover:shadow-xl hover:shadow-indigo-500/30 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              Get Started
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-16 pb-24 px-6 max-w-7xl mx-auto text-center relative">
        <div className="space-y-6 max-w-4xl mx-auto">


          {/* Main Hero Title */}
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.1]"
          >
            Your thoughts. <br />
            <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-pink-600 dark:from-indigo-400 dark:via-violet-400 dark:to-pink-400 bg-clip-text text-transparent">
              Organized. Secure. Anywhere.
            </span>
          </motion.h1>

          {/* Hero Subtitle */}
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="text-lg md:text-xl text-slate-500 dark:text-slate-400 max-w-2xl mx-auto font-normal leading-relaxed"
          >
            Glick X Notes is a 100% free, open-source personal workspace. It combines visual organization, markdown support, real-time synchronization, and multi-device base64 file attachment integration with zero subscriptions or advertisements.
          </motion.p>

          {/* Hero CTAs */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
          >
            <button
              onClick={onSignup}
              className="w-full sm:w-auto px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xl shadow-indigo-500/20 hover:shadow-2xl hover:shadow-indigo-500/40 hover:-translate-y-0.5 transition-all text-base cursor-pointer"
            >
              Start Free Vault
            </button>
            <a
              href="#features"
              className="w-full sm:w-auto px-8 py-4 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all text-base cursor-pointer flex items-center justify-center gap-2"
            >
              Explore Features
            </a>
          </motion.div>

          {/* Trust Badges */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="flex flex-wrap items-center justify-center gap-4 pt-12 text-xs text-slate-650 dark:text-slate-400 font-bold tracking-wide uppercase"
          >
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-xl shadow-sm shadow-emerald-100/10">
              <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              End-to-End User Isolation
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-xl shadow-sm shadow-amber-100/10">
              <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              Reactive Firebase DB
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded-xl shadow-sm shadow-indigo-100/10">
              <Cloud className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              Offline Auto-Sync
            </div>
          </motion.div>
        </div>

      </section>

      {/* Core Features Grid Section */}
      <section id="features" className="py-24 border-t border-slate-200/50 dark:border-slate-900/80 relative">
        <div className="max-w-7xl mx-auto px-6 space-y-16">
          <div className="text-center max-w-2xl mx-auto space-y-4">
            <h2 className="text-xs uppercase font-extrabold tracking-widest text-indigo-600 dark:text-indigo-400">Features Showcase</h2>
            <h3 className="text-3xl md:text-4xl font-extrabold tracking-tight">Everything you need to secure and capture details</h3>
            <p className="text-slate-500 dark:text-slate-400">
              Built on React, TypeScript, and Firebase, Glick X Notes offers professional-grade organization.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="group bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 hover:border-indigo-500/40 dark:hover:border-indigo-500/40 rounded-2xl p-8 hover:shadow-xl hover:shadow-indigo-500/[0.02] transition-all duration-300">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/50 w-12 h-12 rounded-xl text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Lock className="w-6 h-6" />
              </div>
              <h4 className="text-xl font-bold mb-3">Granular Privacy Rules</h4>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Zero-trust Firestore security policies prevent database leaks. Only you can access your private dashboard, ensuring ultimate metadata safety.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="group bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 hover:border-pink-500/40 dark:hover:border-pink-500/40 rounded-2xl p-8 hover:shadow-xl hover:shadow-pink-500/[0.02] transition-all duration-300">
              <div className="p-3 bg-pink-50 dark:bg-pink-950/50 w-12 h-12 rounded-xl text-pink-600 dark:text-pink-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Zap className="w-6 h-6" />
              </div>
              <h4 className="text-xl font-bold mb-3">Reactive Live Updates</h4>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Experience real-time sync with database events. Edits automatically propagate across multiple active tabs and devices in less than a second.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="group bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 hover:border-emerald-500/40 dark:hover:border-emerald-500/40 rounded-2xl p-8 hover:shadow-xl hover:shadow-emerald-500/[0.02] transition-all duration-300">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 w-12 h-12 rounded-xl text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Cloud className="w-6 h-6" />
              </div>
              <h4 className="text-xl font-bold mb-3">Offline Sync Cache</h4>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Our local caching system enables reading, writing, and deleting notes even when disconnected. Offline notes sync smoothly when connectivity is restored.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="group bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 hover:border-purple-500/40 dark:hover:border-purple-500/40 rounded-2xl p-8 hover:shadow-xl hover:shadow-purple-500/[0.02] transition-all duration-300">
              <div className="p-3 bg-purple-50 dark:bg-purple-950/50 w-12 h-12 rounded-xl text-purple-600 dark:text-purple-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <FileText className="w-6 h-6" />
              </div>
              <h4 className="text-xl font-bold mb-3">Base64 Attachments</h4>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Upload image assets, PDFs, and rich media documents directly. Binary files are encoded into optimized Base64 strings for ultra-safe DB storage.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="group bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 hover:border-amber-500/40 dark:hover:border-amber-500/40 rounded-2xl p-8 hover:shadow-xl hover:shadow-amber-500/[0.02] transition-all duration-300">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/50 w-12 h-12 rounded-xl text-amber-600 dark:text-amber-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Database className="w-6 h-6" />
              </div>
              <h4 className="text-xl font-bold mb-3">Custom Color Coding</h4>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Differentiate your work categories with premium visual codes. Organize visually by tag and select from 5 sleek predefined color themes.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="group bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 hover:border-rose-500/40 dark:hover:border-rose-500/40 rounded-2xl p-8 hover:shadow-xl hover:shadow-rose-500/[0.02] transition-all duration-300">
              <div className="p-3 bg-rose-50 dark:bg-rose-950/50 w-12 h-12 rounded-xl text-rose-600 dark:text-rose-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Smartphone className="w-6 h-6" />
              </div>
              <h4 className="text-xl font-bold mb-3">Fully Responsive UI</h4>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Enjoy a desktop-optimized custom sidebar or switch seamlessly to a thumb-friendly mobile bottom navigation, styled with modern fluidity.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Security Architecture Deep Dive */}
      <section id="security" className="py-24 bg-slate-100 dark:bg-slate-900/30 border-t border-slate-200/50 dark:border-slate-900/80 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <span className="text-xs uppercase font-extrabold tracking-widest text-indigo-600 dark:text-indigo-400">Security First Architecture</span>
              <h3 className="text-3xl md:text-4xl font-extrabold tracking-tight">Your digital identity is secure under zero-trust protocols</h3>
              <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                Unlike traditional notes platforms that store plain-text user files in easily scanned folders, Glick X Notes utilizes strict Firebase rules and user-bound indexing.
              </p>

              <div className="space-y-4 pt-4">
                <div className="flex gap-4">
                  <div className="p-2.5 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl h-10 w-10 flex items-center justify-center shrink-0">
                    <Check className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="font-bold text-base">Biometric Firebase Auth Integration</h5>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Multi-factor ready sign-in ensures only registered cryptographically validated accounts access note collections.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="p-2.5 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl h-10 w-10 flex items-center justify-center shrink-0">
                    <Check className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="font-bold text-base">Zero Admin Footprint Storage Rules</h5>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Firestore security schemas physically prevent admin overrides. Your database row belongs strictly to your matching `userId` auth object.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="p-2.5 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl h-10 w-10 flex items-center justify-center shrink-0">
                    <Check className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="font-bold text-base">In-Collection Attachment Base64 Sandboxing</h5>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Attachments avoid public S3 buckets. Instead, they reside strictly in base64 encrypted rows inside secure Firestore child databases.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual representation of Security rules */}
            <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-2xl font-mono text-xs text-slate-300 relative overflow-hidden max-w-lg mx-auto w-full">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-indigo-500" />
              <div className="flex items-center justify-between pb-4 border-b border-slate-800 text-[10px] text-slate-500 font-bold uppercase">
                <span>firestore.rules</span>
                <span className="text-emerald-400 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Validated
                </span>
              </div>
              <pre className="pt-4 overflow-x-auto text-[11px] leading-relaxed text-slate-400">
{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Note isolation pattern
    match /notes/{noteId} {
      allow read, update, delete: if request.auth != null 
        && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null 
        && request.auth.uid == request.resource.data.userId;
      
      // Child Base64 Attachments
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
        </div>
      </section>


      {/* Accordion FAQ Section */}
      <section id="faq" className="py-24 bg-slate-100 dark:bg-slate-900/30 border-t border-slate-200/50 dark:border-slate-900/80 relative">
        <div className="max-w-4xl mx-auto px-6 space-y-16">
          <div className="text-center space-y-4">
            <h2 className="text-xs uppercase font-extrabold tracking-widest text-indigo-600 dark:text-indigo-400">Frequently Asked Questions</h2>
            <h3 className="text-3xl md:text-4xl font-extrabold tracking-tight">Got questions? We've got answers.</h3>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div 
                key={index}
                className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/80 rounded-2xl overflow-hidden transition-all duration-300"
              >
                <button
                  onClick={() => setFaqOpen(faqOpen === index ? null : index)}
                  className="w-full px-6 py-5 flex items-center justify-between text-left font-bold text-base md:text-lg hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                >
                  <span>{faq.question}</span>
                  <ChevronDown 
                    className={`w-5 h-5 text-slate-400 dark:text-slate-500 transition-transform duration-300 ${faqOpen === index ? 'rotate-180 text-indigo-600' : ''}`} 
                  />
                </button>

                <AnimatePresence initial={false}>
                  {faqOpen === index && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: 'auto' }}
                      exit={{ height: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-6 text-sm md:text-base text-slate-500 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-800/50 pt-4">
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

      {/* CTA Final Banner */}
      <section className="py-24 px-6 max-w-7xl mx-auto relative text-center">
        {/* Colorful background border glow */}
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 rounded-[2.5rem] blur-2xl opacity-60 pointer-events-none" />
        
        <div className="relative bg-slate-950 border border-slate-800/80 rounded-[2.5rem] p-10 md:p-20 overflow-hidden space-y-8 shadow-[0_0_50px_-12px_rgba(99,102,241,0.35)]">
          {/* Animated decorative fluid background blobs */}
          <div className="absolute top-0 -left-20 w-80 h-80 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none animate-pulse duration-[8s]" />
          <div className="absolute bottom-0 -right-20 w-80 h-80 bg-pink-500/10 rounded-full blur-[100px] pointer-events-none animate-pulse duration-[10s]" />
          
          {/* Grid pattern overlay */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
          
          <div className="space-y-4 relative z-10">

            
            <h3 className="text-4xl md:text-6xl font-black text-white tracking-tight leading-[1.05] max-w-3xl mx-auto">
              Ready to secure your <br />
              <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-pink-400 bg-clip-text text-transparent">
                digital thoughts & notes?
              </span>
            </h3>
            
            <p className="text-slate-400 max-w-xl mx-auto text-sm md:text-base font-normal leading-relaxed">
              Create your free secure account today, attach files directly, and experience real-time sync with robust Firestore rules and zero ads.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-5 pt-4 relative z-10">
            <button
              onClick={onSignup}
              className="w-full sm:w-auto px-10 py-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-extrabold rounded-2xl shadow-xl shadow-indigo-600/30 hover:shadow-2xl hover:shadow-indigo-600/50 hover:-translate-y-0.5 transition-all text-base cursor-pointer"
            >
              Sign Up Free Account
            </button>
            <button
              onClick={onLogin}
              className="w-full sm:w-auto px-10 py-4 bg-slate-900/80 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-slate-700 font-extrabold rounded-2xl hover:-translate-y-0.5 transition-all text-base cursor-pointer flex items-center justify-center gap-2"
            >
              Access Vault
              <ArrowRight className="w-5 h-5 transition-transform" />
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200/50 dark:border-slate-900/80 bg-white dark:bg-slate-950 transition-colors">
        <div className="max-w-7xl mx-auto px-6 py-12 md:py-16 space-y-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-600 rounded-lg text-white">
                  <Shield className="w-5 h-5" />
                </div>
                <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-indigo-600 to-pink-600 dark:from-indigo-400 dark:to-pink-400 bg-clip-text text-transparent">
                  Glick X Notes
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">
                Next generation visual and secure note taking systems. Engineered with state-of-the-art React components, Firebase reactivity, and local base64 caching models.
              </p>
            </div>

            <div>
              <h5 className="font-bold text-sm text-slate-800 dark:text-slate-200 mb-4">Core Technology</h5>
              <ul className="space-y-2 text-xs text-slate-500 dark:text-slate-400">
                <li>React 19 & TypeScript</li>
                <li>Firebase Client v12</li>
                <li>Tailwind CSS v4 Engine</li>
                <li>Framer Motion Animations</li>
              </ul>
            </div>

            <div>
              <h5 className="font-bold text-sm text-slate-800 dark:text-slate-200 mb-4">Legal & Privacy</h5>
              <ul className="space-y-2 text-xs text-slate-500 dark:text-slate-400">
                <li>End-to-End Privacy Policy</li>
                <li>Zero-Knowledge Policy</li>
                <li>Terms of Service</li>
                <li>Firestore Rule Validation</li>
              </ul>
            </div>
          </div>

          <hr className="border-slate-100 dark:border-slate-900" />

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400 dark:text-slate-500 font-medium">
            <span>&copy; {new Date().getFullYear()} Glick X Notes. Created with premium craftsmanship.</span>
            <div className="flex gap-6">
              <a href="#features" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Features</a>
              <a href="#security" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Security</a>
              <a href="#faq" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">FAQs</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
