import React, { useState, useEffect, useRef } from 'react';
import { 
  CheckSquare, Heading1, Heading2, Heading3, Code, 
  Lightbulb, AlertTriangle, Target, ChevronRight, Table, 
  Sparkles, Quote, List, ListOrdered
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
    }
  ];

  // Filter based on search query after `/`
  const filtered = COMMANDS.filter(cmd => {
    if (!query) return true;
    const q = query.toLowerCase().replace('/', '');
    return (
      cmd.label.toLowerCase().includes(q) ||
      cmd.desc.toLowerCase().includes(q) ||
      cmd.keywords.some(k => k.includes(q))
    );
  });

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % (filtered.length || 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + (filtered.length || 1)) % (filtered.length || 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          onExecute(filtered[selectedIndex].id);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filtered, onExecute, onClose]);

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!isOpen || filtered.length === 0) return null;

  // Clamp positioning so menu doesn't overflow viewport
  const left = Math.min(Math.max(16, position.left), window.innerWidth - 300);
  const top = Math.min(position.top, window.innerHeight - 340);

  return (
    <div
      ref={menuRef}
      style={{ top: `${top}px`, left: `${left}px` }}
      className="fixed z-50 w-72 max-h-80 overflow-y-auto bg-white dark:bg-[#0c1220] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-1.5 space-y-0.5 animate-in fade-in zoom-in-95 duration-150 select-none backdrop-blur-md"
    >
      <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 mb-1">
        <span>Insert Block</span>
        <span className="text-[9px] font-mono lowercase">type to filter</span>
      </div>

      {filtered.map((item, idx) => {
        const isSelected = idx === selectedIndex;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onExecute(item.id)}
            onMouseEnter={() => setSelectedIndex(idx)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-colors cursor-pointer ${
              isSelected 
                ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200' 
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
  );
}
