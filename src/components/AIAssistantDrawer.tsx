import React, { useState } from 'react';
import { 
  Sparkles, X, FileText, Check, Copy, Wand2, MessageSquare, 
  Send, Loader2, ArrowRight, Tag, HelpCircle, RefreshCw, Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  aiSummarizeNote, aiPolishText, aiPolishHtml, aiSuggestTitleAndTags, aiAskAboutNote,
  formatAITextToEditorHtml, sanitizeAIText
} from '../services/aiService';
import { useToast } from '../contexts/ToastContext';

interface AIAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  noteTitle: string;
  noteText: string;
  noteHtml?: string;
  selectedText?: string;
  selectedHtml?: string;
  onApplyTitle: (newTitle: string) => void;
  onApplyTags: (newTags: string[]) => void;
  onInsertText: (text: string) => void;
  onReplaceContent?: (newHtml: string) => void;
  onReplaceSelection?: (newHtml: string) => void;
}

export default function AIAssistantDrawer({
  isOpen,
  onClose,
  noteTitle,
  noteText,
  noteHtml,
  selectedText,
  selectedHtml,
  onApplyTitle,
  onApplyTags,
  onInsertText,
  onReplaceContent,
  onReplaceSelection
}: AIAssistantDrawerProps) {
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'tools' | 'chat'>('tools');

  // Loading States
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryResult, setSummaryResult] = useState<string | null>(null);

  const [selectedTone, setSelectedTone] = useState<'professional' | 'casual' | 'concise'>('professional');
  const [loadingPolish, setLoadingPolish] = useState(false);
  const [polishResult, setPolishResult] = useState<string | null>(null);

  const hasSelection = Boolean((selectedHtml && selectedHtml.trim()) || (selectedText && selectedText.trim()));
  const [polishScope, setPolishScope] = useState<'selection' | 'full'>('full');

  React.useEffect(() => {
    if (hasSelection) {
      setPolishScope('selection');
    } else {
      setPolishScope('full');
    }
  }, [hasSelection, isOpen]);

  const [loadingMeta, setLoadingMeta] = useState(false);
  const [suggestedMeta, setSuggestedMeta] = useState<{ title: string; tags: string[] } | null>(null);

  // Chat State
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([
    { role: 'assistant', content: 'Hi! Ask me anything about your current note, ideas, or action items.' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  if (!isOpen) return null;

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`${label} copied to clipboard!`, 'success');
  };

  // 1. Generate Summary
  const handleSummarize = async () => {
    if (!noteText.trim()) {
      showToast('Note is empty! Write some content first.', 'error');
      return;
    }
    setLoadingSummary(true);
    setSummaryResult(null);
    try {
      const summary = await aiSummarizeNote(noteText);
      setSummaryResult(summary);
      showToast('Summary generated!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to generate summary', 'error');
    } finally {
      setLoadingSummary(false);
    }
  };

  // 2. Polish Text with Bold, Styles, and Snippets 100% Preserved
  const handlePolish = async () => {
    const isSelection = polishScope === 'selection' && hasSelection;
    const targetHtml = isSelection ? (selectedHtml || selectedText || '') : (noteHtml || noteText || '');
    const plainFallback = isSelection ? (selectedText || '') : (noteText || '');

    if (!targetHtml.trim() && !plainFallback.trim()) {
      showToast('No content to polish! Write or select some text first.', 'error');
      return;
    }

    setLoadingPolish(true);
    setPolishResult(null);
    try {
      const polished = await aiPolishHtml(targetHtml || plainFallback, selectedTone);
      setPolishResult(polished);
      showToast(`Polished in ${selectedTone} tone with styles & snippets preserved!`, 'success');
    } catch (err: any) {
      try {
        const fallback = await aiPolishText(plainFallback, selectedTone);
        setPolishResult(fallback);
        showToast(`Polished text in ${selectedTone} tone!`, 'success');
      } catch (innerErr: any) {
        showToast(err.message || 'Failed to polish text', 'error');
      }
    } finally {
      setLoadingPolish(false);
    }
  };

  // 3. Suggest Title & Tags
  const handleSuggestMeta = async () => {
    if (!noteText.trim()) {
      showToast('Note is empty! Write some content first.', 'error');
      return;
    }
    setLoadingMeta(true);
    setSuggestedMeta(null);
    try {
      const meta = await aiSuggestTitleAndTags(noteText);
      setSuggestedMeta(meta);
      showToast('Title & tags suggested!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to suggest metadata', 'error');
    } finally {
      setLoadingMeta(false);
    }
  };

  // 4. Chat about note
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const userQ = chatInput.trim();
    setChatInput('');
    const newHistory = [...chatMessages, { role: 'user' as const, content: userQ }];
    setChatMessages(newHistory);
    setChatLoading(true);

    try {
      const reply = await aiAskAboutNote(noteText, userQ, chatMessages);
      setChatMessages([...newHistory, { role: 'assistant', content: reply }]);
    } catch (err: any) {
      showToast(err.message || 'All AI models failed to respond', 'error');
      setChatMessages([
        ...newHistory, 
        { role: 'assistant', content: `⚠️ ${err.message || 'Could not answer question. Please check AI settings.'}` }
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-md bg-white dark:bg-[#0c1220] border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-200 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">AI Writing Assistant</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Powered by Glick Intelligence Engine</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 p-1 m-4 mb-2 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs font-bold">
          <button
            onClick={() => setActiveTab('tools')}
            className={`py-2 rounded-lg flex items-center justify-center gap-2 transition ${
              activeTab === 'tools' 
                ? 'bg-white dark:bg-[#1a2333] text-indigo-600 dark:text-indigo-400 shadow-xs' 
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Wand2 className="w-3.5 h-3.5" />
            AI Tools
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`py-2 rounded-lg flex items-center justify-center gap-2 transition ${
              activeTab === 'chat' 
                ? 'bg-white dark:bg-[#1a2333] text-indigo-600 dark:text-indigo-400 shadow-xs' 
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Ask AI
          </button>
        </div>

        {/* TAB 1: AI TOOLS */}
        {activeTab === 'tools' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            
            {/* TOOL 1: AUTO TITLE & TAGS */}
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-purple-500" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Smart Title & Tags</span>
                </div>
                <button
                  onClick={handleSuggestMeta}
                  disabled={loadingMeta}
                  className="px-2.5 py-1 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition flex items-center gap-1 shadow-xs"
                >
                  {loadingMeta ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  Suggest
                </button>
              </div>

              {suggestedMeta && (
                <div className="p-3 rounded-lg bg-white dark:bg-slate-950 border border-purple-200 dark:border-purple-900/50 space-y-2 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Title</span>
                    <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">{suggestedMeta.title}</p>
                  </div>
                  {suggestedMeta.tags.length > 0 && (
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Tags</span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {suggestedMeta.tags.map((t, i) => (
                          <span key={i} className="px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 text-[10px] font-semibold">
                            #{t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <button
                    onClick={() => {
                      onApplyTitle(suggestedMeta.title);
                      onApplyTags(suggestedMeta.tags);
                      showToast('Applied title and tags to your note!', 'success');
                    }}
                    className="w-full py-1.5 mt-1 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-md flex items-center justify-center gap-1 text-[11px]"
                  >
                    <Check className="w-3 h-3" />
                    Apply to Note
                  </button>
                </div>
              )}
            </div>

            {/* TOOL 2: SUMMARY & BULLET POINTS */}
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-500" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Summary & Key Points</span>
                </div>
                <button
                  onClick={handleSummarize}
                  disabled={loadingSummary}
                  className="px-2.5 py-1 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition flex items-center gap-1 shadow-xs"
                >
                  {loadingSummary ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  Summarize
                </button>
              </div>

              {summaryResult && (
                <div className="p-3 rounded-lg bg-white dark:bg-slate-950 border border-indigo-200 dark:border-indigo-900/50 space-y-2 text-xs">
                  <div className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                    {summaryResult}
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={() => handleCopy(summaryResult, 'Summary')}
                      className="flex-1 py-1 px-2 border border-slate-200 dark:border-slate-800 rounded-md text-[11px] font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 flex items-center justify-center gap-1"
                    >
                      <Copy className="w-3 h-3" /> Copy
                    </button>
                    <button
                      onClick={() => {
                        const summaryHtml = `<div style="margin-top: 16px; margin-bottom: 16px; padding: 14px 16px; border-radius: 12px; background: rgba(99, 102, 241, 0.08); border-left: 4px solid #6366f1;"><p style="font-weight: 700; color: #6366f1; margin-bottom: 6px;">📝 AI Summary</p>${formatAITextToEditorHtml(summaryResult)}</div>`;
                        onInsertText(summaryHtml);
                        showToast('Inserted summary into note!', 'success');
                      }}
                      className="flex-1 py-1 px-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-[11px] font-semibold flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Append to Note
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* TOOL 3: GRAMMAR, STYLE & SNIPPET POLISHER */}
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wand2 className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Polish & Fix Style</span>
                </div>
                <button
                  onClick={handlePolish}
                  disabled={loadingPolish}
                  className="px-2.5 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition flex items-center gap-1 shadow-xs cursor-pointer"
                >
                  {loadingPolish ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  {polishScope === 'selection' && hasSelection ? 'Polish Selection' : 'Polish Note'}
                </button>
              </div>

              {/* Scope Selector (Only visible if editor has text or snippet selected) */}
              {hasSelection && (
                <div className="flex items-center gap-1.5 p-1 bg-slate-200/60 dark:bg-slate-950/60 rounded-lg text-xs">
                  <button
                    type="button"
                    onClick={() => { setPolishScope('selection'); setPolishResult(null); }}
                    className={`flex-1 py-1 px-2 rounded-md font-bold text-[11px] transition ${
                      polishScope === 'selection'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    ✨ Selected Snippet
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPolishScope('full'); setPolishResult(null); }}
                    className={`flex-1 py-1 px-2 rounded-md font-bold text-[11px] transition ${
                      polishScope === 'full'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    📄 Full Note
                  </button>
                </div>
              )}

              {/* Tone Selector */}
              <div className="grid grid-cols-3 gap-1.5">
                {(['professional', 'casual', 'concise'] as const).map(tone => (
                  <button
                    key={tone}
                    onClick={() => setSelectedTone(tone)}
                    className={`py-1 text-[11px] font-semibold rounded-md capitalize transition cursor-pointer ${
                      selectedTone === tone
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {tone}
                  </button>
                ))}
              </div>

              {polishResult && (
                <div className="p-3 rounded-lg bg-white dark:bg-slate-950 border border-emerald-200 dark:border-emerald-900/50 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Preview (Bolds & Snippets Intact)</span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">Ready to apply</span>
                  </div>
                  
                  {/* Rendered HTML preview preserving bold styles, tables, code, and snippets */}
                  <div 
                    className="text-slate-800 dark:text-slate-200 leading-relaxed max-h-52 overflow-y-auto p-2.5 rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 text-xs"
                    dangerouslySetInnerHTML={{ __html: polishResult }}
                  />

                  <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={() => {
                        const temp = document.createElement('div');
                        temp.innerHTML = polishResult;
                        handleCopy(temp.textContent || temp.innerText || polishResult, 'Polished text');
                      }}
                      className="flex-1 py-1 px-2 border border-slate-200 dark:border-slate-800 rounded-md text-[11px] font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Copy className="w-3 h-3" /> Copy
                    </button>

                    {polishScope === 'selection' && hasSelection && onReplaceSelection && (
                      <button
                        onClick={() => {
                          onReplaceSelection(polishResult);
                          onClose();
                          showToast('Replaced selected snippet with polished version!', 'success');
                        }}
                        className="flex-1 py-1 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                      >
                        <Check className="w-3 h-3" /> Replace Selection
                      </button>
                    )}

                    {onReplaceContent && (
                      <button
                        onClick={() => {
                          onReplaceContent(polishResult);
                          onClose();
                          showToast('Replaced note with polished version (styles intact)!', 'success');
                        }}
                        className="flex-1 py-1 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                      >
                        <Check className="w-3 h-3" /> {polishScope === 'selection' && hasSelection ? 'Replace All' : 'Replace Note'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

        {/* TAB 2: CHAT WITH NOTE */}
        {activeTab === 'chat' && (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Messages list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages.map((msg, idx) => (
                <div 
                  key={idx}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div 
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-tr-xs'
                        : 'bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-800 rounded-tl-xs'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex items-center gap-2 text-xs text-indigo-500 p-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Analyzing note...
                </div>
              )}
            </div>

            {/* Input Bar */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 flex items-center gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask about this note..."
                className="flex-1 px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={chatLoading || !chatInput.trim()}
                className="p-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl transition cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}
