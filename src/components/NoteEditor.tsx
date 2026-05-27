import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { collection, doc, setDoc, deleteDoc, serverTimestamp, addDoc, query, onSnapshot } from 'firebase/firestore';
import { User as FirebaseUser } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Note, Attachment } from '../types';
import { 
  ArrowLeft, Save, Trash2, Paperclip, X, Download, FileText, Image as ImageIcon, Plus, Tag, Check, 
  Bold, Italic, List, ListOrdered, Link, Heading1, Heading2, Heading3, Quote, Undo, Redo, UploadCloud, 
  ChevronDown, ChevronUp, Underline, Strikethrough, Eraser, Type, AlignLeft, AlignCenter, AlignRight, 
  CheckSquare, Table, Search, Replace, GripVertical, Info, Clock, Highlighter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useToast } from '../contexts/ToastContext';
import { format, formatDistanceToNow } from 'date-fns';

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

// Helper to save selection
function saveSelection(): Range | null {
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) {
    return sel.getRangeAt(0).cloneRange();
  }
  return null;
}

// Helper to restore selection
function restoreSelection(range: Range | null): void {
  if (range) {
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }
}

// Helper to translate color RGB values to Hex
const rgbToHex = (color: string) => {
  if (!color) return '';
  if (color.startsWith('#')) return color.toLowerCase();
  const match = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return '';
  return '#' + match.slice(1).map(n => parseInt(n, 10).toString(16).padStart(2, '0')).join('').toLowerCase();
};

