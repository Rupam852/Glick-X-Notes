import React, { useState, useEffect, useRef } from 'react';
import { 
  CheckSquare, Heading1, Heading2, Heading3, Code, 
  Lightbulb, AlertTriangle, Target, ChevronRight, Table, 
  Sparkles, Quote, List, Image as ImageIcon, GitFork, Sigma, Minus,
  Bookmark, Columns as Columns2, FileText, Palette
} from 'lucide-react';

export interface SlashCommandItem {
  id: string;
  label: string;
  desc: string;
  icon: React.ReactNode;
  action: () => void;
  keywords: string[];
}

interface SlashCommandMenuProps {
  isOpen: boolean;
  position: { top: number; left: number };
  query: string;
  onClose: () => void;
  onExecute: (id: string) => void;
}

export default function SlashCommandMenu({
  isOpen,
  position,
  query,
  onClose,
  onExecute
}: SlashCommandMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const COMMANDS: Omit<SlashCommandItem, 'action'>[] = [
    {
      id: 'ai',
      label: 'Ask AI / Summarize',
      desc: 'Generate summary, polish tone, or ask AI',
      icon: <Sparkles className="w-4 h-4 text-purple-500" />,
      keywords: ['ai', 'gpt', 'gemini', 'summarize', 'ask', 'magic']
    },
    {
      id: 'todo',
      label: 'To-do Checkbox',
      desc: 'Interactive task checklist item',
      icon: <CheckSquare className="w-4 h-4 text-emerald-500" />,
      keywords: ['todo', 'task', 'check', 'box', 'list']
    },
    {
      id: 'h1',
      label: 'Heading 1',
      desc: 'Big section heading',
      icon: <Heading1 className="w-4 h-4 text-indigo-500" />,
      keywords: ['h1', 'heading', 'title', 'large']
    },
    {
      id: 'h2',
      label: 'Heading 2',
      desc: 'Medium section heading',
      icon: <Heading2 className="w-4 h-4 text-indigo-400" />,
      keywords: ['h2', 'heading', 'medium']
    },
    {
      id: 'h3',
      label: 'Heading 3',
      desc: 'Small sub-heading',
      icon: <Heading3 className="w-4 h-4 text-indigo-300" />,
      keywords: ['h3', 'heading', 'small']
    },
    {
      id: 'callout-tip',
      label: 'Tip Callout Box',
      desc: 'Highlight important insight in indigo',
      icon: <Lightbulb className="w-4 h-4 text-amber-500" />,
      keywords: ['callout', 'tip', 'box', 'highlight', 'note']
    },
    {
      id: 'callout-warn',
      label: 'Warning Box',
      desc: 'Caution or warning callout box',
      icon: <AlertTriangle className="w-4 h-4 text-rose-500" />,
      keywords: ['warn', 'warning', 'alert', 'caution']
    },
    {
      id: 'callout-goal',
      label: 'Goal / Target Box',
      desc: 'Green objective callout block',
      icon: <Target className="w-4 h-4 text-emerald-500" />,
      keywords: ['goal', 'target', 'objective', 'success']
    },
    {
      id: 'code',
      label: 'Code Block',
      desc: 'Dark syntax container with copy button',
      icon: <Code className="w-4 h-4 text-cyan-500" />,
      keywords: ['code', 'block', 'snippet', 'pre', 'developer']
    },
    {
      id: 'toggle',
      label: 'Collapsible Toggle',
      desc: 'Expandable details dropdown block',
      icon: <ChevronRight className="w-4 h-4 text-blue-500" />,
      keywords: ['toggle', 'collapsible', 'details', 'accordion', 'hide']
    },
    {
      id: 'table',
      label: 'Table (3x3)',
      desc: 'Formatted data grid table',
      icon: <Table className="w-4 h-4 text-slate-500" />,
      keywords: ['table', 'grid', 'columns', 'rows']
    },
    {
      id: 'bullet',
      label: 'Bulleted List',
      desc: 'Simple bulleted list item',
      icon: <List className="w-4 h-4 text-slate-500" />,
      keywords: ['bullet', 'list', 'ul']
    },
    {
      id: 'quote',
      label: 'Quote Block',
      desc: 'Indented blockquote styling',
      icon: <Quote className="w-4 h-4 text-slate-500" />,
      keywords: ['quote', 'blockquote', 'cite']
    },
    {
      id: 'image',
      label: 'Image / Photo',
      desc: 'Insert photo directly into note',
      icon: <ImageIcon className="w-4 h-4 text-emerald-500" />,
      keywords: ['image', 'photo', 'picture', 'upload', 'camera', 'pic']
    },
    {
      id: 'diagram',
      label: 'Flowchart / Mermaid Diagram',
      desc: 'Visual flowchart, sequence or mindmap',
      icon: <GitFork className="w-4 h-4 text-sky-500" />,
      keywords: ['mermaid', 'diagram', 'flowchart', 'mindmap', 'chart', 'sequence']
    },
    {
      id: 'math',
      label: 'LaTeX Math Formula',
      desc: 'Equations, fractions and scientific formulas',
      icon: <Sigma className="w-4 h-4 text-indigo-500" />,
      keywords: ['math', 'latex', 'formula', 'equation', 'science', 'sum', 'integral', 'fraction']
    },
    {
      id: 'draw',
      label: 'Drawing / Canvas (Google Docs style)',
      desc: 'Freehand sketch, shapes, arrows, callouts & text',
      icon: <Palette className="w-4 h-4 text-pink-500" />,
      keywords: ['draw', 'drawing', 'canvas', 'sketch', 'doodle', 'docs', 'paint', 'shape', 'art']
    },
    {
      id: 'divider',
      label: 'Decorative Divider',
      desc: 'Gradient fade, star break or dotted line',
      icon: <Minus className="w-4 h-4 text-purple-500" />,
      keywords: ['divider', 'hr', 'line', 'separator', 'break']
    },
    {
      id: 'bookmark',
      label: 'Web Bookmark Card',
      desc: 'Notion-style web link preview card',
      icon: <Bookmark className="w-4 h-4 text-amber-500" />,
      keywords: ['bookmark', 'link', 'web', 'card', 'url', 'preview']
    },
    {
      id: '2col',
      label: '2-Column Split (50/50)',
      desc: 'Side-by-side comparison columns',
      icon: <Columns2 className="w-4 h-4 text-indigo-500" />,
      keywords: ['column', 'columns', '2col', 'split', 'grid', 'side']
    },
    {
      id: '3col',
      label: '3-Column Split (33/33/33)',
      desc: 'Triple column side-by-side blocks',
      icon: <Columns2 className="w-4 h-4 text-blue-500" />,
      keywords: ['column', 'columns', '3col', 'split', 'grid', 'triple']
    },
    {
      id: 'pagebreak',
      label: 'A4 Page Break',
      desc: 'Insert page break for printing & PDF',
      icon: <FileText className="w-4 h-4 text-emerald-500" />,
      keywords: ['page', 'break', 'print', 'pdf', 'a4']
    }
  ];

  // Filter based on search query after `/`
  const cleanQ = (query || '').toLowerCase().replace('/', '').trim();
  const filtered = COMMANDS.filter(cmd => {
    if (!cleanQ) return true;
    return (
      cmd.label.toLowerCase().includes(cleanQ) ||
      cmd.desc.toLowerCase().includes(cleanQ) ||
      cmd.keywords.some(k => k.includes(cleanQ))
    );
  });

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [cleanQ]);

  // If query returns no results, close the menu so Enter works normally
  useEffect(() => {
    if (isOpen && cleanQ && filtered.length === 0) {
      onClose();
    }
  }, [isOpen, cleanQ, filtered.length, onClose]);

  // Smooth scroll selected item into view on Arrow navigation
  useEffect(() => {
    if (itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  // Handle keyboard navigation only when open with matches
  useEffect(() => {
    if (!isOpen || filtered.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex(prev => (prev + 1) % filtered.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex(prev => (prev - 1 + filtered.length) % filtered.length);
      } else if (e.key === 'Enter') {
        if (filtered[selectedIndex]) {
          e.preventDefault();
          e.stopPropagation();
          onExecute(filtered[selectedIndex].id);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, selectedIndex, filtered, onExecute, onClose]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleMousedown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('mousedown', handleMousedown);
    return () => window.removeEventListener('mousedown', handleMousedown);
  }, [isOpen, onClose]);

  if (!isOpen || filtered.length === 0) return null;

  // Clamp positioning so menu doesn't overflow viewport
  const left = Math.min(Math.max(16, position.left), window.innerWidth - 300);
  const top = Math.min(position.top, window.innerHeight - 340);

  return (
    <div
      ref={menuRef}
      style={{ top: `${top}px`, left: `${left}px` }}
      className="fixed z-50 w-72 max-h-84 flex flex-col bg-white dark:bg-[#0c1220] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 select-none backdrop-blur-md"
    >
      {/* 1. Dedicated Header Row (Never overlaps or hides items) */}
      <div className="px-3.5 py-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-slate-50/90 dark:bg-[#0c1220]/90 shrink-0">
        <span>Insert Block</span>
        <span className="text-[9px] font-mono lowercase">{selectedIndex + 1}/{filtered.length}</span>
      </div>

      {/* 2. Isolated Scrollable Items List */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 no-scrollbar scroll-smooth">
        {filtered.map((item, idx) => {
          const isSelected = idx === selectedIndex;
          return (
            <button
              key={item.id}
              ref={el => { itemRefs.current[idx] = el; }}
              type="button"
              onClick={() => onExecute(item.id)}
              onMouseEnter={() => setSelectedIndex(idx)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                isSelected 
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200 ring-1 ring-indigo-500/30' 
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900'
              }`}
            >
              <div className={`p-1.5 rounded-lg border ${
                isSelected 
                  ? 'border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 shadow-xs' 
                  : 'border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-900/40'
              }`}>
                {item.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold leading-tight truncate">{item.label}</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate leading-normal">{item.desc}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
