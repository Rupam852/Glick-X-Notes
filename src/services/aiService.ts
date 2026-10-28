import { db } from '../firebase';
import { doc, getDoc, setDoc, deleteField, serverTimestamp } from 'firebase/firestore';

export interface AIModelConfig {
  model: string;
  apiKey: string;
}

export interface AIConfiguration {
  mode: 'default' | 'custom';
  gemini: AIModelConfig;
}

export interface ModelTestResult {
  provider: 'gemini';
  model: string;
  ok: boolean;
  status: number | string;
  latencyMs: number;
  message: string;
}

// Officially verified, active Google Gemini models
export const GEMINI_MODELS = [
  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash (Primary - Fast & Stable)', default: true },
  { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash-Lite (High Speed)', default: false },
  { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash (High Performance)', default: false },
  { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash (Deep Reasoning)', default: false }
];

// Sequential fallback chain: if a model fails or hits limits, seamlessly move to the next
export const WORKING_GEMINI_FALLBACK_CHAIN = [
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.6-flash',
  'gemini-3.8-flash'
];

const LOCAL_STORAGE_KEY = 'glick_ai_config';

export function getDefaultAIConfig(): AIConfiguration {
  return {
    mode: 'default',
    gemini: {
      model: 'gemini-3.5-flash',
      apiKey: '' // Never expose the secret system key in client config
    }
  };
}

export function getAIConfig(): AIConfiguration {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!stored) return getDefaultAIConfig();
    const parsed = JSON.parse(stored);
    
    // Auto-migrate any deprecated legacy models (1.5, 2.0, 2.5, etc.) to 3.5-flash
    let geminiModel = parsed.gemini?.model || 'gemini-3.5-flash';
    const isValidModel = WORKING_GEMINI_FALLBACK_CHAIN.includes(geminiModel);
    if (!isValidModel) {
      geminiModel = 'gemini-3.5-flash';
    }

    // Only return apiKey if user explicitly typed a custom key, never leak the system key
    let userKey = parsed.mode === 'custom' ? (parsed.gemini?.apiKey || '').trim() : '';
    const systemKey = ((import.meta.env.VITE_GEMINI_API_KEY as string) || '').trim();
    if (userKey && systemKey && userKey === systemKey) {
      userKey = ''; // Purge if system key was previously stored in local storage
    }

    return {
      mode: parsed.mode === 'custom' ? 'custom' : 'default',
      gemini: {
        model: geminiModel,
        apiKey: userKey
      }
    };
  } catch {
    return getDefaultAIConfig();
  }
}

export function saveAIConfig(config: AIConfiguration): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(config));
  } catch (err) {
    console.error('Failed to save AI config to localStorage:', err);
  }
}

/**
 * Saves or updates custom Gemini API key in user's Firestore document.
 * If apiKey is provided, it replaces/overwrites the old key in the database.
 * If mode is 'default' or key is empty, it removes/deletes the custom key from the database.
 */
export async function saveAIConfigToDatabase(userId: string, config: AIConfiguration): Promise<void> {
  // Always update local storage first
  saveAIConfig(config);

  if (!userId || !db) return;

  try {
    const userDocRef = doc(db, 'users', userId);
    if (config.mode === 'custom' && config.gemini.apiKey.trim()) {
      // Overwrite and replace old API key with new API key in database
      await setDoc(userDocRef, {
        customGeminiConfig: {
          mode: 'custom',
          model: config.gemini.model,
          apiKey: config.gemini.apiKey.trim(),
          updatedAt: serverTimestamp()
        }
      }, { merge: true });
    } else {
      // User switched to default or cleared key - delete previous key from database
      await setDoc(userDocRef, {
        customGeminiConfig: deleteField()
      }, { merge: true });
    }
  } catch (err) {
    console.error('Failed to sync AI config to Firestore database:', err);
    throw err;
  }
}

/**
 * Fetches user's custom Gemini API key from database (if present) and syncs to local storage.
 */
export async function syncAIConfigFromDatabase(userId: string): Promise<AIConfiguration> {
  if (!userId || !db) return getAIConfig();

  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      const data = userDoc.data();
      const dbConfig = data?.customGeminiConfig;
      if (dbConfig?.apiKey && dbConfig.apiKey.trim()) {
        const syncedConfig: AIConfiguration = {
          mode: 'custom',
          gemini: {
            model: dbConfig.model || 'gemini-3.5-flash',
            apiKey: dbConfig.apiKey.trim()
          }
        };
        saveAIConfig(syncedConfig);
        return syncedConfig;
      }
    }
  } catch (err) {
    console.error('Failed to sync AI config from Firestore database:', err);
  }

  return getAIConfig();
}

