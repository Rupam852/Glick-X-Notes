import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, X, FileText, Check, Copy, Wand2, MessageSquare, 
  Send, Loader2, ArrowRight, Tag, HelpCircle, RefreshCw, Plus, Mic, MicOff,
  BarChart3, ListChecks, Zap, AlertCircle, CheckCircle2, TrendingUp, Lightbulb
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  aiSummarizeNote, aiPolishText, aiPolishHtml, aiSuggestTitleAndTags, aiAskAboutNote,
  aiNoteAgentChat, aiAnalyzeAndSuperchargeNote, aiGenerateTakeawaysCallout,
  aiGenerateActionChecklist, NoteAuditResult, formatAITextToEditorHtml, sanitizeAIText
} from '../services/aiService';
import { VoiceDictation } from '../utils/audioTools';
import { useToast } from '../contexts/ToastContext';

interface AgentChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  action?: 'replace_content' | 'append_content' | 'update_title' | 'none';
  actionContent?: string;
  newTitle?: string;
  applied?: boolean;
}

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

  // Deep Note Audit & Supercharge State
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditResult, setAuditResult] = useState<NoteAuditResult | null>(null);
  const [loadingTakeaways, setLoadingTakeaways] = useState(false);
  const [loadingActionChecklist, setLoadingActionChecklist] = useState(false);

  const hasSelection = Boolean((selectedHtml && selectedHtml.trim()) || (selectedText && selectedText.trim()));
  const [polishScope, setPolishScope] = useState<'selection' | 'full'>('full');

  useEffect(() => {
    if (hasSelection) {
      setPolishScope('selection');
    } else {
      setPolishScope('full');
    }
  }, [hasSelection, isOpen]);

  const [loadingMeta, setLoadingMeta] = useState(false);
  const [suggestedMeta, setSuggestedMeta] = useState<{ title: string; tags: string[] } | null>(null);

  // AI Agent Chat State
  const [chatMessages, setChatMessages] = useState<AgentChatMessage[]>([
    { 
      id: 'welcome',
      role: 'assistant', 
      content: 'Hi! Main aapka AI Note Agent hoon. Aap mujhse is note ke baare me sawaal puch sakte hain, ya bol kar / likh kar is note ko modify, edit ya naye sections add karne ko keh sakte hain.' 
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // Voice Dictation (Speech-to-Text) for AI Chat
  const [isListening, setIsListening] = useState(false);
  const dictationRef = useRef<VoiceDictation | null>(null);

  useEffect(() => {
    dictationRef.current = new VoiceDictation();
    return () => {
      dictationRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    if (!isOpen && isListening) {
      dictationRef.current?.stop();
      setIsListening(false);
    }
  }, [isOpen, isListening]);

  const toggleVoiceInput = () => {
    if (!dictationRef.current) return;
    if (isListening) {
      dictationRef.current.stop();
      setIsListening(false);
      showToast('Mic stopped', 'info');
    } else {
      const base = chatInput.trim();
      const started = dictationRef.current.start(
        (transcript) => {
          if (transcript) {
            setChatInput(base ? `${base} ${transcript}` : transcript);
          }
        },
        (err) => {
          console.warn('Voice dictation error:', err);
          setIsListening(false);
          showToast('Mic error: ' + err, 'error');
        },
        () => {
          setIsListening(false);
        },
        'en-IN'
      );

      if (started) {
        setIsListening(true);
        showToast('Listening... Bolna shuru karein!', 'success');
      } else {
        showToast('Speech recognition not supported in this browser', 'error');
      }
    }
  };

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

  // 4. Deep Note Audit & Executive Supercharge
  const handleRunAudit = async () => {
    if (!noteText.trim()) {
      showToast('Note is empty! Write some content first.', 'error');
      return;
    }
    setLoadingAudit(true);
    setAuditResult(null);
    try {
      const res = await aiAnalyzeAndSuperchargeNote(noteTitle, noteHtml || '', noteText);
      setAuditResult(res);
      showToast(`Audit complete! Score: ${res.score}/100 (${res.scoreLabel})`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Deep Audit failed', 'error');
    } finally {
      setLoadingAudit(false);
    }
  };

  // 5. Insert Key Takeaways Callout Card
  const handleInsertTakeaways = async () => {
    if (!noteText.trim()) {
      showToast('Note is empty!', 'error');
      return;
    }
    setLoadingTakeaways(true);
    try {
      const html = await aiGenerateTakeawaysCallout(noteTitle, noteText);
      onInsertText(html);
      showToast('Inserted Key Takeaways Callout into note!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to generate takeaways', 'error');
    } finally {
      setLoadingTakeaways(false);
    }
  };

  // 6. Insert Action Items Checklist
  const handleInsertChecklist = async () => {
    if (!noteText.trim()) {
      showToast('Note is empty!', 'error');
      return;
    }
    setLoadingActionChecklist(true);
    try {
      const html = await aiGenerateActionChecklist(noteTitle, noteText);
      onInsertText(html);
      showToast('Inserted Action Items Checklist into note!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to generate checklist', 'error');
    } finally {
      setLoadingActionChecklist(false);
    }
  };

  // 4. AI Agent Chat & Note Operations
  const handleSendMessage = async (e?: React.FormEvent, customPrompt?: string) => {
    if (e) e.preventDefault();
    const userQ = (customPrompt || chatInput).trim();
    if (!userQ || chatLoading) return;

    if (isListening) {
      dictationRef.current?.stop();
      setIsListening(false);
    }

    setChatInput('');
    const userMsg: AgentChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userQ
    };
    const newHistory = [...chatMessages, userMsg];
    setChatMessages(newHistory);
    setChatLoading(true);

    try {
      const result = await aiNoteAgentChat(
        noteTitle,
        noteHtml || '',
        noteText || '',
        userQ,
        chatMessages.map(m => ({ role: m.role, content: m.content }))
      );

      const assistantMsg: AgentChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.reply,
        action: result.action,
        actionContent: result.content,
        newTitle: result.newTitle,
        applied: false
      };

      setChatMessages([...newHistory, assistantMsg]);
    } catch (err: any) {
      showToast(err.message || 'AI Agent failed to respond', 'error');
      setChatMessages([
        ...newHistory, 
        { 
          id: (Date.now() + 1).toString(),
          role: 'assistant', 
          content: `⚠️ ${err.message || 'Could not process request. Please check AI API settings.'}`,
          action: 'none'
        }
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleApplyAgentAction = (msg: AgentChatMessage) => {
    if (msg.action === 'replace_content' && msg.actionContent && onReplaceContent) {
      onReplaceContent(msg.actionContent);
      showToast('Note updated with AI modifications (styles & snippets preserved)!', 'success');
    } else if (msg.action === 'append_content' && msg.actionContent) {
      onInsertText(msg.actionContent);
      showToast('Appended new section to your note!', 'success');
    } else if (msg.action === 'update_title' && msg.newTitle) {
      onApplyTitle(msg.newTitle);
      showToast(`Updated note title to "${msg.newTitle}"!`, 'success');
    }

    setChatMessages(prev => prev.map(m => m.id === msg.id ? { ...m, applied: true } : m));
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

        {/* TAB 1: AI TOOLS & DEEP NOTE INTELLIGENCE */}
        {activeTab === 'tools' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            
            {/* 🌟 HERO: DEEP NOTE AUDIT & 1-CLICK SUPERCHARGER */}
            <div className="p-4 rounded-2xl border border-indigo-200/80 dark:border-indigo-900/60 bg-gradient-to-br from-indigo-50/70 via-purple-50/40 to-white dark:from-[#11192e] dark:via-[#0e1628] dark:to-slate-950 space-y-3.5 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">Deep Note Audit & Intelligence</h4>
                    <p className="text-[10px] text-slate-500">Quality score, gap analysis & 1-click upgrade</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRunAudit}
                  disabled={loadingAudit}
                  className="px-3 py-1.5 text-xs font-bold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  {loadingAudit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {auditResult ? 'Re-Audit' : 'Audit Note'}
                </button>
              </div>

              {/* AUDIT REPORT */}
              {auditResult && (
                <div className="p-3.5 rounded-xl bg-white dark:bg-slate-950 border border-indigo-100 dark:border-indigo-900/50 space-y-3 animate-in fade-in duration-200">
                  {/* Score & Badge */}
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center font-black text-xs shadow-xs ${
                        auditResult.score >= 85 
                          ? 'bg-emerald-500 text-white' 
                          : auditResult.score >= 70 
                          ? 'bg-indigo-600 text-white' 
                          : 'bg-amber-500 text-white'
                      }`}>
                        <span>{auditResult.score}</span>
                        <span className="text-[7px] font-bold opacity-80 uppercase leading-none">/ 100</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Note Quality</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                            {auditResult.scoreLabel}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400">Analysis of clarity, structure & actionability</p>
                      </div>
                    </div>
                  </div>

                  {/* Improvements & Strengths */}
                  <div className="space-y-2 text-xs">
                    {auditResult.improvements.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1">
                          <Lightbulb className="w-3 h-3" /> Gaps & Recommended Fixes:
                        </span>
                        <ul className="space-y-1 pl-1">
                          {auditResult.improvements.map((imp, idx) => (
                            <li key={idx} className="text-[11px] text-slate-600 dark:text-slate-300 flex items-start gap-1.5">
                              <span className="text-amber-500 font-bold shrink-0">•</span>
                              <span>{imp}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {auditResult.strengths.length > 0 && (
                      <div className="space-y-1 pt-1.5 border-t border-slate-100 dark:border-slate-900">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Note Strengths:
                        </span>
                        <ul className="space-y-1 pl-1">
                          {auditResult.strengths.map((str, idx) => (
                            <li key={idx} className="text-[11px] text-slate-600 dark:text-slate-300 flex items-start gap-1.5">
                              <span className="text-emerald-500 font-bold shrink-0">✓</span>
                              <span>{str}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* 1-Click Supercharge Upgrade Button */}
                  {auditResult.enhancedHtml && onReplaceContent && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-slate-700 dark:text-slate-300">Supercharged Executive Layout</span>
                        <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">Ready to apply</span>
                      </div>
                      <div 
                        className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 max-h-36 overflow-y-auto text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: auditResult.enhancedHtml }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          onReplaceContent(auditResult.enhancedHtml!);
                          showToast('Note supercharged with executive structure!', 'success');
                        }}
                        className="w-full py-2 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:to-pink-700 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 text-xs shadow-md shadow-indigo-500/20 cursor-pointer transition"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        Apply Supercharged Layout to Note
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ⚡ SMART 1-CLICK SOLUTIONS GRID */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Quick Smart Enhancements</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleInsertTakeaways}
                  disabled={loadingTakeaways}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 hover:border-indigo-400 dark:hover:border-indigo-600 transition flex flex-col items-start gap-1.5 text-left group cursor-pointer shadow-2xs"
                >
                  <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition">
                    {loadingTakeaways ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lightbulb className="w-3.5 h-3.5" />}
                  </div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Key Takeaways</span>
                  <span className="text-[10px] text-slate-400 leading-tight">Embed styled highlights callout box</span>
                </button>

                <button
                  type="button"
                  onClick={handleInsertChecklist}
                  disabled={loadingActionChecklist}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 hover:border-emerald-400 dark:hover:border-emerald-600 transition flex flex-col items-start gap-1.5 text-left group cursor-pointer shadow-2xs"
                >
                  <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition">
                    {loadingActionChecklist ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ListChecks className="w-3.5 h-3.5" />}
                  </div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Action Checklist</span>
                  <span className="text-[10px] text-slate-400 leading-tight">Extract & append task checklist</span>
                </button>
              </div>
            </div>

            {/* SMART TITLE & TAGS */}
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-purple-500" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Smart Title & Tags</span>
                </div>
                <button
                  onClick={handleSuggestMeta}
                  disabled={loadingMeta}
                  className="px-2.5 py-1 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition flex items-center gap-1 shadow-xs cursor-pointer"
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
                    className="w-full py-1.5 mt-1 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-md flex items-center justify-center gap-1 text-[11px] cursor-pointer"
                  >
                    <Check className="w-3 h-3" />
                    Apply to Note
                  </button>
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

        {/* TAB 2: AI NOTE AGENT CHAT */}
        {activeTab === 'chat' && (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Messages list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
              {chatMessages.map((msg) => (
                <div 
                  key={msg.id}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div 
                    className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-tr-xs shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-800 rounded-tl-xs space-y-2'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>

                    {/* ⚡ Interactive Agent Action Card */}
                    {msg.action && msg.action !== 'none' && (
                      <div className="mt-2 p-2.5 rounded-xl bg-white dark:bg-slate-950 border border-indigo-200/90 dark:border-indigo-900/60 space-y-2 shadow-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            {msg.action === 'replace_content' && 'Proposed Note Modification'}
                            {msg.action === 'append_content' && 'New Section to Add'}
                            {msg.action === 'update_title' && 'Proposed Note Title'}
                          </span>
                          {msg.applied && (
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                              <Check className="w-2.5 h-2.5" /> Applied
                            </span>
                          )}
                        </div>

                        {/* Rendered HTML Preview */}
                        {msg.actionContent && (
                          <div 
                            className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-700 dark:text-slate-300 max-h-36 overflow-y-auto leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: msg.actionContent }}
                          />
                        )}

                        {msg.action === 'update_title' && msg.newTitle && (
                          <p className="font-bold text-slate-900 dark:text-white text-xs bg-slate-50 dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                            "{msg.newTitle}"
                          </p>
                        )}

                        {/* 1-Click Apply Button */}
                        {!msg.applied ? (
                          <button
                            type="button"
                            onClick={() => handleApplyAgentAction(msg)}
                            className="w-full py-1.5 px-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-lg flex items-center justify-center gap-1.5 text-xs shadow-xs transition cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            {msg.action === 'replace_content' ? 'Apply Changes to Note' : msg.action === 'append_content' ? 'Append to Note' : 'Update Note Title'}
                          </button>
                        ) : (
                          <div className="w-full py-1 text-center text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                            ✓ Note successfully updated by AI Agent
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex items-center gap-2 text-xs text-indigo-500 p-2 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-xl w-fit border border-indigo-200/50 dark:border-indigo-900/40">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  AI Agent is reading & preparing modifications...
                </div>
              )}
            </div>

            {/* Quick Action Chips */}
            <div className="px-3 pt-2 pb-1.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar border-t border-slate-100 dark:border-slate-800 bg-white/70 dark:bg-slate-950/40">
              {[
                '✨ Fix grammar & bold key points',
                '➕ Add Conclusion',
                '📊 Add 3x3 Table',
                '📋 3 Action Items',
                '🏷️ Better Title'
              ].map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendMessage(undefined, chip)}
                  disabled={chatLoading}
                  className="shrink-0 text-[10px] font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/60 dark:hover:text-indigo-400 transition cursor-pointer border border-slate-200/60 dark:border-slate-800"
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Listening Banner if Speech Recognition is active */}
            {isListening && (
              <div className="px-3 py-1.5 bg-rose-500/10 border-t border-rose-500/20 text-rose-600 dark:text-rose-400 text-[11px] font-bold flex items-center justify-between animate-pulse">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  <span>Listening... Bolna shuru karein (Hindi ya English)</span>
                </div>
                <button
                  type="button"
                  onClick={toggleVoiceInput}
                  className="text-[10px] uppercase underline cursor-pointer hover:text-rose-700"
                >
                  Done
                </button>
              </div>
            )}

            {/* Input Bar with Voice Mic */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 flex items-center gap-2">
              {/* Microphone Button (Speech-to-Text) */}
              <button
                type="button"
                onClick={toggleVoiceInput}
                className={`p-2 rounded-xl transition cursor-pointer shrink-0 ${
                  isListening
                    ? 'bg-rose-600 text-white animate-pulse shadow-md shadow-rose-500/30'
                    : 'bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 shadow-2xs'
                }`}
                title={isListening ? 'Stop Listening' : 'Speak to AI Agent (Bol kar batayein)'}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={isListening ? 'Listening to your voice...' : 'Ask question or instruct to edit note (text or mic)...'}
                className="flex-1 px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-indigo-500"
              />

              <button
                type="submit"
                disabled={chatLoading || !chatInput.trim()}
                className="p-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl transition cursor-pointer shrink-0 shadow-2xs"
                title="Send instruction to AI Agent"
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
