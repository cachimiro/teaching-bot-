"use client";

import { speechPlan, type StepRef } from "./speech-plan";

type Blocked = { error: string; resetsAt?: string; reason?: string };

/** MP3 bytes for one chunk of speech, readable while they are still downloading. */
class AudioStream {
  readonly parts: Uint8Array[] = [];
  /** Which working-out step this chunk narrates, if any. */
  step: StepRef | undefined;
  done = false;
  private waiters: (() => void)[] = [];

  static complete(parts: Uint8Array[], step?: StepRef) {
    const s = new AudioStream();
    s.step = step;
    s.parts.push(...parts);
    s.done = true;
    return s;
  }

  push(part: Uint8Array) {
    this.parts.push(part);
    this.wake();
  }

  finish() {
    this.done = true;
    this.wake();
  }

  async *chunks() {
    let i = 0;
    for (;;) {
      while (i < this.parts.length) yield this.parts[i++];
      if (this.done) return;
      await new Promise<void>((r) => this.waiters.push(r));
    }
  }

  async finished() {
    while (!this.done) await new Promise<void>((r) => this.waiters.push(r));
  }

  private wake() {
    const w = this.waiters;
    this.waiters = [];
    w.forEach((r) => r());
  }
}

type MediaSourceCtor = typeof MediaSource;
function streamingSource(): MediaSourceCtor | null {
  const w = window as unknown as { ManagedMediaSource?: MediaSourceCtor; MediaSource?: MediaSourceCtor };
  const MS = w.ManagedMediaSource ?? w.MediaSource;
  return MS && MS.isTypeSupported("audio/mpeg") ? MS : null;
}

/**
 * Plays tutor replies aloud, one voice at a time.
 * - Text is spoken in chunks. Each chunk's audio starts downloading as soon as it's queued and starts
 *   playing as soon as the first bytes arrive (Media Source Extensions), so there's no wait for whole clips.
 * - Starting anything new stops whatever was playing (no overlapping voices).
 * - Finished replies are cached, so "Listen" again is instant and isn't charged twice.
 */
export class SpeechPlayer {
  private queue: AudioStream[] = [];
  private cache = new Map<string, { parts: Uint8Array[]; step?: StepRef }[]>();
  private recording: AudioStream[] | null = null;
  private audio: HTMLAudioElement | null = null;
  private abort: AbortController | null = null;
  private generation = 0;
  private streamEnded = true;
  private looping = false;
  private idleResolvers: (() => void)[] = [];
  key: string | null = null;
  private audible = false;

  constructor(
    private readonly events: {
      onChange: (playingKey: string | null) => void;
      /** True while sound is actually coming out (not just loading). */
      onAudible: (audible: boolean) => void;
      /** The working-out step now being spoken (null between steps and at the end). */
      onStep: (key: string, step: StepRef | null) => void;
      onBlocked: (body: Blocked) => void;
      onCharged: () => void;
    },
  ) {}

  /** Starts speaking a reply that is still streaming; call push() with each new chunk and end() when done. */
  startStream(key: string) {
    this.stop();
    this.begin(key);
    this.streamEnded = false;
    this.recording = [];
  }

  push(text: string, step?: StepRef) {
    if (this.key === null || !text.trim()) return;
    const stream = this.fetchAudio(text, this.generation);
    stream.step = step;
    this.queue.push(stream);
    this.recording?.push(stream);
    void this.loop(this.generation);
  }

  end() {
    this.streamEnded = true;
    void this.loop(this.generation);
  }

  /** Plays a finished reply (the Listen button): from cache if it has been spoken before. */
  play(key: string, markdown: string) {
    this.stop();
    this.begin(key);
    const cached = this.cache.get(key);
    if (cached) {
      this.queue = cached.map((c) => AudioStream.complete(c.parts, c.step));
    } else {
      const gen = this.generation;
      this.queue = speechPlan(markdown, true).map((seg) => {
        const stream = this.fetchAudio(seg.text, gen);
        stream.step = seg.step;
        return stream;
      });
      this.recording = [...this.queue];
    }
    this.streamEnded = true;
    void this.loop(this.generation);
  }

  stop() {
    this.generation++;
    this.abort?.abort();
    this.abort = null;
    this.audio?.pause();
    this.audio = null;
    this.queue = [];
    this.recording = null;
    this.streamEnded = true;
    this.looping = false;
    if (this.key !== null) {
      this.events.onStep(this.key, null);
      this.key = null;
      this.events.onChange(null);
    }
    this.setAudible(false);
    this.flushIdle();
  }