export async function testGeminiModel(apiKey: string, model: string): Promise<ModelTestResult> {
  const startTime = Date.now();
  if (!apiKey || !apiKey.trim()) {
    return {
      provider: 'gemini',
      model,
      ok: false,
      status: 'No API Key',
      latencyMs: 0,
      message: 'API Key is empty. Please enter your Google Gemini API key.'
    };
  }

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Respond with the single word: OK' }] }]
      })
    });

    const latencyMs = Date.now() - startTime;
    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'OK';
      return {
        provider: 'gemini',
        model,
        ok: true,
        status: res.status,
        latencyMs,
        message: `Connected successfully (${latencyMs}ms). Response: "${text.slice(0, 30)}"`
      };
    } else {
      const errMsg = data.error?.message || `HTTP ${res.status} Error`;
      return {
        provider: 'gemini',
        model,
        ok: false,
        status: res.status,
        latencyMs,
        message: errMsg
      };
    }
  } catch (err: any) {
    return {
      provider: 'gemini',
      model,
      ok: false,
      status: 'Network Error',
      latencyMs: Date.now() - startTime,
      message: err.message || 'Network connection failed'
    };
  }
}

async function callGemini(apiKey: string, model: string, prompt: string, systemInstruction?: string): Promise<string> {
  const body: any = {
    contents: [{ parts: [{ text: prompt }] }]
  };
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error?.message || `Gemini API error (Status ${res.status})`);
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('No response text received from Gemini');
  return text.trim();
}

/**
 * Executes an AI completion using sequential Gemini fallback.
 * Tries the user's selected model first, and if it fails or is overloaded,
 * automatically falls back through the remaining working Gemini models in order.
 * If ALL models fail, throws an aggregated error for the UI to popup.
 */
export async function executeAICompletion(prompt: string, systemInstruction?: string): Promise<{ text: string; providerUsed: string; modelUsed: string }> {
  const config = getAIConfig();
  const customKey = config.mode === 'custom' ? config.gemini.apiKey.trim() : '';
  const systemKey = ((import.meta.env.VITE_GEMINI_API_KEY as string) || '').trim();
  const key = customKey || systemKey;
  
  if (!key) {
    if (config.mode === 'custom') {
      throw new Error('Please enter your personal Google Gemini API key in AI Settings.');
    }
    throw new Error('Google Gemini API key is missing. Please set VITE_GEMINI_API_KEY in Vercel or configure your key in Settings.');
  }

  const selectedModel = config.gemini.model || 'gemini-3.5-flash';
  // Sequence: Selected model first, then remaining verified working models
  const sequence = [
    selectedModel,
    ...WORKING_GEMINI_FALLBACK_CHAIN.filter(m => m !== selectedModel)
  ];

  const failureDetails: string[] = [];

  for (let i = 0; i < sequence.length; i++) {
    const currentModel = sequence[i];
    try {
      const text = await callGemini(key, currentModel, prompt, systemInstruction);
      return { 
        text, 
        providerUsed: 'Gemini', 
        modelUsed: currentModel 
      };
    } catch (err: any) {
      console.warn(`[Gemini Fallback] Model ${currentModel} failed (attempt ${i + 1}/${sequence.length}):`, err.message);
      failureDetails.push(`[${currentModel}]: ${err.message}`);
    }
  }

  // All models in sequence failed
  throw new Error(`All Gemini models failed!\n${failureDetails.join('\n')}`);
}

/**
 * Strips raw markdown code symbols (*, #, ---, **, etc.) and conversational meta headers
 * to produce clean, professional, human-readable text.
 */
