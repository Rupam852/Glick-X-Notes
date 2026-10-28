import React, { useState, useEffect, useRef } from 'react';
import mermaid from 'mermaid';
import { X, Sparkles, Loader2, Play, Check, Copy, RefreshCw, GitFork, Network } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { aiGenerateMermaidDiagram } from '../services/aiService';

interface MermaidModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertDiagram: (code: string, svg: string) => void;
  initialCode?: string;
  noteContext?: string;
}

const PRESETS = [
  {
    name: 'Flowchart (Process)',
    code: `graph TD
  Start([Start]) --> Input[/Enter User Credentials/]
  Input --> Verify{Is Password Valid?}
  Verify -- Yes --> Access[Grant Access & Load Dashboard]
  Verify -- No --> Retry[Show Error & Retry]
  Retry --> Input
  Access --> End([End])`
  },
  {
    name: 'Mindmap (Concept)',
    code: `mindmap
  root((NumPy Library))
    Core Data Structure
      ndarray (Multi-dimensional)
      Vectorization
      Broadcasting
    Mathematical Operations
      Linear Algebra
      Fourier Transform
      Random Sampling
    Integration
      Pandas
      SciPy
      Matplotlib`
  },
  {
    name: 'Sequence (API Call)',
    code: `sequenceDiagram
  autonumber
  actor User
  participant Client as Glick Notes
  participant AI as Gemini 3.5 Flash
  participant DB as Firestore DB

  User->>Client: Request Note Analysis
  Client->>AI: Send HTML context & instruction
  AI-->>Client: Return JSON with recommendations
  Client->>DB: Sync updated document
  Client-->>User: Display rich visual results`
  },
  {
    name: 'Architecture (Hierarchy)',
    code: `graph LR
  subgraph Frontend [React + Vite]
    UI[Editor UI]
    State[Local History]
  end
  subgraph Cloud [Google Firebase]
    Auth[Firebase Auth]
    Store[(Firestore DB)]
  end
  subgraph Intelligence [Google GenAI]
    Gemini[Gemini 3.5 Flash Model]
  end

  UI --> State
  UI --> Auth
  UI --> Store
  UI --> Gemini`
  }
];

