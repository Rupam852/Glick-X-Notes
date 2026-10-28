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

// 2. Grammar & Tone Polisher
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
