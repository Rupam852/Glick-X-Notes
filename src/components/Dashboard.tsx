import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, Timestamp } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { Note } from '../types';
import { Search, Plus, Filter, SortDesc, SortAsc, Tag, Paperclip, Calendar, Clock, MoreVertical, Trash2, Edit2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';

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

  const filteredNotes = notes.filter(note => 
    note.title.toLowerCase().includes(search.toLowerCase()) ||
    note.body.toLowerCase().includes(search.toLowerCase()) ||
    note.tags.some(tag => tag.toLowerCase().includes(search.toLowerCase()))
  );

  const totalStorage = notes.reduce((acc, note) => acc + (note.body.length * 2), 0); // Rough estimate in bytes

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header & Summary */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">My Notes</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            {notes.length} notes • {(totalStorage / 1024).toFixed(2)} KB used
          </p>
        </div>
        <button
          onClick={onNewNote}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none transition-all flex items-center justify-center gap-2 font-semibold cursor-pointer"
        >
          <Plus className="w-5 h-5" />
          Create New Note
        </button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search notes, tags, content..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="updatedAt">Last Modified</option>
            <option value="createdAt">Date Created</option>
            <option value="title">Title</option>
          </select>
          <button
            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all cursor-pointer"
          >
            {sortOrder === 'asc' ? <SortAsc className="w-5 h-5" /> : <SortDesc className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Notes Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : filteredNotes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredNotes.map(note => (
              <motion.div
                key={note.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={() => onEditNote(note)}
                className="group relative bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-none transition-all cursor-pointer overflow-hidden"
              >
                {/* Color Strip */}
                <div 
                  className="absolute top-0 left-0 w-full h-1.5" 
                  style={{ backgroundColor: note.color || '#6366f1' }}
                />

                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white line-clamp-1">{note.title}</h3>
                    <div className="flex items-center gap-1 text-slate-400">
                      {note.attachmentCount ? (
                        <div className="flex items-center gap-0.5 text-xs font-medium">
                          <Paperclip className="w-3.5 h-3.5" />
                          {note.attachmentCount}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <p className="text-slate-500 dark:text-slate-400 text-sm line-clamp-3 leading-relaxed">
                    {note.body.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ')}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {note.tags.map(tag => (
                      <span key={tag} className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold uppercase tracking-wider rounded-md">
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-[10px] font-medium text-slate-400 uppercase tracking-widest">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {format(note.updatedAt.toDate(), 'MMM d, yyyy')}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {format(note.updatedAt.toDate(), 'HH:mm')}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <div className="p-6 bg-slate-100 dark:bg-slate-800 rounded-full">
            <Edit2 className="w-12 h-12 text-slate-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">No notes found</h3>
            <p className="text-slate-500 dark:text-slate-400">Start by creating your first note!</p>
          </div>
          <button
            onClick={onNewNote}
            className="text-indigo-600 font-bold hover:underline cursor-pointer"
          >
            Create Note
          </button>
        </div>
      )}
    </div>
  );
}