export default function NoteEditor({ user, note, onBack }: NoteEditorProps) {
  const { showToast } = useToast();

  // --- REFS ---
  const contentRef = useRef<HTMLDivElement>(null);
  const fontMenuRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  
  // Custom Undo/Redo Refs
  const undoStack = useRef<string[]>([note?.body || '']);
  const redoStack = useRef<string[]>([]);
  const historyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const savedSelectionRef = useRef<Range | null>(null);

  // Auto-Save Refs
  const latestContent = useRef(note?.body || '');
  const prevNoteIdRef = useRef<string | null>(note?.id || null);

  // --- STATE ---
  const [currentNoteId, setCurrentNoteId] = useState<string | null>(note?.id || null);
  const [title, setTitle] = useState(note?.title || '');
  const [body, setBody] = useState(note?.body || '');
  const [tags, setTags] = useState(note?.tags.join(', ') || '');
  const [color, setColor] = useState(note?.color || COLORS[0].value);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(note ? new Date() : null);

  // Snapshot for calculating changes
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState({
    title: note?.title || '',
    body: note?.body || '',
    tags: note?.tags.join(', ') || '',
    color: note?.color || COLORS[0].value
  });

  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    strikeThrough: false,
    unorderedList: false,
    orderedList: false,
    pre: false,
    h1: false,
    h2: false,
    h3: false,
    blockquote: false,
    highlight: false,
    justifyLeft: false,
    justifyCenter: false,
    justifyRight: false,
    fontSize: '16',
    fontColor: '',
    isInsideTable: false
  });

  const [activePopup, setActivePopup] = useState<'text' | 'paragraph' | 'table' | 'tableActions' | 'link' | null>(null);
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [viewingAttachment, setViewingAttachment] = useState<Attachment | null>(null);
  const [activeFont, setActiveFont] = useState<'sans' | 'serif' | 'mono'>('sans');
  const [showFontMenu, setShowFontMenu] = useState(false);
  const [hoveredTable, setHoveredTable] = useState({ row: -1, col: -1 });
  const [customRows, setCustomRows] = useState('3');
  const [customCols, setCustomCols] = useState('3');
  const [localFontSize, setLocalFontSize] = useState('16');
  const [linkUrl, setLinkUrl] = useState('');
  const [selectedLinkUrl, setSelectedLinkUrl] = useState('');

  // Find & Replace state
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [matchCount, setMatchCount] = useState(0);

  // Auto-sync Font Stepper
  useEffect(() => {
    setLocalFontSize(Math.round(parseFloat(activeFormats.fontSize) || 16).toString());
  }, [activeFormats.fontSize]);

  // Click-Outside Listener for menus/popups
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

  // Drag-to-Resize Sidebar Event Handlers
  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback((e: MouseEvent) => {
    if (isResizing) {
      const newWidth = e.clientX;
      if (newWidth >= 240 && newWidth <= 480) {
        setSidebarWidth(newWidth);
      }
    }
  }, [isResizing]);

  useEffect(() => {
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [resize, stopResizing]);

  // Custom Undo/Redo Management
  const pushToHistory = useCallback((content: string) => {
    if (historyTimer.current) clearTimeout(historyTimer.current);
    historyTimer.current = setTimeout(() => {
      const lastState = undoStack.current[undoStack.current.length - 1];
      if (lastState === content) return;
      undoStack.current.push(content);
      if (undoStack.current.length > 50) {
        undoStack.current.shift();
      }
      redoStack.current = [];
    }, 500);
  }, []);

  const pushToHistoryImmediate = (content: string) => {
    const lastState = undoStack.current[undoStack.current.length - 1];
    if (lastState === content) return;
    undoStack.current.push(content);
    if (undoStack.current.length > 50) {
      undoStack.current.shift();
    }
    redoStack.current = [];
  };

  const handleUndo = useCallback(() => {
    if (undoStack.current.length <= 1) return;
    const current = undoStack.current.pop()!;
    redoStack.current.push(current);
    const prev = undoStack.current[undoStack.current.length - 1];
    if (contentRef.current) {
      contentRef.current.innerHTML = prev;
      latestContent.current = prev;
      setBody(prev);
    }
  }, []);

  const handleRedo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    const next = redoStack.current.pop()!;
    undoStack.current.push(next);
    if (contentRef.current) {
      contentRef.current.innerHTML = next;
      latestContent.current = next;
      setBody(next);
    }
  }, []);

  // Update Format State for Toolbar indicators
  const updateFormatState = () => {
    let isPre = false;
    let isBlockquote = false;
    let isH1 = false;
    let isH2 = false;
    let isH3 = false;
    let linkUrlDetected = '';
    
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      let node: Node | null = selection.anchorNode;
      while (node && node !== contentRef.current) {
        if (node.nodeName === 'PRE') isPre = true;
        if (node.nodeName === 'BLOCKQUOTE') isBlockquote = true;
        if (node.nodeName === 'H1') isH1 = true;
        if (node.nodeName === 'H2') isH2 = true;
        if (node.nodeName === 'H3') isH3 = true;
        if (node.nodeName === 'A') {
          linkUrlDetected = (node as HTMLAnchorElement).href;
        }
        node = node.parentNode;
      }
    }
    
    setSelectedLinkUrl(linkUrlDetected);

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
      h2: isH2,
      h3: isH3,
      highlight: !!isHighlighted,
      justifyLeft: document.queryCommandState('justifyLeft'),
      justifyCenter: document.queryCommandState('justifyCenter'),
      justifyRight: document.queryCommandState('justifyRight'),
      fontSize: currentFontSize,
      fontColor: document.queryCommandValue('foreColor') || '',
      isInsideTable
    });
  };

  // Sync Body from Firebase once note loads
  const bodyRef = React.useRef(body);
  useEffect(() => { bodyRef.current = body; }, [body]);

  useEffect(() => {
    if (!contentRef.current) return;
    const isNewlySaved = prevNoteIdRef.current === null && currentNoteId !== null;
    prevNoteIdRef.current = currentNoteId;
    if (isNewlySaved) return;

    contentRef.current.innerHTML = bodyRef.current;
    latestContent.current = bodyRef.current;
    
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

  // Handle Input Changes inside editor
  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const html = e.currentTarget.innerHTML;
    latestContent.current = html;
    setBody(html);
    pushToHistory(html);
    updateMatchCount();
  };

  // Core Formatting Engine
  const handleFormat = (command: string, value?: string) => {
    if (contentRef.current) {
      pushToHistoryImmediate(contentRef.current.innerHTML);
    }
    document.execCommand(command, false, value);
    if (contentRef.current) {
      const html = contentRef.current.innerHTML;
      latestContent.current = html;
      setBody(html);
      pushToHistory(html);
      contentRef.current.focus();
    }
    updateFormatState();
    setActivePopup(null);
  };

  const handleHighlight = () => {
    if (contentRef.current) {
      pushToHistoryImmediate(contentRef.current.innerHTML);
    }
    if (activeFormats.highlight) {
      document.execCommand('hiliteColor', false, 'transparent');
      document.execCommand('backColor', false, 'transparent');
    } else {
      document.execCommand('hiliteColor', false, '#fcd34d');
      document.execCommand('backColor', false, '#fcd34d');
    }
    if (contentRef.current) {
      const html = contentRef.current.innerHTML;
      latestContent.current = html;
      setBody(html);
      pushToHistory(html);
      contentRef.current.focus();
    }
    updateFormatState();
    setActivePopup(null);
  };

  const handleClearFormatting = () => {
    if (contentRef.current) {
      pushToHistoryImmediate(contentRef.current.innerHTML);
    }
    document.execCommand('removeFormat', false, '');
    document.execCommand('hiliteColor', false, 'transparent');
    document.execCommand('backColor', false, 'transparent');
    if (contentRef.current) {
      const html = contentRef.current.innerHTML;
      latestContent.current = html;
      setBody(html);
      pushToHistory(html);
      contentRef.current.focus();
    }
    updateFormatState();
    setActivePopup(null);
  };

  const handleHeading = (level: 'h1' | 'h2' | 'h3') => {
    if (contentRef.current) {
      pushToHistoryImmediate(contentRef.current.innerHTML);
    }
    document.execCommand('formatBlock', false, level.toUpperCase());
    if (contentRef.current) {
      const html = contentRef.current.innerHTML;
      latestContent.current = html;
      setBody(html);
      pushToHistory(html);
      contentRef.current.focus();
    }
    updateFormatState();
  };

  const handleFontSize = (px: number) => {
    if (savedSelectionRef.current) {
      restoreSelection(savedSelectionRef.current);
      savedSelectionRef.current = null;
    }

    if (contentRef.current) {
      contentRef.current.focus();
    }

    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;

    if (contentRef.current) {
      pushToHistoryImmediate(contentRef.current.innerHTML);
    }

    const range = selection.getRangeAt(0);

    if (range.collapsed) {
      // Inline styling placeholder anchor (Zero Width Space)
      const parent = range.startContainer.parentElement;
      if (
        parent &&
        parent.tagName === 'SPAN' &&
        parent.style.fontSize &&
        (parent.textContent === '' || parent.textContent === '\u200B')
      ) {
        parent.style.fontSize = px + 'px';
        // Place cursor inside
        const newRange = document.createRange();
        newRange.selectNodeContents(parent);
        newRange.collapse(false);
        selection.removeAllRanges();
        selection.addRange(newRange);
      } else {
        const span = document.createElement('span');
        span.style.fontSize = px + 'px';
        span.innerHTML = '&#8203;';
        range.insertNode(span);
        
        const newRange = document.createRange();
        newRange.setStart(span.firstChild!, 1);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
      }
    } else {
      // Non-collapsed text selection: use the bulletproof HTML-tag temporary wrapper approach
      try {
        document.execCommand('styleWithCSS', false, 'false');
      } catch (e) {}
      
      document.execCommand('fontSize', false, '7');
      
      try {
        document.execCommand('styleWithCSS', false, 'true');
      } catch (e) {}

      // Now we find all <font size="7"> and convert them to <span style="font-size: px px">
      if (contentRef.current) {
        const fontElements = Array.from(contentRef.current.querySelectorAll('font[size="7"]'));
        const createdSpans: HTMLSpanElement[] = [];

        fontElements.forEach(fontEl => {
          const span = document.createElement('span');
          span.style.fontSize = px + 'px';
          // Transfer all child nodes
          while (fontEl.firstChild) {
            span.appendChild(fontEl.firstChild);
          }
          fontEl.parentNode?.replaceChild(span, fontEl);
          createdSpans.push(span);
        });

        // Restore active selection over newly created styled spans
        if (createdSpans.length > 0) {
          const newRange = document.createRange();
          if (createdSpans.length === 1) {
            newRange.selectNodeContents(createdSpans[0]);
          } else {
            const first = createdSpans[0];
            const last = createdSpans[createdSpans.length - 1];
            newRange.setStart(first, 0);
            newRange.setEnd(last, last.childNodes.length);
          }
          selection.removeAllRanges();
          selection.addRange(newRange);
        }
      }
    }

    if (contentRef.current) {
      const html = contentRef.current.innerHTML;
      latestContent.current = html;
      setBody(html);
      pushToHistory(html);
      contentRef.current.focus();
    }
    updateFormatState();
  };

  const handleFontColor = (color: string) => {
    if (contentRef.current) {
      pushToHistoryImmediate(contentRef.current.innerHTML);
    }
    document.execCommand('foreColor', false, color);
    if (contentRef.current) {
      const html = contentRef.current.innerHTML;
      latestContent.current = html;
      setBody(html);
      pushToHistory(html);
      contentRef.current.focus();
    }
    updateFormatState();
    setActivePopup(null);
  };

  const handleLinkInsert = (url: string) => {
    if (!url) return;

    // Restore saved selection so the link wraps the correct text
    if (savedSelectionRef.current) {
      restoreSelection(savedSelectionRef.current);
      savedSelectionRef.current = null;
    }
    if (contentRef.current) {
      contentRef.current.focus();
    }

    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;

    if (contentRef.current) {
      pushToHistoryImmediate(contentRef.current.innerHTML);
    }

    let formattedUrl = url;
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = 'https://' + formattedUrl;
    }

    document.execCommand('createLink', false, formattedUrl);

    if (contentRef.current) {
      const links = contentRef.current.querySelectorAll('a');
      links.forEach(link => {
        if (link.getAttribute('href') === formattedUrl) {
          link.setAttribute('target', '_blank');
          link.setAttribute('rel', 'noopener noreferrer');
          link.style.color = '#6366f1';
          link.style.textDecoration = 'underline';
        }
      });

      const html = contentRef.current.innerHTML;
      latestContent.current = html;
      setBody(html);
      pushToHistory(html);
      contentRef.current.focus();
    }
    setActivePopup(null);
    setLinkUrl('');
  };

  const handleLinkRemove = () => {
    if (contentRef.current) {
      pushToHistoryImmediate(contentRef.current.innerHTML);
    }
    document.execCommand('unlink', false);
    if (contentRef.current) {
      const html = contentRef.current.innerHTML;
      latestContent.current = html;
      setBody(html);
      pushToHistory(html);
      contentRef.current.focus();
    }
    setActivePopup(null);
  };

  const handleChecklist = () => {
    if (contentRef.current) {
      pushToHistoryImmediate(contentRef.current.innerHTML);
    }
    document.execCommand('insertHTML', false, '<div style="display: flex; align-items: flex-start; gap: 8px; margin: 4px 0;"><input type="checkbox" style="margin-top: 6px; transform: scale(1.2); cursor: pointer;" />&nbsp;</div>');
    if (contentRef.current) {
      const html = contentRef.current.innerHTML;
      latestContent.current = html;
      setBody(html);
      pushToHistory(html);
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

  const handleGridClick = (r: number, c: number) => {
    const rows = r + 1;
    const cols = c + 1;
    let html = '<table>';
    for (let i = 0; i < rows; i++) {
      html += '<tr>';
      for (let j = 0; j < cols; j++) {
        if (i === 0) {
          html += `<th>Col ${j + 1}</th>`;
        } else {
          html += '<td><br></td>';
        }
      }
      html += '</tr>';
    }
    html += '</table><p><br></p>';
    
    document.execCommand('insertHTML', false, html);
    if (contentRef.current) {
      const htmlContent = contentRef.current.innerHTML;
      latestContent.current = htmlContent;
      setBody(htmlContent);
      pushToHistory(htmlContent);
      
      // Select the first th/td cell of the inserted table automatically
      const tables = contentRef.current.querySelectorAll('table');
      const newlyInsertedTable = tables[tables.length - 1];
      if (newlyInsertedTable) {
        const firstCell = newlyInsertedTable.querySelector('th, td');
        if (firstCell) {
          const range = document.createRange();
          range.selectNodeContents(firstCell);
          range.collapse(true);
          const sel = window.getSelection();
          if (sel) {
            sel.removeAllRanges();
            sel.addRange(range);
          }
          (firstCell as HTMLElement).focus();
        }
      }
    }
    setActivePopup(null);
    setHoveredTable({ row: -1, col: -1 });
  };

  const handleAddRow = () => {
    const { cell, table } = getActiveTableCell() || {};
    if (!table || !cell) return;

    if (contentRef.current) {
      pushToHistoryImmediate(contentRef.current.innerHTML);
    }

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
      const html = contentRef.current.innerHTML;
      latestContent.current = html;
      setBody(html);
      pushToHistory(html);
    }
    setActivePopup(null);
  };

  const handleDeleteRow = () => {
    const { cell, table } = getActiveTableCell() || {};
    if (!table || !cell) return;

    if (contentRef.current) {
      pushToHistoryImmediate(contentRef.current.innerHTML);
    }

    try {
      const row = cell.parentElement as HTMLTableRowElement;
      table.deleteRow(row.rowIndex);

      if (table.rows.length === 0) {
        table.remove();
      }
    } catch (e) {
      console.error(e);
    }

    if (contentRef.current) {
      const html = contentRef.current.innerHTML;
      latestContent.current = html;
      setBody(html);
      pushToHistory(html);
    }
    setActivePopup(null);
  };

  const handleAddColumn = () => {
    const { cell, table } = getActiveTableCell() || {};
    if (!table || !cell) return;

    if (contentRef.current) {
      pushToHistoryImmediate(contentRef.current.innerHTML);
    }

    const colIndex = cell.cellIndex;
    const rows = table.rows;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
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

      if (colIndex + 1 < row.cells.length) {
        row.insertBefore(newCell, row.cells[colIndex + 1]);
      } else {
        row.appendChild(newCell);
      }
    }

    if (contentRef.current) {
      const html = contentRef.current.innerHTML;
      latestContent.current = html;
      setBody(html);
      pushToHistory(html);
    }
    setActivePopup(null);
  };

  const handleDeleteColumn = () => {
    const { cell, table } = getActiveTableCell() || {};
    if (!table || !cell) return;

    if (contentRef.current) {
      pushToHistoryImmediate(contentRef.current.innerHTML);
    }

    try {
      const colIndex = cell.cellIndex;
      const rows = table.rows;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (row.cells.length > colIndex) {
          row.deleteCell(colIndex);
        }
      }

      if (rows.length > 0 && rows[0].cells.length === 0) {
        table.remove();
      }
    } catch (e) {
      console.error(e);
    }

    if (contentRef.current) {
      const html = contentRef.current.innerHTML;
      latestContent.current = html;
      setBody(html);
      pushToHistory(html);
    }
    setActivePopup(null);
  };

  const handleDeleteTable = () => {
    const { table } = getActiveTableCell() || {};
    if (!table) return;

    if (contentRef.current) {
      pushToHistoryImmediate(contentRef.current.innerHTML);
    }

    table.remove();

    if (contentRef.current) {
      const html = contentRef.current.innerHTML;
      latestContent.current = html;
      setBody(html);
      pushToHistory(html);
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
    if (contentRef.current) {
      pushToHistoryImmediate(contentRef.current.innerHTML);
    }
    document.execCommand(command, false);
    if (contentRef.current) {
      const html = contentRef.current.innerHTML;
      latestContent.current = html;
      setBody(html);
      pushToHistory(html);
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
      while (node && node !== contentRef.current) {
        if (node.nodeName === tagName.toUpperCase()) {
          isBlock = true;
          break;
        }
        node = node.parentNode;
      }
    }

    if (contentRef.current) {
      pushToHistoryImmediate(contentRef.current.innerHTML);
    }

    if (isBlock) {
      document.execCommand('formatBlock', false, 'P');
    } else {
      document.execCommand('formatBlock', false, blockType);
    }

    if (contentRef.current) {
      const html = contentRef.current.innerHTML;
      latestContent.current = html;
      setBody(html);
      pushToHistory(html);
      contentRef.current.focus();
    }
  };

  const handleContentClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest('a');
    if (anchor) {
      const isMac = navigator.userAgent.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;
      if (modifier) {
        e.preventDefault();
        window.open(anchor.href, '_blank', 'noopener,noreferrer');
      } else {
        updateFormatState();
      }
    }
  };

  // Main KeyDown events + Shortcuts interceptor
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const isMac = navigator.userAgent.toUpperCase().indexOf('MAC') >= 0;
    const modifier = isMac ? e.metaKey : e.ctrlKey;

    if (modifier) {
      if (e.key.toLowerCase() === 'b') {
        e.preventDefault();
        handleFormat('bold');
      } else if (e.key.toLowerCase() === 'i') {
        e.preventDefault();
        handleFormat('italic');
      } else if (e.key.toLowerCase() === 'u') {
        e.preventDefault();
        handleFormat('underline');
      } else if (e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setActivePopup(activePopup === 'link' ? null : 'link');
      } else if (e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if (e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setShowFindReplace(prev => !prev);
      } else if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
      } else if (e.key === '\\') {
        e.preventDefault();
        handleClearFormatting();
      }
    }

    if (e.key === 'Escape') {
      setActivePopup(null);
      setShowFindReplace(false);
    }

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
          const html = contentRef.current.innerHTML;
          latestContent.current = html;
          setBody(html);
          pushToHistory(html);
        }
      } else if (isPre && !e.shiftKey) {
        e.preventDefault();
        document.execCommand('insertText', false, '\n');
        if (contentRef.current) {
          const html = contentRef.current.innerHTML;
          latestContent.current = html;
          setBody(html);
          pushToHistory(html);
        }
      }
    }
  };

  // Load Attachments Subcollection
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

  // Save Note Callback
  const handleSave = useCallback(async () => {
    if (!user || !title.trim()) return;

    const currentBody = contentRef.current ? contentRef.current.innerHTML : latestContent.current;
    
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
      const now = new Date();
      setLastSaved(now);
      setLastSavedSnapshot({ title, body: currentBody, tags, color });
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
  }, [currentNoteId, title, tags, color, user, showToast]);

  // Unsaved Changes check
  const hasUnsavedChanges = useMemo(() => {
    const currentBody = contentRef.current ? contentRef.current.innerHTML : latestContent.current;
    return (
      title !== lastSavedSnapshot.title ||
      currentBody !== lastSavedSnapshot.body ||
      tags !== lastSavedSnapshot.tags ||
      color !== lastSavedSnapshot.color
    );
  }, [title, body, tags, color, lastSavedSnapshot]);

  // Auto-save debounced effect
  useEffect(() => {
    if (!title.trim() || !hasUnsavedChanges) return;

    const timer = setTimeout(() => {
      handleSave();
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [handleSave, title, hasUnsavedChanges]);

  // Delete flow
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

  // Base64 Attachments Management
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
        body: contentRef.current ? contentRef.current.innerHTML : latestContent.current,
        tags: tags.split(',').map(t => t.trim()).filter(t => t),
        color,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      try {
        await setDoc(newDocRef, noteData);
        setCurrentNoteId(targetNoteId);
        setLastSaved(new Date());
        setLastSavedSnapshot({ title: finalTitle, body: noteData.body, tags, color });
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
    setIsDraggingFile(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
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

  // Find & Replace match counter helper
  const updateMatchCount = () => {
    if (!findText || !contentRef.current) {
      setMatchCount(0);
      return;
    }
    const text = contentRef.current.textContent || '';
    const regex = new RegExp(findText.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');
    const matches = text.match(regex);
    setMatchCount(matches ? matches.length : 0);
  };

  const handleFind = (forward = true) => {
    if (!findText) return;
    try {
      const found = (window as any).find(findText, false, !forward, true, false, true, false);
      if (!found) {
        // Search wrap around
        (window as any).find(findText, false, !forward, true, true, true, false);
      }
      updateMatchCount();
    } catch (e) {
      console.error(e);
    }
  };

  const handleReplace = () => {
    if (!findText) return;
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      if (range.toString().toLowerCase() === findText.toLowerCase()) {
        if (contentRef.current) {
          pushToHistoryImmediate(contentRef.current.innerHTML);
        }
        range.deleteContents();
        const node = document.createTextNode(replaceText);
        range.insertNode(node);
        
        if (contentRef.current) {
          const html = contentRef.current.innerHTML;
          latestContent.current = html;
          setBody(html);
          pushToHistory(html);
        }
        
        handleFind(true);
      }
    }
  };

  const handleReplaceAll = () => {
    if (!findText || !contentRef.current) return;
    pushToHistoryImmediate(contentRef.current.innerHTML);
    
    const text = contentRef.current.innerHTML;
    const regex = new RegExp(findText.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');
    const newHtml = text.replace(regex, replaceText);
    contentRef.current.innerHTML = newHtml;
    
    latestContent.current = newHtml;
    setBody(newHtml);
    pushToHistory(newHtml);
    updateMatchCount();
    showToast('All matches replaced', 'success');
  };

  // Info helpers
  const textContent = body.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
  const wordCount = textContent ? textContent.split(/\s+/).filter(w => w).length : 0;
  const charCount = textContent.length;
  const readingTime = Math.ceil(wordCount / 200);

  return (
    <div 
      className="min-h-screen bg-white dark:bg-slate-900 flex flex-col relative text-slate-800 dark:text-slate-200 font-sans"
      onDragOver={handleDragOver}
      onDragEnter={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* File dragging Overlay */}
      <AnimatePresence>
        {isDraggingFile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-indigo-600/10 dark:bg-indigo-400/10 backdrop-blur-[2px] flex items-center justify-center p-8 pointer-events-none"
          >
            <div className="w-full h-full border-4 border-dashed border-indigo-500 rounded-3xl flex flex-col items-center justify-center gap-4 bg-white/40 dark:bg-slate-900/40">
              <div className="p-6 bg-indigo-600 text-white rounded-full shadow-2xl animate-bounce">
                <UploadCloud className="w-12 h-12" />
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">Release to Upload</p>
                <p className="text-slate-500 dark:text-slate-400 font-medium">Drop files here to attach to this note</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Attachment viewer Modal */}
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
              className="relative max-w-4xl w-full max-h-full bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-slate-100 dark:border-slate-800"
            >
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                    {viewingAttachment.type.startsWith('image/') ? <ImageIcon className="w-5 h-5 text-indigo-600" /> : <FileText className="w-5 h-5 text-indigo-600" />}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-xs">{viewingAttachment.name}</h3>
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
                        Use the download button to view this attachment on your device.
                      </p>
                      <button 
                        onClick={() => downloadAttachment(viewingAttachment)}
                        className="mt-4 bg-indigo-600 hover:bg-indigo-750 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg cursor-pointer"
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

      {/* 2-Row Adaptive Toolbar */}
      <div ref={popupRef} className="sticky top-0 z-35 flex flex-col border-b border-slate-100 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md relative">
        
        {/* ROW 1: Navigation and status controls */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100/60 dark:border-slate-800/60">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer text-slate-500 dark:text-slate-400">
              <ArrowLeft className="w-5 h-5" />
            </button>
            
            {/* Auto-save status bubble */}
            <div className="flex items-center gap-2 px-3 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 rounded-full select-none text-[10px] font-bold tracking-wider uppercase">
              {saving ? (
                <span className="flex items-center gap-1 text-indigo-500">
                  <span className="w-2 h-2 bg-indigo-500 rounded-full animate-ping" /> Saving...
                </span>
              ) : hasUnsavedChanges ? (
                <span className="flex items-center gap-1 text-amber-500">
                  <span className="w-2 h-2 bg-amber-500 rounded-full" /> Unsaved changes
                </span>
              ) : lastSaved ? (
                <span className="flex items-center gap-1 text-emerald-500">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full" /> Synced
                </span>
              ) : (
                <span className="flex items-center gap-1 text-slate-400">
                  Draft
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Custom font family picker */}
            <div className="relative" ref={fontMenuRef}>
              <button
                type="button"
                onClick={() => setShowFontMenu(prev => !prev)}
                className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 rounded-xl px-3 py-1.5 text-xs font-semibold outline-none hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer transition-all duration-150 flex items-center gap-1.5 justify-between min-w-[120px]"
              >
                <span>{activeFont === 'sans' ? 'Outfit Sans' : activeFont === 'serif' ? 'Playfair Serif' : 'Fira Mono'}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>
              <AnimatePresence>
                {showFontMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 5, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 5, scale: 0.95 }}
                    className="absolute right-0 mt-1.5 w-44 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1.5 shadow-2xl space-y-0.5"
                  >
                    {[
                      { value: 'sans', label: 'Outfit Sans', desc: 'Modern Clean' },
                      { value: 'serif', label: 'Playfair Serif', desc: 'Editorial Serif' },
                      { value: 'mono', label: 'Fira Mono', desc: 'Developer Mono' }
                    ].map(item => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => {
                          setActiveFont(item.value as any);
                          setShowFontMenu(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 rounded-lg transition-all cursor-pointer flex flex-col justify-start ${activeFont === item.value ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                      >
                        <span className="text-xs font-bold">{item.label}</span>
                        <span className={`text-[9px] ${activeFont === item.value ? 'text-indigo-200' : 'text-slate-400 dark:text-slate-500'}`}>{item.desc}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Distraction-free Focus Toggle */}
            <button
              type="button"
              onClick={() => setFocusMode(prev => !prev)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${focusMode ? 'bg-indigo-600 border-indigo-500 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-900 border-slate-250 dark:border-slate-800 text-slate-600 dark:text-slate-350 hover:bg-slate-200 dark:hover:bg-slate-800'}`}
              title={focusMode ? "Exit Focus Mode" : "Enter Focus Mode"}
            >
              {focusMode ? "Focused" : "Focus"}
            </button>

            {currentNoteId && (
              <button onClick={handleDeleteClick} className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-all cursor-pointer" title="Delete Note">
                <Trash2 className="w-5 h-5" />
              </button>
            )}

            <button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer text-xs uppercase tracking-wider shadow-sm">
              <Save className="w-4 h-4" />
              Save
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-50/50 dark:bg-slate-900/50">
          
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => setActivePopup(p => p === 'text' ? null : 'text')} className={`p-2 w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all ${activePopup === 'text' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'}`} title="Text Styles">
            <Type className="w-5 h-5" />
          </button>
          
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => setActivePopup(p => p === 'paragraph' ? null : 'paragraph')} className={`p-2 w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all ${activePopup === 'paragraph' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'}`} title="Paragraph styles">
            <AlignLeft className="w-5 h-5" />
          </button>

          <div className="w-px h-5 bg-slate-250 dark:bg-slate-800 mx-1 shrink-0" />

          {/* Heading Blocks */}
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleHeading('h1')} className={`px-2.5 py-1 text-xs font-black rounded-lg shrink-0 transition-colors ${activeFormats.h1 ? 'bg-indigo-150 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800'}`}>H1</button>
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleHeading('h2')} className={`px-2.5 py-1 text-xs font-black rounded-lg shrink-0 transition-colors ${activeFormats.h2 ? 'bg-indigo-150 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800'}`}>H2</button>
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleHeading('h3')} className={`px-2.5 py-1 text-xs font-black rounded-lg shrink-0 transition-colors ${activeFormats.h3 ? 'bg-indigo-150 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800'}`}>H3</button>

          <div className="w-px h-5 bg-slate-250 dark:bg-slate-800 mx-1 shrink-0" />

          {/* Stepper block */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200/50 dark:border-slate-700/50 shadow-inner shrink-0">
            <input
              type="number"
              min={1}
              max={120}
              value={localFontSize}
              onFocus={() => {
                savedSelectionRef.current = saveSelection();
              }}
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
              className="w-8 bg-transparent text-slate-800 dark:text-slate-100 text-xs font-bold text-center outline-none border-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <div className="flex flex-col gap-0.5 border-l border-slate-300 dark:border-slate-700 pl-1.5 ml-1.5">
              <button 
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  const current = Math.round(parseFloat(activeFormats.fontSize)) || 16;
                  handleFontSize(Math.min(120, current + 1));
                }}
                className="text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-white transition-colors"
              >
                <ChevronUp className="w-3 h-3" />
              </button>
              <button 
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  const current = Math.round(parseFloat(activeFormats.fontSize)) || 16;
                  handleFontSize(Math.max(1, current - 1));
                }}
                className="text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-white transition-colors"
              >
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="w-px h-5 bg-slate-250 dark:bg-slate-800 mx-1 shrink-0" />

          {/* Quick list togglers & blockquote */}
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleListToggle('insertUnorderedList')} className={`p-2 w-9 h-9 flex items-center justify-center rounded-xl shrink-0 transition-colors ${activeFormats.unorderedList ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800'}`} title="Bullet List">
            <List className="w-5 h-5" />
          </button>
          
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleListToggle('insertOrderedList')} className={`p-2 w-9 h-9 flex items-center justify-center rounded-xl shrink-0 transition-colors ${activeFormats.orderedList ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800'}`} title="Ordered List">
            <ListOrdered className="w-5 h-5" />
          </button>

          <button onMouseDown={(e) => e.preventDefault()} onClick={() => toggleBlock('blockquote', 'blockquote')} className={`p-2 w-9 h-9 flex items-center justify-center rounded-xl shrink-0 transition-colors ${activeFormats.blockquote ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800'}`} title="Blockquote">
            <Quote className="w-5 h-5" />
          </button>

          <div className="w-px h-5 bg-slate-250 dark:bg-slate-800 mx-1 shrink-0" />

          {/* Action Popups toggler links */}
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => { savedSelectionRef.current = saveSelection(); setActivePopup(p => p === 'link' ? null : 'link'); }} className={`p-2 w-9 h-9 flex items-center justify-center rounded-xl shrink-0 transition-colors ${activePopup === 'link' || selectedLinkUrl ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800'}`} title="Insert link">
            <Link className="w-5 h-5" />
          </button>

          <button onMouseDown={(e) => e.preventDefault()} onClick={handleChecklist} className="p-2 w-9 h-9 flex items-center justify-center rounded-xl shrink-0 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition-all" title="Insert checklist">
            <CheckSquare className="w-5 h-5" />
          </button>
          
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => document.getElementById('image-upload')?.click()} className="p-2 w-9 h-9 flex items-center justify-center rounded-xl shrink-0 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition-all" title="Attach file">
            <ImageIcon className="w-5 h-5" />
          </button>
          
          <button onMouseDown={(e) => e.preventDefault()} onClick={handleTable} className={`p-2 w-9 h-9 flex items-center justify-center rounded-xl shrink-0 transition-colors ${activeFormats.isInsideTable ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800'}`} title="Table commands">
            <Table className="w-5 h-5" />
          </button>

          <div className="w-px h-5 bg-slate-250 dark:bg-slate-800 mx-1 shrink-0" />

          {/* Search tool */}
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => setShowFindReplace(prev => !prev)} className={`p-2 w-9 h-9 flex items-center justify-center rounded-xl shrink-0 transition-colors ${showFindReplace ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800'}`} title="Find and Replace">
            <Search className="w-5 h-5" />
          </button>

          <input type="file" id="image-upload" className="hidden" accept="image/*" onChange={handleImageUpload} />
        </div>

        {/* Toolbar Popups */}
        <AnimatePresence>
          {activePopup === 'text' && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 absolute top-full left-0 w-full z-30 shadow-xl">
              <div className="p-4 space-y-4">
                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl max-w-sm">
                  <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleFormat('bold')} className={`p-2 rounded-lg transition-all ${activeFormats.bold ? 'bg-white dark:bg-slate-700 text-indigo-600 font-bold' : 'text-slate-500'}`} title="Bold"><Bold className="w-4 h-4" /></button>
                  <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleFormat('italic')} className={`p-2 rounded-lg transition-all ${activeFormats.italic ? 'bg-white dark:bg-slate-700 text-indigo-600' : 'text-slate-500'}`} title="Italic"><Italic className="w-4 h-4" /></button>
                  <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleFormat('underline')} className={`p-2 rounded-lg transition-all ${activeFormats.underline ? 'bg-white dark:bg-slate-700 text-indigo-600' : 'text-slate-500'}`} title="Underline"><Underline className="w-4 h-4" /></button>
                  <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleFormat('strikeThrough')} className={`p-2 rounded-lg transition-all ${activeFormats.strikeThrough ? 'bg-white dark:bg-slate-700 text-indigo-600' : 'text-slate-500'}`} title="Strikethrough"><Strikethrough className="w-4 h-4" /></button>
                  <div className="w-px h-6 bg-slate-350 dark:bg-slate-750 mx-1" />
                  <button onMouseDown={(e) => e.preventDefault()} onClick={handleHighlight} className={`p-2 rounded-lg transition-all ${activeFormats.highlight ? 'bg-white dark:bg-slate-700 text-indigo-600' : 'text-slate-500'}`} title="Text Highlight"><Highlighter className="w-4 h-4" /></button>
                  <button onMouseDown={(e) => e.preventDefault()} onClick={handleClearFormatting} className="p-2 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white" title="Clear styling"><Eraser className="w-4 h-4" /></button>
                </div>
                
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2 px-1">Font Color</p>
                  <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-2 px-1">
                    {['#ffffff', '#0f172a', '#64748b', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#6366f1'].map(color => {
                      const isActive = rgbToHex(activeFormats.fontColor) === color.toLowerCase();
                      return (
                        <button 
                          key={color} 
                          type="button" 
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleFontColor(color)} 
                          className={`w-7 h-7 rounded-lg shrink-0 shadow-sm transition-transform hover:scale-105 flex items-center justify-center ${isActive ? 'ring-2 ring-indigo-500 border-none' : 'border border-slate-200 dark:border-slate-850'}`} 
                          style={{ backgroundColor: color }} 
                        >
                          {isActive && <Check className={`w-3.5 h-3.5 ${color === '#ffffff' ? 'text-slate-800' : 'text-white'}`} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
          {activePopup === 'paragraph' && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 absolute top-full left-0 w-full z-30 shadow-xl">
              <div className="p-4 space-y-4">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Text Alignment</p>
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl max-w-xs">
                  <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleFormat('justifyLeft')} className={`flex-1 p-2 rounded-lg flex justify-center transition-all ${activeFormats.justifyLeft ? 'bg-white dark:bg-slate-700 text-indigo-600' : 'text-slate-500'}`} title="Align Left"><AlignLeft className="w-4 h-4" /></button>
                  <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleFormat('justifyCenter')} className={`flex-1 p-2 rounded-lg flex justify-center transition-all ${activeFormats.justifyCenter ? 'bg-white dark:bg-slate-700 text-indigo-600' : 'text-slate-500'}`} title="Align Center"><AlignCenter className="w-4 h-4" /></button>
                  <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleFormat('justifyRight')} className={`flex-1 p-2 rounded-lg flex justify-center transition-all ${activeFormats.justifyRight ? 'bg-white dark:bg-slate-700 text-indigo-600' : 'text-slate-500'}`} title="Align Right"><AlignRight className="w-4 h-4" /></button>
                </div>
              </div>
            </motion.div>
          )}
          {activePopup === 'table' && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 absolute top-full left-0 w-full z-30 shadow-xl">
              <div className="p-4 space-y-2 max-w-sm mx-auto flex flex-col items-center">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-center mb-1">
                  Insert Table {hoveredTable.row >= 0 ? `${hoveredTable.row + 1} x ${hoveredTable.col + 1}` : ''}
                </p>
                <div className="flex flex-col gap-1 bg-slate-50 dark:bg-slate-800/40 p-2 rounded-xl border border-slate-200/50 dark:border-slate-800">
                  {Array.from({ length: 6 }, (_, r) => (
                    <div key={r} className="flex gap-1">
                      {Array.from({ length: 6 }, (_, c) => (
                        <div
                          key={c}
                          onMouseEnter={() => setHoveredTable({ row: r, col: c })}
                          onClick={() => handleGridClick(r, c)}
                          className={`w-7 h-7 border rounded-md cursor-pointer transition-colors ${r <= hoveredTable.row && c <= hoveredTable.col ? 'bg-indigo-500 border-indigo-600 shadow-[0_0_8px_rgba(99,102,241,0.4)]' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-750'}`}
                        />
                      ))}
                    </div>
                  ))}
                </div>
                
                <div className="w-full border-t border-slate-150 dark:border-slate-800 pt-3 mt-3 flex flex-col items-center">
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-2">Or Custom Size</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      placeholder="Rows"
                      min={1}
                      max={50}
                      value={customRows}
                      onChange={(e) => setCustomRows(e.target.value)}
                      className="w-14 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-850 dark:text-slate-100 text-xs text-center outline-none focus:border-indigo-500"
                    />
                    <span className="text-slate-400 text-xs">x</span>
                    <input
                      type="number"
                      placeholder="Cols"
                      min={1}
                      max={50}
                      value={customCols}
                      onChange={(e) => setCustomCols(e.target.value)}
                      className="w-14 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-850 dark:text-slate-100 text-xs text-center outline-none focus:border-indigo-500"
                    />
                    <button
                      onClick={handleCustomTableInsert}
                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-550 text-white rounded-lg text-xs font-bold transition-all"
                    >
                      Insert
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
          {activePopup === 'tableActions' && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 absolute top-full left-0 w-full z-30 shadow-xl">
              <div className="p-4 max-w-xs mx-auto space-y-3">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-center">Table Commands</p>
                
                <div className="grid grid-cols-2 gap-2">
                  <button onMouseDown={(e) => e.preventDefault()} onClick={handleAddRow} className="flex items-center justify-center gap-1.5 p-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-100 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-750 transition-colors">
                    <Plus className="w-3.5 h-3.5 text-emerald-500" /> Row
                  </button>
                  
                  <button onMouseDown={(e) => e.preventDefault()} onClick={handleDeleteRow} className="flex items-center justify-center gap-1.5 p-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-100 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-750 transition-colors">
                    <Trash2 className="w-3.5 h-3.5 text-rose-500" /> Row
                  </button>

                  <button onMouseDown={(e) => e.preventDefault()} onClick={handleAddColumn} className="flex items-center justify-center gap-1.5 p-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-100 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-750 transition-colors">
                    <Plus className="w-3.5 h-3.5 text-emerald-500" /> Col
                  </button>

                  <button onMouseDown={(e) => e.preventDefault()} onClick={handleDeleteColumn} className="flex items-center justify-center gap-1.5 p-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-100 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-750 transition-colors">
                    <Trash2 className="w-3.5 h-3.5 text-rose-500" /> Col
                  </button>
                </div>

                <div className="border-t border-slate-100 dark:border-slate-800 pt-2 mt-2">
                  <button onMouseDown={(e) => e.preventDefault()} onClick={handleDeleteTable} className="w-full flex items-center justify-center gap-1.5 p-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-lg text-xs font-bold transition-colors border border-rose-100 dark:border-rose-900/20">
                    <Trash2 className="w-3.5 h-3.5" /> Delete Table
                  </button>
                </div>
              </div>
            </motion.div>
          )}
          {activePopup === 'link' && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 absolute top-full left-0 w-full z-30 shadow-xl">
              <div className="p-4 max-w-sm mx-auto space-y-3">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                  {selectedLinkUrl ? 'Edit Link' : 'Insert Link'}
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter URL..."
                    value={linkUrl || selectedLinkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleLinkInsert(linkUrl || selectedLinkUrl);
                    }}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs outline-none focus:border-indigo-500"
                  />
                  <button
                    onClick={() => handleLinkInsert(linkUrl || selectedLinkUrl)}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-550 text-white rounded-lg text-xs font-bold transition-all"
                  >
                    Apply
                  </button>
                </div>
                {selectedLinkUrl && (
                  <button onClick={handleLinkRemove} className="w-full py-1 text-center text-xs font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-all">
                    Remove Link
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Floating Find & Replace Panel (Ctrl+F) */}
      <AnimatePresence>
        {showFindReplace && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -10 }} 
            className="absolute top-24 right-4 z-40 bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-4 w-76 backdrop-blur-md"
          >
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <Search className="w-4 h-4" /> Find & Replace
              </h4>
              <button onClick={() => setShowFindReplace(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-3">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Find text..."
                  value={findText}
                  onChange={(e) => { setFindText(e.target.value); updateMatchCount(); }}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 text-xs focus:border-indigo-500 outline-none"
                />
                {findText && (
                  <span className="absolute right-2.5 top-1.5 text-[9px] font-bold text-slate-400 bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                    {matchCount} matches
                  </span>
                )}
              </div>

              <input
                type="text"
                placeholder="Replace with..."
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 text-xs focus:border-indigo-500 outline-none"
              />

              <div className="flex gap-2">
                <button onClick={() => handleFind(false)} className="flex-1 py-1 px-2 text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 rounded-lg font-semibold border border-slate-205 dark:border-slate-750">← Prev</button>
                <button onClick={() => handleFind(true)} className="flex-1 py-1 px-2 text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 rounded-lg font-semibold border border-slate-205 dark:border-slate-750">Next →</button>
              </div>

              <div className="flex gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                <button onClick={handleReplace} className="flex-1 py-1.5 text-[11px] bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 rounded-lg font-bold border border-indigo-100 dark:border-indigo-900/20">Replace</button>
                <button onClick={handleReplaceAll} className="flex-1 py-1.5 text-[11px] bg-indigo-600 hover:bg-indigo-550 text-white rounded-lg font-bold">Replace All</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-row overflow-hidden relative">
        
        {/* REDESIGNED LEFT SIDEBAR (with drag-to-resize support) */}
        {!focusMode && (
          <div 
            className="hidden md:flex flex-col border-r border-slate-150 dark:border-slate-800 overflow-y-auto select-none bg-slate-50/60 dark:bg-slate-900/40 relative group/sidebar"
            style={{ width: `${sidebarWidth}px` }}
          >
            {/* Note details card */}
            <div className="p-5 space-y-6">
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <FileText className="w-4 h-4" /> Note Details
                </h3>
                <div className="space-y-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Title</label>
                    <input
                      type="text"
                      placeholder="Note Title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full text-base font-bold bg-transparent border-none outline-none text-slate-850 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-750"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Theme Color</label>
                    <div className="flex flex-wrap gap-2">
                      {COLORS.map(c => (
                        <button
                          key={c.value}
                          onClick={() => setColor(c.value)}
                          className={`w-6.5 h-6.5 rounded-full border-2 transition-all cursor-pointer flex items-center justify-center ${color === c.value ? 'border-slate-800 dark:border-white scale-110' : 'border-transparent opacity-50 hover:opacity-100'}`}
                          style={{ backgroundColor: c.value }}
                        >
                          {color === c.value && <Check className="w-3 h-3 text-white" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tags</label>
                    <div className="flex items-center gap-2 text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700 p-2 py-1.5 rounded-xl">
                      <Tag className="w-3.5 h-3.5" />
                      <input
                        type="text"
                        placeholder="work, life, ideas..."
                        value={tags}
                        onChange={(e) => setTags(e.target.value)}
                        className="flex-1 bg-transparent border-none outline-none text-xs text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Attachments panel */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Paperclip className="w-4 h-4" /> Attachments ({attachments.length})
                  </h3>
                  <label className="bg-indigo-50 dark:bg-indigo-950/20 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-400 p-1.5 rounded-lg transition-all cursor-pointer border border-indigo-100/30">
                    <Plus className="w-3.5 h-3.5" />
                    <input type="file" multiple className="hidden" onChange={handleFileUpload} />
                  </label>
                </div>

                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  <AnimatePresence>
                    {attachments.map(file => (
                      <motion.div
                        key={file.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        onClick={() => setViewingAttachment(file)}
                        className="group relative bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-2 flex items-center gap-2.5 cursor-pointer hover:border-indigo-200 dark:hover:border-indigo-900 transition-all shadow-sm"
                      >
                        <div className="w-8 h-8 bg-slate-50 dark:bg-slate-950 rounded-lg flex items-center justify-center border border-slate-150/40 dark:border-slate-800 overflow-hidden shrink-0">
                          {file.type.startsWith('image/') ? (
                            <img src={file.data} alt={file.name} className="w-full h-full object-cover" />
                          ) : (
                            <FileText className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold text-slate-800 dark:text-slate-100 truncate">{file.name}</p>
                          <p className="text-[9px] text-slate-400 uppercase tracking-widest">{(file.size / 1024).toFixed(1)} KB</p>
                        </div>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                          <button onClick={(e) => { e.stopPropagation(); downloadAttachment(file); }} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-slate-600 dark:text-slate-400 cursor-pointer">
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); deleteAttachment(file.id); }} className="p-1 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-md text-red-500 cursor-pointer">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>

              {/* Info panel */}
              <div className="border-t border-slate-200/60 dark:border-slate-800 pt-5">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <Info className="w-4 h-4" /> Info
                </h3>
                <div className="space-y-2 bg-slate-100/40 dark:bg-slate-900/30 p-4 rounded-2xl text-[11px] text-slate-500 dark:text-slate-400 border border-slate-200/40 dark:border-slate-800">
                  <div className="flex justify-between">
                    <span className="font-semibold uppercase tracking-wider text-[9px] flex items-center gap-1"><Clock className="w-3 h-3 text-slate-400" /> Created</span>
                    <span className="text-slate-700 dark:text-slate-300 font-bold">{note ? format(note.createdAt.toDate(), 'MMM dd, yyyy') : 'Just now'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold uppercase tracking-wider text-[9px] flex items-center gap-1"><Clock className="w-3 h-3 text-slate-400" /> Updated</span>
                    <span className="text-slate-700 dark:text-slate-300 font-bold">{lastSaved ? formatDistanceToNow(lastSaved, { addSuffix: true }) : 'Not saved yet'}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200/50 dark:border-slate-800 pt-1.5 mt-1.5">
                    <span className="font-semibold uppercase tracking-wider text-[9px]">Words</span>
                    <span className="text-slate-700 dark:text-slate-300 font-bold">{wordCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold uppercase tracking-wider text-[9px]">Reading Time</span>
                    <span className="text-slate-700 dark:text-slate-300 font-bold">~{readingTime} min read</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Resize handle bar */}
            <div 
              onMouseDown={startResizing}
              className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize group-hover/sidebar:bg-indigo-500/20 active:bg-indigo-600 transition-colors"
            />
          </div>
        )}

        {/* Content Pane */}
        <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 overflow-hidden relative">
          
          <div className="flex-1 overflow-y-auto no-scrollbar relative">
            
            {/* Inline Title input (Visible only in focusMode or on narrow screens) */}
            {(focusMode || window.innerWidth < 768) && (
              <div className="w-full pt-4 px-4 md:px-8">
                <input
                  type="text"
                  placeholder="Untitled Note..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-3.5xl font-black bg-transparent border-none outline-none text-slate-900 dark:text-white placeholder:text-slate-200 dark:placeholder:text-slate-800"
                />
                <div className="w-full h-px bg-slate-100 dark:bg-slate-800 mt-4 mb-2" />
              </div>
            )}

            {/* Center Content Editor container */}
            <div className="w-full">
              
              <div
                ref={contentRef}
                contentEditable
                onInput={handleInput}
                onKeyDown={handleKeyDown}
                onKeyUp={updateFormatState}
                onMouseUp={updateFormatState}
                onClick={handleContentClick}
                data-placeholder="Start writing your note..."
                className={`editor-content flex-1 w-full px-4 md:px-8 py-4 bg-transparent border-none outline-none text-[17px] text-slate-700 dark:text-slate-300 leading-relaxed outline-transparent focus:ring-0 ${
                  activeFont === 'sans' ? 'font-sans' : activeFont === 'serif' ? 'font-serif font-medium tracking-wide' : 'font-mono text-base'
                }`}
                style={{ minHeight: '400px' }}
              />

              {/* Clickable padding at the bottom to append new line */}
              <div 
                className="w-full cursor-text min-h-[100px]" 
                onClick={() => {
                  if (contentRef.current) {
                    const lastChild = contentRef.current.lastElementChild;
                    let targetNode = lastChild;
                    
                    if (!lastChild || (lastChild.nodeName !== 'DIV' && lastChild.nodeName !== 'P') || (lastChild.textContent?.trim() !== '' && lastChild.innerHTML !== '<br>')) {
                      const p = document.createElement('div');
                      p.innerHTML = '<br>';
                      contentRef.current.appendChild(p);
                      targetNode = p;
                      
                      const html = contentRef.current.innerHTML;
                      latestContent.current = html;
                      setBody(html);
                      pushToHistory(html);
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
          </div>

          {/* Premium Bottom status bar */}
          <div className="w-full border-t border-slate-100 dark:border-slate-800/80 px-5 py-2.5 bg-slate-50/50 dark:bg-slate-900/60 backdrop-blur flex justify-between items-center text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest select-none">
            <div className="flex items-center gap-4">
              <span>Words: {wordCount}</span>
              <span className="w-1.5 h-1.5 bg-slate-300 dark:bg-slate-750 rounded-full" />
              <span>Chars: {charCount}</span>
              <span className="w-1.5 h-1.5 bg-slate-300 dark:bg-slate-750 rounded-full" />
              <span>~{readingTime} min read</span>
            </div>
            <div>
              <span>Saved: {getRelativeTime(lastSaved)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Relative saved helper wrapper */}
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
              className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 text-center"
            >
              <div className="flex justify-center">
                <div className="p-4 bg-red-50 dark:bg-red-950/40 text-red-500 rounded-full animate-pulse">
                  <Trash2 className="w-8 h-8" />
                </div>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Delete Note</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium leading-relaxed">
                  Are you sure you want to delete this note? This action cannot be undone.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 font-bold py-3 rounded-xl transition-all cursor-pointer text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl shadow-lg transition-all cursor-pointer text-sm"
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

function getRelativeTime(date: Date | null): string {
  if (!date) return 'Not saved';
  try {
    return formatDistanceToNow(date, { addSuffix: true });
  } catch (e) {
    return 'Just now';
  }
}
