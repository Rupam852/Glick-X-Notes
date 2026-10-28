import React, { useState, useEffect } from 'react';
import { 
  Sparkles, Check, AlertCircle, Loader2, Key, Cpu, ShieldCheck, 
  RotateCcw, Eye, EyeOff, X, Play, RefreshCw, Zap, ExternalLink, ArrowRight,
  Database, Trash2
} from 'lucide-react';
import { 
  getAIConfig, saveAIConfig, getDefaultAIConfig, 
  testGeminiModel, GEMINI_MODELS, WORKING_GEMINI_FALLBACK_CHAIN,
  saveAIConfigToDatabase, syncAIConfigFromDatabase,
  AIConfiguration, ModelTestResult 
} from '../services/aiService';
import { useToast } from '../contexts/ToastContext';

interface AIConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
}

export default function AIConfigModal({ isOpen, onClose, userId }: AIConfigModalProps) {
  const { showToast } = useToast();
  const [config, setConfig] = useState<AIConfiguration>(getAIConfig());
  const [mode, setMode] = useState<'default' | 'custom'>(config.mode);

  // Custom Form State
  const [geminiModel, setGeminiModel] = useState(config.gemini.model);
  const [geminiKey, setGeminiKey] = useState(config.gemini.apiKey);
  const [showGeminiKey, setShowGeminiKey] = useState(false);

  // Saving state
  const [saving, setSaving] = useState(false);

  // Testing & Cooldown State
  const [testingDefault, setTestingDefault] = useState(false);
  const [testingCustom, setTestingCustom] = useState(false);
  const [testResults, setTestResults] = useState<ModelTestResult[] | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  // Load fresh config from local storage and sync with Firestore database when opening
  useEffect(() => {
    if (isOpen) {
      const loadConfig = async () => {
        let current = getAIConfig();
        if (userId) {
          try {
            current = await syncAIConfigFromDatabase(userId);
          } catch (e) {
            console.error('Failed to sync AI config from DB:', e);
          }
        }
        setConfig(current);
        setMode(current.mode);
        setGeminiModel(current.gemini.model);
        // Never prefill system key: only set if custom key was saved by user
        setGeminiKey(current.mode === 'custom' ? (current.gemini.apiKey || '') : '');
        setTestResults(null);
      };
      loadConfig();
    }
  }, [isOpen, userId]);

  // Cooldown timer
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldownSeconds(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  if (!isOpen) return null;

  // Save Custom Configuration to Database (replaces old key with new key)
  const handleSave = async () => {
    if (!geminiKey.trim()) {
      showToast('Please enter your personal Gemini API key.', 'error');
      return;
    }

    setSaving(true);
    const updated: AIConfiguration = {
      mode: 'custom',
      gemini: {
        model: geminiModel,
        apiKey: geminiKey.trim()
      }
    };

    try {
      if (userId) {
        // Saves/overwrites new key and deletes any previous key in database
        await saveAIConfigToDatabase(userId, updated);
        showToast('API key updated and saved in your database account!', 'success');
      } else {
        saveAIConfig(updated);
        showToast('Custom Gemini configuration saved to browser!', 'success');
      }
      setConfig(updated);
      setMode('custom');
    } catch (err: any) {
      showToast('Error saving to database: ' + (err.message || 'Network error'), 'error');
    } finally {
      setSaving(false);
    }
  };

  // Reset to Default Configuration (deletes custom key from database)
  const handleResetToDefault = async () => {
    const def = getDefaultAIConfig();
    setSaving(true);
    try {
      if (userId) {
        // Removes customGeminiConfig from Firestore database
        await saveAIConfigToDatabase(userId, def);
        showToast('Custom key deleted from database. Reverted to Default.', 'info');
      } else {
        saveAIConfig(def);
        showToast('Reset to Default Gemini Configuration', 'info');
      }
      setConfig(def);
      setMode('default');
      setGeminiModel(def.gemini.model);
      setGeminiKey('');
      setTestResults(null);
    } catch (err: any) {
      showToast('Error resetting database config: ' + (err.message || 'Network error'), 'error');
    } finally {
      setSaving(false);
    }
  };

  // Run Test for Default Gemini Models across Fallback Chain
  const handleTestDefault = async () => {
    if (cooldownSeconds > 0) return;
    setTestingDefault(true);
    setTestResults(null);

    const defaultGeminiKey = (import.meta.env.VITE_GEMINI_API_KEY as string) || '';

    if (!defaultGeminiKey.trim()) {
      showToast('Error: VITE_GEMINI_API_KEY is not set in environment.', 'error');
      setTestResults([{
        provider: 'gemini',
        model: 'gemini-3.5-flash',
        ok: false,
        status: 'Missing Key',
        latencyMs: 0,
        message: 'No API key configured in environment variables.'
      }]);
      setTestingDefault(false);
      return;
    }

    const results: ModelTestResult[] = [];
    for (const m of WORKING_GEMINI_FALLBACK_CHAIN) {
      const res = await testGeminiModel(defaultGeminiKey, m);
      results.push(res);
    }

    setTestResults(results);
    setTestingDefault(false);
    setCooldownSeconds(15);

    const anySuccess = results.some(r => r.ok);
    if (!anySuccess) {
      showToast('All Gemini models failed connection test! Please check Vercel API key.', 'error');
    } else {
      const workingCount = results.filter(r => r.ok).length;
      showToast(`${workingCount}/${results.length} Gemini models online & connected!`, 'success');
    }
  };

  // Run Test for Custom Gemini Configuration with sequential fallback
  const handleTestCustom = async () => {
    if (!geminiKey.trim()) {
      showToast('Please enter your Google Gemini API key first.', 'error');
      setTestResults([{
        provider: 'gemini',
        model: geminiModel,
        ok: false,
        status: 'Missing Key',
        latencyMs: 0,
        message: 'Google Gemini API key is not entered.'
      }]);
      return;
    }

    setTestingCustom(true);
    setTestResults(null);

    const sequence = [
      geminiModel,
      ...WORKING_GEMINI_FALLBACK_CHAIN.filter(m => m !== geminiModel)
    ];

    const results: ModelTestResult[] = [];
    for (const m of sequence) {
      const res = await testGeminiModel(geminiKey.trim(), m);
      results.push(res);
    }

    setTestResults(results);
    setTestingCustom(false);

    const anySuccess = results.some(r => r.ok);
    if (!anySuccess) {
      showToast('All Gemini models failed with your key! Please check if your key is valid.', 'error');
    } else {
      const workingCount = results.filter(r => r.ok).length;
      showToast(`${workingCount}/${results.length} Gemini models online with your key!`, 'success');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-xl bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Google Gemini AI Engine</h2>
                {userId && (
                  <span className="text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Database className="w-3 h-3" />
                    Cloud Synced
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Multi-Model Sequential Failover & Database Sync</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          
          {/* Mode Tabs */}
          <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800">
            <button
              onClick={() => {
                setMode('default');
                const def = getDefaultAIConfig();
                saveAIConfig(def);
                setConfig(def);
                setGeminiKey('');
                setTestResults(null);
                showToast('Switched to Default Gemini Engine', 'info');
              }}
              className={`py-2.5 text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-all ${
                mode === 'default'
                  ? 'bg-white dark:bg-[#1e293b] text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Cpu className="w-4 h-4" />
              Default Gemini Engine
            </button>
            <button
              onClick={() => {
                setMode('custom');
                const current = getAIConfig();
                setGeminiKey(current.mode === 'custom' ? (current.gemini.apiKey || '') : '');
                setTestResults(null);
                showToast('Custom Gemini Key mode selected.', 'info');
              }}
              className={`py-2.5 text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-all ${
                mode === 'custom'
                  ? 'bg-white dark:bg-[#1e293b] text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Key className="w-4 h-4" />
              Custom Gemini Key
            </button>
          </div>

          {/* Sequential Fallback Chain Indicator */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                Active Fallback Sequence
              </span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded font-semibold">
                Auto-Failover
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Agar pehla model busy ya rate-limited ho, system bina rukhe agle model par shift ho jata hai:
            </p>
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono font-medium pt-1">
              <span className="px-2 py-1 rounded bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60 font-semibold">
                1. 3.5-flash
              </span>
              <ArrowRight className="w-3 h-3 text-slate-400" />
              <span className="px-2 py-1 rounded bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900/60">
                2. 3.5-flash-lite
              </span>
              <ArrowRight className="w-3 h-3 text-slate-400" />
              <span className="px-2 py-1 rounded bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-900/60">
                3. 3.6-flash
              </span>
              <ArrowRight className="w-3 h-3 text-slate-400" />
              <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                4. 3.8-flash
              </span>
            </div>
          </div>

          {/* Mode 1: DEFAULT */}
          {mode === 'default' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-4 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 text-sm">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-blue-950 dark:text-blue-200">Google Gemini Built-In</h4>
                    <p className="text-xs text-blue-800/80 dark:text-blue-300/80 mt-1">
                      Glick X Notes high-speed Google Gemini models use karta hai. Default mode me system API key background me secure rehti hai.
                    </p>
                  </div>
                </div>
              </div>

              {/* Models List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded">Primary Model</span>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1.5">Gemini 3.5 Flash</p>
                  <p className="text-xs text-slate-500">Fast, smart & stable</p>
                </div>
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded">High-Speed Failover</span>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1.5">Gemini 3.5 Flash-Lite</p>
                  <p className="text-xs text-slate-500">Instant automatic backup</p>
                </div>
              </div>

              {/* Test Button for Default */}
              <div className="pt-2">
                <button
                  onClick={handleTestDefault}
                  disabled={testingDefault || cooldownSeconds > 0}
                  className={`w-full py-3 px-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition shadow-sm ${
                    cooldownSeconds > 0
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-200 dark:border-slate-700'
                      : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20'
                  }`}
                >
                  {testingDefault ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Testing Gemini Sequence in Real-Time...
                    </>
                  ) : cooldownSeconds > 0 ? (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      Cooldown: Try again in {cooldownSeconds}s
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      Test All Gemini Models in Sequence
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Mode 2: CUSTOM CONFIGURATION */}
          {mode === 'custom' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              
              {/* Notice */}
              <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-blue-500" />
                    Database Cloud Storage
                  </span>
                  <a 
                    href="https://aistudio.google.com/app/apikey" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-semibold"
                  >
                    Get free key <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Aapka custom key aapke account ke database me secure save hoga. Jab bhi aap naya key daal kar save karenge, purana key delete ho jayega aur naya key replace ho jayega!
                </p>
              </div>

              {/* Model Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Select Primary Gemini Model</label>
                <select
                  value={geminiModel}
                  onChange={(e) => setGeminiModel(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {GEMINI_MODELS.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              {/* API Key Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Google Gemini API Key</label>
                <div className="relative">
                  <input
                    type={showGeminiKey ? 'text' : 'password'}
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    placeholder="Enter your personal Gemini API Key"
                    className="w-full px-3 py-2.5 pr-10 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGeminiKey(!showGeminiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 transition disabled:opacity-60"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {saving ? 'Updating Database...' : 'Save & Update in Database'}
                </button>
                <button
                  type="button"
                  onClick={handleTestCustom}
                  disabled={testingCustom || saving}
                  className="py-2.5 px-4 rounded-xl text-sm font-semibold border border-blue-200 dark:border-blue-800/80 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center gap-2 transition"
                >
                  {testingCustom ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  Test Fallback Chain
                </button>
              </div>
            </div>
          )}

          {/* Test Results Section */}
          {testResults && (
            <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                  Sequential Model Test Results
                </h4>
                <span className="text-[10px] text-slate-500">
                  {testResults.filter(r => r.ok).length}/{testResults.length} Online
                </span>
              </div>
              <div className="space-y-2">
                {testResults.map((res, idx) => (
                  <div 
                    key={idx}
                    className={`p-3 rounded-lg border flex items-start justify-between gap-3 text-xs transition-all ${
                      res.ok 
                        ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200' 
                        : 'border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 text-rose-900 dark:text-rose-200'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold uppercase tracking-wider text-[10px]">
                          #{idx + 1}: {res.model}
                        </span>
                        {res.ok && (
                          <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.2 rounded font-semibold">
                            {res.latencyMs}ms
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] opacity-90 leading-relaxed">{res.message}</p>
                    </div>
                    {res.ok ? (
                      <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-3 h-3" />
                      </span>
                    ) : (
                      <span className="w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center shrink-0 mt-0.5">
                        <AlertCircle className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between text-xs text-slate-500">
          <button
            onClick={handleResetToDefault}
            disabled={saving}
            className="flex items-center gap-1.5 hover:text-slate-800 dark:hover:text-slate-200 transition text-rose-600/80 hover:text-rose-600 dark:text-rose-400/80 dark:hover:text-rose-400"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete Custom Key (Reset to Default)
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 font-semibold text-slate-800 dark:text-slate-200 transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
