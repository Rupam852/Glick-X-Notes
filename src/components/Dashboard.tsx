import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Note } from '../types';
import { Search, Plus, SortDesc, SortAsc, Tag, Paperclip, Calendar, Clock, LayoutGrid, List, Sparkles, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';

const stripHtmlForPreview = (html: string) => {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<div[^>]*>/gi, '')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<li[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '') // Strip remaining tags
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ') // Collapse horizontal spaces, keep newlines
    .replace(/\n\s*\n/g, '\n') // Collapse consecutive newlines
    .trim();
};

interface DashboardProps {
  user: User;
  onEditNote: (note: Note) => void;
  onNewNote: () => void;
}

export default function Dashboard({ user, onEditNote, onNewNote }: DashboardProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'createdAt' | 'updatedAt' | 'title'>('updatedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

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

      // Client-side sorting to avoid requiring Firestore composite indexes
      notesData.sort((a, b) => {
        let valA: any = a[sortBy];
        let valB: any = b[sortBy];

        // Handle Firestore Timestamps
        if (valA instanceof Timestamp) valA = valA.toMillis();
        if (valB instanceof Timestamp) valB = valB.toMillis();
        
        // Handle cases where timestamp might be null (serverTimestamp pendings)
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

  // Extract all unique tags
  const allTags = Array.from(new Set(notes.flatMap(n => n.tags || [])));

  const filteredNotes = notes.filter(note => {
    const matchesSearch = 
      note.title.toLowerCase().includes(search.toLowerCase()) ||
      stripHtmlForPreview(note.body).toLowerCase().includes(search.toLowerCase()) ||
      note.tags.some(tag => tag.toLowerCase().includes(search.toLowerCase()));
    
    const matchesTag = selectedTag ? note.tags.includes(selectedTag) : true;
    
    return matchesSearch && matchesTag;
  });

  const totalStorage = notes.reduce((acc, note) => acc + (note.body.length * 2), 0); // Rough estimate in bytes

  // Search highlight helper
  const highlightText = (text: string, highlight: string) => {
    if (!highlight.trim()) return <span>{text}</span>;
    const regex = new RegExp(`(${highlight.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return (
      <span>
        {parts.map((part, i) => 
          regex.test(part) ? (
            <mark key={i} className="bg-indigo-500/30 text-indigo-300 dark:text-indigo-200 px-0.5 rounded font-semibold">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </span>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 select-none">
      {/* Premium Header Dashboard Banner */}
      <div className="relative overflow-hidden bg-slate-900/35 border border-slate-800/80 rounded-3xl p-8 backdrop-blur-3xl shadow-[0_0_50px_rgba(99,102,241,0.05)]">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-pink-500/5 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6 z-10">
          <div className="space-y-1">
            <h1 className="text-3.5xl font-black bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
              My Notes
            </h1>
            <p className="text-slate-400 text-sm font-medium">
              Manage your custom workflow across <span className="text-indigo-300 font-bold">{notes.length} dynamic nodes</span> • {(totalStorage / 1024).toFixed(2)} KB cloud storage
            </p>
          </div>
          <button
            onClick={onNewNote}
            className="flex items-center justify-center gap-2.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-bold px-6 py-4 rounded-2xl shadow-lg hover:shadow-[0_0_30px_rgba(99,102,241,0.25)] transition-all duration-200 active:translate-y-0.5 cursor-pointer text-sm uppercase tracking-wider font-black lg:w-auto w-full"
          >
            <Plus className="w-5 h-5" />
            Create New Note
          </button>
        </div>
      </div>

      {/* Advanced Control Panel */}
      <div className="bg-slate-900/20 border border-slate-900/60 p-4 rounded-2xl space-y-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Enhanced Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search notes, tags, content..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 bg-slate-950/60 border border-slate-850 focus:border-indigo-500/60 text-slate-100 rounded-xl outline-none transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)] focus:ring-1 focus:ring-indigo-500/20 text-sm"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Sorting select */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-950/60 border border-slate-850 hover:bg-slate-900/60 text-slate-200 rounded-xl px-4 py-3.5 text-xs font-bold uppercase tracking-wider outline-none focus:ring-1 focus:ring-indigo-500/40 cursor-pointer transition-all duration-200"
            >
              <option value="updatedAt">Last Modified</option>
              <option value="createdAt">Date Created</option>
              <option value="title">Title</option>
            </select>

            {/* Ascending / Descending Button */}
            <button
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="bg-slate-950/60 border border-slate-850 hover:bg-slate-900/60 p-3.5 rounded-xl text-slate-300 transition-all cursor-pointer shadow-md"
              title="Toggle Sort Order"
            >
              {sortOrder === 'asc' ? <SortAsc className="w-5 h-5" /> : <SortDesc className="w-5 h-5" />}
            </button>

            {/* Grid / List View Toggle */}
            <div className="flex bg-slate-950/80 border border-slate-850 p-1 rounded-xl shadow-md">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2.5 rounded-lg transition-all cursor-pointer ${viewMode === 'grid' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
                title="Grid View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2.5 rounded-lg transition-all cursor-pointer ${viewMode === 'list' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
                title="List View"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Horizontal Tags List */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-2 pt-2 border-t border-slate-900/40 overflow-x-auto pb-1 no-scrollbar">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0 flex items-center gap-1">
              <Tag className="w-3 h-3" /> Filter by:
            </span>
            <button
              onClick={() => setSelectedTag(null)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer shrink-0 ${!selectedTag ? 'bg-indigo-600/20 border border-indigo-500/40 text-indigo-300' : 'bg-slate-950/40 border border-slate-850 text-slate-400 hover:text-slate-200'}`}
            >
              All Tags
            </button>
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer shrink-0 ${selectedTag === tag ? 'bg-indigo-600/30 border border-indigo-500/60 text-indigo-300 shadow-[0_0_10px_rgba(99,102,241,0.1)]' : 'bg-slate-950/40 border border-slate-850 text-slate-400 hover:text-slate-200'}`}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Grid or List View rendering */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 bg-slate-900/30 border border-slate-850/60 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : filteredNotes.length > 0 ? (
        viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
              {filteredNotes.map(note => (
                <motion.div
                  key={note.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  onClick={() => onEditNote(note)}
                  className="group relative bg-slate-900/20 hover:bg-slate-900/40 border border-slate-850 hover:border-indigo-500/30 rounded-2xl p-6 shadow-md hover:shadow-[0_0_30px_rgba(99,102,241,0.08)] transition-all duration-300 cursor-pointer overflow-hidden flex flex-col justify-between min-h-[200px]"
                >
                  {/* Left Border color bar */}
                  <div 
                    className="absolute top-0 left-0 w-1.5 h-full" 
                    style={{ backgroundColor: note.color || '#6366f1' }}
                  />

                  <div className="space-y-4 pl-2">
                    <div className="flex justify-between items-start gap-4">
                      <h3 className="font-bold text-lg text-slate-100 group-hover:text-indigo-300 transition-colors duration-200 line-clamp-1">
                        {highlightText(note.title, search)}
                      </h3>
                      {note.attachmentCount ? (
                        <div className="flex items-center gap-0.5 text-[10px] font-bold text-slate-400 bg-slate-950/60 border border-slate-850 px-2 py-1 rounded-md">
                          <Paperclip className="w-3 h-3 text-indigo-400" />
                          {note.attachmentCount}
                        </div>
                      ) : null}
                    </div>

                    <p className="text-slate-400 text-sm line-clamp-3 leading-relaxed font-medium whitespace-pre-line break-words">
                      {highlightText(stripHtmlForPreview(note.body), search)}
                    </p>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-slate-900 pl-2 mt-auto">
                    {/* Tags */}
                    {note.tags && note.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {note.tags.map(tag => (
                          <span key={tag} className="px-2 py-0.5 bg-slate-950/80 border border-slate-850 text-indigo-400 text-[9px] font-bold uppercase tracking-wider rounded-md">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Metadata Footer */}
                    <div className="flex items-center justify-between text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        {format(note.updatedAt.toDate(), 'MMM d, yyyy')}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        {format(note.updatedAt.toDate(), 'HH:mm')}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          /* Premium Compact List View rendering */
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {filteredNotes.map(note => (
                <motion.div
                  key={note.id}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  onClick={() => onEditNote(note)}
                  className="group relative bg-slate-900/20 hover:bg-slate-900/40 border border-slate-850 hover:border-indigo-500/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer transition-all duration-200 overflow-hidden"
                >
                  <div 
                    className="absolute top-0 left-0 w-1.5 h-full" 
                    style={{ backgroundColor: note.color || '#6366f1' }}
                  />

                  <div className="flex items-center gap-4 pl-3 flex-1">
                    <BookOpen className="w-5 h-5 text-indigo-400 shrink-0" />
                    <div className="space-y-1">
                      <h3 className="font-bold text-base text-slate-100 group-hover:text-indigo-300 transition-colors duration-200">
                        {highlightText(note.title, search)}
                      </h3>
                      <p className="text-slate-400 text-xs line-clamp-1 max-w-xl whitespace-pre-line break-words">
                        {stripHtmlForPreview(note.body)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 pl-3 sm:pl-0 shrink-0">
                    {/* Tags */}
                    {note.tags && note.tags.length > 0 && (
                      <div className="flex gap-1.5">
                        {note.tags.slice(0, 2).map(tag => (
                          <span key={tag} className="px-2 py-0.5 bg-slate-950/80 border border-slate-850 text-indigo-400 text-[8px] font-bold uppercase tracking-wider rounded-md">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Datetime Stamp */}
                    <div className="flex items-center gap-3 text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {format(note.updatedAt.toDate(), 'MMM d')}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {format(note.updatedAt.toDate(), 'HH:mm')}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 bg-slate-900/10 border border-slate-900 rounded-3xl p-8">
          <div className="p-5 bg-slate-950 border border-slate-850 rounded-2xl shadow-lg relative">
            <div className="absolute inset-0 bg-indigo-500/10 rounded-2xl blur-lg animate-pulse" />
            <BookOpen className="w-12 h-12 text-indigo-400 relative z-10" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-bold text-slate-200">Directory Node Empty</h3>
            <p className="text-slate-400 text-sm max-w-xs mx-auto">
              No matching notes found inside this workspace folder. Create a new note to start!
            </p>
          </div>
          <button
            onClick={onNewNote}
            className="text-indigo-400 font-bold hover:text-indigo-300 cursor-pointer text-xs uppercase tracking-wider border-b border-indigo-400/40 pb-0.5 hover:border-indigo-300 transition-colors"
          >
            Create First Note
          </button>
        </div>
      )}
    </div>
  );
}
