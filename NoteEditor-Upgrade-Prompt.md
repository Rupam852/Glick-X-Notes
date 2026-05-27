# 🎯 NoteEditor.tsx — Complete Professional Upgrade Prompt

---

## CONTEXT (Pehle yeh padhna zaroori hai)

Yeh ek React + TypeScript + Firebase + Vite project hai jiska naam **Glick-X-Notes** hai — ek notes app.

**Tech Stack:**
- React 18 + TypeScript
- Firebase Firestore (realtime database)
- Tailwind CSS
- Framer Motion (`motion/react`)
- Lucide React icons
- `date-fns` library

**Existing Types (`src/types.ts`):**
```ts
export interface Note {
  id: string;
  userId: string;
  title: string;
  body: string;
  tags: string[];
  color: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  attachmentCount?: number;
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  data: string; // Base64
  createdAt: Timestamp;
}
```

**Component props:**
```ts
interface NoteEditorProps {
  user: FirebaseUser;
  note: Note | null;
  onBack: () => void;
}
```

**Firebase imports available:**
```ts
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
// db = Firestore instance
// Firestore path for notes: 'notes/{noteId}'
// Firestore path for attachments: 'notes/{noteId}/attachments/{attachmentId}'
```

---

## TASK

**Rewrite `src/components/NoteEditor.tsx` completely** — ek professional-grade notes editor banao jaise Notion, Bear, ya Apple Notes jaise apps mein hota hai.

Neeche diye gaye **SABHI** changes implement karo. Koi bhi cheez skip mat karo.

---

## 🐛 BUG FIXES (Yeh PEHLE fix karo)

### 1. Auto-Save — Reliable banana
**Current problem:** Auto-save unreliable hai — kabhi save hota hai kabhi nahi. `liveBodyRef` aur `body` state out-of-sync rehte hain.

**Fix:**
```ts
// WRONG approach (current):
const liveBodyRef = useRef(note?.body || '');
// body state aur liveBodyRef alag ho jaate hain

// CORRECT approach:
// Sirf ek single source of truth rakho — contentRef.current.innerHTML ko directly use karo save ke waqt
// Auto-save ke liye useRef mein latest content store karo aur debounce 2000ms rakho
// Save ke baad lastSavedContent update karo taaki unnecessary saves na ho
```

**Implement karo:**
- `useRef` se `latestContent` track karo (always fresh)
- `useCallback` ke baad `useMemo` se `hasUnsavedChanges` calculate karo
- Auto-save timer 2000ms debounce ke saath — sirf tab save karo jab actual changes ho
- Save ke baad `lastSavedContent` snapshot update karo

### 2. Font Size — Sahi kaam karna
**Current problems:**
- Font size input change karte waqt caret jump karta hai editor se bahar
- Legacy browser index (1-7) ko pixel size mein galat map karta hai
- Selection ke baad size apply nahi hota properly

**Fix:**
```ts
// contentRef.current.focus() ko HAMESHA call karo font size apply ke baad
// Selection save karo PEHLE font size change, restore karo BAAD mein
// execCommand('fontSize') use mat karo — span-based approach rakho lekin sahi karo
const savedRange = saveSelection(); // selection save karo
handleFontSize(val);
restoreSelection(savedRange); // selection restore karo
contentRef.current.focus();
```

### 3. Table Insert — Bugs fix karo
**Current problems:**
- Table insert ke baad caret table ke andar nahi jaata
- Header row ka styling kabhi kabhi apply nahi hota
- Delete column edge cases crash kar sakta hai

**Fix:**
- Table insert ke baad first `<td>` mein focus move karo
- `execCommand('insertHTML')` ke baad `contentRef.current.innerHTML` update karo
- Delete operations mein `try/catch` wrap karo

### 4. Undo/Redo — Sahi implement karo
**Current problem:** Browser ka native `Ctrl+Z` / `Ctrl+Y` kaam nahi karta properly `contentEditable` ke saath jab hum programmatically `innerHTML` set karte hain.

