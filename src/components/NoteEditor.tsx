import React, { useState, useEffect, useCallback, useRef } from 'react';
import { collection, doc, setDoc, deleteDoc, serverTimestamp, Timestamp, getDocs, addDoc, query, where, onSnapshot } from 'firebase/firestore';
import { User as FirebaseUser } from 'firebase/auth';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { Note, Attachment } from '../types';
import { ArrowLeft, Save, Trash2, Paperclip, X, Download, FileText, Image as ImageIcon, Plus, Tag, Palette, Check, Loader2, Bold, Italic, List, ListOrdered, Link, Heading1, Quote, Undo, Redo, UploadCloud, Sparkles, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useToast } from '../contexts/ToastContext';
import { format } from 'date-fns';

interface NoteEditorProps {
  user: FirebaseUser;
  note: Note | null;
  onBack: () => void;
}

const COLORS = [
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Rose', value: '#f43f5e' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Sky', value: '#0ea5e9' },
  { name: 'Violet', value: '#8b5cf6' },
  { name: 'Slate', value: '#64748b' },
];

const ToolbarButton = ({ icon, onClick, title, isActive }: { icon: React.ReactNode, onClick: () => void, title: string, isActive?: boolean }) => (
  <button 
    type="button"
    onClick={onClick} 
    title={title}
    className={`p-2 rounded-lg transition-colors cursor-pointer ${isActive ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800'}`}
  >
    {icon}
  </button>
);

