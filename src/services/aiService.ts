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

async function callGemini(
  apiKey: string, 
  model: string, 
  prompt: string, 
  systemInstruction?: string,
  images?: { mimeType: string; data: string }[]
): Promise<string> {
  const parts: any[] = [{ text: prompt }];

  if (images && images.length > 0) {
    images.forEach(img => {
      const cleanData = img.data.replace(/^data:[^;]+;base64,/, '').trim();
      parts.push({
        inlineData: {
          mimeType: img.mimeType || 'image/jpeg',
          data: cleanData
        }
      });
    });
  }

  const body: any = {
    contents: [{ parts }]
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
export async function executeAICompletion(
  prompt: string, 
  systemInstruction?: string,
  images?: { mimeType: string; data: string }[]
): Promise<{ text: string; providerUsed: string; modelUsed: string }> {
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
      const text = await callGemini(key, currentModel, prompt, systemInstruction, images);
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
 * Automatically detects and converts raw markdown badges, images, and links
 * into proper HTML <a> and <img> tags so they render visually instead of as raw markdown text.
 */
export function convertMarkdownBadgesAndLinksToHtml(html: string): string {
  if (!html) return '';

  // Protect pre/code blocks from conversion so code snippets aren't mutated
  const codeBlocks: string[] = [];
  let protectedHtml = html.replace(/<pre[\s\S]*?<\/pre>/gi, (match) => {
    codeBlocks.push(match);
    return `<!--__GLICK_CODE_BLOCK_${codeBlocks.length - 1}__-->`;
  });

  // 1. Linked image badges: [![alt](img_url)](link_url)
  // Handles cases where link is on next line or separated by </p><p> or whitespace
  protectedHtml = protectedHtml.replace(
    /\[!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)\](?:\s*|<\/p>\s*<p[^>]*>|<br\s*\/?>)*\((https?:\/\/[^)\s]+)\)/gi,
    (_match, alt, imgUrl, linkUrl) => {
      const cleanAlt = (alt || 'Badge').trim();
      const cleanImg = imgUrl.trim();
      const cleanLink = linkUrl.trim();
      return `<a href="${cleanLink}" target="_blank" rel="noopener noreferrer" style="display: inline-block; vertical-align: middle; margin: 3px 4px; text-decoration: none;"><img src="${cleanImg}" alt="${cleanAlt}" style="display: inline-block; vertical-align: middle; border-radius: 4px; max-height: 24px;" /></a>`;
    }
  );

  // 2. Standalone badges / images in [![alt](img_url)]
  protectedHtml = protectedHtml.replace(
    /\[!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)\]/gi,
    (_match, alt, imgUrl) => {
      const cleanAlt = (alt || 'Badge').trim();
      const cleanImg = imgUrl.trim();
      return `<img src="${cleanImg}" alt="${cleanAlt}" style="display: inline-block; vertical-align: middle; margin: 3px 4px; border-radius: 4px; max-height: 24px;" />`;
    }
  );

  // 3. Regular markdown images: ![alt](img_url)
  protectedHtml = protectedHtml.replace(
    /!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/gi,
    (_match, alt, imgUrl) => {
      const cleanAlt = (alt || 'Image').trim();
      const cleanImg = imgUrl.trim();
      const isBadge = cleanImg.includes('shields.io') || cleanImg.includes('/badge/');
      if (isBadge) {
        return `<img src="${cleanImg}" alt="${cleanAlt}" style="display: inline-block; vertical-align: middle; margin: 3px 4px; border-radius: 4px; max-height: 24px;" />`;
      }
      return `<img src="${cleanImg}" alt="${cleanAlt}" style="max-width: 100%; border-radius: 8px; margin: 6px 0; display: inline-block; vertical-align: middle;" />`;
    }
  );

  // 4. Regular markdown links: [text](link_url)
  protectedHtml = protectedHtml.replace(
    /(^|[^!])\[([^\]\n]+)\](?:\s*|<\/p>\s*<p[^>]*>|<br\s*\/?>)*\((https?:\/\/[^)\s]+)\)/gi,
    (_match, prefix, text, linkUrl) => {
      const cleanText = text.trim();
      const cleanLink = linkUrl.trim();
      return `${prefix}<a href="${cleanLink}" target="_blank" rel="noopener noreferrer" style="color: #4f46e5; text-decoration: underline; font-weight: 500;">${cleanText}</a>`;
    }
  );

  // 5. Convert markdown bold **text** to <b>text</b>
  protectedHtml = protectedHtml.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');

  // 6. Convert markdown headings inside <p> tags
  protectedHtml = protectedHtml.replace(/<p[^>]*>\s*###\s+([^<]+)<\/p>/gi, '<h3 style="font-size: 1.25rem; font-weight: 700; margin: 12px 0 6px;">$1</h3>');
  protectedHtml = protectedHtml.replace(/<p[^>]*>\s*##\s+([^<]+)<\/p>/gi, '<h2 style="font-size: 1.45rem; font-weight: 800; margin: 14px 0 8px;">$1</h2>');
  protectedHtml = protectedHtml.replace(/<p[^>]*>\s*#\s+([^<]+)<\/p>/gi, '<h1 style="font-size: 1.75rem; font-weight: 900; margin: 16px 0 10px;">$1</h1>');

  // Clean empty paragraphs leftover from split lines
  protectedHtml = protectedHtml.replace(/<p[^>]*>\s*<\/p>/gi, '');

  // Restore code blocks
  for (let i = 0; i < codeBlocks.length; i++) {
    protectedHtml = protectedHtml.replace(`<!--__GLICK_CODE_BLOCK_${i}__-->`, codeBlocks[i]);
  }

  return protectedHtml;
}

/**
 * Converts sanitized plain text into clean, rich HTML for the Note Editor.
 * Renders bullet lines as proper <ul><li> and paragraphs as <p>, avoiding any raw markdown.
 */
export function formatAITextToEditorHtml(text: string): string {
  if (!text) return '';
  const converted = convertMarkdownBadgesAndLinksToHtml(text);
  const clean = sanitizeAIText(converted);
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
  return convertMarkdownBadgesAndLinksToHtml(html);
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

  // Convert any accidental markdown formatting, badges, or links into proper HTML
  polished = convertMarkdownBadgesAndLinksToHtml(polished);
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
 * Resilient JSON extractor for LLM outputs.
 * Parses JSON even if unescaped newlines, backticks, or quotes break JSON.parse.
 */
function extractJsonFromAIResponse(rawText: string): any {
  if (!rawText) return null;
  let clean = rawText.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();

  // 1. Direct JSON.parse
  try {
    return JSON.parse(clean);
  } catch (e) {}

  // 2. Locate outermost braces { ... }
  const firstBrace = clean.indexOf('{');
  const lastBrace = clean.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    clean = clean.slice(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(clean);
  } catch (e) {}

  // 3. Robust regex-based field extractor (handles unescaped literal newlines/quotes)
  let reply = '';
  let action = 'none';
  let content = '';
  let newTitle = '';

  const actionMatch = clean.match(/"action"\s*:\s*"(replace_content|append_content|update_title|none)"/i);
  if (actionMatch) {
    action = actionMatch[1];
  }

  const replyMatch = clean.match(/"reply"\s*:\s*"([\s\S]*?)"\s*,\s*"(?:action|content|newTitle)"/i)
    || clean.match(/"reply"\s*:\s*"([\s\S]*?)"\s*[,}]/i);
  if (replyMatch) {
    reply = replyMatch[1];
  }

  const contentMatch = clean.match(/"content"\s*:\s*"([\s\S]*)"\s*,\s*"newTitle"/i)
    || clean.match(/"content"\s*:\s*"([\s\S]*)"\s*}/i);
  if (contentMatch) {
    content = contentMatch[1];
  }

  const titleMatch = clean.match(/"newTitle"\s*:\s*"([\s\S]*?)"\s*}/i);
  if (titleMatch) {
    newTitle = titleMatch[1];
  }

  if (reply || content || action !== 'none') {
    return {
      reply: reply.replace(/\\"/g, '"').replace(/\\n/g, '\n'),
      action,
      content: content.replace(/\\"/g, '"').replace(/\\n/g, '\n'),
      newTitle: newTitle.replace(/\\"/g, '"')
    };
  }

  return null;
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
  history: { role: string; content: string }[] = [],
  images?: { mimeType: string; data: string }[]
): Promise<AIAgentChatResult> {
  const noteContext = noteHtml || noteText || 'Empty Note';

  const prompt = `You are an intelligent, high-capability AI Note Agent for "Glick X Notes".
You can answer questions with deep insight, analyze attached images/diagrams/screenshots, AND directly modify, update, append to, or format the user's note based on their conversational instructions (in English, Hindi, or Hinglish).

CURRENT NOTE TITLE:
"${noteTitle || 'Untitled'}"

CURRENT NOTE CONTENT (HTML):
"""
${noteContext}
"""

USER INSTRUCTION / QUESTION:
"${userMessage}"
${images && images.length > 0 ? `\n[NOTE: The user has attached ${images.length} image(s)/photo(s). Inspect every detail, text, formula, chart, code or visual element in these images carefully and synthesize them thoroughly in your response.]\n` : ''}

${history.length > 0 ? `RECENT CHAT HISTORY:\n${history.slice(-6).map(h => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`).join('\n')}\n` : ''}

CRITICAL QUALITY & CONTENT DEPTH GUIDELINES:
1. COMPREHENSIVE, IN-DEPTH, DETAILED ANSWERS:
   - Provide rich, thorough, well-explained and detailed responses. Never give lazy 1-2 sentence replies.
   - When asked to explain, write, summarize, or solve anything, provide in-depth analysis, structured sections, bullet points, key takeaways, and relevant examples.
   - When replying to questions, break down complex concepts into step-by-step clarity.

2. VISION / MULTIMODAL UNDERSTANDING:
   - If images are provided (e.g. photos of handwritten notes, textbooks, whiteboard sketches, graphs, flowcharts, code screenshots, or errors):
     - Extract, transcribe, analyze, or explain the visual content with 100% precision.
     - Correlate the images with the user's note and question.

3. DETERMINE THE ACTION TYPE:
   - "none": User asked a purely informational question or asked for an explanation without wanting to change the note. Provide an extensive, detailed answer in "reply", and set "content" to "".
   - "replace_content": User asked to edit, fix, rewrite, polish, simplify, format, or update the existing note content. Provide the full new rich HTML in "content". Preserve all existing bold tags (<b>, <strong>), tables, toggles, and images.
   - "append_content": User asked to add something new (e.g. "add toggle snippet", "add code snippet", "add conclusion", "add table", "add 3 action items"). Provide the new rich HTML snippet in "content".
   - "update_title": User asked to rename or change the note title. Provide "newTitle".

4. RICH COMPONENT SNIPPET TEMPLATES:
   - When asked for a Toggle / Collapsible snippet:
     <details class="glick-block-wrapper glick-toggle" style="margin: 12px 0; padding: 10px 14px; border: 1px solid rgba(148, 163, 184, 0.35); border-radius: 12px; background: rgba(248, 250, 252, 0.5);"><summary style="font-weight: 700; cursor: pointer; color: #4f46e5; display: flex; align-items: center; gap: 8px;"><span class="glick-toggle-arrow" contenteditable="false">▶</span> Toggle Title</summary><div style="margin-top: 8px; padding-left: 24px;"><p>Details here...</p></div></details>
   - When asked for a Code snippet:
     <div class="glick-block-wrapper glick-code-container" style="margin: 12px 0; border-radius: 12px; overflow: hidden; border: 1px solid #334155; background: #0f172a;"><div style="padding: 6px 12px; background: #1e293b; color: #94a3b8; font-size: 11px; font-weight: 700;">CODE</div><pre style="margin: 0; padding: 12px; color: #e2e8f0; font-family: monospace; font-size: 13px;"><code>// Your code here</code></pre></div>
   - When asked for a Callout box:
     <div class="glick-block-wrapper glick-callout" style="margin: 12px 0; padding: 12px 16px; border-radius: 12px; background: rgba(99, 102, 241, 0.08); border-left: 4px solid #6366f1;"><p style="margin: 0; font-weight: 700; color: #6366f1;">💡 Important Note</p><p style="margin-top: 4px;">...</p></div>

5. FORMATTING RESTRICTIONS:
   - Output clean HTML ONLY.
   - NEVER output markdown image or badge syntax like [![Python](...)](...) or ![alt](...). If including badges or images, use real HTML: <a href="url" target="_blank" rel="noopener noreferrer"><img src="badge_url" alt="alt" style="display:inline-block; vertical-align:middle; margin:2px;" /></a>.
   - NEVER output markdown links like [text](url). Use <a href="url" target="_blank">text</a>.
   - NEVER output markdown headings like "### Title". Use <h3>Title</h3>.

6. RESPONSE FORMAT:
Respond ONLY with a valid JSON object:
{
  "reply": "Comprehensive, conversational reply in the user's language (English/Hindi/Hinglish) with clear formatting, rich explanations, and depth",
  "action": "none" | "replace_content" | "append_content" | "update_title",
  "content": "Rich HTML content if action is replace_content or append_content, else empty string",
  "newTitle": "New title if action is update_title, else empty string"
}`;

  const res = await executeAICompletion(
    prompt,
    'You are an expert AI Note Agent. Output ONLY a valid JSON object with keys "reply", "action", "content", "newTitle".'
  );

  const extracted = extractJsonFromAIResponse(res.text);
  if (extracted) {
    let content = extracted.content ? String(extracted.content).trim() : '';
    if (content) {
      content = content.replace(/^```(?:html)?\s*\n?/i, '').replace(/\n?```$/i, '').trim();
      const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      if (bodyMatch) content = bodyMatch[1].trim();
      content = convertMarkdownBadgesAndLinksToHtml(content);
    }

    const action = ['replace_content', 'append_content', 'update_title', 'none'].includes(extracted.action)
      ? extracted.action
      : (content ? 'replace_content' : 'none');

    // Make sure reply does not display raw JSON
    let cleanReply = extracted.reply ? sanitizeAIText(extracted.reply) : 'Aapke kehne par note me changes kar diye gaye hain.';
    if (cleanReply.startsWith('{') && cleanReply.includes('"reply"')) {
      cleanReply = 'Aapke instructions ke anusaar note update kar diya gaya hai.';
    }

    return {
      reply: cleanReply,
      action: action as any,
      content: content || undefined,
      newTitle: extracted.newTitle ? sanitizeAIText(extracted.newTitle) : undefined
    };
  }

  // If response was not JSON:
  let fallbackReply = sanitizeAIText(res.text);
  if (fallbackReply.startsWith('{') && fallbackReply.includes('"reply"')) {
    const m = fallbackReply.match(/"reply"\s*:\s*"([\s\S]*?)"/i);
    fallbackReply = m ? m[1] : 'Note updated with requested changes.';
  }

  return {
    reply: fallbackReply,
    action: 'none'
  };
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

CRITICAL INSTRUCTIONS:
1. FULL NOTE SCAN & AUDIT (DO NOT SHORTEN OR CUT):
   - Scan and analyze the ENTIRE note thoroughly without cutting or skipping any part.
   - score: Overall quality score from 1 to 100 based on clarity, readability, structure, and actionability.
   - scoreLabel: Brief status badge ("Needs Structure", "Good Draft", "Well Written", "Executive Ready").
   - strengths: 2 to 3 bullet points highlighting what is already clear, useful, or well-written in this note.
   - improvements: 3 to 4 constructive, specific suggestions of what is missing, how to elevate the note, missing gaps, and formatting suggestions.
   - actionItems: Array of specific tasks or follow-ups identified or recommended for this note.
   - keyTopics: 3 to 5 core topics or tags.

2. SUPERCHARGED FULL VERSION (enhancedHtml):
   - CRITICAL: DO NOT SHORTEN, SUMMARIZE, OR CONDENSE. Keep 100% of all paragraphs, explanations, code blocks, lists, details, and context at FULL length.
   - PRESERVE 100% of all user data, facts, names, links, code, and original meaning.
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
      enhancedHtml = convertMarkdownBadgesAndLinksToHtml(enhancedHtml);
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
  html = convertMarkdownBadgesAndLinksToHtml(html);
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
  html = convertMarkdownBadgesAndLinksToHtml(html);
  return html;
}

/**
 * 9. AI Mermaid Flowchart & Mindmap Generator:
 */
export async function aiGenerateMermaidDiagram(description: string, noteContext?: string): Promise<string> {
  const prompt = `Generate a valid, elegant Mermaid diagram based on this request:
Request: "${description}"
${noteContext ? `Note Context:\n"""\n${noteContext.slice(0, 2000)}\n"""\n` : ''}

CRITICAL RULES:
- Return ONLY the raw Mermaid diagram code (e.g. flowchart TD, mindmap, sequenceDiagram, etc.).
- Do NOT wrap in \`\`\`mermaid or markdown fences.
- Use valid Mermaid syntax with safe labels (e.g. ["Clean Label"]).
- Keep it visually organized, intuitive, and professional.`;

  const res = await executeAICompletion(prompt, 'You are an expert Mermaid diagram architect. Output ONLY valid Mermaid code, no markdown code fences.');
  let code = res.text.replace(/^```(?:mermaid)?\s*\n?/i, '').replace(/\n?```$/i, '').trim();
  return code;
}

/**
 * 10. AI Math LaTeX Formula Generator:
 */
export async function aiGenerateMathFormula(description: string): Promise<string> {
  const prompt = `Convert the following mathematical concept or equation into valid LaTeX formula code:
Request: "${description}"

CRITICAL RULES:
- Output ONLY the raw LaTeX string suitable for KaTeX.
- Do NOT wrap in $ or $$ or \`\`\`latex.
- Example: \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}
- Example: \\int_{0}^{\\infty} e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}`;

  const res = await executeAICompletion(prompt, 'You are a LaTeX math specialist. Output ONLY the raw LaTeX formula code, no markdown.');
  let latex = res.text.replace(/^```(?:latex|tex)?\s*\n?/i, '').replace(/\n?```$/i, '').replace(/^\$+|\$+$/g, '').trim();
  return latex;
}