**Fix — Custom undo/redo stack implement karo:**
```ts
const undoStack = useRef<string[]>([]);
const redoStack = useRef<string[]>([]);
const MAX_HISTORY = 50;

// Har meaningful input ke baad (debounced 500ms):
function pushToHistory(content: string) {
  if (undoStack.current[undoStack.current.length - 1] === content) return;
  undoStack.current.push(content);
  if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift();
  redoStack.current = []; // redo stack clear karo
}

function undo() {
  if (undoStack.current.length <= 1) return;
  const current = undoStack.current.pop()!;
  redoStack.current.push(current);
  const prev = undoStack.current[undoStack.current.length - 1];
  if (contentRef.current) {
    contentRef.current.innerHTML = prev;
    latestContent.current = prev;
  }
}

function redo() {
  if (redoStack.current.length === 0) return;
  const next = redoStack.current.pop()!;
  undoStack.current.push(next);
  if (contentRef.current) {
    contentRef.current.innerHTML = next;
    latestContent.current = next;
  }
}
```

Keyboard shortcuts:
- `Ctrl+Z` / `Cmd+Z` → undo
- `Ctrl+Shift+Z` / `Cmd+Shift+Z` ya `Ctrl+Y` → redo

---

## ✨ NEW FEATURES (Professional apps wali)

### 1. Word Count & Reading Time (Bottom Status Bar)
Editor ke bilkul neeche ek subtle status bar add karo:
```
Words: 342  |  Chars: 1,847  |  ~2 min read  |  Last saved: 2 min ago
```
- Word count: `text.split(/\s+/).filter(Boolean).length`
- Reading time: `Math.ceil(wordCount / 200)` minutes
- Last saved: relative time (`2 min ago`, `Just now`, `Not saved`)

### 2. Find & Replace (Ctrl+F)
Ek floating panel jo `Ctrl+F` / `Cmd+F` se toggle ho:
```
[ Find: _________ ] [ Replace: _________ ] [← Prev] [Next →] [Replace] [Replace All] [✕]
```
- `window.find()` ya custom DOM traversal se highlight karo
- Match count dikhao: "3 of 7 matches"
- ESC se band karo
- Panel position: editor ke top-right corner mein (sticky)

### 3. Heading Levels (H1, H2, H3)
Toolbar mein proper heading buttons add karo:
- **H1** — `formatBlock` → `<h1>`
- **H2** — `formatBlock` → `<h2>`  
- **H3** — `formatBlock` → `<h3>`
- Active state show karo (jis heading mein caret ho)

### 4. Link Insert
Toolbar mein link button:
- Click karo → small inline popup aata hai: `[ URL input ] [Insert]`
- `execCommand('createLink', false, url)` use karo
- Links `target="_blank"` ke saath open hon
- Existing link par click → edit/remove option

### 5. Keyboard Shortcuts (Professional)
```
Ctrl/Cmd + B → Bold
Ctrl/Cmd + I → Italic
Ctrl/Cmd + U → Underline
Ctrl/Cmd + K → Insert Link
Ctrl/Cmd + Z → Undo
Ctrl/Cmd + Shift+Z → Redo
Ctrl/Cmd + F → Find & Replace
Ctrl/Cmd + S → Manual Save (prevent default browser save)
Ctrl/Cmd + \ → Clear Formatting
Escape → Close active popup/panel
```
Yeh shortcuts `handleKeyDown` mein implement karo.

### 6. Drag-to-Resize Sidebar
Left sidebar (metadata panel) ko drag karke resize kar sako:
- Default width: `320px`
- Min: `240px`, Max: `480px`
- Divider bar par hover → cursor `col-resize`
- Mouse drag se width change ho

---

## 🎨 DESIGN IMPROVEMENTS

### 1. Mobile-Friendly Toolbar (PRIORITY)

**Current problem:** Toolbar ek hi row mein overflow hota hai, mobile par unusable hai.

**New approach — 2-row adaptive toolbar:**

```
Row 1 (always visible):
[ ↩ Back ] [ Save Status ] ──── [ Font Picker ] [ Focus Mode ] [ 🗑 ] [ Save ]

Row 2 (formatting bar — scrollable horizontally on mobile):
[ T↕ Size ] | [ B ] [ I ] [ U ] [ S ] | [ H1 ] [ H2 ] | [ ≡ ] [ 1. ] | [ 🔗 ] | [ ☑ ] [ 🖼 ] [ ⊞ Table ] | [ 🔍 ]
```

