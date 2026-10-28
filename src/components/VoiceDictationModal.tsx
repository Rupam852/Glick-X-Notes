import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mic, MicOff, X, Trash2, Copy, Check, Sparkles, 
  Languages, CornerDownLeft, Volume2 
} from 'lucide-react';
import { voiceDictation } from '../utils/audioTools';
import { useToast } from '../contexts/ToastContext';

interface VoiceDictationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (text: string) => void;
}

const SUPPORTED_LANGUAGES = [
  { code: 'en-IN', label: 'English (India)', flag: '🇮🇳' },
  { code: 'hi-IN', label: 'Hindi (हिंदी)', flag: '🇮🇳' },
  { code: 'en-US', label: 'English (US)', flag: '🇺🇸' },
];

export default function VoiceDictationModal({
  isOpen,
  onClose,
  onApply
}: VoiceDictationModalProps) {
  const { showToast } = useToast();
  const [text, setText] = useState('');
  const [interimText, setInterimText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [selectedLang, setSelectedLang] = useState('en-IN');
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Start listening automatically when modal opens
  useEffect(() => {
    if (isOpen) {
      setText('');
      setInterimText('');
      setCopied(false);
      startListening(selectedLang);
    } else {
      stopListening();
    }
    return () => {
      stopListening();
    };
  }, [isOpen]);

  const startListening = (langCode: string) => {
    if (!voiceDictation.isSupported()) {
      showToast('Speech Recognition not supported in this browser. Try Chrome, Edge, or Brave.', 'error');
      return;
    }

    voiceDictation.stop();

    const started = voiceDictation.start(
      (transcript, isFinal) => {
        if (isFinal) {
          const trimmed = transcript.trim();
          if (trimmed) {
            setText(prev => {
              const current = prev.trim();
              return current ? `${current} ${trimmed}` : trimmed;
            });
            setInterimText('');
          }
        } else {
          setInterimText(transcript);
        }
      },
      (error) => {
        console.warn('Voice Dictation Error:', error);
        if (error === 'not-allowed') {
          showToast('Microphone access blocked. Please allow mic permission.', 'error');
        } else if (error !== 'no-speech') {
          showToast(`Microphone error: ${error}`, 'error');
        }
        setIsListening(false);
      },
      () => {
        setIsListening(false);
      },
      langCode
    );

    if (started) {
      setIsListening(true);
    }
  };

  const stopListening = () => {
    voiceDictation.stop();
    setIsListening(false);
    setInterimText('');
  };

  const toggleMic = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening(selectedLang);
    }
  };

  const handleLanguageChange = (code: string) => {
    setSelectedLang(code);
    voiceDictation.setLanguage(code);
    if (isListening) {
      // Restart with new language
      stopListening();
      setTimeout(() => startListening(code), 150);
    }
  };

  const handleClear = () => {
    setText('');
    setInterimText('');
    showToast('Text cleared', 'info');
    textareaRef.current?.focus();
  };

  const handleCopy = () => {
    const fullText = (text + (interimText ? ' ' + interimText : '')).trim();
    if (!fullText) return;
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    showToast('Copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApply = () => {
    const finalText = (text + (interimText ? ' ' + interimText : '')).trim();
    if (!finalText) {
      showToast('No speech or text to insert!', 'error');
      return;
    }
    stopListening();
    onApply(finalText);
    onClose();
  };

  const handleClose = () => {
    stopListening();
    onClose();
  };

  if (!isOpen) return null;

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const charCount = text.length;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === e.currentTarget) handleClose();
        }}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 15 }}
          className="w-full max-w-lg bg-white dark:bg-[#0c1220] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-rose-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
                <Mic className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  Voice Dictation
                  {isListening && (
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-rose-500 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 px-2 py-0.5 rounded-full animate-pulse">
                      <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping" /> Live
                    </span>
                  )}
                </h3>
                <p className="text-[11px] text-slate-400">Speak naturally in English or Hindi</p>
              </div>
            </div>

            <button
              onClick={handleClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-5 space-y-4 overflow-y-auto">
            {/* Language Selection Bar */}
            <div className="flex items-center justify-between bg-slate-100/70 dark:bg-slate-900/70 p-1.5 rounded-xl border border-slate-200/60 dark:border-slate-800/60">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 px-2">
                <Languages className="w-3.5 h-3.5 text-indigo-500" />
                <span>Language:</span>
              </div>
              <div className="flex items-center gap-1">
                {SUPPORTED_LANGUAGES.map(lang => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => handleLanguageChange(lang.code)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      selectedLang === lang.code
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span>{lang.flag}</span>
                    <span>{lang.label.split(' ')[0]}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Live Audio Visualizer Banner */}
            <div className={`p-3 rounded-xl border transition-all flex items-center justify-between ${
              isListening 
                ? 'bg-rose-50/80 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300' 
                : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400'
            }`}>
              <div className="flex items-center gap-2.5">
                <div className={`w-3 h-3 rounded-full ${isListening ? 'bg-rose-500 animate-ping' : 'bg-slate-400'}`} />
                <span className="text-xs font-bold">
                  {isListening ? 'Listening... Speak clearly into your mic' : 'Mic Paused — Click button to speak more or edit text'}
                </span>
              </div>

              {/* Animated Sound Wave Bars */}
              {isListening && (
                <div className="flex items-center gap-1 h-4">
                  <span className="w-1 bg-rose-500 rounded-full animate-pulse h-2" style={{ animationDelay: '0ms' }} />
                  <span className="w-1 bg-rose-500 rounded-full animate-pulse h-4" style={{ animationDelay: '150ms' }} />
                  <span className="w-1 bg-rose-500 rounded-full animate-pulse h-3" style={{ animationDelay: '300ms' }} />
                  <span className="w-1 bg-rose-500 rounded-full animate-pulse h-4" style={{ animationDelay: '75ms' }} />
                  <span className="w-1 bg-rose-500 rounded-full animate-pulse h-2" style={{ animationDelay: '200ms' }} />
                </div>
              )}
            </div>

            {/* Editable Text Area */}
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={isListening ? "Listening... Your speech will appear here in real time. You can edit this text at any time." : "Click the Mic button below and start speaking, or type directly here..."}
                rows={6}
                className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-sm leading-relaxed outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition resize-none placeholder:text-slate-400 font-sans"
              />

              {/* Live interim text preview chip */}
              {interimText && (
                <div className="mt-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-xs flex items-center gap-2 animate-in fade-in duration-150">
                  <Volume2 className="w-3.5 h-3.5 shrink-0 animate-pulse text-indigo-500" />
                  <span className="font-semibold text-slate-400">Hearing:</span>
                  <span className="italic truncate">{interimText}...</span>
                </div>
              )}
            </div>

            {/* Quick Word Counts & Text Reset Buttons */}
            <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
              <div className="flex items-center gap-3">
                <span>{wordCount} words</span>
                <span>•</span>
                <span>{charCount} characters</span>
              </div>

              <div className="flex items-center gap-2">
                {text && (
                  <>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition flex items-center gap-1 cursor-pointer font-medium"
                      title="Copy to clipboard"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleClear}
                      className="px-2.5 py-1 rounded-lg border border-rose-200 dark:border-rose-900/40 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400 transition flex items-center gap-1 cursor-pointer font-medium"
                      title="Clear text"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Clear</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Footer Controls */}
          <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40 flex items-center justify-between gap-3">
            {/* Center / Left Mic Toggle Button */}
            <button
              type="button"
              onClick={toggleMic}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm cursor-pointer ${
                isListening
                  ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/20 animate-pulse'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20'
              }`}
            >
              {isListening ? (
                <>
                  <MicOff className="w-4 h-4" />
                  <span>Pause Mic</span>
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4" />
                  <span>{text ? 'Resume / Speak More' : 'Start Speaking'}</span>
                </>
              )}
            </button>

            {/* Right Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleApply}
                disabled={!text.trim() && !interimText.trim()}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md ${
                  text.trim() || interimText.trim()
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-500/20'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Apply to Note</span>
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
