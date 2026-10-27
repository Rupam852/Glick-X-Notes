import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { sound } from '../utils/sound';

export interface FolderOption {
  id: string;
  label: string;
  emoji: string;
  color: string;
  badgeBg: string;
}

export const FOLDER_OPTIONS: FolderOption[] = [
  { id: 'all', label: 'General', emoji: '📁', color: 'text-indigo-500 dark:text-indigo-400', badgeBg: 'bg-indigo-50 dark:bg-indigo-950/50' },
  { id: 'work', label: 'Work', emoji: '💼', color: 'text-sky-500 dark:text-sky-400', badgeBg: 'bg-sky-50 dark:bg-sky-950/50' },
  { id: 'personal', label: 'Personal', emoji: '💚', color: 'text-emerald-500 dark:text-emerald-400', badgeBg: 'bg-emerald-50 dark:bg-emerald-950/50' },
  { id: 'ideas', label: 'Ideas', emoji: '💡', color: 'text-amber-500 dark:text-amber-400', badgeBg: 'bg-amber-50 dark:bg-amber-950/50' },
  { id: 'archive', label: 'Archive', emoji: '📦', color: 'text-slate-400 dark:text-slate-500', badgeBg: 'bg-slate-100 dark:bg-slate-800/60' },
];

interface FolderDropdownProps {
  value: string;
  onChange: (newFolderId: string) => void;
  size?: 'xs' | 'sm' | 'md';
  align?: 'left' | 'right';
  className?: string;
  onOpenStateChange?: (isOpen: boolean) => void;
}

export default function FolderDropdown({
  value,
  onChange,
  size = 'sm',
  align = 'right',
  className = '',
  onOpenStateChange
}: FolderDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentOption = FOLDER_OPTIONS.find(opt => opt.id === (value || 'all')) || FOLDER_OPTIONS[0];

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    sound.playPop();
    const nextState = !isOpen;
    setIsOpen(nextState);
    onOpenStateChange?.(nextState);
  };

  const handleSelect = (e: React.MouseEvent, optId: string) => {
    e.stopPropagation();
    sound.playPop();
    onChange(optId);
    setIsOpen(false);
    onOpenStateChange?.(false);
  };

  // Close on outside click or Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        onOpenStateChange?.(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        onOpenStateChange?.(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onOpenStateChange]);

  const sizeStyles = {
    xs: 'text-[9px] px-2 py-0.5 rounded-lg gap-1',
    sm: 'text-[10px] px-2.5 py-1 rounded-xl gap-1.5',
    md: 'text-xs px-3.5 py-2.5 rounded-xl gap-2 w-full justify-between'
  };

  return (
    <div 
      ref={dropdownRef} 
      className={`relative inline-block ${isOpen ? 'z-50' : 'z-20'} ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Trigger Button */}
      <button
        type="button"
        onClick={handleToggle}
        className={`flex items-center font-bold tracking-tight border transition-all duration-150 cursor-pointer select-none ${
          sizeStyles[size]
        } ${
          isOpen
            ? 'border-indigo-500 bg-indigo-50/90 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 shadow-sm ring-2 ring-indigo-500/20'
            : 'border-slate-200/80 dark:border-slate-700/80 bg-white/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-white dark:hover:bg-slate-800 shadow-2xs'
        }`}
        title="Move to Folder"
        aria-expanded={isOpen}
      >
        <span className="text-xs select-none">{currentOption.emoji}</span>
        <span className="truncate max-w-[85px] sm:max-w-[110px]">{currentOption.label}</span>
        <ChevronDown 
          className={`w-3 h-3 text-slate-400 dark:text-slate-500 transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180 text-indigo-500' : ''
          }`} 
        />
      </button>

      {/* Floating Animated Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: -4 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className={`absolute ${
              align === 'right' ? 'right-0' : 'left-0'
            } top-full mt-1.5 z-50 min-w-[160px] p-1.5 bg-white/95 dark:bg-[#151c2e]/95 backdrop-blur-xl border border-slate-200/90 dark:border-slate-700/80 rounded-2xl shadow-[0_12px_36px_rgba(15,23,42,0.16)] dark:shadow-[0_18px_45px_rgba(0,0,0,0.6)] space-y-0.5`}
          >
            <div className="px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 select-none">
              Move to Folder
            </div>

            {FOLDER_OPTIONS.map((opt) => {
              const isSelected = (value || 'all') === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={(e) => handleSelect(e, opt.id)}
                  className={`w-full flex items-center justify-between gap-2.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 font-bold shadow-2xs'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm select-none">{opt.emoji}</span>
                    <span className="truncate">{opt.label}</span>
                  </div>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 stroke-[2.5] shrink-0" />
                  )}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