export function sanitizeAIText(raw: string): string {
  if (!raw) return '';
  let text = raw;

  // Remove markdown code fences if wrapped
  text = text.replace(/```(?:markdown|text)?\n([\s\S]*?)```/gi, '$1');

  // Remove generic AI conversational meta headers like "**Note 1**", "**Note 6**", "### Note:", "Here is the polished version:"
  text = text.replace(/^\s*(?:\*{1,2}|#{1,4}\s*)?(?:Note\s*\d+|Here is the polished version|Here is the summary|Here is the rewrite)[:\s*-]*(?:\*{1,2})?\s*\n+/gim, '');

  // Clean Markdown Headings: "### Title" -> "Title"
  text = text.replace(/^[ \t]*#{1,6}[ \t]+([^\n]+)/gm, '$1');

  // Clean Markdown Horizontal Rules: "---" or "***" or "___" -> ""
  text = text.replace(/^[ \t]*[-*_]{3,}[ \t]*$/gm, '');

  // Convert Markdown bullet lists (* or -) into clean unicode bullets (• )
  text = text.replace(/^[ \t]*[*+-][ \t]+/gm, '• ');

  // Clean bold/italic asterisks: "**bold**" -> "bold", "*italic*" -> "italic"
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
  text = text.replace(/\*([^*\n]+)\*/g, '$1');

  // Clean double-dashes used as separators: " -- " -> " - "
  text = text.replace(/[ \t]+--[ \t]+/g, ' - ');

  // Remove excessive consecutive newlines
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

/**
 * Converts sanitized plain text into clean, rich HTML for the Note Editor.
 * Renders bullet lines as proper <ul><li> and paragraphs as <p>, avoiding any raw markdown.
 */
export function formatAITextToEditorHtml(text: string): string {
  if (!text) return '';
  const clean = sanitizeAIText(text);
  const lines = clean.split('\n');
  let html = '';
  let inList = false;

  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (inList) { html += '</ul>'; inList = false; }
      continue;
    }

    if (trimmed.startsWith('• ')) {
      if (!inList) { html += '<ul style="list-style-type: disc; margin-left: 20px; margin-bottom: 8px;">'; inList = true; }
      const itemContent = trimmed.slice(2).trim();
      html += `<li>${itemContent}</li>`;
    } else {
      if (inList) { html += '</ul>'; inList = false; }
      html += `<p style="margin-bottom: 8px;">${trimmed}</p>`;
    }
  }
  if (inList) { html += '</ul>'; }
  return html;
}

// 1. AI Summary
export async function aiSummarizeNote(noteText: string): Promise<string> {
  const prompt = `Analyze this note and provide a clear, clean summary:
1. A brief 2-sentence overview
2. 3 to 5 key bullet points using the bullet symbol '• ' (do NOT use asterisks '*')
3. Action items (if any exist in the note)

FORMATTING RULES:
- Do NOT use markdown symbols like '#', '##', '###', '---', or bold asterisks '**'.
- Do NOT write introductory phrases like '**Note X**' or 'Here is the summary'.
- Output clean, polished natural text.

Note Content:
"""
${noteText}
"""`;

  const res = await executeAICompletion(
    prompt, 
    'You are a professional note-taking editor. Write in clean plain text with no markdown symbols (*, #, ---, **).'
  );
  return sanitizeAIText(res.text);
}

/**
 * Polishes rich HTML content while preserving bold/italic/underline styles,
 * code blocks, tables, images, callouts, and toggles intact.
 */
export async function aiPolishHtml(rawHtml: string, tone: 'professional' | 'casual' | 'concise'): Promise<string> {
  if (!rawHtml || !rawHtml.trim()) return '';

  const protectedTokens: { [token: string]: string } = {};
  let tokenCounter = 0;

  // 1. Protect all images (<img ...> and .glick-image-container blocks)
  let protectedHtml = rawHtml.replace(/<div[^>]*class="[^"]*glick-image-[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>/gi, (match) => {
    const token = `<!--__GLICK_IMG_BLOCK_${tokenCounter++}__-->`;
    protectedTokens[token] = match;
    return token;
  });

  protectedHtml = protectedHtml.replace(/<img\b[^>]*>/gi, (match) => {
    const token = `<!--__GLICK_IMG_TAG_${tokenCounter++}__-->`;
    protectedTokens[token] = match;
    return token;
  });

  // 2. Protect entire code block containers (<div ... glick-code-container ...>) and pre/code blocks
  protectedHtml = protectedHtml.replace(/<div[^>]*class="[^"]*glick-code-container[^"]*"[^>]*>[\s\S]*?<\/pre>\s*<\/div>/gi, (match) => {
    const token = `<!--__GLICK_CODE_WRAPPER_${tokenCounter++}__-->`;
    protectedTokens[token] = match;
    return token;
  });

  protectedHtml = protectedHtml.replace(/<pre\b[^>]*>[\s\S]*?<\/pre>/gi, (match) => {
    const token = `<!--__GLICK_CODE_BLOCK_${tokenCounter++}__-->`;
    protectedTokens[token] = match;
    return token;
  });

  // 3. Protect all UI controls with contenteditable="false" (e.g. toggle arrows, corner grips, headers)
  protectedHtml = protectedHtml.replace(/<(?:div|span|button|svg)\b[^>]*contenteditable=["']false["'][^>]*>[\s\S]*?<\/(?:div|span|button|svg)>/gi, (match) => {
    const token = `<!--__GLICK_NON_EDITABLE_${tokenCounter++}__-->`;
    protectedTokens[token] = match;
    return token;
  });

  // 4. Protect UI action buttons (e.g. data-action="delete-block" or data-action="copy-code")
  protectedHtml = protectedHtml.replace(/<button\b[^>]*>[\s\S]*?<\/button>/gi, (match) => {
    const token = `<!--__GLICK_BTN_BLOCK_${tokenCounter++}__-->`;
    protectedTokens[token] = match;
    return token;
  });

  const prompt = `You are a professional rich-text document editor. Rewrite and polish the text inside the provided HTML in a ${tone.toUpperCase()} tone.

CRITICAL PRESERVATION & STYLING RULES:
1. PRESERVE ALL FORMATTING TAGS & ATTRIBUTES:
   - Keep <b>, <strong>, <i>, <em>, <u>, <s>, <mark>, <span ...> tags around their highlighted or bold words/phrases. Do NOT strip bold or italic tags!
   - Keep all inline styles (style="font-weight: bold; color: ...; font-size: ...") intact.
   - Keep <details>, <summary>, <table>, <thead>, <tbody>, <tr>, <td>, <th>, <blockquote>, <div class="..."> exactly in their structural positions.
   - Keep all token comments like <!--__GLICK_...__--> EXACTLY unchanged.
2. POLISH ONLY THE TEXT CONTENT:
   - Improve grammar, vocabulary, spelling, and sentence flow inside paragraphs, headings, list items, and table cells.
   - If a specific phrase was bolded (<b>word</b> or <strong>phrase</strong>), polish the phrasing while keeping the <b> or <strong> tags surrounding it.
   - Do NOT wrap your response in \`\`\`html or markdown code blocks.
   - Return clean, well-formed HTML only.
   - Do NOT output any raw markdown asterisks (*, **), hashes (#), or horizontal rules (---).
   - Do NOT add introductory or conversational notes.

HTML TO POLISH:
${protectedHtml}`;

  const res = await executeAICompletion(
    prompt,
    `You are an expert HTML note editor. Polish text inside HTML tags in a ${tone} tone. Keep all styling tags (<b>, <strong>, <i>, <u>, <span>, <table>, <details>) and token comments intact without markdown wrappers.`
  );

  let polished = res.text.trim();
  // Strip code block fences if returned
  polished = polished.replace(/^```(?:html)?\s*\n?/i, '').replace(/\n?```$/i, '').trim();

  // If wrapped in full HTML/body tags, extract body content
  const bodyMatch = polished.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    polished = bodyMatch[1].trim();
  }

  // Convert any accidental markdown formatting into proper HTML
  polished = polished.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  polished = polished.replace(/(^|[^\*])\*([^*\n]+)\*([^\*]|$)/g, '$1<i>$2</i>$3');

  // Restore protected tokens
  for (const [token, original] of Object.entries(protectedTokens)) {
    polished = polished.split(token).join(original);
  }

  return polished;
}

// 2. Grammar & Tone Polisher (Plain Text fallback)
export async function aiPolishText(noteText: string, tone: 'professional' | 'casual' | 'concise'): Promise<string> {
  const prompt = `Rewrite and polish the following note text in a ${tone.toUpperCase()} tone. Fix all spelling, punctuation, and grammar mistakes while preserving all core facts and meaning.

CRITICAL FORMATTING RULES:
- Do NOT output markdown code symbols: NO asterisks ('*', '**'), NO hashes ('#', '##', '###'), and NO horizontal rules ('---').
- Do NOT add any meta headers like '**Note 1**' or 'Here is the polished version'.
- If creating list items, start lines with '• ' (NOT '*' or '-').
- Return ONLY the clean, polished text ready to read.

Note Content:
"""
${noteText}
"""`;

  const res = await executeAICompletion(
    prompt, 
    `You are an expert editor. Rewrite text cleanly in a ${tone} tone. Never use markdown symbols like *, #, or --.`
  );
  return sanitizeAIText(res.text);
}

// 3. Smart Title & Tag Suggestion
export async function aiSuggestTitleAndTags(noteText: string): Promise<{ title: string; tags: string[] }> {
  const prompt = `Analyze this note and suggest:
1. One concise, engaging title (maximum 6 words, no quotes or symbols)
2. Up to 4 relevant tags (lowercase single words, e.g., "ideas", "meeting", "project")

Return your response in pure JSON format:
{"title": "Clean Note Title", "tags": ["tag1", "tag2"]}

Note Content:
"""
${noteText.slice(0, 2000)}
"""`;

  const res = await executeAICompletion(prompt, 'You are a metadata assistant. Output ONLY valid JSON, with no markdown code fences or symbols.');
  try {
    const cleanJson = res.text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);
    return {
      title: sanitizeAIText(parsed.title || 'Untitled Note'),
      tags: Array.isArray(parsed.tags) ? parsed.tags.map((t: string) => t.toLowerCase().replace(/[^a-z0-9_-]/g, '')) : []
    };
  } catch {
    return {
      title: 'Suggested Note Title',
      tags: ['notes', 'glick']
    };
  }
}

