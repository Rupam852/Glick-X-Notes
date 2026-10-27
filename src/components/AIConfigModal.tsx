import React, { useState, useEffect } from 'react';
import { 
  Sparkles, Check, AlertCircle, Loader2, Key, Cpu, ShieldCheck, 
  RotateCcw, Eye, EyeOff, X, ArrowRight, Play, RefreshCw, Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  getAIConfig, saveAIConfig, getDefaultAIConfig, 
  testGeminiModel, testOpenAIModel,
  GEMINI_MODELS, OPENAI_MODELS, 
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

  const [openaiModel, setOpenaiModel] = useState(config.openai.model);
  const [openaiKey, setOpenaiKey] = useState(config.openai.apiKey);
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);

  const [primary, setPrimary] = useState<'gemini' | 'openai'>(config.primary);

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
      setOpenaiModel(current.openai.model);
      setOpenaiKey(current.openai.apiKey);
      setPrimary(current.primary);
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

  // Handle Primary Switch (Auto-syncs Secondary)
  const handlePrimaryChange = (selected: 'gemini' | 'openai') => {
    setPrimary(selected);
  };

  const secondary = primary === 'gemini' ? 'openai' : 'gemini';

  // Save Custom Configuration
  const handleSave = () => {
    const updated: AIConfiguration = {
      mode: 'custom',
      primary,
      secondary,
      gemini: {
        model: geminiModel,
        apiKey: geminiKey.trim()
      },
      openai: {
        model: openaiModel,
        apiKey: openaiKey.trim()
      }
    };
    saveAIConfig(updated);
    setConfig(updated);
    setMode('custom');
    showToast('AI Configuration saved to local storage!', 'success');
  };

  // Reset to Default Configuration
  const handleResetToDefault = () => {
    const def = getDefaultAIConfig();
    saveAIConfig(def);
    setConfig(def);
    setMode('default');
    setGeminiModel(def.gemini.model);
    setGeminiKey('');
    setOpenaiModel(def.openai.model);
    setOpenaiKey('');
    setPrimary('gemini');
    setTestResults(null);
    showToast('Reset to Default AI Configuration', 'info');
  };

  // Run Test for Default Models (with 30s cooldown)
  const handleTestDefault = async () => {
    if (cooldownSeconds > 0) return;
    setTestingDefault(true);
    setTestResults(null);

    const defaultGeminiKey = (import.meta.env.VITE_GEMINI_API_KEY as string) || '';
    const defaultOpenaiKey = (import.meta.env.VITE_OPENAI_API_KEY as string) || '';

    const results: ModelTestResult[] = [];

    // Test Gemini 3.5 Flash
    const gResult = await testGeminiModel(defaultGeminiKey, 'gemini-3.5-flash');
    results.push(gResult);

    // Test Gemini 3.5 Flash-Lite
    const gLiteResult = await testGeminiModel(defaultGeminiKey, 'gemini-3.5-flash-lite');
    results.push(gLiteResult);

    // Test OpenAI GPT-4o-mini
    if (defaultOpenaiKey) {
      const oResult = await testOpenAIModel(defaultOpenaiKey, 'gpt-4o-mini');
      results.push(oResult);
    }

    setTestResults(results);
    setTestingDefault(false);
    setCooldownSeconds(30); // 30s cooldown enforced
  };

  // Run Test for Custom Configuration
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
        message: 'Gemini API key is not entered.'
      });
    }

    if (openaiKey.trim()) {
      const oResult = await testOpenAIModel(openaiKey.trim(), openaiModel);
      results.push(oResult);
    } else {
      results.push({
        provider: 'openai',
        model: openaiModel,
        ok: false,
        status: 'Missing Key',
        latencyMs: 0,
        message: 'OpenAI API key is not entered.'
      });
    }

    setTestResults(results);
    setTestingCustom(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-2xl bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">AI Engine Configuration</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Configure intelligence engine, custom keys, and failover models</p>
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
                showToast('Switched to Default AI mode', 'info');
              }}
              className={`py-2.5 text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-all ${
                mode === 'default'
                  ? 'bg-white dark:bg-[#1e293b] text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Cpu className="w-4 h-4" />
              Default Engine
            </button>
            <button
              onClick={() => {
                setMode('custom');
                showToast('Custom AI Mode unlocked. Enter your keys below.', 'info');
              }}
              className={`py-2.5 text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-all ${
                mode === 'custom'
                  ? 'bg-white dark:bg-[#1e293b] text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Key className="w-4 h-4" />
              Custom Configuration
            </button>
          </div>

          {/* Mode 1: DEFAULT */}
          {mode === 'default' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-4 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 text-sm">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-indigo-950 dark:text-indigo-200">Built-in AI Ready</h4>
                    <p className="text-xs text-indigo-800/80 dark:text-indigo-300/80 mt-1">
                      Glick X Notes includes high-speed default Google Gemini 3.5 models. You can test connectivity anytime.
                    </p>
                  </div>
                </div>
              </div>

              {/* Models List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded">Primary Model</span>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1.5">Gemini 3.5 Flash</p>
                  <p className="text-xs text-slate-500">Google Generative Language</p>
                </div>
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-500 bg-purple-50 dark:bg-purple-950/60 px-2 py-0.5 rounded">Secondary (Fallback)</span>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1.5">Gemini 3.5 Flash-Lite</p>
                  <p className="text-xs text-slate-500">Automatic backup failover</p>
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
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20'
                  }`}
                >
                  {testingDefault ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Testing Built-in AI Models...
                    </>
                  ) : cooldownSeconds > 0 ? (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      Cooldown: Try again in {cooldownSeconds}s
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      Check Default AI Models (Test Connectivity)
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Mode 2: CUSTOM CONFIGURATION */}
          {mode === 'custom' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              
              {/* Notice */}
              <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
                🔒 Custom keys are stored only in your local browser/device storage. If you reinstall or clear data, Glick resets safely to Default mode.
              </div>

              {/* SECTION 1: GEMINI */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Google Gemini Section</h3>
                  </div>
                  <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded">Google AI Studio</span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Select Gemini Model</label>
                  <select
                    value={geminiModel}
                    onChange={(e) => setGeminiModel(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {GEMINI_MODELS.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Gemini API Key</label>
                  <div className="relative">
                    <input
                      type={showGeminiKey ? 'text' : 'password'}
                      value={geminiKey}
                      onChange={(e) => setGeminiKey(e.target.value)}
                      placeholder="Enter Google Gemini API Key"
                      className="w-full px-3 py-2 pr-10 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowGeminiKey(!showGeminiKey)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* SECTION 2: OPENAI */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">OpenAI Section</h3>
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded">ChatGPT API</span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Select OpenAI Model</label>
                  <select
                    value={openaiModel}
                    onChange={(e) => setOpenaiModel(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {OPENAI_MODELS.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">OpenAI API Key</label>
                  <div className="relative">
                    <input
                      type={showOpenaiKey ? 'text' : 'password'}
                      value={openaiKey}
                      onChange={(e) => setOpenaiKey(e.target.value)}
                      placeholder="sk-proj-..."
                      className="w-full px-3 py-2 pr-10 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {showOpenaiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* PRIMARY & SECONDARY MUTUAL SELECTOR */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Model Priority & Failover</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handlePrimaryChange('gemini')}
                    className={`p-3 rounded-xl border text-left transition ${
                      primary === 'gemini'
                        ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/30'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">Gemini First</span>
                      {primary === 'gemini' && <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">Primary: Gemini → Secondary: OpenAI</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePrimaryChange('openai')}
                    className={`p-3 rounded-xl border text-left transition ${
                      primary === 'openai'
                        ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/30'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">OpenAI First</span>
                      {primary === 'openai' && <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">Primary: OpenAI → Secondary: Gemini</p>
                  </button>
                </div>
              </div>

              {/* Save & Test Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleSave}
                  className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20 flex items-center justify-center gap-2 transition"
                >
                  <Check className="w-4 h-4" />
                  Save Configuration
                </button>
                <button
                  type="button"
                  onClick={handleTestCustom}
                  disabled={testingCustom}
                  className="py-2.5 px-4 rounded-xl text-sm font-semibold border border-indigo-200 dark:border-indigo-800/80 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center gap-2 transition"
                >
                  {testingCustom ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  Check Custom Config
                </button>
              </div>
            </div>
          )}

          {/* Test Results Section */}
          {testResults && (
            <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 animate-in fade-in duration-200">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                Live Connection Test Results
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
                        <span className="font-bold uppercase tracking-wider text-[10px]">{res.provider}: {res.model}</span>
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
            Reset all to Default
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
