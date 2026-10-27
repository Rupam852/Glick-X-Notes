// Browser Web Speech API wrappers for Dictation and Text-to-Speech

export class VoiceDictation {
  private recognition: any = null;
  private isListening = false;
  private onResultCb?: (text: string, isFinal: boolean) => void;
  private onErrorCb?: (error: string) => void;
  private onEndCb?: () => void;

  constructor() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US'; // Supports bilingual Hindi/English dictation

      this.recognition.onresult = (event: any) => {
        let interim = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        if (final && this.onResultCb) {
          this.onResultCb(final, true);
        } else if (interim && this.onResultCb) {
          this.onResultCb(interim, false);
        }
      };

      this.recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        if (this.onErrorCb) {
          this.onErrorCb(event.error);
        }
      };

      this.recognition.onend = () => {
        this.isListening = false;
        if (this.onEndCb) this.onEndCb();
      };
    }
  }

  public isSupported(): boolean {
    return !!this.recognition;
  }

  public start(
    onResult: (text: string, isFinal: boolean) => void,
    onError?: (error: string) => void,
    onEnd?: () => void,
    lang = 'en-US'
  ): boolean {
    if (!this.recognition) return false;
    this.onResultCb = onResult;
    this.onErrorCb = onError;
    this.onEndCb = onEnd;
    this.recognition.lang = lang;

    try {
      this.recognition.start();
      this.isListening = true;
      return true;
    } catch (e) {
      console.warn('Could not start speech recognition:', e);
      return false;
    }
  }

  public stop(): void {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {
        // Ignore
      }
      this.isListening = false;
    }
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
