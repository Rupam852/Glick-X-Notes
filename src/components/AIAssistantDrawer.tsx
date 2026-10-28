import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, X, FileText, Check, Copy, Wand2, MessageSquare, 
  Send, Loader2, ArrowRight, Tag, HelpCircle, RefreshCw, Plus, Mic, MicOff,
  BarChart3, ListChecks, Zap, AlertCircle, CheckCircle2, TrendingUp, Lightbulb,
  Image as ImageIcon, Trash2, Paperclip, CheckCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  aiSummarizeNote, aiPolishText, aiPolishHtml, aiSuggestTitleAndTags, aiAskAboutNote,
  aiNoteAgentChat, aiAnalyzeAndSuperchargeNote, aiGenerateTakeawaysCallout,
  aiGenerateActionChecklist, NoteAuditResult, formatAITextToEditorHtml, sanitizeAIText
} from '../services/aiService';
import { VoiceDictation } from '../utils/audioTools';
import { useToast } from '../contexts/ToastContext';
import { compressImage, CompressedImage } from '../utils/imageTools';

interface AgentChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  action?: 'replace_content' | 'append_content' | 'update_title' | 'none';
  actionContent?: string;
  newTitle?: string;
  applied?: boolean;
  previousContent?: string;
  images?: { dataUrl: string; mimeType: string; name?: string; sizeKb?: number }[];
}

