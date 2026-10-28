import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { collection, doc, setDoc, deleteDoc, serverTimestamp, addDoc, query, where, getDocs, onSnapshot, Timestamp } from 'firebase/firestore';
import { User as FirebaseUser } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Note, Attachment } from '../types';
import { 
  ArrowLeft, Save, Trash2, Paperclip, X, Download, FileText, Image as ImageIcon, Plus, Tag, Check, 
  Bold, Italic, List, ListOrdered, Link, Heading1, Heading2, Heading3, Quote, Undo, Redo, UploadCloud, 
  ChevronDown, ChevronUp, Underline, Strikethrough, Eraser, Type, AlignLeft, AlignCenter, AlignRight, 
  CheckSquare, Table, Search, Replace, GripVertical, Info, Clock, Highlighter, Minus,
  Folder, Briefcase, Heart, Lightbulb, Archive,
  Sparkles, Mic, MicOff, Volume2, VolumeX, Share2, Maximize2, Minimize2,
  AlertTriangle, Target, ChevronRight, Code as CodeIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useToast } from '../contexts/ToastContext';
import { format, formatDistanceToNow } from 'date-fns';
import FolderDropdown from './FolderDropdown';
import { useBackHandler } from '../utils/smartBackNavigation';
import AIAssistantDrawer from './AIAssistantDrawer';
import SlashCommandMenu from './SlashCommandMenu';
import ExportModal from './ExportModal';
import VoiceDictationModal from './VoiceDictationModal';
import { voiceDictation, audioReader } from '../utils/audioTools';
import { convertMarkdownBadgesAndLinksToHtml } from '../services/aiService';
import MermaidModal from './MermaidModal';
import MathFormulaModal from './MathFormulaModal';
import DrawingModal from './DrawingModal';
import { 
  GitFork, Sigma, Printer, Indent, Outdent, CaseSensitive, Bookmark, 
  Columns as Columns2, Subscript, Superscript, BookOpen, Palette, Square,
  Pencil, RotateCcw, RotateCw, Shapes, Circle, Triangle, Star, ArrowRight,
  MousePointer, Cloud, MessageSquare, ArrowLeftRight, Copy
} from 'lucide-react';

interface NoteEditorProps {
  user: FirebaseUser;
  note: Note | null;
  onBack: () => void;
  onSave?: (note: Note) => void;
}

const COLORS = [
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Rose', value: '#f43f5e' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Sky', value: '#0ea5e9' },
  { name: 'Violet', value: '#8b5cf6' },
  { name: 'Slate', value: '#64748b' }
];

const safeToDate = (ts: any): Date => {
  if (!ts) return new Date();
  if (typeof ts.toDate === 'function') return ts.toDate();
  if (ts.seconds !== undefined) return new Date(ts.seconds * 1000);
  if (ts._seconds !== undefined) return new Date(ts._seconds * 1000);
  return new Date(ts);
};

// Helper to extract clean plain text from HTML
const extractTextFromHtml = (html: string): string => {
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
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim();
};

// ✏️ Direct Inking / Pen Stroke Interface (OneNote style)
export type InkShapeType = 
  | 'line' | 'arrow' | 'doubleArrow'
  | 'rect' | 'roundedRect' | 'circle' | 'triangle' | 'diamond' | 'parallelogram'
  | 'star' | 'heart' | 'cloud' | 'calloutRect' | 'calloutRounded';

export type InkToolType = 'select' | 'pen' | 'highlighter' | 'eraser' | 'text' | InkShapeType;

export interface InkStroke {
  id: string;
  tool: InkToolType;
  color: string;
  width: number;
  points: { x: number; y: number }[];
  shapeStart?: { x: number; y: number };
  shapeEnd?: { x: number; y: number };
  text?: string;
  fontSize?: number;
}