Mobile mein (< 768px):
- Row 2 horizontal scroll kare, no wrap
- Buttons size: 36x36px (touch-friendly)
- Font size input width compact rakho

### 2. Left Sidebar Redesign

**Purana sidebar hatao.** Naya sidebar:

```
┌─────────────────────────────┐
│ 📄 Note Details             │
├─────────────────────────────┤
│ Title                       │
│ [_____________________ ]    │
│                             │
│ Theme Color                 │
│ ● ● ● ● ● ● ●              │
│                             │
│ Tags                        │
│ [🏷 work, react, notes  ]   │
│                             │
├─────────────────────────────┤
│ 📎 Attachments (3)          │
│ [+ Add File]                │
│                             │
│ [🖼 image.png   45KB  ✕]   │
│ [📄 doc.pdf    120KB  ✕]   │
│                             │
├─────────────────────────────┤
│ ℹ️  Info                    │
│ Created: May 27, 2026       │
│ Updated: 2 min ago          │
│ Words: 342                  │
└─────────────────────────────┘
```

Styling:
- Background: `bg-slate-50 dark:bg-slate-900/60`
- Cards: subtle border, rounded-xl, clean spacing
- Section headers: small caps, muted color
- Attachment items: hover state, thumbnail for images
- Resize handle (drag karo)

### 3. Editor Area — Cleaner Design

**Content area:**
```
Max width: 720px, centered, proper padding
Font: Current font family apply ho poore editor par
Line height: 1.8
Paragraphs: margin-bottom 1em
H1: 2em, bold, border-bottom
H2: 1.5em, bold
H3: 1.25em, semi-bold
Blockquote: left border 4px indigo, italic, padding-left 16px
Code (pre): monospace, bg-slate-100 dark:bg-slate-800, rounded, padding
Tables: clean borders, header row highlighted
Links: indigo color, underline on hover
```

**Placeholder text** (jab editor empty ho):
```
"Start writing your note..."
```
CSS: `content-editable[data-placeholder]:empty:before { content: attr(data-placeholder); color: #94a3b8; }`

**Focus Mode improvements:**
- Sidebar completely hide ho
- Title input bhi editor ke andar (top mein)
- Distraction-free: sirf content area visible
- Subtle gradient background

---

## 📐 COMPONENT STRUCTURE

Naya code is structure mein likho:

```tsx
// ============================================================
// HELPER FUNCTIONS (component ke bahar)
// ============================================================
function saveSelection(): Range | null { ... }
function restoreSelection(range: Range | null): void { ... }
function getWordCount(html: string): number { ... }
function getRelativeTime(date: Date | null): string { ... }

// ============================================================
// SUB-COMPONENTS
// ============================================================
const ToolbarButton = ({ ... }) => { ... };
const StatusBar = ({ wordCount, charCount, lastSaved }: ...) => { ... };
const FindReplacePanel = ({ contentRef, onClose }: ...) => { ... };
const LinkInsertPopup = ({ onInsert, onClose }: ...) => { ... };

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function NoteEditor({ user, note, onBack }: NoteEditorProps) {
  
  // --- REFS ---
  const contentRef = useRef<HTMLDivElement>(null);
  const latestContent = useRef(note?.body || '');
  const undoStack = useRef<string[]>([note?.body || '']);
  const redoStack = useRef<string[]>([]);
  const historyTimer = useRef<ReturnType<typeof setTimeout>>();
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const sidebarWidth = useRef(320);

  // --- STATE ---
  const [currentNoteId, setCurrentNoteId] = useState(note?.id || null);
  const [title, setTitle] = useState(note?.title || '');
  const [tags, setTags] = useState(note?.tags.join(', ') || '');
  const [color, setColor] = useState(note?.color || COLORS[0].value);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState({ title: note?.title || '', body: note?.body || '', tags: note?.tags.join(', ') || '', color: note?.color || COLORS[0].value });
  const [activeFormats, setActiveFormats] = useState({ ... });
  const [activePopup, setActivePopup] = useState<'text' | 'paragraph' | 'table' | 'tableActions' | 'link' | null>(null);
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [sidebarW, setSidebarW] = useState(320);
  const [isDragging, setIsDragging] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [viewingAttachment, setViewingAttachment] = useState<Attachment | null>(null);
  const [activeFont, setActiveFont] = useState<'sans' | 'serif' | 'mono'>('sans');
  const [showFontMenu, setShowFontMenu] = useState(false);
  const [hoveredTable, setHoveredTable] = useState({ row: -1, col: -1 });
  const [customRows, setCustomRows] = useState('3');
  const [customCols, setCustomCols] = useState('3');

  // ... rest of implementation
}
```

