import { useState } from "react";

const sections = [
  {
    id: "formatting",
    title: "1. Text Formatting — execCommand",
    color: "#4f46e5",
    code: `// Bold
document.execCommand('bold');

// Italic
document.execCommand('italic');

// Underline
document.execCommand('underline');

// Strikethrough
document.execCommand('strikeThrough');

// Highlight (background color)
document.execCommand('backColor', false, '#ffff00');

// Clear all formatting
document.execCommand('removeFormat');

// Check if active (returns true/false)
const isBold = document.queryCommandState('bold');`,
    note: "Ye sab commands selected text pe apply hoti hain. Button active dikhane ke liye queryCommandState() use karo."
  },
  {
    id: "fontsize",
    title: "2. Font Size",
    color: "#0891b2",
    code: `// Method 1: execCommand (1-7 scale sirf)
document.execCommand('fontSize', false, '4');

// Method 2: span wrap (recommended - exact px)
function setFontSize(px) {
  const selection = window.getSelection();
  if (!selection.rangeCount) return;

  const range = selection.getRangeAt(0);
  const span = document.createElement('span');
  span.style.fontSize = px + 'px';

  range.surroundContents(span);
}

// Usage
setFontSize(18);
setFontSize(24);`,
    note: "Method 2 zyada reliable hai kyunki exact pixel size milti hai."
  },
  {
    id: "fontcolor",
    title: "3. Font Color",
    color: "#dc2626",
    code: `// Selected text ka color change karo
document.execCommand('foreColor', false, '#e24b4a');

// Current color check karna
const color = document.queryCommandValue('foreColor');
console.log(color); // "rgb(226, 75, 74)"

// Color picker se
function applyColor(hexColor) {
  document.execCommand('foreColor', false, hexColor);
}

// Colors list
const COLORS = [
  '#ffffff', // white
  '#888888', // gray
  '#e24b4a', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#3b82f6', // blue
];`,
    note: "foreColor command selected text pe color lagata hai. Background ke liye backColor use karo."
  },
  {
    id: "alignment",
    title: "4. Text Alignment",
    color: "#7c3aed",
    code: `// Left align
document.execCommand('justifyLeft');

// Center align
document.execCommand('justifyCenter');

// Right align
document.execCommand('justifyRight');

// Full justify
document.execCommand('justifyFull');

// Current alignment check
const isCenter = document.queryCommandState('justifyCenter');

// Button click handler example
function handleAlign(type) {
  const commands = {
    left: 'justifyLeft',
    center: 'justifyCenter',
    right: 'justifyRight',
  };
  document.execCommand(commands[type]);
}`,
    note: "Alignment poore paragraph/block pe apply hoti hai, sirf selected text pe nahi."
  },
  {
    id: "list",
    title: "5. List — Bullet & Numbered",
    color: "#059669",
    code: `// Bullet List (unordered - ul/li)
document.execCommand('insertUnorderedList');

// Numbered List (ordered - ol/li)
document.execCommand('insertOrderedList');

// Toggle logic — ek baar click = ON, dobara = OFF
function toggleList(type) {
  if (type === 'bullet') {
    document.execCommand('insertUnorderedList');
  } else {
    document.execCommand('insertOrderedList');
  }
}

// Active check karna
const isBulletActive = document.queryCommandState('insertUnorderedList');
const isNumberedActive = document.queryCommandState('insertOrderedList');

// React state example
const [activeList, setActiveList] = useState(null);

function handleListClick(type) {
  document.execCommand(
    type === 'bullet' ? 'insertUnorderedList' : 'insertOrderedList'
  );
  setActiveList(prev => prev === type ? null : type);
}`,
    note: "Dobara same command click karne se list off ho jati hai (toggle). queryCommandState se current state check karo."
  },
  {
    id: "table",
    title: "6. Table Insert Logic",
    color: "#b45309",
    code: `// Table HTML generate karna
function generateTableHTML(rows, cols) {
  let html = '<table border="1" style="border-collapse:collapse; width:100%;">';

  for (let r = 0; r < rows; r++) {
    html += '<tr>';
    for (let c = 0; c < cols; c++) {
      if (r === 0) {
        html += '<th style="padding:6px 10px; background:#f3f4f6;">Col ' + (c + 1) + '</th>';
      } else {
        html += '<td style="padding:6px 10px;">&nbsp;</td>';
      }
    }
    html += '</tr>';
  }

  html += '</table><p></p>';
  return html;
}

// contenteditable mein table inject karna
function insertTable(rows, cols) {
  const tableHTML = generateTableHTML(rows, cols);
  document.execCommand('insertHTML', false, tableHTML);
}

// Usage — 3 rows, 4 columns
insertTable(3, 4);

// React state for grid hover
const [hovered, setHovered] = useState({ row: -1, col: -1 });

function handleGridHover(row, col) {
  setHovered({ row, col });
}

function handleGridClick(row, col) {
  insertTable(row + 1, col + 1);
}

// Grid render example (6x6)
// Array.from({length:6}, (_, r) =>
//   Array.from({length:6}, (_, c) =>
//     <div
//       onMouseEnter={() => handleGridHover(r, c)}
//       onClick={() => handleGridClick(r, c)}
//       style={{ background: r<=hovered.row && c<=hovered.col ? '#4f46e5' : '' }}
//     />
//   )
// )`,
    note: "Grid hover pe rows×cols highlight karo. Click pe insertHTML se table inject ho jata hai cursor ke jagah."
  }
];

