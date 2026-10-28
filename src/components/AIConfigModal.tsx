import React, { useState, useEffect } from 'react';
import { 
  Sparkles, Check, AlertCircle, Loader2, Key, Cpu, ShieldCheck, 
  RotateCcw, Eye, EyeOff, X, Play, RefreshCw, Zap, ExternalLink
} from 'lucide-react';
import { 
  getAIConfig, saveAIConfig, getDefaultAIConfig, 
  testGeminiModel, GEMINI_MODELS, 
  AIConfiguration, ModelTestResult 
} from '../services/aiService';
import { useToast } from '../contexts/ToastContext';

interface AIConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AIConfigModal({ isOpen, onClose }: AIConfigModalProps) {
  const { showToast } = useToast();
  const [config, setConfig] = useState<AIConfiguration>(getAIConfig());
  const [mode, setMode] = useState<'default' | 'custom'>(config.mode);

  // Custom Form State
  const [geminiModel, setGeminiModel] = useState(config.gemini.model);
  const [geminiKey, setGeminiKey] = useState(config.gemini.apiKey);
  const [showGeminiKey, setShowGeminiKey] = useState(false);

  // Testing & Cooldown State
  const [testingDefault, setTestingDefault] = useState(false);
  const [testingCustom, setTestingCustom] = useState(false);
  const [testResults, setTestResults] = useState<ModelTestResult[] | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  // Load fresh config when opening
  useEffect(() => {
    if (isOpen) {
      const current = getAIConfig();
      setConfig(current);
      setMode(current.mode);
      setGeminiModel(current.gemini.model);
      setGeminiKey(current.gemini.apiKey);
      setTestResults(null);
    }
  }, [isOpen]);

  // Cooldown timer
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldownSeconds(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  if (!isOpen) return null;

  // Save Custom Configuration
  const handleSave = () => {
    const updated: AIConfiguration = {
      mode: 'custom',
      gemini: {
        model: geminiModel,
        apiKey: geminiKey.trim()
      }
    };
    saveAIConfig(updated);
    setConfig(updated);
    setMode('custom');
    showToast('Gemini AI Configuration saved to local storage!', 'success');
  };

  // Reset to Default Configuration
  const handleResetToDefault = () => {
    const def = getDefaultAIConfig();
    saveAIConfig(def);
    setConfig(def);
    setMode('default');
    setGeminiModel(def.gemini.model);
    setGeminiKey('');
    setTestResults(null);
    showToast('Reset to Default Gemini Configuration', 'info');
  };

  // Run Test for Default Gemini Models
  const handleTestDefault = async () => {
    if (cooldownSeconds > 0) return;
    setTestingDefault(true);
    setTestResults(null);

    const defaultGeminiKey = (import.meta.env.VITE_GEMINI_API_KEY as string) || '';

    const results: ModelTestResult[] = [];

    // Test Gemini 1.5 Flash
    const gResult = await testGeminiModel(defaultGeminiKey, 'gemini-1.5-flash');
    results.push(gResult);

    // Test Gemini 2.0 Flash
    const g2Result = await testGeminiModel(defaultGeminiKey, 'gemini-2.0-flash');
    results.push(g2Result);

    setTestResults(results);
    setTestingDefault(false);
    setCooldownSeconds(15);
  };

  // Run Test for Custom Gemini Configuration
  const handleTestCustom = async () => {
    setTestingCustom(true);
    setTestResults(null);

    const results: ModelTestResult[] = [];

    if (geminiKey.trim()) {
      const gResult = await testGeminiModel(geminiKey.trim(), geminiModel);
      results.push(gResult);
    } else {
      results.push({
        provider: 'gemini',
        model: geminiModel,
        ok: false,
        status: 'Missing Key',
        latencyMs: 0,
        message: 'Google Gemini API key is not entered.'
      });
    }

    setTestResults(results);
    setTestingCustom(false);
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
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Google Gemini AI Engine</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Configure your Google Gemini models and API key</p>
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

          {/* Mode 1: DEFAULT */}
          {mode === 'default' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-4 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 text-sm">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-blue-950 dark:text-blue-200">Google Gemini Built-In</h4>
                    <p className="text-xs text-blue-800/80 dark:text-blue-300/80 mt-1">
                      Glick X Notes uses fast and modern Google Gemini models. You can test your connection or use your own custom key anytime.
                    </p>
                  </div>
                </div>
              </div>

              {/* Models List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded">Primary Model</span>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1.5">Gemini 1.5 Flash</p>
                  <p className="text-xs text-slate-500">Fast, smart & optimized for notes</p>
                </div>
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded">Failover Backup</span>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1.5">Gemini 2.0 Flash</p>
                  <p className="text-xs text-slate-500">Automatic high-speed fallback</p>
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
                      Testing Gemini Connection...
                    </>
                  ) : cooldownSeconds > 0 ? (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      Cooldown: Try again in {cooldownSeconds}s
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      Test Gemini Connection
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
              <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 flex items-center justify-between">
                <span>🔒 Your key stays strictly in your browser's local storage.</span>
                <a 
                  href="https://aistudio.google.com/app/apikey" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-semibold"
                >
                  Get free key <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {/* Model Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Select Google Gemini Model</label>
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
                    placeholder="Enter your Gemini API Key"
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
                  className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 transition"
                >
                  <Check className="w-4 h-4" />
                  Save Gemini Configuration
                </button>
                <button
                  type="button"
                  onClick={handleTestCustom}
                  disabled={testingCustom}
                  className="py-2.5 px-4 rounded-xl text-sm font-semibold border border-blue-200 dark:border-blue-800/80 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center gap-2 transition"
                >
                  {testingCustom ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  Test Connection
                </button>
              </div>
            </div>
          )}

          {/* Test Results Section */}
          {testResults && (
            <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 animate-in fade-in duration-200">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                Connection Test Results
              </h4>
              <div className="space-y-2">
                {testResults.map((res, idx) => (
                  <div 
                    key={idx}
                    className={`p-3 rounded-lg border flex items-start justify-between gap-3 text-xs ${
                      res.ok 
                        ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200' 
                        : 'border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 text-rose-900 dark:text-rose-200'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold uppercase tracking-wider text-[10px]">Gemini: {res.model}</span>
                        {res.ok && <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.2 rounded font-semibold">{res.latencyMs}ms</span>}
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
            className="flex items-center gap-1.5 hover:text-slate-800 dark:hover:text-slate-200 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to Default
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
