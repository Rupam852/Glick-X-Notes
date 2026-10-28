import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  X, Check, RotateCcw, RotateCw, Trash2, MousePointer, 
  Pencil, Highlighter, Minus, ArrowRight, Square, Circle, 
  Triangle, Star, MessageSquare, Type, Image as ImageIcon,
  Palette, Download, Sparkles, ChevronRight, ChevronDown,
  Layers, ArrowUp, ArrowDown, Move, Compass
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DrawingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveDrawing: (dataUrl: string) => void;
  initialImageData?: string;
}

export type ShapeType =
  // Basic Shapes
  | 'rect'
  | 'roundedRect'
  | 'circle'
  | 'triangle'
  | 'diamond'
  | 'parallelogram'
  | 'trapezoid'
  | 'pentagon'
  | 'hexagon'
  | 'octagon'
  | 'cube'
  | 'cylinder'
  | 'heart'
  | 'lightning'
  | 'sun'
  | 'moon'
  | 'cloud'
  | 'star'
  | 'smiley'
  // Arrows
  | 'arrowRight'
  | 'arrowLeft'
  | 'arrowUp'
  | 'arrowDown'
  | 'arrowLeftRight'
  | 'arrowUpDown'
  // Callouts
  | 'calloutRect'
  | 'calloutRounded'
  | 'starburst'
  | 'banner'
  // Equation
  | 'plus'
  | 'minus'
  | 'multiply'
  | 'divide'
  | 'equal'
  // Lines
  | 'line'
  | 'arrowLine'
  | 'doubleArrowLine';

export type ToolMode = 'select' | 'pen' | 'highlighter' | 'eraser' | 'text' | ShapeType;

export interface CanvasObject {
  id: string;
  type: ToolMode;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // degrees
  strokeColor: string;
  strokeWidth: number;
  fillColor: string;
  points?: { x: number; y: number }[]; // for freehand pen / highlighter
  text?: string;
  fontSize?: number;
  imageElement?: HTMLImageElement;
  imageSrc?: string;
}

type HandleType = 'tl' | 'tr' | 'br' | 'bl' | 'tc' | 'bc' | 'ml' | 'mr' | 'rot' | 'body';

const PRESET_COLORS = [
  '#000000', '#ffffff', '#4b5563', '#ef4444', '#f97316', 
  '#f59e0b', '#10b981', '#06b6d4', '#3b82f6', '#6366f1', 
  '#8b5cf6', '#ec4899'
];

