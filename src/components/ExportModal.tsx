import React, { useRef } from 'react';
import { 
  Download, FileText, Share2, Printer, X, Copy, 
  Check, Sparkles, Image as ImageIcon 
} from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  noteTitle: string;
  noteHtml: string;
  noteText: string;
  tags: string[];
  createdAt?: Date;
  inkSvg?: string;
}

export default function ExportModal({
  isOpen,
  onClose,
  noteTitle,
  noteHtml,
  noteText,
  tags,
  createdAt = new Date(),
  inkSvg
}: ExportModalProps) {
  const { showToast } = useToast();
  const cardRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const titleSafe = (noteTitle || 'Untitled Note').replace(/[^a-zA-Z0-9_-]/g, '_');

  // 1. Export as Plain Text
  const handleExportTxt = () => {
    const textContent = `${noteTitle || 'Untitled Note'}\nTags: ${tags.join(', ')}\nDate: ${createdAt.toLocaleDateString()}\n\n--------------------\n\n${noteText}`;
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${titleSafe}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported as Plain Text (.txt)', 'success');
  };

  // 2. Export as Markdown (.md)
  const handleExportMd = () => {
    let md = `# ${noteTitle || 'Untitled Note'}\n\n`;
    if (tags.length > 0) {
      md += `> **Tags:** ${tags.map(t => `#${t}`).join(' ')}\n\n`;
    }
    md += `*Created on: ${createdAt.toLocaleDateString()}*\n\n---\n\n`;
    
    // Convert basic HTML to Markdown
    let converted = noteHtml
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
      .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
      .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
      .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
      .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
      .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
      .replace(/<ul[^>]*>/gi, '')
      .replace(/<\/ul>/gi, '\n')
      .replace(/<ol[^>]*>/gi, '')
      .replace(/<\/ol>/gi, '\n')
      .replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, '> $1\n\n')
      .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ');

    md += converted;

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${titleSafe}.md`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported as Markdown (.md)', 'success');
  };

  // 3. Print / Export PDF
  const handlePrintPdf = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('Popup blocked! Please allow popups to print.', 'error');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${noteTitle || 'Glick X Notes'}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              padding: 40px;
              color: #1e293b;
              line-height: 1.6;
              max-width: 800px;
              margin: 0 auto;
            }
            h1 { font-size: 28px; margin-bottom: 8px; color: #0f172a; font-weight: 800; }
            .meta { font-size: 13px; color: #64748b; margin-bottom: 24px; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0; }
            .content { font-size: 15px; }
            .content img { max-width: 100%; border-radius: 8px; }
            .content blockquote { border-left: 3px solid #6366f1; padding-left: 14px; margin: 16px 0; color: #475569; }
            .content pre { background: #0f172a; color: #f8fafc; padding: 12px; border-radius: 8px; font-family: monospace; }
            @media print {
              @page { size: auto; margin: 15mm 20mm; }
              body { padding: 0; max-width: 100%; color: #0f172a; }
              .glick-page-break {
                display: block !important;
                page-break-after: always !important;
                break-after: page !important;
                height: 0 !important;
                visibility: hidden !important;
              }
              p, blockquote, pre, table, tr, img, .glick-callout, .glick-code-container, .glick-shape-container {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
              h1, h2, h3, h4, h5, h6 {
                page-break-after: avoid !important;
                break-after: avoid !important;
              }
            }
            .glick-page-break {
              page-break-after: always;
              break-after: page;
            }
            .glick-page-break-visual {
              display: none !important;
            }
          </style>
        </head>
        <body>
          <h1>${noteTitle || 'Untitled Note'}</h1>
          <div class="meta">
            ${tags.map(t => `<span class="badge">#${t}</span>`).join(' ')}
            <span>Created: ${createdAt.toLocaleDateString()}</span> • <span>Glick X Notes</span>
          </div>
          <div class="content" style="position: relative;">
            ${inkSvg ? `<div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 10;">${inkSvg}</div>` : ''}
            ${noteHtml}
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() { window.close(); };
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // 4. Clean Share Card Text (Without raw markdown asterisks)
  const getCleanShareText = () => {
    const cleanTitle = (noteTitle || 'Untitled Note').trim();
    // Strip raw asterisks and markdown symbols
    const cleanBody = noteText.replace(/\*+/g, '').replace(/#+/g, '').trim();
    let text = `📝 ${cleanTitle}\n\n${cleanBody.slice(0, 350)}${cleanBody.length > 350 ? '...' : ''}`;
    if (tags.length > 0) {
      text += `\n\n🏷️ ${tags.map(t => `#${t.replace(/[^a-zA-Z0-9_-]/g, '')}`).join(' ')}`;
    }
    text += `\n\n✨ Written with Glick X Notes`;
    return text;
  };

  const handleCopyCard = () => {
    const shareText = getCleanShareText();
    navigator.clipboard.writeText(shareText);
    showToast('Copied summary card to clipboard!', 'success');
  };

  const handleNativeShare = async () => {
    const shareText = getCleanShareText();
    if (navigator.share) {
      try {
        await navigator.share({
          title: noteTitle || 'Glick X Notes',
          text: shareText
        });
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          handleCopyCard();
        }
      }
    } else {
      handleCopyCard();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150 select-none">
      <div 
        className="w-full max-w-lg bg-white dark:bg-[#0c1220] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Share2 className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Export & Share</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Download formatted files or share preview</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Export Options Grid */}
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            
            {/* PDF */}
            <button
              onClick={handlePrintPdf}
              className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 bg-slate-50/50 dark:bg-slate-900/40 text-left transition-all hover:shadow-md flex flex-col justify-between gap-3 group"
            >
              <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Printer className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">PDF / Print</p>
                <p className="text-[10px] text-slate-400">Print or save as PDF</p>
              </div>
            </button>

            {/* Markdown */}
            <button
              onClick={handleExportMd}
              className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 bg-slate-50/50 dark:bg-slate-900/40 text-left transition-all hover:shadow-md flex flex-col justify-between gap-3 group"
            >
              <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">Markdown</p>
                <p className="text-[10px] text-slate-400">Standard .md file</p>
              </div>
            </button>

            {/* Plain Text */}
            <button
              onClick={handleExportTxt}
              className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 bg-slate-50/50 dark:bg-slate-900/40 text-left transition-all hover:shadow-md flex flex-col justify-between gap-3 group"
            >
              <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Download className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">Plain Text</p>
                <p className="text-[10px] text-slate-400">Clean .txt export</p>
              </div>
            </button>

          </div>

          {/* Social / Visual Card Preview */}
          <div className="pt-2">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/70 via-slate-50 to-purple-50/40 dark:from-slate-900 dark:via-[#0c1220] dark:to-indigo-950/30 border border-indigo-100 dark:border-indigo-950/60 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Social Card Preview
                </span>
                <span className="text-[10px] text-slate-400 font-semibold">{createdAt.toLocaleDateString()}</span>
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">{noteTitle || 'Untitled Note'}</h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 line-clamp-3 leading-relaxed">
                  {noteText.slice(0, 200) || 'No note content...'}
                </p>
              </div>

              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {tags.map((t, idx) => (
                    <span key={idx} className="text-[10px] bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded font-medium border border-slate-200 dark:border-slate-700">
                      #{t}
                    </span>
                  ))}
                </div>
              )}

              <div className="pt-2 flex items-center justify-between border-t border-slate-200/60 dark:border-slate-800 gap-2">
                <span className="text-[10px] font-bold text-indigo-500">Glick X Notes</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleNativeShare}
                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                  >
                    <Share2 className="w-3 h-3" />
                    Share
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyCard}
                    className="px-3 py-1 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    Copy
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