export default function MermaidModal({
  isOpen,
  onClose,
  onInsertDiagram,
  initialCode,
  noteContext
}: MermaidModalProps) {
  const [code, setCode] = useState(initialCode || PRESETS[0].code);
  const [svgOutput, setSvgOutput] = useState('');
  const [renderError, setRenderError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);

  // AI prompt state
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  // Initialize mermaid
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose',
      fontFamily: 'Inter, system-ui, sans-serif'
    });
  }, []);

  useEffect(() => {
    if (initialCode) {
      setCode(initialCode);
    }
  }, [initialCode]);

  // Live render diagram
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const renderDiagram = async () => {
      if (!code.trim()) {
        setSvgOutput('');
        setRenderError(null);
        return;
      }

      setIsRendering(true);
      setRenderError(null);

      try {
        const id = `mermaid-svg-${Date.now()}`;
        const { svg } = await mermaid.render(id, code.trim());
        if (isMounted) {
          setSvgOutput(svg);
          setRenderError(null);
        }
      } catch (err: any) {
        if (isMounted) {
          setRenderError(err.message || 'Invalid Mermaid syntax');
        }
      } finally {
        if (isMounted) {
          setIsRendering(false);
        }
      }
    };

    const timeout = setTimeout(renderDiagram, 300);
    return () => {
      isMounted = false;
      clearTimeout(timeout);
    };
  }, [code, isOpen]);

  const handleGenerateAI = async () => {
    if (!aiPrompt.trim() || isGeneratingAI) return;
    setIsGeneratingAI(true);
    try {
      const generated = await aiGenerateMermaidDiagram(aiPrompt, noteContext);
      if (generated && generated.trim()) {
        setCode(generated.trim());
        setAiPrompt('');
      }
    } catch (err: any) {
      setRenderError(err.message || 'AI generation failed');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleInsert = () => {
    if (!svgOutput) return;
    onInsertDiagram(code, svgOutput);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400">
              <GitFork className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-850 dark:text-white flex items-center gap-2">
                Flowchart & Mindmap Visualizer
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300">
                  Interactive Diagram
                </span>
              </h3>
              <p className="text-xs text-slate-400">Build flowcharts, process maps & concept trees visually or with AI</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* AI Quick Generator Bar */}
        <div className="px-6 py-2.5 bg-gradient-to-r from-sky-50/80 via-indigo-50/50 to-purple-50/80 dark:from-slate-900 dark:via-indigo-950/20 dark:to-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
          <input
            type="text"
            placeholder="AI Prompt (e.g. 'Flowchart of user signup verification' or 'Mindmap of machine learning models')..."
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGenerateAI()}
            className="flex-1 bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
          <button
            type="button"
            onClick={handleGenerateAI}
            disabled={!aiPrompt.trim() || isGeneratingAI}
            className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shrink-0 cursor-pointer shadow-xs"
          >
            {isGeneratingAI ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            Generate with AI
          </button>
        </div>

        {/* Presets Bar */}
        <div className="px-6 py-2 border-b border-slate-100 dark:border-slate-800/60 flex items-center gap-1.5 overflow-x-auto no-scrollbar bg-slate-50/30 dark:bg-slate-950/20">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0 mr-1">Presets:</span>
          {PRESETS.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setCode(p.code)}
              className="text-xs px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 hover:border-sky-400 dark:hover:border-sky-600 text-slate-700 dark:text-slate-300 font-medium transition shrink-0 cursor-pointer"
            >
              {p.name}
            </button>
          ))}
        </div>

        {/* Modal Body: Two columns (Editor Left, Live Preview Right) */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100 dark:divide-slate-800 overflow-hidden min-h-[350px]">
          {/* Left Column: Mermaid Code Editor */}
          <div className="flex flex-col p-4 space-y-2 overflow-hidden bg-slate-900 text-slate-100">
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span className="flex items-center gap-1 font-bold text-sky-400">
                <span>&lt;/&gt;</span> Mermaid Code Editor
              </span>
              <span>Live Updates</span>
            </div>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter mermaid code here (e.g. graph TD ...)"
              className="flex-1 w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-sky-200 leading-relaxed outline-none focus:border-sky-500 resize-none"
              spellCheck={false}
            />
            {renderError && (
              <div className="p-2 rounded-lg bg-rose-950/40 border border-rose-800/60 text-rose-300 text-[11px] font-mono leading-tight max-h-20 overflow-y-auto">
                ⚠️ {renderError}
              </div>
            )}
          </div>

          {/* Right Column: Live Rendered SVG Diagram */}
          <div className="flex flex-col p-4 space-y-2 overflow-hidden bg-white dark:bg-slate-950">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <Network className="w-3.5 h-3.5 text-sky-500" /> Live Interactive Preview
              </span>
              {isRendering && <span className="text-[10px] text-sky-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Rendering...</span>}
            </div>

            <div className="flex-1 border border-slate-200 dark:border-slate-800 rounded-xl p-4 overflow-auto flex items-center justify-center bg-slate-50/60 dark:bg-slate-900/40 relative">
              {svgOutput ? (
                <div 
                  className="w-full h-full flex items-center justify-center [&_svg]:max-w-full [&_svg]:max-h-full [&_svg]:h-auto"
                  dangerouslySetInnerHTML={{ __html: svgOutput }}
                />
              ) : (
                <p className="text-xs text-slate-400">Type or select a preset to render diagram...</p>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <span className="text-xs text-slate-400 font-medium">
            Embeds full responsive SVG with edit & copy capabilities into your note
          </span>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleInsert}
              disabled={!svgOutput || Boolean(renderError)}
              className="px-5 py-2 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              Insert Diagram into Note
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