---

## ⚠️ IMPORTANT CONSTRAINTS

1. **Firebase imports sirf yahi use karo:**
   ```ts
   import { collection, doc, setDoc, deleteDoc, serverTimestamp, getDocs, addDoc, query, where, onSnapshot } from 'firebase/firestore';
   import { User as FirebaseUser } from 'firebase/auth';
   import { db, auth, handleFirestoreError, OperationType } from '../firebase';
   ```

2. **Lucide React icons sirf yahi available hain (jo pehle se import hain):**
   `ArrowLeft, Save, Trash2, Paperclip, X, Download, FileText, Image, Plus, Tag, Palette, Check, Loader2, Bold, Italic, List, ListOrdered, Link, Heading1, Quote, Undo, Redo, UploadCloud, Sparkles, ChevronDown, ChevronUp, Underline, Strikethrough, Code, Highlighter, Eraser, CornerDownLeft, Type, AlignLeft, AlignCenter, AlignRight, CheckSquare, Table`
   
   Naye icons add karne hain to unhe import list mein add karo: `Heading2, Heading3, Search, Replace, GripVertical, Info, Clock, FileImage`

3. **CSS classes sirf Tailwind use karo** — koi custom CSS nahi sivaaye `index.css` wali existing classes ke.

4. **`execCommand` deprecated hai lekin contentEditable ke liye abhi bhi best option hai** — use karte raho lekin font size ke liye span-based approach use karo.

5. **`motion/react` use karo, `framer-motion` nahi** — yeh already project mein hai.

6. **TypeScript strict mode hai** — koi `any` mat use karo jahan possible ho, proper types banao.

7. **Firestore rules:** Notes sirf `userId === auth.currentUser.uid` wale users read/write kar sakte hain — security check `handleFirestoreError` se handle hoti hai.

---

## 📋 CHECKLIST — Yeh sab implement hona chahiye

**Bugs Fixed:**
- [ ] Auto-save 100% reliable (single source of truth)
- [ ] Font size apply karne ke baad caret wahi rahe
- [ ] Table insert ke baad cursor first cell mein jaye
- [ ] Custom undo/redo stack kaam kare (Ctrl+Z / Ctrl+Y)
- [ ] Delete column/row crash na kare

**New Features:**
- [ ] Word count + Reading time bottom status bar
- [ ] Find & Replace panel (Ctrl+F se toggle)
- [ ] H1, H2, H3 heading buttons toolbar mein
- [ ] Link insert popup (Ctrl+K se)
- [ ] Proper keyboard shortcuts (B, I, U, K, Z, F, S, \)
- [ ] Sidebar drag-to-resize

**Design:**
- [ ] Mobile 2-row toolbar (scroll kare)
- [ ] Left sidebar redesign (sections: Details, Attachments, Info)
- [ ] Editor max-width 720px centered
- [ ] Empty state placeholder text
- [ ] Content typography (h1, h2, blockquote, code styles via Tailwind prose ya manual)
- [ ] Status bar (words, chars, read time, last saved)

---

## OUTPUT FORMAT

**Sirf ek file do: `NoteEditor.tsx` ka complete replacement code.**

- Puri file likho — koi `// ... rest same as before` shortcuts mat use karo
- Har function proper comments ke saath
- File ke end mein koi extra explanation mat likho — sirf code
- TypeScript errors zero hone chahiye

---

*Prompt version: 1.0 | Project: Glick-X-Notes | File: src/components/NoteEditor.tsx*
