import React, { useState, useEffect, useCallback, useRef } from 'react';
import { collection, doc, setDoc, deleteDoc, serverTimestamp, Timestamp, getDocs, addDoc, query, where, onSnapshot } from 'firebase/firestore';
import { User as FirebaseUser } from 'firebase/auth';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { Note, Attachment } from '../types';
import { ArrowLeft, Save, Trash2, Paperclip, X, Download, FileText, Image as ImageIcon, Plus, Tag, Palette, Check, Loader2, Bold, Italic, List, ListOrdered, Link, Heading1, Quote, Undo, Redo, UploadCloud, Sparkles, ChevronDown, ChevronUp, Underline, Strikethrough, Code, Highlighter, Eraser, CornerDownLeft, Type, AlignLeft, AlignCenter, AlignRight, CheckSquare, Table } from 'lucide-react';
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

const rgbToHex = (color: string) => {
  if (!color) return '';
  if (color.startsWith('#')) return color.toLowerCase();
  const match = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return '';
  return '#' + match.slice(1).map(n => parseInt(n, 10).toString(16).padStart(2, '0')).join('').toLowerCase();
};

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
  const [activeFormats, setActiveFormats] = useState({ bold: false, italic: false, underline: false, strikeThrough: false, unorderedList: false, orderedList: false, pre: false, h1: false, blockquote: false, highlight: false, justifyLeft: false, justifyCenter: false, justifyRight: false, fontSize: '16', fontColor: '', isInsideTable: false });
  const [isDragging, setIsDragging] = useState(false);
  const [viewingAttachment, setViewingAttachment] = useState<Attachment | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activeFont, setActiveFont] = useState<'sans' | 'serif' | 'mono'>('sans');
  const [focusMode, setFocusMode] = useState(false);
  const [showFontMenu, setShowFontMenu] = useState(false);
  const [activePopup, setActivePopup] = useState<'text' | 'paragraph' | 'table' | 'tableActions' | null>(null);
  const [hoveredTable, setHoveredTable] = useState({ row: -1, col: -1 });
  const [customRows, setCustomRows] = useState('3');
  const [customCols, setCustomCols] = useState('3');
  const [localFontSize, setLocalFontSize] = useState('16');
  const popupRef = useRef<HTMLDivElement>(null);
  // Always-fresh ref to the editor's live HTML — used by save to avoid stale closure
  const liveBodyRef = useRef(note?.body || '');

  useEffect(() => {
    setLocalFontSize(Math.round(parseFloat(activeFormats.fontSize) || 16).toString());
  }, [activeFormats.fontSize]);

  // Click-Outside Listener — always active, closes both font menu and active popups
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (fontMenuRef.current && !fontMenuRef.current.contains(event.target as Node)) {
        setShowFontMenu(false);
      }
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setActivePopup(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const updateFormatState = () => {
    let isPre = false;
    let isBlockquote = false;
    let isH1 = false;
    
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      let node: Node | null = selection.anchorNode;
      while (node && node !== contentRef.current) {
        if (node.nodeName === 'PRE') isPre = true;
        if (node.nodeName === 'BLOCKQUOTE') isBlockquote = true;
        if (node.nodeName === 'H1') isH1 = true;
        if (isPre || isBlockquote || isH1) break;
        node = node.parentNode;
      }
    }
    

    // Check highlight (background color)
    const bgColor = document.queryCommandValue('backColor');
    const isHighlighted = bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent' && bgColor !== 'rgb(255, 255, 255)' && bgColor !== '#ffffff' && bgColor !== 'false';

    // Check exact pixel font size
    let currentFontSize = '16';
    if (selection && selection.rangeCount > 0) {
      const parentNode = selection.focusNode?.parentElement;
      if (parentNode) {
        const computedSize = window.getComputedStyle(parentNode).fontSize;
        let parsed = Math.round(parseFloat(computedSize));
        // Map legacy browser font size indexes (1-7) to clean pixel sizes
        if (parsed <= 7) {
          const legacyMap: Record<number, number> = {
            1: 10,
            2: 12,
            3: 16,
            4: 18,
            5: 24,
            6: 32,
            7: 48
          };
          parsed = legacyMap[parsed] || 16;
        }
        currentFontSize = parsed.toString();
      }
    }

    // Check if inside table
    let isInsideTable = false;
    if (selection && selection.rangeCount > 0) {
      let node: Node | null = selection.getRangeAt(0).commonAncestorContainer;
      while (node && node !== contentRef.current) {
        if (node.nodeName === 'TD' || node.nodeName === 'TH' || node.nodeName === 'TABLE') {
          isInsideTable = true;
          break;
        }
        node = node.parentNode;
      }
    }

    setActiveFormats({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      strikeThrough: document.queryCommandState('strikeThrough'),
      unorderedList: document.queryCommandState('insertUnorderedList'),
      orderedList: document.queryCommandState('insertOrderedList'),
      pre: isPre,
      blockquote: isBlockquote,
      h1: isH1,
      highlight: !!isHighlighted,
      justifyLeft: document.queryCommandState('justifyLeft'),
      justifyCenter: document.queryCommandState('justifyCenter'),
      justifyRight: document.queryCommandState('justifyRight'),
      fontSize: currentFontSize,
      fontColor: document.queryCommandValue('foreColor') || '',
      isInsideTable
    });
  };

  // Keep a ref that always reflects the latest body so the sync effect can read it fresh
  const bodyRef = React.useRef(body);
  useEffect(() => { bodyRef.current = body; }, [body]);

  // isPrevNewNote tracks if we were in new-note state before currentNoteId was assigned
  const prevNoteIdRef = useRef<string | null>(note?.id || null);

  useEffect(() => {
    if (!contentRef.current) return;
    // If switching TO a different existing note, load its content
    // If currentNoteId just got set because a new note was saved, do NOT clobber
    // (the editor already has the user's typed content)
    const isNewlySaved = prevNoteIdRef.current === null && currentNoteId !== null;
    prevNoteIdRef.current = currentNoteId;
    if (isNewlySaved) return; // user just created a note — editor content is already correct

    contentRef.current.innerHTML = bodyRef.current;
    liveBodyRef.current = bodyRef.current;
    // Move caret to end
    contentRef.current.focus();
    try {
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(contentRef.current);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    } catch (e) { /* ignore */ }
  }, [currentNoteId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const html = e.currentTarget.innerHTML;
    liveBodyRef.current = html;
    setBody(html);
  };

  const handleFormat = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    if (contentRef.current) {
      setBody(contentRef.current.innerHTML);
      contentRef.current.focus();
    }
    updateFormatState();
    setActivePopup(null);
  };
  const handleHighlight = () => {
    if (activeFormats.highlight) {
      document.execCommand('hiliteColor', false, 'transparent');
      document.execCommand('backColor', false, 'transparent');
    } else {
      document.execCommand('hiliteColor', false, '#fcd34d');
      document.execCommand('backColor', false, '#fcd34d');
    }
    if (contentRef.current) {
      setBody(contentRef.current.innerHTML);
      contentRef.current.focus();
    }
    updateFormatState();
    setActivePopup(null);
  };

  const handleClearFormatting = () => {
    document.execCommand('removeFormat', false, '');
    document.execCommand('hiliteColor', false, 'transparent');
    document.execCommand('backColor', false, 'transparent');
    if (contentRef.current) {
      setBody(contentRef.current.innerHTML);
      contentRef.current.focus();
    }
    updateFormatState();
    setActivePopup(null);
  };

  const handleFontSize = (px: number) => {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    if (range.collapsed) {
      // Check if already inside a size-only span (caret span)
      const parent = range.startContainer.parentElement;
      if (
        parent &&
        parent.tagName === 'SPAN' &&
        parent.style.fontSize &&
        parent.childNodes.length === 1 &&
        (parent.textContent === '' || parent.textContent === '\u200B')
      ) {
        parent.style.fontSize = px + 'px';
      } else {
        const span = document.createElement('span');
        span.style.fontSize = px + 'px';
        span.innerHTML = '&#8203;'; // Zero Width Space caret anchor
        range.insertNode(span);
        const newRange = document.createRange();
        newRange.setStart(span.firstChild!, 1);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
      }
    } else {
      // Use extractContents + clone to safely handle cross-element selections
      try {
        const fragment = range.extractContents();
        const span = document.createElement('span');
        span.style.fontSize = px + 'px';
        span.appendChild(fragment);
        range.insertNode(span);
        // Restore selection over newly inserted span
        const newRange = document.createRange();
        newRange.selectNodeContents(span);
        selection.removeAllRanges();
        selection.addRange(newRange);
      } catch (e) {
        // Last resort fallback
        document.execCommand('fontSize', false, '7');
        if (contentRef.current) {
          contentRef.current.querySelectorAll('font[size="7"]').forEach(f => {
            f.removeAttribute('size');
            (f as HTMLElement).style.fontSize = px + 'px';
          });
        }
      }
    }

    if (contentRef.current) {
      const html = contentRef.current.innerHTML;
      liveBodyRef.current = html;
      setBody(html);
    }
    updateFormatState();
  };

  const handleFontColor = (color: string) => {
    document.execCommand('foreColor', false, color);
    if (contentRef.current) {
      setBody(contentRef.current.innerHTML);
      contentRef.current.focus();
    }
    updateFormatState();
    setActivePopup(null);
  };

  const handleChecklist = () => {
    document.execCommand('insertHTML', false, '<input type="checkbox" style="margin-right: 8px; transform: scale(1.2); cursor: pointer;">&nbsp;');
    if (contentRef.current) {
      setBody(contentRef.current.innerHTML);
      contentRef.current.focus();
    }
  };

  const handleTable = () => {
    if (activeFormats.isInsideTable) {
      setActivePopup(p => p === 'tableActions' ? null : 'tableActions');
    } else {
      setActivePopup(p => p === 'table' ? null : 'table');
    }
  };

  const handleGridClick = (r: number, c: number) => {
    const rows = r + 1;
    const cols = c + 1;
    let html = '<table style="border-collapse: collapse; width: 100%; border: 1px solid rgba(148, 163, 184, 0.35); margin: 16px 0; border-radius: 8px; overflow: hidden;">';
    for (let i = 0; i < rows; i++) {
      html += '<tr>';
      for (let j = 0; j < cols; j++) {
        if (i === 0) {
          html += `<th style="padding: 12px 16px; border: 1px solid rgba(148, 163, 184, 0.35); background: rgba(99, 102, 241, 0.15); color: inherit; font-weight: 600; text-align: left; font-size: 14px;">Col ${j + 1}</th>`;
        } else {
          html += '<td style="padding: 12px 16px; border: 1px solid rgba(148, 163, 184, 0.2); color: inherit; font-size: 14px;"><br></td>';
        }
      }
      html += '</tr>';
    }
    html += '</table><p><br></p>';
    
    document.execCommand('insertHTML', false, html);
    if (contentRef.current) {
      setBody(contentRef.current.innerHTML);
      contentRef.current.focus();
    }
    setActivePopup(null);
    setHoveredTable({ row: -1, col: -1 });
  };

  // Helper to find the active table element and cell
  const getActiveTableCell = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;
    let node: Node | null = selection.getRangeAt(0).commonAncestorContainer;
    let cell: HTMLTableCellElement | null = null;
    let table: HTMLTableElement | null = null;

    while (node && node !== contentRef.current) {
      if (node.nodeName === 'TD' || node.nodeName === 'TH') {
        cell = node as HTMLTableCellElement;
      }
      if (node.nodeName === 'TABLE') {
        table = node as HTMLTableElement;
        break;
      }
      node = node.parentNode;
    }
    return { cell, table };
  };

  const handleAddRow = () => {
    const { cell, table } = getActiveTableCell() || {};
    if (!table || !cell) return;

    const row = cell.parentElement as HTMLTableRowElement;
    const rowIndex = row.rowIndex;
    const colCount = row.cells.length;

    const newRow = table.insertRow(rowIndex + 1);
    for (let i = 0; i < colCount; i++) {
      const newCell = newRow.insertCell(i);
      newCell.style.padding = '12px 16px';
      newCell.style.border = '1px solid rgba(148, 163, 184, 0.2)';
      newCell.style.fontSize = '14px';
      newCell.style.color = 'inherit';
      newCell.innerHTML = '<br>';
    }

    if (contentRef.current) {
      setBody(contentRef.current.innerHTML);
    }
    setActivePopup(null);
  };

  const handleDeleteRow = () => {
    const { cell, table } = getActiveTableCell() || {};
    if (!table || !cell) return;

    const row = cell.parentElement as HTMLTableRowElement;
    table.deleteRow(row.rowIndex);

    // If table is now empty, delete the whole table
    if (table.rows.length === 0) {
      table.remove();
    }

    if (contentRef.current) {
      setBody(contentRef.current.innerHTML);
    }
    setActivePopup(null);
  };

  const handleAddColumn = () => {
    const { cell, table } = getActiveTableCell() || {};
    if (!table || !cell) return;

    const colIndex = cell.cellIndex;
    const rows = table.rows;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      // Correctly detect header row: check if THIS row's cell at colIndex is a TH
      const existingCell = row.cells[colIndex];
      const isHeaderRow = existingCell?.tagName === 'TH';
      const newCell = isHeaderRow ? document.createElement('th') : document.createElement('td');

      newCell.style.padding = '12px 16px';
      newCell.style.color = 'inherit';
      newCell.style.fontSize = '14px';

      if (isHeaderRow) {
        newCell.style.border = '1px solid rgba(148, 163, 184, 0.35)';
        newCell.style.background = 'rgba(99, 102, 241, 0.15)';
        newCell.style.fontWeight = '600';
        newCell.style.textAlign = 'left';
        newCell.innerHTML = `Col ${colIndex + 2}`;
      } else {
        newCell.style.border = '1px solid rgba(148, 163, 184, 0.2)';
        newCell.innerHTML = '<br>';
      }

      // Insert after the current colIndex
      if (colIndex + 1 < row.cells.length) {
        row.insertBefore(newCell, row.cells[colIndex + 1]);
      } else {
        row.appendChild(newCell);
      }
    }

    if (contentRef.current) {
      setBody(contentRef.current.innerHTML);
    }
    setActivePopup(null);
  };

  const handleDeleteColumn = () => {
    const { cell, table } = getActiveTableCell() || {};
    if (!table || !cell) return;

    const colIndex = cell.cellIndex;
    const rows = table.rows;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row.cells.length > colIndex) {
        row.deleteCell(colIndex);
      }
    }

    // If table now has 0 columns, remove it
    if (rows.length > 0 && rows[0].cells.length === 0) {
      table.remove();
    }

    if (contentRef.current) {
      setBody(contentRef.current.innerHTML);
    }
    setActivePopup(null);
  };

  const handleDeleteTable = () => {
    const { table } = getActiveTableCell() || {};
    if (!table) return;

    table.remove();

    if (contentRef.current) {
      setBody(contentRef.current.innerHTML);
    }
    setActivePopup(null);
  };

  const handleCustomTableInsert = () => {
    const r = Math.min(50, Math.max(1, parseInt(customRows, 10)));
    const c = Math.min(50, Math.max(1, parseInt(customCols, 10)));
    if (isNaN(r) || isNaN(c) || r <= 0 || c <= 0) return;
    handleGridClick(r - 1, c - 1);
  };


  const handleListToggle = (command: string) => {
    document.execCommand(command, false);
    if (contentRef.current) {
      setBody(contentRef.current.innerHTML);
      contentRef.current.focus();
    }
    updateFormatState();
    setActivePopup(null);
  };

  const toggleBlock = (blockType: string, tagName: string) => {
    const selection = window.getSelection();
    let isBlock = false;
    
    if (selection && selection.rangeCount > 0) {
      let node: Node | null = selection.getRangeAt(0).commonAncestorContainer;
      // Walk up to contentRef.current (not just any DIV) to correctly detect block tags
      while (node && node !== contentRef.current) {
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


  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter') {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      
      let node: Node | null = selection.anchorNode;
      let isPre = false;
      let isBlockquote = false;
      
      while (node && node !== contentRef.current) {
        if (node.nodeName === 'PRE') isPre = true;
        if (node.nodeName === 'BLOCKQUOTE') isBlockquote = true;
        if (isPre || isBlockquote) break;
        node = node.parentNode;
      }

      if ((isPre || isBlockquote) && e.shiftKey) {
        e.preventDefault();
        document.execCommand('insertParagraph', false);
        document.execCommand('formatBlock', false, 'P');
        if (contentRef.current) {
          liveBodyRef.current = contentRef.current.innerHTML;
          setBody(contentRef.current.innerHTML);
        }
      } else if (isPre && !e.shiftKey) {
        e.preventDefault();
        document.execCommand('insertText', false, '\n');
        if (contentRef.current) {
          liveBodyRef.current = contentRef.current.innerHTML;
          setBody(contentRef.current.innerHTML);
        }
      }
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

    // Always read the freshest content from the live ref, not stale closure
    const currentBody = liveBodyRef.current;

    setSaving(true);
    const noteId = currentNoteId || doc(collection(db, 'notes')).id;
    const isNewNote = !currentNoteId;
    
    const noteData = {
      userId: user.uid,
      title,
      body: currentBody,
      tags: tags.split(',').map(t => t.trim()).filter(t => t),
      color,
      updatedAt: serverTimestamp(),
      ...(isNewNote ? { createdAt: serverTimestamp() } : {})
    };

    try {
      await setDoc(doc(db, 'notes', noteId), noteData, { merge: true });
      setLastSaved(new Date());
      setLastSavedData({ title, body: currentBody, tags, color });
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
  }, [currentNoteId, title, tags, color, showToast]); // body removed — we use liveBodyRef instead

  // Auto-save throttling
  useEffect(() => {
    const hasChanges = 
      title !== lastSavedData.title || 
      liveBodyRef.current !== lastSavedData.body || 
      tags !== lastSavedData.tags || 
      color !== lastSavedData.color;

    if (!title.trim() || !hasChanges) return;

    const timer = setTimeout(() => {
      handleSave();
    }, 1500);
    
    return () => clearTimeout(timer);
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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
    e.target.value = '';
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

          {/* Full-Screen Focus Mode Switcher */}
          <button
            type="button"
            onClick={() => setFocusMode(prev => !prev)}
            className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer text-[10px] font-bold uppercase tracking-wider ${focusMode ? 'bg-indigo-600 border-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.25)]' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'}`}
            title={focusMode ? "Exit Focus Mode" : "Enter Focus Mode"}
          >
            {focusMode ? "Focused" : "Focus"}
          </button>

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
        {!focusMode && (
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
        )}

        {/* Right Pane: Content */}
        <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 border-l border-transparent overflow-hidden relative">
          
          {/* Top Formatting Toolbar */}
          {/* popupRef wraps the ENTIRE toolbar container so popup clicks don't trigger click-outside */}
          <div ref={popupRef} className="w-full z-20 flex flex-col border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-md">
            {/* Main Bar */}
            <div className="flex flex-nowrap items-center gap-1.5 p-2 overflow-x-auto no-scrollbar">
              <button onClick={() => setActivePopup(p => p === 'text' ? null : 'text')} className={`p-2 rounded-xl transition-all ${activePopup === 'text' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'}`}>
                <Type className="w-5 h-5" />
              </button>
              <button onClick={() => setActivePopup(p => p === 'paragraph' ? null : 'paragraph')} className={`p-2 rounded-xl transition-all ${activePopup === 'paragraph' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'}`}>
                <AlignLeft className="w-5 h-5" />
              </button>

              <div className="w-px h-5 bg-slate-300 dark:bg-slate-700 mx-1" />

              {/* Font Size Stepper Box (Moved Outside) */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200/50 dark:border-slate-700/50 shadow-inner">
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={localFontSize}
                  onChange={(e) => setLocalFontSize(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const val = parseInt(localFontSize, 10);
                      if (!isNaN(val) && val >= 1 && val <= 120) {
                        handleFontSize(val);
                      }
                      contentRef.current?.focus();
                    }
                  }}
                  onBlur={() => {
                    const val = parseInt(localFontSize, 10);
                    if (!isNaN(val) && val >= 1 && val <= 120) {
                      handleFontSize(val);
                    } else {
                      setLocalFontSize(Math.round(parseFloat(activeFormats.fontSize) || 16).toString());
                    }
                  }}
                  className="w-10 bg-transparent text-slate-800 dark:text-slate-100 text-xs font-bold text-center outline-none border-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <div className="flex flex-col gap-0.5 border-l border-slate-300 dark:border-slate-600 pl-1.5 ml-1.5">
                  <button 
                    type="button"
                    onClick={() => {
                      const current = Math.round(parseFloat(activeFormats.fontSize)) || 16;
                      handleFontSize(Math.min(120, current + 1));
                    }}
                    className="text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-white transition-colors"
                  >
                    <ChevronUp className="w-3 h-3" />
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      const current = Math.round(parseFloat(activeFormats.fontSize)) || 16;
                      handleFontSize(Math.max(1, current - 1));
                    }}
                    className="text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-white transition-colors"
                  >
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div className="w-px h-5 bg-slate-300 dark:bg-slate-700 mx-1" />
              
              <button onClick={handleChecklist} className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-all">
                <CheckSquare className="w-5 h-5" />
              </button>
              <button onClick={() => document.getElementById('image-upload')?.click()} className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-all">
                <ImageIcon className="w-5 h-5" />
              </button>
              <button onClick={handleTable} className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-all">
                <Table className="w-5 h-5" />
              </button>
              <input type="file" id="image-upload" className="hidden" accept="image/*" onChange={handleImageUpload} />
            </div>

            {/* Popups */}
            <AnimatePresence>
              {activePopup === 'text' && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 absolute top-full left-0 w-full z-30 shadow-xl">
                  <div className="p-4 space-y-4">
                    <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl max-w-sm">
                      <ToolbarButton icon={<Bold className="w-5 h-5" />} onClick={() => handleFormat('bold')} title="Bold" isActive={activeFormats.bold} />
                      <ToolbarButton icon={<Italic className="w-5 h-5" />} onClick={() => handleFormat('italic')} title="Italic" isActive={activeFormats.italic} />
                      <ToolbarButton icon={<Underline className="w-5 h-5" />} onClick={() => handleFormat('underline')} title="Underline" isActive={activeFormats.underline} />
                      <ToolbarButton icon={<Strikethrough className="w-5 h-5" />} onClick={() => handleFormat('strikeThrough')} title="Strikethrough" isActive={activeFormats.strikeThrough} />
                      <div className="w-px h-6 bg-slate-300 dark:bg-slate-700 mx-1" />
                      <ToolbarButton icon={<Highlighter className="w-5 h-5" />} onClick={handleHighlight} title="Highlight" isActive={activeFormats.highlight} />
                      <ToolbarButton icon={<Eraser className="w-5 h-5" />} onClick={handleClearFormatting} title="Clear Format" />
                    </div>
                    
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 px-1 font-semibold uppercase tracking-wider">Font color</p>
                      <div className="flex items-center gap-4 px-2 overflow-x-auto no-scrollbar pb-2">
                        {['#ffffff', '#0f172a', '#64748b', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6'].map(color => {
                          const isActive = rgbToHex(activeFormats.fontColor) === color.toLowerCase();
                          return (
                            <button 
                              key={color} 
                              type="button" 
                              onClick={() => handleFontColor(color)} 
                              className={`w-8 h-8 rounded-md shrink-0 shadow-sm transition-transform hover:scale-110 flex items-center justify-center ${isActive ? 'ring-2 ring-offset-2 ring-indigo-500 dark:ring-offset-slate-900 border-none' : 'border border-slate-200 dark:border-slate-800'}`} 
                              style={{ backgroundColor: color }} 
                            >
                              {isActive && <Check className={`w-4 h-4 drop-shadow-sm ${color === '#ffffff' ? 'text-slate-800' : 'text-white'}`} />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
              {activePopup === 'paragraph' && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 absolute top-full left-0 w-full z-30 shadow-xl">
                  <div className="p-4 space-y-4">
                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl max-w-xs">
                      <ToolbarButton icon={<AlignLeft className="w-5 h-5" />} onClick={() => handleFormat('justifyLeft')} title="Align Left" isActive={activeFormats.justifyLeft} />
                      <ToolbarButton icon={<AlignCenter className="w-5 h-5" />} onClick={() => handleFormat('justifyCenter')} title="Align Center" isActive={activeFormats.justifyCenter} />
                      <ToolbarButton icon={<AlignRight className="w-5 h-5" />} onClick={() => handleFormat('justifyRight')} title="Align Right" isActive={activeFormats.justifyRight} />
                    </div>
                    <div className="flex items-center gap-2 max-w-sm">
                      <button onClick={() => handleListToggle('insertUnorderedList')} className={`flex-1 flex flex-col items-center justify-center p-3 rounded-xl gap-2 transition-colors ${activeFormats.unorderedList ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
                        <List className="w-6 h-6" />
                        <span className="text-xs font-medium">Bullet List</span>
                      </button>
                      <button onClick={() => handleListToggle('insertOrderedList')} className={`flex-1 flex flex-col items-center justify-center p-3 rounded-xl gap-2 transition-colors ${activeFormats.orderedList ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
                        <ListOrdered className="w-6 h-6" />
                        <span className="text-xs font-medium">Numbered List</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
              {activePopup === 'table' && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 absolute top-full left-0 w-full z-30 shadow-xl">
                  <div className="p-4 space-y-2 max-w-sm mx-auto flex flex-col items-center">
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-center mb-1">
                      Insert Table {hoveredTable.row >= 0 ? `${hoveredTable.row + 1} x ${hoveredTable.col + 1}` : ''}
                    </p>
                    <div className="flex flex-col gap-1 w-fit bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                      {Array.from({ length: 6 }, (_, r) => (
                        <div key={r} className="flex gap-1">
                          {Array.from({ length: 6 }, (_, c) => (
                            <div
                              key={c}
                              onMouseEnter={() => setHoveredTable({ row: r, col: c })}
                              onClick={() => handleGridClick(r, c)}
                              className={`w-8 h-8 border rounded-md cursor-pointer transition-colors ${r <= hoveredTable.row && c <= hoveredTable.col ? 'bg-indigo-500 border-indigo-600 shadow-[0_0_10px_rgba(99,102,241,0.5)]' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-400'}`}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                    
                    <div className="w-full border-t border-slate-100 dark:border-slate-800 pt-3 mt-3 flex flex-col items-center">
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mb-2">Or Custom Size</p>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          placeholder="Rows"
                          min={1}
                          max={50}
                          value={customRows}
                          onChange={(e) => setCustomRows(e.target.value)}
                          className="w-16 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs text-center outline-none focus:border-indigo-500"
                        />
                        <span className="text-slate-400 text-xs">x</span>
                        <input
                          type="number"
                          placeholder="Cols"
                          min={1}
                          max={50}
                          value={customCols}
                          onChange={(e) => setCustomCols(e.target.value)}
                          className="w-16 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs text-center outline-none focus:border-indigo-500"
                        />
                        <button
                          onClick={handleCustomTableInsert}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all"
                        >
                          Insert
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
              {activePopup === 'tableActions' && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 absolute top-full left-0 w-full z-30 shadow-xl">
                  <div className="p-4 max-w-sm mx-auto space-y-3">
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-center">
                      Table Options
                    </p>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={handleAddRow}
                        className="flex items-center justify-center gap-2 p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-xl text-xs font-semibold transition-colors"
                      >
                        <Plus className="w-4 h-4 text-emerald-500" />
                        Add Row
                      </button>
                      
                      <button
                        onClick={handleDeleteRow}
                        className="flex items-center justify-center gap-2 p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-xl text-xs font-semibold transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-rose-500" />
                        Delete Row
                      </button>

                      <button
                        onClick={handleAddColumn}
                        className="flex items-center justify-center gap-2 p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-xl text-xs font-semibold transition-colors"
                      >
                        <Plus className="w-4 h-4 text-emerald-500" />
                        Add Column
                      </button>

                      <button
                        onClick={handleDeleteColumn}
                        className="flex items-center justify-center gap-2 p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-xl text-xs font-semibold transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-rose-500" />
                        Delete Column
                      </button>
                    </div>

                    <div className="border-t border-slate-100 dark:border-slate-800 pt-2 mt-2">
                      <button
                        onClick={handleDeleteTable}
                        className="w-full flex items-center justify-center gap-2 p-2.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-bold transition-colors border border-rose-100 dark:border-rose-900/30"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete Entire Table
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex-1 flex flex-col overflow-y-auto relative no-scrollbar">

          {focusMode && (
            <input
              type="text"
              placeholder="Untitled Node..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="px-12 pt-12 text-3.5xl font-black bg-transparent border-none outline-none text-slate-900 dark:text-white placeholder:text-slate-700"
            />
          )}

          <div
            ref={contentRef}
            contentEditable
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onKeyUp={updateFormatState}
            onMouseUp={updateFormatState}
            className={`editor-content w-full p-6 md:p-12 pb-4 bg-transparent border-none outline-none text-lg text-slate-700 dark:text-slate-350 leading-relaxed ${
              activeFont === 'sans' ? 'font-sans' : activeFont === 'serif' ? 'font-serif font-medium tracking-wide' : 'font-mono text-base'
            }`}
          />
          {/* Clickable padding at the bottom to append new line */}
          <div 
            className="flex-1 w-full cursor-text min-h-[50px]" 
            onClick={() => {
              if (contentRef.current) {
                const lastChild = contentRef.current.lastElementChild;
                let targetNode = lastChild;
                
                if (!lastChild || (lastChild.nodeName !== 'DIV' && lastChild.nodeName !== 'P') || (lastChild.textContent?.trim() !== '' && lastChild.innerHTML !== '<br>')) {
                  const p = document.createElement('div');
                  p.innerHTML = '<br>';
                  contentRef.current.appendChild(p);
                  targetNode = p;
                  setBody(contentRef.current.innerHTML);
                }
                
                const range = document.createRange();
                if (targetNode) {
                  range.setStart(targetNode, 0);
                } else {
                  range.setStart(contentRef.current, 0);
                }
                range.collapse(true);
                const sel = window.getSelection();
                sel?.removeAllRanges();
                sel?.addRange(range);
                contentRef.current.focus();
              }
            }}
          />

          </div>

          {/* New Mobile-Style Bottom Toolbar */}

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
