import React, { useState, useEffect } from 'react';
import katex from 'katex';
import { X, Sparkles, Loader2, Check, Calculator, Sigma } from 'lucide-react';
import { aiGenerateMathFormula } from '../services/aiService';

interface MathFormulaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertMath: (latex: string, renderedHtml: string) => void;
  initialLatex?: string;
}

const PRESETS = [
  { name: 'Quadratic Formula', latex: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}' },
  { name: 'Mass-Energy', latex: 'E = m c^2' },
  { name: 'Pythagorean', latex: 'a^2 + b^2 = c^2' },
  { name: 'Definite Integral', latex: '\\int_{a}^{b} f(x) \\, dx = F(b) - F(a)' },
  { name: 'Infinite Sum', latex: '\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}' },
  { name: '2x2 Matrix', latex: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}' },
  { name: 'Normal Distribution', latex: 'f(x) = \\frac{1}{\\sigma \\sqrt{2\\pi}} e^{-\\frac{1}{2}\\left(\\frac{x-\\mu}{\\sigma}\\right)^2}' }
];

const SYMBOL_SHORTCUTS = [
  { label: '√x', insert: '\\sqrt{x}' },
  { label: 'a/b', insert: '\\frac{a}{b}' },
  { label: 'x²', insert: 'x^{2}' },
  { label: 'xₙ', insert: 'x_{n}' },
  { label: '∫', insert: '\\int_{a}^{b}' },
  { label: '∑', insert: '\\sum_{i=1}^{n}' },
  { label: '±', insert: '\\pm' },
  { label: '∞', insert: '\\infty' },
  { label: 'π', insert: '\\pi' },
  { label: 'θ', insert: '\\theta' },
  { label: 'α', insert: '\\alpha' },
  { label: 'β', insert: '\\beta' },
  { label: 'λ', insert: '\\lambda' },
  { label: '≈', insert: '\\approx' },
  { label: '≠', insert: '\\neq' },
  { label: '≤', insert: '\\le' },
  { label: '≥', insert: '\\ge' }
];

export default function MathFormulaModal({
  isOpen,
  onClose,
  onInsertMath,
  initialLatex
}: MathFormulaModalProps) {
  const [latex, setLatex] = useState(initialLatex || PRESETS[0].latex);
  const [renderedHtml, setRenderedHtml] = useState('');
  const [renderError, setRenderError] = useState<string | null>(null);

  // AI generator
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  useEffect(() => {
    if (initialLatex) {
      setLatex(initialLatex);
    }
  }, [initialLatex]);

  // Live KaTeX rendering
  useEffect(() => {
    if (!latex.trim()) {
      setRenderedHtml('');
      setRenderError(null);
      return;
    }

    try {
      const html = katex.renderToString(latex.trim(), {
        displayMode: true,
        throwOnError: true
      });
      setRenderedHtml(html);
      setRenderError(null);
    } catch (err: any) {
      setRenderError(err.message || 'Invalid LaTeX syntax');
      try {
        const fallback = katex.renderToString(latex.trim(), {
          displayMode: true,
          throwOnError: false
        });
        setRenderedHtml(fallback);
      } catch {
        setRenderedHtml('');
      }
    }
  }, [latex]);

  const handleInsertShortcut = (sym: string) => {
    setLatex(prev => prev + (prev.endsWith(' ') || prev === '' ? '' : ' ') + sym);
  };

  const handleGenerateAI = async () => {
    if (!aiPrompt.trim() || isGeneratingAI) return;
    setIsGeneratingAI(true);
    try {
      const generated = await aiGenerateMathFormula(aiPrompt);
      if (generated && generated.trim()) {
        setLatex(generated.trim());
        setAiPrompt('');
      }
    } catch (err: any) {
      setRenderError(err.message || 'AI generation failed');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleInsert = () => {
    if (!renderedHtml) return;
    onInsertMath(latex, renderedHtml);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
              <Sigma className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-850 dark:text-white flex items-center gap-2">
                LaTeX Math Formula Editor
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                  KaTeX Powered
                </span>
              </h3>
              <p className="text-xs text-slate-400">Write mathematical equations, scientific formulas & matrices</p>
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

        {/* AI Math Bar */}
        <div className="px-6 py-2.5 bg-gradient-to-r from-purple-50/80 via-indigo-50/50 to-pink-50/80 dark:from-slate-900 dark:via-purple-950/20 dark:to-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
          <input
            type="text"
            placeholder="AI Equation (e.g. 'Standard deviation formula' or 'Fourier transform equation')..."
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGenerateAI()}
            className="flex-1 bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
          <button
            type="button"
            onClick={handleGenerateAI}
            disabled={!aiPrompt.trim() || isGeneratingAI}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shrink-0 cursor-pointer shadow-xs"
          >
            {isGeneratingAI ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            Generate Formula
          </button>
        </div>

        {/* Popular Presets */}
        <div className="px-6 py-2 border-b border-slate-100 dark:border-slate-800/60 flex items-center gap-1.5 overflow-x-auto no-scrollbar bg-slate-50/30 dark:bg-slate-950/20">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0 mr-1">Presets:</span>
          {PRESETS.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setLatex(p.latex)}
              className="text-xs px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 hover:border-purple-400 text-slate-700 dark:text-slate-300 font-medium transition shrink-0 cursor-pointer"
            >
              {p.name}
            </button>
          ))}
        </div>

        {/* Quick Symbol Chips */}
        <div className="px-6 py-2 border-b border-slate-100 dark:border-slate-800/60 flex items-center gap-1 overflow-x-auto no-scrollbar">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0 mr-1">Symbols:</span>
          {SYMBOL_SHORTCUTS.map((s, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleInsertShortcut(s.insert)}
              className="px-2 py-0.5 rounded-md text-xs font-mono bg-slate-100 dark:bg-slate-800 hover:bg-purple-100 hover:text-purple-600 dark:hover:bg-purple-900/40 dark:hover:text-purple-300 transition shrink-0 cursor-pointer text-slate-700 dark:text-slate-300"
              title={`Insert ${s.insert}`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Editor Body */}
        <div className="p-6 space-y-4 overflow-y-auto">
          {/* Live Rendered Math Card */}
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Calculator className="w-3.5 h-3.5 text-purple-600" /> Live Equation Preview:
            </span>
            <div className="min-h-[100px] p-6 rounded-xl border border-purple-200/80 dark:border-purple-900/60 bg-purple-50/20 dark:bg-purple-950/10 flex items-center justify-center overflow-x-auto text-slate-900 dark:text-white">
              {renderedHtml ? (
                <div 
                  className="text-xl"
                  dangerouslySetInnerHTML={{ __html: renderedHtml }}
                />
              ) : (
                <p className="text-xs text-slate-400">Type LaTeX code below to see preview...</p>
              )}
            </div>
            {renderError && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 font-mono">
                Notice: {renderError}
              </p>
            )}
          </div>

          {/* LaTeX Input */}
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">LaTeX Code:</span>
            <textarea
              value={latex}
              onChange={(e) => setLatex(e.target.value)}
              placeholder="e.g. x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}"
              rows={3}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs font-mono text-purple-700 dark:text-purple-300 outline-none focus:border-purple-500 resize-none leading-relaxed"
              spellCheck={false}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <span className="text-xs text-slate-400 font-medium">
            Embeds responsive formula with KaTeX math rendering
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
              disabled={!renderedHtml}
              className="px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              Insert Formula into Note
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