interface AIAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  noteId?: string;
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
  noteId = 'untitled',
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
  const [superchargeRevertHtml, setSuperchargeRevertHtml] = useState<string | null>(null);

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

  // AI Agent Chat State with per-note local caching (Chrome Cache/Storage)
  const defaultWelcomeMessage: AgentChatMessage = { 
    id: 'welcome',
    role: 'assistant', 
    content: 'Hi! Main aapka AI Note Agent hoon. Aap mujhse is note ke baare me detail me sawaal puch sakte hain, handwritten ya textbook photos/screenshots attach kar sakte hain, ya note ko modify/format karne ko keh sakte hain.' 
  };

  const storageKey = `glick_ai_chat_${noteId || 'default'}`;

  const [chatMessages, setChatMessages] = useState<AgentChatMessage[]>([defaultWelcomeMessage]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // Multi-image upload state (Max 6 photos, client-compressed)
  const [attachedImages, setAttachedImages] = useState<CompressedImage[]>([]);
  const [isCompressing, setIsCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll ref and message container
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Copy feedback state
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  // 1. Load Chat History from Chrome LocalStorage when noteId changes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setChatMessages(parsed);
          return;
        }
      }
    } catch (e) {
      console.warn('Failed to load chat history from cache', e);
    }
    setChatMessages([defaultWelcomeMessage]);
    setAttachedImages([]);
  }, [storageKey]);

  // 2. Save Chat History to Chrome LocalStorage whenever chatMessages changes
  useEffect(() => {
    if (!chatMessages || chatMessages.length === 0) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(chatMessages));
    } catch (e) {
      console.warn('Failed to cache chat history to localStorage', e);
    }
  }, [chatMessages, storageKey]);

  // 3. Auto-scroll to bottom smoothly on open, tab switch, or new message/loading
  const scrollToBottom = (smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    }
  };

  useEffect(() => {
    if (activeTab === 'chat' && isOpen) {
      const timer = setTimeout(() => {
        scrollToBottom(false);
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [activeTab, isOpen, noteId]);

  useEffect(() => {
    if (activeTab === 'chat' && isOpen) {
      scrollToBottom(true);
    }
  }, [chatMessages, chatLoading]);

  // 4. Clear chat history for the current note
  const handleClearChat = () => {
    try {
      localStorage.removeItem(storageKey);
    } catch (e) {
      console.warn('Failed to remove chat cache', e);
    }
    setChatMessages([
      {
        id: (Date.now()).toString(),
        role: 'assistant',
        content: 'Hi! Chat history clear ho gayi hai. Aap is note ke baare me naya sawal pooch sakte hain ya photos attach kar sakte hain.'
      }
    ]);
    setAttachedImages([]);
    showToast('Chat history cleared for this note!', 'info');
  };

  // 5. Copy text from any chat bubble
  const handleCopyMessage = (msgId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgId(msgId);
    showToast('Message copied to clipboard!', 'success');
    setTimeout(() => {
      setCopiedMsgId(prev => prev === msgId ? null : prev);
    }, 2000);
  };

  // 6. Handle Image Files (Upload & Clipboard Paste) - Max 6 photos & Compressed
  const handleProcessImageFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (fileArray.length === 0) return;

    if (attachedImages.length + fileArray.length > 6) {
      showToast('Maximum 6 photos allowed in chat at a time!', 'error');
      return;
    }

    setIsCompressing(true);
    try {
      const compressedList: CompressedImage[] = [];
      for (const file of fileArray) {
        const comp = await compressImage(file, { maxWidth: 1024, maxHeight: 1024, quality: 0.72 });
        compressedList.push(comp);
      }
      setAttachedImages(prev => {
        const combined = [...prev, ...compressedList];
        return combined.slice(0, 6);
      });
      showToast(`${compressedList.length} photo(s) compressed & attached!`, 'success');
    } catch (err: any) {
      console.error('Image compression error:', err);
      showToast('Failed to attach photo: ' + (err.message || 'Error'), 'error');
    } finally {
      setIsCompressing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setAttachedImages(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // 7. Clipboard Paste Event Handler (Ctrl+V Screenshots / Photos)
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items || items.length === 0) return;

    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault();
      handleProcessImageFiles(imageFiles);
    }
  };

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
        (finalText, interimText) => {
          const speech = (finalText + (interimText ? ' ' + interimText : '')).trim();
          if (speech) {
            setChatInput(base ? `${base} ${speech}` : speech);
          }
        },
        (err) => {
          console.warn('Voice dictation error:', err);
          if (err !== 'no-speech' && err !== 'aborted') {
            showToast('Mic notice: ' + err, 'error');
          }
          setIsListening(false);
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

  // 4. AI Agent Chat & Note Operations (Text + Vision / Multi-photo support)
  const handleSendMessage = async (e?: React.FormEvent, customPrompt?: string) => {
    if (e) e.preventDefault();
    const userQ = (customPrompt || chatInput).trim();
    if ((!userQ && attachedImages.length === 0) || chatLoading || isCompressing) return;

    if (isListening) {
      dictationRef.current?.stop();
      setIsListening(false);
    }

    const imagesToSend = [...attachedImages];
    setAttachedImages([]);
    setChatInput('');

    const userMsg: AgentChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userQ || (imagesToSend.length > 0 ? `[Sent ${imagesToSend.length} photo(s)]` : ''),
      images: imagesToSend.map(img => ({
        dataUrl: img.dataUrl,
        mimeType: img.mimeType,
        name: img.file.name,
        sizeKb: img.sizeKb
      }))
    };

    const newHistory = [...chatMessages, userMsg];
    setChatMessages(newHistory);
    setChatLoading(true);

    try {
      const imagesPayload = imagesToSend.map(img => ({
        mimeType: img.mimeType,
        data: img.base64
      }));

      const result = await aiNoteAgentChat(
        noteTitle,
        noteHtml || '',
        noteText || '',
        userQ || 'Analyze these attached photo(s) in detail and explain them in relation to my note.',
        chatMessages.map(m => ({ role: m.role, content: m.content })),
        imagesPayload.length > 0 ? imagesPayload : undefined
      );

      // Store previous content for safe undo, but DO NOT auto-apply without user confirmation
      const previous = noteHtml || '';

      const assistantMsg: AgentChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.reply,
        action: result.action,
        actionContent: result.content,
        newTitle: result.newTitle,
        applied: false, // Explicit user confirmation required
        previousContent: previous
      };

      setChatMessages([...newHistory, assistantMsg]);
      if (result.action && result.action !== 'none') {
        showToast('AI recommendation taiyaar hai. Review karke Confirm karein.', 'info');
      }
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

  const handleDismissAgentAction = (msgId: string) => {
    setChatMessages(prev => prev.map(m => m.id === msgId ? { ...m, action: 'none' } : m));
    showToast('Suggestion dismissed. Note remains unchanged.', 'info');
  };

  const handleUndoAgentAction = (msg: AgentChatMessage) => {
    if (msg.previousContent && onReplaceContent) {
      onReplaceContent(msg.previousContent);
      showToast('Changes reverted back to original note!', 'info');
      setChatMessages(prev => prev.map(m => m.id === msg.id ? { ...m, applied: false } : m));
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
                        <div>
                          <span className="font-bold text-slate-700 dark:text-slate-300">Supercharged Executive Layout</span>
                          <span className="block text-[9.5px] text-emerald-600 dark:text-emerald-400 font-medium">✓ 100% full content preserved (Zero sentences cut or shortened)</span>
                        </div>
                        <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">Preview Ready</span>
                      </div>
                      <div 
                        className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 max-h-36 overflow-y-auto text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: auditResult.enhancedHtml }}
                      />
                      {superchargeRevertHtml ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              onReplaceContent(superchargeRevertHtml);
                              setSuperchargeRevertHtml(null);
                              showToast('Reverted back to original note content!', 'info');
                            }}
                            className="w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl flex items-center justify-center gap-1.5 text-xs transition cursor-pointer border border-slate-200 dark:border-slate-800"
                          >
                            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                            ↩ Revert to Original Note
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setSuperchargeRevertHtml(noteHtml || '');
                            onReplaceContent(auditResult.enhancedHtml!);
                            showToast('Full note supercharged! All original content preserved with executive highlights.', 'success');
                          }}
                          className="w-full py-2 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:to-pink-700 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 text-xs shadow-md shadow-indigo-500/20 cursor-pointer transition"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          Apply Supercharged Layout (Full Note Preserved)
                        </button>
                      )}
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
          <div className="flex-1 flex flex-col h-full overflow-hidden" onPaste={handlePaste}>
            {/* Chat Context Subheader & Clear History Button */}
            <div className="px-3.5 py-2 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs shrink-0">
              <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 min-w-0">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
                <span className="text-[11px] font-semibold truncate max-w-[190px]" title={noteTitle || 'Untitled Note'}>
                  {noteTitle || 'Untitled Note'}
                </span>
                <span className="text-[10px] text-slate-400 shrink-0">
                  ({chatMessages.length} msgs)
                </span>
              </div>
              <button
                type="button"
                onClick={handleClearChat}
                className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition cursor-pointer shrink-0"
                title="Clear AI chat history for this note"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Chat</span>
              </button>
            </div>

            {/* Messages list with smooth auto-scroll */}
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3.5">
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
                    {/* Attached Image Thumbnails */}
                    {msg.images && msg.images.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {msg.images.map((img, i) => (
                          <div 
                            key={i} 
                            className="relative group rounded-lg overflow-hidden border border-black/10 dark:border-white/10 shadow-xs cursor-pointer"
                            onClick={() => window.open(img.dataUrl, '_blank')}
                            title="Click to view full photo"
                          >
                            <img 
                              src={img.dataUrl} 
                              alt={img.name || 'attachment'} 
                              className="w-14 h-14 object-cover hover:scale-105 transition duration-150"
                            />
                            {img.sizeKb && (
                              <span className="absolute bottom-0 right-0 bg-black/75 text-[8.5px] text-white px-1 font-mono rounded-tl">
                                {img.sizeKb}KB
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    <p className="whitespace-pre-wrap select-text">{msg.content}</p>

                    {/* Copy Button for every chat bubble */}
                    <div className="flex items-center justify-end mt-1.5 pt-1 border-t border-slate-200/30 dark:border-slate-700/40">
                      <button
                        type="button"
                        onClick={() => handleCopyMessage(msg.id, msg.content)}
                        className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold transition cursor-pointer ${
                          msg.role === 'user'
                            ? 'text-indigo-100 hover:text-white hover:bg-white/15'
                            : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800'
                        }`}
                        title="Copy message text"
                      >
                        {copiedMsgId === msg.id ? (
                          <>
                            <CheckCheck className="w-3 h-3 text-emerald-300" />
                            <span className="text-emerald-300">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* ⚡ Interactive Agent Action Confirmation Card */}
                    {msg.action && msg.action !== 'none' && (
                      <div className={`mt-2.5 p-3 rounded-xl border space-y-2.5 transition-all ${
                        msg.applied 
                          ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60'
                          : 'bg-white dark:bg-slate-950 border-amber-300/80 dark:border-amber-700/60 shadow-xs'
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5" />
                            {msg.action === 'replace_content' && 'Proposed Note Modification'}
                            {msg.action === 'append_content' && 'Proposed Section Addition'}
                            {msg.action === 'update_title' && 'Proposed Title Change'}
                          </span>
                          {msg.applied ? (
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-900/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Check className="w-3 h-3" /> Applied to Note
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-full flex items-center gap-1">
                              Awaiting Confirmation
                            </span>
                          )}
                        </div>

                        {/* Rendered HTML Preview */}
                        {msg.actionContent && (
                          <div className="space-y-1">
                            <span className="text-[9.5px] uppercase tracking-wider font-bold text-slate-400">
                              {msg.applied ? 'Applied Content:' : 'Preview of proposed changes:'}
                            </span>
                            <div 
                              className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-700 dark:text-slate-300 max-h-44 overflow-y-auto leading-relaxed"
                              dangerouslySetInnerHTML={{ __html: msg.actionContent }}
                            />
                          </div>
                        )}

                        {msg.action === 'update_title' && msg.newTitle && (
                          <div className="space-y-1">
                            <span className="text-[9.5px] uppercase tracking-wider font-bold text-slate-400">Proposed New Title:</span>
                            <p className="font-bold text-slate-900 dark:text-white text-xs bg-slate-50 dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                              "{msg.newTitle}"
                            </p>
                          </div>
                        )}

                        {/* Interactive Buttons */}
                        <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                          {msg.applied ? (
                            <>
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex-1">
                                ✓ Note updated safely
                              </span>
                              {msg.previousContent && (
                                <button
                                  type="button"
                                  onClick={() => handleUndoAgentAction(msg)}
                                  className="py-1 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition cursor-pointer border border-slate-200 dark:border-slate-700"
                                  title="Revert note back to before this change"
                                >
                                  <RefreshCw className="w-3 h-3 text-slate-500" /> Revert to Previous
                                </button>
                              )}
                            </>
                          ) : (
                            <div className="flex items-center gap-2 w-full">
                              <button
                                type="button"
                                onClick={() => handleApplyAgentAction(msg)}
                                className="flex-1 py-1.5 px-3 bg-gradient-to-r from-emerald-600 via-indigo-600 to-purple-600 hover:from-emerald-700 hover:to-purple-700 text-white font-bold rounded-lg flex items-center justify-center gap-1.5 text-xs shadow-xs transition cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                                {msg.action === 'replace_content' ? 'Confirm & Apply to Note' : msg.action === 'append_content' ? 'Confirm & Append' : 'Confirm New Title'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDismissAgentAction(msg.id)}
                                className="py-1.5 px-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg text-xs font-semibold transition cursor-pointer border border-slate-200 dark:border-slate-800"
                                title="Dismiss this suggestion"
                              >
                                ✕ Dismiss
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {chatLoading && (
                <div className="flex items-center gap-2 text-xs text-indigo-500 p-2.5 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-xl w-fit border border-indigo-200/50 dark:border-indigo-900/40">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>AI Agent is analyzing note & photos in depth...</span>
                </div>
              )}

              {/* Bottom anchor for smooth auto-scroll */}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Action Chips */}
            <div className="px-3 pt-2 pb-1.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar border-t border-slate-100 dark:border-slate-800 bg-white/70 dark:bg-slate-950/40 shrink-0">
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

            {/* Attached Photos Preview Strip above input box */}
            {attachedImages.length > 0 && (
              <div className="px-3 py-2 bg-slate-100/90 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2.5 overflow-x-auto shrink-0">
                <div className="text-[10px] font-bold text-slate-500 uppercase shrink-0">
                  Photos ({attachedImages.length}/6):
                </div>
                <div className="flex items-center gap-2">
                  {attachedImages.map((img, idx) => (
                    <div key={idx} className="relative group shrink-0 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700 shadow-2xs">
                      <img src={img.dataUrl} alt="preview" className="w-12 h-12 object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(idx)}
                        className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center text-[10px] shadow-xs cursor-pointer"
                        title="Remove photo"
                      >
                        ✕
                      </button>
                      <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[8px] text-center font-mono">
                        {img.sizeKb}KB
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Listening Banner if Speech Recognition is active */}
            {isListening && (
              <div className="px-3 py-1.5 bg-rose-500/10 border-t border-rose-500/20 text-rose-600 dark:text-rose-400 text-[11px] font-bold flex items-center justify-between animate-pulse shrink-0">
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

            {/* Input Bar with Photo Upload, Voice Mic and Paste Support */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 flex items-center gap-2 shrink-0">
              {/* Hidden File Input for photos */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && handleProcessImageFiles(e.target.files)}
              />

              {/* Photo Upload Button (Max 6) */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={attachedImages.length >= 6 || isCompressing || chatLoading}
                className="p-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl transition cursor-pointer shrink-0 disabled:opacity-40 shadow-2xs"
                title={attachedImages.length >= 6 ? 'Maximum 6 photos reached' : 'Attach photo (or Ctrl+V to paste screenshot)'}
              >
                {isCompressing ? (
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                ) : (
                  <ImageIcon className="w-4 h-4" />
                )}
              </button>

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
                onPaste={handlePaste}
                placeholder={
                  isListening 
                    ? 'Listening to your voice...' 
                    : attachedImages.length > 0 
                      ? 'Ask about attached photos or press send...' 
                      : 'Ask question, attach photos or paste screenshots...'
                }
                className="flex-1 px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-indigo-500"
              />

              <button
                type="submit"
                disabled={chatLoading || isCompressing || (!chatInput.trim() && attachedImages.length === 0)}
                className="p-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl transition cursor-pointer shrink-0 shadow-2xs"
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
