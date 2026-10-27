import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Note } from '../types';
import { 
  Search, Plus, SortDesc, SortAsc, Tag, Paperclip, Calendar, Clock, 
  LayoutGrid, List, Sparkles, BookOpen, Star, Pin, Image as ImageIcon, 
  Folder, ArrowUpDown, Filter, X, Trash2, Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { sound } from '../utils/sound';
import { useToast } from '../contexts/ToastContext';
import FolderDropdown from './FolderDropdown';
import { useBackHandler } from '../utils/smartBackNavigation';

const stripHtmlForPreview = (html: string) => {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<div[^>]*>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<p[^>]*>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<h[1-6][^>]*>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<blockquote[^>]*>/gi, '\n')
    .replace(/<\/blockquote>/gi, '\n')
    .replace(/<[^>]+>/g, '') // Strip remaining inline tags
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ') // Collapse horizontal spaces, keep newlines
    .replace(/\n\s*\n/g, '\n') // Collapse consecutive newlines
    .trim();
};

const safeToDate = (ts: any): Date => {
  if (!ts) return new Date();
  if (typeof ts.toDate === 'function') return ts.toDate();
  if (ts.seconds !== undefined) return new Date(ts.seconds * 1000);
  if (ts._seconds !== undefined) return new Date(ts._seconds * 1000);
  if (ts instanceof Date) return ts;
  return new Date(ts);
};

const extractFirstImage = (body: string): string | null => {
  if (!body) return null;
  const match = body.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match ? match[1] : null;
};