// 4. Ask AI About This Note
export async function aiAskAboutNote(noteText: string, question: string, history: { role: string; content: string }[] = []): Promise<string> {
  let promptContext = `Note Context:\n"""\n${noteText}\n"""\n\n`;
  if (history.length > 0) {
    promptContext += `Conversation History:\n` + history.map(h => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`).join('\n') + '\n\n';
  }
  promptContext += `User Question: ${question}\n\nAnswer helpfully and concisely using the note context. Do NOT use markdown symbols like '#', '##', '---', or asterisks '**'. Use clean plain text and '• ' for bullets:`;

  const res = await executeAICompletion(
    promptContext, 
    'You are a helpful AI assistant. Answer clearly in clean text without markdown code symbols (*, #, ---).'
  );
  return sanitizeAIText(res.text);
}

export interface AIAgentChatResult {
  reply: string;
  action: 'replace_content' | 'append_content' | 'update_title' | 'none';
  content?: string;
  newTitle?: string;
}

/**
 * 5. AI Note Agent:
 * Can answer questions AND directly modify, format, append to, or rewrite
 * the specific note based on conversational text or voice instructions.
 */
export async function aiNoteAgentChat(
  noteTitle: string,
  noteHtml: string,
  noteText: string,
  userMessage: string,
  history: { role: string; content: string }[] = []
): Promise<AIAgentChatResult> {
  const noteContext = noteHtml || noteText || 'Empty Note';

  const prompt = `You are an intelligent AI Note Agent for "Glick X Notes".
You can answer questions AND directly modify, update, append to, or format the user's note based on their conversational instructions (in English, Hindi, or Hinglish).

CURRENT NOTE TITLE:
"${noteTitle || 'Untitled'}"

CURRENT NOTE CONTENT (HTML):
"""
${noteContext}
"""

USER INSTRUCTION / QUESTION:
"${userMessage}"

${history.length > 0 ? `RECENT CHAT HISTORY:\n${history.slice(-4).map(h => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`).join('\n')}\n` : ''}

CRITICAL AGENT RULES:
1. DETERMINE THE ACTION TYPE:
   - "none": User asked a purely informational question or requested advice without wanting to change the note.
   - "replace_content": User asked to edit, fix, rewrite, polish, simplify, format (add bold, colors, list styling), or restructure the note content. Provide the full new rich HTML in "content". Preserve all existing bold tags (<b>, <strong>), tables, toggles, and images.
   - "append_content": User asked to add something new (e.g., "add conclusion", "add table", "add 3 action items", "add toggle section"). Provide the new rich HTML snippet in "content".
   - "update_title": User asked to rename or change the note title. Provide "newTitle".

2. FORMATTING IN "content":
   - Use clean, standard HTML tags: <p>, <b>, <strong>, <i>, <u>, <ul>, <ol>, <li>, <table>, <tr>, <td>, <th>, <details>, <summary>, <blockquote>.
   - Do NOT wrap in markdown code blocks (\`\`\`html).
   - Do NOT output raw markdown asterisks (*, **) or hashes (#).

3. RESPONSE FORMAT:
Respond ONLY with a valid JSON object (no markdown code blocks, no text before or after):
{
  "reply": "Conversational reply in the user's language (English/Hindi/Hinglish) explaining what was done or answering their question",
  "action": "none" | "replace_content" | "append_content" | "update_title",
  "content": "Rich HTML content if action is replace_content or append_content, else empty string",
  "newTitle": "New title if action is update_title, else empty string"
}`;

  const res = await executeAICompletion(
    prompt,
    'You are an expert AI Note Agent. Output ONLY a valid JSON object with keys "reply", "action", "content", "newTitle".'
  );

  try {
    const cleanJson = res.text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    let content = parsed.content ? String(parsed.content).trim() : '';
    if (content) {
      content = content.replace(/^```(?:html)?\s*\n?/i, '').replace(/\n?```$/i, '').trim();
      const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      if (bodyMatch) content = bodyMatch[1].trim();
      content = content.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
    }

    const action = ['replace_content', 'append_content', 'update_title', 'none'].includes(parsed.action) 
      ? parsed.action 
      : 'none';

    return {
      reply: sanitizeAIText(parsed.reply || res.text),
      action: action as any,
      content: content || undefined,
      newTitle: parsed.newTitle ? sanitizeAIText(parsed.newTitle) : undefined
    };
  } catch (e) {
    return {
      reply: sanitizeAIText(res.text),
      action: 'none'
    };
  }
}

export interface NoteAuditResult {
  score: number;
  scoreLabel: string;
  strengths: string[];
  improvements: string[];
  actionItems: string[];
  keyTopics: string[];
  enhancedHtml?: string;
}

/**
 * 6. Deep Note Audit & Executive Supercharger:
 * Analyzes the note for quality, identifies critical missing information/gaps,
 * extracts action items, and generates an elevated supercharged layout.
 */
export async function aiAnalyzeAndSuperchargeNote(
  noteTitle: string,
  noteHtml: string,
  noteText: string
): Promise<NoteAuditResult> {
  const content = noteHtml || noteText || 'Empty Note';

  const prompt = `You are a world-class Executive Note Analyst & Document Architect.
Perform a comprehensive, intelligent audit of this note and generate a supercharged, beautifully structured version.

NOTE TITLE: "${noteTitle || 'Untitled'}"
NOTE CONTENT:
"""
${content}
"""

TASKS:
1. AUDIT:
   - score: Overall quality score from 1 to 100 based on clarity, readability, visual structure, and actionability.
   - scoreLabel: Brief status badge ("Needs Structure", "Good Draft", "Well Written", "Executive Ready").
   - strengths: 2 bullet points of what is already clear or good in this note.
   - improvements: 2 to 3 constructive suggestions of what is missing or how to elevate this note (e.g. missing deadlines, needs summary callout, key phrases should be bolded, action items need clear checkboxes).
   - actionItems: Array of specific tasks or follow-ups identified or recommended for this note.
   - keyTopics: 3 to 5 core topics or tags.

2. SUPERCHARGED VERSION (enhancedHtml):
   - Rewrite and elevate the note into an executive-grade, beautifully formatted rich HTML document.
   - PRESERVE 100% of all user data, facts, names, and original meaning.
   - Add bold tags (<b>) around critical keywords, metrics, and takeaways.
   - Format cleanly with HTML:
     - Sleek top "Key Takeaways" callout:
       <div style="margin: 12px 0 16px 0; padding: 12px 16px; border-radius: 12px; background: rgba(99, 102, 241, 0.08); border-left: 4px solid #6366f1;"><p style="margin: 0; font-weight: 700; color: #6366f1;">💡 Key Takeaways</p><p style="margin-top: 4px; font-size: 13px;">...</p></div>
     - Clean headings (<h2>, <h3>) for distinct sections.
     - Formatted bullet points (<ul><li>) or numbered steps (<ol><li>).
     - If action items exist, include a clean Action Checklist section at the bottom.
   - Do NOT wrap in \`\`\`html or markdown code blocks. Clean HTML only.

RETURN ONLY VALID JSON (no markdown fences):
{
  "score": 88,
  "scoreLabel": "Good Draft",
  "strengths": ["Clear goals", "Well phrased"],
  "improvements": ["Needs bold highlights", "Action items not separated"],
  "actionItems": ["Send draft to team", "Confirm timeline"],
  "keyTopics": ["Project", "Strategy"],
  "enhancedHtml": "<div>...</div>"
}`;

  const res = await executeAICompletion(
    prompt,
    'You are an expert Document Auditor. Return ONLY a valid JSON object with keys "score", "scoreLabel", "strengths", "improvements", "actionItems", "keyTopics", "enhancedHtml".'
  );

  try {
    const cleanJson = res.text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    let enhancedHtml = parsed.enhancedHtml ? String(parsed.enhancedHtml).trim() : '';
    if (enhancedHtml) {
      enhancedHtml = enhancedHtml.replace(/^```(?:html)?\s*\n?/i, '').replace(/\n?```$/i, '').trim();
      const bodyMatch = enhancedHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      if (bodyMatch) enhancedHtml = bodyMatch[1].trim();
      enhancedHtml = enhancedHtml.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
    }

    return {
      score: typeof parsed.score === 'number' ? Math.min(100, Math.max(1, parsed.score)) : 75,
      scoreLabel: sanitizeAIText(parsed.scoreLabel || 'Analyzed'),
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.map((s: string) => sanitizeAIText(s)) : [],
      improvements: Array.isArray(parsed.improvements) ? parsed.improvements.map((s: string) => sanitizeAIText(s)) : [],
      actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems.map((s: string) => sanitizeAIText(s)) : [],
      keyTopics: Array.isArray(parsed.keyTopics) ? parsed.keyTopics.map((s: string) => sanitizeAIText(s)) : [],
      enhancedHtml: enhancedHtml || undefined
    };
  } catch {
    return {
      score: 72,
      scoreLabel: 'Draft Note',
      strengths: ['Content present and readable'],
      improvements: ['Add bold highlights to important keywords', 'Structure into clear sections'],
      actionItems: [],
      keyTopics: ['Notes'],
      enhancedHtml: undefined
    };
  }
}

/**
 * 7. Generate Key Takeaways Callout Card:
 */
export async function aiGenerateTakeawaysCallout(noteTitle: string, noteText: string): Promise<string> {
  const prompt = `Analyze this note and generate a concise, high-impact "Key Takeaways" executive summary callout block in clean HTML:
Note Title: "${noteTitle}"
Note Content:
"""
${noteText.slice(0, 3000)}
"""

Format as a stylish HTML block:
<div style="margin: 14px 0 18px 0; padding: 14px 18px; border-radius: 12px; background: rgba(99, 102, 241, 0.08); border-left: 4px solid #6366f1;">
  <p style="margin: 0; font-weight: 700; color: #6366f1; font-size: 14px;">💡 Key Takeaways & Highlights</p>
  <ul style="margin: 8px 0 0 16px; padding: 0; font-size: 13px; line-height: 1.6;">
    <li><b>Key Insight 1:</b> Explanation...</li>
    <li><b>Key Insight 2:</b> Explanation...</li>
  </ul>
</div>

Output ONLY clean HTML with no markdown code fences.`;

  const res = await executeAICompletion(prompt, 'You are an executive summary writer. Output clean HTML only, no markdown.');
  let html = res.text.replace(/^```(?:html)?\s*\n?/i, '').replace(/\n?```$/i, '').trim();
  html = html.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  return html;
}

/**
 * 8. Generate Action Items Checklist:
 */
export async function aiGenerateActionChecklist(noteTitle: string, noteText: string): Promise<string> {
  const prompt = `Analyze this note and extract or recommend 3-5 concrete Action Items / Next Steps:
Note Title: "${noteTitle}"
Note Content:
"""
${noteText.slice(0, 3000)}
"""

Format as a clean HTML action checklist block:
<div style="margin: 14px 0; padding: 14px 18px; border-radius: 12px; background: rgba(16, 185, 129, 0.08); border-left: 4px solid #10b981;">
  <p style="margin: 0; font-weight: 700; color: #059669; font-size: 14px;">✅ Action Items & Next Steps</p>
  <ul style="margin: 8px 0 0 16px; padding: 0; font-size: 13px; line-height: 1.6; list-style-type: none;">
    <li style="margin-bottom: 6px;">☐ <b>Task 1:</b> Details...</li>
    <li style="margin-bottom: 6px;">☐ <b>Task 2:</b> Details...</li>
  </ul>
</div>

Output ONLY clean HTML with no markdown code fences.`;

  const res = await executeAICompletion(prompt, 'You are a task management specialist. Output clean HTML only, no markdown.');
  let html = res.text.replace(/^```(?:html)?\s*\n?/i, '').replace(/\n?```$/i, '').trim();
  html = html.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  return html;
}