export default function NoteEditor({ user, note, onBack }: NoteEditorProps) {
  const [currentNoteId, setCurrentNoteId] = useState<string | null>(note?.id || null);
  const [title, setTitle] = useState(note?.title || '');
  const [body, setBody] = useState(note?.body || '');
  const [tags, setTags] = useState(note?.tags.join(', ') || '');
  const [color, setColor] = useState(note?.color || COLORS[0].value);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const { showToast } = useToast();
  const contentRef = useRef<HTMLDivElement>(null);
  const fontMenuRef = useRef<HTMLDivElement>(null);
  const [activeFormats, setActiveFormats] = useState({ bold: false, italic: false, unorderedList: false, orderedList: false });
  const [isDragging, setIsDragging] = useState(false);
  const [viewingAttachment, setViewingAttachment] = useState<Attachment | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activeFont, setActiveFont] = useState<'sans' | 'serif' | 'mono'>('sans');
  const [showFontMenu, setShowFontMenu] = useState(false);

  // Click-Outside Listener for Custom Font Dropdown Menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (fontMenuRef.current && !fontMenuRef.current.contains(event.target as Node)) {
        setShowFontMenu(false);
      }
    }
    if (showFontMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showFontMenu]);

  const updateFormatState = () => {
    setActiveFormats({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      unorderedList: document.queryCommandState('insertUnorderedList'),
      orderedList: document.queryCommandState('insertOrderedList')
    });
  };

  useEffect(() => {
    if (contentRef.current && contentRef.current.innerHTML !== body) {
      if (!body && contentRef.current.innerHTML) return;
      contentRef.current.innerHTML = body;
    }
  }, [currentNoteId]);

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    setBody(e.currentTarget.innerHTML);
  };

  const handleFormat = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    if (contentRef.current) {
      setBody(contentRef.current.innerHTML);
      contentRef.current.focus();
    }
    updateFormatState();
  };

  const handleListToggle = (command: string) => {
    const isActive = document.queryCommandState(command);
    
    // Toggle the list
    document.execCommand(command, false);
    
    // If it was active (turning OFF), shift to next line
    if (isActive) {
      // Standard behavior of execCommand turns <li> into <p> or <div>.
      // To shift to next line, we insert a paragraph.
      document.execCommand('insertParagraph', false);
    }
    
    if (contentRef.current) {
      setBody(contentRef.current.innerHTML);
      contentRef.current.focus();
    }
    updateFormatState();
  };

  const toggleBlock = (blockType: string, tagName: string) => {
    const selection = window.getSelection();
    let isBlock = false;
    
    if (selection && selection.rangeCount > 0) {
      let node: Node | null = selection.getRangeAt(0).commonAncestorContainer;
      while (node && node.nodeName !== 'DIV') {
        if (node.nodeName === tagName.toUpperCase()) {
          isBlock = true;
          break;
        }
        node = node.parentNode;
      }
    }

    if (isBlock) {
      document.execCommand('formatBlock', false, 'P');
    } else {
      document.execCommand('formatBlock', false, blockType);
    }

    if (contentRef.current) {
      setBody(contentRef.current.innerHTML);
      contentRef.current.focus();
    }
  };

  // Load attachments
  useEffect(() => {
    if (!currentNoteId) return;

    const q = query(collection(db, `notes/${currentNoteId}/attachments`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const attachmentsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Attachment[];
      setAttachments(attachmentsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `notes/${currentNoteId}/attachments`, true);
    });

    return () => unsubscribe();
  }, [currentNoteId]);

  const [lastSavedData, setLastSavedData] = useState({ title, body, tags, color });

  const handleSave = useCallback(async () => {
    if (!user || !title.trim()) return;

    setSaving(true);
    const noteId = currentNoteId || doc(collection(db, 'notes')).id;
    const isNewNote = !currentNoteId;
    
    const noteData = {
      userId: user.uid,
      title,
      body,
      tags: tags.split(',').map(t => t.trim()).filter(t => t),
      color,
      updatedAt: serverTimestamp(),
      ...(isNewNote ? { createdAt: serverTimestamp() } : {})
    };

    try {
      await setDoc(doc(db, 'notes', noteId), noteData, { merge: true });
      setLastSaved(new Date());
      setLastSavedData({ title, body, tags, color });
      if (isNewNote) {
        setCurrentNoteId(noteId);
        showToast('Note created successfully', 'success');
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `notes/${noteId}`);
      showToast('Failed to save note', 'error');
    } finally {
      setSaving(false);
    }
  }, [currentNoteId, title, body, tags, color, showToast]);

  // Auto-save every 10 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      const hasChanges = 
        title !== lastSavedData.title || 
        body !== lastSavedData.body || 
        tags !== lastSavedData.tags || 
        color !== lastSavedData.color;

      if (title.trim() && hasChanges) {
        handleSave();
      }
    }, 10000);
    return () => clearInterval(timer);
  }, [handleSave, title, body, tags, color, lastSavedData]);

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    setShowDeleteConfirm(false);
    if (!currentNoteId) return;

    try {
      await deleteDoc(doc(db, 'notes', currentNoteId));
      showToast('Note deleted', 'success');
      onBack();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `notes/${currentNoteId}`);
      showToast('Failed to delete note', 'error');
    }
  };

  const handleFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;

    let targetNoteId = currentNoteId;

    if (!targetNoteId) {
      let finalTitle = title.trim();
      if (!finalTitle) {
        finalTitle = 'Untitled Note';
        setTitle(finalTitle);
      }
      
      setSaving(true);
      const newDocRef = doc(collection(db, 'notes'));
      targetNoteId = newDocRef.id;
      
      const noteData = {
        userId: user?.uid,
        title: finalTitle,
        body,
        tags: tags.split(',').map(t => t.trim()).filter(t => t),
        color,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      try {
        await setDoc(newDocRef, noteData);
        setCurrentNoteId(targetNoteId);
        setLastSaved(new Date());
        setLastSavedData({ title, body, tags, color });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `notes/${targetNoteId}`);
        showToast('Failed to create note for attachment', 'error');
        setSaving(false);
        return;
      }
      setSaving(false);
    }

    for (const file of Array.from(files)) {
      if (file.size > 1024 * 1024) {
        showToast(`File ${file.name} is too large (max 1MB)`, 'error');
        continue;
      }

      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        try {
          await addDoc(collection(db, `notes/${targetNoteId}/attachments`), {
            name: file.name,
            type: file.type,
            size: file.size,
            data: base64,
            createdAt: serverTimestamp()
          });
          showToast(`Attached ${file.name}`, 'success');
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, `notes/${targetNoteId}/attachments`);
          showToast(`Failed to attach ${file.name}`, 'error');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
  };

  const deleteAttachment = async (attachmentId: string) => {
    if (!currentNoteId) return;
    try {
      await deleteDoc(doc(db, `notes/${currentNoteId}/attachments`, attachmentId));
      showToast('Attachment removed', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `notes/${currentNoteId}/attachments/${attachmentId}`);
      showToast('Failed to remove attachment', 'error');
    }
  };

  const downloadAttachment = (attachment: Attachment) => {
    const link = document.createElement('a');
    link.href = attachment.data;
    link.download = attachment.name;
    link.click();
  };

  const textContent = body.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
  const wordCount = textContent ? textContent.split(/\s+/).filter(w => w).length : 0;
  const charCount = textContent.length;

  return (
    <div 
      className="min-h-screen bg-white dark:bg-slate-900 flex flex-col relative"
      onDragOver={handleDragOver}
      onDragEnter={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-indigo-600/10 dark:bg-indigo-400/10 backdrop-blur-[2px] flex items-center justify-center p-8 pointer-events-none"
          >
            <div className="w-full h-full border-4 border-dashed border-indigo-500 rounded-3xl flex flex-col items-center justify-center gap-4 bg-white/40 dark:bg-slate-900/40">
              <div className="p-6 bg-indigo-600 text-white rounded-full shadow-2xl shadow-indigo-200 dark:shadow-none animate-bounce">
                <UploadCloud className="w-12 h-12" />
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">Release to Upload</p>
                <p className="text-slate-500 dark:text-slate-400 font-medium">Drop your files here to attach them to this note</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {viewingAttachment && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setViewingAttachment(null)}
            className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4 md:p-8"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-4xl w-full max-h-full bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                    {viewingAttachment.type.startsWith('image/') ? <ImageIcon className="w-5 h-5 text-indigo-600" /> : <FileText className="w-5 h-5 text-indigo-600" />}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">{viewingAttachment.name}</h3>
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest">{(viewingAttachment.size / 1024).toFixed(1)} KB • {viewingAttachment.type}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => downloadAttachment(viewingAttachment)}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-400 transition-all cursor-pointer"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => setViewingAttachment(null)}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-400 transition-all cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-auto p-4 flex items-center justify-center min-h-[300px] bg-slate-50/30 dark:bg-slate-950/30">
                {viewingAttachment.type.startsWith('image/') ? (
                  <img 
                    src={viewingAttachment.data} 
                    alt={viewingAttachment.name} 
                    className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-6 text-center py-12">
                    <div className="p-8 bg-indigo-50 dark:bg-indigo-900/20 rounded-full">
                      <FileText className="w-16 h-16 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-lg font-bold text-slate-900 dark:text-white">Preview not available</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs">
                        This file type doesn't support in-app viewing. Use the download button to view it on your device.
                      </p>
                      <button 
                        onClick={() => downloadAttachment(viewingAttachment)}
                        className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-indigo-200 dark:shadow-none cursor-pointer"
                      >
                        Download File
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toolbar */}
      <div className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-md border-b border-slate-900 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-900 rounded-lg transition-all cursor-pointer text-slate-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          {/* Breathing Auto-Save Pulse Indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/60 border border-slate-850 rounded-full select-none shrink-0 shadow-md">
            {saving ? (
              <div className="flex items-center gap-1.5 text-[9px] font-bold text-indigo-400 uppercase tracking-widest">
                <span className="w-2 h-2 bg-indigo-500 rounded-full animate-ping" />
                Saving...
              </div>
            ) : lastSaved ? (
              <div className="flex items-center gap-1.5 text-[9px] font-bold text-emerald-400 uppercase tracking-widest">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                Cloud Synced
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                <span className="w-2 h-2 bg-slate-600 rounded-full" />
                Draft Offline
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Custom Premium Font Switcher */}
          <div className="relative" ref={fontMenuRef}>
            <button
              type="button"
              onClick={() => setShowFontMenu(prev => !prev)}
              className="bg-slate-900 border border-slate-800 text-slate-300 hover:text-white rounded-xl px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider outline-none focus:ring-1 focus:ring-indigo-500/40 cursor-pointer transition-all duration-200 flex items-center gap-1.5 min-w-[125px] justify-between shadow-md"
            >
              <span>{activeFont === 'sans' ? 'Outfit Sans' : activeFont === 'serif' ? 'Playfair Serif' : 'Fira Mono'}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            </button>
            <AnimatePresence>
              {showFontMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-44 z-50 bg-slate-950/95 border border-slate-850 rounded-xl p-1.5 shadow-2xl backdrop-blur-md space-y-0.5"
                >
                  {[
                    { value: 'sans', label: 'Outfit Sans', desc: 'Modern Tech' },
                    { value: 'serif', label: 'Playfair Serif', desc: 'Elegant Editorial' },
                    { value: 'mono', label: 'Fira Mono', desc: 'Developer Code' }
                  ].map(item => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => {
                        setActiveFont(item.value as any);
                        setShowFontMenu(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-all cursor-pointer flex flex-col justify-start gap-0.5 ${activeFont === item.value ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'}`}
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider">{item.label}</span>
                      <span className={`text-[8px] font-semibold tracking-wide ${activeFont === item.value ? 'text-indigo-200' : 'text-slate-500'}`}>{item.desc}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>


          {currentNoteId && (
            <button onClick={handleDeleteClick} className="p-2 text-red-400 hover:bg-red-950/20 rounded-xl transition-all cursor-pointer">
              <Trash2 className="w-5 h-5" />
            </button>
          )}

          <button onClick={handleSave} className="bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all cursor-pointer text-xs uppercase tracking-wider">
            <Save className="w-4 h-4" />
            Save
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
        {/* Left Pane: Metadata */}
        <div className="w-full lg:w-80 lg:border-r border-slate-100 dark:border-slate-800 overflow-y-auto p-6 space-y-8 bg-slate-50/50 dark:bg-slate-900/50">
            {/* Title */}
            <div className="space-y-4">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Title</label>
              <input
                type="text"
                placeholder="Note Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full text-2xl font-bold bg-transparent border-none outline-none text-slate-900 dark:text-white placeholder:text-slate-200 dark:placeholder:text-slate-700"
              />
            </div>

            {/* Color Picker */}
            <div className="space-y-4">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Theme Color</label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map(c => (
                  <button
                    key={c.value}
                    onClick={() => setColor(c.value)}
                    className={`w-7 h-7 rounded-full border-2 transition-all cursor-pointer flex items-center justify-center ${color === c.value ? 'border-slate-900 dark:border-white scale-110' : 'border-transparent opacity-50 hover:opacity-100'}`}
                    style={{ backgroundColor: c.value }}
                  >
                    {color === c.value && <Check className="w-3 h-3 text-white" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-4">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tags</label>
              <div className="flex items-center gap-3 text-slate-400 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-3 rounded-xl">
                <Tag className="w-4 h-4" />
                <input
                  type="text"
                  placeholder="Add tags..."
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  className="flex-1 bg-transparent border-none outline-none text-xs text-slate-700 dark:text-slate-300"
                />
              </div>
            </div>

            {/* Attachments Section */}
            <div className="space-y-4 pt-8 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Paperclip className="w-4 h-4" />
                  Files
                </h3>
                <label className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 p-2 rounded-lg text-slate-600 dark:text-slate-400 transition-all cursor-pointer border border-slate-100 dark:border-slate-700">
                  <Plus className="w-4 h-4" />
                  <input type="file" multiple className="hidden" onChange={handleFileUpload} />
                </label>
              </div>

              {!currentNoteId && (
                <p className="text-[10px] text-slate-400 italic">Adding a file will auto-save the note.</p>
              )}

              <div className="space-y-2">
                <AnimatePresence>
                  {attachments.map(file => (
                    <motion.div
                      key={file.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      onClick={() => setViewingAttachment(file)}
                      className="group relative bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3 flex items-center gap-3 cursor-pointer hover:border-indigo-200 dark:hover:border-indigo-900 transition-all"
                    >
                      <div className="w-8 h-8 bg-slate-50 dark:bg-slate-900 rounded-lg flex items-center justify-center border border-slate-100 dark:border-slate-800 overflow-hidden flex-shrink-0">
                        {file.type.startsWith('image/') ? (
                          <img src={file.data} alt={file.name} className="w-full h-full object-cover" />
                        ) : (
                          <FileText className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-slate-900 dark:text-white truncate">{file.name}</p>
                        <p className="text-[9px] text-slate-400 uppercase tracking-widest">{(file.size / 1024).toFixed(1)} KB</p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button onClick={(e) => { e.stopPropagation(); downloadAttachment(file); }} className="p-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-400 cursor-pointer">
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); deleteAttachment(file.id); }} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-500 cursor-pointer">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>

        {/* Right Pane: Content */}
        <div className="flex-1 flex flex-col overflow-y-auto bg-white dark:bg-slate-900 border-l border-transparent">
          {/* Formatting Toolbar */}
          <div className="flex flex-wrap items-center gap-1 p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 sticky top-0 z-10 transition-all w-full">
            <ToolbarButton icon={<Undo className="w-4 h-4" />} onClick={() => handleFormat('undo')} title="Undo" />
            <ToolbarButton icon={<Redo className="w-4 h-4" />} onClick={() => handleFormat('redo')} title="Redo" />
            <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />
            <ToolbarButton icon={<Bold className="w-4 h-4" />} onClick={() => handleFormat('bold')} title="Bold" isActive={activeFormats.bold} />
            <ToolbarButton icon={<Italic className="w-4 h-4" />} onClick={() => handleFormat('italic')} title="Italic" isActive={activeFormats.italic} />
            <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />
            <ToolbarButton icon={<Heading1 className="w-4 h-4" />} onClick={() => toggleBlock('H1', 'H1')} title="Heading" />
            <ToolbarButton icon={<Quote className="w-4 h-4" />} onClick={() => toggleBlock('BLOCKQUOTE', 'BLOCKQUOTE')} title="Quote" />
            <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />
            <ToolbarButton icon={<List className="w-4 h-4" />} onClick={() => handleListToggle('insertUnorderedList')} title="Bullet List" isActive={activeFormats.unorderedList} />
            <ToolbarButton icon={<ListOrdered className="w-4 h-4" />} onClick={() => handleListToggle('insertOrderedList')} title="Numbered List" isActive={activeFormats.orderedList} />
            <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />
            <ToolbarButton icon={<Link className="w-4 h-4" />} onClick={() => {
              const url = prompt('Enter link URL:');
              if (url) handleFormat('createLink', url);
            }} title="Link" />
          </div>


          <div
            ref={contentRef}
            contentEditable
            onInput={handleInput}
            onKeyUp={updateFormatState}
            onMouseUp={updateFormatState}
            className={`editor-content w-full flex-1 min-h-[500px] lg:min-h-0 p-6 md:p-12 bg-transparent border-none outline-none text-lg text-slate-700 dark:text-slate-350 leading-relaxed overflow-y-auto ${
              activeFont === 'sans' ? 'font-sans' : activeFont === 'serif' ? 'font-serif font-medium tracking-wide' : 'font-mono text-base'
            }`}
            style={{ minHeight: '500px' }}
          />

          {/* Word and Character Counter Footer */}
          <div className="bg-slate-950/40 border-t border-slate-900 px-6 py-2.5 flex items-center justify-between text-[9px] font-bold text-slate-500 uppercase tracking-widest select-none shrink-0">
            <div className="flex items-center gap-4">
              <span>Words: <span className="text-indigo-400 font-black">{wordCount}</span></span>
              <span>Characters: <span className="text-indigo-400 font-black">{charCount}</span></span>
            </div>
            {lastSaved && (
              <span>Synced at {format(lastSaved, 'HH:mm:ss')}</span>
            )}
          </div>
        </div>
      </div>

      {/* Reusable Premium Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowDeleteConfirm(false)}
            className="fixed inset-0 z-[150] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="max-w-md w-full bg-slate-900 border border-slate-800 backdrop-blur-2xl rounded-3xl p-6 shadow-2xl space-y-6 text-center"
            >
              <div className="flex justify-center">
                <div className="p-4 bg-red-950/40 border border-red-900/30 text-red-500 rounded-full animate-pulse">
                  <Trash2 className="w-8 h-8" />
                </div>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-white">Delete Note</h3>
                <p className="text-slate-400 text-sm font-medium leading-relaxed">
                  Are you sure you want to delete this note? This action cannot be undone.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 font-bold py-3 rounded-xl transition-all cursor-pointer text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-red-600/10 hover:shadow-red-600/20 active:translate-y-0 transition-all cursor-pointer text-sm"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
