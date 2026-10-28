import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  X, Check, RotateCcw, RotateCw, Trash2, MousePointer, 
  Pencil, Highlighter, Minus, ArrowRight, Square, Circle, 
  Triangle, Star, MessageSquare, Type, Image as ImageIcon,
  Palette, Download, Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DrawingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveDrawing: (dataUrl: string) => void;
  initialImageData?: string;
}

type ToolMode = 
  | 'select' 
  | 'pen' 
  | 'highlighter' 
  | 'line' 
  | 'arrow' 
  | 'rect' 
  | 'circle' 
  | 'triangle' 
  | 'star' 
  | 'callout' 
  | 'text' 
  | 'eraser';

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

  const [activeTool, setActiveTool] = useState<ToolMode>('pen');
  const [strokeColor, setStrokeColor] = useState('#6366f1');
  const [fillColor, setFillColor] = useState('transparent');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [showShapeMenu, setShowShapeMenu] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [textPos, setTextPos] = useState<{ x: number; y: number } | null>(null);

  // Undo / Redo history stack (storing canvas ImageData)
  const historyRef = useRef<ImageData[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Drawing state refs
  const isDrawingRef = useRef(false);
  const startPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const snapshotRef = useRef<ImageData | null>(null);

  const updateHistoryButtons = () => {
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
  };

  const pushHistory = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
    newHistory.push(imgData);
    if (newHistory.length > 30) newHistory.shift();

    historyRef.current = newHistory;
    historyIndexRef.current = newHistory.length - 1;
    updateHistoryButtons();
  }, []);

  const restoreHistory = (index: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const item = historyRef.current[index];
    if (item) {
      ctx.putImageData(item, 0, 0);
      historyIndexRef.current = index;
      updateHistoryButtons();
    }
  };

  const handleUndo = () => {
    if (historyIndexRef.current > 0) {
      restoreHistory(historyIndexRef.current - 1);
    }
  };

  const handleRedo = () => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      restoreHistory(historyIndexRef.current + 1);
    }
  };

  // Canvas Initialization & Sizing
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const rect = container.getBoundingClientRect();
      const width = Math.floor(rect.width) || 860;
      const height = Math.floor(rect.height) || 540;

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);

      // Load initial image if editing existing drawing
      if (initialImageData) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          ctx.drawImage(img, 0, 0);
          pushHistory();
        };
        img.src = initialImageData;
      } else {
        pushHistory();
      }
    }, 80);

    return () => clearTimeout(timer);
  }, [isOpen, initialImageData, pushHistory]);

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

  // --- DRAWING ACTIONS ---
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCanvasCoords(e);
    isDrawingRef.current = true;
    startPosRef.current = { x, y };

    // Save snapshot for shapes preview
    snapshotRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);

    if (activeTool === 'pen' || activeTool === 'highlighter' || activeTool === 'eraser') {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (activeTool === 'highlighter') {
        ctx.strokeStyle = strokeColor + '66'; // semi-transparent
        ctx.lineWidth = strokeWidth * 3.5;
        ctx.globalCompositeOperation = 'source-over';
      } else if (activeTool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = strokeWidth * 4;
      } else {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        ctx.globalCompositeOperation = 'source-over';
      }
    } else if (activeTool === 'text') {
      isDrawingRef.current = false;
      setTextPos({ x, y });
    }
  };

  const drawMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCanvasCoords(e);
    const startX = startPosRef.current.x;
    const startY = startPosRef.current.y;

    if (activeTool === 'pen' || activeTool === 'highlighter' || activeTool === 'eraser') {
      ctx.lineTo(x, y);
      ctx.stroke();
    } else {
      // Shape / Line / Arrow preview: restore snapshot first
      if (snapshotRef.current) {
        ctx.putImageData(snapshotRef.current, 0, 0);
      }
      ctx.beginPath();
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = strokeColor;
      ctx.fillStyle = fillColor;
      ctx.lineWidth = strokeWidth;

      if (activeTool === 'line') {
        ctx.moveTo(startX, startY);
        ctx.lineTo(x, y);
        ctx.stroke();
      } else if (activeTool === 'arrow') {
        drawArrow(ctx, startX, startY, x, y, strokeWidth);
      } else if (activeTool === 'rect') {
        const w = x - startX;
        const h = y - startY;
        if (fillColor !== 'transparent') ctx.fillRect(startX, startY, w, h);
        ctx.strokeRect(startX, startY, w, h);
      } else if (activeTool === 'circle') {
        const radius = Math.sqrt(Math.pow(x - startX, 2) + Math.pow(y - startY, 2));
        ctx.arc(startX, startY, radius, 0, Math.PI * 2);
        if (fillColor !== 'transparent') ctx.fill();
        ctx.stroke();
      } else if (activeTool === 'triangle') {
        ctx.moveTo(startX + (x - startX) / 2, startY);
        ctx.lineTo(startX, y);
        ctx.lineTo(x, y);
        ctx.closePath();
        if (fillColor !== 'transparent') ctx.fill();
        ctx.stroke();
      } else if (activeTool === 'star') {
        drawStar(ctx, startX, startY, 5, Math.abs(x - startX), Math.abs(x - startX) / 2);
        if (fillColor !== 'transparent') ctx.fill();
        ctx.stroke();
      } else if (activeTool === 'callout') {
        drawCallout(ctx, startX, startY, x - startX, y - startY);
        if (fillColor !== 'transparent') ctx.fill();
        ctx.stroke();
      }
    }
  };

  const endDrawing = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.globalCompositeOperation = 'source-over';
    }
    pushHistory();
  };

  // Helper: Draw Arrowhead
  const drawArrow = (ctx: CanvasRenderingContext2D, fromX: number, fromY: number, toX: number, toY: number, width: number) => {
    const headLength = Math.max(14, width * 3.5);
    const angle = Math.atan2(toY - fromY, toX - fromX);
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headLength * Math.cos(angle - Math.PI / 6), toY - headLength * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(toX - headLength * Math.cos(angle + Math.PI / 6), toY - headLength * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fillStyle = strokeColor;
    ctx.fill();
  };

  // Helper: Draw Star
  const drawStar = (ctx: CanvasRenderingContext2D, cx: number, cy: number, spikes: number, outerR: number, innerR: number) => {
    let rot = Math.PI / 2 * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerR);
    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerR;
      y = cy + Math.sin(rot) * outerR;
      ctx.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerR;
      y = cy + Math.sin(rot) * innerR;
      ctx.lineTo(x, y);
      rot += step;
    }
    ctx.lineTo(cx, cy - outerR);
    ctx.closePath();
  };

  // Helper: Draw Speech Bubble / Callout
  const drawCallout = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
    const r = 12;
    const absW = Math.abs(w);
    const absH = Math.abs(h);
    const minX = Math.min(x, x + w);
    const minY = Math.min(y, y + h);

    ctx.beginPath();
    ctx.moveTo(minX + r, minY);
    ctx.lineTo(minX + absW - r, minY);
    ctx.quadraticCurveTo(minX + absW, minY, minX + absW, minY + r);
    ctx.lineTo(minX + absW, minY + absH * 0.75 - r);
    ctx.quadraticCurveTo(minX + absW, minY + absH * 0.75, minX + absW - r, minY + absH * 0.75);
    ctx.lineTo(minX + absW * 0.45, minY + absH * 0.75);
    ctx.lineTo(minX + absW * 0.25, minY + absH);
    ctx.lineTo(minX + absW * 0.3, minY + absH * 0.75);
    ctx.lineTo(minX + r, minY + absH * 0.75);
    ctx.quadraticCurveTo(minX, minY + absH * 0.75, minX, minY + absH * 0.75 - r);
    ctx.lineTo(minX, minY + r);
    ctx.quadraticCurveTo(minX, minY, minX + r, minY);
    ctx.closePath();
  };

  // Insert Text to Canvas
  const handleApplyText = () => {
    if (!textInput.trim() || !textPos) {
      setTextPos(null);
      setTextInput('');
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.font = `bold ${strokeWidth * 6 + 12}px 'Outfit', sans-serif`;
    ctx.fillStyle = strokeColor;
    ctx.fillText(textInput, textPos.x, textPos.y);

    setTextPos(null);
    setTextInput('');
    pushHistory();
  };

  // Clear Canvas
  const handleClearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pushHistory();
  };

  // Image Upload onto Canvas (Annotate over photo)
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Scale image to fit within canvas nicely
        const scale = Math.min((canvas.width * 0.8) / img.width, (canvas.height * 0.8) / img.height, 1);
        const w = img.width * scale;
        const h = img.height * scale;
        const x = (canvas.width - w) / 2;
        const y = (canvas.height - h) / 2;

        ctx.drawImage(img, x, y, w, h);
        pushHistory();
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Save and Close Handler
  const handleSaveAndClose = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Export with transparent background
    const dataUrl = canvas.toDataURL('image/png');
    onSaveDrawing(dataUrl);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-200">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col w-full max-w-5xl h-[88vh] overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200/80 dark:border-slate-800 bg-[#f8fafc] dark:bg-[#0b0f19]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-600/10 text-indigo-600 dark:bg-indigo-400/10 dark:text-indigo-400 flex items-center justify-center font-bold">
                <Palette className="w-4.5 h-4.5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-850 dark:text-white">Drawing Canvas</h3>
                <p className="text-[10px] text-slate-400 font-medium">Google Docs style vector & sketch board</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveAndClose}
                className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Save and close</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Google Docs Style Floating Ribbon Toolbar */}
          <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111726] flex items-center gap-1.5 flex-wrap overflow-x-auto no-scrollbar">
            {/* Undo / Redo */}
            <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
              <button
                type="button"
                onClick={handleUndo}
                disabled={!canUndo}
                className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 disabled:opacity-30 hover:bg-white dark:hover:bg-slate-700 transition cursor-pointer"
                title="Undo (Ctrl+Z)"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={!canRedo}
                className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 disabled:opacity-30 hover:bg-white dark:hover:bg-slate-700 transition cursor-pointer"
                title="Redo (Ctrl+Y)"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </div>

            <div className="w-px h-5 bg-slate-250 dark:bg-slate-800 mx-1 shrink-0" />

            {/* Drawing Tools */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
              <button
                type="button"
                onClick={() => setActiveTool('pen')}
                className={`p-1.5 rounded-lg transition ${activeTool === 'pen' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:bg-white/50'}`}
                title="Pen / Pencil Tool"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setActiveTool('highlighter')}
                className={`p-1.5 rounded-lg transition ${activeTool === 'highlighter' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:bg-white/50'}`}
                title="Highlighter Marker"
              >
                <Highlighter className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setActiveTool('eraser')}
                className={`p-1.5 rounded-lg transition ${activeTool === 'eraser' ? 'bg-white dark:bg-slate-700 text-rose-600 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:bg-white/50'}`}
                title="Eraser"
              >
                <Minus className="w-4 h-4" />
              </button>
            </div>

            <div className="w-px h-5 bg-slate-250 dark:bg-slate-800 mx-1 shrink-0" />

            {/* Lines & Shapes Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowShapeMenu(prev => !prev)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition text-xs font-semibold ${['line', 'arrow', 'rect', 'circle', 'triangle', 'star', 'callout'].includes(activeTool) ? 'bg-indigo-50 border-indigo-300 text-indigo-600 dark:bg-indigo-950/40 dark:border-indigo-700' : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              >
                {activeTool === 'line' && <Minus className="w-4 h-4" />}
                {activeTool === 'arrow' && <ArrowRight className="w-4 h-4" />}
                {activeTool === 'rect' && <Square className="w-4 h-4" />}
                {activeTool === 'circle' && <Circle className="w-4 h-4" />}
                {activeTool === 'triangle' && <Triangle className="w-4 h-4" />}
                {activeTool === 'star' && <Star className="w-4 h-4" />}
                {activeTool === 'callout' && <MessageSquare className="w-4 h-4" />}
                {!['line', 'arrow', 'rect', 'circle', 'triangle', 'star', 'callout'].includes(activeTool) && <Square className="w-4 h-4 text-slate-500" />}
                <span>Shapes</span>
              </button>

              {showShapeMenu && (
                <div className="absolute left-0 mt-2 top-full w-52 z-30 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2 shadow-2xl space-y-1">
                  {[
                    { mode: 'line', label: 'Straight Line', icon: <Minus className="w-4 h-4" /> },
                    { mode: 'arrow', label: 'Arrow Line', icon: <ArrowRight className="w-4 h-4" /> },
                    { mode: 'rect', label: 'Rectangle / Box', icon: <Square className="w-4 h-4" /> },
                    { mode: 'circle', label: 'Circle / Oval', icon: <Circle className="w-4 h-4" /> },
                    { mode: 'triangle', label: 'Triangle', icon: <Triangle className="w-4 h-4" /> },
                    { mode: 'star', label: '5-Point Star', icon: <Star className="w-4 h-4" /> },
                    { mode: 'callout', label: 'Speech Callout', icon: <MessageSquare className="w-4 h-4" /> }
                  ].map(s => (
                    <button
                      key={s.mode}
                      type="button"
                      onClick={() => {
                        setActiveTool(s.mode as ToolMode);
                        setShowShapeMenu(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-xs font-semibold text-slate-700 dark:text-slate-200 transition text-left cursor-pointer"
                    >
                      {s.icon}
                      <span>{s.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Text Tool */}
            <button
              type="button"
              onClick={() => setActiveTool('text')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition ${activeTool === 'text' ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              title="Add Text label onto drawing"
            >
              <Type className="w-4 h-4" />
              <span>Text</span>
            </button>

            {/* Image Overlay */}
            <label className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition cursor-pointer">
              <ImageIcon className="w-4 h-4 text-emerald-500" />
              <span>Image</span>
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </label>

            <div className="w-px h-5 bg-slate-250 dark:bg-slate-800 mx-1 shrink-0" />

            {/* Stroke Width Selector */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
              {[1, 3, 6, 10].map(w => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setStrokeWidth(w)}
                  className={`w-6 h-6 rounded-lg flex items-center justify-center transition ${strokeWidth === w ? 'bg-white dark:bg-slate-700 shadow-xs' : 'hover:bg-white/40'}`}
                  title={`${w}px line weight`}
                >
                  <div
                    className="rounded-full bg-slate-700 dark:bg-slate-200"
                    style={{ width: `${Math.min(14, w * 2.2 + 2)}px`, height: `${Math.min(14, w * 2.2 + 2)}px` }}
                  />
                </button>
              ))}
            </div>

            {/* Color Palette Chips */}
            <div className="flex items-center gap-1.5 pl-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Color:</span>
              <div className="flex items-center gap-1">
                {PRESET_COLORS.slice(0, 7).map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setStrokeColor(c)}
                    className={`w-5 h-5 rounded-full border border-black/15 transition-transform hover:scale-110 cursor-pointer ${strokeColor === c ? 'ring-2 ring-indigo-500 scale-105' : ''}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <label className="w-5 h-5 rounded-full border border-slate-300 dark:border-slate-600 bg-gradient-to-tr from-rose-400 via-amber-300 to-indigo-400 hover:scale-110 transition cursor-pointer relative" title="Custom color">
                  <input
                    type="color"
                    value={strokeColor}
                    onChange={(e) => setStrokeColor(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                </label>
              </div>
            </div>

            {/* Clear Canvas */}
            <button
              type="button"
              onClick={handleClearCanvas}
              className="ml-auto p-1.5 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition cursor-pointer"
              title="Clear entire canvas"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Canvas Working Area with Google Docs Checkered Transparency Pattern */}
          <div ref={containerRef} className="flex-1 relative overflow-hidden bg-slate-200 dark:bg-slate-950 flex items-center justify-center p-3 select-none">
            {/* Google Docs Checkerboard Rulers / Background */}
            <div
              className="absolute inset-0 opacity-40 dark:opacity-20 pointer-events-none"
              style={{
                backgroundImage: `
                  linear-gradient(45deg, #cbd5e1 25%, transparent 25%), 
                  linear-gradient(-45deg, #cbd5e1 25%, transparent 25%), 
                  linear-gradient(45deg, transparent 75%, #cbd5e1 75%), 
                  linear-gradient(-45deg, transparent 75%, #cbd5e1 75%)
                `,
                backgroundSize: '20px 20px',
                backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px'
              }}
            />

            {/* Interactive HTML5 Canvas */}
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={drawMove}
              onMouseUp={endDrawing}
              onMouseLeave={endDrawing}
              onTouchStart={startDrawing}
              onTouchMove={drawMove}
              onTouchEnd={endDrawing}
              className="relative z-10 bg-white dark:bg-[#0f172a] rounded-2xl shadow-xl border border-slate-300 dark:border-slate-800 cursor-crosshair touch-none"
            />

            {/* Text Floating Input Dialog */}
            {textPos && (
              <div
                className="absolute z-20 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2 shadow-2xl flex items-center gap-1.5"
                style={{ left: `${textPos.x}px`, top: `${textPos.y}px` }}
              >
                <input
                  type="text"
                  autoFocus
                  placeholder="Type text label..."
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleApplyText();
                    if (e.key === 'Escape') setTextPos(null);
                  }}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500 w-48"
                />
                <button
                  type="button"
                  onClick={handleApplyText}
                  className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition text-xs font-bold"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
