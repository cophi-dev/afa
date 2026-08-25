export interface GrokVoiceConfig {
  token: string;
  voice: string;
  systemPrompt: string;
  onStatusChange?: (status: ConnectionStatus) => void;
  onTranscript?: (text: string, isFinal: boolean, speaker: "user" | "assistant") => void;
  onError?: (error: Error) => void;
}

export type ConnectionStatus = 
  | "disconnected" 
  | "connecting" 
  | "connected" 
  | "listening" 
  | "speaking"
  | "error";

export class GrokVoiceClient {
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private audioWorklet: AudioWorkletNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private playbackQueue: Float32Array[] = [];
  private isPlaying = false;
  private config: GrokVoiceConfig;
  private status: ConnectionStatus = "disconnected";

  constructor(config: GrokVoiceConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    this.setStatus("connecting");

    try {
      this.audioContext = new AudioContext({ sampleRate: 24000 });
      
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 24000,
        },
      });

      const wsUrl = "wss://api.x.ai/v1/realtime?model=grok-voice-latest";
      this.ws = new WebSocket(wsUrl, [`xai-client-secret.${this.config.token}`]);

      this.ws.onopen = () => this.handleOpen();
      this.ws.onmessage = (event) => this.handleMessage(event);
      this.ws.onerror = (event) => this.handleError(event);
      this.ws.onclose = () => this.handleClose();
    } catch (error) {
      this.setStatus("error");
      this.config.onError?.(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  private async handleOpen(): Promise<void> {
    if (!this.ws) return;

    const sessionConfig = {
      type: "session.update",
      session: {
        voice: this.config.voice,
        instructions: this.config.systemPrompt,
        turn_detection: {
          type: "server_vad",
          silence_duration_ms: 600,
        },
        audio: {
          input: {
            format: { type: "audio/pcm", rate: 24000 },
            transport: "json",
          },
          output: {
            format: { type: "audio/pcm", rate: 24000 },
            transport: "json",
          },
        },
        input_audio_transcription: {
          model: "grok-2-vision-mini",
        },
      },
    };

    this.ws.send(JSON.stringify(sessionConfig));
    this.setStatus("connected");

    await this.startAudioCapture();
  }

  private async startAudioCapture(): Promise<void> {
    if (!this.audioContext || !this.mediaStream) return;

    await this.audioContext.audioWorklet.addModule(
      URL.createObjectURL(
        new Blob(
          [
            `
            class AudioProcessor extends AudioWorkletProcessor {
              constructor() {
                super();
                this.buffer = [];
              }
              
              process(inputs) {
                const input = inputs[0];
                if (input && input[0]) {
                  const samples = input[0];
                  const int16 = new Int16Array(samples.length);
                  for (let i = 0; i < samples.length; i++) {
                    const s = Math.max(-1, Math.min(1, samples[i]));
                    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                  }
                  this.port.postMessage(int16.buffer);
                }
                return true;
              }
            }
            registerProcessor('audio-processor', AudioProcessor);
          `,
          ],
          { type: "application/javascript" }
        )
      )
    );

    this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.audioWorklet = new AudioWorkletNode(this.audioContext, "audio-processor");

    this.audioWorklet.port.onmessage = (event) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        const base64Audio = this.arrayBufferToBase64(event.data);
        this.ws.send(
          JSON.stringify({
            type: "input_audio_buffer.append",
            audio: base64Audio,
          })
        );
      }
    };

    this.sourceNode.connect(this.audioWorklet);
    this.audioWorklet.connect(this.audioContext.destination);

    this.setStatus("listening");
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case "session.created":
        case "session.updated":
          break;

        case "input_audio_buffer.speech_started":
          this.setStatus("listening");
          break;

        case "input_audio_buffer.speech_stopped":
          break;

        case "conversation.item.input_audio_transcription.delta":
          if (data.delta) {
            this.config.onTranscript?.(data.delta, false, "user");
          }
          break;

        case "conversation.item.input_audio_transcription.completed":
          if (data.transcript) {
            this.config.onTranscript?.(data.transcript, true, "user");
          }
          break;

        case "response.output_audio.delta":
          this.setStatus("speaking");
          if (data.delta) {
            const audioData = this.base64ToFloat32(data.delta);
            this.playbackQueue.push(audioData);
            this.processPlaybackQueue();
          }
          break;

        case "response.output_audio.done":
          break;

        case "response.output_audio_transcript.delta":
          if (data.delta) {
            this.config.onTranscript?.(data.delta, false, "assistant");
          }
          break;

        case "response.output_audio_transcript.done":
          if (data.transcript) {
            this.config.onTranscript?.(data.transcript, true, "assistant");
          }
          break;

        case "response.done":
          setTimeout(() => {
            if (this.status === "speaking") {
              this.setStatus("listening");
            }
          }, 500);
          break;

        case "error":
          console.error("Grok Voice error:", data.error);
          this.config.onError?.(new Error(data.error?.message || "Unknown error"));
          break;
      }
    } catch (error) {
      console.error("Error parsing message:", error);
    }
  }

  private handleError(event: Event): void {
    console.error("WebSocket error:", event);
    this.setStatus("error");
    this.config.onError?.(new Error("WebSocket connection error"));
  }

  private handleClose(): void {
    this.setStatus("disconnected");
    this.cleanup();
  }

  private processPlaybackQueue(): void {
    if (this.isPlaying || this.playbackQueue.length === 0 || !this.audioContext) {
      return;
    }

    this.isPlaying = true;
    const audioData = this.playbackQueue.shift()!;

    const audioBuffer = this.audioContext.createBuffer(1, audioData.length, 24000);
    audioBuffer.getChannelData(0).set(audioData);

    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);

    source.onended = () => {
      this.isPlaying = false;
      this.processPlaybackQueue();
    };

    source.start();
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    this.config.onStatusChange?.(status);
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToFloat32(base64: string): Float32Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768;
    }
    return float32;
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
    }
    this.cleanup();
  }

  private cleanup(): void {
    if (this.audioWorklet) {
      this.audioWorklet.disconnect();
      this.audioWorklet = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.playbackQueue = [];
    this.isPlaying = false;
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }
}