export default function App() {
  const [open, setOpen] = useState("formatting");
  const [copied, setCopied] = useState(null);

  function copy(id, code) {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  return (
    <div style={{ fontFamily: "monospace", maxWidth: 720, margin: "0 auto", padding: "1rem" }}>
      <h2 style={{ fontFamily: "sans-serif", fontWeight: 500, fontSize: 18, marginBottom: 4 }}>
        Rich Text Editor — Logic Guide
      </h2>
      <p style={{ fontFamily: "sans-serif", fontSize: 13, color: "#888", marginBottom: 20 }}>
        Har section click karo code dekhne ke liye, phir copy karo
      </p>

      {sections.map(sec => (
        <div key={sec.id} style={{ marginBottom: 10, border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
          <button
            onClick={() => setOpen(open === sec.id ? null : sec.id)}
            style={{
              width: "100%", textAlign: "left", padding: "12px 16px",
              background: open === sec.id ? sec.color : "#f9fafb",
              color: open === sec.id ? "#fff" : "#111",
              border: "none", cursor: "pointer", fontSize: 14, fontFamily: "sans-serif",
              fontWeight: 500, display: "flex", justifyContent: "space-between", alignItems: "center"
            }}
          >
            {sec.title}
            <span style={{ fontSize: 18 }}>{open === sec.id ? "▲" : "▼"}</span>
          </button>

          {open === sec.id && (
            <div style={{ padding: "12px 16px", background: "#0f172a" }}>
              <div style={{
                background: "#1e293b", borderRadius: 8, padding: "14px 16px",
                position: "relative", marginBottom: 10
              }}>
                <button
                  onClick={() => copy(sec.id, sec.code)}
                  style={{
                    position: "absolute", top: 10, right: 10,
                    background: copied === sec.id ? "#22c55e" : "#334155",
                    color: "#fff", border: "none", borderRadius: 6,
                    padding: "4px 12px", fontSize: 12, cursor: "pointer", fontFamily: "sans-serif"
                  }}
                >
                  {copied === sec.id ? "✓ Copied!" : "Copy"}
                </button>
                <pre style={{
                  margin: 0, color: "#e2e8f0", fontSize: 12.5, lineHeight: 1.7,
                  overflowX: "auto", whiteSpace: "pre-wrap", paddingRight: 60
                }}>
                  {sec.code}
                </pre>
              </div>
              <div style={{
                background: "#1d1d2e", borderLeft: `3px solid ${sec.color}`,
                borderRadius: "0 6px 6px 0", padding: "8px 12px",
                color: "#94a3b8", fontSize: 12.5, fontFamily: "sans-serif", lineHeight: 1.6
              }}>
                💡 {sec.note}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