export default function DrawingModal({
  isOpen,
  onClose,
  onSaveDrawing,
  initialImageData
}: DrawingModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Tools & Styling
  const [activeTool, setActiveTool] = useState<ToolMode>('select');
  const [strokeColor, setStrokeColor] = useState('#2563eb');
  const [fillColor, setFillColor] = useState('#dbeafe');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Menus
  const [showShapeMenu, setShowShapeMenu] = useState(false);
  const [activeShapeCategory, setActiveShapeCategory] = useState<'shapes' | 'arrows' | 'callouts' | 'equation' | 'lines'>('shapes');
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [showTextModal, setShowTextModal] = useState(false);
  const [pendingTextPos, setPendingTextPos] = useState<{ x: number; y: number } | null>(null);

  // Vector Objects List
  const [objects, setObjects] = useState<CanvasObject[]>([]);
  
  // Undo / Redo history stack (saving JSON snapshots of objects)
  const historyRef = useRef<CanvasObject[][]>([]);
  const historyIndexRef = useRef<number>(-1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Interaction State Refs
  const isInteractingRef = useRef(false);
  const dragModeRef = useRef<HandleType | 'draw' | null>(null);
  const dragStartMouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const initialObjectSnapshotRef = useRef<CanvasObject | null>(null);
  const activeDrawPointsRef = useRef<{ x: number; y: number }[]>([]);

  // Update history buttons state
  const updateHistoryState = () => {
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
  };

  const pushHistory = useCallback((newObjects: CanvasObject[]) => {
    const nextHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
    nextHistory.push(JSON.parse(JSON.stringify(newObjects)));
    if (nextHistory.length > 30) nextHistory.shift();
    historyRef.current = nextHistory;
    historyIndexRef.current = nextHistory.length - 1;
    updateHistoryState();
  }, []);

  const handleUndo = () => {
    if (historyIndexRef.current > 0) {
      const targetIndex = historyIndexRef.current - 1;
      const snapshot = historyRef.current[targetIndex];
      if (snapshot) {
        historyIndexRef.current = targetIndex;
        setObjects(JSON.parse(JSON.stringify(snapshot)));
        setSelectedId(null);
        updateHistoryState();
      }
    }
  };

  const handleRedo = () => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      const targetIndex = historyIndexRef.current + 1;
      const snapshot = historyRef.current[targetIndex];
      if (snapshot) {
        historyIndexRef.current = targetIndex;
        setObjects(JSON.parse(JSON.stringify(snapshot)));
        setSelectedId(null);
        updateHistoryState();
      }
    }
  };

  // Keyboard shortcut listener for Delete/Backspace, Escape, Undo, Redo
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showTextModal) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedId) {
          e.preventDefault();
          handleDeleteSelected();
        }
      } else if (e.key === 'Escape') {
        setSelectedId(null);
        setShowShapeMenu(false);
        setShowActionsMenu(false);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedId, showTextModal]);

  // Initial load: either image or empty canvas
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const rect = container.getBoundingClientRect();
      const w = Math.floor(rect.width) || 880;
      const h = Math.floor(rect.height) || 540;
      canvas.width = w;
      canvas.height = h;

      if (initialImageData) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const initObj: CanvasObject = {
            id: `img-${Date.now()}`,
            type: 'rect',
            x: Math.max(20, (w - img.width) / 2),
            y: Math.max(20, (h - img.height) / 2),
            width: Math.min(w - 40, img.width),
            height: Math.min(h - 40, img.height),
            rotation: 0,
            strokeColor: 'transparent',
            strokeWidth: 0,
            fillColor: 'transparent',
            imageElement: img,
            imageSrc: initialImageData
          };
          setObjects([initObj]);
          historyRef.current = [[initObj]];
          historyIndexRef.current = 0;
          updateHistoryState();
        };
        img.src = initialImageData;
      } else {
        setObjects([]);
        historyRef.current = [[]];
        historyIndexRef.current = 0;
        updateHistoryState();
      }
    }, 60);

    return () => clearTimeout(timer);
  }, [isOpen, initialImageData]);

  // Helper: Convert screen mouse coords to canvas coords
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return {
      x: Math.round(clientX - rect.left),
      y: Math.round(clientY - rect.top)
    };
  };

  // -------------------------------------------------------------
  // SHAPE GEOMETRY DRAWING FUNCTIONS
  // -------------------------------------------------------------
  const drawGeometry = (
    ctx: CanvasRenderingContext2D,
    type: ToolMode,
    w: number,
    h: number,
    fill: string,
    stroke: string,
    sWidth: number,
    obj?: CanvasObject
  ) => {
    ctx.lineWidth = sWidth;
    ctx.strokeStyle = stroke;
    ctx.fillStyle = fill;

    if (type === 'rect') {
      ctx.beginPath();
      ctx.rect(0, 0, w, h);
      if (fill !== 'transparent') ctx.fill();
      if (sWidth > 0 && stroke !== 'transparent') ctx.stroke();
      if (obj?.imageElement) {
        ctx.drawImage(obj.imageElement, 0, 0, w, h);
      }
    } else if (type === 'roundedRect') {
      ctx.beginPath();
      const r = Math.min(18, w / 4, h / 4);
      ctx.roundRect(0, 0, w, h, Math.max(0, r));
      if (fill !== 'transparent') ctx.fill();
      if (sWidth > 0 && stroke !== 'transparent') ctx.stroke();
    } else if (type === 'circle') {
      ctx.beginPath();
      ctx.ellipse(w / 2, h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
      if (fill !== 'transparent') ctx.fill();
      if (sWidth > 0 && stroke !== 'transparent') ctx.stroke();
    } else if (type === 'triangle') {
      ctx.beginPath();
      ctx.moveTo(w / 2, 0);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      if (fill !== 'transparent') ctx.fill();
      if (sWidth > 0 && stroke !== 'transparent') ctx.stroke();
    } else if (type === 'diamond') {
      ctx.beginPath();
      ctx.moveTo(w / 2, 0);
      ctx.lineTo(w, h / 2);
      ctx.lineTo(w / 2, h);
      ctx.lineTo(0, h / 2);
      ctx.closePath();
      if (fill !== 'transparent') ctx.fill();
      if (sWidth > 0 && stroke !== 'transparent') ctx.stroke();
    } else if (type === 'parallelogram') {
      ctx.beginPath();
      ctx.moveTo(w * 0.25, 0);
      ctx.lineTo(w, 0);
      ctx.lineTo(w * 0.75, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      if (fill !== 'transparent') ctx.fill();
      if (sWidth > 0 && stroke !== 'transparent') ctx.stroke();
    } else if (type === 'trapezoid') {
      ctx.beginPath();
      ctx.moveTo(w * 0.2, 0);
      ctx.lineTo(w * 0.8, 0);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      if (fill !== 'transparent') ctx.fill();
      if (sWidth > 0 && stroke !== 'transparent') ctx.stroke();
    } else if (type === 'pentagon') {
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = (i * 2 * Math.PI) / 5 - Math.PI / 2;
        const px = w / 2 + (w / 2) * Math.cos(a);
        const py = h / 2 + (h / 2) * Math.sin(a);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      if (fill !== 'transparent') ctx.fill();
      if (sWidth > 0 && stroke !== 'transparent') ctx.stroke();
    } else if (type === 'hexagon') {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i * 2 * Math.PI) / 6;
        const px = w / 2 + (w / 2) * Math.cos(a);
        const py = h / 2 + (h / 2) * Math.sin(a);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      if (fill !== 'transparent') ctx.fill();
      if (sWidth > 0 && stroke !== 'transparent') ctx.stroke();
    } else if (type === 'octagon') {
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i * 2 * Math.PI) / 8 + Math.PI / 8;
        const px = w / 2 + (w / 2) * Math.cos(a);
        const py = h / 2 + (h / 2) * Math.sin(a);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      if (fill !== 'transparent') ctx.fill();
      if (sWidth > 0 && stroke !== 'transparent') ctx.stroke();
    } else if (type === 'star') {
      ctx.beginPath();
      const points = 5;
      const outerR = Math.min(w, h) / 2;
      const innerR = outerR * 0.42;
      for (let i = 0; i < points * 2; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const a = (i * Math.PI) / points - Math.PI / 2;
        const px = w / 2 + r * Math.cos(a);
        const py = h / 2 + r * Math.sin(a);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      if (fill !== 'transparent') ctx.fill();
      if (sWidth > 0 && stroke !== 'transparent') ctx.stroke();
    } else if (type === 'heart') {
      ctx.beginPath();
      const topH = h * 0.3;
      ctx.moveTo(w / 2, h * 0.2);
      ctx.bezierCurveTo(w / 2, 0, 0, 0, 0, topH);
      ctx.bezierCurveTo(0, h * 0.6, w / 2, h * 0.82, w / 2, h);
      ctx.bezierCurveTo(w / 2, h * 0.82, w, h * 0.6, w, topH);
      ctx.bezierCurveTo(w, 0, w / 2, 0, w / 2, h * 0.2);
      ctx.closePath();
      if (fill !== 'transparent') ctx.fill();
      if (sWidth > 0 && stroke !== 'transparent') ctx.stroke();
    } else if (type === 'cloud') {
      ctx.beginPath();
      ctx.moveTo(w * 0.2, h * 0.7);
      ctx.bezierCurveTo(0, h * 0.7, 0, h * 0.4, w * 0.25, h * 0.4);
      ctx.bezierCurveTo(w * 0.25, h * 0.1, w * 0.55, h * 0.1, w * 0.55, h * 0.35);
      ctx.bezierCurveTo(w * 0.65, h * 0.2, w * 0.9, h * 0.25, w * 0.9, h * 0.45);
      ctx.bezierCurveTo(w, h * 0.5, w, h * 0.7, w * 0.8, h * 0.7);
      ctx.closePath();
      if (fill !== 'transparent') ctx.fill();
      if (sWidth > 0 && stroke !== 'transparent') ctx.stroke();
    } else if (type === 'lightning') {
      ctx.beginPath();
      ctx.moveTo(w * 0.55, 0);
      ctx.lineTo(w * 0.15, h * 0.55);
      ctx.lineTo(w * 0.45, h * 0.55);
      ctx.lineTo(w * 0.35, h);
      ctx.lineTo(w * 0.85, h * 0.45);
      ctx.lineTo(w * 0.55, h * 0.45);
      ctx.closePath();
      if (fill !== 'transparent') ctx.fill();
      if (sWidth > 0 && stroke !== 'transparent') ctx.stroke();
    } else if (type === 'cube') {
      const d = Math.min(w, h) * 0.25;
      ctx.beginPath();
      ctx.rect(0, d, w - d, h - d);
      if (fill !== 'transparent') ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, d);
      ctx.lineTo(d, 0);
      ctx.lineTo(w, 0);
      ctx.lineTo(w - d, d);
      ctx.closePath();
      if (fill !== 'transparent') ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(w - d, d);
      ctx.lineTo(w, 0);
      ctx.lineTo(w, h - d);
      ctx.lineTo(w - d, h);
      ctx.closePath();
      if (fill !== 'transparent') ctx.fill();
      ctx.stroke();
    } else if (type === 'cylinder') {
      const rh = Math.min(h * 0.2, 22);
      ctx.beginPath();
      ctx.ellipse(w / 2, rh, w / 2, rh, 0, 0, Math.PI * 2);
      if (fill !== 'transparent') ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, rh);
      ctx.lineTo(0, h - rh);
      ctx.ellipse(w / 2, h - rh, w / 2, rh, 0, 0, Math.PI);
      ctx.lineTo(w, rh);
      if (fill !== 'transparent') ctx.fill();
      ctx.stroke();
    } else if (type === 'smiley') {
      ctx.beginPath();
      ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      if (fill !== 'transparent') ctx.fill();
      ctx.stroke();

      const eyeR = Math.max(2, Math.min(w, h) * 0.05);
      ctx.fillStyle = stroke;
      ctx.beginPath();
      ctx.arc(w * 0.35, h * 0.38, eyeR, 0, Math.PI * 2);
      ctx.arc(w * 0.65, h * 0.38, eyeR, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(w / 2, h * 0.5, Math.min(w, h) * 0.28, 0.2 * Math.PI, 0.8 * Math.PI);
      ctx.stroke();
    } else if (type === 'arrowRight') {
      ctx.beginPath();
      ctx.moveTo(0, h * 0.3);
      ctx.lineTo(w * 0.6, h * 0.3);
      ctx.lineTo(w * 0.6, 0);
      ctx.lineTo(w, h * 0.5);
      ctx.lineTo(w * 0.6, h);
      ctx.lineTo(w * 0.6, h * 0.7);
      ctx.lineTo(0, h * 0.7);
      ctx.closePath();
      if (fill !== 'transparent') ctx.fill();
      if (sWidth > 0 && stroke !== 'transparent') ctx.stroke();
    } else if (type === 'arrowLeft') {
      ctx.beginPath();
      ctx.moveTo(w, h * 0.3);
      ctx.lineTo(w * 0.4, h * 0.3);
      ctx.lineTo(w * 0.4, 0);
      ctx.lineTo(0, h * 0.5);
      ctx.lineTo(w * 0.4, h);
      ctx.lineTo(w * 0.4, h * 0.7);
      ctx.lineTo(w, h * 0.7);
      ctx.closePath();
      if (fill !== 'transparent') ctx.fill();
      if (sWidth > 0 && stroke !== 'transparent') ctx.stroke();
    } else if (type === 'arrowUp') {
      ctx.beginPath();
      ctx.moveTo(w * 0.5, 0);
      ctx.lineTo(w, h * 0.4);
      ctx.lineTo(w * 0.7, h * 0.4);
      ctx.lineTo(w * 0.7, h);
      ctx.lineTo(w * 0.3, h);
      ctx.lineTo(w * 0.3, h * 0.4);
      ctx.lineTo(0, h * 0.4);
      ctx.closePath();
      if (fill !== 'transparent') ctx.fill();
      if (sWidth > 0 && stroke !== 'transparent') ctx.stroke();
    } else if (type === 'arrowDown') {
      ctx.beginPath();
      ctx.moveTo(w * 0.3, 0);
      ctx.lineTo(w * 0.7, 0);
      ctx.lineTo(w * 0.7, h * 0.6);
      ctx.lineTo(w, h * 0.6);
      ctx.lineTo(w * 0.5, h);
      ctx.lineTo(0, h * 0.6);
      ctx.lineTo(w * 0.3, h * 0.6);
      ctx.closePath();
      if (fill !== 'transparent') ctx.fill();
      if (sWidth > 0 && stroke !== 'transparent') ctx.stroke();
    } else if (type === 'arrowLeftRight') {
      ctx.beginPath();
      ctx.moveTo(0, h * 0.5);
      ctx.lineTo(w * 0.25, 0);
      ctx.lineTo(w * 0.25, h * 0.3);
      ctx.lineTo(w * 0.75, h * 0.3);
      ctx.lineTo(w * 0.75, 0);
      ctx.lineTo(w, h * 0.5);
      ctx.lineTo(w * 0.75, h);
      ctx.lineTo(w * 0.75, h * 0.7);
      ctx.lineTo(w * 0.25, h * 0.7);
      ctx.lineTo(w * 0.25, h);
      ctx.closePath();
      if (fill !== 'transparent') ctx.fill();
      if (sWidth > 0 && stroke !== 'transparent') ctx.stroke();
    } else if (type === 'calloutRect' || type === 'calloutRounded') {
      ctx.beginPath();
      const bH = h * 0.8;
      const rad = type === 'calloutRounded' ? Math.min(14, w / 4, bH / 4) : 0;
      ctx.moveTo(rad, 0);
      ctx.lineTo(w - rad, 0);
      if (rad) ctx.quadraticCurveTo(w, 0, w, rad);
      ctx.lineTo(w, bH - rad);
      if (rad) ctx.quadraticCurveTo(w, bH, w - rad, bH);
      ctx.lineTo(w * 0.4, bH);
      ctx.lineTo(w * 0.18, h);
      ctx.lineTo(w * 0.25, bH);
      ctx.lineTo(rad, bH);
      if (rad) ctx.quadraticCurveTo(0, bH, 0, bH - rad);
      ctx.lineTo(0, rad);
      if (rad) ctx.quadraticCurveTo(0, 0, rad, 0);
      ctx.closePath();
      if (fill !== 'transparent') ctx.fill();
      if (sWidth > 0 && stroke !== 'transparent') ctx.stroke();
    } else if (type === 'starburst') {
      ctx.beginPath();
      const pts = 12;
      const outR = Math.min(w, h) / 2;
      const inR = outR * 0.75;
      for (let i = 0; i < pts * 2; i++) {
        const r = i % 2 === 0 ? outR : inR;
        const a = (i * Math.PI) / pts;
        const px = w / 2 + r * Math.cos(a);
        const py = h / 2 + r * Math.sin(a);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      if (fill !== 'transparent') ctx.fill();
      if (sWidth > 0 && stroke !== 'transparent') ctx.stroke();
    } else if (type === 'plus') {
      const bar = Math.min(w, h) * 0.3;
      ctx.beginPath();
      ctx.moveTo((w - bar) / 2, 0);
      ctx.lineTo((w + bar) / 2, 0);
      ctx.lineTo((w + bar) / 2, (h - bar) / 2);
      ctx.lineTo(w, (h - bar) / 2);
      ctx.lineTo(w, (h + bar) / 2);
      ctx.lineTo((w + bar) / 2, (h + bar) / 2);
      ctx.lineTo((w + bar) / 2, h);
      ctx.lineTo((w - bar) / 2, h);
      ctx.lineTo((w - bar) / 2, (h + bar) / 2);
      ctx.lineTo(0, (h + bar) / 2);
      ctx.lineTo(0, (h - bar) / 2);
      ctx.lineTo((w - bar) / 2, (h - bar) / 2);
      ctx.closePath();
      if (fill !== 'transparent') ctx.fill();
      if (sWidth > 0 && stroke !== 'transparent') ctx.stroke();
    } else if (type === 'line' || type === 'arrowLine' || type === 'doubleArrowLine') {
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();

      if (type === 'arrowLine' || type === 'doubleArrowLine') {
        ctx.beginPath();
        ctx.moveTo(w - 14, h / 2 - 8);
        ctx.lineTo(w, h / 2);
        ctx.lineTo(w - 14, h / 2 + 8);
        ctx.stroke();
      }
      if (type === 'doubleArrowLine') {
        ctx.beginPath();
        ctx.moveTo(14, h / 2 - 8);
        ctx.lineTo(0, h / 2);
        ctx.lineTo(14, h / 2 + 8);
        ctx.stroke();
      }
    } else if (type === 'pen' || type === 'highlighter') {
      if (obj?.points && obj.points.length > 0) {
        ctx.beginPath();
        ctx.moveTo(obj.points[0].x, obj.points[0].y);
        for (let i = 1; i < obj.points.length; i++) {
          ctx.lineTo(obj.points[i].x, obj.points[i].y);
        }
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
      }
    } else if (type === 'text') {
      ctx.fillStyle = stroke;
      ctx.font = `bold ${obj?.fontSize || 20}px Outfit, sans-serif`;
      ctx.textBaseline = 'top';
      ctx.fillText(obj?.text || 'Text', 0, 0);
    }
  };

  // -------------------------------------------------------------
  // MASTER RENDER LOOP
  // -------------------------------------------------------------
  const renderAll = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw all objects in order
    objects.forEach(obj => {
      ctx.save();
      // Alpha for highlighter
      if (obj.type === 'highlighter') ctx.globalAlpha = 0.45;
      else ctx.globalAlpha = 1.0;

      if (obj.type === 'pen' || obj.type === 'highlighter') {
        // Freehand objects have absolute points
        drawGeometry(ctx, obj.type, obj.width, obj.height, obj.fillColor, obj.strokeColor, obj.strokeWidth, obj);
      } else {
        const cx = obj.x + obj.width / 2;
        const cy = obj.y + obj.height / 2;
        ctx.translate(cx, cy);
        ctx.rotate((obj.rotation * Math.PI) / 180);
        ctx.translate(-obj.width / 2, -obj.height / 2);

        drawGeometry(ctx, obj.type, obj.width, obj.height, obj.fillColor, obj.strokeColor, obj.strokeWidth, obj);
      }
      ctx.restore();
    });

    // Draw Selection Bounding Box & Handles for Selected Object
    const selObj = objects.find(o => o.id === selectedId);
    if (selObj && selObj.type !== 'pen' && selObj.type !== 'highlighter') {
      const cx = selObj.x + selObj.width / 2;
      const cy = selObj.y + selObj.height / 2;
      const w = selObj.width;
      const h = selObj.height;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((selObj.rotation * Math.PI) / 180);
      ctx.translate(-w / 2, -h / 2);

      // Bounding box border
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(0, 0, w, h);
      ctx.setLineDash([]);

      // 8 Resize Handles (Blue squares)
      const handles: { x: number; y: number }[] = [
        { x: 0, y: 0 }, // tl
        { x: w / 2, y: 0 }, // tc
        { x: w, y: 0 }, // tr
        { x: w, y: h / 2 }, // mr
        { x: w, y: h }, // br
        { x: w / 2, y: h }, // bc
        { x: 0, y: h }, // bl
        { x: 0, y: h / 2 } // ml
      ];

      handles.forEach(hnd => {
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 2;
        ctx.fillRect(hnd.x - 4.5, hnd.y - 4.5, 9, 9);
        ctx.strokeRect(hnd.x - 4.5, hnd.y - 4.5, 9, 9);
      });

      // Rotation stem & circle handle
      ctx.beginPath();
      ctx.moveTo(w / 2, 0);
      ctx.lineTo(w / 2, -22);
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(w / 2, -22, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#38bdf8';
      ctx.fill();
      ctx.strokeStyle = '#2563eb';
      ctx.stroke();

      ctx.restore();
    }
  }, [objects, selectedId]);

  useEffect(() => {
    renderAll();
  }, [renderAll]);

  // -------------------------------------------------------------
  // HIT TESTING (Local Coordinate Transformation)
  // -------------------------------------------------------------
  const getHitHandle = (obj: CanvasObject, px: number, py: number): HandleType | null => {
    const cx = obj.x + obj.width / 2;
    const cy = obj.y + obj.height / 2;
    const rad = (-obj.rotation * Math.PI) / 180;

    // Un-rotate point to shape's local coordinate space
    const dx = px - cx;
    const dy = py - cy;
    const lx = dx * Math.cos(rad) - dy * Math.sin(rad) + obj.width / 2;
    const ly = dx * Math.sin(rad) + dy * Math.cos(rad) + obj.height / 2;

    const w = obj.width;
    const h = obj.height;
    const tol = 8; // handle click radius tolerance

    // Check Rotation Handle
    if (Math.hypot(lx - w / 2, ly - (-22)) <= 10) return 'rot';

    // Check 8 Resize Handles
    if (Math.hypot(lx - 0, ly - 0) <= tol) return 'tl';
    if (Math.hypot(lx - w, ly - 0) <= tol) return 'tr';
    if (Math.hypot(lx - w, ly - h) <= tol) return 'br';
    if (Math.hypot(lx - 0, ly - h) <= tol) return 'bl';
    if (Math.hypot(lx - w / 2, ly - 0) <= tol) return 'tc';
    if (Math.hypot(lx - w / 2, ly - h) <= tol) return 'bc';
    if (Math.hypot(lx - 0, ly - h / 2) <= tol) return 'ml';
    if (Math.hypot(lx - w, ly - h / 2) <= tol) return 'mr';

    // Check inside body
    if (lx >= -tol && lx <= w + tol && ly >= -tol && ly <= h + tol) {
      return 'body';
    }

    return null;
  };

  // Find topmost hit object under cursor
  const findTopObjectAt = (px: number, py: number): { obj: CanvasObject; handle: HandleType } | null => {
    for (let i = objects.length - 1; i >= 0; i--) {
      const obj = objects[i];
      if (obj.type === 'pen' || obj.type === 'highlighter') {
        // Test distance to points
        if (obj.points) {
          const hit = obj.points.some(pt => Math.hypot(pt.x - px, pt.y - py) <= (obj.strokeWidth + 6));
          if (hit) return { obj, handle: 'body' };
        }
      } else {
        const handle = getHitHandle(obj, px, py);
        if (handle) return { obj, handle };
      }
    }
    return null;
  };

  // -------------------------------------------------------------
  // MOUSE / TOUCH EVENT HANDLERS
  // -------------------------------------------------------------
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasCoords(e);
    isInteractingRef.current = true;
    dragStartMouseRef.current = { x, y };

    // 1. Text Tool Click
    if (activeTool === 'text') {
      setPendingTextPos({ x, y });
      setTextInput('');
      setShowTextModal(true);
      isInteractingRef.current = false;
      return;
    }

    // 2. Eraser Mode
    if (activeTool === 'eraser') {
      const hit = findTopObjectAt(x, y);
      if (hit) {
        const nextObjs = objects.filter(o => o.id !== hit.obj.id);
        setObjects(nextObjs);
        if (selectedId === hit.obj.id) setSelectedId(null);
        pushHistory(nextObjs);
      }
      isInteractingRef.current = false;
      return;
    }

    // 3. Freehand Pen / Highlighter Drawing
    if (activeTool === 'pen' || activeTool === 'highlighter') {
      dragModeRef.current = 'draw';
      activeDrawPointsRef.current = [{ x, y }];
      const newObj: CanvasObject = {
        id: `stroke-${Date.now()}`,
        type: activeTool,
        x,
        y,
        width: 0,
        height: 0,
        rotation: 0,
        strokeColor,
        strokeWidth,
        fillColor: 'transparent',
        points: [{ x, y }]
      };
      setObjects(prev => [...prev, newObj]);
      return;
    }

    // 4. Shape Insertion Drag Mode
    if (activeTool !== 'select') {
      dragModeRef.current = 'draw';
      const newShape: CanvasObject = {
        id: `shape-${Date.now()}`,
        type: activeTool,
        x,
        y,
        width: 1,
        height: 1,
        rotation: 0,
        strokeColor,
        strokeWidth,
        fillColor
      };
      initialObjectSnapshotRef.current = newShape;
      setObjects(prev => [...prev, newShape]);
      setSelectedId(newShape.id);
      return;
    }

    // 5. Select Mode: Handle Selection, Move, Resize, Rotate
    if (selectedId) {
      const currentSelected = objects.find(o => o.id === selectedId);
      if (currentSelected) {
        const handle = getHitHandle(currentSelected, x, y);
        if (handle) {
          dragModeRef.current = handle;
          initialObjectSnapshotRef.current = JSON.parse(JSON.stringify(currentSelected));
          return;
        }
      }
    }

    // Check hit on any other object
    const hit = findTopObjectAt(x, y);
    if (hit) {
      setSelectedId(hit.obj.id);
      dragModeRef.current = hit.handle;
      initialObjectSnapshotRef.current = JSON.parse(JSON.stringify(hit.obj));
    } else {
      setSelectedId(null);
      dragModeRef.current = null;
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isInteractingRef.current) return;
    const { x, y } = getCanvasCoords(e);
    const startX = dragStartMouseRef.current.x;
    const startY = dragStartMouseRef.current.y;
    const dx = x - startX;
    const dy = y - startY;

    // A. Freehand Drawing
    if (dragModeRef.current === 'draw' && (activeTool === 'pen' || activeTool === 'highlighter')) {
      activeDrawPointsRef.current.push({ x, y });
      setObjects(prev => {
        if (prev.length === 0) return prev;
        const lastIdx = prev.length - 1;
        const lastObj = { ...prev[lastIdx], points: [...activeDrawPointsRef.current] };
        const next = [...prev];
        next[lastIdx] = lastObj;
        return next;
      });
      return;
    }

    // B. Drawing New Vector Shape
    if (dragModeRef.current === 'draw' && activeTool !== 'select') {
      const snap = initialObjectSnapshotRef.current;
      if (!snap) return;

      const newX = dx >= 0 ? snap.x : snap.x + dx;
      const newY = dy >= 0 ? snap.y : snap.y + dy;
      const newW = Math.max(10, Math.abs(dx));
      const newH = Math.max(10, Math.abs(dy));

      setObjects(prev => {
        if (prev.length === 0) return prev;
        const lastIdx = prev.length - 1;
        const updated = { ...prev[lastIdx], x: newX, y: newY, width: newW, height: newH };
        const next = [...prev];
        next[lastIdx] = updated;
        return next;
      });
      return;
    }

    // C. Transforming Existing Selected Object
    const snap = initialObjectSnapshotRef.current;
    if (!selectedId || !snap || !dragModeRef.current) return;

    if (dragModeRef.current === 'body') {
      // Move Object
      setObjects(prev => prev.map(o => o.id === selectedId ? { ...o, x: snap.x + dx, y: snap.y + dy } : o));
    } else if (dragModeRef.current === 'rot') {
      // Rotate Object
      const cx = snap.x + snap.width / 2;
      const cy = snap.y + snap.height / 2;
      const angleRad = Math.atan2(y - cy, x - cx);
      let angleDeg = Math.round((angleRad * 180) / Math.PI + 90);
      setObjects(prev => prev.map(o => o.id === selectedId ? { ...o, rotation: angleDeg } : o));
    } else {
      // Resize Object
      const handle = dragModeRef.current;
      let newW = snap.width;
      let newH = snap.height;
      let newX = snap.x;
      let newY = snap.y;

      if (handle.includes('r')) newW = Math.max(15, snap.width + dx);
      if (handle.includes('b')) newH = Math.max(15, snap.height + dy);
      if (handle.includes('l')) {
        const potentialW = snap.width - dx;
        if (potentialW >= 15) {
          newW = potentialW;
          newX = snap.x + dx;
        }
      }
      if (handle.includes('t')) {
        const potentialH = snap.height - dy;
        if (potentialH >= 15) {
          newH = potentialH;
          newY = snap.y + dy;
        }
      }

      setObjects(prev => prev.map(o => o.id === selectedId ? {
        ...o,
        x: newX,
        y: newY,
        width: newW,
        height: newH
      } : o));
    }
  };

  const handleMouseUp = () => {
    if (!isInteractingRef.current) return;
    isInteractingRef.current = false;

    // If we were drawing a shape, switch back to 'select' mode so user can immediately resize/rotate!
    if (dragModeRef.current === 'draw' && activeTool !== 'pen' && activeTool !== 'highlighter') {
      setActiveTool('select');
    }

    dragModeRef.current = null;
    initialObjectSnapshotRef.current = null;
    activeDrawPointsRef.current = [];
    pushHistory(objects);
  };

  // -------------------------------------------------------------
  // TOOLBAR ACTION HANDLERS
  // -------------------------------------------------------------
  const handleDeleteSelected = () => {
    if (!selectedId) return;
    const nextObjs = objects.filter(o => o.id !== selectedId);
    setObjects(nextObjs);
    setSelectedId(null);
    pushHistory(nextObjs);
  };

  const handleBringToFront = () => {
    if (!selectedId) return;
    const sel = objects.find(o => o.id === selectedId);
    if (!sel) return;
    const nextObjs = [...objects.filter(o => o.id !== selectedId), sel];
    setObjects(nextObjs);
    pushHistory(nextObjs);
  };

  const handleSendToBack = () => {
    if (!selectedId) return;
    const sel = objects.find(o => o.id === selectedId);
    if (!sel) return;
    const nextObjs = [sel, ...objects.filter(o => o.id !== selectedId)];
    setObjects(nextObjs);
    pushHistory(nextObjs);
  };

  const handleRotate90 = () => {
    if (!selectedId) return;
    const nextObjs = objects.map(o => o.id === selectedId ? { ...o, rotation: (o.rotation + 90) % 360 } : o);
    setObjects(nextObjs);
    pushHistory(nextObjs);
  };

  const handleClearAll = () => {
    setObjects([]);
    setSelectedId(null);
    pushHistory([]);
  };

  // Color changes immediately update selected shape
  const handleSelectStrokeColor = (c: string) => {
    setStrokeColor(c);
    if (selectedId) {
      const nextObjs = objects.map(o => o.id === selectedId ? { ...o, strokeColor: c } : o);
      setObjects(nextObjs);
      pushHistory(nextObjs);
    }
  };

  const handleSelectFillColor = (c: string) => {
    setFillColor(c);
    if (selectedId) {
      const nextObjs = objects.map(o => o.id === selectedId ? { ...o, fillColor: c } : o);
      setObjects(nextObjs);
      pushHistory(nextObjs);
    }
  };

  const handleSelectStrokeWidth = (w: number) => {
    setStrokeWidth(w);
    if (selectedId) {
      const nextObjs = objects.map(o => o.id === selectedId ? { ...o, strokeWidth: w } : o);
      setObjects(nextObjs);
      pushHistory(nextObjs);
    }
  };

  // Image Upload onto canvas
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        const maxW = canvas ? canvas.width * 0.7 : 400;
        const scale = Math.min(1, maxW / img.width);
        const w = img.width * scale;
        const h = img.height * scale;
        const newObj: CanvasObject = {
          id: `img-${Date.now()}`,
          type: 'rect',
          x: canvas ? (canvas.width - w) / 2 : 50,
          y: canvas ? (canvas.height - h) / 2 : 50,
          width: w,
          height: h,
          rotation: 0,
          strokeColor: 'transparent',
          strokeWidth: 0,
          fillColor: 'transparent',
          imageElement: img,
          imageSrc: src
        };
        const next = [...objects, newObj];
        setObjects(next);
        setSelectedId(newObj.id);
        setActiveTool('select');
        pushHistory(next);
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  // Text submit
  const handleConfirmText = () => {
    if (!textInput.trim() || !pendingTextPos) {
      setShowTextModal(false);
      return;
    }
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const fSize = 22;
    let textW = 100;
    if (ctx) {
      ctx.font = `bold ${fSize}px Outfit, sans-serif`;
      textW = Math.max(40, ctx.measureText(textInput).width + 10);
    }

    const newObj: CanvasObject = {
      id: `text-${Date.now()}`,
      type: 'text',
      x: pendingTextPos.x,
      y: pendingTextPos.y,
      width: textW,
      height: fSize * 1.4,
      rotation: 0,
      strokeColor,
      strokeWidth: 1,
      fillColor: 'transparent',
      text: textInput,
      fontSize: fSize
    };
    const next = [...objects, newObj];
    setObjects(next);
    setSelectedId(newObj.id);
    setActiveTool('select');
    setShowTextModal(false);
    pushHistory(next);
  };

  // "Save and close": Export to PNG data URL
  const handleSaveAndClose = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Temporarily deselect so bounding box isn't exported into note
    setSelectedId(null);
    renderAll();

    setTimeout(() => {
      const dataUrl = canvas.toDataURL('image/png');
      onSaveDrawing(dataUrl);
      onClose();
    }, 50);
  };

  if (!isOpen) return null;

  // Selected object info
  const selectedObj = objects.find(o => o.id === selectedId);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-5xl h-[92vh] max-h-[820px] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
        
        {/* Top Header (Google Docs style) */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <span className="text-xl">🎨</span>
              <span>Drawing</span>
            </h2>
            <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
              Google Docs Vector Canvas • Click any shape to resize, rotate & edit
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveAndClose}
              className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-indigo-500/20 flex items-center gap-1.5 transition cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Save and close</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-700 transition"
              title="Close without saving"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar Bar */}
        <div className="flex items-center gap-1 px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 overflow-x-auto no-scrollbar shrink-0 text-slate-700 dark:text-slate-200 text-xs">
          
          {/* Actions Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowActionsMenu(prev => !prev)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition"
            >
              <span>Actions</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {showActionsMenu && (
              <div className="absolute left-0 mt-1 top-full w-48 z-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1.5 shadow-2xl space-y-1">
                <button
                  type="button"
                  disabled={!selectedId}
                  onClick={() => { handleRotate90(); setShowActionsMenu(false); }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-xs font-semibold disabled:opacity-40"
                >
                  <RotateCw className="w-4 h-4 text-indigo-500" />
                  <span>Rotate 90° Clockwise</span>
                </button>
                <button
                  type="button"
                  disabled={!selectedId}
                  onClick={() => { handleBringToFront(); setShowActionsMenu(false); }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-xs font-semibold disabled:opacity-40"
                >
                  <ArrowUp className="w-4 h-4 text-emerald-500" />
                  <span>Bring to Front</span>
                </button>
                <button
                  type="button"
                  disabled={!selectedId}
                  onClick={() => { handleSendToBack(); setShowActionsMenu(false); }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-xs font-semibold disabled:opacity-40"
                >
                  <ArrowDown className="w-4 h-4 text-amber-500" />
                  <span>Send to Back</span>
                </button>
                <div className="border-t border-slate-100 dark:border-slate-800 my-1" />
                <button
                  type="button"
                  disabled={!selectedId}
                  onClick={() => { handleDeleteSelected(); setShowActionsMenu(false); }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-rose-50 text-rose-600 text-xs font-semibold disabled:opacity-40"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Selected (Del)</span>
                </button>
                <button
                  type="button"
                  onClick={() => { handleClearAll(); setShowActionsMenu(false); }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-rose-50 text-rose-600 text-xs font-semibold"
                >
                  <X className="w-4 h-4" />
                  <span>Clear Entire Canvas</span>
                </button>
              </div>
            )}
          </div>

          <div className="w-px h-5 bg-slate-200 dark:bg-slate-800 mx-1 shrink-0" />

          {/* Undo / Redo */}
          <button
            type="button"
            disabled={!canUndo}
            onClick={handleUndo}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition"
            title="Undo (Ctrl+Z)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={!canRedo}
            onClick={handleRedo}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition"
            title="Redo (Ctrl+Y)"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          <div className="w-px h-5 bg-slate-200 dark:bg-slate-800 mx-1 shrink-0" />

          {/* Select / Arrow Tool */}
          <button
            type="button"
            onClick={() => setActiveTool('select')}
            className={`p-1.5 px-2 rounded-xl flex items-center gap-1 font-semibold transition ${activeTool === 'select' ? 'bg-indigo-600 text-white shadow-xs' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
            title="Select tool: Click shape to move, resize, rotate"
          >
            <MousePointer className="w-4 h-4" />
            <span className="hidden sm:inline">Select</span>
          </button>

          {/* Freehand Pen */}
          <button
            type="button"
            onClick={() => { setActiveTool('pen'); setSelectedId(null); }}
            className={`p-1.5 px-2 rounded-xl flex items-center gap-1 font-semibold transition ${activeTool === 'pen' ? 'bg-indigo-600 text-white shadow-xs' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
            title="Pen (Freehand sketch)"
          >
            <Pencil className="w-4 h-4" />
            <span className="hidden sm:inline">Pen</span>
          </button>

          {/* Highlighter */}
          <button
            type="button"
            onClick={() => { setActiveTool('highlighter'); setSelectedId(null); }}
            className={`p-1.5 px-2 rounded-xl flex items-center gap-1 font-semibold transition ${activeTool === 'highlighter' ? 'bg-amber-500 text-white shadow-xs' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
            title="Highlighter (Semi-transparent)"
          >
            <Highlighter className="w-4 h-4" />
          </button>

          {/* Eraser */}
          <button
            type="button"
            onClick={() => { setActiveTool('eraser'); setSelectedId(null); }}
            className={`p-1.5 px-2 rounded-xl flex items-center gap-1 font-semibold transition ${activeTool === 'eraser' ? 'bg-rose-600 text-white shadow-xs' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
            title="Eraser: Click on any shape to delete it"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <div className="w-px h-5 bg-slate-200 dark:bg-slate-800 mx-1 shrink-0" />

          {/* ----------------------------------------------------------- */}
          {/* GOOGLE DOCS STYLE SHAPES DROPDOWN MENU                      */}
          {/* ----------------------------------------------------------- */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowShapeMenu(prev => !prev)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border font-semibold transition ${showShapeMenu || activeTool !== 'select' && activeTool !== 'pen' && activeTool !== 'highlighter' && activeTool !== 'eraser' && activeTool !== 'text' ? 'bg-indigo-50 border-indigo-300 text-indigo-600 dark:bg-indigo-950/40 dark:border-indigo-700' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            >
              <Square className="w-4 h-4 text-indigo-500" />
              <span>Shapes</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-60" />
            </button>

            {showShapeMenu && (
              <div className="absolute left-0 mt-1 top-full z-50 flex bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-1.5">
                {/* Left Category Menu */}
                <div className="w-36 space-y-0.5 border-r border-slate-100 dark:border-slate-800 pr-1">
                  {[
                    { id: 'shapes', label: 'Shapes', icon: <Square className="w-3.5 h-3.5 text-indigo-500" /> },
                    { id: 'arrows', label: 'Arrows', icon: <ArrowRight className="w-3.5 h-3.5 text-blue-500" /> },
                    { id: 'callouts', label: 'Callouts', icon: <MessageSquare className="w-3.5 h-3.5 text-emerald-500" /> },
                    { id: 'equation', label: 'Equation', icon: <span className="font-bold text-xs">➗</span> },
                    { id: 'lines', label: 'Lines', icon: <Minus className="w-3.5 h-3.5 text-slate-500" /> }
                  ].map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onMouseEnter={() => setActiveShapeCategory(cat.id as any)}
                      onClick={() => setActiveShapeCategory(cat.id as any)}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${activeShapeCategory === cat.id ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
                    >
                      <div className="flex items-center gap-2">
                        {cat.icon}
                        <span>{cat.label}</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 opacity-50" />
                    </button>
                  ))}
                </div>

                {/* Right Shape Grid (Google Docs Shape Matrix) */}
                <div className="p-2 w-64 max-h-72 overflow-y-auto">
                  {activeShapeCategory === 'shapes' && (
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Geometric Shapes</p>
                      <div className="grid grid-cols-4 gap-1.5">
                        {[
                          { type: 'rect', label: 'Rectangle', icon: '▭' },
                          { type: 'roundedRect', label: 'Rounded Rect', icon: '▢' },
                          { type: 'circle', label: 'Oval / Circle', icon: '◯' },
                          { type: 'triangle', label: 'Triangle', icon: '△' },
                          { type: 'diamond', label: 'Diamond', icon: '◇' },
                          { type: 'parallelogram', label: 'Parallelogram', icon: '▱' },
                          { type: 'trapezoid', label: 'Trapezoid', icon: '⏢' },
                          { type: 'pentagon', label: 'Pentagon', icon: '⬟' },
                          { type: 'hexagon', label: 'Hexagon', icon: '⬡' },
                          { type: 'octagon', label: 'Octagon', icon: '🛑' },
                          { type: 'cube', label: '3D Cube', icon: '🧊' },
                          { type: 'cylinder', label: 'Cylinder', icon: '🥫' },
                          { type: 'heart', label: 'Heart', icon: '♥' },
                          { type: 'lightning', label: 'Lightning', icon: '⚡' },
                          { type: 'cloud', label: 'Cloud', icon: '☁' },
                          { type: 'star', label: '5-Star', icon: '★' },
                          { type: 'smiley', label: 'Smiley Face', icon: '☺' }
                        ].map(sh => (
                          <button
                            key={sh.type}
                            type="button"
                            onClick={() => {
                              setActiveTool(sh.type as ShapeType);
                              setShowShapeMenu(false);
                            }}
                            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:border-indigo-300 flex flex-col items-center justify-center transition cursor-pointer"
                            title={sh.label}
                          >
                            <span className="text-base font-bold">{sh.icon}</span>
                            <span className="text-[9px] truncate max-w-full text-slate-500 mt-0.5">{sh.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeShapeCategory === 'arrows' && (
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Block Arrows</p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { type: 'arrowRight', label: 'Right Arrow', icon: '➔' },
                          { type: 'arrowLeft', label: 'Left Arrow', icon: '⬅' },
                          { type: 'arrowUp', label: 'Up Arrow', icon: '⬆' },
                          { type: 'arrowDown', label: 'Down Arrow', icon: '⬇' },
                          { type: 'arrowLeftRight', label: 'Left-Right', icon: '⬄' }
                        ].map(sh => (
                          <button
                            key={sh.type}
                            type="button"
                            onClick={() => {
                              setActiveTool(sh.type as ShapeType);
                              setShowShapeMenu(false);
                            }}
                            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:border-indigo-300 flex flex-col items-center justify-center transition cursor-pointer"
                            title={sh.label}
                          >
                            <span className="text-lg font-bold">{sh.icon}</span>
                            <span className="text-[9px] truncate max-w-full text-slate-500 mt-0.5">{sh.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeShapeCategory === 'callouts' && (
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Callout Bubbles</p>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { type: 'calloutRect', label: 'Square Callout', icon: '💬' },
                          { type: 'calloutRounded', label: 'Rounded Callout', icon: '💭' },
                          { type: 'starburst', label: 'Explosion / Starburst', icon: '💥' }
                        ].map(sh => (
                          <button
                            key={sh.type}
                            type="button"
                            onClick={() => {
                              setActiveTool(sh.type as ShapeType);
                              setShowShapeMenu(false);
                            }}
                            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:border-indigo-300 flex flex-col items-center justify-center transition cursor-pointer"
                            title={sh.label}
                          >
                            <span className="text-xl">{sh.icon}</span>
                            <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300 mt-1">{sh.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeShapeCategory === 'equation' && (
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Equation Symbols</p>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { type: 'plus', label: 'Plus (+)', icon: '➕' },
                          { type: 'rect', label: 'Minus (−)', icon: '➖' },
                          { type: 'star', label: 'Multiply (✕)', icon: '✖' }
                        ].map(sh => (
                          <button
                            key={sh.type}
                            type="button"
                            onClick={() => {
                              setActiveTool(sh.type as ShapeType);
                              setShowShapeMenu(false);
                            }}
                            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 flex flex-col items-center justify-center transition cursor-pointer"
                          >
                            <span className="text-lg">{sh.icon}</span>
                            <span className="text-[10px] text-slate-500 mt-0.5">{sh.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeShapeCategory === 'lines' && (
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Connectors & Lines</p>
                      <div className="space-y-1.5">
                        {[
                          { type: 'line', label: 'Straight Line', icon: <Minus className="w-4 h-4" /> },
                          { type: 'arrowLine', label: 'Arrow Line', icon: <ArrowRight className="w-4 h-4" /> },
                          { type: 'doubleArrowLine', label: 'Double Arrow Line', icon: <span className="font-bold">⟷</span> }
                        ].map(sh => (
                          <button
                            key={sh.type}
                            type="button"
                            onClick={() => {
                              setActiveTool(sh.type as ShapeType);
                              setShowShapeMenu(false);
                            }}
                            className="w-full flex items-center gap-2 p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-xs font-semibold cursor-pointer"
                          >
                            {sh.icon}
                            <span>{sh.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Text Tool */}
          <button
            type="button"
            onClick={() => setActiveTool('text')}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border font-semibold transition ${activeTool === 'text' ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            title="Text Tool: Click anywhere on canvas to type"
          >
            <Type className="w-4 h-4" />
            <span className="hidden sm:inline">Text</span>
          </button>

          {/* Image Upload */}
          <label className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold transition cursor-pointer">
            <ImageIcon className="w-4 h-4 text-emerald-500" />
            <span className="hidden sm:inline">Image</span>
            <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
          </label>

          <div className="w-px h-5 bg-slate-200 dark:bg-slate-800 mx-1 shrink-0" />

          {/* Fill Color Picker */}
          <div className="flex items-center gap-1 pl-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fill:</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleSelectFillColor('transparent')}
                className={`w-5 h-5 rounded-md border text-[9px] font-bold flex items-center justify-center ${fillColor === 'transparent' ? 'ring-2 ring-indigo-500 border-indigo-500' : 'border-slate-300'}`}
                title="Transparent Fill"
              >
                ⊘
              </button>
              {PRESET_COLORS.slice(0, 6).map(c => (
                <button
                  key={`fill-${c}`}
                  type="button"
                  onClick={() => handleSelectFillColor(c)}
                  className={`w-5 h-5 rounded-md border border-black/15 transition-transform hover:scale-110 cursor-pointer ${fillColor === c ? 'ring-2 ring-indigo-500 scale-105' : ''}`}
                  style={{ backgroundColor: c }}
                  title={`Fill: ${c}`}
                />
              ))}
            </div>
          </div>

          {/* Border / Stroke Color Picker */}
          <div className="flex items-center gap-1 pl-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Border:</span>
            <div className="flex items-center gap-1">
              {PRESET_COLORS.slice(0, 6).map(c => (
                <button
                  key={`stroke-${c}`}
                  type="button"
                  onClick={() => handleSelectStrokeColor(c)}
                  className={`w-5 h-5 rounded-full border border-black/15 transition-transform hover:scale-110 cursor-pointer ${strokeColor === c ? 'ring-2 ring-indigo-500 scale-105' : ''}`}
                  style={{ backgroundColor: c }}
                  title={`Border Color: ${c}`}
                />
              ))}
            </div>
          </div>

          {/* Stroke Width Selector */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl ml-2">
            {[1, 3, 6, 10].map(w => (
              <button
                key={w}
                type="button"
                onClick={() => handleSelectStrokeWidth(w)}
                className={`w-6 h-6 rounded-lg flex items-center justify-center transition ${strokeWidth === w ? 'bg-white dark:bg-slate-700 shadow-xs' : 'hover:bg-white/40'}`}
                title={`${w}px line thickness`}
              >
                <div
                  className="rounded-full bg-slate-700 dark:bg-slate-200"
                  style={{ width: `${Math.min(14, w * 2.2 + 2)}px`, height: `${Math.min(14, w * 2.2 + 2)}px` }}
                />
              </button>
            ))}
          </div>

          {/* Selected Shape Quick Action Bar */}
          {selectedId && (
            <div className="flex items-center gap-1 pl-2 border-l border-indigo-200 dark:border-indigo-800 ml-2 animate-in fade-in duration-150">
              <button
                type="button"
                onClick={handleRotate90}
                className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 hover:bg-indigo-100 transition"
                title="Rotate 90° Clockwise"
              >
                <RotateCw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleDeleteSelected}
                className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition"
                title="Delete Selected Shape (Del)"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Checkerboard Canvas Workspace */}
        <div 
          ref={containerRef}
          className="flex-1 relative overflow-hidden flex items-center justify-center select-none"
          style={{
            backgroundColor: '#f8fafc',
            backgroundImage: `
              linear-gradient(45deg, #e2e8f0 25%, transparent 25%), 
              linear-gradient(-45deg, #e2e8f0 25%, transparent 25%), 
              linear-gradient(45deg, transparent 75%, #e2e8f0 75%), 
              linear-gradient(-45deg, transparent 75%, #e2e8f0 75%)
            `,
            backgroundSize: '24px 24px',
            backgroundPosition: '0 0, 0 12px, 12px -12px, -12px 0px'
          }}
        >
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onTouchStart={handleMouseDown}
            onTouchMove={handleMouseMove}
            onTouchEnd={handleMouseUp}
            className={`shadow-xl bg-white/70 backdrop-blur-xs rounded-xl ${activeTool === 'select' ? 'cursor-default' : 'cursor-crosshair'}`}
            style={{ touchAction: 'none' }}
          />

          {/* Floating Canvas Helper Pill */}
          <div className="absolute bottom-3 left-4 bg-slate-900/80 backdrop-blur-md text-white text-[11px] font-medium px-3 py-1.5 rounded-full shadow-lg pointer-events-none flex items-center gap-2">
            <Compass className="w-3.5 h-3.5 text-indigo-400" />
            <span>
              {activeTool === 'select'
                ? selectedId 
                  ? '🎯 Shape selected: Drag center to move, drag corners to resize, drag top handle to rotate!'
                  : '👆 Click any shape to select, move, resize or rotate'
                : `✏️ Drawing mode: Drag to draw ${activeTool}`}
            </span>
          </div>
        </div>

        {/* Text Input Modal */}
        {showTextModal && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-3">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Type className="w-4 h-4 text-indigo-600" />
                <span>Insert Text on Canvas</span>
              </h3>
              <input
                type="text"
                autoFocus
                placeholder="Type word or label..."
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleConfirmText();
                  if (e.key === 'Escape') setShowTextModal(false);
                }}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTextModal(false)}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmText}
                  className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20"
                >
                  Insert Text
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