  /** Resolves once nothing is playing or queued (immediately if already idle). */
  whenIdle(): Promise<void> {
    if (this.key === null) return Promise.resolve();
    return new Promise((resolve) => this.idleResolvers.push(resolve));
  }

  private begin(key: string) {
    this.key = key;
    this.abort = new AbortController();
    this.events.onChange(key);
  }

  private fetchAudio(text: string, gen: number): AudioStream {
    const stream = new AudioStream();
    void (async () => {
      try {
        const res = await fetch("/api/voice/speak", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text }),
          signal: this.abort?.signal,
        });
        if (gen !== this.generation) return;
        if (res.status === 402) {
          this.events.onBlocked(await res.json());
          this.stop();
          return;
        }
        if (!res.ok || !res.body) return;
        const reader = res.body.getReader();
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          stream.push(value);
        }
        this.events.onCharged();
      } catch {
        // Aborted or network error: the chunk is skipped.
      } finally {
        stream.finish();
      }
    })();
    return stream;
  }

  private async loop(gen: number) {
    if (this.looping) return;
    this.looping = true;
    try {
      while (gen === this.generation) {
        const stream = this.queue.shift();
        if (!stream) {
          if (this.streamEnded) break;
          await new Promise((r) => setTimeout(r, 50));
          continue;
        }
        if (this.key !== null) this.events.onStep(this.key, stream.step ?? null);
        await this.playStream(stream, gen);
      }
      if (gen !== this.generation) return;
      if (this.key !== null && this.recording) {
        await Promise.all(this.recording.map((s) => s.finished()));
        const complete = this.recording.every((s) => s.parts.length > 0);
        if (complete) this.cache.set(this.key, this.recording.map((s) => ({ parts: s.parts, step: s.step })));
      }
      if (this.key !== null) this.events.onStep(this.key, null);
      this.key = null;
      this.recording = null;
      this.events.onChange(null);
      this.setAudible(false);
      this.flushIdle();
    } finally {
      if (gen === this.generation) this.looping = false;
    }
  }

  private async playStream(stream: AudioStream, gen: number) {
    const MS = streamingSource();
    if (MS) return this.playWithMediaSource(MS, stream, gen);
    await stream.finished();
    if (gen !== this.generation || stream.parts.length === 0) return;
    return this.playUrl(URL.createObjectURL(new Blob(stream.parts as BlobPart[], { type: "audio/mpeg" })), gen);
  }

  /** Starts playback as soon as the first bytes arrive. */
  private async playWithMediaSource(MS: MediaSourceCtor, stream: AudioStream, gen: number) {
    const source = new MS();
    const url = URL.createObjectURL(source);
    const el = new Audio();
    (el as HTMLAudioElement & { disableRemotePlayback: boolean }).disableRemotePlayback = true;
    el.src = url;
    this.audio = el;
    const ended = this.whenEnded(el, gen);

    await new Promise((r) => source.addEventListener("sourceopen", r, { once: true }));
    const buffer = source.addSourceBuffer("audio/mpeg");
    let started = false;
    for await (const part of stream.chunks()) {
      if (gen !== this.generation) break;
      await new Promise((r) => {
        buffer.addEventListener("updateend", r, { once: true });
        buffer.appendBuffer(part as BufferSource);
      });
      if (!started) {
        started = true;
        el.play().catch(() => {});
      }
    }
    if (source.readyState === "open") source.endOfStream();
    if (started && gen === this.generation) await ended;
    URL.revokeObjectURL(url);
  }

  private playUrl(url: string, gen: number) {
    const el = new Audio(url);
    this.audio = el;
    const ended = this.whenEnded(el, gen);
    el.play().catch(() => el.dispatchEvent(new Event("error")));
    return ended.finally(() => URL.revokeObjectURL(url));
  }

  private whenEnded(el: HTMLAudioElement, gen: number) {
    el.onplaying = () => this.setAudible(true);
    return new Promise<void>((resolve) => {
      el.onended = () => resolve();
      el.onerror = () => resolve();
      el.onpause = () => {
        if (gen !== this.generation) resolve();
      };
    });
  }

  private setAudible(audible: boolean) {
    if (audible === this.audible) return;
    this.audible = audible;
    this.events.onAudible(audible);
  }

  private flushIdle() {
    const resolvers = this.idleResolvers;
    this.idleResolvers = [];
    resolvers.forEach((r) => r());
  }
}