const formatRelativeTime = (ts: any): string => {
  if (!ts) return 'Just now';
  const date = safeToDate(ts);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 0 || diffInSeconds < 45) return 'Just now';
  if (diffInSeconds < 90) return '1 min ago';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min ago`;
  if (diffInSeconds < 7200) return '1 hour ago';
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 172800) return 'Yesterday';
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
  
  return format(date, 'MMM d, yyyy');
};

const getTagDotColor = (tag: string) => {
  const lower = tag.toLowerCase();
  if (lower.includes('work') || lower.includes('project') || lower.includes('dev')) return 'bg-sky-500';
  if (lower.includes('urgent') || lower.includes('important') || lower.includes('bug')) return 'bg-rose-500';
  if (lower.includes('idea') || lower.includes('plan') || lower.includes('draft')) return 'bg-amber-500';
  if (lower.includes('personal') || lower.includes('life') || lower.includes('health')) return 'bg-emerald-500';
  return 'bg-indigo-500';
};

// 🧠 Smart Note Title Resolver: Extracts title from body if empty/untitled and resolves duplicates
const getSmartNoteTitle = (note: Note, allNotes: Note[] = []): string => {
  const rawTitle = (note.title || '').trim();
  const isGeneric = !rawTitle || /^untitled note(\s*\d*)?$/i.test(rawTitle);

  // 1. If it's a generic "Untitled Note" or empty, extract from the first non-empty line of body
  if (isGeneric) {
    const bodyText = stripHtmlForPreview(note.body);
    const firstLine = bodyText.split('\n').map(l => l.trim()).filter(Boolean)[0];
    if (firstLine) {
      return firstLine.length > 40 ? firstLine.slice(0, 40).trim() + '...' : firstLine;
    }
  }

  // 2. Base title: either raw title or 'Untitled Note' if body was also empty
  const baseTitle = isGeneric ? 'Untitled Note' : rawTitle;

  // 3. Duplicate handling: if multiple notes share the exact same title, add index (e.g. Title (2))
  const duplicates = allNotes.filter(n => {
    const otherRaw = (n.title || '').trim();
    const otherIsGeneric = !otherRaw || /^untitled note(\s*\d*)?$/i.test(otherRaw);

    if (isGeneric) {
      const otherBody = stripHtmlForPreview(n.body).trim();
      return otherIsGeneric && !otherBody;
    }
    return otherRaw.toLowerCase() === baseTitle.toLowerCase();
  });

  if (duplicates.length > 1) {
    const sorted = [...duplicates].sort((a, b) => {
      const timeA = safeToDate(a.createdAt).getTime();
      const timeB = safeToDate(b.createdAt).getTime();
      return timeA !== timeB ? timeA - timeB : a.id.localeCompare(b.id);
    });
    const idx = sorted.findIndex(n => n.id === note.id);
    if (idx > 0) {
      return `${baseTitle} (${idx + 1})`;
    }
  }

  return baseTitle;
};

interface DashboardProps {
  user: User;
  onEditNote: (note: Note) => void;
  onNewNote: () => void;
  selectedFolder?: string;
  onFolderChange?: (folder: string) => void;
}

export default function Dashboard({ 
  user, 
  onEditNote, 
  onNewNote,
  selectedFolder = 'all',
  onFolderChange
}: DashboardProps) {
  const { showToast } = useToast();
  const [notes, setNotes] = useState<Note[]>([]);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'createdAt' | 'updatedAt' | 'title'>('updatedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [activeDropdownNoteId, setActiveDropdownNoteId] = useState<string | null>(null);
  const [isFabVisible, setIsFabVisible] = useState(true);

  // 🛡️ Smart Back Handlers: close delete dialog, active menu, or clear filters on back gesture
  useBackHandler(() => {
    setNoteToDelete(null);
    return true;
  }, noteToDelete !== null);

  useBackHandler(() => {
    setActiveDropdownNoteId(null);
    return true;
  }, activeDropdownNoteId !== null);

  useBackHandler(() => {
    setSelectedTag(null);
    return true;
  }, selectedTag !== null);

  useBackHandler(() => {
    setSearch('');
    return true;
  }, search.trim() !== '');

  // Live auto-refresh relative time stamps every 30 seconds (Just now -> 1 min ago -> 2 min ago)
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  // 🌀 Scroll listener: hides FAB with spin on scroll down, reveals on scroll up
  useEffect(() => {
    let lastScrollY = 0;
    const mainEl = document.querySelector('main');

    const handleScroll = () => {
      const currentY = mainEl ? mainEl.scrollTop : window.scrollY;
      const diff = currentY - lastScrollY;

      // Always show near the very top
      if (currentY < 40) {
        setIsFabVisible(true);
      } else if (diff > 8) {
        // Scrolling DOWN -> Hide with spin
        setIsFabVisible(false);
      } else if (diff < -8) {
        // Scrolling UP -> Reveal with spin
        setIsFabVisible(true);
      }

      lastScrollY = currentY;
    };

    if (mainEl) {
      mainEl.addEventListener('scroll', handleScroll, { passive: true });
    }
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      if (mainEl) {
        mainEl.removeEventListener('scroll', handleScroll);
      }
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'notes'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Note[];

      // Client-side sorting
      notesData.sort((a, b) => {
        let valA: any = a[sortBy];
        let valB: any = b[sortBy];

        // Handle Firestore Timestamps safely
        if (valA instanceof Timestamp) valA = valA.toMillis();
        else if (valA && typeof valA.toMillis === 'function') valA = valA.toMillis();
        else if (valA && typeof valA.toDate === 'function') valA = valA.toDate().getTime();

        if (valB instanceof Timestamp) valB = valB.toMillis();
        else if (valB && typeof valB.toMillis === 'function') valB = valB.toMillis();
        else if (valB && typeof valB.toDate === 'function') valB = valB.toDate().getTime();
        
        if (!valA) valA = Date.now();
        if (!valB) valB = Date.now();

        if (typeof valA === 'string') {
          return sortOrder === 'asc' 
            ? valA.localeCompare(valB) 
            : valB.localeCompare(valA);
        }

        return sortOrder === 'asc' ? valA - valB : valB - valA;
      });

      setNotes(notesData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'notes', true);
    });

    return () => unsubscribe();
  }, [user.uid, sortBy, sortOrder]);

  const handleTogglePin = async (e: React.MouseEvent, note: Note) => {
    e.stopPropagation();
    const newPinned = !note.pinned;
    // Optimistic local state update for zero-latency instant transition
    setNotes(prev => prev.map(n => n.id === note.id ? { ...n, pinned: newPinned } : n));
    try {
      await setDoc(doc(db, 'notes', note.id), {
        pinned: newPinned
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `notes/${note.id}`);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, note: Note) => {
    e.stopPropagation();
    sound.playPop();
    setNoteToDelete(note);
  };

  const handleConfirmDelete = async () => {
    if (!noteToDelete) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'notes', noteToDelete.id));
      sound.playSwoosh();
      showToast('Note deleted successfully', 'success');
      setNoteToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `notes/${noteToDelete.id}`);
      showToast('Failed to delete note', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleUpdateNoteFolder = async (newFolder: string, note: Note) => {
    setNotes(prev => prev.map(n => n.id === note.id ? { ...n, folder: newFolder } : n));
    try {
      await setDoc(doc(db, 'notes', note.id), {
        folder: newFolder
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `notes/${note.id}`);
    }
  };

  // Extract all unique tags
  const allTags = Array.from(new Set(notes.flatMap(n => n.tags || [])));

  // Folder filtering
  const folderFilteredNotes = notes.filter(note => {
    if (!selectedFolder || selectedFolder === 'all') return true;
    if (selectedFolder === 'pinned') return note.pinned === true;
    if (selectedFolder === 'archive') return note.folder === 'archive';
    
    // Match by note.folder or if tags contain folder name
    return (note.folder === selectedFolder) || (note.tags && note.tags.some(t => t.toLowerCase().includes(selectedFolder)));
  });

  const filteredNotes = folderFilteredNotes.filter(note => {
    const smartTitle = getSmartNoteTitle(note, notes);
    const matchesSearch = 
      (note.title && note.title.toLowerCase().includes(search.toLowerCase())) ||
      smartTitle.toLowerCase().includes(search.toLowerCase()) ||
      stripHtmlForPreview(note.body).toLowerCase().includes(search.toLowerCase()) ||
      note.tags.some(tag => tag.toLowerCase().includes(search.toLowerCase()));
    
    const matchesTag = selectedTag ? note.tags.includes(selectedTag) : true;
    
    return matchesSearch && matchesTag;
  });

  // Separate pinned and unpinned notes
  const pinnedNotes = filteredNotes.filter(n => n.pinned);
  const otherNotes = filteredNotes.filter(n => !n.pinned);

  const totalStorage = notes.reduce((acc, note) => acc + (note.body.length * 2), 0);

  // Search highlight helper
  const highlightText = (text: string, highlight: string) => {
    if (!highlight.trim()) return <span>{text}</span>;
    const regex = new RegExp(`(${highlight.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return (
      <span>
        {parts.map((part, i) => 
          regex.test(part) ? (
            <mark key={i} className="bg-indigo-500/25 text-indigo-700 dark:text-indigo-200 px-0.5 rounded font-semibold">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </span>
    );
  };

  const getFolderName = (id: string) => {
    switch (id) {
      case 'pinned': return 'Pinned & Starred';
      case 'work': return 'Work & Projects';
      case 'personal': return 'Personal & Life';
      case 'ideas': return 'Ideas & Brainstorm';
      case 'archive': return 'Archive';
      default: return 'All Notes';
    }
  };

  // Render Note Card (Linear / Apple style)
  const renderNoteCard = (note: Note) => {
    const previewImg = note.previewImage || extractFirstImage(note.body);
    const previewText = stripHtmlForPreview(note.body);

    return (
      <motion.div
        key={note.id}
        layout
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        whileHover={{ y: -3 }}
        whileTap={{ scale: 0.99 }}
        onClick={() => {
          sound.playPop();
          onEditNote(note);
        }}
        className={`group relative bg-[#fafbfc]/95 dark:bg-[#111726]/85 backdrop-blur-xl border border-slate-200/70 dark:border-slate-800/80 hover:border-indigo-500/40 dark:hover:border-indigo-400/40 rounded-2xl p-5 shadow-[0_2px_14px_rgba(15,23,42,0.03)] hover:shadow-[0_14px_32px_rgba(99,102,241,0.10)] transition-all duration-200 cursor-pointer flex flex-col justify-between min-h-[200px] ${
          activeDropdownNoteId === note.id ? 'z-30' : 'z-10'
        }`}
      >
        {/* Subtle hover gradient mesh highlight */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl" />

        {/* Left Border accent color bar */}
        <div 
          className="absolute top-0 left-0 w-1.5 h-full rounded-l-2xl transition-all duration-200 group-hover:w-2" 
          style={{ backgroundColor: note.color || '#6366f1' }}
        />

        <div className="space-y-3 pl-2 relative z-10">
          {/* Header Row: Title & Actions */}
          <div className="flex justify-between items-start gap-2.5">
            <h3 className="font-bold text-sm md:text-[15px] text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors duration-150 line-clamp-2 break-words leading-snug flex-1 min-w-0 pr-1">
              {highlightText(getSmartNoteTitle(note, notes), search)}
            </h3>

            <div className="flex items-center gap-1 shrink-0">
              {/* Quick folder select dropdown */}
              <FolderDropdown
                value={note.folder || 'all'}
                onChange={(newFolder) => handleUpdateNoteFolder(newFolder, note)}
                size="xs"
                align="right"
                onOpenStateChange={(isOpen) => setActiveDropdownNoteId(isOpen ? note.id : null)}
              />

              {/* Pin button */}
              <button
                onClick={(e) => handleTogglePin(e, note)}
                className={`p-1.5 rounded-lg transition-all duration-150 cursor-pointer ${
                  note.pinned 
                    ? 'text-amber-500 hover:text-amber-600 bg-amber-500/10' 
                    : 'text-slate-400 dark:text-slate-500 hover:text-amber-500 hover:bg-amber-500/10 opacity-70 group-hover:opacity-100'
                }`}
                title={note.pinned ? "Unpin note" : "Pin note"}
              >
                <Pin className={`w-3.5 h-3.5 ${note.pinned ? 'fill-amber-500 rotate-45' : ''}`} />
              </button>

              {/* 🗑️ Delete dustbin button right beside Pin */}
              <button
                onClick={(e) => handleDeleteClick(e, note)}
                className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 opacity-70 group-hover:opacity-100 transition-all duration-150 cursor-pointer"
                title="Delete note"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>

              {/* Attachment count badge */}
              {note.attachmentCount ? (
                <div className="flex items-center gap-0.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-1.5 py-0.5 rounded-md border border-slate-200/60 dark:border-slate-700/60">
                  <Paperclip className="w-3 h-3 text-indigo-500" />
                  {note.attachmentCount}
                </div>
              ) : null}
            </div>
          </div>

          {/* Optional Image Thumbnail Preview */}
          {previewImg && (
            <div className="relative w-full h-28 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60">
              <img 
                src={previewImg} 
                alt="Thumbnail" 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
            </div>
          )}

          {/* Preview Body Text */}
          <p className="text-slate-500 dark:text-slate-400 text-xs md:text-sm line-clamp-3 leading-relaxed font-normal whitespace-pre-line break-words">
            {previewText ? highlightText(previewText, search) : <span className="italic text-slate-400 dark:text-slate-500">Empty note...</span>}
          </p>
        </div>

        {/* Footer Area: Tags & Metadata */}
        <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-850/80 pl-2 mt-4 relative z-10">
          {/* Accented Tag Pills with colored dots */}
          {note.tags && note.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {note.tags.map(tag => (
                <span 
                  key={tag} 
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 text-[10px] font-semibold rounded-md transition-all group-hover:border-indigo-300 dark:group-hover:border-indigo-700/60"
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${getTagDotColor(tag)}`} />
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Metadata: Creation Date & Relative Last Updated */}
          <div className="flex items-center justify-between text-[10px] font-medium text-slate-400 dark:text-slate-500">
            <div className="flex items-center gap-1.5" title="Creation Date">
              <Calendar className="w-3.5 h-3.5" />
              <span>{format(safeToDate(note.createdAt || note.updatedAt), 'MMM d, yyyy')}</span>
            </div>
            <div className="flex items-center gap-1.5" title="Last Updated">
              <Clock className="w-3.5 h-3.5" />
              <span>{formatRelativeTime(note.updatedAt)}</span>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-7 select-none">
      
      {/* 🌟 Modern Hero Banner with Soft Light / Dark Polish */}
      <div className="relative overflow-hidden bg-gradient-to-r from-indigo-50/70 via-sky-50/30 to-slate-100/60 dark:from-slate-900/40 dark:via-indigo-950/20 dark:to-slate-900/30 border border-slate-200/70 dark:border-slate-800/80 rounded-3xl p-6 md:p-8 backdrop-blur-2xl shadow-[0_4px_20px_rgba(99,102,241,0.03)]">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-[90px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-sky-500/10 rounded-full blur-[90px] pointer-events-none" />
        
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-5 z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl md:text-3.5xl font-black text-slate-900 dark:text-white tracking-tight">
                {getFolderName(selectedFolder)}
              </h1>
              {selectedFolder !== 'all' && (
                <button
                  onClick={() => onFolderChange?.('all')}
                  className="px-2 py-0.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-100/70 dark:bg-indigo-950/60 rounded-md hover:bg-indigo-200 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-3 h-3" /> Show All
                </button>
              )}
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-xs md:text-sm font-medium">
              Manage your ideas across <span className="text-indigo-600 dark:text-indigo-400 font-bold">{filteredNotes.length} notes</span> • {(totalStorage / 1024).toFixed(1)} KB synchronized
            </p>
          </div>
        </div>
      </div>

      {/* 🎛️ Control Panel (Search, Sort, View Toggle) */}
      <div className="bg-[#f8f9fb]/85 dark:bg-slate-900/30 border border-slate-200/70 dark:border-slate-800/80 p-3.5 rounded-2xl space-y-3 backdrop-blur-md shadow-xs">
        <div className="flex flex-col lg:flex-row gap-3">
          
          {/* Enhanced Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search notes, body text, tags..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-[#fbfcfd] dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800 focus:border-indigo-500 text-slate-800 dark:text-slate-100 rounded-xl outline-none transition-all shadow-inner focus:ring-2 focus:ring-indigo-500/10 text-xs md:text-sm"
            />
            {search && (
              <button 
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Sorting Select */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => {
                  sound.playTick();
                  setSortBy(e.target.value as any);
                }}
                className="bg-[#fbfcfd] dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800 hover:bg-slate-100/60 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-bold uppercase tracking-wider outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer transition-all duration-150"
              >
                <option value="updatedAt">Last Modified</option>
                <option value="createdAt">Date Created</option>
                <option value="title">Title (A-Z)</option>
              </select>
            </div>

            {/* Ascending / Descending Button */}
            <button
              onClick={() => {
                sound.playTick();
                setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
              }}
              className="bg-[#fbfcfd] dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800 hover:bg-slate-100/60 dark:hover:bg-slate-900 p-2.5 rounded-xl text-slate-600 dark:text-slate-300 transition-all cursor-pointer shadow-xs"
              title="Toggle Sort Order"
            >
              {sortOrder === 'asc' ? <SortAsc className="w-4.5 h-4.5" /> : <SortDesc className="w-4.5 h-4.5" />}
            </button>

            {/* Grid / List View Toggle */}
            <div className="flex bg-slate-100 dark:bg-slate-950/80 border border-slate-200/80 dark:border-slate-800 p-1 rounded-xl shadow-xs">
              <button
                onClick={() => {
                  sound.playTick();
                  setViewMode('grid');
                }}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'grid' 
                    ? 'bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-xs font-bold' 
                    : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
                title="Grid View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  sound.playTick();
                  setViewMode('list');
                }}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'list' 
                    ? 'bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-xs font-bold' 
                    : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
                title="List View"
              >
                <List className="w-4 h-4" />
              </button>
            </div>

          </div>
        </div>

        {/* Scrollable Horizontal Tags List */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800/60 overflow-x-auto pb-1 no-scrollbar">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider shrink-0 flex items-center gap-1">
              <Tag className="w-3 h-3" /> Filter:
            </span>
            <button
              onClick={() => {
                sound.playTick();
                setSelectedTag(null);
              }}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer shrink-0 ${
                !selectedTag 
                  ? 'bg-indigo-600 text-white shadow-xs' 
                  : 'bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              All
            </button>
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => {
                  sound.playTick();
                  setSelectedTag(selectedTag === tag ? null : tag);
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer shrink-0 ${
                  selectedTag === tag 
                    ? 'bg-indigo-600 text-white shadow-xs' 
                    : 'bg-[#fbfcfd] dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${getTagDotColor(tag)}`} />
                #{tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 🚀 Skeleton Shimmer Loading or Notes List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div 
              key={i} 
              className="shimmer-card h-56 bg-[#fafbfc]/70 dark:bg-slate-900/40 border border-slate-200/70 dark:border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between shadow-xs"
            >
              <div className="space-y-3">
                <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-md w-3/4" />
                <div className="h-3 bg-slate-100 dark:bg-slate-850 rounded-md w-full" />
                <div className="h-3 bg-slate-100 dark:bg-slate-850 rounded-md w-4/5" />
                <div className="h-3 bg-slate-100 dark:bg-slate-850 rounded-md w-2/3" />
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-850">
                <div className="h-4 w-16 bg-slate-200 dark:bg-slate-800 rounded-full" />
                <div className="h-3 w-20 bg-slate-100 dark:bg-slate-850 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredNotes.length > 0 ? (
        viewMode === 'grid' ? (
          <div className="space-y-8">
            
            {/* 📌 Pinned Notes Section (if any) */}
            {pinnedNotes.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                  <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
                  <span>Pinned Notes ({pinnedNotes.length})</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <AnimatePresence mode="popLayout">
                    {pinnedNotes.map(renderNoteCard)}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* 📝 Other Notes Section */}
            <div className="space-y-4">
              {pinnedNotes.length > 0 && (
                <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pt-2">
                  <BookOpen className="w-4 h-4 text-indigo-500" />
                  <span>Other Notes ({otherNotes.length})</span>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <AnimatePresence mode="popLayout">
                  {otherNotes.map(renderNoteCard)}
                </AnimatePresence>
              </div>
            </div>

          </div>
        ) : (
          /* 📋 Premium Compact List View rendering */
          <div className="space-y-2.5">
            <AnimatePresence mode="popLayout">
              {filteredNotes.map(note => {
                return (
                  <motion.div
                    key={note.id}
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    whileHover={{ x: 3 }}
                    onClick={() => {
                      sound.playPop();
                      onEditNote(note);
                    }}
                    className={`group relative bg-[#fafbfc]/95 dark:bg-[#111726]/85 backdrop-blur-xl border border-slate-200/70 dark:border-slate-800/80 hover:border-indigo-500/40 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 cursor-pointer transition-all duration-150 shadow-xs hover:shadow-md ${
                      activeDropdownNoteId === note.id ? 'z-30' : 'z-10'
                    }`}
                  >
                    <div 
                      className="absolute top-0 left-0 w-1.5 h-full rounded-l-2xl" 
                      style={{ backgroundColor: note.color || '#6366f1' }}
                    />

                    <div className="flex items-center gap-3.5 pl-3 flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={(e) => handleTogglePin(e, note)}
                          className={`p-2 rounded-xl transition-all duration-150 cursor-pointer ${
                            note.pinned
                              ? 'text-amber-500 hover:text-amber-600 bg-amber-500/10'
                              : 'text-slate-400 dark:text-slate-500 hover:text-amber-500 hover:bg-amber-500/10'
                          }`}
                          title={note.pinned ? "Unpin note" : "Pin note"}
                        >
                          <Pin className={`w-4 h-4 ${note.pinned ? 'fill-amber-500 rotate-45' : ''}`} />
                        </button>

                        {/* 🗑️ Delete dustbin button right beside Pin */}
                        <button
                          onClick={(e) => handleDeleteClick(e, note)}
                          className="p-2 rounded-xl text-slate-400 dark:text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          title="Delete note"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="space-y-1 min-w-0">
                        <h3 className="font-bold text-sm md:text-base text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors line-clamp-2 break-words leading-snug">
                          {highlightText(getSmartNoteTitle(note, notes), search)}
                        </h3>
                        <p className="text-slate-400 dark:text-slate-500 text-xs md:text-sm line-clamp-1 truncate">
                          {stripHtmlForPreview(note.body) || 'No preview available'}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pl-3 sm:pl-0 shrink-0">
                      {/* Quick folder select in list view */}
                      <FolderDropdown
                        value={note.folder || 'all'}
                        onChange={(newFolder) => handleUpdateNoteFolder(newFolder, note)}
                        size="sm"
                        align="right"
                        onOpenStateChange={(isOpen) => setActiveDropdownNoteId(isOpen ? note.id : null)}
                      />
                      {/* Tags */}
                      {note.tags && note.tags.length > 0 && (
                        <div className="flex gap-1.5">
                          {note.tags.slice(0, 2).map(tag => (
                            <span 
                              key={tag} 
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-lg border border-slate-200/50 dark:border-slate-700/50"
                            >
                              <span className={`w-2 h-2 rounded-full ${getTagDotColor(tag)}`} />
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Date & Updated Relative Time */}
                      <div className="flex items-center gap-3 text-xs font-semibold text-slate-400 dark:text-slate-500">
                        <span className="flex items-center gap-1.5" title="Creation Date">
                          <Calendar className="w-3.5 h-3.5" />
                          {format(safeToDate(note.createdAt || note.updatedAt), 'MMM d')}
                        </span>
                        <span className="hidden sm:inline-block">•</span>
                        <span className="flex items-center gap-1.5" title="Last Updated">
                          <Clock className="w-3.5 h-3.5" />
                          {formatRelativeTime(note.updatedAt)}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )
      ) : (
        /* Empty State */
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 bg-white/60 dark:bg-slate-900/20 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-8 backdrop-blur-md">
          <div className="p-5 bg-indigo-50 dark:bg-slate-950 border border-indigo-100 dark:border-slate-800 rounded-2xl shadow-sm relative">
            <BookOpen className="w-10 h-10 text-indigo-500" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
              No notes in {getFolderName(selectedFolder)}
            </h3>
            <p className="text-slate-400 text-xs md:text-sm max-w-sm mx-auto">
              Start writing your thoughts, projects, or journal by creating a new note.
            </p>
          </div>
          <button
            onClick={() => {
              sound.playPop();
              onNewNote();
            }}
            className="text-indigo-600 dark:text-indigo-400 font-bold hover:text-indigo-700 cursor-pointer text-xs uppercase tracking-wider border-b-2 border-indigo-400/40 pb-0.5 hover:border-indigo-600 transition-colors"
          >
            Create Note
          </button>
        </div>
      )}

      {/* 🗑️ Delete Note Confirmation Dialog */}
      <AnimatePresence>
        {noteToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setNoteToDelete(null)}
            className="fixed inset-0 z-[120] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#fafbfc] dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl space-y-6"
            >
              <div className="flex items-center gap-4">
                <div className="p-3.5 bg-rose-500/10 text-rose-500 rounded-2xl shrink-0">
                  <Trash2 className="w-7 h-7" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white truncate">Delete Note?</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                    "{getSmartNoteTitle(noteToDelete, notes)}" will be permanently removed.
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed bg-slate-100/70 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                Are you sure you want to delete this note? This action is permanent and cannot be undone.
              </p>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setNoteToDelete(null)}
                  disabled={deleting}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={deleting}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-lg shadow-rose-600/25 active:scale-95 cursor-pointer flex items-center gap-2"
                >
                  {deleting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Delete Note
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🚀 Floating Action Button (FAB) with Hide-on-Scroll Spin Animation */}
      <motion.button
        onClick={() => {
          sound.playPop();
          onNewNote();
        }}
        initial={{ scale: 0, rotate: -180, opacity: 0 }}
        animate={isFabVisible 
          ? { scale: 1, rotate: 0, opacity: 1, y: 0 } 
          : { scale: 0, rotate: 180, opacity: 0, y: 35 }
        }
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 320, damping: 24 }}
        className="hidden md:flex fixed md:bottom-8 md:right-8 z-40 w-16 h-16 rounded-3xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white border-2 border-white/25 dark:border-white/10 items-center justify-center cursor-pointer group shadow-xl"
        aria-label="Create New Note"
      >
        <Plus className="w-7 h-7 md:w-8 md:h-8 stroke-[2.5]" />
        
        {/* Tooltip on Desktop hover */}
        <span className="hidden md:block absolute right-full mr-3.5 top-1/2 -translate-y-1/2 bg-slate-900/90 dark:bg-slate-800/90 text-white text-xs font-bold px-3 py-1.5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-md border border-white/10">
          Create Note
        </span>
      </motion.button>

    </div>
  );
}
