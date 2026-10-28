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
      apiKey: (import.meta.env.VITE_GEMINI_API_KEY as string) || ''
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

    return {
      mode: parsed.mode === 'custom' ? 'custom' : 'default',
      gemini: {
        model: geminiModel,
        apiKey: parsed.mode === 'custom' 
          ? (parsed.gemini?.apiKey || '') 
          : ((import.meta.env.VITE_GEMINI_API_KEY as string) || '')
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
  const key = config.mode === 'custom' 
    ? config.gemini.apiKey 
    : ((import.meta.env.VITE_GEMINI_API_KEY as string) || '');
  
  if (!key) {
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

// 1. AI Summary
export async function aiSummarizeNote(noteText: string): Promise<string> {
  const prompt = `Please analyze the following note content and produce a concise summary with:
1. A brief 2-sentence overview
2. 3 to 5 key bullet points
3. Action items (if any exist in the text)

Note Content:
"""
${noteText}
"""`;

  const res = await executeAICompletion(prompt, 'You are an intelligent note-taking assistant. Format your response cleanly using markdown.');
  return res.text;
}

// 2. Grammar & Tone Polisher
export async function aiPolishText(noteText: string, tone: 'professional' | 'casual' | 'concise'): Promise<string> {
  const prompt = `Rewrite the following note text in a ${tone.toUpperCase()} tone. Fix any spelling, punctuation, and grammar mistakes while preserving all core facts, links, and meaning.

Note Content:
"""
${noteText}
"""`;

  const res = await executeAICompletion(prompt, `You are an expert editor. Rewrite the text cleanly in a ${tone} tone without conversational filler.`);
  return res.text;
}

// 3. Smart Title & Tag Suggestion
export async function aiSuggestTitleAndTags(noteText: string): Promise<{ title: string; tags: string[] }> {
  const prompt = `Analyze this note and suggest:
1. One concise, engaging title (maximum 6 words)
2. Up to 4 relevant tags (lowercase, single-word or hyphenated, e.g., "ideas", "meeting-notes", "project")

Return your response in pure JSON format with keys "title" and "tags":
{"title": "...", "tags": ["tag1", "tag2"]}

Note Content:
"""
${noteText.slice(0, 2000)}
"""`;

  const res = await executeAICompletion(prompt, 'You are a metadata assistant. Output ONLY valid JSON, with no markdown code fences or other text.');
  try {
    const cleanJson = res.text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);
    return {
      title: parsed.title || 'Untitled Note',
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
  promptContext += `User Question: ${question}\n\nAnswer helpfully and concisely using the note context:`;

  const res = await executeAICompletion(promptContext, 'You are a helpful AI assistant answering questions about the user\'s current note. Be clear, accurate, and concise.');
  return res.text;
}
