"use client";

import { markCreditsStale } from "@/lib/credits/client";

/** Send the student's words after this much silence. */
const SILENCE_MS = 2500;
/** Stop listening if nothing at all is said for this long (saves credits). */
const IDLE_MS = 20_000;
/** Audio held while Deepgram connects: up to 15 s of 100 ms packets. */
const MAX_PENDING_PACKETS = 150;

/**
 * AudioWorklet that turns microphone audio into 16 kHz 16-bit PCM in 100 ms packets.
 * Resampling in the worklet (rather than forcing the AudioContext to 16 kHz) works in every browser.
 */
const WORKLET = `
class PcmDownsampler extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / 16000;
    this.phase = 0; this.sum = 0; this.count = 0;
    this.out = new Int16Array(1600); this.n = 0;
  }
  process(inputs) {
    const input = inputs[0] && inputs[0][0];
    if (!input) return true;
    for (let i = 0; i < input.length; i++) {
      this.sum += input[i]; this.count++; this.phase += 1;
      if (this.phase >= this.ratio) {
        this.phase -= this.ratio;
        const v = Math.max(-1, Math.min(1, this.sum / this.count));
        this.out[this.n++] = v < 0 ? v * 0x8000 : v * 0x7fff;
        this.sum = 0; this.count = 0;
        if (this.n === this.out.length) {
          this.port.postMessage(this.out.buffer, [this.out.buffer]);
          this.out = new Int16Array(1600); this.n = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor("pcm-downsampler", PcmDownsampler);
`;

type Blocked = { error: string; resetsAt?: string; reason?: string };

export type TranscriberEvents = {
  /** The mic is live and audio is being captured: the student can start talking. */
  onReady: () => void;
  /** Everything heard so far in this utterance, including words still being recognised. */
  onText: (text: string) => void;
  /** The student paused: here is what they said. Listening has stopped. */
  onUtterance: (text: string) => void;
  /** Nothing was said for a while; listening has stopped. */
  onIdle: () => void;
  onBlocked: (body: Blocked) => void;
  onError: (message: string) => void;
};

/**
 * Streams the microphone straight to Deepgram (via a short-lived token from our server) and shows
 * words as they are spoken. One instance per utterance: call start(), then it stops itself on pause.
 */
export class LiveTranscriber {
  private ws: WebSocket | null = null;
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private sessionId: string | null = null;
  private startedAt = 0;
  private streamingSince = 0;
  private pending: ArrayBuffer[] = [];
  private lastSpeechAt = 0;
  private finals: string[] = [];
  private interim = "";
  private stopped = false;
  private readonly onPageHide = () => this.reportEnd(true);

  constructor(private readonly events: TranscriberEvents) {}