const convertStrokesToSvg = (strokes: InkStroke[], width: number, height: number): string => {
  if (strokes.length === 0) return '';
  const elements = strokes.map(s => {
    // If it's a text stroke
    if (s.tool === 'text') {
      const x = s.shapeStart?.x || (s.points && s.points[0]?.x) || 50;
      const y = s.shapeStart?.y || (s.points && s.points[0]?.y) || 50;
      const fSize = s.fontSize || 22;
      const lines = (s.text || 'Text').split('\n');
      const textSpans = lines.map((line, idx) => `<tspan x="${x}" dy="${idx === 0 ? 0 : fSize * 1.35}">${line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</tspan>`).join('');
      return `<text x="${x}" y="${y + fSize}" font-family="'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="${fSize}" font-weight="bold" fill="${s.color}">${textSpans}</text>`;
    }

    // If it's a shape stroke
    if (s.shapeStart && s.shapeEnd) {
      const x1 = s.shapeStart.x;
      const y1 = s.shapeStart.y;
      const x2 = s.shapeEnd.x;
      const y2 = s.shapeEnd.y;
      const strokeWidth = s.width;
      const strokeColor = s.color;
      const minX = Math.min(x1, x2);
      const minY = Math.min(y1, y2);
      const maxX = Math.max(x1, x2);
      const maxY = Math.max(y1, y2);
      const w = Math.max(4, Math.abs(x2 - x1));
      const h = Math.max(4, Math.abs(y2 - y1));
      const cx = (x1 + x2) / 2;
      const cy = (y1 + y2) / 2;

      if (s.tool === 'line') {
        return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linecap="round" />`;
      }
      if (s.tool === 'arrow') {
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const headLen = Math.max(12, strokeWidth * 3.5);
        const a1x = x2 - headLen * Math.cos(angle - Math.PI / 6);
        const a1y = y2 - headLen * Math.sin(angle - Math.PI / 6);
        const a2x = x2 - headLen * Math.cos(angle + Math.PI / 6);
        const a2y = y2 - headLen * Math.sin(angle + Math.PI / 6);
        return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linecap="round" />` +
               `<polygon points="${x2},${y2} ${a1x},${a1y} ${a2x},${a2y}" fill="${strokeColor}" />`;
      }
      if (s.tool === 'doubleArrow') {
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const headLen = Math.max(12, strokeWidth * 3.5);
        const a1x = x2 - headLen * Math.cos(angle - Math.PI / 6);
        const a1y = y2 - headLen * Math.sin(angle - Math.PI / 6);
        const a2x = x2 - headLen * Math.cos(angle + Math.PI / 6);
        const a2y = y2 - headLen * Math.sin(angle + Math.PI / 6);

        const b1x = x1 + headLen * Math.cos(angle - Math.PI / 6);
        const b1y = y1 + headLen * Math.sin(angle - Math.PI / 6);
        const b2x = x1 + headLen * Math.cos(angle + Math.PI / 6);
        const b2y = y1 + headLen * Math.sin(angle + Math.PI / 6);
        return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linecap="round" />` +
               `<polygon points="${x2},${y2} ${a1x},${a1y} ${a2x},${a2y}" fill="${strokeColor}" />` +
               `<polygon points="${x1},${y1} ${b1x},${b1y} ${b2x},${b2y}" fill="${strokeColor}" />`;
      }
      if (s.tool === 'rect') {
        return `<rect x="${minX}" y="${minY}" width="${w}" height="${h}" rx="4" stroke="${strokeColor}" stroke-width="${strokeWidth}" fill="none" stroke-linejoin="round" />`;
      }
      if (s.tool === 'roundedRect') {
        return `<rect x="${minX}" y="${minY}" width="${w}" height="${h}" rx="14" stroke="${strokeColor}" stroke-width="${strokeWidth}" fill="none" stroke-linejoin="round" />`;
      }
      if (s.tool === 'circle') {
        const rx = w / 2;
        const ry = h / 2;
        return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" stroke="${strokeColor}" stroke-width="${strokeWidth}" fill="none" />`;
      }
      if (s.tool === 'triangle') {
        return `<polygon points="${minX + w / 2},${minY} ${maxX},${maxY} ${minX},${maxY}" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linejoin="round" fill="none" />`;
      }
      if (s.tool === 'diamond') {
        return `<polygon points="${minX + w / 2},${minY} ${maxX},${minY + h / 2} ${minX + w / 2},${maxY} ${minX},${minY + h / 2}" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linejoin="round" fill="none" />`;
      }
      if (s.tool === 'parallelogram') {
        return `<polygon points="${minX + w * 0.25},${minY} ${maxX},${minY} ${maxX - w * 0.25},${maxY} ${minX},${maxY}" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linejoin="round" fill="none" />`;
      }
      if (s.tool === 'star') {
        const outerR = Math.max(w, h) / 2;
        const innerR = outerR * 0.45;
        const pts: string[] = [];
        for (let i = 0; i < 10; i++) {
          const r = i % 2 === 0 ? outerR : innerR;
          const a = (i * Math.PI) / 5 - Math.PI / 2;
          pts.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`);
        }
        return `<polygon points="${pts.join(' ')}" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linejoin="round" fill="none" />`;
      }
      if (s.tool === 'heart') {
        const topH = h * 0.3;
        const d = `M ${cx} ${minY + topH} ` +
                  `C ${cx} ${minY}, ${minX} ${minY}, ${minX} ${minY + topH} ` +
                  `C ${minX} ${minY + (h + topH) / 2}, ${cx} ${minY + (h + topH) / 2}, ${cx} ${maxY} ` +
                  `C ${cx} ${minY + (h + topH) / 2}, ${maxX} ${minY + (h + topH) / 2}, ${maxX} ${minY + topH} ` +
                  `C ${maxX} ${minY}, ${cx} ${minY}, ${cx} ${minY + topH} Z`;
        return `<path d="${d}" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linejoin="round" fill="none" />`;
      }
      if (s.tool === 'cloud') {
        const r1 = Math.min(w, h) * 0.25;
        const r2 = Math.min(w, h) * 0.3;
        const r3 = Math.min(w, h) * 0.28;
        const d = `M ${minX + r1} ${maxY - 4} ` +
                  `A ${r1} ${r1} 0 0 1 ${minX + w * 0.45 - r2} ${minY + r2 + 6} ` +
                  `A ${r2} ${r2} 0 0 1 ${minX + w * 0.75} ${minY + r2 + 6} ` +
                  `A ${r3} ${r3} 0 0 1 ${maxX - 4} ${maxY - 4} Z`;
        return `<path d="${d}" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linejoin="round" fill="none" />`;
      }
      if (s.tool === 'calloutRect') {
        const bH = h * 0.78;
        const d = `M ${minX + 6} ${minY} ` +
                  `H ${maxX - 6} Q ${maxX} ${minY} ${maxX} ${minY + 6} ` +
                  `V ${minY + bH - 6} Q ${maxX} ${minY + bH} ${maxX - 6} ${minY + bH} ` +
                  `H ${minX + w * 0.4} L ${minX + w * 0.2} ${maxY} L ${minX + w * 0.28} ${minY + bH} ` +
                  `H ${minX + 6} Q ${minX} ${minY + bH} ${minX} ${minY + bH - 6} ` +
                  `V ${minY + 6} Q ${minX} ${minY} ${minX + 6} ${minY} Z`;
        return `<path d="${d}" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linejoin="round" fill="none" />`;
      }
      if (s.tool === 'calloutRounded') {
        const bH = h * 0.78;
        const cx = (minX + maxX) / 2;
        const cy = minY + bH / 2;
        const rx = w * 0.44;
        const ry = bH * 0.44;
        const puffs = 8;
        let d = '';
        for (let i = 0; i < puffs; i++) {
          const a1 = (i * Math.PI * 2) / puffs;
          const a2 = ((i + 1) * Math.PI * 2) / puffs;
          const midA = (a1 + a2) / 2;
          const p1x = cx + rx * Math.cos(a1);
          const p1y = cy + ry * Math.sin(a1);
          const p2x = cx + rx * Math.cos(a2);
          const p2y = cy + ry * Math.sin(a2);
          const ctrlX = cx + (rx * 1.25) * Math.cos(midA);
          const ctrlY = cy + (ry * 1.25) * Math.sin(midA);
          if (i === 0) d += `M ${p1x} ${p1y}`;
          d += ` Q ${ctrlX} ${ctrlY} ${p2x} ${p2y}`;
        }
        d += ' Z';
        const c1x = minX + w * 0.22;
        const c1y = minY + bH + (h - bH) * 0.38;
        const r1 = Math.max(3, Math.min(w, h) * 0.055);
        const c2x = minX + w * 0.12;
        const c2y = minY + bH + (h - bH) * 0.82;
        const r2 = Math.max(2, Math.min(w, h) * 0.035);
        return `<path d="${d}" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linejoin="round" fill="none" />` +
               `<circle cx="${c1x}" cy="${c1y}" r="${r1}" stroke="${strokeColor}" stroke-width="${strokeWidth}" fill="none" />` +
               `<circle cx="${c2x}" cy="${c2y}" r="${r2}" stroke="${strokeColor}" stroke-width="${strokeWidth}" fill="none" />`;
      }
    }

    if (!s.points || s.points.length === 0) return '';
    let d = `M ${s.points[0].x} ${s.points[0].y}`;
    if (s.points.length === 1) {
      d += ` m -0.5 0 a 0.5 0.5 0 1 0 1 0 a 0.5 0.5 0 1 0 -1 0`;
    } else {
      for (let i = 1; i < s.points.length - 1; i++) {
        const xc = (s.points[i].x + s.points[i + 1].x) / 2;
        const yc = (s.points[i].y + s.points[i + 1].y) / 2;
        d += ` Q ${s.points[i].x} ${s.points[i].y}, ${xc} ${yc}`;
      }
      const last = s.points[s.points.length - 1];
      d += ` L ${last.x} ${last.y}`;
    }
    const opacity = s.tool === 'highlighter' ? 0.38 : 1.0;
    const strokeWidth = s.tool === 'highlighter' ? s.width * 4 : s.width;
    return `<path d="${d}" stroke="${s.color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="${opacity}" />`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" shape-rendering="geometricPrecision" text-rendering="geometricPrecision" style="width: 100%; height: 100%; display: block; overflow: visible;">${elements}</svg>`;
};

// Helper to save selection
function saveSelection(container?: HTMLElement | null): Range | null {
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0);
    if (!container || container.contains(range.commonAncestorContainer)) {
      return range.cloneRange();
    }
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

const FONT_OPTIONS = [
  { value: 'outfit', label: 'Outfit Sans', desc: 'Modern Clean', class: 'font-outfit' },
  { value: 'inter', label: 'Inter Sans', desc: 'Sleek Professional', class: 'font-inter' },
  { value: 'jakarta', label: 'Plus Jakarta', desc: 'Tech Elegant', class: 'font-jakarta' },
  { value: 'playfair', label: 'Playfair Serif', desc: 'Editorial Serif', class: 'font-playfair' },
  { value: 'lora', label: 'Lora Serif', desc: 'Cozy Reader', class: 'font-lora' },
  { value: 'merriweather', label: 'Merriweather', desc: 'Classic Literary', class: 'font-merriweather' },
  { value: 'fira', label: 'Fira Mono', desc: 'Developer Mono', class: 'font-fira-mono' },
  { value: 'jetbrains', label: 'JetBrains Mono', desc: 'IDE Style', class: 'font-jetbrains' }
];

export default function NoteEditor({ user, note, onBack, onSave }: NoteEditorProps) {
  const { showToast } = useToast();

  // --- REFS ---
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fontMenuRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const fontSizeMenuRef = useRef<HTMLDivElement>(null);
  
  // Custom Undo/Redo Refs
  const undoStack = useRef<string[]>([note?.body || '']);
  const redoStack = useRef<string[]>([]);
  const historyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const savedSelectionRef = useRef<Range | null>(null);

  // Auto-Save Refs
  const latestContent = useRef(note?.body || '');
  const prevNoteIdRef = useRef<string | null>(note?.id || null);
  const isMountedRef = useRef(false);

  // --- STATE ---
  const [currentNoteId, setCurrentNoteId] = useState<string | null>(note?.id || null);
  const [title, setTitle] = useState(note?.title || '');
  const [body, setBody] = useState(note?.body || '');
  const [tags, setTags] = useState(note?.tags?.join(', ') || '');
  const [folder, setFolder] = useState<string>(note?.folder || 'all');
  const [color, setColor] = useState(note?.color || COLORS[0].value);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(note ? new Date() : null);

  // Snapshot for calculating changes
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState({
    title: note?.title || '',
    body: note?.body || '',
    tags: note?.tags?.join(', ') || '',
    folder: note?.folder || 'all',
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

  // --- NEW FEATURES STATES ---
  const [showAIDrawer, setShowAIDrawer] = useState(false);
  const [selectedTextForAI, setSelectedTextForAI] = useState('');
  const [selectedHtmlForAI, setSelectedHtmlForAI] = useState('');

  const handleOpenAIDrawer = () => {
    let selText = '';
    let selHtml = '';

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && contentRef.current) {
      const range = sel.getRangeAt(0);
      if (contentRef.current.contains(range.commonAncestorContainer) && !range.collapsed) {
        selText = sel.toString().trim();
        const div = document.createElement('div');
        div.appendChild(range.cloneContents());
        selHtml = div.innerHTML;
        savedSelectionRef.current = range.cloneRange();
      }
    }

    if (!selHtml && savedSelectionRef.current && contentRef.current) {
      if (contentRef.current.contains(savedSelectionRef.current.commonAncestorContainer) && !savedSelectionRef.current.collapsed) {
        const cloned = savedSelectionRef.current.cloneContents();
        const div = document.createElement('div');
        div.appendChild(cloned);
        selHtml = div.innerHTML;
        selText = div.textContent || '';
      }
    }

    setSelectedTextForAI(selText);
    setSelectedHtmlForAI(selHtml);
    setShowAIDrawer(true);
  };
  const [showExportModal, setShowExportModal] = useState(false);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [isDictating, setIsDictating] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [zenMode, setZenMode] = useState(false);
  
  // Slash Command Menu States
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashMenuPos, setSlashMenuPos] = useState({ top: 0, left: 0 });
  const [slashQuery, setSlashQuery] = useState('');

  const [activePopup, setActivePopup] = useState<'text' | 'paragraph' | 'table' | 'tableActions' | 'link' | 'highlighter' | 'divider' | 'columns' | 'shape' | 'insert' | null>(null);
  const [editingShapeEl, setEditingShapeEl] = useState<HTMLElement | null>(null);
  const [isA4Mode, setIsA4Mode] = useState(false);
  const [currentLineSpacing, setCurrentLineSpacing] = useState('1.6');

  // Mermaid Flowchart & Math Formula States
  const [showMermaidModal, setShowMermaidModal] = useState(false);
  const [editingDiagramEl, setEditingDiagramEl] = useState<HTMLElement | null>(null);
  const [initialDiagramCode, setInitialDiagramCode] = useState('');

  const [showMathModal, setShowMathModal] = useState(false);
  const [editingMathEl, setEditingMathEl] = useState<HTMLElement | null>(null);
  const [initialMathLatex, setInitialMathLatex] = useState('');

  // 🎨 Drawing Modal States (Google Docs style)
  const [showDrawingModal, setShowDrawingModal] = useState(false);
  const [editingDrawingEl, setEditingDrawingEl] = useState<HTMLElement | null>(null);
  const [initialDrawingData, setInitialDrawingData] = useState<string | undefined>(undefined);

  // ✏️ Direct Note Inking / Pen Mode States (OneNote & Apple Notes style)
  const [isInkingMode, setIsInkingMode] = useState(false);
  const [inkTool, setInkTool] = useState<InkToolType>('pen');
  const [inkColor, setInkColor] = useState('#6366f1');
  const [inkWidth, setInkWidth] = useState(3);
  const [showInkShapeMenu, setShowInkShapeMenu] = useState(false);
  const [inkStrokes, setInkStrokes] = useState<InkStroke[]>([]);
  const [inkHistory, setInkHistory] = useState<InkStroke[][]>([]);
  const [inkHistoryIndex, setInkHistoryIndex] = useState(-1);

  const [selectedInkStrokeId, setSelectedInkStrokeId] = useState<string | null>(null);
  const [eraserSize, setEraserSize] = useState<number>(28);
  const [eraserCursorPos, setEraserCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [inlineEditingInkTextId, setInlineEditingInkTextId] = useState<string | null>(null);

  const inkCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const currentStrokeRef = useRef<InkStroke | null>(null);
  const editorWrapperRef = useRef<HTMLDivElement | null>(null);
  const dragHandleRef = useRef<'body' | 'tl' | 'tr' | 'br' | 'bl' | 'tc' | 'bc' | 'ml' | 'mr' | null>(null);
  const dragStartPointRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragSnapshotRef = useRef<InkStroke | null>(null);

  // 🎨 Pastel Highlight Palette definition
  const PASTEL_HIGHLIGHT_COLORS = [
    { name: 'Soft Lemon', value: '#fef08a', colorName: 'Lemon' },
    { name: 'Mint Green', value: '#bbf7d0', colorName: 'Mint' },
    { name: 'Ice Blue', value: '#bfdbfe', colorName: 'Ice Blue' },
    { name: 'Soft Lavender', value: '#e9d5ff', colorName: 'Lavender' },
    { name: 'Peach Nectar', value: '#fed7aa', colorName: 'Peach' },
    { name: 'Rose Blush', value: '#fbcfe8', colorName: 'Rose' }
  ];

  const togglePopup = (popupName: 'text' | 'paragraph' | 'table' | 'tableActions' | 'link' | 'highlighter' | 'divider' | 'columns' | 'shape' | 'insert' | null) => {
    setActivePopup(current => {
      const next = current === popupName ? null : popupName;
      if (next) {
        // Save selection before opening the popup if inside editor
        const validRange = saveSelection(contentRef.current);
        if (validRange) {
          savedSelectionRef.current = validRange;
        }
        // On mobile/touch screens, blur active element to dismiss soft keyboard and prevent layout jumps
        if (window.innerWidth < 768) {
          (document.activeElement as HTMLElement)?.blur();
          
          // Reset window scroll position to top to override browser keyboard-scroll bugs
          setTimeout(() => {
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' as any });
            document.body.scrollTop = 0;
          }, 50);
        }
      } else {
        // When closing popup, restore focus if selection exists
        if (savedSelectionRef.current && contentRef.current) {
          restoreSelection(savedSelectionRef.current);
        }
      }
      return next;
    });
  };

  const handleButtonMouseDown = (e: React.MouseEvent) => {
    if (window.innerWidth >= 768) {
      e.preventDefault();
    }
  };

  const [showFindReplace, setShowFindReplace] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [viewingAttachment, setViewingAttachment] = useState<Attachment | null>(null);
  const [activeFont, setActiveFont] = useState<string>('outfit');
  const [showFontMenu, setShowFontMenu] = useState(false);
  const [showFontSizeMenu, setShowFontSizeMenu] = useState(false);
  const [hoveredTable, setHoveredTable] = useState({ row: -1, col: -1 });
  const [customRows, setCustomRows] = useState('3');
  const [customCols, setCustomCols] = useState('3');
  const [localFontSize, setLocalFontSize] = useState('16');
  const [linkUrl, setLinkUrl] = useState('');
  const [selectedLinkUrl, setSelectedLinkUrl] = useState('');
  const [selectedHighlightColor, setSelectedHighlightColor] = useState('#fcd34d');
  const [selectedFontColor, setSelectedFontColor] = useState('#6366f1');

  // Find & Replace state
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [matchCount, setMatchCount] = useState(0);

  // 🛡️ Smart Back Handlers: close open modals, sheets, and popups on back gesture without leaving editor
  useBackHandler(() => {
    setViewingAttachment(null);
    return true;
  }, viewingAttachment !== null);

  useBackHandler(() => {
    setShowDeleteConfirm(false);
    return true;
  }, showDeleteConfirm);

  useBackHandler(() => {
    setShowFindReplace(false);
    return true;
  }, showFindReplace);

  useBackHandler(() => {
    setActivePopup(null);
    return true;
  }, activePopup !== null);

  useBackHandler(() => {
    setShowFontMenu(false);
    setShowFontSizeMenu(false);
    return true;
  }, showFontMenu || showFontSizeMenu);

  useBackHandler(() => {
    setShowVoiceModal(false);
    return true;
  }, showVoiceModal);

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
      if (fontSizeMenuRef.current && !fontSizeMenuRef.current.contains(event.target as Node)) {
        setShowFontSizeMenu(false);
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

  // Document-level Selection Change Listener to dynamically track latest cursor position & formats
  useEffect(() => {
    const handleSelectionChange = () => {
      // Only update if the active selection is inside our editor contentRef
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0 && contentRef.current) {
        const range = selection.getRangeAt(0);
        if (contentRef.current.contains(range.commonAncestorContainer)) {
          savedSelectionRef.current = range.cloneRange();
          updateFormatState();
        }
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, []);

  // Helper to find surrounding outermost block container (code, callout, toggle, table, image)
  const findBlockContainer = (startNode: Node | null): HTMLElement | null => {
    let node: Node | null = startNode;
    let foundBlock: HTMLElement | null = null;
    while (node && node !== contentRef.current) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        if (el.classList?.contains('glick-block-wrapper') ||
            el.classList?.contains('glick-callout') ||
            el.classList?.contains('glick-code-container') ||
            el.classList?.contains('glick-image-container') ||
            el.classList?.contains('glick-toggle') ||
            el.nodeName === 'PRE' ||
            el.nodeName === 'DETAILS' ||
            el.nodeName === 'TABLE') {
          foundBlock = el;
        }
      }
      node = node.parentNode;
    }

    if (foundBlock) {
      let curr: HTMLElement = foundBlock;
      while (curr.parentElement && curr.parentElement !== contentRef.current) {
        if (curr.parentElement.classList?.contains('glick-block-wrapper') ||
            curr.parentElement.classList?.contains('glick-code-container') ||
            curr.parentElement.classList?.contains('glick-toggle') ||
            curr.parentElement.nodeName === 'DETAILS' ||
            curr.parentElement.nodeName === 'TABLE') {
          curr = curr.parentElement;
        } else {
          break;
        }
      }
      return curr;
    }
    return null;
  };

  // Helper to ensure cursor is placed at the user's latest manual position before inserting any block/text
  const ensureSelectionInsideEditor = (forBlockInsertion: boolean = false) => {
    const sel = window.getSelection();
    let currentRange: Range | null = null;

    if (sel && sel.rangeCount > 0 && contentRef.current && contentRef.current.contains(sel.getRangeAt(0).commonAncestorContainer)) {
      currentRange = sel.getRangeAt(0).cloneRange();
    } else if (savedSelectionRef.current && contentRef.current) {
      restoreSelection(savedSelectionRef.current);
      contentRef.current.focus();
      const liveSel = window.getSelection();
      if (liveSel && liveSel.rangeCount > 0) {
        currentRange = liveSel.getRangeAt(0).cloneRange();
      }
    } else if (contentRef.current) {
      contentRef.current.focus();
      const range = document.createRange();
      range.selectNodeContents(contentRef.current);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
      currentRange = range.cloneRange();
    }

    // 🛡️ CRITICAL BLOCK ESCAPE: If inserting a new block (toggle, code, callout, table, image, checklist)
    // and the cursor is currently inside an existing block container, break out to a new line below it!
    if (forBlockInsertion && currentRange && contentRef.current) {
      const blockContainer = findBlockContainer(currentRange.startContainer);
      if (blockContainer && blockContainer !== contentRef.current) {
        let nextP = blockContainer.nextElementSibling as HTMLElement;
        if (!nextP || (nextP.nodeName !== 'P' && nextP.nodeName !== 'DIV')) {
          nextP = document.createElement('p');
          nextP.innerHTML = '<br>';
          blockContainer.parentNode?.insertBefore(nextP, blockContainer.nextSibling);
        }
        const newRange = document.createRange();
        newRange.setStart(nextP, 0);
        newRange.collapse(true);
        const curSel = window.getSelection();
        curSel?.removeAllRanges();
        curSel?.addRange(newRange);
        contentRef.current.focus();
        currentRange = newRange.cloneRange();
        savedSelectionRef.current = currentRange;
        return;
      }
    }

    if (currentRange) {
      savedSelectionRef.current = currentRange;
    }
  };

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

    // Check highlight (background color) using explicit inline styles to avoid dark-theme background false positives
    let isHighlighted = false;
    let detectedHighlightColor = '';
    if (selection && selection.rangeCount > 0 && contentRef.current) {
      let node: Node | null = selection.focusNode;
      if (node && contentRef.current.contains(node)) {
        let element: HTMLElement | null = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement;
        while (element && element !== contentRef.current) {
          const bg = element.style.backgroundColor;
          if (bg) {
            if (bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)') {
              isHighlighted = false;
              break;
            } else {
              isHighlighted = true;
              detectedHighlightColor = bg;
              break;
            }
          }
          element = element.parentElement;
        }
      }
    }

    if (isHighlighted && detectedHighlightColor) {
      const hex = rgbToHex(detectedHighlightColor);
      if (hex) {
        setSelectedHighlightColor(hex);
      }
    }

    // Check exact pixel font size
    let currentFontSize = '17';
    if (selection && selection.rangeCount > 0 && contentRef.current) {
      let node: Node | null = selection.focusNode;
      if (node && contentRef.current.contains(node)) {
        const parentNode = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement;
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

    const fontColorVal = document.queryCommandValue('foreColor');
    if (fontColorVal) {
      const hex = rgbToHex(fontColorVal.toString());
      if (hex) {
        setSelectedFontColor(hex);
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

  // Helper to upgrade older notes' snippets, callouts, and toggles with delete & copy buttons
  const upgradeLegacyBlocks = (root: HTMLElement) => {
    try {
      // 1. Upgrade legacy code blocks
      const legacyPres = root.querySelectorAll('pre.glick-code-block, pre');
      legacyPres.forEach((pre) => {
        if (!pre.closest('.glick-code-container')) {
          const wrapper = document.createElement('div');
          wrapper.className = 'glick-block-wrapper glick-code-container';
          wrapper.setAttribute('style', 'margin: 12px 0; border-radius: 12px; overflow: hidden; border: 1px solid #334155; background: #0f172a;');
          
          const header = document.createElement('div');
          header.setAttribute('style', 'display: flex; align-items: center; justify-content: space-between; padding: 6px 12px; background: #1e293b; border-bottom: 1px solid #334155; user-select: none;');
          header.setAttribute('contenteditable', 'false');
          header.innerHTML = `
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="width: 10px; height: 10px; border-radius: 50%; background: #ef4444; display: inline-block;"></span>
              <span style="width: 10px; height: 10px; border-radius: 50%; background: #f59e0b; display: inline-block;"></span>
              <span style="width: 10px; height: 10px; border-radius: 50%; background: #10b981; display: inline-block;"></span>
              <span style="font-family: monospace; font-size: 11px; font-weight: 700; color: #94a3b8; margin-left: 6px;">CODE</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <button type="button" data-action="copy-code" title="Copy code" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #cbd5e1; font-size: 11px; padding: 2px 8px; border-radius: 6px; cursor: pointer;">📋 Copy</button>
              <button type="button" data-action="delete-block" title="Delete code block" style="background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); color: #fca5a5; font-size: 11px; padding: 2px 8px; border-radius: 6px; cursor: pointer;">✕ Delete</button>
            </div>
          `;
          pre.parentNode?.insertBefore(wrapper, pre);
          wrapper.appendChild(header);
          wrapper.appendChild(pre);
        }
      });

      // 2. Upgrade legacy callouts without delete button
      const callouts = root.querySelectorAll('.glick-callout');
      callouts.forEach((callout) => {
        callout.classList.add('glick-block-wrapper');
        if (!callout.querySelector('[data-action="delete-block"]')) {
          const strong = callout.querySelector('strong');
          if (strong && strong.parentElement) {
            const headerDiv = document.createElement('div');
            headerDiv.setAttribute('style', 'display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;');
            headerDiv.setAttribute('contenteditable', 'false');
            
            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.setAttribute('data-action', 'delete-block');
            deleteBtn.title = 'Delete Callout';
            deleteBtn.setAttribute('style', 'background: transparent; border: none; cursor: pointer; color: #94a3b8; padding: 2px 6px; border-radius: 6px; font-size: 14px; line-height: 1; user-select: none;');
            deleteBtn.textContent = '✕';
            
            strong.parentElement.insertBefore(headerDiv, strong);
            headerDiv.appendChild(strong);
            headerDiv.appendChild(deleteBtn);
          }
        }
      });

      // 3. Upgrade legacy toggles with rotating arrow and delete button
      const toggles = root.querySelectorAll('details.glick-toggle, details');
      toggles.forEach((details) => {
        details.classList.add('glick-block-wrapper');
        details.classList.add('glick-toggle');
        const summary = details.querySelector('summary');
        if (summary) {
          summary.setAttribute('style', 'font-weight: 700; font-size: 14px; cursor: pointer; outline: none; color: #4f46e5; display: flex; align-items: center; justify-content: space-between; user-select: none;');
          
          if (!summary.querySelector('.glick-toggle-arrow')) {
            const arrow = document.createElement('span');
            arrow.className = 'glick-toggle-arrow';
            arrow.setAttribute('contenteditable', 'false');
            arrow.textContent = '▶';

            const firstChild = summary.firstElementChild;
            if (firstChild && firstChild.tagName === 'DIV' && firstChild !== summary.querySelector('[data-action="delete-block"]')) {
              firstChild.insertBefore(arrow, firstChild.firstChild);
            } else {
              const textSpan = document.createElement('span');
              textSpan.style.outline = 'none';
              textSpan.textContent = summary.textContent?.replace('✕', '').replace('▶', '').trim() || 'Toggle Section';
              
              const deleteBtn = summary.querySelector('[data-action="delete-block"]');
              summary.innerHTML = '';
              
              const leftDiv = document.createElement('div');
              leftDiv.setAttribute('style', 'display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;');
              leftDiv.appendChild(arrow);
              leftDiv.appendChild(textSpan);
              summary.appendChild(leftDiv);
              if (deleteBtn) summary.appendChild(deleteBtn);
            }
          }

          if (!summary.querySelector('[data-action="delete-block"]')) {
            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.setAttribute('data-action', 'delete-block');
            deleteBtn.title = 'Delete toggle section';
            deleteBtn.setAttribute('contenteditable', 'false');
            deleteBtn.setAttribute('style', 'background: transparent; border: none; cursor: pointer; color: #94a3b8; padding: 2px 6px; border-radius: 6px; font-size: 14px; line-height: 1; user-select: none; margin-left: 8px;');
            deleteBtn.textContent = '✕';
            summary.appendChild(deleteBtn);
          }
        }
      });

      // 4. Upgrade image containers to have Windows-style corner grip (3x3 dots)
      const images = root.querySelectorAll('.glick-image-container');
      images.forEach((container) => {
        const toolbar = container.querySelector('.glick-image-toolbar');
        if (toolbar) toolbar.remove();
        const handles = container.querySelectorAll('.glick-resize-handle');
        handles.forEach(h => h.remove());

        const img = container.querySelector('img');
        if (img) {
          const innerDiv = img.parentElement;
          if (innerDiv) {
            innerDiv.className = 'glick-image-resizable';
          }
        }
      });

      // 5. Automatically convert raw markdown badges, images, and links into rich visual HTML
      if (
        root.innerHTML.includes('[![') || 
        /!\[[^\]]*\]\([^)]+\)/.test(root.innerHTML) || 
        /\[[^\]]+\](?:\s*|<\/p>\s*<p[^>]*>|<br\s*\/?>)*\((?:https?:\/\/)/i.test(root.innerHTML)
      ) {
        const upgraded = convertMarkdownBadgesAndLinksToHtml(root.innerHTML);
        if (upgraded !== root.innerHTML) {
          root.innerHTML = upgraded;
          latestContent.current = upgraded;
          setBody(upgraded);
        }
      }
    } catch (e) {
      console.warn('Block upgrade notice:', e);
    }
  };

  // Sync state when note prop changes from parent (e.g. switching notes)
  useEffect(() => {
    const targetNoteId = note?.id || null;
    const isFirstMount = !isMountedRef.current;
    const isDifferentNote = targetNoteId !== currentNoteId;

    if (isFirstMount || isDifferentNote) {
      isMountedRef.current = true;
      setCurrentNoteId(targetNoteId);
      setTitle(note?.title || '');
      setBody(note?.body || '');
      setTags(note?.tags?.join(', ') || '');
      setFolder(note?.folder || 'all');
      setColor(note?.color || COLORS[0].value);
      setLastSaved(note ? new Date() : null);
      
      undoStack.current = [note?.body || ''];
      redoStack.current = [];
      latestContent.current = note?.body || '';
      prevNoteIdRef.current = targetNoteId;

      setLastSavedSnapshot({
        title: note?.title || '',
        body: note?.body || '',
        tags: note?.tags?.join(', ') || '',
        folder: note?.folder || 'all',
        color: note?.color || COLORS[0].value
      });

      if (contentRef.current) {
        contentRef.current.innerHTML = note?.body || '';
        upgradeLegacyBlocks(contentRef.current);
        const layer = contentRef.current.querySelector('.glick-page-ink-layer');
        if (layer) {
          const json = layer.getAttribute('data-ink-json');
          if (json) {
            try {
              const parsed = JSON.parse(decodeURIComponent(json));
              setInkStrokes(parsed);
              setInkHistory([parsed]);
              setInkHistoryIndex(0);
            } catch {
              setInkStrokes([]);
              setInkHistory([]);
              setInkHistoryIndex(-1);
            }
          }
        } else {
          setInkStrokes([]);
          setInkHistory([]);
          setInkHistoryIndex(-1);
        }
      }

      // Always reset scroll to the very top so title and note header are cleanly visible
      requestAnimationFrame(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = 0;
        }
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' as any });
      });
    }
  }, [note?.id]);

  // Table resizing logic (supports mouse drag and touch gestures)
  useEffect(() => {
    const editor = contentRef.current;
    if (!editor) return;

    let activeCell: HTMLTableCellElement | null = null;
    let activeRow: HTMLTableRowElement | null = null;
    let activeTable: HTMLTableElement | null = null;
    let startX = 0;
    let startY = 0;
    let startWidth = 0;
    let startHeight = 0;
    let isResizing = false;
    let resizeDirection: 'col' | 'row' | null = null;

    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing) {
        if (resizeDirection === 'col' && activeCell) {
          const deltaX = e.clientX - startX;
          const newWidth = Math.max(40, startWidth + deltaX);
          activeCell.style.width = `${newWidth}px`;
          if (activeTable) {
            activeTable.style.tableLayout = 'fixed';
            activeTable.style.width = 'auto';
          }
        } else if (resizeDirection === 'row' && activeRow) {
          const deltaY = e.clientY - startY;
          const newHeight = Math.max(24, startHeight + deltaY);
          activeRow.style.height = `${newHeight}px`;
          for (let i = 0; i < activeRow.cells.length; i++) {
            activeRow.cells[i].style.height = `${newHeight}px`;
          }
        }
        return;
      }

      let target = e.target as HTMLElement;
      let cell: HTMLTableCellElement | null = null;
      while (target && target !== editor) {
        if (target.nodeName === 'TD' || target.nodeName === 'TH') {
          cell = target as HTMLTableCellElement;
          break;
        }
        target = target.parentElement as HTMLElement;
      }

      if (cell) {
        const rect = cell.getBoundingClientRect();
        const mouseX = e.clientX;
        const mouseY = e.clientY;
        const rightDist = rect.right - mouseX;
        const bottomDist = rect.bottom - mouseY;

        if (rightDist >= 0 && rightDist <= 8) {
          editor.style.cursor = 'col-resize';
          activeCell = cell;
          activeRow = null;
          resizeDirection = 'col';
          
          let parent: HTMLElement | null = cell;
          while (parent && parent !== editor) {
            if (parent.nodeName === 'TABLE') {
              activeTable = parent as HTMLTableElement;
              break;
            }
            parent = parent.parentElement;
          }
        } else if (bottomDist >= 0 && bottomDist <= 8) {
          editor.style.cursor = 'row-resize';
          activeRow = cell.parentElement as HTMLTableRowElement;
          activeCell = null;
          resizeDirection = 'row';
        } else if (!isResizing) {
          editor.style.cursor = 'inherit';
          activeCell = null;
          activeRow = null;
          activeTable = null;
          resizeDirection = null;
        }
      } else if (!isResizing) {
        editor.style.cursor = 'inherit';
        activeCell = null;
        activeRow = null;
        activeTable = null;
        resizeDirection = null;
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if ((editor.style.cursor === 'col-resize' || editor.style.cursor === 'row-resize') && (activeCell || activeRow)) {
        isResizing = true;
        startX = e.clientX;
        startY = e.clientY;
        if (activeCell) {
          startWidth = activeCell.offsetWidth;
        }
        if (activeRow) {
          startHeight = activeRow.offsetHeight;
        }
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const handleMouseUp = () => {
      if (isResizing) {
        isResizing = false;
        editor.style.cursor = 'inherit';
        
        const html = editor.innerHTML;
        latestContent.current = html;
        setBody(html);
        pushToHistory(html);
      }
    };

    // Mobile touch handlers
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      
      let target = touch.target as HTMLElement;
      let cell: HTMLTableCellElement | null = null;
      while (target && target !== editor) {
        if (target.nodeName === 'TD' || target.nodeName === 'TH') {
          cell = target as HTMLTableCellElement;
          break;
        }
        target = target.parentElement as HTMLElement;
      }

      if (cell) {
        const rect = cell.getBoundingClientRect();
        const touchX = touch.clientX;
        const touchY = touch.clientY;
        const rightDist = rect.right - touchX;
        const bottomDist = rect.bottom - touchY;

        if (rightDist >= -5 && rightDist <= 15) {
          activeCell = cell;
          activeRow = null;
          resizeDirection = 'col';
          isResizing = true;
          startX = touch.clientX;
          startWidth = cell.offsetWidth;
          
          let parent: HTMLElement | null = cell;
          while (parent && parent !== editor) {
            if (parent.nodeName === 'TABLE') {
              activeTable = parent as HTMLTableElement;
              break;
            }
            parent = parent.parentElement;
          }
          e.preventDefault();
          e.stopPropagation();
        } else if (bottomDist >= -5 && bottomDist <= 15) {
          activeRow = cell.parentElement as HTMLTableRowElement;
          activeCell = null;
          resizeDirection = 'row';
          isResizing = true;
          startY = touch.clientY;
          startHeight = activeRow.offsetHeight;
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isResizing && e.touches.length === 1) {
        const touch = e.touches[0];
        if (resizeDirection === 'col' && activeCell) {
          const deltaX = touch.clientX - startX;
          const newWidth = Math.max(40, startWidth + deltaX);
          activeCell.style.width = `${newWidth}px`;
          if (activeTable) {
            activeTable.style.tableLayout = 'fixed';
            activeTable.style.width = 'auto';
          }
        } else if (resizeDirection === 'row' && activeRow) {
          const deltaY = touch.clientY - startY;
          const newHeight = Math.max(24, startHeight + deltaY);
          activeRow.style.height = `${newHeight}px`;
          for (let i = 0; i < activeRow.cells.length; i++) {
            activeRow.cells[i].style.height = `${newHeight}px`;
          }
        }
        e.preventDefault();
        e.stopPropagation();
      }
    };

    editor.addEventListener('mousemove', handleMouseMove);
    editor.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    editor.addEventListener('touchstart', handleTouchStart, { passive: false });
    editor.addEventListener('touchmove', handleTouchMove, { passive: false });
    editor.addEventListener('touchend', handleMouseUp);

    return () => {
      editor.removeEventListener('mousemove', handleMouseMove);
      editor.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      
      editor.removeEventListener('touchstart', handleTouchStart);
      editor.removeEventListener('touchmove', handleTouchMove);
      editor.removeEventListener('touchend', handleMouseUp);
    };
  }, [currentNoteId]);

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
    if (savedSelectionRef.current) {
      restoreSelection(savedSelectionRef.current);
    }
    if (contentRef.current) {
      pushToHistoryImmediate(contentRef.current.innerHTML);
    }
    document.execCommand(command, false, value);
    if (contentRef.current) {
      const html = contentRef.current.innerHTML;
      latestContent.current = html;
      setBody(html);
      pushToHistory(html);
      if (window.innerWidth >= 768) {
        contentRef.current.focus();
      }
    }
    updateFormatState();
    savedSelectionRef.current = saveSelection();
  };

  const handleHighlight = () => {
    if (savedSelectionRef.current) {
      restoreSelection(savedSelectionRef.current);
    }
    if (activeFormats.highlight) {
      const sel = window.getSelection();
      if (sel && sel.isCollapsed && contentRef.current) {
        let node: Node | null = sel.focusNode;
        if (node && contentRef.current.contains(node)) {
          let element: HTMLElement | null = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement;
          while (element && element !== contentRef.current) {
            const bg = element.style.backgroundColor;
            if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') {
              const range = document.createRange();
              range.selectNodeContents(element);
              sel.removeAllRanges();
              sel.addRange(range);
              savedSelectionRef.current = range.cloneRange();
              break;
            }
            element = element.parentElement;
          }
        }
      }
    }
    if (contentRef.current) {
      pushToHistoryImmediate(contentRef.current.innerHTML);
    }
    try {
      document.execCommand('styleWithCSS', false, 'true');
    } catch (e) {}
    if (activeFormats.highlight) {
      document.execCommand('hiliteColor', false, 'transparent');
      document.execCommand('backColor', false, 'transparent');
    } else {
      const colorToApply = (selectedHighlightColor && selectedHighlightColor !== 'transparent') ? selectedHighlightColor : '#fcd34d';
      if (colorToApply !== selectedHighlightColor) {
        setSelectedHighlightColor(colorToApply);
      }
      document.execCommand('hiliteColor', false, colorToApply);
      document.execCommand('backColor', false, colorToApply);
    }
    if (contentRef.current) {
      const html = contentRef.current.innerHTML;
      latestContent.current = html;
      setBody(html);
      pushToHistory(html);
      if (window.innerWidth >= 768) {
        contentRef.current.focus();
      }
    }
    updateFormatState();
    savedSelectionRef.current = saveSelection();
  };

  const handleHighlightColor = (color: string) => {
    if (savedSelectionRef.current) {
      restoreSelection(savedSelectionRef.current);
    }
    const isSameColorActive = activeFormats.highlight && selectedHighlightColor.toLowerCase() === color.toLowerCase();
    if (color === 'transparent' || isSameColorActive) {
      const sel = window.getSelection();
      if (sel && sel.isCollapsed && contentRef.current) {
        let node: Node | null = sel.focusNode;
        if (node && contentRef.current.contains(node)) {
          let element: HTMLElement | null = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement;
          while (element && element !== contentRef.current) {
            const bg = element.style.backgroundColor;
            if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') {
              const range = document.createRange();
              range.selectNodeContents(element);
              sel.removeAllRanges();
              sel.addRange(range);
              savedSelectionRef.current = range.cloneRange();
              break;
            }
            element = element.parentElement;
          }
        }
      }
    }
    if (contentRef.current) {
      pushToHistoryImmediate(contentRef.current.innerHTML);
    }
    try {
      document.execCommand('styleWithCSS', false, 'true');
    } catch (e) {}

    if (color === 'transparent') {
      document.execCommand('hiliteColor', false, 'transparent');
      document.execCommand('backColor', false, 'transparent');
      if (selectedHighlightColor === 'transparent') {
        setSelectedHighlightColor('#fcd34d');
      }
    } else {
      if (isSameColorActive) {
        document.execCommand('hiliteColor', false, 'transparent');
        document.execCommand('backColor', false, 'transparent');
      } else {
        setSelectedHighlightColor(color);
        document.execCommand('hiliteColor', false, color);
        document.execCommand('backColor', false, color);
      }
    }

    if (contentRef.current) {
      const html = contentRef.current.innerHTML;
      latestContent.current = html;
      setBody(html);
      pushToHistory(html);
      if (window.innerWidth >= 768) {
        contentRef.current.focus();
      }
    }
    updateFormatState();
    savedSelectionRef.current = saveSelection();
  };

  const handleClearFormatting = () => {
    if (savedSelectionRef.current) {
      restoreSelection(savedSelectionRef.current);
    }
    if (contentRef.current) {
      pushToHistoryImmediate(contentRef.current.innerHTML);
    }
    try {
      document.execCommand('styleWithCSS', false, 'true');
    } catch (e) {}
    document.execCommand('removeFormat', false, '');
    document.execCommand('hiliteColor', false, 'transparent');
    document.execCommand('backColor', false, 'transparent');
    if (contentRef.current) {
      const html = contentRef.current.innerHTML;
      latestContent.current = html;
      setBody(html);
      pushToHistory(html);
      if (window.innerWidth >= 768) {
        contentRef.current.focus();
      }
    }
    updateFormatState();
    savedSelectionRef.current = saveSelection();
  };

  const handleHeading = (level: 'h1' | 'h2' | 'h3') => {
    if (savedSelectionRef.current) {
      restoreSelection(savedSelectionRef.current);
    }
    if (contentRef.current) {
      pushToHistoryImmediate(contentRef.current.innerHTML);
    }
    document.execCommand('formatBlock', false, level.toUpperCase());
    if (contentRef.current) {
      const html = contentRef.current.innerHTML;
      latestContent.current = html;
      setBody(html);
      pushToHistory(html);
      if (window.innerWidth >= 768) {
        contentRef.current.focus();
      }
    }
    updateFormatState();
    savedSelectionRef.current = saveSelection();
  };

  const handleFontSize = (px: number) => {
    if (savedSelectionRef.current) {
      restoreSelection(savedSelectionRef.current);
    }

    if (contentRef.current && window.innerWidth >= 768) {
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
          
          // Reset any nested font-size styles inside the selection to guarantee the new size applies consistently
          const nestedSpans = fontEl.querySelectorAll('span, font');
          nestedSpans.forEach(child => {
            if (child instanceof HTMLElement) {
              child.style.fontSize = '';
            }
          });

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
    }
    updateFormatState();
    savedSelectionRef.current = saveSelection();
  };

  const handleFontColor = (color: string) => {
    if (savedSelectionRef.current) {
      restoreSelection(savedSelectionRef.current);
    }
    if (contentRef.current) {
      pushToHistoryImmediate(contentRef.current.innerHTML);
    }
    try {
      document.execCommand('styleWithCSS', false, 'true');
    } catch (e) {}
    setSelectedFontColor(color);
    document.execCommand('foreColor', false, color);
    if (contentRef.current) {
      const html = contentRef.current.innerHTML;
      latestContent.current = html;
      setBody(html);
      pushToHistory(html);
      if (window.innerWidth >= 768) {
        contentRef.current.focus();
      }
    }
    updateFormatState();
    savedSelectionRef.current = saveSelection();
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
    ensureSelectionInsideEditor(true);
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
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        savedSelectionRef.current = sel.getRangeAt(0).cloneRange();
      }
    }
  };

  // --- RICH CONTENT BLOCKS INSERTERS ---
  const handleInsertCallout = (type: 'tip' | 'warn' | 'goal') => {
    ensureSelectionInsideEditor(true);
    let border = '#6366f1';
    let bg = 'rgba(99, 102, 241, 0.08)';
    let emoji = '💡';
    let title = 'Tip';
    if (type === 'warn') {
      border = '#f59e0b';
      bg = 'rgba(245, 158, 11, 0.08)';
      emoji = '⚠️';
      title = 'Warning';
    } else if (type === 'goal') {
      border = '#10b981';
      bg = 'rgba(16, 185, 129, 0.08)';
      emoji = '🎯';
      title = 'Goal';
    }

    const focusId = `callout-focus-${Date.now()}`;
    const html = `<div class="glick-block-wrapper glick-callout callout-${type}" style="position: relative; padding: 12px 14px; margin: 12px 0; border-radius: 12px; background: ${bg}; border-left: 4px solid ${border}; display: flex; align-items: flex-start; gap: 10px;"><span style="font-size: 18px; user-select: none;" contenteditable="false">${emoji}</span><div style="flex: 1; min-width: 0;"><div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;" contenteditable="false"><strong style="color: ${border}; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">${title}</strong><button type="button" data-action="delete-block" title="Delete Callout" style="background: transparent; border: none; cursor: pointer; color: #94a3b8; padding: 2px 6px; border-radius: 6px; font-size: 14px; line-height: 1; user-select: none;">✕</button></div><p id="${focusId}" style="margin: 0; font-size: 14px; line-height: 1.5;">Write your ${title.toLowerCase()} details here...</p></div></div><p><br/></p>`;
    document.execCommand('insertHTML', false, html);
    if (contentRef.current) {
      const target = contentRef.current.querySelector(`#${focusId}`);
      if (target) {
        target.removeAttribute('id');
        const range = document.createRange();
        range.selectNodeContents(target);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
        contentRef.current.focus();
        savedSelectionRef.current = saveSelection(contentRef.current);
      }
      const h = contentRef.current.innerHTML;
      latestContent.current = h;
      setBody(h);
      pushToHistory(h);
    }
    showToast(`Inserted ${title} callout box`, 'success');
  };

  const handleInsertCodeBlock = () => {
    ensureSelectionInsideEditor(true);
    const focusId = `code-focus-${Date.now()}`;
    const html = `<div class="glick-block-wrapper glick-code-container" style="margin: 12px 0; border-radius: 12px; overflow: hidden; border: 1px solid #334155; background: #0f172a;"><div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 12px; background: #1e293b; border-bottom: 1px solid #334155; user-select: none;" contenteditable="false"><div style="display: flex; align-items: center; gap: 6px;"><span style="width: 10px; height: 10px; border-radius: 50%; background: #ef4444; display: inline-block;"></span><span style="width: 10px; height: 10px; border-radius: 50%; background: #f59e0b; display: inline-block;"></span><span style="width: 10px; height: 10px; border-radius: 50%; background: #10b981; display: inline-block;"></span><span style="font-family: monospace; font-size: 11px; font-weight: 700; color: #94a3b8; margin-left: 6px;">CODE</span></div><div style="display: flex; align-items: center; gap: 8px;"><button type="button" data-action="copy-code" title="Copy code" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #cbd5e1; font-size: 11px; padding: 2px 8px; border-radius: 6px; cursor: pointer;">📋 Copy</button><button type="button" data-action="delete-block" title="Delete code block" style="background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); color: #fca5a5; font-size: 11px; padding: 2px 8px; border-radius: 6px; cursor: pointer;">✕ Delete</button></div></div><pre class="glick-code-block" style="margin: 0; padding: 12px 14px; background: transparent; color: #f8fafc; font-family: monospace; font-size: 13px; line-height: 1.5; overflow-x: auto;"><code id="${focusId}">// Enter code snippet here...</code></pre></div><p><br/></p>`;
    document.execCommand('insertHTML', false, html);
    if (contentRef.current) {
      const target = contentRef.current.querySelector(`#${focusId}`);
      if (target) {
        target.removeAttribute('id');
        const range = document.createRange();
        range.selectNodeContents(target);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
        contentRef.current.focus();
        savedSelectionRef.current = saveSelection(contentRef.current);
      }
      const h = contentRef.current.innerHTML;
      latestContent.current = h;
      setBody(h);
      pushToHistory(h);
    }
    showToast('Inserted code block - ready to type', 'success');
  };

  const handleInsertToggle = () => {
    ensureSelectionInsideEditor(true);
    const focusId = `toggle-focus-${Date.now()}`;
    const html = `<details class="glick-block-wrapper glick-toggle" style="position: relative; padding: 10px 14px; margin: 10px 0; border: 1px solid rgba(148, 163, 184, 0.35); border-radius: 12px; background: rgba(248, 250, 252, 0.5);"><summary style="font-weight: 700; font-size: 14px; cursor: pointer; outline: none; color: #4f46e5; display: flex; align-items: center; justify-content: space-between; user-select: none;"><div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;"><span class="glick-toggle-arrow" contenteditable="false">▶</span><span id="${focusId}" style="outline: none;">Toggle Section (Click to expand)</span></div><button type="button" data-action="delete-block" title="Delete toggle section" contenteditable="false" style="background: transparent; border: none; cursor: pointer; color: #94a3b8; padding: 2px 6px; border-radius: 6px; font-size: 14px; line-height: 1; user-select: none; margin-left: 8px;">✕</button></summary><div style="margin-top: 8px; padding-left: 30px; font-size: 14px;"><p>Hidden notes, checklist, or deeper details go here...</p></div></details><p><br/></p>`;
    document.execCommand('insertHTML', false, html);
    if (contentRef.current) {
      const target = contentRef.current.querySelector(`#${focusId}`);
      if (target) {
        target.removeAttribute('id');
        const range = document.createRange();
        range.selectNodeContents(target);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
        contentRef.current.focus();
        savedSelectionRef.current = saveSelection(contentRef.current);
      }
      const h = contentRef.current.innerHTML;
      latestContent.current = h;
      setBody(h);
      pushToHistory(h);
    }
    showToast('Inserted collapsible toggle', 'success');
  };

  // --- MERMAID FLOWCHART & DIAGRAM HANDLERS ---
  const handleOpenMermaidModal = (existingEl?: HTMLElement, rawCode?: string) => {
    if (existingEl) {
      setEditingDiagramEl(existingEl);
      setInitialDiagramCode(rawCode || '');
    } else {
      setEditingDiagramEl(null);
      setInitialDiagramCode('');
    }
    setShowMermaidModal(true);
  };

  const handleInsertDiagram = (code: string, svg: string) => {
    const escapedCode = encodeURIComponent(code);
    const diagramHtml = `
      <div class="glick-block-wrapper glick-diagram-container" data-diagram-code="${escapedCode}" style="margin: 16px 0; border-radius: 14px; overflow: hidden; border: 1px solid #334155; background: #0f172a; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
        <div contenteditable="false" style="display: flex; align-items: center; justify-content: space-between; padding: 6px 12px; background: #1e293b; border-bottom: 1px solid #334155; user-select: none;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 13px;">🔀</span>
            <span style="font-size: 11px; font-weight: 700; color: #38bdf8; font-family: monospace; letter-spacing: 0.5px;">DIAGRAM & FLOWCHART</span>
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <button type="button" data-action="copy-diagram" title="Copy Diagram SVG" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #cbd5e1; font-size: 11px; padding: 2px 8px; border-radius: 6px; cursor: pointer;">📋 Copy</button>
            <button type="button" data-action="edit-diagram" title="Edit Diagram" style="background: rgba(56,189,248,0.15); border: 1px solid rgba(56,189,248,0.3); color: #7dd3fc; font-size: 11px; padding: 2px 8px; border-radius: 6px; cursor: pointer;">✏️ Edit</button>
            <button type="button" data-action="delete-block" title="Delete Diagram" style="background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); color: #fca5a5; font-size: 11px; padding: 2px 8px; border-radius: 6px; cursor: pointer;">✕ Delete</button>
          </div>
        </div>
        <div class="glick-diagram-render" style="padding: 16px; display: flex; justify-content: center; background: #ffffff; overflow-x: auto;">
          ${svg}
        </div>
      </div>
      <p><br/></p>
    `;

    if (editingDiagramEl) {
      editingDiagramEl.outerHTML = diagramHtml;
      setEditingDiagramEl(null);
      showToast('Diagram updated successfully!', 'success');
    } else {
      ensureSelectionInsideEditor(true);
      document.execCommand('insertHTML', false, diagramHtml);
      showToast('Flowchart / Diagram inserted into note!', 'success');
    }

    if (contentRef.current) {
      upgradeLegacyBlocks(contentRef.current);
      const h = contentRef.current.innerHTML;
      latestContent.current = h;
      setBody(h);
      pushToHistory(h);
    }
  };

  // --- LATEX MATH FORMULA HANDLERS ---
  const handleOpenMathModal = (existingEl?: HTMLElement, rawLatex?: string) => {
    if (existingEl) {
      setEditingMathEl(existingEl);
      setInitialMathLatex(rawLatex || '');
    } else {
      setEditingMathEl(null);
      setInitialMathLatex('');
    }
    setShowMathModal(true);
  };

  const handleInsertMath = (latex: string, renderedHtml: string) => {
    const escapedLatex = encodeURIComponent(latex);
    const mathBlockHtml = `
      <div class="glick-block-wrapper glick-math-container" data-math-latex="${escapedLatex}" style="margin: 14px 0; border-radius: 12px; overflow: hidden; border: 1px solid rgba(99, 102, 241, 0.25); background: rgba(99, 102, 241, 0.04); box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
        <div contenteditable="false" style="display: flex; align-items: center; justify-content: space-between; padding: 5px 12px; background: rgba(99, 102, 241, 0.09); border-bottom: 1px solid rgba(99, 102, 241, 0.15); user-select: none;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-weight: 900; color: #6366f1; font-size: 13px;">∑</span>
            <span style="font-size: 10.5px; font-weight: 700; color: #6366f1; font-family: monospace; letter-spacing: 0.5px;">MATH EQUATION</span>
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <button type="button" data-action="copy-latex" title="Copy LaTeX Formula" style="background: rgba(255,255,255,0.8); border: 1px solid rgba(99,102,241,0.25); color: #4338ca; font-size: 11px; padding: 2px 8px; border-radius: 6px; cursor: pointer;">📋 Copy</button>
            <button type="button" data-action="edit-math" title="Edit Formula" style="background: rgba(99,102,241,0.15); border: 1px solid rgba(99,102,241,0.3); color: #6366f1; font-size: 11px; padding: 2px 8px; border-radius: 6px; cursor: pointer;">✏️ Edit</button>
            <button type="button" data-action="delete-block" title="Delete Formula" style="background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); color: #dc2626; font-size: 11px; padding: 2px 8px; border-radius: 6px; cursor: pointer;">✕ Delete</button>
          </div>
        </div>
        <div class="glick-math-render" style="padding: 14px 18px; display: flex; justify-content: center; overflow-x: auto; font-size: 18px;">
          ${renderedHtml}
        </div>
      </div>
      <p><br/></p>
    `;

    if (editingMathEl) {
      editingMathEl.outerHTML = mathBlockHtml;
      setEditingMathEl(null);
      showToast('Math formula updated!', 'success');
    } else {
      ensureSelectionInsideEditor(true);
      document.execCommand('insertHTML', false, mathBlockHtml);
      showToast('LaTeX formula inserted into note!', 'success');
    }

    if (contentRef.current) {
      upgradeLegacyBlocks(contentRef.current);
      const h = contentRef.current.innerHTML;
      latestContent.current = h;
      setBody(h);
      pushToHistory(h);
    }
  };

  // --- 🎨 GOOGLE DOCS STYLE DRAWING & SKETCH HANDLERS ---
  const handleOpenDrawingModal = (existingEl?: HTMLElement, src?: string) => {
    if (existingEl) {
      setEditingDrawingEl(existingEl);
      setInitialDrawingData(src);
    } else {
      setEditingDrawingEl(null);
      setInitialDrawingData(undefined);
    }
    setShowDrawingModal(true);
  };

  const handleSaveDrawing = (dataUrl: string) => {
    const drawingHtml = `
      <div class="glick-block-wrapper glick-drawing-container" data-drawing-src="${dataUrl}" style="margin: 16px 0; border-radius: 14px; overflow: hidden; border: 1px solid rgba(99,102,241,0.25); background: #ffffff; box-shadow: 0 4px 16px rgba(15,23,42,0.08);">
        <div contenteditable="false" style="display: flex; align-items: center; justify-content: space-between; padding: 6px 12px; background: #f8fafc; border-bottom: 1px solid rgba(99,102,241,0.2); user-select: none;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 13px;">🎨</span>
            <span style="font-size: 11px; font-weight: 700; color: #6366f1; font-family: monospace; letter-spacing: 0.5px;">DRAWING / SKETCH</span>
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <button type="button" data-action="copy-drawing" title="Copy Drawing to Clipboard" style="background: rgba(99,102,241,0.08); border: 1px solid rgba(99,102,241,0.2); color: #6366f1; font-size: 11px; padding: 2px 8px; border-radius: 6px; cursor: pointer; font-weight: 600;">📋 Copy</button>
            <button type="button" data-action="edit-drawing" title="Edit Drawing" style="background: #6366f1; border: 1px solid #4f46e5; color: #ffffff; font-size: 11px; padding: 2px 8px; border-radius: 6px; cursor: pointer; font-weight: 600;">✏️ Edit</button>
            <button type="button" data-action="delete-block" title="Delete Drawing" style="background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.25); color: #ef4444; font-size: 11px; padding: 2px 8px; border-radius: 6px; cursor: pointer; font-weight: 600;">✕ Delete</button>
          </div>
        </div>
        <div class="glick-image-resizable" style="position: relative; display: flex; justify-content: center; padding: 12px; background: transparent; overflow-x: auto;">
          <img src="${dataUrl}" alt="Drawing" style="max-width: 100%; height: auto; display: block; border-radius: 8px; image-rendering: -webkit-optimize-contrast;" />
        </div>
      </div>
      <p><br/></p>
    `;

    if (editingDrawingEl) {
      editingDrawingEl.outerHTML = drawingHtml;
      setEditingDrawingEl(null);
      setInitialDrawingData(undefined);
      showToast('Drawing updated successfully!', 'success');
    } else {
      ensureSelectionInsideEditor(true);
      document.execCommand('insertHTML', false, drawingHtml);
      showToast('Drawing canvas inserted into note!', 'success');
    }

    if (contentRef.current) {
      upgradeLegacyBlocks(contentRef.current);
      const h = contentRef.current.innerHTML;
      latestContent.current = h;
      setBody(h);
      pushToHistory(h);
    }
  };

  // --- ✏️ ONE-NOTE / APPLE NOTES STYLE DIRECT NOTE INKING LOGIC ---
  // --- ✏️ ONE-NOTE / APPLE NOTES STYLE DIRECT NOTE INKING LOGIC ---
  const isInkShapeTool = (tool: string) => [
    'line', 'arrow', 'doubleArrow',
    'rect', 'roundedRect', 'circle', 'triangle', 'diamond', 'parallelogram',
    'star', 'heart', 'cloud', 'calloutRect', 'calloutRounded'
  ].includes(tool);

  const getStrokeBounds = (stroke: InkStroke): { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number } => {
    if (stroke.shapeStart && stroke.shapeEnd) {
      const minX = Math.min(stroke.shapeStart.x, stroke.shapeEnd.x);
      const maxX = Math.max(stroke.shapeStart.x, stroke.shapeEnd.x);
      const minY = Math.min(stroke.shapeStart.y, stroke.shapeEnd.y);
      const maxY = Math.max(stroke.shapeStart.y, stroke.shapeEnd.y);
      return { minX, minY, maxX, maxY, width: Math.max(12, maxX - minX), height: Math.max(12, maxY - minY) };
    }
    if (stroke.tool === 'text') {
      const x = stroke.shapeStart?.x || (stroke.points && stroke.points[0]?.x) || 50;
      const y = stroke.shapeStart?.y || (stroke.points && stroke.points[0]?.y) || 50;
      const fSize = stroke.fontSize || 22;
      const lines = (stroke.text || 'Text').split('\n');
      const maxLen = Math.max(...lines.map(l => l.length), 4);
      const width = Math.max(80, Math.round(maxLen * fSize * 0.6));
      const height = Math.max(fSize * 1.3, lines.length * fSize * 1.35);
      return { minX: x, minY: y, maxX: x + width, maxY: y + height, width, height };
    }
    if (stroke.points && stroke.points.length > 0) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of stroke.points) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      const pad = Math.max(6, stroke.width);
      return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad, width: (maxX - minX) + pad * 2, height: (maxY - minY) + pad * 2 };
    }
    return { minX: 0, minY: 0, maxX: 50, maxY: 50, width: 50, height: 50 };
  };

  const getHandleAt = (bounds: { minX: number; minY: number; maxX: number; maxY: number }, x: number, y: number, tolerance = 10): 'body' | 'tl' | 'tr' | 'br' | 'bl' | 'tc' | 'bc' | 'ml' | 'mr' | null => {
    const handles: { id: 'tl' | 'tr' | 'br' | 'bl' | 'tc' | 'bc' | 'ml' | 'mr'; hx: number; hy: number }[] = [
      { id: 'tl', hx: bounds.minX, hy: bounds.minY },
      { id: 'tr', hx: bounds.maxX, hy: bounds.minY },
      { id: 'br', hx: bounds.maxX, hy: bounds.maxY },
      { id: 'bl', hx: bounds.minX, hy: bounds.maxY },
      { id: 'tc', hx: (bounds.minX + bounds.maxX) / 2, hy: bounds.minY },
      { id: 'bc', hx: (bounds.minX + bounds.maxX) / 2, hy: bounds.maxY },
      { id: 'ml', hx: bounds.minX, hy: (bounds.minY + bounds.maxY) / 2 },
      { id: 'mr', hx: bounds.maxX, hy: (bounds.minY + bounds.maxY) / 2 },
    ];
    for (const h of handles) {
      if (Math.hypot(x - h.hx, y - h.hy) <= tolerance) {
        return h.id;
      }
    }
    if (x >= bounds.minX - 6 && x <= bounds.maxX + 6 && y >= bounds.minY - 6 && y <= bounds.maxY + 6) {
      return 'body';
    }
    return null;
  };

  const findStrokeAt = (x: number, y: number): InkStroke | null => {
    for (let i = inkStrokes.length - 1; i >= 0; i--) {
      const stroke = inkStrokes[i];
      const bounds = getStrokeBounds(stroke);
      if (x >= bounds.minX - 8 && x <= bounds.maxX + 8 && y >= bounds.minY - 8 && y <= bounds.maxY + 8) {
        return stroke;
      }
    }
    return null;
  };

  const renderInkCanvas = useCallback(() => {
    const canvas = inkCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.max(1, window.devicePixelRatio || 1);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const allStrokes = [...inkStrokes];
    if (currentStrokeRef.current) {
      allStrokes.push(currentStrokeRef.current);
    }

    for (const stroke of allStrokes) {
      ctx.save();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.tool === 'highlighter' ? stroke.width * 4 : stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = stroke.tool === 'highlighter' ? 0.38 : 1.0;

      // Render Text Stroke
      if (stroke.tool === 'text') {
        const x = stroke.shapeStart?.x || (stroke.points && stroke.points[0]?.x) || 50;
        const y = stroke.shapeStart?.y || (stroke.points && stroke.points[0]?.y) || 50;
        const fSize = stroke.fontSize || 22;
        ctx.font = `bold ${fSize}px 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
        ctx.fillStyle = stroke.color;
        ctx.textBaseline = 'top';
        const lines = (stroke.text || 'Text').split('\n');
        lines.forEach((line, idx) => {
          ctx.fillText(line, x, y + idx * fSize * 1.35);
        });
        ctx.restore();
        continue;
      }

      // Render Geometric Shapes
      if (stroke.shapeStart && stroke.shapeEnd) {
        const x1 = stroke.shapeStart.x;
        const y1 = stroke.shapeStart.y;
        const x2 = stroke.shapeEnd.x;
        const y2 = stroke.shapeEnd.y;
        const minX = Math.min(x1, x2);
        const minY = Math.min(y1, y2);
        const maxX = Math.max(x1, x2);
        const maxY = Math.max(y1, y2);
        const w = Math.max(4, Math.abs(x2 - x1));
        const h = Math.max(4, Math.abs(y2 - y1));
        const cx = (x1 + x2) / 2;
        const cy = (y1 + y2) / 2;

        if (stroke.tool === 'line') {
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        } else if (stroke.tool === 'arrow') {
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();

          const angle = Math.atan2(y2 - y1, x2 - x1);
          const headLen = Math.max(12, stroke.width * 3.5);
          ctx.beginPath();
          ctx.moveTo(x2, y2);
          ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
          ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
          ctx.closePath();
          ctx.fillStyle = stroke.color;
          ctx.fill();
        } else if (stroke.tool === 'doubleArrow') {
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();

          const angle = Math.atan2(y2 - y1, x2 - x1);
          const headLen = Math.max(12, stroke.width * 3.5);
          // End Arrowhead
          ctx.beginPath();
          ctx.moveTo(x2, y2);
          ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
          ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
          ctx.closePath();
          ctx.fillStyle = stroke.color;
          ctx.fill();

          // Start Arrowhead
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x1 + headLen * Math.cos(angle - Math.PI / 6), y1 + headLen * Math.sin(angle - Math.PI / 6));
          ctx.lineTo(x1 + headLen * Math.cos(angle + Math.PI / 6), y1 + headLen * Math.sin(angle + Math.PI / 6));
          ctx.closePath();
          ctx.fill();
        } else if (stroke.tool === 'rect') {
          ctx.beginPath();
          ctx.rect(minX, minY, w, h);
          ctx.stroke();
        } else if (stroke.tool === 'roundedRect') {
          const radius = Math.min(16, w / 4, h / 4);
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(minX, minY, w, h, radius);
          } else {
            ctx.rect(minX, minY, w, h);
          }
          ctx.stroke();
        } else if (stroke.tool === 'circle') {
          const rx = w / 2;
          const ry = h / 2;
          ctx.beginPath();
          ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
          ctx.stroke();
        } else if (stroke.tool === 'triangle') {
          ctx.beginPath();
          ctx.moveTo(cx, minY);
          ctx.lineTo(maxX, maxY);
          ctx.lineTo(minX, maxY);
          ctx.closePath();
          ctx.stroke();
        } else if (stroke.tool === 'diamond') {
          ctx.beginPath();
          ctx.moveTo(cx, minY);
          ctx.lineTo(maxX, cy);
          ctx.lineTo(cx, maxY);
          ctx.lineTo(minX, cy);
          ctx.closePath();
          ctx.stroke();
        } else if (stroke.tool === 'parallelogram') {
          const skew = w * 0.22;
          ctx.beginPath();
          ctx.moveTo(minX + skew, minY);
          ctx.lineTo(maxX, minY);
          ctx.lineTo(maxX - skew, maxY);
          ctx.lineTo(minX, maxY);
          ctx.closePath();
          ctx.stroke();
        } else if (stroke.tool === 'star') {
          const outerR = Math.max(w, h) / 2;
          const innerR = outerR * 0.42;
          ctx.beginPath();
          for (let i = 0; i < 10; i++) {
            const r = i % 2 === 0 ? outerR : innerR;
            const a = (i * Math.PI) / 5 - Math.PI / 2;
            const px = cx + r * Math.cos(a);
            const py = cy + r * Math.sin(a);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.stroke();
        } else if (stroke.tool === 'heart') {
          const topH = h * 0.3;
          ctx.beginPath();
          ctx.moveTo(cx, minY + topH);
          ctx.bezierCurveTo(cx, minY, minX, minY, minX, minY + topH);
          ctx.bezierCurveTo(minX, minY + (h + topH) / 2, cx, minY + (h + topH) / 2, cx, maxY);
          ctx.bezierCurveTo(cx, minY + (h + topH) / 2, maxX, minY + (h + topH) / 2, maxX, minY + topH);
          ctx.bezierCurveTo(maxX, minY, cx, minY, cx, minY + topH);
          ctx.closePath();
          ctx.stroke();
        } else if (stroke.tool === 'cloud') {
          const r1 = Math.min(w, h) * 0.25;
          const r2 = Math.min(w, h) * 0.3;
          const r3 = Math.min(w, h) * 0.28;
          ctx.beginPath();
          ctx.moveTo(minX + r1, maxY - 4);
          ctx.arc(minX + w * 0.45 - r2 / 2, minY + r2 + 6, r1, Math.PI, Math.PI * 1.8);
          ctx.arc(minX + w * 0.72, minY + r2 + 6, r2, Math.PI * 1.2, Math.PI * 2);
          ctx.arc(maxX - r3, maxY - r3 - 2, r3, Math.PI * 1.5, 0);
          ctx.lineTo(minX + r1, maxY - 4);
          ctx.closePath();
          ctx.stroke();
        } else if (stroke.tool === 'calloutRect') {
          const bH = h * 0.78;
          ctx.beginPath();
          ctx.moveTo(minX + 8, minY);
          ctx.lineTo(maxX - 8, minY);
          ctx.quadraticCurveTo(maxX, minY, maxX, minY + 8);
          ctx.lineTo(maxX, minY + bH - 8);
          ctx.quadraticCurveTo(maxX, minY + bH, maxX - 8, minY + bH);
          ctx.lineTo(minX + w * 0.45, minY + bH);
          ctx.lineTo(minX + w * 0.2, maxY);
          ctx.lineTo(minX + w * 0.3, minY + bH);
          ctx.lineTo(minX + 8, minY + bH);
          ctx.quadraticCurveTo(minX, minY + bH, minX, minY + bH - 8);
          ctx.lineTo(minX, minY + 8);
          ctx.quadraticCurveTo(minX, minY, minX + 8, minY);
          ctx.closePath();
        } else if (stroke.tool === 'calloutRounded') {
          const bH = h * 0.78;
          const cx = (minX + maxX) / 2;
          const cy = minY + bH / 2;
          const rx = w * 0.44;
          const ry = bH * 0.44;
          const puffs = 8;
          ctx.beginPath();
          for (let i = 0; i < puffs; i++) {
            const a1 = (i * Math.PI * 2) / puffs;
            const a2 = ((i + 1) * Math.PI * 2) / puffs;
            const midA = (a1 + a2) / 2;
            const p1x = cx + rx * Math.cos(a1);
            const p1y = cy + ry * Math.sin(a1);
            const p2x = cx + rx * Math.cos(a2);
            const p2y = cy + ry * Math.sin(a2);
            const ctrlX = cx + (rx * 1.25) * Math.cos(midA);
            const ctrlY = cy + (ry * 1.25) * Math.sin(midA);
            if (i === 0) ctx.moveTo(p1x, p1y);
            ctx.quadraticCurveTo(ctrlX, ctrlY, p2x, p2y);
          }
          ctx.closePath();
          ctx.stroke();

          // Thought bubbles
          const c1x = minX + w * 0.22;
          const c1y = minY + bH + (h - bH) * 0.38;
          const r1 = Math.max(3, Math.min(w, h) * 0.055);
          ctx.beginPath();
          ctx.arc(c1x, c1y, r1, 0, Math.PI * 2);
          ctx.stroke();

          const c2x = minX + w * 0.12;
          const c2y = minY + bH + (h - bH) * 0.82;
          const r2 = Math.max(2, Math.min(w, h) * 0.035);
          ctx.beginPath();
          ctx.arc(c2x, c2y, r2, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
        continue;
      }

      // Render Freehand Points
      if (!stroke.points || stroke.points.length === 0) {
        ctx.restore();
        continue;
      }
      ctx.beginPath();
      const pts = stroke.points;
      if (pts.length === 1) {
        ctx.arc(pts[0].x, pts[0].y, ctx.lineWidth / 2, 0, Math.PI * 2);
        ctx.fillStyle = stroke.color;
        ctx.fill();
      } else {
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length - 1; i++) {
          const xc = (pts[i].x + pts[i + 1].x) / 2;
          const yc = (pts[i].y + pts[i + 1].y) / 2;
          ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
        }
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Render Bounding Box and Resize Handles for Selected Stroke
    if (selectedInkStrokeId) {
      const selectedStroke = inkStrokes.find(s => s.id === selectedInkStrokeId);
      if (selectedStroke) {
        const bounds = getStrokeBounds(selectedStroke);
        ctx.save();
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.strokeRect(bounds.minX - 4, bounds.minY - 4, bounds.width + 8, bounds.height + 8);
        ctx.setLineDash([]);

        // Draw 8 handles: tl, tr, br, bl, tc, bc, ml, mr
        const handlePts = [
          { x: bounds.minX - 4, y: bounds.minY - 4 },
          { x: bounds.maxX + 4, y: bounds.minY - 4 },
          { x: bounds.maxX + 4, y: bounds.maxY + 4 },
          { x: bounds.minX - 4, y: bounds.maxY + 4 },
          { x: bounds.minX + bounds.width / 2, y: bounds.minY - 4 },
          { x: bounds.minX + bounds.width / 2, y: bounds.maxY + 4 },
          { x: bounds.minX - 4, y: bounds.minY + bounds.height / 2 },
          { x: bounds.maxX + 4, y: bounds.minY + bounds.height / 2 },
        ];

        handlePts.forEach(pt => {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 4.5, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.strokeStyle = '#6366f1';
          ctx.lineWidth = 2;
          ctx.stroke();
        });

        ctx.restore();
      }
    }

    ctx.restore();
  }, [inkStrokes, selectedInkStrokeId]);

  const eraseStrokesAt = (x: number, y: number) => {
    const r = eraserSize / 2;
    const remaining = inkStrokes.filter(stroke => {
      const bounds = getStrokeBounds(stroke);
      if ((stroke.shapeStart && stroke.shapeEnd) || stroke.tool === 'text') {
        const inBounds = (
          x >= bounds.minX - r &&
          x <= bounds.maxX + r &&
          y >= bounds.minY - r &&
          y <= bounds.maxY + r
        );
        if (inBounds) return false;
      }
      if (stroke.points && stroke.points.length > 0) {
        const touched = stroke.points.some(pt => Math.hypot(pt.x - x, pt.y - y) <= r);
        if (touched) return false;
      }
      return true;
    });

    if (remaining.length !== inkStrokes.length) {
      if (selectedInkStrokeId && !remaining.some(s => s.id === selectedInkStrokeId)) {
        setSelectedInkStrokeId(null);
      }
      setInkStrokes(remaining);
      const nextHist = [...inkHistory.slice(0, inkHistoryIndex + 1), remaining];
      setInkHistory(nextHist);
      setInkHistoryIndex(nextHist.length - 1);
    }
  };

  const handleInkPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = inkCanvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);

    setShowInkShapeMenu(false);

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (inkTool === 'eraser') {
      eraseStrokesAt(x, y);
      return;
    }

    if (inkTool === 'select') {
      if (selectedInkStrokeId) {
        const selStroke = inkStrokes.find(s => s.id === selectedInkStrokeId);
        if (selStroke) {
          const bounds = getStrokeBounds(selStroke);
          const handle = getHandleAt(bounds, x, y);
          if (handle) {
            dragHandleRef.current = handle;
            dragStartPointRef.current = { x, y };
            dragSnapshotRef.current = JSON.parse(JSON.stringify(selStroke));
            return;
          }
        }
      }
      const found = findStrokeAt(x, y);
      if (found) {
        setSelectedInkStrokeId(found.id);
        dragHandleRef.current = 'body';
        dragStartPointRef.current = { x, y };
        dragSnapshotRef.current = JSON.parse(JSON.stringify(found));
      } else {
        setSelectedInkStrokeId(null);
        dragHandleRef.current = null;
      }
      renderInkCanvas();
      return;
    }

    if (inkTool === 'text') {
      const newTextStroke: InkStroke = {
        id: `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        tool: 'text',
        color: inkColor,
        width: 2,
        fontSize: 22,
        text: 'Type text here...',
        shapeStart: { x, y },
        shapeEnd: { x: x + 180, y: y + 44 },
        points: [{ x, y }]
      };
      const nextStrokes = [...inkStrokes, newTextStroke];
      setInkStrokes(nextStrokes);
      const nextHist = [...inkHistory.slice(0, inkHistoryIndex + 1), nextStrokes];
      setInkHistory(nextHist);
      setInkHistoryIndex(nextHist.length - 1);
      setSelectedInkStrokeId(newTextStroke.id);
      setInlineEditingInkTextId(newTextStroke.id);
      setInkTool('select');
      return;
    }

    setSelectedInkStrokeId(null);

    if (isInkShapeTool(inkTool)) {
      currentStrokeRef.current = {
        id: `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        tool: inkTool,
        color: inkColor,
        width: inkWidth,
        points: [{ x, y }],
        shapeStart: { x, y },
        shapeEnd: { x, y }
      };
    } else {
      currentStrokeRef.current = {
        id: `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        tool: inkTool,
        color: inkColor,
        width: inkWidth,
        points: [{ x, y }]
      };
    }
    renderInkCanvas();
  };

  const handleInkPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = inkCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (inkTool === 'eraser') {
      setEraserCursorPos({ x, y });
      if (e.buttons & 1) {
        eraseStrokesAt(x, y);
      }
      return;
    } else {
      if (eraserCursorPos !== null) setEraserCursorPos(null);
    }

    if (inkTool === 'select' && dragHandleRef.current && dragSnapshotRef.current && (e.buttons & 1)) {
      const dx = x - dragStartPointRef.current.x;
      const dy = y - dragStartPointRef.current.y;
      const snap = dragSnapshotRef.current;
      const handle = dragHandleRef.current;

      setInkStrokes(prev => prev.map(s => {
        if (s.id !== snap.id) return s;
        if (handle === 'body') {
          if (s.shapeStart && s.shapeEnd && snap.shapeStart && snap.shapeEnd) {
            return {
              ...s,
              shapeStart: { x: snap.shapeStart.x + dx, y: snap.shapeStart.y + dy },
              shapeEnd: { x: snap.shapeEnd.x + dx, y: snap.shapeEnd.y + dy },
              points: snap.points.map(p => ({ x: p.x + dx, y: p.y + dy }))
            };
          }
          return {
            ...s,
            points: snap.points.map(p => ({ x: p.x + dx, y: p.y + dy }))
          };
        }

        // Resize handles: tl, tr, br, bl, tc, bc, ml, mr
        if (snap.shapeStart && snap.shapeEnd) {
          const origMinX = Math.min(snap.shapeStart.x, snap.shapeEnd.x);
          const origMaxX = Math.max(snap.shapeStart.x, snap.shapeEnd.x);
          const origMinY = Math.min(snap.shapeStart.y, snap.shapeEnd.y);
          const origMaxY = Math.max(snap.shapeStart.y, snap.shapeEnd.y);
          let newMinX = origMinX, newMaxX = origMaxX, newMinY = origMinY, newMaxY = origMaxY;

          if (handle === 'tl') { newMinX = Math.min(origMaxX - 10, origMinX + dx); newMinY = Math.min(origMaxY - 10, origMinY + dy); }
          else if (handle === 'tr') { newMaxX = Math.max(origMinX + 10, origMaxX + dx); newMinY = Math.min(origMaxY - 10, origMinY + dy); }
          else if (handle === 'br') { newMaxX = Math.max(origMinX + 10, origMaxX + dx); newMaxY = Math.max(origMinY + 10, origMaxY + dy); }
          else if (handle === 'bl') { newMinX = Math.min(origMaxX - 10, origMinX + dx); newMaxY = Math.max(origMinY + 10, origMaxY + dy); }
          else if (handle === 'tc') { newMinY = Math.min(origMaxY - 10, origMinY + dy); }
          else if (handle === 'bc') { newMaxY = Math.max(origMinY + 10, origMaxY + dy); }
          else if (handle === 'ml') { newMinX = Math.min(origMaxX - 10, origMinX + dx); }
          else if (handle === 'mr') { newMaxX = Math.max(origMinX + 10, origMaxX + dx); }

          const newH = newMaxY - newMinY;
          return {
            ...s,
            shapeStart: { x: newMinX, y: newMinY },
            shapeEnd: { x: newMaxX, y: newMaxY },
            fontSize: s.tool === 'text' ? Math.max(12, Math.min(64, Math.round(newH * 0.6))) : s.fontSize
          };
        }
        return s;
      }));
      renderInkCanvas();
      return;
    }

    if (currentStrokeRef.current && (e.buttons & 1)) {
      if (currentStrokeRef.current.shapeStart) {
        currentStrokeRef.current.shapeEnd = { x, y };
        renderInkCanvas();
      } else {
        const pts = currentStrokeRef.current.points;
        const last = pts[pts.length - 1];
        if (Math.hypot(x - last.x, y - last.y) >= 1.5) {
          pts.push({ x, y });
          renderInkCanvas();
        }
      }
    }
  };

  const handleInkPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = inkCanvasRef.current;
    if (!canvas) return;
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch {}

    if (dragHandleRef.current) {
      dragHandleRef.current = null;
      dragSnapshotRef.current = null;
      const nextHist = [...inkHistory.slice(0, inkHistoryIndex + 1), inkStrokes];
      setInkHistory(nextHist);
      setInkHistoryIndex(nextHist.length - 1);
      return;
    }

    if (currentStrokeRef.current) {
      const finished = currentStrokeRef.current;
      currentStrokeRef.current = null;
      if (finished.points.length > 0 || finished.shapeStart) {
        if (isInkShapeTool(finished.tool) && finished.shapeStart && finished.shapeEnd) {
          const w = Math.abs(finished.shapeEnd.x - finished.shapeStart.x);
          const h = Math.abs(finished.shapeEnd.y - finished.shapeStart.y);
          if (w < 15 && h < 15) {
            const isLine = finished.tool === 'line' || finished.tool === 'arrow' || finished.tool === 'doubleArrow';
            const defW = isLine ? 180 : 160;
            const defH = isLine ? 0 : 110;
            finished.shapeStart = { x: Math.round(finished.shapeStart.x - defW / 2), y: Math.round(finished.shapeStart.y - defH / 2) };
            finished.shapeEnd = { x: finished.shapeStart.x + defW, y: finished.shapeStart.y + defH };
          }
        }
        const nextStrokes = [...inkStrokes, finished];
        setInkStrokes(nextStrokes);
        const nextHist = [...inkHistory.slice(0, inkHistoryIndex + 1), nextStrokes];
        setInkHistory(nextHist);
        setInkHistoryIndex(nextHist.length - 1);
        if (isInkShapeTool(finished.tool)) {
          setSelectedInkStrokeId(finished.id);
          setInkTool('select');
        }
      }
    }
  };

  const handleInkUndo = () => {
    if (inkHistoryIndex > 0) {
      const targetIndex = inkHistoryIndex - 1;
      setInkHistoryIndex(targetIndex);
      const snapshot = inkHistory[targetIndex] || [];
      setInkStrokes(snapshot);
    } else if (inkHistoryIndex === 0) {
      setInkHistoryIndex(-1);
      setInkStrokes([]);
    }
  };

  const handleInkRedo = () => {
    if (inkHistoryIndex < inkHistory.length - 1) {
      const targetIndex = inkHistoryIndex + 1;
      setInkHistoryIndex(targetIndex);
      const snapshot = inkHistory[targetIndex] || [];
      setInkStrokes(snapshot);
    }
  };

  const handleInkClearAll = () => {
    setInkStrokes([]);
    const nextHist = [...inkHistory.slice(0, inkHistoryIndex + 1), []];
    setInkHistory(nextHist);
    setInkHistoryIndex(nextHist.length - 1);
  };

  const saveInkToNote = useCallback((strokesToSave: InkStroke[]) => {
    if (!contentRef.current) return;
    let layer = contentRef.current.querySelector('.glick-page-ink-layer') as HTMLElement;

    if (strokesToSave.length === 0) {
      if (layer) {
        layer.remove();
        const h = contentRef.current.innerHTML;
        latestContent.current = h;
        setBody(h);
        pushToHistory(h);
      }
      return;
    }

    const rect = contentRef.current.getBoundingClientRect();
    const width = Math.max(300, Math.round(rect.width) || 800);
    let maxY = 400;
    for (const s of strokesToSave) {
      if (s.shapeStart && s.shapeEnd) {
        if (s.shapeStart.y > maxY) maxY = s.shapeStart.y;
        if (s.shapeEnd.y > maxY) maxY = s.shapeEnd.y;
      }
      for (const p of s.points) {
        if (p.y > maxY) maxY = p.y;
      }
    }
    const height = Math.max(Math.round(rect.height) || 600, maxY + 60);

    const svg = convertStrokesToSvg(strokesToSave, width, height);

    if (!layer) {
      layer = document.createElement('div');
      layer.className = 'glick-page-ink-layer';
      layer.setAttribute('contenteditable', 'false');
      layer.style.position = 'absolute';
      layer.style.top = '0';
      layer.style.left = '0';
      layer.style.width = '100%';
      layer.style.height = '100%';
      layer.style.pointerEvents = 'none';
      layer.style.zIndex = '10';
      contentRef.current.appendChild(layer);
    }

    layer.setAttribute('data-ink-json', encodeURIComponent(JSON.stringify(strokesToSave)));
    layer.innerHTML = svg;

    const h = contentRef.current.innerHTML;
    latestContent.current = h;
    setBody(h);
    pushToHistory(h);
  }, []);

  const toggleInkingMode = () => {
    if (isInkingMode) {
      setIsInkingMode(false);
      saveInkToNote(inkStrokes);
      showToast('Ink drawings saved on note!', 'success');
    } else {
      if (contentRef.current) {
        const layer = contentRef.current.querySelector('.glick-page-ink-layer');
        if (layer) {
          const json = layer.getAttribute('data-ink-json');
          if (json) {
            try {
              const parsed = JSON.parse(decodeURIComponent(json));
              setInkStrokes(parsed);
              setInkHistory([parsed]);
              setInkHistoryIndex(0);
            } catch {}
          }
        }
      }
      setIsInkingMode(true);
      showToast('✏️ Draw Mode: Scribble, draw & highlight anywhere on the note!', 'info');
    }
  };

  useEffect(() => {
    if (!isInkingMode) return;
    const updateCanvasSize = () => {
      const canvas = inkCanvasRef.current;
      const editor = contentRef.current;
      if (!canvas || !editor) return;

      const rect = editor.getBoundingClientRect();
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const w = Math.round(rect.width);
      const h = Math.max(600, Math.round(rect.height));

      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      renderInkCanvas();
    };

    updateCanvasSize();
    const timer = setTimeout(updateCanvasSize, 50);
    window.addEventListener('resize', updateCanvasSize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateCanvasSize);
    };
  }, [isInkingMode, renderInkCanvas]);

  // --- AESTHETIC DECORATIVE DIVIDERS ---
  const handleInsertDivider = (type: 'gradient' | 'stars' | 'dots' | 'line') => {
    let dividerHtml = '';
    if (type === 'gradient') {
      dividerHtml = '<div class="glick-block-wrapper" style="margin: 24px 0; height: 2px; background: linear-gradient(90deg, transparent, #6366f1, transparent); border-radius: 2px;"></div><p><br/></p>';
    } else if (type === 'stars') {
      dividerHtml = '<div class="glick-block-wrapper" style="text-align: center; margin: 24px 0; color: #818cf8; font-size: 16px; letter-spacing: 14px; user-select: none;">✦ ✦ ✦</div><p><br/></p>';
    } else if (type === 'dots') {
      dividerHtml = '<div class="glick-block-wrapper" style="border-top: 2px dashed #94a3b8; margin: 24px 0; opacity: 0.5;"></div><p><br/></p>';
    } else {
      dividerHtml = '<hr class="glick-block-wrapper" style="border: none; border-top: 1px solid #cbd5e1; margin: 24px 0;" /><p><br/></p>';
    }
    ensureSelectionInsideEditor(true);
    document.execCommand('insertHTML', false, dividerHtml);
    togglePopup(null);
    if (contentRef.current) {
      const h = contentRef.current.innerHTML;
      latestContent.current = h;
      setBody(h);
      pushToHistory(h);
    }
    showToast('Aesthetic divider added!', 'success');
  };

  // --- LINE SPACING & PARAGRAPH INDENTATION ---
  const handleLineSpacing = (spacing: string) => {
    setCurrentLineSpacing(spacing);
    ensureSelectionInsideEditor();
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && contentRef.current) {
      let node: Node | null = sel.getRangeAt(0).commonAncestorContainer;
      while (node && node !== contentRef.current && (node.nodeType === Node.TEXT_NODE || (node as HTMLElement).tagName === 'SPAN')) {
        node = node.parentNode;
      }
      if (node && node !== contentRef.current) {
        (node as HTMLElement).style.lineHeight = spacing;
      } else {
        contentRef.current.style.lineHeight = spacing;
      }
      const h = contentRef.current.innerHTML;
      latestContent.current = h;
      setBody(h);
      pushToHistory(h);
      showToast(`Line spacing set to ${spacing}`, 'success');
    }
  };

  const handleIndent = () => {
    ensureSelectionInsideEditor();
    document.execCommand('indent', false);
    if (contentRef.current) {
      const h = contentRef.current.innerHTML;
      latestContent.current = h;
      setBody(h);
      pushToHistory(h);
    }
  };

  const handleOutdent = () => {
    ensureSelectionInsideEditor();
    document.execCommand('outdent', false);
    if (contentRef.current) {
      const h = contentRef.current.innerHTML;
      latestContent.current = h;
      setBody(h);
      pushToHistory(h);
    }
  };

  // --- LETTER CAPITALIZATION (CHANGE CASE) ---
  const handleChangeCase = (mode: 'uppercase' | 'lowercase' | 'title' | 'sentence') => {
    ensureSelectionInsideEditor();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const text = range.toString();
    if (!text) {
      showToast('Select text first to change case', 'info');
      return;
    }
    let converted = text;
    if (mode === 'uppercase') {
      converted = text.toUpperCase();
    } else if (mode === 'lowercase') {
      converted = text.toLowerCase();
    } else if (mode === 'title') {
      converted = text.replace(/\b\w/g, c => c.toUpperCase());
    } else if (mode === 'sentence') {
      converted = text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    }
    document.execCommand('insertText', false, converted);
    if (contentRef.current) {
      const h = contentRef.current.innerHTML;
      latestContent.current = h;
      setBody(h);
      pushToHistory(h);
    }
    showToast(`Converted to ${mode} case`, 'success');
  };

  // --- A4 PRINT & PAGE BREAK ---
  const handleInsertPageBreak = () => {
    ensureSelectionInsideEditor(true);
    const pageBreakHtml = `
      <div class="glick-block-wrapper glick-page-break glick-page-break-visual" contenteditable="false">
        <span class="glick-page-break-label">📄 PAGE BREAK (Ctrl+Enter)</span>
      </div>
      <p><br/></p>
    `;
    document.execCommand('insertHTML', false, pageBreakHtml);
    if (contentRef.current) {
      const h = contentRef.current.innerHTML;
      latestContent.current = h;
      setBody(h);
      pushToHistory(h);
    }
    showToast('Page break inserted!', 'success');
  };

  const handlePrint = () => {
    setActivePopup(null);
    setShowFindReplace(false);
    setEditingShapeEl(null);
    setShowFontSizeMenu(false);
    setShowFontMenu(false);
    setTimeout(() => {
      window.print();
    }, 50);
  };

  // --- SMART WEB BOOKMARK CARDS ---
  const handleInsertBookmark = (rawUrl: string) => {
    let url = rawUrl.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    let hostname = url;
    try {
      hostname = new URL(url).hostname;
    } catch (e) {
      hostname = url;
    }
    const cleanHost = hostname.replace(/^www\./i, '');
    const title = cleanHost.split('.')[0];
    const capitalizedTitle = title.charAt(0).toUpperCase() + title.slice(1);

    const bookmarkHtml = `
      <div class="glick-block-wrapper glick-bookmark-container" style="margin: 16px 0;">
        <div contenteditable="false" style="display: flex; align-items: center; justify-content: space-between; padding: 4px 10px; background: rgba(99,102,241,0.06); border-radius: 10px 10px 0 0; border: 1px solid rgba(99,102,241,0.2); border-bottom: none; user-select: none;">
          <span style="font-size: 11px; font-weight: 700; color: #6366f1; display: flex; align-items: center; gap: 4px;">🔖 BOOKMARK CARD</span>
          <button type="button" data-action="delete-block" style="background: transparent; border: none; color: #ef4444; font-size: 12px; cursor: pointer;" title="Delete Bookmark">✕</button>
        </div>
        <a href="${url}" target="_blank" rel="noopener noreferrer" contenteditable="false" class="glick-bookmark-card" style="display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; border: 1px solid rgba(99,102,241,0.25); border-radius: 0 0 12px 12px; background: rgba(255,255,255,0.9); text-decoration: none; color: inherit; box-shadow: 0 2px 8px rgba(0,0,0,0.04); transition: transform 0.15s ease;">
          <div style="flex: 1; min-width: 0; padding-right: 14px;">
            <div style="font-size: 14px; font-weight: 700; color: #1e293b; margin-bottom: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${capitalizedTitle}</div>
            <div style="font-size: 11px; color: #64748b; margin-bottom: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${url}</div>
            <div style="display: flex; align-items: center; gap: 6px; font-size: 10.5px; color: #6366f1; font-weight: 600;">
              <span>🌐 ${cleanHost}</span>
              <span>↗ Open link</span>
            </div>
          </div>
          <div style="width: 44px; height: 44px; border-radius: 10px; background: rgba(99,102,241,0.1); display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0;">
            🔗
          </div>
        </a>
      </div>
      <p><br/></p>
    `;
    ensureSelectionInsideEditor(true);
    document.execCommand('insertHTML', false, bookmarkHtml);
    if (contentRef.current) {
      const h = contentRef.current.innerHTML;
      latestContent.current = h;
      setBody(h);
      pushToHistory(h);
    }
    togglePopup(null);
    showToast('Smart Bookmark Card created!', 'success');
  };

  // --- MULTI-COLUMN SPLIT LAYOUT (2-COLUMN & 3-COLUMN) ---
  const handleInsertColumns = (count: 2 | 3) => {
    ensureSelectionInsideEditor(true);
    const columnsHtml = `
      <div class="glick-block-wrapper glick-columns-container glick-columns-${count}" style="display: grid; grid-template-columns: repeat(${count}, minmax(0, 1fr)); gap: 14px; margin: 18px 0; position: relative;">
        <div contenteditable="false" style="grid-column: 1 / -1; display: flex; align-items: center; justify-content: space-between; padding: 4px 10px; background: rgba(99,102,241,0.06); border-radius: 8px; border: 1px dashed rgba(99,102,241,0.25); user-select: none;">
          <span style="font-size: 10.5px; font-weight: 700; color: #6366f1;">⚖️ ${count}-COLUMN LAYOUT (SIDE-BY-SIDE)</span>
          <button type="button" data-action="delete-block" style="background: transparent; border: none; color: #ef4444; font-size: 12px; cursor: pointer;" title="Delete Columns">✕</button>
        </div>
        <div class="glick-column" style="min-height: 80px; padding: 12px; border: 1px dashed rgba(148, 163, 184, 0.35); border-radius: 10px; background: rgba(255,255,255,0.5);">
          <p><strong>Column 1:</strong> Type ideas or notes here...</p>
        </div>
        <div class="glick-column" style="min-height: 80px; padding: 12px; border: 1px dashed rgba(148, 163, 184, 0.35); border-radius: 10px; background: rgba(255,255,255,0.5);">
          <p><strong>Column 2:</strong> Type comparison or details here...</p>
        </div>
        ${count === 3 ? `
        <div class="glick-column" style="min-height: 80px; padding: 12px; border: 1px dashed rgba(148, 163, 184, 0.35); border-radius: 10px; background: rgba(255,255,255,0.5);">
          <p><strong>Column 3:</strong> Additional notes...</p>
        </div>` : ''}
      </div>
      <p><br/></p>
    `;
    document.execCommand('insertHTML', false, columnsHtml);
    if (contentRef.current) {
      const h = contentRef.current.innerHTML;
      latestContent.current = h;
      setBody(h);
      pushToHistory(h);
    }
    togglePopup(null);
    showToast(`${count}-Column layout inserted!`, 'success');
  };

  // --- AUDIO TOOLS (DICTATION & READER) ---
  const toggleVoiceDictation = () => {
    if (!voiceDictation.isSupported()) {
      showToast('Speech Recognition not supported in this browser. Try Chrome, Edge, or Brave.', 'error');
      return;
    }
    ensureSelectionInsideEditor();
    setShowVoiceModal(true);
  };

  const handleApplyVoiceText = (textToInsert: string) => {
    if (!textToInsert.trim()) return;
    ensureSelectionInsideEditor();
    document.execCommand('insertText', false, textToInsert.trim() + ' ');
    if (contentRef.current) {
      const h = contentRef.current.innerHTML;
      latestContent.current = h;
      setBody(h);
      pushToHistory(h);
      contentRef.current.focus();
    }
    showToast('Voice text added to note!', 'success');
  };

  const toggleAudioReader = () => {
    if (!audioReader.isSupported()) {
      showToast('Text-to-speech audio reader not supported in this browser.', 'error');
      return;
    }

    if (isPlayingAudio) {
      audioReader.stop();
      setIsPlayingAudio(false);
      showToast('Audio reader stopped', 'info');
    } else {
      const textToRead = (title ? title + '. ' : '') + extractTextFromHtml(body);
      if (!textToRead.trim()) {
        showToast('Note is empty! Nothing to read.', 'error');
        return;
      }
      setIsPlayingAudio(true);
      showToast('🔊 Reading note aloud...', 'info');
      audioReader.speak(
        textToRead,
        () => setIsPlayingAudio(false),
        () => setIsPlayingAudio(false)
      );
    }
  };

  // --- IN-DOCUMENT SHAPES & TEXT BOXES (MS WORD STYLE) ---
  const handleInsertShape = (presetType: string = 'rounded') => {
    ensureSelectionInsideEditor(true);
    const focusId = `shape-focus-${Date.now()}`;
    let fill = '#f8fafc';
    let border = '#6366f1';
    let bWidth = '2px';
    let bStyle = 'solid';
    let bRadius = '14px';
    let title = 'SHAPE / TEXT BOX';
    let defaultText = 'Type your notes or ideas inside this shape...';

    if (presetType === 'sticky') {
      fill = '#fef9c3';
      border = '#facc15';
      title = '📌 STICKY NOTE';
      defaultText = 'Write a quick memo, reminder or key takeaway here...';
    } else if (presetType === 'mint') {
      fill = 'rgba(16, 185, 129, 0.08)';
      border = '#10b981';
      title = '🎯 GOAL / MILESTONE';
      defaultText = 'Key project target, objective or completion criteria...';
    } else if (presetType === 'rose') {
      fill = 'rgba(244, 63, 94, 0.08)';
      border = '#f43f5e';
      title = '⚠️ IMPORTANT NOTICE';
      defaultText = 'Crucial point, warning, or deadline to keep in mind...';
    } else if (presetType === 'lavender') {
      fill = 'rgba(139, 92, 246, 0.08)';
      border = '#8b5cf6';
      title = '💡 INSIGHT / CONCEPT';
      defaultText = 'Key concept explanation, creative thought or summary...';
    } else if (presetType === 'dashed') {
      fill = 'transparent';
      border = '#94a3b8';
      bStyle = 'dashed';
      title = '⬚ DRAFT BOX';
      defaultText = 'Temporary scratchpad or draft section...';
    } else if (presetType === 'pill') {
      fill = '#f1f5f9';
      border = '#4f46e5';
      bRadius = '28px';
      title = '🏷️ PILL BADGE';
      defaultText = 'Status badge or category summary card...';
    }

    const shapeHtml = `
      <div class="glick-block-wrapper glick-shape-container" data-shape-type="${presetType}" style="margin: 18px 0; position: relative; max-width: 100%; width: 100%;">
        <!-- Floating Hover Action Bar: Only appears when hovering over or focusing inside shape -->
        <div contenteditable="false" class="glick-shape-floating-bar" style="position: absolute; top: -14px; right: 12px; display: flex; align-items: center; gap: 5px; z-index: 25; user-select: none;">
          <button type="button" data-action="style-shape" title="Edit Fill, Border & Corner Styles" style="background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(8px); border: 1px solid rgba(99,102,241,0.3); color: #4f46e5; font-size: 11px; padding: 3px 9px; border-radius: 8px; cursor: pointer; font-weight: 700; box-shadow: 0 2px 8px rgba(0,0,0,0.08); display: flex; align-items: center; gap: 3px;">🎨 Style</button>
          <button type="button" data-action="delete-block" title="Delete Shape" style="background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(8px); border: 1px solid rgba(239,68,68,0.3); color: #ef4444; font-size: 11px; padding: 3px 9px; border-radius: 8px; cursor: pointer; font-weight: 700; box-shadow: 0 2px 8px rgba(0,0,0,0.08); display: flex; align-items: center; gap: 3px;">✕ Delete</button>
        </div>
        <!-- Unified Shape Body (Full shape with uniform border, clean rounded corners and fill) -->
        <div class="glick-shape-body" style="padding: 16px 20px; background: ${fill}; border: ${bWidth} ${bStyle} ${border}; border-radius: ${bRadius}; min-height: 60px; color: inherit; font-size: 14px; line-height: 1.6; outline: none; position: relative;">
          <p id="${focusId}">${defaultText}</p>
        </div>
      </div>
      <p><br/></p>
    `;

    document.execCommand('insertHTML', false, shapeHtml);
    if (contentRef.current) {
      const target = contentRef.current.querySelector(`#${focusId}`);
      if (target) {
        target.removeAttribute('id');
        const range = document.createRange();
        range.selectNodeContents(target);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
        contentRef.current.focus();
        savedSelectionRef.current = saveSelection(contentRef.current);
      }
      const h = contentRef.current.innerHTML;
      latestContent.current = h;
      setBody(h);
      pushToHistory(h);
    }
    togglePopup(null);
    showToast('Shape box inserted into note!', 'success');
  };

  const handleApplyShapeStyle = (updates: {
    fill?: string;
    borderColor?: string;
    borderWidth?: string;
    borderStyle?: string;
    borderRadius?: string;
  }) => {
    if (!editingShapeEl) return;
    const body = (editingShapeEl.querySelector('.glick-shape-body') || editingShapeEl) as HTMLElement;
    const header = editingShapeEl.querySelector('.glick-shape-header') as HTMLElement;
    if (!body) return;

    if (updates.fill !== undefined) {
      body.style.backgroundColor = updates.fill;
    }
    if (updates.borderColor !== undefined) {
      body.style.borderColor = updates.borderColor;
      if (header) {
        header.style.borderColor = updates.borderColor;
      }
    }
    if (updates.borderWidth !== undefined) {
      body.style.borderWidth = updates.borderWidth;
    }
    if (updates.borderStyle !== undefined) {
      body.style.borderStyle = updates.borderStyle;
    }
    if (updates.borderRadius !== undefined) {
      body.style.borderRadius = updates.borderRadius;
      if (header) {
        header.style.borderRadius = `${updates.borderRadius} ${updates.borderRadius} 0 0`;
        body.style.borderRadius = `0 0 ${updates.borderRadius} ${updates.borderRadius}`;
      }
    }

    if (contentRef.current) {
      const html = contentRef.current.innerHTML;
      latestContent.current = html;
      setBody(html);
      pushToHistory(html);
    }
    showToast('Shape style updated!', 'success');
  };

  const handleExecuteSlashCommand = (cmdId: string) => {
    setSlashMenuOpen(false);
    
    // Cleanly remove the '/' and any typed query text from the editor
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const textNode = range.startContainer;
      if (textNode && textNode.nodeType === Node.TEXT_NODE && textNode.textContent) {
        const fullText = textNode.textContent;
        const slashIdx = fullText.lastIndexOf('/');
        if (slashIdx !== -1) {
          textNode.textContent = fullText.slice(0, slashIdx);
          const newRange = document.createRange();
          newRange.setStart(textNode, textNode.textContent.length);
          newRange.collapse(true);
          sel.removeAllRanges();
          sel.addRange(newRange);
        }
      } else {
        document.execCommand('delete', false);
      }
    }
    savedSelectionRef.current = saveSelection();

    switch (cmdId) {
      case 'ai':
        handleOpenAIDrawer();
        break;
      case 'todo':
        handleChecklist();
        break;
      case 'h1':
        handleHeading('h1');
        break;
      case 'h2':
        handleHeading('h2');
        break;
      case 'h3':
        handleHeading('h3');
        break;
      case 'callout-tip':
        handleInsertCallout('tip');
        break;
      case 'callout-warn':
        handleInsertCallout('warn');
        break;
      case 'callout-goal':
        handleInsertCallout('goal');
        break;
      case 'code':
        handleInsertCodeBlock();
        break;
      case 'toggle':
        handleInsertToggle();
        break;
      case 'table':
        handleGridClick(2, 2);
        break;
      case 'bullet':
        handleFormat('insertUnorderedList');
        break;
      case 'quote':
        toggleBlock('blockquote', 'blockquote');
        break;
      case 'image':
        document.getElementById('image-upload')?.click();
        break;
      case 'diagram':
        handleOpenMermaidModal();
        break;
      case 'math':
        handleOpenMathModal();
        break;
      case 'draw':
        handleOpenDrawingModal();
        break;
      case 'shape':
        togglePopup('shape');
        break;
      case 'divider':
        togglePopup('divider');
        break;
      case 'bookmark':
        togglePopup('link');
        break;
      case '2col':
        handleInsertColumns(2);
        break;
      case '3col':
        handleInsertColumns(3);
        break;
      case 'pagebreak':
        handleInsertPageBreak();
        break;
      default:
        break;
    }
  };

  const handleTable = () => {
    if (activeFormats.isInsideTable) {
      togglePopup('tableActions');
    } else {
      togglePopup('table');
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
    ensureSelectionInsideEditor(true);
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

    // Ensure a paragraph exists before removing table
    let targetP = (table.nextElementSibling || table.previousElementSibling) as HTMLElement;
    if (!targetP || (targetP.nodeName !== 'P' && targetP.nodeName !== 'DIV')) {
      targetP = document.createElement('p');
      targetP.innerHTML = '<br>';
      table.parentNode?.insertBefore(targetP, table.nextSibling);
    }

    table.remove();

    const sel = window.getSelection();
    if (sel && targetP) {
      const range = document.createRange();
      range.selectNodeContents(targetP);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    contentRef.current?.focus();

    if (contentRef.current) {
      const html = contentRef.current.innerHTML;
      latestContent.current = html;
      setBody(html);
      pushToHistory(html);
    }
    setActivePopup(null);
    showToast('Table deleted', 'info');
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

  const applyAutoLinks = () => {
    const editor = contentRef.current;
    if (!editor) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    
    // Save current cursor position safely
    const savedRange = selection.getRangeAt(0).cloneRange();
    const startContainer = savedRange.startContainer;
    const startOffset = savedRange.startOffset;
    
    // Text node walker
    const textNodes: Text[] = [];
    const walk = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        let parent = node.parentNode;
        let insideLink = false;
        while (parent && parent !== editor) {
          if (parent.nodeName === 'A') {
            insideLink = true;
            break;
          }
          parent = parent.parentNode;
        }
        if (!insideLink) {
          textNodes.push(node as Text);
        }
      } else {
        for (let i = 0; i < node.childNodes.length; i++) {
          walk(node.childNodes[i]);
        }
      }
    };
    
    walk(editor);
    
    let changed = false;
    const urlRegex = /\b(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9.-]+\.(?:com|org|net|io|co|in|edu|gov|xyz)(?:\/[^\s]*)?)\b/gi;
    
    for (const node of textNodes) {
      const text = node.data;
      urlRegex.lastIndex = 0;
      const match = urlRegex.exec(text);
      if (match) {
        const matchedUrl = match[0];
        const matchIndex = match.index;
        
        let formattedUrl = matchedUrl;
        if (!/^https?:\/\//i.test(formattedUrl)) {
          formattedUrl = 'https://' + formattedUrl;
        }
        
        const beforeText = text.substring(0, matchIndex);
        const afterText = text.substring(matchIndex + matchedUrl.length);
        
        const parent = node.parentNode;
        if (parent) {
          changed = true;
          
          const beforeNode = document.createTextNode(beforeText);
          const anchorNode = document.createElement('a');
          anchorNode.href = formattedUrl;
          anchorNode.target = '_blank';
          anchorNode.rel = 'noopener noreferrer';
          anchorNode.style.color = '#6366f1';
          anchorNode.style.textDecoration = 'underline';
          anchorNode.textContent = matchedUrl;
          
          const afterNode = document.createTextNode(afterText);
          
          parent.insertBefore(beforeNode, node);
          parent.insertBefore(anchorNode, node);
          parent.insertBefore(afterNode, node);
          parent.removeChild(node);
          
          // Re-position cursor accurately if it was inside the modified node
          if (startContainer === node) {
            if (startOffset <= matchIndex) {
              savedRange.setStart(beforeNode, startOffset);
              savedRange.setEnd(beforeNode, startOffset);
            } else if (startOffset > matchIndex + matchedUrl.length) {
              const newOffset = startOffset - (matchIndex + matchedUrl.length);
              savedRange.setStart(afterNode, newOffset);
              savedRange.setEnd(afterNode, newOffset);
            } else {
              savedRange.setStart(afterNode, 0);
              savedRange.setEnd(afterNode, 0);
            }
          }
        }
      }
    }
    
    if (changed) {
      selection.removeAllRanges();
      selection.addRange(savedRange);
      
      const html = editor.innerHTML;
      latestContent.current = html;
      setBody(html);
      pushToHistory(html);
    }
  };

  const handleContentClick = (e: React.MouseEvent<HTMLDivElement>) => {
    setSlashMenuOpen(false);
    const target = e.target as HTMLElement;

    // 1. Delete Block Button Click ([✕])
    const deleteBtn = target.closest('[data-action="delete-block"]') as HTMLElement;
    if (deleteBtn) {
      e.preventDefault();
      e.stopPropagation();
      const block = deleteBtn.closest('.glick-block-wrapper, .glick-callout, .glick-code-container, .glick-diagram-container, .glick-math-container, .glick-divider-block, details, table');
      if (block) {
        let targetP = (block.nextElementSibling || block.previousElementSibling) as HTMLElement;
        if (!targetP || (targetP.nodeName !== 'P' && targetP.nodeName !== 'DIV')) {
          targetP = document.createElement('p');
          targetP.innerHTML = '<br>';
          block.parentNode?.insertBefore(targetP, block.nextSibling);
        }
        block.remove();

        const sel = window.getSelection();
        if (sel) {
          const range = document.createRange();
          range.setStart(targetP, 0);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
        }
        contentRef.current?.focus();

        if (contentRef.current) {
          const html = contentRef.current.innerHTML;
          latestContent.current = html;
          setBody(html);
          pushToHistory(html);
        }
        showToast('Block deleted', 'info');
      }
      return;
    }

    // 2. Copy Code Snippet Click ([📋 Copy])
    const copyBtn = target.closest('[data-action="copy-code"]') as HTMLElement;
    if (copyBtn) {
      e.preventDefault();
      e.stopPropagation();
      const codeContainer = copyBtn.closest('.glick-code-container, .glick-block-wrapper');
      const codeElement = codeContainer?.querySelector('pre code') || codeContainer?.querySelector('pre');
      const textToCopy = codeElement?.textContent || '';
      if (textToCopy) {
        navigator.clipboard.writeText(textToCopy);
        const originalText = copyBtn.innerHTML;
        copyBtn.innerHTML = '✓ Copied!';
        setTimeout(() => {
          copyBtn.innerHTML = originalText;
        }, 2000);
        showToast('Code copied to clipboard!', 'success');
      }
      return;
    }

    // 3. Diagram actions: Copy & Edit
    const copyDiagramBtn = target.closest('[data-action="copy-diagram"]') as HTMLElement;
    if (copyDiagramBtn) {
      e.preventDefault();
      e.stopPropagation();
      const container = copyDiagramBtn.closest('.glick-diagram-container');
      const rawCode = container?.getAttribute('data-diagram-code');
      const textToCopy = rawCode ? decodeURIComponent(rawCode) : '';
      if (textToCopy) {
        navigator.clipboard.writeText(textToCopy);
        const originalText = copyDiagramBtn.innerHTML;
        copyDiagramBtn.innerHTML = '✓ Copied!';
        setTimeout(() => {
          copyDiagramBtn.innerHTML = originalText;
        }, 2000);
        showToast('Diagram code copied!', 'success');
      }
      return;
    }

    const editDiagramBtn = target.closest('[data-action="edit-diagram"]') as HTMLElement;
    if (editDiagramBtn) {
      e.preventDefault();
      e.stopPropagation();
      const container = editDiagramBtn.closest('.glick-diagram-container') as HTMLElement;
      if (container) {
        const rawCode = container.getAttribute('data-diagram-code');
        const code = rawCode ? decodeURIComponent(rawCode) : '';
        setEditingDiagramEl(container);
        setInitialDiagramCode(code);
        setShowMermaidModal(true);
      }
      return;
    }

    // 4. Math formula actions: Copy & Edit
    const copyLatexBtn = target.closest('[data-action="copy-latex"]') as HTMLElement;
    if (copyLatexBtn) {
      e.preventDefault();
      e.stopPropagation();
      const container = copyLatexBtn.closest('.glick-math-container');
      const rawLatex = container?.getAttribute('data-math-latex');
      const textToCopy = rawLatex ? decodeURIComponent(rawLatex) : '';
      if (textToCopy) {
        navigator.clipboard.writeText(textToCopy);
        const originalText = copyLatexBtn.innerHTML;
        copyLatexBtn.innerHTML = '✓ Copied!';
        setTimeout(() => {
          copyLatexBtn.innerHTML = originalText;
        }, 2000);
        showToast('LaTeX formula copied!', 'success');
      }
      return;
    }

    const editMathBtn = target.closest('[data-action="edit-math"]') as HTMLElement;
    if (editMathBtn) {
      e.preventDefault();
      e.stopPropagation();
      const container = editMathBtn.closest('.glick-math-container') as HTMLElement;
      if (container) {
        const rawLatex = container.getAttribute('data-math-latex');
        const latex = rawLatex ? decodeURIComponent(rawLatex) : '';
        setEditingMathEl(container);
        setInitialMathLatex(latex);
        setShowMathModal(true);
      }
      return;
    }

    // 4b. Drawing actions: Copy & Edit
    const copyDrawingBtn = target.closest('[data-action="copy-drawing"]') as HTMLElement;
    if (copyDrawingBtn) {
      e.preventDefault();
      e.stopPropagation();
      const container = copyDrawingBtn.closest('.glick-drawing-container') as HTMLElement;
      const src = container?.getAttribute('data-drawing-src') || container?.querySelector('img')?.src;
      if (src) {
        try {
          fetch(src)
            .then(res => res.blob())
            .then(blob => {
              if (window.ClipboardItem) {
                navigator.clipboard.write([
                  new ClipboardItem({ 'image/png': blob })
                ]).then(() => {
                  copyDrawingBtn.innerHTML = '✓ Copied!';
                  setTimeout(() => {
                    copyDrawingBtn.innerHTML = '📋 Copy';
                  }, 2000);
                  showToast('Drawing copied to clipboard!', 'success');
                });
              } else {
                navigator.clipboard.writeText(src);
                showToast('Drawing data URL copied!', 'success');
              }
            });
        } catch {
          navigator.clipboard.writeText(src);
          showToast('Drawing copied!', 'success');
        }
      }
      return;
    }

    const editDrawingBtn = target.closest('[data-action="edit-drawing"]') as HTMLElement;
    if (editDrawingBtn) {
      e.preventDefault();
      e.stopPropagation();
      const container = editDrawingBtn.closest('.glick-drawing-container') as HTMLElement;
      if (container) {
        const src = container.getAttribute('data-drawing-src') || container.querySelector('img')?.src;
        handleOpenDrawingModal(container, src || undefined);
      }
      return;
    }

    // 4c. Shape / Text box style editor
    const styleShapeBtn = target.closest('[data-action="style-shape"]') as HTMLElement;
    if (styleShapeBtn) {
      e.preventDefault();
      e.stopPropagation();
      const container = styleShapeBtn.closest('.glick-shape-container') as HTMLElement;
      if (container) {
        setEditingShapeEl(container);
        togglePopup('shape');
      }
      return;
    }

    // 5. Link click
    const anchor = target.closest('a');
    if (anchor) {
      e.preventDefault();
      window.open(anchor.href, '_blank', 'noopener,noreferrer');
    }
  };

  // 🪟 Windows-Style Universal Edge & Corner Detection Helper
  const getResizeInfo = (target: HTMLElement, clientX: number, clientY: number) => {
    // 1. Direct Corner Grip handle hover/click (.glick-corner-grip)
    const grip = target.closest('.glick-corner-grip') as HTMLElement;
    if (grip) {
      const container = grip.closest('.glick-image-resizable, .glick-code-container, .glick-callout, details.glick-toggle, table, .glick-shape-container') as HTMLElement;
      if (container) {
        return { type: 'corner', element: container };
      }
    }

    // 2. Table Cell Column or Row Border (Excel/Windows-style table resize)
    const cell = target.closest('th, td') as HTMLTableCellElement;
    if (cell && cell.parentElement?.closest('table')) {
      const rect = cell.getBoundingClientRect();
      const nearRight = (rect.right - clientX) <= 6 && (rect.right - clientX) >= -3;
      const nearBottom = (rect.bottom - clientY) <= 6 && (rect.bottom - clientY) >= -3;
      if (nearRight) return { type: 'col', element: cell };
      if (nearBottom) return { type: 'row', element: cell.parentElement as HTMLTableRowElement };
    }

    // 3. Block container edges & corners (Image, Code block, Callout, Toggle, Table, Shape)
    const block = target.closest('.glick-image-resizable, .glick-code-container, .glick-callout, details.glick-toggle, table, .glick-shape-container') as HTMLElement;
    if (block) {
      const rect = block.getBoundingClientRect();
      const nearRight = (rect.right - clientX) <= 8 && (rect.right - clientX) >= -3;
      const nearBottom = (rect.bottom - clientY) <= 8 && (rect.bottom - clientY) >= -3;

      if (nearRight && nearBottom) return { type: 'corner', element: block };
      if (nearRight) return { type: 'right', element: block };
      if (nearBottom) return { type: 'bottom', element: block };
    }

    return null;
  };

  // 🪟 Windows-Style Edge and Corner Drag Resizing
  const handleEditorMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const info = getResizeInfo(target, e.clientX, e.clientY);
    if (!info) return;

    e.preventDefault();
    e.stopPropagation();

    const el = info.element;
    const startX = e.clientX;
    const startY = e.clientY;
    const rect = el.getBoundingClientRect();
    const startWidth = rect.width;
    const startHeight = rect.height;
    const maxAllowedWidth = contentRef.current?.clientWidth || 850;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      if (info.type === 'col') {
        const newWidth = Math.max(40, startWidth + deltaX);
        el.style.width = `${Math.round(newWidth)}px`;
        el.style.minWidth = `${Math.round(newWidth)}px`;
      } else if (info.type === 'row') {
        const newHeight = Math.max(26, startHeight + deltaY);
        el.style.height = `${Math.round(newHeight)}px`;
      } else if (info.type === 'right') {
        const newWidth = Math.max(100, Math.min(maxAllowedWidth, startWidth + deltaX));
        el.style.width = `${Math.round(newWidth)}px`;
      } else if (info.type === 'bottom') {
        const newHeight = Math.max(45, startHeight + deltaY);
        el.style.height = `${Math.round(newHeight)}px`;
      } else if (info.type === 'corner') {
        const newWidth = Math.max(100, Math.min(maxAllowedWidth, startWidth + deltaX));
        const newHeight = Math.max(45, startHeight + deltaY);
        el.style.width = `${Math.round(newWidth)}px`;
        if (!el.classList.contains('glick-image-resizable')) {
          el.style.height = `${Math.round(newHeight)}px`;
        }
      }
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      if (contentRef.current) {
        const html = contentRef.current.innerHTML;
        latestContent.current = html;
        setBody(html);
        pushToHistory(html);
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleEditorMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const info = getResizeInfo(target, e.clientX, e.clientY);
    if (!info) {
      target.style.cursor = '';
      return;
    }

    if (info.type === 'col' || info.type === 'right') {
      target.style.cursor = 'col-resize';
    } else if (info.type === 'row' || info.type === 'bottom') {
      target.style.cursor = 'row-resize';
    } else if (info.type === 'corner') {
      target.style.cursor = 'nwse-resize';
    }
  };

  const handleToolbarTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

    // Save selection immediately on touch start before any blur occurs if inside editor
    const validRange = saveSelection(contentRef.current);
    if (validRange) {
      savedSelectionRef.current = validRange;
    }
  };

  // Main KeyDown events + Shortcuts interceptor
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === ' ' || e.key === 'Enter') {
      setTimeout(() => {
        applyAutoLinks();
      }, 50);
    }
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

    // Slash Command Trigger
    if (e.key === '/') {
      const sel = window.getSelection();
      let shouldOpenSlash = true;
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const textBefore = range.startContainer.textContent?.slice(0, range.startOffset) || '';
        // If typed in the middle of a word or url (e.g. "https:/" or "abc/"), do not open slash menu
        if (textBefore.length > 0 && !/\s$/.test(textBefore)) {
          shouldOpenSlash = false;
        }
      }
      if (shouldOpenSlash) {
        setTimeout(() => {
          const sel2 = window.getSelection();
          if (sel2 && sel2.rangeCount > 0) {
            const range = sel2.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            setSlashMenuPos({ top: rect.bottom + 6, left: rect.left });
            setSlashMenuOpen(true);
            setSlashQuery('');
          }
        }, 10);
      }
    } else if (slashMenuOpen) {
      if (e.key === 'Escape' || e.key === ' ') {
        setSlashMenuOpen(false);
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Enter') {
        setSlashQuery(prev => prev + e.key);
      } else if (e.key === 'Backspace') {
        setSlashQuery(prev => {
          if (prev.length <= 1) {
            setSlashMenuOpen(false);
            return '';
          }
          return prev.slice(0, -1);
        });
      }
    }

    if (e.key === 'Escape') {
      setActivePopup(null);
      setShowFindReplace(false);
      setSlashMenuOpen(false);
      if (zenMode) setZenMode(false);
    }

    // Helper to test if selection range is at the very beginning of a block
    const isAtStartOfBlock = (container: HTMLElement, currentRange: Range): boolean => {
      if (currentRange.startOffset !== 0) return false;
      let curr: Node | null = currentRange.startContainer;
      while (curr && curr !== container) {
        let prev = curr.previousSibling;
        while (prev) {
          if (prev.textContent && prev.textContent.trim().length > 0) return false;
          prev = prev.previousSibling;
        }
        curr = curr.parentNode;
      }
      return true;
    };

    // Helper to test if selection range is at the very end of a block
    const isAtEndOfBlock = (container: HTMLElement, currentRange: Range): boolean => {
      const currentText = currentRange.startContainer.textContent || '';
      if (currentRange.startOffset < currentText.length) return false;
      let curr: Node | null = currentRange.startContainer;
      while (curr && curr !== container) {
        let next = curr.nextSibling;
        while (next) {
          if (next.textContent && next.textContent.trim().length > 0) return false;
          next = next.nextSibling;
        }
        curr = curr.parentNode;
      }
      return true;
    };

    // ⬆️ Smooth ArrowUp Navigation (Exit block to previous line if at top)
    if (e.key === 'ArrowUp') {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && sel.isCollapsed) {
        const range = sel.getRangeAt(0);
        const blockContainer = findBlockContainer(range.startContainer);
        if (blockContainer && isAtStartOfBlock(blockContainer, range)) {
          let prevP = blockContainer.previousElementSibling as HTMLElement;
          if (!prevP || (prevP.nodeName !== 'P' && prevP.nodeName !== 'DIV')) {
            prevP = document.createElement('p');
            prevP.innerHTML = '<br>';
            blockContainer.parentNode?.insertBefore(prevP, blockContainer);
          }
          e.preventDefault();
          const newRange = document.createRange();
          newRange.selectNodeContents(prevP);
          newRange.collapse(false);
          sel.removeAllRanges();
          sel.addRange(newRange);
          contentRef.current?.focus();
          return;
        }
      }
    }

    // ⬇️ Smooth ArrowDown Navigation (Exit block to next line if at bottom)
    if (e.key === 'ArrowDown') {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && sel.isCollapsed) {
        const range = sel.getRangeAt(0);
        const blockContainer = findBlockContainer(range.startContainer);
        if (blockContainer && isAtEndOfBlock(blockContainer, range)) {
          let nextP = blockContainer.nextElementSibling as HTMLElement;
          if (!nextP || (nextP.nodeName !== 'P' && nextP.nodeName !== 'DIV')) {
            nextP = document.createElement('p');
            nextP.innerHTML = '<br>';
            blockContainer.parentNode?.insertBefore(nextP, blockContainer.nextSibling);
          }
          e.preventDefault();
          const newRange = document.createRange();
          newRange.setStart(nextP, 0);
          newRange.collapse(true);
          sel.removeAllRanges();
          sel.addRange(newRange);
          contentRef.current?.focus();
          return;
        }
      }
    }

    // ⌫ Smart Backspace Block Handling (Non-destructive: never deletes blocks with text/placeholders)
    if (e.key === 'Backspace') {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && sel.isCollapsed) {
        const range = sel.getRangeAt(0);
        const startEl = range.startContainer.nodeType === Node.ELEMENT_NODE
          ? (range.startContainer as HTMLElement)
          : range.startContainer.parentElement;

        // 1. Inside columns, tables, or special embedded widgets: NEVER delete container on backspace!
        if (
          startEl?.closest('.glick-column') || 
          startEl?.closest('.glick-columns-container') ||
          startEl?.closest('table, .glick-diagram-container, .glick-math-container, .glick-drawing-container')
        ) {
          return; // Let native browser backspace edit the text safely!
        }

        const blockContainer = findBlockContainer(range.startContainer);
        if (blockContainer && blockContainer.nodeName !== 'TABLE' && !blockContainer.classList?.contains('glick-columns-container')) {
          // Identify the actual text-editing target inside the block container
          const editableTarget = 
            blockContainer.querySelector('code, pre.glick-code-block') || 
            blockContainer.querySelector('.glick-callout p') ||
            blockContainer.querySelector('details > div') ||
            blockContainer;

          const editableText = (editableTarget?.textContent || '').replace(/\u200B/g, '').trim();

          // ONLY delete the block container if the editable area has ALREADY been completely cleared to 0 characters
          // AND the cursor is positioned at the start of the empty block.
          // NEVER delete the block if there is still placeholder or user text being erased!
          if (editableText === '' && isAtStartOfBlock(blockContainer, range)) {
            e.preventDefault();
            let targetP = (blockContainer.previousElementSibling || blockContainer.nextElementSibling) as HTMLElement;
            if (!targetP || (targetP.nodeName !== 'P' && targetP.nodeName !== 'DIV')) {
              targetP = document.createElement('p');
              targetP.innerHTML = '<br>';
              blockContainer.parentNode?.insertBefore(targetP, blockContainer);
            }
            blockContainer.remove();

            const newRange = document.createRange();
            newRange.selectNodeContents(targetP);
            newRange.collapse(false);
            sel.removeAllRanges();
            sel.addRange(newRange);
            contentRef.current?.focus();

            if (contentRef.current) {
              const html = contentRef.current.innerHTML;
              latestContent.current = html;
              setBody(html);
              pushToHistory(html);
            }
            showToast('Block removed', 'info');
            return;
          }
        }
      }
    }

    // Smart Enter & Block Breakout Handling
    if (e.key === 'Enter') {
      // If slash command menu is active, SlashCommandMenu handles Enter
      if (slashMenuOpen) {
        return;
      }

      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      
      let node: Node | null = selection.anchorNode;
      let preElement: HTMLElement | null = null;
      let calloutElement: HTMLElement | null = null;
      let toggleElement: HTMLElement | null = null;
      
      while (node && node !== contentRef.current) {
        if (node.nodeName === 'PRE') preElement = node as HTMLElement;
        if ((node as HTMLElement).classList?.contains('glick-callout')) calloutElement = node as HTMLElement;
        if ((node as HTMLElement).classList?.contains('glick-toggle') || node.nodeName === 'DETAILS') toggleElement = node as HTMLElement;
        node = node.parentNode;
      }

      // Case 1: Inside Code Block (<pre>)
      if (preElement) {
        const container = (preElement.closest('.glick-block-wrapper') as HTMLElement) || preElement;
        const range = selection.getRangeAt(0);
        const atEnd = isAtEndOfBlock(container, range);

        let prevSibling = range.startContainer.nodeType === Node.TEXT_NODE 
          ? range.startContainer.previousSibling 
          : (range.startContainer as HTMLElement).childNodes[range.startOffset - 1];

        const isTrailingEmpty = atEnd && (
          (prevSibling && prevSibling.nodeName === 'BR') ||
          (preElement.textContent || '').trim() === '' ||
          (preElement.textContent || '').includes('// Enter code snippet here...')
        );

        // Shift+Enter OR Enter on empty line at bottom: Break out of code block into new paragraph outside
        if (e.shiftKey || isTrailingEmpty) {
          e.preventDefault();
          if (prevSibling && prevSibling.nodeName === 'BR') {
            prevSibling.remove();
          }
          let nextP = container.nextElementSibling as HTMLElement;
          if (!nextP || (nextP.nodeName !== 'P' && nextP.nodeName !== 'DIV')) {
            nextP = document.createElement('p');
            nextP.innerHTML = '<br>';
            container.parentNode?.insertBefore(nextP, container.nextSibling);
          }
          const newRange = document.createRange();
          newRange.setStart(nextP, 0);
          newRange.collapse(true);
          selection.removeAllRanges();
          selection.addRange(newRange);
          contentRef.current?.focus();
          if (contentRef.current) {
            const html = contentRef.current.innerHTML;
            latestContent.current = html;
            setBody(html);
            pushToHistory(html);
          }
          return;
        }

        // Normal Enter: Single Enter immediately creates next line of code on 1 press!
        e.preventDefault();
        range.deleteContents();

        // Clear initial placeholder if untouched
        const codeElement = preElement.querySelector('code') || preElement;
        if (codeElement.textContent === '// Enter code snippet here...') {
          codeElement.textContent = '';
        }

        // Insert primary line break
        const br = document.createElement('br');
        range.insertNode(br);

        // Crucial fix: In HTML contentEditable, a solitary trailing <br> has zero visual height.
        // We ensure a trailing companion <br> exists so the new line has immediate height on the FIRST Enter!
        if (!br.nextSibling) {
          const companionBr = document.createElement('br');
          br.parentNode?.appendChild(companionBr);
        }

        const newRange = document.createRange();
        newRange.setStartAfter(br);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);

        if (contentRef.current) {
          const html = contentRef.current.innerHTML;
          latestContent.current = html;
          setBody(html);
          pushToHistory(html);
        }
        return;
      }

      // Case 2: Inside Callout Box (.glick-callout)
      if (calloutElement) {
        const container = (calloutElement.closest('.glick-block-wrapper') as HTMLElement) || calloutElement;
        const range = selection.getRangeAt(0);
        const atEnd = isAtEndOfBlock(container, range);

        let prevSibling = range.startContainer.nodeType === Node.TEXT_NODE 
          ? range.startContainer.previousSibling 
          : (range.startContainer as HTMLElement).childNodes[range.startOffset - 1];

        const isTrailingEmpty = atEnd && (
          (prevSibling && prevSibling.nodeName === 'BR') ||
          (calloutElement.textContent || '').trim() === '' ||
          (calloutElement.textContent || '').includes('details here...')
        );

        // Shift+Enter OR Enter on empty line at bottom: Break out of callout into new paragraph outside
        if (e.shiftKey || isTrailingEmpty) {
          e.preventDefault();
          if (prevSibling && prevSibling.nodeName === 'BR') {
            prevSibling.remove();
          }
          let nextP = container.nextElementSibling as HTMLElement;
          if (!nextP || (nextP.nodeName !== 'P' && nextP.nodeName !== 'DIV')) {
            nextP = document.createElement('p');
            nextP.innerHTML = '<br>';
            container.parentNode?.insertBefore(nextP, container.nextSibling);
          }
          const newRange = document.createRange();
          newRange.setStart(nextP, 0);
          newRange.collapse(true);
          selection.removeAllRanges();
          selection.addRange(newRange);
          contentRef.current?.focus();
          if (contentRef.current) {
            const html = contentRef.current.innerHTML;
            latestContent.current = html;
            setBody(html);
            pushToHistory(html);
          }
          return;
        }

        // Normal Enter: Single Enter creates a new line inside the callout on 1 press!
        e.preventDefault();
        range.deleteContents();

        // Clear placeholder if present
        const pElement = calloutElement.querySelector('p');
        if (pElement && pElement.textContent?.includes('details here...')) {
          pElement.textContent = '';
        }

        const br = document.createElement('br');
        range.insertNode(br);

        // Ensure trailing companion <br> for immediate visual line height
        if (!br.nextSibling) {
          const companionBr = document.createElement('br');
          br.parentNode?.appendChild(companionBr);
        }

        const newRange = document.createRange();
        newRange.setStartAfter(br);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);

        if (contentRef.current) {
          const html = contentRef.current.innerHTML;
          latestContent.current = html;
          setBody(html);
          pushToHistory(html);
        }
        return;
      }

      // Case 3: Inside Toggle Section (<details>)
      if (toggleElement) {
        const container = (toggleElement.closest('.glick-block-wrapper') as HTMLElement) || toggleElement;

        // Inside summary vs inside body
        const summary = toggleElement.querySelector('summary');
        if (summary && summary.contains(selection.anchorNode)) {
          // If in summary, normal Enter expands the toggle and focuses content
          e.preventDefault();
          (toggleElement as HTMLDetailsElement).open = true;
          const bodyDiv = toggleElement.querySelector('div');
          if (bodyDiv) {
            const newRange = document.createRange();
            newRange.selectNodeContents(bodyDiv);
            newRange.collapse(false);
            selection.removeAllRanges();
            selection.addRange(newRange);
          }
          return;
        }

        const range = selection.getRangeAt(0);
        const atEnd = isAtEndOfBlock(container, range);

        let prevSibling = range.startContainer.nodeType === Node.TEXT_NODE 
          ? range.startContainer.previousSibling 
          : (range.startContainer as HTMLElement).childNodes[range.startOffset - 1];

        const isTrailingEmpty = atEnd && (
          (prevSibling && prevSibling.nodeName === 'BR') ||
          (toggleElement.textContent || '').trim() === '' ||
          (toggleElement.textContent || '').includes('Hidden notes, checklist')
        );

        if (e.shiftKey || isTrailingEmpty) {
          e.preventDefault();
          if (prevSibling && prevSibling.nodeName === 'BR') {
            prevSibling.remove();
          }
          let nextP = container.nextElementSibling as HTMLElement;
          if (!nextP || (nextP.nodeName !== 'P' && nextP.nodeName !== 'DIV')) {
            nextP = document.createElement('p');
            nextP.innerHTML = '<br>';
            container.parentNode?.insertBefore(nextP, container.nextSibling);
          }
          const newRange = document.createRange();
          newRange.setStart(nextP, 0);
          newRange.collapse(true);
          selection.removeAllRanges();
          selection.addRange(newRange);
          contentRef.current?.focus();
          if (contentRef.current) {
            const html = contentRef.current.innerHTML;
            latestContent.current = html;
            setBody(html);
            pushToHistory(html);
          }
          return;
        }

        // Normal Enter inside toggle body -> single Enter creates new line
        e.preventDefault();
        range.deleteContents();
        const br = document.createElement('br');
        range.insertNode(br);
        if (!br.nextSibling) {
          const companionBr = document.createElement('br');
          br.parentNode?.appendChild(companionBr);
        }
        const newRange = document.createRange();
        newRange.setStartAfter(br);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
        if (contentRef.current) {
          const html = contentRef.current.innerHTML;
          latestContent.current = html;
          setBody(html);
          pushToHistory(html);
        }
        return;
      }

      // Normal Enter: DO NOT PREVENT DEFAULT! Browser creates natural clean new paragraph/line!
    }

    // ⌨️ Tab and Shift+Tab indentation (Microsoft Word style)
    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        handleOutdent();
      } else {
        handleIndent();
      }
      return;
    }

    // 📄 Ctrl+Enter / Cmd+Enter for Page Break
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleInsertPageBreak();
      return;
    }

    // 🖨️ Ctrl+P / Cmd+P for Print Layout
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
      e.preventDefault();
      handlePrint();
      return;
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
    if (!user) return;

    let finalTitle = title.trim();
    const currentBody = contentRef.current ? contentRef.current.innerHTML : latestContent.current;

    // 🧠 Smart Auto-Title: if title is blank, extract from first line of body
    if (!finalTitle) {
      const cleanBody = extractTextFromHtml(currentBody);
      const firstLine = cleanBody.split('\n').map(l => l.trim()).filter(Boolean)[0];
      if (firstLine) {
        finalTitle = firstLine.length > 50 ? firstLine.slice(0, 50).trim() + '...' : firstLine;
      } else {
        finalTitle = 'Untitled Note';
      }
    }

    // 🔍 Duplicate Title Check: avoid identical names
    try {
      const qNotes = query(collection(db, 'notes'), where('userId', '==', user.uid));
      const snap = await getDocs(qNotes);
      const existingTitles = snap.docs
        .filter(d => d.id !== (currentNoteId || ''))
        .map(d => (d.data().title || '').trim().toLowerCase());

      if (existingTitles.includes(finalTitle.toLowerCase())) {
        let count = 2;
        let candidate = `${finalTitle} (${count})`;
        while (existingTitles.includes(candidate.toLowerCase())) {
          count++;
          candidate = `${finalTitle} (${count})`;
        }
        finalTitle = candidate;
      }
    } catch (err) {
      console.warn('Duplicate check warning:', err);
    }

    if (finalTitle !== title) {
      setTitle(finalTitle);
    }
    
    setSaving(true);
    const noteId = currentNoteId || doc(collection(db, 'notes')).id;
    const isNewNote = !currentNoteId;
    
    const noteData = {
      userId: user.uid,
      title: finalTitle,
      body: currentBody,
      tags: tags.split(',').map(t => t.trim()).filter(t => t),
      color,
      folder: folder || 'all',
      pinned: note?.pinned || false,
      updatedAt: serverTimestamp(),
      ...(isNewNote ? { createdAt: serverTimestamp() } : {})
    };

    try {
      await setDoc(doc(db, 'notes', noteId), noteData, { merge: true });
      const now = new Date();
      setLastSaved(now);
      setLastSavedSnapshot({ title: finalTitle, body: currentBody, tags, folder, color });
      
      if (onSave) {
        onSave({
          id: noteId,
          userId: user.uid,
          title: finalTitle,
          body: currentBody,
          tags: tags.split(',').map(t => t.trim()).filter(t => t),
          color,
          folder: folder || 'all',
          pinned: note?.pinned || false,
          createdAt: note?.createdAt || Timestamp.fromDate(now),
          updatedAt: Timestamp.fromDate(now)
        });
      }

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
  }, [currentNoteId, title, tags, folder, color, user, showToast, onSave, note]);

  // Unsaved Changes check
  const hasUnsavedChanges = useMemo(() => {
    const currentBody = contentRef.current ? contentRef.current.innerHTML : latestContent.current;
    return (
      title !== lastSavedSnapshot.title ||
      currentBody !== lastSavedSnapshot.body ||
      tags !== lastSavedSnapshot.tags ||
      folder !== lastSavedSnapshot.folder ||
      color !== lastSavedSnapshot.color
    );
  }, [title, body, tags, folder, color, lastSavedSnapshot]);

  // Auto-save debounced effect
  useEffect(() => {
    const currentBodyText = contentRef.current ? contentRef.current.innerText : latestContent.current;
    const isEmptyNote = !title.trim() && !currentBodyText.trim();
    if (isEmptyNote || !hasUnsavedChanges) return;

    const timer = setTimeout(() => {
      handleSave();
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [handleSave, title, body, hasUnsavedChanges]);

  // Delete flow
  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  // Safe back navigation with instant auto-save if unsaved changes exist
  const handleBackClick = useCallback(async () => {
    if (hasUnsavedChanges) {
      await handleSave();
    }
    onBack();
  }, [hasUnsavedChanges, handleSave, onBack]);

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
        const cleanBody = extractTextFromHtml(contentRef.current ? contentRef.current.innerHTML : latestContent.current);
        const firstLine = cleanBody.split('\n').map(l => l.trim()).filter(Boolean)[0];
        finalTitle = firstLine ? (firstLine.length > 50 ? firstLine.slice(0, 50).trim() + '...' : firstLine) : 'Untitled Note';
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
        setLastSavedSnapshot({ title: finalTitle, body: noteData.body, tags, folder, color });
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

  // Insert base64 image block directly into the content editable editor body
  const insertImageBase64 = (base64: string, altName: string = 'Photo') => {
    ensureSelectionInsideEditor(true);
    const nextLineId = `img-next-${Date.now()}`;
    const html = `<div class="glick-block-wrapper glick-image-container" style="position: relative; margin: 16px 0; text-align: center; user-select: none;" contenteditable="false"><div class="glick-image-resizable" style="position: relative; display: inline-block; max-width: 100%;"><img src="${base64}" alt="${altName}" style="max-width: 100%; max-height: 520px; border-radius: 14px; object-fit: contain; box-shadow: 0 4px 16px rgba(15,23,42,0.12); display: block;" /><button type="button" data-action="delete-block" title="Remove Photo" style="position: absolute; top: 10px; right: 10px; background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(4px); border: 1px solid rgba(255,255,255,0.25); color: white; border-radius: 8px; padding: 4px 10px; font-size: 11px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 4px; z-index: 10;">✕ Remove</button></div></div><p id="${nextLineId}"><br/></p>`;

    ensureSelectionInsideEditor(true);
    document.execCommand('insertHTML', false, html);

    if (contentRef.current) {
      const nextP = contentRef.current.querySelector(`#${nextLineId}`);
      if (nextP) {
        nextP.removeAttribute('id');
        const range = document.createRange();
        range.setStart(nextP, 0);
        range.collapse(true);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
        contentRef.current.focus();
        savedSelectionRef.current = range.cloneRange();
      }
      const h = contentRef.current.innerHTML;
      latestContent.current = h;
      setBody(h);
      pushToHistory(h);
    }
    showToast('Photo inserted into note!', 'success');
  };

  const handleInsertImageFile = (file: File) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showToast(`Image ${file.name} is too large (max 2MB)`, 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      if (base64) {
        insertImageBase64(base64, file.name);
      }
      // Also save in note attachments subcollection for safe backup & downloading
      handleFiles([file]);
    };
    reader.readAsDataURL(file);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      Array.from(e.target.files).forEach(file => {
        if (file.type.startsWith('image/')) {
          handleInsertImageFile(file);
        } else {
          handleFiles([file]);
        }
      });
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
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      const imageFiles = files.filter(f => f.type.startsWith('image/'));
      const otherFiles = files.filter(f => !f.type.startsWith('image/'));

      if (imageFiles.length > 0) {
        imageFiles.forEach(f => handleInsertImageFile(f));
      }
      if (otherFiles.length > 0) {
        handleFiles(otherFiles);
      }
    }
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
  const updateMatchCount = useCallback(() => {
    if (!findText || !contentRef.current) {
      setMatchCount(0);
      return;
    }
    const text = contentRef.current.textContent || '';
    const regex = new RegExp(findText.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');
    const matches = text.match(regex);
    setMatchCount(matches ? matches.length : 0);
  }, [findText]);

  useEffect(() => {
    updateMatchCount();
  }, [findText, body, updateMatchCount]);

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
      className="note-editor-root h-screen overflow-hidden bg-[#f2f4f7] dark:bg-[#0b0f19] flex flex-col relative text-slate-800 dark:text-slate-200 font-sans"
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
                  {viewingAttachment.type.startsWith('image/') && (
                    <button 
                      onClick={() => {
                        insertImageBase64(viewingAttachment.data, viewingAttachment.name);
                        setViewingAttachment(null);
                      }}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                      title="Insert photo directly into note body"
                    >
                      <Plus className="w-4 h-4" /> Insert into Note
                    </button>
                  )}
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

      {/* 2-Row Adaptive Toolbar (Hidden in Zen Mode & Print) */}
      {!zenMode && (
        <div ref={popupRef} onTouchStart={handleToolbarTouchStart} className="note-editor-toolbar sticky top-0 z-35 flex flex-col border-b border-slate-200/70 dark:border-slate-800 bg-[#f8f9fb]/95 dark:bg-[#0c1220]/95 backdrop-blur-md relative no-print">
                {/* ROW 1: Navigation and status controls */}
        <div className="flex items-center justify-between px-2.5 sm:px-3 md:px-4 py-2 border-b border-slate-200/60 dark:border-slate-800/60 gap-1.5 sm:gap-2 overflow-hidden">
          <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 shrink-0">
            <button onClick={handleBackClick} className="p-1.5 md:p-2 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer text-slate-500 dark:text-slate-400 shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </button>
            
            {/* Auto-save status bubble */}
            <div className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 bg-slate-100/70 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/50 rounded-full select-none text-[9px] md:text-[10px] font-bold tracking-wider uppercase shrink-0">
              {saving ? (
                <span className="flex items-center gap-1 text-indigo-500">
                  <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-ping" /> Saving
                </span>
              ) : hasUnsavedChanges ? (
                <span className="flex items-center gap-1 text-amber-500">
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" /> Unsaved
                </span>
              ) : lastSaved ? (
                <span className="flex items-center gap-1 text-emerald-500">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> Synced
                </span>
              ) : (
                <span className="flex items-center gap-1 text-slate-400">
                  Draft
                </span>
              )}
            </div>

            {/* Notebook / Folder Selector Pill */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-slate-100/70 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-full shrink-0">
              <Folder className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <select
                value={folder}
                onChange={(e) => setFolder(e.target.value)}
                className="bg-transparent text-[10px] md:text-xs font-bold text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
              >
                <option value="all" className="bg-white dark:bg-slate-900">📁 All Notes</option>
                <option value="work" className="bg-white dark:bg-slate-900">💼 Work & Projects</option>
                <option value="personal" className="bg-white dark:bg-slate-900">💚 Personal & Life</option>
                <option value="ideas" className="bg-white dark:bg-slate-900">💡 Ideas & Brainstorm</option>
                <option value="archive" className="bg-white dark:bg-slate-900">📦 Archive</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2 shrink-0 py-0.5">
            {/* Custom font family picker (Desktop/Tablet) */}
            <div className="relative shrink-0 hidden sm:block" ref={fontMenuRef}>
              <button
                type="button"
                onClick={() => setShowFontMenu(prev => !prev)}
                className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 rounded-xl px-2 py-1.5 text-xs font-semibold outline-none hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer transition-all duration-150 flex items-center gap-1.5 justify-between min-w-[85px] md:min-w-[120px]"
              >
                <span className="truncate max-w-[65px] md:max-w-[100px]">{FONT_OPTIONS.find(f => f.value === activeFont)?.label || 'Outfit Sans'}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </button>
              <AnimatePresence>
                {showFontMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 5, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 5, scale: 0.95 }}
                    className="absolute right-0 mt-1.5 w-44 max-h-[300px] overflow-y-auto z-50 bg-[#fafbfc] dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-1.5 shadow-2xl space-y-0.5"
                  >
                    {FONT_OPTIONS.map(item => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => {
                          setActiveFont(item.value);
                          setShowFontMenu(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 rounded-lg transition-all cursor-pointer flex flex-col justify-start ${activeFont === item.value ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'}`}
                      >
                        <span className="text-xs font-bold">{item.label}</span>
                        <span className={`text-[9px] ${activeFont === item.value ? 'text-indigo-200' : 'text-slate-400 dark:text-slate-500'}`}>{item.desc}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* AI Assistant Button */}
            <button
              type="button"
              onMouseDown={() => {
                const sel = saveSelection(contentRef.current);
                if (sel) savedSelectionRef.current = sel;
              }}
              onClick={handleOpenAIDrawer}
              className="px-2 md:px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white text-xs font-bold transition-all shadow-sm hover:shadow-indigo-500/20 flex items-center gap-1.5 cursor-pointer shrink-0"
              title="Open AI Assistant (Summarize, Polish, Title & Tags, Chat)"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">AI Assistant</span>
            </button>

            {/* Voice Dictation (Speech-to-Text) */}
            <button
              type="button"
              onClick={toggleVoiceDictation}
              className={`p-1.5 md:p-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                showVoiceModal 
                  ? 'bg-rose-600 border-rose-500 text-white shadow-md animate-pulse' 
                  : 'bg-slate-100 dark:bg-slate-900 border-slate-250 dark:border-slate-800 text-slate-600 dark:text-slate-350 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
              title="Voice Dictation (Speech-to-Text Modal)"
            >
              <Mic className="w-4 h-4" />
            </button>

            {/* Audio Reader (Text-to-Speech) */}
            <button
              type="button"
              onClick={toggleAudioReader}
              className={`p-1.5 md:p-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                isPlayingAudio 
                  ? 'bg-indigo-600 border-indigo-500 text-white shadow-md' 
                  : 'bg-slate-100 dark:bg-slate-900 border-slate-250 dark:border-slate-800 text-slate-600 dark:text-slate-350 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
              title={isPlayingAudio ? "Stop Reading Note" : "Listen Note (Text-to-Speech)"}
            >
              {isPlayingAudio ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {/* Export & Share */}
            <button
              type="button"
              onClick={() => setShowExportModal(true)}
              className="p-1.5 md:p-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-250 dark:border-slate-800 text-slate-600 dark:text-slate-350 hover:bg-slate-200 dark:hover:bg-slate-800 transition-all cursor-pointer shrink-0"
              title="Export to PDF, Markdown, Text or Share Card"
            >
              <Share2 className="w-4 h-4" />
            </button>

            {/* Zen Mode Toggle */}
            <button
              type="button"
              onClick={() => setZenMode(prev => !prev)}
              className={`p-1.5 md:p-2 rounded-xl border transition-all cursor-pointer shrink-0 ${
                zenMode 
                  ? 'bg-indigo-600 border-indigo-500 text-white shadow-md' 
                  : 'bg-slate-100 dark:bg-slate-900 border-slate-250 dark:border-slate-800 text-slate-600 dark:text-slate-350 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
              title={zenMode ? "Exit Zen Mode (Esc)" : "Distraction-Free Zen Mode"}
            >
              {zenMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Distraction-free Focus Toggle (Desktop/Tablet sidebar toggler) */}
            <button
              type="button"
              onClick={() => setFocusMode(prev => !prev)}
              className={`hidden md:inline-flex px-2.5 md:px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer shrink-0 ${focusMode ? 'bg-indigo-600 border-indigo-500 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-900 border-slate-250 dark:border-slate-800 text-slate-600 dark:text-slate-350 hover:bg-slate-200 dark:hover:bg-slate-800'}`}
              title={focusMode ? "Exit Focus Mode" : "Enter Focus Mode"}
            >
              {focusMode ? "Focused" : "Focus"}
            </button>

            {currentNoteId && (
              <button onClick={handleDeleteClick} className="p-1.5 md:p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-all cursor-pointer shrink-0" title="Delete Note">
                <Trash2 className="w-4.5 h-4.5 md:w-5 md:h-5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex md:flex-wrap items-center gap-1.5 p-2 bg-[#f4f6fa]/60 dark:bg-slate-900/50 overflow-x-auto no-scrollbar scroll-smooth">
          
          {/* Undo and Redo buttons */}
          <button 
            type="button" 
            onMouseDown={handleButtonMouseDown} 
            onClick={handleUndo} 
            className="p-2 w-9 h-9 flex items-center justify-center rounded-xl shrink-0 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-all cursor-pointer" 
            title="Undo (Ctrl+Z)"
          >
            <Undo className="w-4.5 h-4.5" />
          </button>

          <button 
            type="button" 
            onMouseDown={handleButtonMouseDown} 
            onClick={handleRedo} 
            className="p-2 w-9 h-9 flex items-center justify-center rounded-xl shrink-0 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-all cursor-pointer" 
            title="Redo (Ctrl+Y / Ctrl+Shift+Z)"
          >
            <Redo className="w-4.5 h-4.5" />
          </button>

          {/* Mobile Font Family Picker */}
          <div className="relative shrink-0 sm:hidden">
            <button
              type="button"
              onClick={() => setShowFontMenu(prev => !prev)}
              className="bg-slate-200/70 dark:bg-slate-800 border border-slate-300/40 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl px-2 py-1.5 text-xs font-bold outline-none flex items-center gap-1 shrink-0"
              title="Change Font Family"
            >
              <span className="truncate max-w-[65px]">{FONT_OPTIONS.find(f => f.value === activeFont)?.label || 'Outfit'}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>
            <AnimatePresence>
              {showFontMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 5, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 5, scale: 0.95 }}
                  className="absolute left-0 top-full mt-1.5 w-44 max-h-[250px] overflow-y-auto z-50 bg-[#fafbfc] dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-1.5 shadow-2xl space-y-0.5"
                >
                  {FONT_OPTIONS.map(item => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => {
                        setActiveFont(item.value);
                        setShowFontMenu(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 rounded-lg transition-all cursor-pointer flex flex-col justify-start ${activeFont === item.value ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'}`}
                    >
                      <span className="text-xs font-bold">{item.label}</span>
                      <span className={`text-[9px] ${activeFont === item.value ? 'text-indigo-200' : 'text-slate-400 dark:text-slate-500'}`}>{item.desc}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="w-px h-5 bg-slate-250 dark:bg-slate-800 mx-0.5 shrink-0" />

          <button onMouseDown={handleButtonMouseDown} onClick={() => togglePopup('text')} className={`p-2 w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all ${activePopup === 'text' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'}`} title="Text Styles">
            <Type className="w-5 h-5" />
          </button>
          
          <button onMouseDown={handleButtonMouseDown} onClick={() => togglePopup('paragraph')} className={`px-2 h-9 rounded-xl flex items-center justify-center gap-0.5 shrink-0 transition-all ${activePopup === 'paragraph' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'}`} title="Paragraph Styles & Line Spacing (1.0, 1.15, 1.5, 2.0)">
            <AlignLeft className="w-4.5 h-4.5" />
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {/* 🔠 Change Case (Letter Capitalization Inverter) */}
          <button 
            type="button"
            onMouseDown={handleButtonMouseDown} 
            onClick={() => togglePopup('paragraph')} 
            className={`p-2 w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all ${activePopup === 'paragraph' ? 'text-indigo-600' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'}`} 
            title="Change Case (UPPERCASE, lowercase, Title Case, Sentence case)"
          >
            <CaseSensitive className="w-5 h-5" />
          </button>

          {/* 🎨 Quick Pastel Highlighter Pen (Color Palette) */}
          <button 
            type="button"
            onMouseDown={handleButtonMouseDown} 
            onClick={() => togglePopup('highlighter')} 
            className={`p-2 w-9 h-9 rounded-xl flex flex-col items-center justify-center shrink-0 transition-all relative ${activePopup === 'highlighter' ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'}`} 
            title="Pastel Highlighter Pen (Quick Palette)"
          >
            <Highlighter className="w-4 h-4" />
            <span 
              className="w-3.5 h-1 rounded-full mt-0.5 shadow-xs" 
              style={{ backgroundColor: selectedHighlightColor === 'transparent' ? '#cbd5e1' : selectedHighlightColor }} 
            />
          </button>

          <div className="w-px h-5 bg-slate-250 dark:bg-slate-800 mx-1 shrink-0" />

          {/* Heading Blocks */}
          <button onMouseDown={handleButtonMouseDown} onClick={() => handleHeading('h1')} className={`px-2.5 py-1 text-xs font-black rounded-lg shrink-0 transition-colors ${activeFormats.h1 ? 'bg-indigo-150 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800'}`}>H1</button>
          <button onMouseDown={handleButtonMouseDown} onClick={() => handleHeading('h2')} className={`px-2.5 py-1 text-xs font-black rounded-lg shrink-0 transition-colors ${activeFormats.h2 ? 'bg-indigo-150 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800'}`}>H2</button>
          <button onMouseDown={handleButtonMouseDown} onClick={() => handleHeading('h3')} className={`px-2.5 py-1 text-xs font-black rounded-lg shrink-0 transition-colors ${activeFormats.h3 ? 'bg-indigo-150 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800'}`}>H3</button>

          <div className="w-px h-5 bg-slate-250 dark:bg-slate-800 mx-1 shrink-0" />

          {/* Professional Font Size Dropdown and Stepper */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200/50 dark:border-slate-700/50 shadow-inner shrink-0 relative" ref={fontSizeMenuRef}>
            <button 
              type="button"
              onMouseDown={handleButtonMouseDown}
              onClick={() => {
                const current = Math.round(parseFloat(activeFormats.fontSize)) || 16;
                handleFontSize(Math.max(1, current - 1));
              }}
              className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer flex items-center justify-center"
              title="Decrease font size"
            >
              <Minus className="w-4 h-4" />
            </button>

            <div className="w-px h-4 bg-slate-300 dark:bg-slate-750 mx-0.5" />

            {/* Numeric Input & Dropdown Toggle */}
            <div className="flex items-center gap-1 relative">
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
                className="w-8 bg-transparent text-slate-800 dark:text-slate-100 text-xs font-black text-center outline-none border-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none cursor-text"
              />
              <button
                type="button"
                onMouseDown={handleButtonMouseDown}
                onClick={() => setShowFontSizeMenu(prev => !prev)}
                className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
                title="Select popular size"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="w-px h-4 bg-slate-300 dark:bg-slate-750 mx-0.5" />

            <button 
              type="button"
              onMouseDown={handleButtonMouseDown}
              onClick={() => {
                const current = Math.round(parseFloat(activeFormats.fontSize)) || 16;
                handleFontSize(Math.min(120, current + 1));
              }}
              className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer flex items-center justify-center"
              title="Increase font size"
            >
              <Plus className="w-4 h-4" />
            </button>

            {/* Premium Font Size Dropdown Popover */}
            <AnimatePresence>
              {showFontSizeMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 5, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 5, scale: 0.95 }}
                  className="absolute left-1/2 -translate-x-1/2 mt-2 top-full w-28 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1.5 shadow-2xl max-h-56 overflow-y-auto no-scrollbar space-y-0.5"
                >
                  {[10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64, 72].map(size => (
                    <button
                      key={size}
                      type="button"
                      onMouseDown={handleButtonMouseDown}
                      onClick={() => {
                        handleFontSize(size);
                        setShowFontSizeMenu(false);
                      }}
                      className={`w-full text-center py-1.5 rounded-lg transition-all text-xs font-bold cursor-pointer block ${parseInt(localFontSize, 10) === size ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                    >
                      {size}px
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="w-px h-5 bg-slate-250 dark:bg-slate-800 mx-1 shrink-0" />

           {/* Quick list togglers & blockquote */}
          <button onMouseDown={handleButtonMouseDown} onClick={() => handleListToggle('insertUnorderedList')} className={`p-2 w-9 h-9 flex items-center justify-center rounded-xl shrink-0 transition-colors ${activeFormats.unorderedList ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800'}`} title="Bullet List">
            <List className="w-5 h-5" />
          </button>
          
          <button onMouseDown={handleButtonMouseDown} onClick={() => handleListToggle('insertOrderedList')} className={`p-2 w-9 h-9 flex items-center justify-center rounded-xl shrink-0 transition-colors ${activeFormats.orderedList ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800'}`} title="Ordered List">
            <ListOrdered className="w-5 h-5" />
          </button>

          {/* Direct Outdent & Indent buttons (MS Word / Google Docs style) */}
          <button 
            type="button" 
            onMouseDown={handleButtonMouseDown} 
            onClick={handleOutdent} 
            className="p-2 w-9 h-9 flex items-center justify-center rounded-xl shrink-0 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition-all cursor-pointer" 
            title="Decrease Indent / Outdent (Shift+Tab)"
          >
            <Outdent className="w-4.5 h-4.5" />
          </button>

          <button 
            type="button" 
            onMouseDown={handleButtonMouseDown} 
            onClick={handleIndent} 
            className="p-2 w-9 h-9 flex items-center justify-center rounded-xl shrink-0 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition-all cursor-pointer" 
            title="Increase Indent (Tab)"
          >
            <Indent className="w-4.5 h-4.5" />
          </button>

          <button onMouseDown={handleButtonMouseDown} onClick={() => toggleBlock('blockquote', 'blockquote')} className={`p-2 w-9 h-9 flex items-center justify-center rounded-xl shrink-0 transition-colors ${activeFormats.blockquote ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800'}`} title="Blockquote">
            <Quote className="w-5 h-5" />
          </button>

          <div className="w-px h-5 bg-slate-250 dark:bg-slate-800 mx-1 shrink-0" />

          {/* Quick Essentials: Link, Checklist, Photo, Table */}
          <button onMouseDown={handleButtonMouseDown} onClick={() => togglePopup('link')} className={`p-2 w-9 h-9 flex items-center justify-center rounded-xl shrink-0 transition-colors ${activePopup === 'link' || selectedLinkUrl ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800'}`} title="Insert web link">
            <Link className="w-5 h-5" />
          </button>

          <button onMouseDown={handleButtonMouseDown} onClick={handleChecklist} className="p-2 w-9 h-9 flex items-center justify-center rounded-xl shrink-0 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition-all" title="Insert checklist">
            <CheckSquare className="w-5 h-5" />
          </button>
          
          <button onMouseDown={handleButtonMouseDown} onClick={() => document.getElementById('image-upload')?.click()} className="p-2 w-9 h-9 flex items-center justify-center rounded-xl shrink-0 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition-all" title="Attach image / photo">
            <ImageIcon className="w-5 h-5" />
          </button>
          
          <button onMouseDown={handleButtonMouseDown} onClick={handleTable} className={`p-2 w-9 h-9 flex items-center justify-center rounded-xl shrink-0 transition-all ${activeFormats.isInsideTable || activePopup === 'table' || activePopup === 'tableActions' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800'}`} title="Data Table">
            <Table className="w-5 h-5" />
          </button>

          {/* ✨ Smart "＋ Insert" Dropdown Button (Groups Drawings, Shapes, Diagrams, Math, Code, Callout, Columns) */}
          <button 
            type="button"
            onMouseDown={handleButtonMouseDown} 
            onClick={() => togglePopup(activePopup === 'insert' ? null : 'insert')} 
            className={`px-3 py-1.5 h-9 rounded-xl flex items-center gap-1.5 shrink-0 font-bold text-xs transition-all cursor-pointer ${
              activePopup === 'insert' 
                ? 'bg-indigo-600 text-white shadow-md' 
                : 'bg-indigo-50/90 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/70 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/60'
            }`} 
            title="Insert Rich Blocks (Drawing, Shapes, Flowcharts, Math, Code, Callout, Columns)"
          >
            <Plus className="w-4 h-4" />
            <span>Insert</span>
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>

          {/* ✏️ Direct Note Inking / Pen Mode (OneNote style) */}
          <button 
            type="button"
            onMouseDown={handleButtonMouseDown} 
            onClick={toggleInkingMode} 
            className={`px-3 py-1.5 h-9 rounded-xl flex items-center gap-1.5 shrink-0 font-bold text-xs transition-all cursor-pointer ${
              isInkingMode 
                ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20 ring-2 ring-purple-300 dark:ring-purple-700' 
                : inkStrokes.length > 0 
                  ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800 hover:bg-purple-100' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-purple-600'
            }`} 
            title="Direct Pen & Inking Mode: Draw directly on your note canvas (OneNote style)"
          >
            <Pencil className="w-4 h-4" />
            <span>Draw</span>
            {inkStrokes.length > 0 && !isInkingMode && (
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500" title="Note has ink sketches" />
            )}
          </button>

          <div className="w-px h-5 bg-slate-250 dark:bg-slate-800 mx-1 shrink-0" />

          {/* Search tool */}
          <button onMouseDown={handleButtonMouseDown} onClick={() => setShowFindReplace(prev => !prev)} className={`p-2 w-9 h-9 flex items-center justify-center rounded-xl shrink-0 transition-colors ${showFindReplace ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800'}`} title="Find and Replace">
            <Search className="w-5 h-5" />
          </button>

          {/* 📄 A4 Document View Toggle (Word Mode) */}
          <button 
            type="button"
            onMouseDown={handleButtonMouseDown} 
            onClick={() => setIsA4Mode(prev => !prev)} 
            className={`p-1.5 h-9 px-2.5 flex items-center gap-1.5 rounded-xl shrink-0 text-xs font-bold transition-all cursor-pointer ${isA4Mode ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'}`} 
            title="Toggle Microsoft Word A4 Page Layout"
          >
            <BookOpen className="w-4 h-4" />
            <span className="hidden xl:inline text-[11px]">A4 View</span>
          </button>

          {/* 🖨️ Print / Save as PDF */}
          <button 
            type="button"
            onMouseDown={handleButtonMouseDown} 
            onClick={handlePrint} 
            className="p-2 w-9 h-9 flex items-center justify-center rounded-xl shrink-0 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-indigo-600 transition-all cursor-pointer" 
            title="Print or Save as PDF (Ctrl+P)"
          >
            <Printer className="w-4.5 h-4.5" />
          </button>

          {/* ⏱️ Live Reading Time & Word Count Pill */}
          <div 
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-[11px] font-semibold text-slate-500 dark:text-slate-400 select-none shrink-0 border border-slate-200/50 dark:border-slate-700/50 ml-auto"
            title="Live note statistics"
          >
            <span>⏱️ {readingTime || 1} min read</span>
            <span className="text-slate-350 dark:text-slate-600">·</span>
            <span>{wordCount} words</span>
          </div>

          <input type="file" id="image-upload" className="hidden" accept="image/*" onChange={handleImageUpload} />
        </div>

        {/* Toolbar Popups */}
        <AnimatePresence>
          {activePopup === 'text' && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 absolute top-full left-0 w-full z-30 shadow-xl">
              <div className="p-4 space-y-4">
                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl max-w-sm">
                  <button type="button" onMouseDown={handleButtonMouseDown} onClick={() => handleFormat('bold')} className={`p-2 rounded-lg transition-all ${activeFormats.bold ? 'bg-white dark:bg-slate-700 text-indigo-600 font-bold' : 'text-slate-500'}`} title="Bold"><Bold className="w-4 h-4 pointer-events-none" /></button>
                  <button type="button" onMouseDown={handleButtonMouseDown} onClick={() => handleFormat('italic')} className={`p-2 rounded-lg transition-all ${activeFormats.italic ? 'bg-white dark:bg-slate-700 text-indigo-600' : 'text-slate-500'}`} title="Italic"><Italic className="w-4 h-4 pointer-events-none" /></button>
                  <button type="button" onMouseDown={handleButtonMouseDown} onClick={() => handleFormat('underline')} className={`p-2 rounded-lg transition-all ${activeFormats.underline ? 'bg-white dark:bg-slate-700 text-indigo-600' : 'text-slate-500'}`} title="Underline"><Underline className="w-4 h-4 pointer-events-none" /></button>
                  <button type="button" onMouseDown={handleButtonMouseDown} onClick={() => handleFormat('strikeThrough')} className={`p-2 rounded-lg transition-all ${activeFormats.strikeThrough ? 'bg-white dark:bg-slate-700 text-indigo-600' : 'text-slate-500'}`} title="Strikethrough"><Strikethrough className="w-4 h-4 pointer-events-none" /></button>
                  
                  <div className="w-px h-6 bg-slate-350 dark:bg-slate-750 mx-1" />
                  
                  <button 
                    type="button"
                    onMouseDown={handleButtonMouseDown} 
                    onClick={handleHighlight} 
                    className={`p-2 rounded-lg transition-all flex items-center gap-1.5 ${activeFormats.highlight ? 'bg-white dark:bg-slate-700 text-indigo-600' : 'text-slate-500'}`} 
                    title="Text Highlight"
                  >
                    <Highlighter className="w-4 h-4 pointer-events-none" />
                    <span 
                      className="w-2.5 h-2.5 rounded-full border border-slate-300 dark:border-slate-600 shadow-sm shrink-0 pointer-events-none" 
                      style={{ backgroundColor: selectedHighlightColor }} 
                    />
                  </button>
                  
                  <button type="button" onMouseDown={handleButtonMouseDown} onClick={handleClearFormatting} className="p-2 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white" title="Clear styling"><Eraser className="w-4 h-4 pointer-events-none" /></button>
                </div>
                
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2 px-1">Font Color</p>
                  <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-2 px-1">
                    {[
                      '#0f172a', '#64748b', '#ef4444', '#f97316', '#eab308', 
                      '#22c55e', '#06b6d4', '#3b82f6', '#6366f1', '#a855f7', 
                      '#ec4899', '#ffffff'
                    ].map(color => {
                      const isActive = rgbToHex(activeFormats.fontColor) === color.toLowerCase();
                      return (
                        <button 
                          key={color} 
                          type="button" 
                          onMouseDown={handleButtonMouseDown}
                          onClick={() => handleFontColor(color)} 
                          className={`w-7 h-7 rounded-lg shrink-0 shadow-sm transition-transform hover:scale-105 flex items-center justify-center ${isActive ? 'ring-2 ring-indigo-500 border-none' : 'border border-slate-200 dark:border-slate-850'}`} 
                          style={{ backgroundColor: color }} 
                        >
                          {isActive && <Check className={`w-3.5 h-3.5 ${color === '#ffffff' ? 'text-slate-800' : 'text-white'}`} />}
                        </button>
                      );
                    })}

                    {(() => {
                      const presets = [
                        '#0f172a', '#64748b', '#ef4444', '#f97316', '#eab308', 
                        '#22c55e', '#06b6d4', '#3b82f6', '#6366f1', '#a855f7', 
                        '#ec4899', '#ffffff'
                      ];
                      const isCustom = selectedFontColor && !presets.includes(selectedFontColor.toLowerCase());
                      if (!isCustom) return null;
                      const isActive = rgbToHex(activeFormats.fontColor) === selectedFontColor.toLowerCase();
                      return (
                        <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/80 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 shrink-0">
                          <button
                            type="button"
                            onMouseDown={handleButtonMouseDown}
                            onClick={() => handleFontColor(selectedFontColor)}
                            className={`w-6 h-6 rounded-md shadow-sm transition-transform hover:scale-105 flex items-center justify-center`}
                            style={{ backgroundColor: selectedFontColor }}
                            title={`Custom Color: ${selectedFontColor}`}
                          >
                            {isActive && <Check className={`w-3 h-3 ${selectedFontColor === '#ffffff' ? 'text-slate-800' : 'text-white'}`} />}
                          </button>
                          <button
                            type="button"
                            onMouseDown={handleButtonMouseDown}
                            onClick={() => handleFontColor(selectedFontColor)}
                            className="px-2 py-0.5 text-[9px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-sm transition-colors uppercase tracking-wider"
                          >
                            Apply
                          </button>
                        </div>
                      );
                    })()}
                    
                    <label 
                      onMouseDown={handleButtonMouseDown}
                      className="w-7 h-7 rounded-lg shrink-0 shadow-sm border border-slate-200 dark:border-slate-850 hover:scale-105 transition-transform flex items-center justify-center cursor-pointer bg-gradient-to-tr from-rose-500 via-yellow-500 to-blue-500 relative" 
                      title="Custom color"
                    >
                      <input 
                        type="color" 
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        value={selectedFontColor}
                        onChange={(e) => handleFontColor(e.target.value)}
                      />
                      <Plus className="w-3.5 h-3.5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
                    </label>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2 px-1">Highlight Color</p>
                  <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-2 px-1">
                    {[
                      'none', '#fde047', '#86efac', '#93c5fd', '#fca5a5', '#fed7aa', 
                      '#c084fc', '#fbcfe8', '#a5f3fc', '#e2e8f0'
                    ].map(color => {
                      if (color === 'none') {
                        const isActive = !activeFormats.highlight;
                        return (
                          <button
                            key="none"
                            type="button"
                            onMouseDown={handleButtonMouseDown}
                            onClick={() => handleHighlightColor('transparent')}
                            className={`w-7 h-7 rounded-lg shrink-0 shadow-sm transition-transform hover:scale-105 flex items-center justify-center bg-white dark:bg-slate-800 ${isActive ? 'ring-2 ring-indigo-500 border-none' : 'border border-slate-200 dark:border-slate-850'}`}
                            title="No Highlight (None)"
                          >
                            <div className="w-5 h-5 relative flex items-center justify-center">
                              <div className="absolute w-full h-[1.5px] bg-rose-500 rotate-45" />
                              <div className="absolute w-4 h-4 rounded-full border border-slate-350 dark:border-slate-600" />
                            </div>
                          </button>
                        );
                      }
                      const isActive = activeFormats.highlight && selectedHighlightColor.toLowerCase() === color.toLowerCase();
                      return (
                        <button 
                          key={color} 
                          type="button" 
                          onMouseDown={handleButtonMouseDown}
                          onClick={() => handleHighlightColor(color)} 
                          className={`w-7 h-7 rounded-lg shrink-0 shadow-sm transition-transform hover:scale-105 flex items-center justify-center ${isActive ? 'ring-2 ring-indigo-500 border-none' : 'border border-slate-200 dark:border-slate-850'}`} 
                          style={{ backgroundColor: color }} 
                        >
                          {isActive && <Check className="w-3.5 h-3.5 text-slate-800" />}
                        </button>
                      );
                    })}

                    {(() => {
                      const presets = [
                        '#fde047', '#86efac', '#93c5fd', '#fca5a5', '#fed7aa', 
                        '#c084fc', '#fbcfe8', '#a5f3fc', '#e2e8f0'
                      ];
                      const isCustom = selectedHighlightColor && selectedHighlightColor !== 'transparent' && !presets.includes(selectedHighlightColor.toLowerCase());
                      if (!isCustom) return null;
                      const isActive = activeFormats.highlight && selectedHighlightColor.toLowerCase() === selectedHighlightColor.toLowerCase();
                      return (
                        <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/80 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 shrink-0">
                          <button
                            type="button"
                            onMouseDown={handleButtonMouseDown}
                            onClick={() => handleHighlightColor(selectedHighlightColor)}
                            className={`w-6 h-6 rounded-md shadow-sm transition-transform hover:scale-105 flex items-center justify-center`}
                            style={{ backgroundColor: selectedHighlightColor }}
                            title={`Custom Highlight Color: ${selectedHighlightColor}`}
                          >
                            {isActive && <Check className="w-3 h-3 text-slate-800" />}
                          </button>
                          <button
                            type="button"
                            onMouseDown={handleButtonMouseDown}
                            onClick={() => handleHighlightColor(selectedHighlightColor)}
                            className="px-2 py-0.5 text-[9px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-sm transition-colors uppercase tracking-wider"
                          >
                            Apply
                          </button>
                        </div>
                      );
                    })()}
                    
                    <label 
                      onMouseDown={handleButtonMouseDown}
                      className="w-7 h-7 rounded-lg shrink-0 shadow-sm border border-slate-200 dark:border-slate-850 hover:scale-105 transition-transform flex items-center justify-center cursor-pointer bg-gradient-to-tr from-rose-400 via-yellow-300 to-blue-400 relative" 
                      title="Custom highlight color"
                    >
                      <input 
                        type="color" 
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        value={selectedHighlightColor === 'transparent' ? '#fcd34d' : selectedHighlightColor}
                        onChange={(e) => handleHighlightColor(e.target.value)}
                      />
                      <Plus className="w-3.5 h-3.5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
                    </label>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
          {activePopup === 'paragraph' && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 absolute top-full left-0 w-full z-30 shadow-xl">
              <div className="p-4 max-w-xl mx-auto space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Alignment */}
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Text Alignment</p>
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                      <button type="button" onMouseDown={handleButtonMouseDown} onClick={() => handleFormat('justifyLeft')} className={`flex-1 p-2 rounded-lg flex justify-center transition-all ${activeFormats.justifyLeft ? 'bg-white dark:bg-slate-700 text-indigo-600' : 'text-slate-500'}`} title="Align Left"><AlignLeft className="w-4 h-4" /></button>
                      <button type="button" onMouseDown={handleButtonMouseDown} onClick={() => handleFormat('justifyCenter')} className={`flex-1 p-2 rounded-lg flex justify-center transition-all ${activeFormats.justifyCenter ? 'bg-white dark:bg-slate-700 text-indigo-600' : 'text-slate-500'}`} title="Align Center"><AlignCenter className="w-4 h-4" /></button>
                      <button type="button" onMouseDown={handleButtonMouseDown} onClick={() => handleFormat('justifyRight')} className={`flex-1 p-2 rounded-lg flex justify-center transition-all ${activeFormats.justifyRight ? 'bg-white dark:bg-slate-700 text-indigo-600' : 'text-slate-500'}`} title="Align Right"><AlignRight className="w-4 h-4" /></button>
                    </div>
                  </div>

                  {/* Line Spacing */}
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Line Spacing (Line Height)</p>
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                      {[
                        { label: '1.0', value: '1.0', desc: 'Compact' },
                        { label: '1.15', value: '1.15', desc: 'Normal' },
                        { label: '1.5', value: '1.5', desc: 'Relaxed' },
                        { label: '2.0', value: '2.0', desc: 'Double' }
                      ].map(sp => (
                        <button
                          key={sp.value}
                          type="button"
                          onMouseDown={handleButtonMouseDown}
                          onClick={() => handleLineSpacing(sp.value)}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${currentLineSpacing === sp.value ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                          title={`${sp.desc} spacing (${sp.label})`}
                        >
                          {sp.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 dark:border-slate-800 pt-3">
                  {/* Indentation */}
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Indentation (Tab / Shift+Tab)</p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onMouseDown={handleButtonMouseDown}
                        onClick={handleOutdent}
                        className="flex-1 py-1.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-1.5 transition"
                        title="Decrease Indent (Shift+Tab)"
                      >
                        <Outdent className="w-3.5 h-3.5 text-slate-500" />
                        <span>Outdent</span>
                      </button>
                      <button
                        type="button"
                        onMouseDown={handleButtonMouseDown}
                        onClick={handleIndent}
                        className="flex-1 py-1.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-1.5 transition"
                        title="Increase Indent (Tab)"
                      >
                        <Indent className="w-3.5 h-3.5 text-slate-500" />
                        <span>Indent</span>
                      </button>
                    </div>
                  </div>

                  {/* Change Case */}
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Change Case (Select text)</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onMouseDown={handleButtonMouseDown}
                        onClick={() => handleChangeCase('uppercase')}
                        className="py-1 px-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 hover:text-indigo-600 text-[11px] font-bold text-slate-700 dark:text-slate-300 transition"
                      >
                        UPPERCASE
                      </button>
                      <button
                        type="button"
                        onMouseDown={handleButtonMouseDown}
                        onClick={() => handleChangeCase('lowercase')}
                        className="py-1 px-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 hover:text-indigo-600 text-[11px] font-semibold text-slate-700 dark:text-slate-300 transition"
                      >
                        lowercase
                      </button>
                      <button
                        type="button"
                        onMouseDown={handleButtonMouseDown}
                        onClick={() => handleChangeCase('title')}
                        className="py-1 px-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 hover:text-indigo-600 text-[11px] font-semibold text-slate-700 dark:text-slate-300 transition"
                      >
                        Title Case
                      </button>
                      <button
                        type="button"
                        onMouseDown={handleButtonMouseDown}
                        onClick={() => handleChangeCase('sentence')}
                        className="py-1 px-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 hover:text-indigo-600 text-[11px] font-semibold text-slate-700 dark:text-slate-300 transition"
                      >
                        Sentence case
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activePopup === 'link' && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 absolute top-full left-0 w-full z-30 shadow-xl">
              <div className="p-4 max-w-sm mx-auto space-y-3">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                  {selectedLinkUrl ? 'Edit Link' : 'Insert Web Link or Bookmark'}
                </p>
                <input
                  type="text"
                  placeholder="https://example.com..."
                  value={linkUrl || selectedLinkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleLinkInsert(linkUrl || selectedLinkUrl);
                  }}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs outline-none focus:border-indigo-500"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleLinkInsert(linkUrl || selectedLinkUrl)}
                    className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-550 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                  >
                    Inline Link
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertBookmark(linkUrl || selectedLinkUrl)}
                    className="flex-1 py-1.5 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                    title="Insert as rich Notion-style bookmark card"
                  >
                    <Bookmark className="w-3.5 h-3.5" /> Bookmark Card
                  </button>
                </div>
                {selectedLinkUrl && (
                  <button type="button" onClick={handleLinkRemove} className="w-full py-1 text-center text-xs font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-all">
                    Remove Link
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {activePopup === 'table' && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 absolute top-full left-0 w-full z-30 shadow-xl">
              <div className="p-4 max-w-sm mx-auto space-y-4">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Table className="w-4 h-4 text-indigo-500" /> Create Table
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 px-1">Rows</label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={customRows}
                      onChange={(e) => setCustomRows(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 px-1">Columns</label>
                    <input
                      type="number"
                      min="1"
                      max="15"
                      value={customCols}
                      onChange={(e) => setCustomCols(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onMouseDown={handleButtonMouseDown}
                  onClick={() => {
                    const r = parseInt(customRows) || 3;
                    const c = parseInt(customCols) || 3;
                    handleGridClick(r - 1, c - 1);
                  }}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1"
                >
                  <Plus className="w-4 h-4" /> Create {customRows} x {customCols} Table
                </button>
              </div>
            </motion.div>
          )}

          {activePopup === 'tableActions' && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 absolute top-full left-0 w-full z-30 shadow-xl">
              <div className="p-4 max-w-sm mx-auto space-y-4">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Table className="w-4 h-4 text-indigo-500" /> Table Actions
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onMouseDown={handleButtonMouseDown}
                    onClick={handleAddRow}
                    className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all"
                  >
                    Add Row
                  </button>
                  <button
                    type="button"
                    onMouseDown={handleButtonMouseDown}
                    onClick={handleDeleteRow}
                    className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-600 dark:text-rose-400 text-xs font-bold transition-all"
                  >
                    Delete Row
                  </button>
                  <button
                    type="button"
                    onMouseDown={handleButtonMouseDown}
                    onClick={handleAddColumn}
                    className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all"
                  >
                    Add Column
                  </button>
                  <button
                    type="button"
                    onMouseDown={handleButtonMouseDown}
                    onClick={handleDeleteColumn}
                    className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-600 dark:text-rose-400 text-xs font-bold transition-all"
                  >
                    Delete Column
                  </button>
                </div>
                <button
                  type="button"
                  onMouseDown={handleButtonMouseDown}
                  onClick={handleDeleteTable}
                  className="w-full flex items-center justify-center gap-1.5 p-2.5 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 text-xs font-bold transition-all cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" /> Delete Entire Table
                </button>
              </div>
            </motion.div>
          )}

          {activePopup === ('callout' as any) && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 absolute top-full left-0 w-full z-30 shadow-xl p-4">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Select Callout Box Style</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => { handleInsertCallout('tip'); setActivePopup(null); }}
                  className="p-3 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/20 text-left hover:scale-[1.02] transition cursor-pointer"
                >
                  <span className="text-base">💡</span>
                  <p className="text-xs font-bold text-indigo-900 dark:text-indigo-200 mt-1">Tip Box</p>
                  <p className="text-[10px] text-indigo-700/70 dark:text-indigo-400">Highlight important ideas</p>
                </button>
                <button
                  type="button"
                  onClick={() => { handleInsertCallout('warn'); setActivePopup(null); }}
                  className="p-3 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 text-left hover:scale-[1.02] transition cursor-pointer"
                >
                  <span className="text-base">⚠️</span>
                  <p className="text-xs font-bold text-amber-900 dark:text-amber-200 mt-1">Warning Box</p>
                  <p className="text-[10px] text-amber-700/70 dark:text-amber-400">Caution or critical notes</p>
                </button>
                <button
                  type="button"
                  onClick={() => { handleInsertCallout('goal'); setActivePopup(null); }}
                  className="p-3 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20 text-left hover:scale-[1.02] transition cursor-pointer"
                >
                  <span className="text-base">🎯</span>
                  <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200 mt-1">Goal Box</p>
                  <p className="text-[10px] text-emerald-700/70 dark:text-emerald-400">Targets and milestones</p>
                </button>
              </div>
            </motion.div>
          )}

          {activePopup === 'highlighter' && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 absolute top-full left-0 w-full z-30 shadow-xl p-4">
              <div className="max-w-md mx-auto space-y-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Highlighter className="w-3.5 h-3.5 text-amber-500" /> Quick Pastel Highlighter Pen
                  </p>
                  <span className="text-[10px] text-slate-400">Select text and click marker</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {PASTEL_HIGHLIGHT_COLORS.map(c => {
                    const isSelected = selectedHighlightColor.toLowerCase() === c.value.toLowerCase();
                    return (
                      <button
                        key={c.name}
                        type="button"
                        onMouseDown={handleButtonMouseDown}
                        onClick={() => {
                          handleHighlightColor(c.value);
                          setActivePopup(null);
                        }}
                        className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-xl border hover:scale-105 active:scale-95 transition-all text-xs font-medium cursor-pointer shadow-xs ${isSelected ? 'ring-2 ring-indigo-500 font-bold border-indigo-400' : 'border-slate-200/80 dark:border-slate-700/80'}`}
                        style={{ backgroundColor: c.value, color: '#1e293b' }}
                        title={`Highlight with ${c.name}`}
                      >
                        <span className="w-2.5 h-2.5 rounded-full border border-black/15 shrink-0" style={{ backgroundColor: c.value }} />
                        <span className="text-[11px] font-semibold">{c.name}</span>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onMouseDown={handleButtonMouseDown}
                    onClick={() => {
                      handleHighlightColor('transparent');
                      setActivePopup(null);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-slate-600 dark:text-slate-300 text-xs font-medium cursor-pointer shadow-xs"
                    title="Remove highlight"
                  >
                    <Eraser className="w-3.5 h-3.5 text-rose-500" />
                    <span className="text-[11px]">Clear</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {activePopup === 'divider' && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 absolute top-full left-0 w-full z-30 shadow-xl p-4">
              <div className="max-w-xl mx-auto space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Minus className="w-3.5 h-3.5 text-indigo-500" /> Aesthetic Decorative Dividers
                  </p>
                  <span className="text-[10px] text-slate-400">Click to insert into note</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <button
                    type="button"
                    onMouseDown={handleButtonMouseDown}
                    onClick={() => { handleInsertDivider('gradient'); setActivePopup(null); }}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600 bg-slate-50/50 dark:bg-slate-800/40 text-left transition hover:scale-102 cursor-pointer flex flex-col justify-between h-20"
                  >
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Gradient Fade</span>
                    <div className="h-0.5 w-full bg-linear-to-r from-transparent via-indigo-500 to-transparent my-1" />
                    <span className="text-[10px] text-slate-400">Soft neon fade</span>
                  </button>

                  <button
                    type="button"
                    onMouseDown={handleButtonMouseDown}
                    onClick={() => { handleInsertDivider('stars'); setActivePopup(null); }}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600 bg-slate-50/50 dark:bg-slate-800/40 text-left transition hover:scale-102 cursor-pointer flex flex-col justify-between h-20"
                  >
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Star Break</span>
                    <div className="text-center text-xs tracking-[0.3em] text-indigo-400">✦ ✦ ✦</div>
                    <span className="text-[10px] text-slate-400">Modern celestial</span>
                  </button>

                  <button
                    type="button"
                    onMouseDown={handleButtonMouseDown}
                    onClick={() => { handleInsertDivider('dots'); setActivePopup(null); }}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600 bg-slate-50/50 dark:bg-slate-800/40 text-left transition hover:scale-102 cursor-pointer flex flex-col justify-between h-20"
                  >
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Dotted Rule</span>
                    <div className="border-t-2 border-dotted border-slate-400 dark:border-slate-600 my-1 w-full" />
                    <span className="text-[10px] text-slate-400">Notion-style dots</span>
                  </button>

                  <button
                    type="button"
                    onMouseDown={handleButtonMouseDown}
                    onClick={() => { handleInsertDivider('line'); setActivePopup(null); }}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600 bg-slate-50/50 dark:bg-slate-800/40 text-left transition hover:scale-102 cursor-pointer flex flex-col justify-between h-20"
                  >
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Thin Line</span>
                    <div className="h-px w-full bg-slate-300 dark:bg-slate-700 my-1" />
                    <span className="text-[10px] text-slate-400">Minimal divider</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {activePopup === 'columns' && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 absolute top-full left-0 w-full z-30 shadow-xl p-4">
              <div className="max-w-md mx-auto space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Columns2 className="w-3.5 h-3.5 text-indigo-500" /> Multi-Column Split Layout
                  </p>
                  <span className="text-[10px] text-slate-400">Side-by-side editable blocks</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onMouseDown={handleButtonMouseDown}
                    onClick={() => handleInsertColumns(2)}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600 bg-slate-50/50 dark:bg-slate-800/40 text-left transition hover:scale-102 cursor-pointer flex flex-col justify-between"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-6 flex-1 bg-indigo-100 dark:bg-indigo-950/60 rounded border border-indigo-200 dark:border-indigo-800" />
                      <div className="h-6 flex-1 bg-indigo-100 dark:bg-indigo-950/60 rounded border border-indigo-200 dark:border-indigo-800" />
                    </div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">2 Columns (50% / 50%)</span>
                    <span className="text-[10px] text-slate-400">Pros vs Cons, code & notes</span>
                  </button>

                  <button
                    type="button"
                    onMouseDown={handleButtonMouseDown}
                    onClick={() => handleInsertColumns(3)}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600 bg-slate-50/50 dark:bg-slate-800/40 text-left transition hover:scale-102 cursor-pointer flex flex-col justify-between"
                  >
                    <div className="flex items-center gap-1.5 mb-2">
                      <div className="h-6 flex-1 bg-indigo-100 dark:bg-indigo-950/60 rounded border border-indigo-200 dark:border-indigo-800" />
                      <div className="h-6 flex-1 bg-indigo-100 dark:bg-indigo-950/60 rounded border border-indigo-200 dark:border-indigo-800" />
                      <div className="h-6 flex-1 bg-indigo-100 dark:bg-indigo-950/60 rounded border border-indigo-200 dark:border-indigo-800" />
                    </div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">3 Columns (33% each)</span>
                    <span className="text-[10px] text-slate-400">Triple comparison cards</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ▢ In-Document Shape / Text Box Popup (MS Word Style) */}
          {activePopup === 'shape' && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 absolute top-full left-0 w-full z-30 shadow-xl p-4">
              <div className="max-w-3xl mx-auto space-y-4">
                
                {/* Header title */}
                <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Square className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                      {editingShapeEl ? '🎨 Edit Shape & Text Box Styles (Live)' : '▢ Insert Shape / Text Box (MS Word Style)'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setEditingShapeEl(null); togglePopup(null); }}
                    className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold"
                  >
                    ✕ Close
                  </button>
                </div>

                {/* IF EDITING AN EXISTING SHAPE: Show Live Styler Controls */}
                {editingShapeEl ? (
                  <div className="space-y-3.5 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-indigo-100 dark:border-indigo-950">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                        Editing Selected Shape • Live Changes
                      </span>
                      <button
                        type="button"
                        onClick={() => { setEditingShapeEl(null); togglePopup(null); }}
                        className="px-3 py-1 rounded-lg bg-indigo-600 text-white font-bold text-xs"
                      >
                        ✓ Done Styling
                      </button>
                    </div>

                    {/* Fill Color */}
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Fill Color (Background)</p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {[
                          { name: 'Transparent', value: 'transparent', label: '⊘' },
                          { name: 'White', value: '#ffffff' },
                          { name: 'Slate Light', value: '#f8fafc' },
                          { name: 'Lemon Yellow', value: '#fef9c3' },
                          { name: 'Mint Green', value: '#dcfce7' },
                          { name: 'Ice Blue', value: '#e0f2fe' },
                          { name: 'Soft Lavender', value: '#f3e8ff' },
                          { name: 'Peach', value: '#ffedd5' },
                          { name: 'Rose', value: '#ffe4e6' },
                          { name: 'Indigo Soft', value: 'rgba(99, 102, 241, 0.08)' },
                          { name: 'Dark Slate', value: '#0f172a' }
                        ].map(c => (
                          <button
                            key={c.value}
                            type="button"
                            onClick={() => handleApplyShapeStyle({ fill: c.value })}
                            className="w-7 h-7 rounded-lg border border-black/15 flex items-center justify-center font-bold text-xs shadow-xs hover:scale-110 transition cursor-pointer"
                            style={{ backgroundColor: c.value === 'transparent' ? '#ffffff' : c.value, color: c.value === '#0f172a' ? '#ffffff' : '#334155' }}
                            title={c.name}
                          >
                            {c.label || ''}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Border Color */}
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Border Color</p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {[
                          { name: 'None', value: 'transparent', label: '⊘' },
                          { name: 'Indigo', value: '#6366f1' },
                          { name: 'Emerald', value: '#10b981' },
                          { name: 'Amber', value: '#f59e0b' },
                          { name: 'Rose', value: '#f43f5e' },
                          { name: 'Sky', value: '#0ea5e9' },
                          { name: 'Purple', value: '#8b5cf6' },
                          { name: 'Slate', value: '#94a3b8' },
                          { name: 'Black', value: '#000000' }
                        ].map(c => (
                          <button
                            key={c.value}
                            type="button"
                            onClick={() => handleApplyShapeStyle({ borderColor: c.value })}
                            className="w-6 h-6 rounded-full border border-black/20 flex items-center justify-center text-[10px] font-bold shadow-xs hover:scale-110 transition cursor-pointer"
                            style={{ backgroundColor: c.value === 'transparent' ? '#ffffff' : c.value }}
                            title={c.name}
                          >
                            {c.label || ''}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Border Style & Corner Roundness */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Border Thickness & Style</p>
                        <div className="flex items-center gap-1.5">
                          {['1px', '2px', '3px', '4px'].map(th => (
                            <button
                              key={th}
                              type="button"
                              onClick={() => handleApplyShapeStyle({ borderWidth: th })}
                              className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                            >
                              {th}
                            </button>
                          ))}
                          <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />
                          {['solid', 'dashed', 'dotted'].map(st => (
                            <button
                              key={st}
                              type="button"
                              onClick={() => handleApplyShapeStyle({ borderStyle: st })}
                              className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold capitalize hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                            >
                              {st}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Corner Roundness</p>
                        <div className="flex items-center gap-1.5">
                          {[
                            { label: 'Square (0px)', value: '0px' },
                            { label: 'Subtle (8px)', value: '8px' },
                            { label: 'Rounded (16px)', value: '16px' },
                            { label: 'Pill (28px)', value: '28px' }
                          ].map(rd => (
                            <button
                              key={rd.value}
                              type="button"
                              onClick={() => handleApplyShapeStyle({ borderRadius: rd.value })}
                              className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                            >
                              {rd.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* IF INSERTING NEW SHAPE: Show Preset Cards */
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                      Choose Shape Style to Insert into Note
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {[
                        { id: 'rounded', title: 'Rounded Box', desc: 'Card with border', bg: '#f8fafc', border: '#6366f1', radius: '12px' },
                        { id: 'sticky', title: 'Sticky Note', desc: 'Yellow memo note', bg: '#fef9c3', border: '#facc15', radius: '8px' },
                        { id: 'mint', title: 'Mint Goal Card', desc: 'Green target box', bg: '#f0fdf4', border: '#10b981', radius: '12px' },
                        { id: 'rose', title: 'Rose Notice', desc: 'Pink alert box', bg: '#fff1f2', border: '#f43f5e', radius: '12px' },
                        { id: 'lavender', title: 'Lavender Concept', desc: 'Creative idea box', bg: '#faf5ff', border: '#8b5cf6', radius: '16px' },
                        { id: 'pill', title: 'Pill Badge', desc: 'Curved tag badge', bg: '#f1f5f9', border: '#4f46e5', radius: '28px' },
                        { id: 'dashed', title: 'Draft Dashed', desc: 'Transparent frame', bg: 'transparent', border: '#94a3b8', radius: '10px', style: 'dashed' }
                      ].map(preset => (
                        <button
                          key={preset.id}
                          type="button"
                          onMouseDown={handleButtonMouseDown}
                          onClick={() => handleInsertShape(preset.id)}
                          className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500 text-left transition hover:scale-102 cursor-pointer flex flex-col justify-between h-24 shadow-xs"
                          style={{ backgroundColor: preset.bg === 'transparent' ? 'transparent' : preset.bg }}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-900">{preset.title}</span>
                            <div className="w-3.5 h-3.5 rounded" style={{ border: `2px ${preset.style || 'solid'} ${preset.border}` }} />
                          </div>
                          <span className="text-[10px] text-slate-500 font-medium">{preset.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ✨ Modern Consolidated "Insert" Popover Menu */}
          {activePopup === 'insert' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t border-slate-100 dark:border-slate-800 bg-white/98 dark:bg-slate-900/98 backdrop-blur-md absolute top-full left-0 w-full z-30 shadow-2xl"
            >
              <div className="p-4 max-w-5xl mx-auto">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-150 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs">
                      ＋
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        Insert Rich Media & Elements
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Select an element to add to your note at cursor position
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActivePopup(null)}
                    className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs flex items-center gap-1 cursor-pointer transition"
                  >
                    <X className="w-4 h-4" />
                    <span>Close</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Category 1: Visual & Drawings */}
                  <div className="bg-slate-50/70 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 flex flex-col gap-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 px-1">
                      <span>🎨</span> Visual & Interactive
                    </p>

                    <button
                      type="button"
                      onMouseDown={handleButtonMouseDown}
                      onClick={() => { setActivePopup(null); toggleInkingMode(); }}
                      className="group flex items-start gap-3 p-2.5 rounded-xl hover:bg-white dark:hover:bg-slate-800 transition text-left cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700 shadow-xs hover:shadow-sm"
                    >
                      <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                        <Pencil className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-purple-600 dark:group-hover:text-purple-400 flex items-center gap-1">
                          Direct Pen & Inking Mode
                        </span>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                          OneNote style pen, highlighter & scribble on note page
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onMouseDown={handleButtonMouseDown}
                      onClick={() => { setActivePopup(null); handleOpenDrawingModal(); }}
                      className="group flex items-start gap-3 p-2.5 rounded-xl hover:bg-white dark:hover:bg-slate-800 transition text-left cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700 shadow-xs hover:shadow-sm"
                    >
                      <div className="w-8 h-8 rounded-lg bg-pink-50 dark:bg-pink-950/40 text-pink-500 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                        <Palette className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-pink-600 dark:group-hover:text-pink-400 flex items-center gap-1">
                          Drawing Canvas
                        </span>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                          Google Docs style doodle & sketch pad
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onMouseDown={handleButtonMouseDown}
                      onClick={() => { setActivePopup(null); handleOpenMermaidModal(); }}
                      className="group flex items-start gap-3 p-2.5 rounded-xl hover:bg-white dark:hover:bg-slate-800 transition text-left cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700 shadow-xs hover:shadow-sm"
                    >
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                        <GitFork className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 flex items-center gap-1">
                          Flowchart & Mindmap
                        </span>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                          Interactive Mermaid diagram visualizer
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onMouseDown={handleButtonMouseDown}
                      onClick={() => { setActivePopup(null); handleOpenMathModal(); }}
                      className="group flex items-start gap-3 p-2.5 rounded-xl hover:bg-white dark:hover:bg-slate-800 transition text-left cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700 shadow-xs hover:shadow-sm"
                    >
                      <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 font-serif font-black text-sm flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                        ∑
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-purple-600 dark:group-hover:text-purple-400 flex items-center gap-1">
                          LaTeX Math Formula
                        </span>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                          Equations, fractions & math symbols
                        </p>
                      </div>
                    </button>
                  </div>

                  {/* Category 2: Cards & Boxes */}
                  <div className="bg-slate-50/70 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 flex flex-col gap-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 px-1">
                      <span>📦</span> Cards, Shapes & Snippets
                    </p>

                    <button
                      type="button"
                      onMouseDown={handleButtonMouseDown}
                      onClick={() => {
                        setEditingShapeEl(null);
                        setActivePopup('shape');
                      }}
                      className="group flex items-start gap-3 p-2.5 rounded-xl hover:bg-white dark:hover:bg-slate-800 transition text-left cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700 shadow-xs hover:shadow-sm"
                    >
                      <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-500 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                        <Square className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-amber-600 dark:group-hover:text-amber-400 flex items-center gap-1">
                          Shape & Sticky Note
                        </span>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                          MS Word text boxes, memo cards, borders
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onMouseDown={handleButtonMouseDown}
                      onClick={() => setActivePopup('callout' as any)}
                      className="group flex items-start gap-3 p-2.5 rounded-xl hover:bg-white dark:hover:bg-slate-800 transition text-left cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700 shadow-xs hover:shadow-sm"
                    >
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                        <Lightbulb className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 flex items-center gap-1">
                          Callout / Alert Box
                        </span>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                          Notion-style tip, warning & target boxes
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onMouseDown={handleButtonMouseDown}
                      onClick={() => { setActivePopup(null); handleInsertCodeBlock(); }}
                      className="group flex items-start gap-3 p-2.5 rounded-xl hover:bg-white dark:hover:bg-slate-800 transition text-left cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700 shadow-xs hover:shadow-sm"
                    >
                      <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-500 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                        <CodeIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 flex items-center gap-1">
                          Code Snippet Block
                        </span>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                          Syntax highlighted dark code container
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onMouseDown={handleButtonMouseDown}
                      onClick={() => { setActivePopup(null); handleInsertToggle(); }}
                      className="group flex items-start gap-3 p-2.5 rounded-xl hover:bg-white dark:hover:bg-slate-800 transition text-left cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700 shadow-xs hover:shadow-sm"
                    >
                      <div className="w-8 h-8 rounded-lg bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                        <ChevronRight className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 flex items-center gap-1">
                          Collapsible Toggle
                        </span>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                          Expandable accordion for collapsible notes
                        </p>
                      </div>
                    </button>
                  </div>

                  {/* Category 3: Layout & Structure */}
                  <div className="bg-slate-50/70 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 flex flex-col gap-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 px-1">
                      <span>📐</span> Layout & Structure
                    </p>

                    <button
                      type="button"
                      onMouseDown={handleButtonMouseDown}
                      onClick={() => setActivePopup('columns')}
                      className="group flex items-start gap-3 p-2.5 rounded-xl hover:bg-white dark:hover:bg-slate-800 transition text-left cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700 shadow-xs hover:shadow-sm"
                    >
                      <div className="w-8 h-8 rounded-lg bg-violet-50 dark:bg-violet-950/40 text-violet-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                        <Columns2 className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-violet-600 dark:group-hover:text-violet-400 flex items-center gap-1">
                          Multi-Column Split
                        </span>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                          2-column or 3-column side-by-side layout
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onMouseDown={handleButtonMouseDown}
                      onClick={() => setActivePopup('divider')}
                      className="group flex items-start gap-3 p-2.5 rounded-xl hover:bg-white dark:hover:bg-slate-800 transition text-left cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700 shadow-xs hover:shadow-sm"
                    >
                      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                        <Minus className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 flex items-center gap-1">
                          Aesthetic Divider
                        </span>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                          Gradient lines, dots, stars separator
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onMouseDown={handleButtonMouseDown}
                      onClick={() => { setActivePopup(null); handleInsertPageBreak(); }}
                      className="group flex items-start gap-3 p-2.5 rounded-xl hover:bg-white dark:hover:bg-slate-800 transition text-left cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700 shadow-xs hover:shadow-sm"
                    >
                      <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-teal-600 dark:group-hover:text-teal-400 flex items-center gap-1">
                          A4 Page Break
                        </span>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                          Insert page separation (Ctrl+Enter)
                        </p>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      )}

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
                  onChange={(e) => setFindText(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:border-indigo-500 outline-none"
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
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:border-indigo-500 outline-none"
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

      <div className="note-editor-layout flex-1 flex flex-row overflow-hidden relative">
        
        {/* REDESIGNED LEFT SIDEBAR (with drag-to-resize support) */}
        {!focusMode && (
          <div 
            className="note-editor-sidebar hidden md:flex flex-col border-r border-slate-150 dark:border-slate-800 overflow-y-auto select-none bg-slate-50/60 dark:bg-slate-900/40 relative group/sidebar no-print"
            style={{ width: `${sidebarWidth}px` }}
          >
            {/* Note details card */}
            <div className="p-5 space-y-6">
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <FileText className="w-4 h-4" /> Note Details
                </h3>
                <div className="space-y-4 bg-[#fafbfc] dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-xs">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex justify-between">
                      <span>Title</span>
                      <span className="text-slate-400 font-normal">{title.length}/60</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Note Title"
                      maxLength={60}
                      value={title}
                      onChange={(e) => setTitle(e.target.value.slice(0, 60))}
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
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Notebook / Folder</label>
                    <div className="relative">
                      <FolderDropdown
                        value={folder}
                        onChange={(newFolder) => setFolder(newFolder)}
                        size="md"
                        align="left"
                        className="w-full"
                      />
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
                        className="group relative bg-[#fafbfc] dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-xl p-2 flex items-center gap-2.5 cursor-pointer hover:border-indigo-200 dark:hover:border-indigo-900 transition-all shadow-xs"
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
                          {file.type.startsWith('image/') && (
                            <button 
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                insertImageBase64(file.data, file.name); 
                              }} 
                              className="p-1 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 rounded-md text-indigo-600 dark:text-indigo-400 cursor-pointer"
                              title="Insert photo into note body"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          )}
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
                    <span className="text-slate-700 dark:text-slate-300 font-bold">{note && note.createdAt ? format(safeToDate(note.createdAt), 'MMM dd, yyyy') : 'Just now'}</span>
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

        {/* Content Pane with Eye-Care Paper Document Canvas */}
        <div className={`note-editor-content-pane flex-1 flex flex-col ${isA4Mode ? 'bg-[#cbd5e1] dark:bg-[#030712]' : 'bg-[#f2f4f7] dark:bg-[#0b0f19]'} overflow-hidden relative transition-colors`}>
          
          <div ref={scrollContainerRef} className="note-editor-scroll-container flex-1 overflow-y-auto no-scrollbar relative px-2 sm:px-4 md:px-8 py-3 md:py-6">
            
            {/* ✏️ Premium OneNote / Apple Notes Floating Inking Toolbar */}
            <AnimatePresence>
              {isInkingMode && (
                <motion.div
                  initial={{ opacity: 0, y: -20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.95 }}
                  className="glick-floating-inking-bar no-print sticky top-2 z-50 mx-auto w-fit max-w-[98%] mb-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-purple-300 dark:border-purple-800 shadow-2xl shadow-purple-500/15 rounded-2xl p-1 sm:p-1.5 flex flex-nowrap items-center gap-1 select-none overflow-x-auto no-scrollbar"
                >
                  {/* Tool Selector */}
                  <div className="flex items-center gap-0.5 sm:gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 sm:p-1 rounded-xl shrink-0">
                    {/* Select / Move / Resize Tool */}
                    <button
                      type="button"
                      onClick={() => { setInkTool('select'); setShowInkShapeMenu(false); }}
                      className={`px-2 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-bold transition cursor-pointer shrink-0 ${
                        inkTool === 'select'
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                      title="Select Tool (Click to select, drag to move, drag handles to resize)"
                    >
                      <MousePointer className="w-3.5 h-3.5 shrink-0" />
                      <span className="hidden sm:inline">Select</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => { setInkTool('pen'); setShowInkShapeMenu(false); }}
                      className={`px-2 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-bold transition cursor-pointer shrink-0 ${
                        inkTool === 'pen'
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                      title="Pen Tool (Crisp solid ink)"
                    >
                      <Pencil className="w-3.5 h-3.5 shrink-0" />
                      <span className="hidden sm:inline">Pen</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => { setInkTool('highlighter'); setShowInkShapeMenu(false); }}
                      className={`px-2 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-bold transition cursor-pointer shrink-0 ${
                        inkTool === 'highlighter'
                          ? 'bg-amber-400 text-slate-900 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                      title="Highlighter Tool (Fluorescent transparent highlight)"
                    >
                      <Highlighter className="w-3.5 h-3.5 shrink-0" />
                      <span className="hidden md:inline">Highlight</span>
                    </button>

                    {/* Text Tool */}
                    <button
                      type="button"
                      onClick={() => { setInkTool('text'); setShowInkShapeMenu(false); }}
                      className={`px-2 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-bold transition cursor-pointer shrink-0 ${
                        inkTool === 'text'
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                      title="Text Tool (Click anywhere on note to add editable text)"
                    >
                      <Type className="w-3.5 h-3.5 shrink-0" />
                      <span className="hidden sm:inline">Text</span>
                    </button>

                    {/* Categorized Shapes Dropdown Selector */}
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        onClick={() => setShowInkShapeMenu(prev => !prev)}
                        className={`px-2 py-1.5 rounded-lg flex items-center gap-1 text-xs font-bold transition cursor-pointer ${
                          isInkShapeTool(inkTool)
                            ? 'bg-purple-600 text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                        }`}
                        title="Draw Shapes (Lines, Arrows, Rectangles, Circle, Triangle, Star, Heart, Cloud, Speech Bubble)"
                      >
                        <Shapes className="w-3.5 h-3.5 shrink-0" />
                        <span className="hidden md:inline">
                          {inkTool === 'line' ? 'Line' :
                           inkTool === 'arrow' ? 'Arrow' :
                           inkTool === 'doubleArrow' ? '2-Way' :
                           inkTool === 'rect' ? 'Box' :
                           inkTool === 'roundedRect' ? 'Round' :
                           inkTool === 'circle' ? 'Circle' :
                           inkTool === 'triangle' ? 'Triangle' :
                           inkTool === 'diamond' ? 'Diamond' :
                           inkTool === 'parallelogram' ? 'Skew' :
                           inkTool === 'star' ? 'Star' :
                           inkTool === 'heart' ? 'Heart' :
                           inkTool === 'cloud' ? 'Cloud' :
                           inkTool === 'calloutRect' ? 'Callout' :
                           inkTool === 'calloutRounded' ? 'Cloud Callout' : 'Shapes'}
                        </span>
                        <ChevronDown className="w-3 h-3 opacity-70 shrink-0" />
                      </button>

                      {showInkShapeMenu && (
                        <div 
                          onPointerDown={(e) => e.stopPropagation()}
                          className="absolute top-full left-0 mt-2 p-2 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col gap-2 z-50 min-w-[210px] animate-in fade-in slide-in-from-top-1 duration-150 max-h-[380px] overflow-y-auto no-scrollbar"
                        >
                          {/* Lines & Arrows */}
                          <div>
                            <p className="px-2 py-0.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lines & Connectors</p>
                            <div className="flex flex-col gap-0.5 mt-0.5">
                              {[
                                { id: 'line', label: 'Line', icon: Minus },
                                { id: 'arrow', label: 'Single Arrow', icon: ArrowRight },
                                { id: 'doubleArrow', label: 'Double Arrow', icon: ArrowLeftRight },
                              ].map(sh => {
                                const IconComponent = sh.icon;
                                return (
                                  <button
                                    key={sh.id}
                                    type="button"
                                    onClick={() => {
                                      setInkTool(sh.id as InkToolType);
                                      setShowInkShapeMenu(false);
                                    }}
                                    className={`flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium rounded-lg text-left transition cursor-pointer ${
                                      inkTool === sh.id
                                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 font-bold'
                                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                                    }`}
                                  >
                                    <IconComponent className="w-3.5 h-3.5 shrink-0" />
                                    <span>{sh.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Basic Geometric */}
                          <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                            <p className="px-2 py-0.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Basic Shapes</p>
                            <div className="flex flex-col gap-0.5 mt-0.5">
                              {[
                                { id: 'rect', label: 'Rectangle', icon: Square },
                                { id: 'roundedRect', label: 'Rounded Box', icon: Square },
                                { id: 'circle', label: 'Circle / Oval', icon: Circle },
                                { id: 'triangle', label: 'Triangle', icon: Triangle },
                                { id: 'diamond', label: 'Diamond', icon: GitFork },
                                { id: 'parallelogram', label: 'Parallelogram', icon: Square },
                              ].map(sh => {
                                const IconComponent = sh.icon;
                                return (
                                  <button
                                    key={sh.id}
                                    type="button"
                                    onClick={() => {
                                      setInkTool(sh.id as InkToolType);
                                      setShowInkShapeMenu(false);
                                    }}
                                    className={`flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium rounded-lg text-left transition cursor-pointer ${
                                      inkTool === sh.id
                                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 font-bold'
                                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                                    }`}
                                  >
                                    <IconComponent className="w-3.5 h-3.5 shrink-0" />
                                    <span>{sh.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Badges & Callouts */}
                          <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                            <p className="px-2 py-0.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Symbols & Callouts</p>
                            <div className="flex flex-col gap-0.5 mt-0.5">
                              {[
                                { id: 'star', label: 'Star', icon: Star },
                                { id: 'heart', label: 'Heart', icon: Heart },
                                { id: 'cloud', label: 'Cloud', icon: Cloud },
                                { id: 'calloutRect', label: 'Square Callout', icon: MessageSquare },
                                { id: 'calloutRounded', label: 'Rounded Callout', icon: Cloud },
                              ].map(sh => {
                                const IconComponent = sh.icon;
                                return (
                                  <button
                                    key={sh.id}
                                    type="button"
                                    onClick={() => {
                                      setInkTool(sh.id as InkToolType);
                                      setShowInkShapeMenu(false);
                                    }}
                                    className={`flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium rounded-lg text-left transition cursor-pointer ${
                                      inkTool === sh.id
                                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 font-bold'
                                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                                    }`}
                                  >
                                    <IconComponent className="w-3.5 h-3.5 shrink-0" />
                                    <span>{sh.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Realistic Eraser Tool Button */}
                    <button
                      type="button"
                      onClick={() => { setInkTool('eraser'); setShowInkShapeMenu(false); }}
                      className={`px-2 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-bold transition cursor-pointer shrink-0 ${
                        inkTool === 'eraser'
                          ? 'bg-rose-500 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                      title="Realistic Eraser Tool (Touch any stroke or shape to erase with round ring cursor)"
                    >
                      <Eraser className="w-3.5 h-3.5 shrink-0" />
                      <span className="hidden sm:inline">Eraser</span>
                    </button>
                  </div>

                  {/* Realistic Eraser Size Selector */}
                  {inkTool === 'eraser' && (
                    <>
                      <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5 shrink-0" />
                      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0">
                        <span className="text-[10px] font-bold text-slate-500 uppercase px-1">Size</span>
                        {[
                          { label: 'S', size: 14, title: 'Small (14px)' },
                          { label: 'M', size: 28, title: 'Medium (28px)' },
                          { label: 'L', size: 50, title: 'Large (50px)' },
                          { label: 'XL', size: 80, title: 'Extra Large (80px)' }
                        ].map(s => (
                          <button
                            key={s.label}
                            type="button"
                            onClick={() => setEraserSize(s.size)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                              eraserSize === s.size
                                ? 'bg-rose-500 text-white shadow-xs'
                                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                            }`}
                            title={s.title}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  {/* Colors */}
                  {inkTool !== 'eraser' && (
                    <>
                      <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5 shrink-0" />
                      <div className="flex items-center gap-1 shrink-0">
                        {[
                          { name: 'Dark Slate', value: '#0f172a' },
                          { name: 'Indigo', value: '#6366f1' },
                          { name: 'Crimson', value: '#ef4444' },
                          { name: 'Emerald', value: '#10b981' },
                          { name: 'Amber', value: '#f59e0b' },
                          { name: 'Purple', value: '#8b5cf6' },
                          { name: 'Neon Yellow', value: '#fde047' },
                          { name: 'Pink', value: '#ec4899' },
                          { name: 'Sky Blue', value: '#0ea5e9' }
                        ].map(c => (
                          <button
                            key={c.value}
                            type="button"
                            onClick={() => {
                              setInkColor(c.value);
                              if (selectedInkStrokeId) {
                                setInkStrokes(prev => prev.map(s => s.id === selectedInkStrokeId ? { ...s, color: c.value } : s));
                                renderInkCanvas();
                              }
                            }}
                            className={`w-4.5 h-4.5 rounded-full border border-black/15 transition-transform hover:scale-125 cursor-pointer shrink-0 ${
                              inkColor === c.value ? 'ring-2 ring-purple-500 scale-110' : ''
                            }`}
                            style={{ backgroundColor: c.value }}
                            title={c.name}
                          />
                        ))}
                      </div>
                    </>
                  )}

                  {/* Stroke Width */}
                  {inkTool !== 'eraser' && (
                    <>
                      <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5 shrink-0" />
                      <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl shrink-0">
                        {[
                          { label: 'Fine', w: 2, dotClass: 'w-1 h-1' },
                          { label: 'Medium', w: 4, dotClass: 'w-2 h-2' },
                          { label: 'Bold', w: 7, dotClass: 'w-3 h-3' }
                        ].map(t => (
                          <button
                            key={t.w}
                            type="button"
                            onClick={() => {
                              setInkWidth(t.w);
                              if (selectedInkStrokeId) {
                                setInkStrokes(prev => prev.map(s => s.id === selectedInkStrokeId ? { ...s, width: t.w } : s));
                                renderInkCanvas();
                              }
                            }}
                            className={`w-6 h-6 flex items-center justify-center rounded-lg transition cursor-pointer shrink-0 ${
                              inkWidth === t.w
                                ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-xs'
                                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                            }`}
                            title={`${t.label} stroke thickness (${t.w}px)`}
                          >
                            <span className={`rounded-full bg-current ${t.dotClass}`} />
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  {/* Selected Shape Quick Action Bar */}
                  {selectedInkStrokeId && (
                    <>
                      <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5 shrink-0" />
                      <div className="flex items-center gap-1 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 p-1 rounded-xl shrink-0">
                        <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 px-1">Selected:</span>
                        <button
                          type="button"
                          onClick={() => {
                            const target = inkStrokes.find(s => s.id === selectedInkStrokeId);
                            if (target) {
                              const dup: InkStroke = {
                                ...JSON.parse(JSON.stringify(target)),
                                id: `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                                shapeStart: target.shapeStart ? { x: target.shapeStart.x + 24, y: target.shapeStart.y + 24 } : undefined,
                                shapeEnd: target.shapeEnd ? { x: target.shapeEnd.x + 24, y: target.shapeEnd.y + 24 } : undefined,
                                points: target.points.map(p => ({ x: p.x + 24, y: p.y + 24 }))
                              };
                              const nextStrokes = [...inkStrokes, dup];
                              setInkStrokes(nextStrokes);
                              setSelectedInkStrokeId(dup.id);
                              const nextHist = [...inkHistory.slice(0, inkHistoryIndex + 1), nextStrokes];
                              setInkHistory(nextHist);
                              setInkHistoryIndex(nextHist.length - 1);
                              renderInkCanvas();
                            }
                          }}
                          className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                          title="Duplicate shape (Ctrl+D)"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const nextStrokes = inkStrokes.filter(s => s.id !== selectedInkStrokeId);
                            setInkStrokes(nextStrokes);
                            setSelectedInkStrokeId(null);
                            const nextHist = [...inkHistory.slice(0, inkHistoryIndex + 1), nextStrokes];
                            setInkHistory(nextHist);
                            setInkHistoryIndex(nextHist.length - 1);
                            renderInkCanvas();
                          }}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
                          title="Delete shape"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedInkStrokeId(null);
                            renderInkCanvas();
                          }}
                          className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition cursor-pointer"
                          title="Deselect"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}

                  {/* Undo, Redo, Clear */}
                  <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5 shrink-0" />
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      disabled={inkHistoryIndex <= 0}
                      onClick={handleInkUndo}
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-30 transition cursor-pointer"
                      title="Undo stroke (Ctrl+Z)"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={inkHistoryIndex >= inkHistory.length - 1}
                      onClick={handleInkRedo}
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-30 transition cursor-pointer"
                      title="Redo stroke"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={handleInkClearAll}
                      className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-500 hover:text-rose-600 transition cursor-pointer"
                      title="Clear all ink"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Done Button */}
                  <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5 shrink-0" />
                  <button
                    type="button"
                    onClick={toggleInkingMode}
                    className="shrink-0 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-purple-500/20 transition cursor-pointer"
                    title="Done drawing - Return to text typing"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Done</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Eye-Care Warm Paper Document Sheet */}
            <div className={`note-paper-sheet ${isA4Mode ? 'a4-page-mode' : 'max-w-4xl mx-auto bg-[#fafbfc] dark:bg-[#111726] rounded-2xl md:rounded-3xl border border-slate-200/70 dark:border-slate-800/80 shadow-[0_2px_16px_rgba(15,23,42,0.03)] p-5 sm:p-8 md:p-12 min-h-[calc(100vh-140px)]'} transition-all`}>
              
              {/* Clean print title */}
              <h1 className="note-print-title hidden font-black text-3xl pb-2 mb-4 border-b-2 border-slate-300 text-slate-900">
                {title || 'Untitled Note'}
              </h1>

              {/* Inline Title input (Prominent on document sheet with max length limit) */}
              <div className="note-screen-title w-full pb-3 mb-4 border-b border-slate-200/60 dark:border-slate-800/80">
                <div className="flex items-center justify-between gap-3">
                  <input
                    type="text"
                    placeholder="Note title (auto-generated if empty)..."
                    maxLength={60}
                    value={title}
                    onChange={(e) => setTitle(e.target.value.slice(0, 60))}
                    className="w-full text-2xl md:text-3.5xl font-black bg-transparent border-none outline-none text-slate-850 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-700 tracking-tight"
                  />
                  {title.length > 35 && (
                    <span className="text-xs font-bold text-slate-400 dark:text-slate-500 shrink-0 select-none">
                      {title.length}/60
                    </span>
                  )}
                </div>
              </div>

              {/* Center Content Editor container */}
              <div className="w-full relative min-h-[500px]" ref={editorWrapperRef}>
                {/* Active Interactive Inking Canvas */}
                {isInkingMode && (
                  <>
                    <canvas
                      ref={inkCanvasRef}
                      className={`absolute top-0 left-0 z-30 touch-none select-none ${
                        inkTool === 'eraser' ? 'cursor-none' : inkTool === 'select' ? 'cursor-default' : 'cursor-crosshair'
                      }`}
                      style={{ background: 'transparent' }}
                      onPointerDown={handleInkPointerDown}
                      onPointerMove={handleInkPointerMove}
                      onPointerUp={handleInkPointerUp}
                      onPointerCancel={handleInkPointerUp}
                      onPointerLeave={() => setEraserCursorPos(null)}
                      onDoubleClick={(e) => {
                        const canvas = inkCanvasRef.current;
                        if (!canvas) return;
                        const rect = canvas.getBoundingClientRect();
                        const x = Math.round(e.clientX - rect.left);
                        const y = Math.round(e.clientY - rect.top);
                        const found = findStrokeAt(x, y);
                        if (found && found.tool === 'text') {
                          setSelectedInkStrokeId(found.id);
                          setInlineEditingInkTextId(found.id);
                        }
                      }}
                    />

                    {/* Realistic Circular Eraser Ring Overlay */}
                    {inkTool === 'eraser' && eraserCursorPos && (
                      <div
                        className="pointer-events-none absolute z-40 rounded-full border-2 border-rose-500 bg-rose-400/20 shadow-md backdrop-blur-[0.5px] -translate-x-1/2 -translate-y-1/2 transition-[width,height] duration-75"
                        style={{
                          left: `${eraserCursorPos.x}px`,
                          top: `${eraserCursorPos.y}px`,
                          width: `${eraserSize}px`,
                          height: `${eraserSize}px`,
                        }}
                      />
                    )}

                    {/* Inline Floating Text Area for Direct Text Writing */}
                    {inlineEditingInkTextId && (() => {
                      const stroke = inkStrokes.find(s => s.id === inlineEditingInkTextId);
                      if (!stroke) return null;
                      const bounds = getStrokeBounds(stroke);
                      return (
                        <div 
                          className="absolute z-40"
                          style={{ left: `${bounds.minX}px`, top: `${bounds.minY}px` }}
                        >
                          <textarea
                            autoFocus
                            value={stroke.text || ''}
                            placeholder="Type text..."
                            onChange={(e) => {
                              const val = e.target.value;
                              setInkStrokes(prev => prev.map(s => s.id === stroke.id ? { ...s, text: val } : s));
                            }}
                            onBlur={() => {
                              setInlineEditingInkTextId(null);
                              renderInkCanvas();
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape' || (e.key === 'Enter' && !e.shiftKey)) {
                                e.preventDefault();
                                setInlineEditingInkTextId(null);
                                renderInkCanvas();
                              }
                            }}
                            className="bg-white/95 dark:bg-slate-900/95 border-2 border-dashed border-purple-500 rounded-lg p-2 font-bold text-slate-900 dark:text-white shadow-xl outline-none resize-none"
                            style={{
                              fontSize: `${stroke.fontSize || 22}px`,
                              color: stroke.color,
                              minWidth: '180px',
                              minHeight: '44px',
                              fontFamily: `'Outfit', sans-serif`
                            }}
                          />
                        </div>
                      );
                    })()}
                  </>
                )}
                
                <div
                  ref={contentRef}
                  contentEditable={!isInkingMode}
                  onInput={handleInput}
                  onBlur={() => {
                    if (contentRef.current) {
                      upgradeLegacyBlocks(contentRef.current);
                    }
                  }}
                  onPaste={() => {
                    setTimeout(() => {
                      if (contentRef.current) {
                        upgradeLegacyBlocks(contentRef.current);
                        const html = contentRef.current.innerHTML;
                        latestContent.current = html;
                        setBody(html);
                        pushToHistory(html);
                      }
                    }, 50);
                  }}
                  onKeyDown={handleKeyDown}
                  onKeyUp={() => {
                    const sel = window.getSelection();
                    if (sel && sel.rangeCount > 0 && contentRef.current?.contains(sel.getRangeAt(0).commonAncestorContainer)) {
                      savedSelectionRef.current = sel.getRangeAt(0).cloneRange();
                    }
                    updateFormatState();
                  }}
                  onMouseUp={() => {
                    const sel = window.getSelection();
                    if (sel && sel.rangeCount > 0 && contentRef.current?.contains(sel.getRangeAt(0).commonAncestorContainer)) {
                      savedSelectionRef.current = sel.getRangeAt(0).cloneRange();
                    }
                    updateFormatState();
                  }}
                  onTouchEnd={() => {
                    const sel = window.getSelection();
                    if (sel && sel.rangeCount > 0 && contentRef.current?.contains(sel.getRangeAt(0).commonAncestorContainer)) {
                      savedSelectionRef.current = sel.getRangeAt(0).cloneRange();
                    }
                    updateFormatState();
                  }}
                  onClick={handleContentClick}
                  onMouseDown={handleEditorMouseDown}
                  onMouseMove={handleEditorMouseMove}
                  data-placeholder="Start writing your note..."
                  className={`editor-content flex-1 w-full bg-transparent border-none outline-none text-[17px] text-slate-750 dark:text-slate-250 leading-relaxed outline-transparent focus:ring-0 ${
                    FONT_OPTIONS.find(f => f.value === activeFont)?.class || 'font-outfit'
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
          </div>

          {/* Premium Bottom status bar */}
          <div className="w-full border-t border-slate-200/60 dark:border-slate-800/80 px-5 py-2.5 bg-[#f4f6fa]/80 dark:bg-slate-900/60 backdrop-blur flex justify-between items-center text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest select-none">
            <div className="flex items-center gap-4">
              <span>Chars: {charCount}</span>
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

      {/* 🤖 AI Assistant Drawer */}
      <AIAssistantDrawer
        isOpen={showAIDrawer}
        onClose={() => setShowAIDrawer(false)}
        noteTitle={title}
        noteText={(title ? title + '\n\n' : '') + extractTextFromHtml(body)}
        noteHtml={contentRef.current ? contentRef.current.innerHTML : body}
        selectedText={selectedTextForAI}
        selectedHtml={selectedHtmlForAI}
        onApplyTitle={(newTitle) => setTitle(newTitle)}
        onApplyTags={(newTags) => {
          const currentTagsList = tags ? tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean) : [];
          const merged = Array.from(new Set([...currentTagsList, ...newTags]));
          setTags(merged.join(', '));
        }}
        onInsertText={(text) => {
          if (contentRef.current) {
            const isHtml = /<[a-z][\s\S]*>/i.test(text);
            const formatted = isHtml ? text : text.replace(/\n/g, '<br/>');
            contentRef.current.innerHTML += formatted;
            upgradeLegacyBlocks(contentRef.current);
            const html = contentRef.current.innerHTML;
            latestContent.current = html;
            setBody(html);
            pushToHistory(html);
          }
        }}
        onReplaceSelection={(replacementHtml) => {
          if (!contentRef.current) return;
          contentRef.current.focus();
          if (savedSelectionRef.current) {
            restoreSelection(savedSelectionRef.current);
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0) {
              const range = sel.getRangeAt(0);
              range.deleteContents();
              const template = document.createElement('template');
              template.innerHTML = replacementHtml;
              const frag = template.content;
              const lastNode = frag.lastChild;
              range.insertNode(frag);
              if (lastNode) {
                const newRange = document.createRange();
                newRange.setStartAfter(lastNode);
                newRange.collapse(true);
                sel.removeAllRanges();
                sel.addRange(newRange);
                savedSelectionRef.current = newRange.cloneRange();
              }
            }
          } else {
            contentRef.current.innerHTML += replacementHtml;
          }
          upgradeLegacyBlocks(contentRef.current);
          const html = contentRef.current.innerHTML;
          latestContent.current = html;
          setBody(html);
          pushToHistory(html);
        }}
        onReplaceContent={(newHtml) => {
          if (contentRef.current) {
            contentRef.current.innerHTML = newHtml;
            upgradeLegacyBlocks(contentRef.current);
            const html = contentRef.current.innerHTML;
            latestContent.current = html;
            setBody(html);
            pushToHistory(html);
          }
        }}
      />

      {/* ⚡ Notion-Style Slash Command Menu */}
      <SlashCommandMenu
        isOpen={slashMenuOpen}
        position={slashMenuPos}
        query={slashQuery}
        onClose={() => setSlashMenuOpen(false)}
        onExecute={handleExecuteSlashCommand}
      />

      {/* 📤 Export & Share Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        noteTitle={title}
        noteHtml={body}
        noteText={extractTextFromHtml(body)}
        tags={tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : []}
        createdAt={lastSaved || new Date()}
      />

      {/* 🎙️ Voice Dictation Speech-to-Text Modal */}
      <VoiceDictationModal
        isOpen={showVoiceModal}
        onClose={() => setShowVoiceModal(false)}
        onApply={handleApplyVoiceText}
      />

      {/* 📊 Mermaid Diagram & Mindmap Modal */}
      <MermaidModal
        isOpen={showMermaidModal}
        onClose={() => {
          setShowMermaidModal(false);
          setEditingDiagramEl(null);
          setInitialDiagramCode('');
        }}
        onInsertDiagram={handleInsertDiagram}
        initialCode={initialDiagramCode}
        noteContext={body}
      />

      {/* ∑ LaTeX / Math Formula Modal */}
      <MathFormulaModal
        isOpen={showMathModal}
        onClose={() => {
          setShowMathModal(false);
          setEditingMathEl(null);
          setInitialMathLatex('');
        }}
        onInsertMath={handleInsertMath}
        initialLatex={initialMathLatex}
      />

      {/* 🎨 Google Docs style Drawing Modal */}
      <DrawingModal
        isOpen={showDrawingModal}
        onClose={() => {
          setShowDrawingModal(false);
          setEditingDrawingEl(null);
          setInitialDrawingData(undefined);
        }}
        onSaveDrawing={handleSaveDrawing}
        initialImageData={initialDrawingData}
      />

      {/* 🧘 Zen Mode Floating Exit Bar */}
      {zenMode && (
        <div className="fixed top-4 right-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <button
            onClick={() => setZenMode(false)}
            className="px-3.5 py-1.5 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white border border-slate-700/80 backdrop-blur-md text-xs font-bold flex items-center gap-1.5 shadow-xl transition-all cursor-pointer"
          >
            <Minimize2 className="w-3.5 h-3.5" />
            <span>Exit Zen Mode (Esc)</span>
          </button>
        </div>
      )}
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
