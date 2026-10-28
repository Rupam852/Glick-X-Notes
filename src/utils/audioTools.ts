// Browser Web Speech API wrappers for Dictation and Text-to-Speech

export type DictationResultCallback = (finalText: string, interimText: string) => void;
export type DictationErrorCallback = (error: string) => void;
export type DictationEndCallback = () => void;

/**
 * Smartly merges base text with newly transcribed text while eliminating
 * duplicate words or repeated phrases that frequently happen on mobile Chrome/Android.
 */
export function mergeTranscripts(base: string, addition: string): string {
  const b = (base || '').trim();
  const a = (addition || '').trim();
  if (!b) return a;
  if (!a) return b;

  // Case 1: addition already starts with or is identical to base
  if (a.toLowerCase().startsWith(b.toLowerCase())) {
    return a;
  }
  // Case 2: base already ends with addition
  if (b.toLowerCase().endsWith(a.toLowerCase())) {
    return b;
  }

  // Case 3: Overlapping boundary words check (up to 5 words overlap)
  const bWords = b.split(/\s+/);
  const aWords = a.split(/\s+/);
  const maxCheck = Math.min(bWords.length, aWords.length, 5);
  let overlapLen = 0;

  for (let len = 1; len <= maxCheck; len++) {
    const bSlice = bWords.slice(bWords.length - len).map(w => w.toLowerCase()).join(' ');
    const aSlice = aWords.slice(0, len).map(w => w.toLowerCase()).join(' ');
    if (bSlice === aSlice) {
      overlapLen = len;
    }
  }

  if (overlapLen > 0) {
    const nonOverlapping = aWords.slice(overlapLen).join(' ');
    return nonOverlapping ? `${b} ${nonOverlapping}` : b;
  }

  return `${b} ${a}`;
}

export class VoiceDictation {
  private recognition: any = null;
  private isListening = false;
  private shouldKeepListening = false;
  private onResultCb?: DictationResultCallback;
  private onErrorCb?: DictationErrorCallback;
  private onEndCb?: DictationEndCallback;
  private currentLang = 'en-IN';
  private committedText = '';
  private sessionFinalText = '';
  private restartTimer: any = null;
  private isStarting = false;