  async start(topicId: string): Promise<boolean> {
    // The server prepares the session while the mic starts: both take a moment.
    const session = fetch("/api/voice/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ topicId }),
    })
      .then(async (res) => ({ status: res.status, ok: res.ok, body: await res.json() }))
      .catch(() => ({ status: 0, ok: false, body: {} as Record<string, string> }));
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      });
      if (this.stopped) return this.cleanup(), false;

      // Capture straight away and hold the audio until Deepgram is connected, so the first
      // words aren't lost if the student starts talking immediately.
      await this.startCapture();
      this.startedAt = Date.now();
      this.lastSpeechAt = this.startedAt;
      this.events.onReady();

      const { status, ok, body } = await session;
      if (!ok) {
        if (status === 402) this.events.onBlocked(body as Blocked);
        else this.events.onError(body.error ?? "Voice isn't available right now. Please type instead.");
        this.stop();
        return false;
      }
      this.sessionId = body.sessionId;
      window.addEventListener("pagehide", this.onPageHide);
      if (this.stopped) return this.cleanup(), false;

      const ws = new WebSocket(body.url, ["bearer", body.token]);
      this.ws = ws;
      ws.onmessage = (e) => this.handleMessage(JSON.parse(e.data));
      ws.onerror = () => this.fail("Lost the connection to voice. Please try again or type instead.");
      ws.onclose = (e) => {
        if (!this.stopped && e.code !== 1000) this.fail("Lost the connection to voice. Please try again or type instead.");
      };
      await new Promise<void>((resolve, reject) => {
        ws.addEventListener("open", () => resolve(), { once: true });
        ws.addEventListener("error", () => reject(new Error("ws")), { once: true });
      });
      this.streamingSince = Date.now();
      for (const packet of this.pending.splice(0)) ws.send(packet);

      this.timer = setInterval(() => this.checkPause(), 200);
      return true;
    } catch (err) {
      // If the mic failed after the server opened a session, close it without charge.
      void session.then(({ ok, body }) => {
        if (ok && !this.sessionId) {
          this.sessionId = body.sessionId;
          this.streamingSince = 0;
          this.reportEnd(false);
        }
      });
      const denied = err instanceof DOMException && err.name === "NotAllowedError";
      this.fail(
        denied
          ? "Microphone access is blocked. Allow it in your browser settings, or type instead."
          : "Couldn't start the microphone. Please try again or type instead.",
      );
      return false;
    }
  }

  /** Starts turning mic audio into PCM packets: sent live once connected, buffered until then. */
  private async startCapture() {
    this.context = new AudioContext();
    const url = URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" }));
    await this.context.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    const source = this.context.createMediaStreamSource(this.stream!);
    const node = new AudioWorkletNode(this.context, "pcm-downsampler");
    node.port.onmessage = (e) => {
      if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(e.data);
      else if (this.pending.length < MAX_PENDING_PACKETS) this.pending.push(e.data);
    };
    source.connect(node);
  }

  /** Stops listening without sending anything. */
  stop() {
    if (this.stopped) return;
    this.stopped = true;
    this.cleanup();
  }

  private get text() {
    return [...this.finals, this.interim].filter(Boolean).join(" ").trim();
  }

  private handleMessage(m: { type: string; is_final?: boolean; channel?: { alternatives: { transcript: string }[] } }) {
    if (m.type === "SpeechStarted") {
      this.lastSpeechAt = Date.now();
      return;
    }
    if (m.type !== "Results") return;
    const transcript = m.channel?.alternatives[0]?.transcript ?? "";
    if (transcript) this.lastSpeechAt = Date.now();
    if (m.is_final) {
      if (transcript) this.finals.push(transcript);
      this.interim = "";
    } else {
      this.interim = transcript;
    }
    this.events.onText(this.text);
  }

  private checkPause() {
    const now = Date.now();
    const text = this.text;
    if (text && now - this.lastSpeechAt >= SILENCE_MS) {
      this.stop();
      this.events.onUtterance(text);
    } else if (!text && now - this.startedAt >= IDLE_MS) {
      this.stop();
      this.events.onIdle();
    }
  }

  private fail(message: string) {
    if (this.stopped) return;
    this.stop();
    this.events.onError(message);
  }

  private cleanup() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ type: "CloseStream" }));
    this.ws?.close(1000);
    this.ws = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    void this.context?.close().catch(() => {});
    this.context = null;
    this.pending = [];
    this.reportEnd(false);
  }

  /** Tells the server listening has ended so it can charge for the mic time. */
  private reportEnd(unloading: boolean) {
    if (!this.sessionId) return;
    const body = JSON.stringify({
      sessionId: this.sessionId,
      // Deepgram bills all audio it received, including what was held while connecting.
      seconds: this.streamingSince ? (Date.now() - this.startedAt) / 1000 : 0,
    });
    this.sessionId = null;
    window.removeEventListener("pagehide", this.onPageHide);
    if (unloading) navigator.sendBeacon("/api/voice/session/end", new Blob([body], { type: "application/json" }));
    else
      void fetch("/api/voice/session/end", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true })
        .then(markCreditsStale)
        .catch(() => {});
  }
}