  constructor() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.initRecognition(SpeechRecognition);
    }
  }

  private initRecognition(SpeechRecognition: any) {
    try {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 1;
      this.recognition.lang = this.currentLang;

      this.recognition.onstart = () => {
        this.isListening = true;
        this.isStarting = false;
      };

      this.recognition.onresult = (event: any) => {
        let sessionFinal = '';
        let sessionInterim = '';

        // Loop over the session results safely from 0 to length
        for (let i = 0; i < event.results.length; ++i) {
          const res = event.results[i];
          if (res && res[0]) {
            if (res.isFinal) {
              sessionFinal += res[0].transcript;
            } else {
              sessionInterim += res[0].transcript;
            }
          }
        }

        this.sessionFinalText = sessionFinal;

        const currentTotal = mergeTranscripts(this.committedText, sessionFinal);
        if (this.onResultCb) {
          this.onResultCb(currentTotal, sessionInterim);
        }
      };

      this.recognition.onerror = (event: any) => {
        const error = event.error;
        console.warn('Speech recognition error:', error);

        // 'no-speech' is a normal silence timeout on phones and desktop.
        // We do NOT kill dictation on 'no-speech' if shouldKeepListening is true.
        if (error === 'no-speech' || error === 'aborted') {
          return;
        }

        if (error === 'not-allowed' || error === 'service-not-allowed') {
          this.shouldKeepListening = false;
          this.isListening = false;
          this.isStarting = false;
          if (this.onErrorCb) this.onErrorCb(error);
          return;
        }

        if (this.onErrorCb) {
          this.onErrorCb(error);
        }
      };

      this.recognition.onend = () => {
        this.isListening = false;
        this.isStarting = false;

        // Commit finalized session text so it doesn't get lost on engine restart
        if (this.sessionFinalText.trim()) {
          this.committedText = mergeTranscripts(this.committedText, this.sessionFinalText);
          this.sessionFinalText = '';
        }

        // On mobile browsers (especially Chrome Android), speech recognition
        // stops after brief pauses of silence even with continuous = true.
        // If the user hasn't explicitly paused/stopped, we seamlessly restart!
        if (this.shouldKeepListening) {
          clearTimeout(this.restartTimer);
          this.restartTimer = setTimeout(() => {
            if (this.shouldKeepListening) {
              this.safeStart();
            }
          }, 75);
        } else {
          if (this.onEndCb) this.onEndCb();
        }
      };
    } catch (e) {
      console.warn('Could not initialize SpeechRecognition:', e);
    }
  }

  private safeStart(): boolean {
    if (!this.recognition || this.isStarting) return false;
    try {
      this.isStarting = true;
      this.recognition.lang = this.currentLang;
      this.recognition.start();
      this.isListening = true;
      return true;
    } catch (e: any) {
      this.isStarting = false;
      // If already started, mark listening true
      if (e.name === 'InvalidStateError') {
        this.isListening = true;
        return true;
      }
      console.warn('Speech recognition safeStart exception:', e);
      return false;
    }
  }

  public isSupported(): boolean {
    return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  }

  public setLanguage(lang: string): void {
    this.currentLang = lang;
    if (this.recognition) {
      this.recognition.lang = lang;
    }
    // If currently listening, seamlessly reboot with new language
    if (this.shouldKeepListening) {
      clearTimeout(this.restartTimer);
      if (this.sessionFinalText.trim()) {
        this.committedText = mergeTranscripts(this.committedText, this.sessionFinalText);
        this.sessionFinalText = '';
      }
      try {
        this.recognition.stop();
      } catch (e) {
        // Ignore
      }
      this.restartTimer = setTimeout(() => {
        if (this.shouldKeepListening) {
          this.safeStart();
        }
      }, 90);
    }
  }

  public setBaseText(text: string): void {
    this.committedText = (text || '').trim();
    this.sessionFinalText = '';
  }

  public reset(): void {
    this.committedText = '';
    this.sessionFinalText = '';
  }

  public start(
    onResult: DictationResultCallback,
    onError?: DictationErrorCallback,
    onEnd?: DictationEndCallback,
    lang = 'en-IN',
    initialText = ''
  ): boolean {
    if (!this.isSupported()) return false;
    this.onResultCb = onResult;
    this.onErrorCb = onError;
    this.onEndCb = onEnd;
    this.currentLang = lang;
    this.shouldKeepListening = true;
    this.committedText = (initialText || '').trim();
    this.sessionFinalText = '';

    clearTimeout(this.restartTimer);
    return this.safeStart();
  }

  public stop(): void {
    this.shouldKeepListening = false;
    clearTimeout(this.restartTimer);
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {
        // Ignore
      }
    }
    if (this.sessionFinalText.trim()) {
      this.committedText = mergeTranscripts(this.committedText, this.sessionFinalText);
      this.sessionFinalText = '';
    }
    this.isListening = false;
    this.isStarting = false;
  }

  public getStatus(): boolean {
    return this.isListening;
  }
}

export class AudioReader {
  private utterance: SpeechSynthesisUtterance | null = null;
  private isPlaying = false;

  public isSupported(): boolean {
    return 'speechSynthesis' in window;
  }

  public speak(
    text: string, 
    onEnd?: () => void, 
    onError?: (err: any) => void
  ): boolean {
    if (!this.isSupported()) return false;
    this.stop();

    const clean = text.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
    if (!clean) return false;

    this.utterance = new SpeechSynthesisUtterance(clean);
    this.utterance.rate = 1.0;
    this.utterance.pitch = 1.0;

    this.utterance.onend = () => {
      this.isPlaying = false;
      if (onEnd) onEnd();
    };

    this.utterance.onerror = (e) => {
      this.isPlaying = false;
      if (onError) onError(e);
    };

    window.speechSynthesis.speak(this.utterance);
    this.isPlaying = true;
    return true;
  }

  public pause(): void {
    if (this.isSupported() && this.isPlaying) {
      window.speechSynthesis.pause();
    }
  }

  public resume(): void {
    if (this.isSupported()) {
      window.speechSynthesis.resume();
    }
  }

  public stop(): void {
    if (this.isSupported()) {
      window.speechSynthesis.cancel();
      this.isPlaying = false;
    }
  }

  public getStatus(): boolean {
    return this.isSupported() && window.speechSynthesis.speaking && !window.speechSynthesis.paused;
  }
}

export const voiceDictation = new VoiceDictation();
export const audioReader = new AudioReader();
