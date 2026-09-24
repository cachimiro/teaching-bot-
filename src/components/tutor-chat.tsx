"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Markdown } from "@/components/markdown";
import { formatResetTime, markCreditsStale, publishCredits, type CreditsView } from "@/lib/credits/client";
import { readNdjson } from "@/lib/tutor/ndjson";
import { stripNotes } from "@/lib/tutor/notes";
import { latestLessonStage } from "@/lib/tutor/activities";
import { LessonProgress } from "@/components/activities/lesson-progress";
import { speechPlan, type StepRef } from "@/lib/voice/speech-plan";
import { LiveTranscriber } from "@/lib/voice/live-transcriber";
import { SpeechPlayer } from "@/lib/voice/speech-player";
import type { Mode } from "@/lib/tutor/prompt";

export type ChatMessage = { role: "user" | "assistant"; text: string };
export type ModeThreads = Record<Mode, { id: string; messages: ChatMessage[] } | null>;

type ChatEvent =
  | { type: "start"; conversationId: string }
  | { type: "text"; delta: string }
  | { type: "done"; text: string }
  | { type: "status"; credits: number; status: CreditsView }
  | { type: "error"; error: string };

type Blocked = { error: string; resetsAt?: string; reason?: string };

const MODES: { id: Mode; label: string; blurb: string; starters: string[] }[] = [
  {
    id: "learn",
    label: "Learn",
    blurb: "Get it explained simply, step by step.",
    starters: ["Teach me this topic as a full lesson", "Explain this topic simply", "I'm stuck, where do I start?", "What comes up in the exam?"],
  },
  {
    id: "quiz",
    label: "Quiz",
    blurb: "Quick-fire questions with instant feedback.",
    starters: ["Start the quiz", "Quiz me on the basics", "Give me harder questions"],
  },
  {
    id: "mock",
    label: "Mock exam",
    blurb: "Exam-style questions, marked like the real thing.",
    starters: ["Start my mock exam", "Give me one 6-mark question"],
  },
];

/** "Read replies aloud" preference, remembered per browser. */
const SPEAK_KEY = "virtus:speak-replies";
const SPEAK_EVENT = "virtus:speak-changed";
function readSpeak() {
  try {
    return localStorage.getItem(SPEAK_KEY) === "1";
  } catch {
    return false;
  }
}
function writeSpeak(on: boolean) {
  try {
    localStorage.setItem(SPEAK_KEY, on ? "1" : "0");
  } catch {}
  window.dispatchEvent(new Event(SPEAK_EVENT));
}
function subscribeSpeak(onChange: () => void) {
  window.addEventListener(SPEAK_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(SPEAK_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Key for a spoken reply, so replays come from the audio cache. */
const replyKey = (threadId: string, index: number) => `${threadId}:${index}`;

export function TutorChat({
  topicId,
  topicTitle,
  subjectName,
  setting,
  initialMode,
  initialThreads,
}: {
  topicId: string;
  topicTitle: string;
  subjectName: string;
  setting: { examBoard: string; tier: string };
  initialMode: Mode;
  initialThreads: ModeThreads;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [threads, setThreads] = useState<ModeThreads>(initialThreads);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<Blocked | null>(null);
  const speakReplies = useSyncExternalStore(subscribeSpeak, readSpeak, () => false);
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  // Hands-free voice conversation: listen → pause → send → spoken reply → listen again.
  const [conversation, setConversation] = useState(false);
  const [listening, setListening] = useState(false);
  const [micLive, setMicLive] = useState(false);
  const [audible, setAudible] = useState(false);
  const [speakingStep, setSpeakingStep] = useState<{ key: string; step: StepRef | null } | null>(null);
  const [heard, setHeard] = useState("");
  const conversationRef = useRef(false);
  const transcriber = useRef<LiveTranscriber | null>(null);
  const player = useRef<SpeechPlayer | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const thread = threads[mode];
  const messages = thread?.messages ?? [];
  const lastText = messages.at(-1)?.text;
  const modeInfo = MODES.find((m) => m.id === mode)!;
  // One progress bar for the whole lesson, from the latest stage the tutor has marked.
  const lesson = mode === "learn" ? latestLessonStage(messages.filter((m) => m.role === "assistant").map((m) => m.text)) : null;

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, lastText, heard]);

  const showBlocked = useCallback((body: Blocked) => {
    setBlocked(body);
    markCreditsStale();
  }, []);

  const getPlayer = useCallback(() => {
    player.current ??= new SpeechPlayer({
      onChange: setPlayingKey,
      onAudible: setAudible,
      onStep: (key, step) => setSpeakingStep(step ? { key, step } : null),
      onBlocked: (body) => {
        showBlocked(body);
        endConversationRef.current();
      },
      onCharged: markCreditsStale,
    });
    return player.current;
  }, [showBlocked]);

  const updateThread = useCallback((m: Mode, fn: (t: { id: string; messages: ChatMessage[] }) => { id: string; messages: ChatMessage[] }) => {
    setThreads((all) => ({ ...all, [m]: fn(all[m] ?? { id: "", messages: [] }) }));
  }, []);

  const endConversation = useCallback(() => {
    conversationRef.current = false;
    setConversation(false);
    transcriber.current?.stop();
    transcriber.current = null;
    setListening(false);
    setHeard("");
  }, []);
  const endConversationRef = useRef(endConversation);

  const sendRef = useRef<(text: string, opts?: { voice?: boolean }) => Promise<void>>(async () => {});

  const startListening = useCallback(async () => {
    if (transcriber.current) return;
    getPlayer().stop();
    setError(null);
    setHeard("");
    setMicLive(false);
    const t = new LiveTranscriber({
      onReady: () => setMicLive(true),
      onText: setHeard,
      onUtterance: (text) => {
        transcriber.current = null;
        setListening(false);
        setHeard("");
        void sendRef.current(text, { voice: true });
      },
      onIdle: () => {
        transcriber.current = null;
        endConversation();
      },
      onBlocked: (body) => {
        transcriber.current = null;
        showBlocked(body);
        endConversation();
      },
      onError: (message) => {
        transcriber.current = null;
        setError(message);
        endConversation();
      },
    });
    transcriber.current = t;
    setListening(true);
    if (!(await t.start(topicId)) && transcriber.current === t) {
      transcriber.current = null;
      setListening(false);
    }
  }, [endConversation, getPlayer, showBlocked, topicId]);

  const send = useCallback(
    async (text: string, opts: { voice?: boolean } = {}) => {
      const message = text.trim();
      if (!message || thinking) return;
      const m = mode;
      const voice = Boolean(opts.voice || speakReplies);
      const speaker = getPlayer();
      speaker.stop();
      setError(null);
      setInput("");
      setThinking(true);
      const replyIndex = (threads[m]?.messages.length ?? 0) + 1;
      updateThread(m, (t) => ({ ...t, messages: [...t.messages, { role: "user", text: message }, { role: "assistant", text: "" }] }));
      const setReply = (reply: string) =>
        updateThread(m, (t) => {
          const msgs = [...t.messages];
          msgs[msgs.length - 1] = { role: "assistant", text: reply };
          return { ...t, messages: msgs };
        });
      const dropPending = () => updateThread(m, (t) => ({ ...t, messages: t.messages.slice(0, -2) }));

      let raw = "";
      let queued = 0;
      let speaking = false;
      /** Queue any newly finished speech segments (sentences, or working-out steps). */
      const speakNew = (text: string, final: boolean) => {
        const plan = speechPlan(text, final);
        for (const seg of plan.slice(queued)) speaker.push(seg.text, seg.step);
        queued = plan.length;
      };
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ topicId, mode: m, conversationId: threads[m]?.id || null, message, voice }),
        });
        if (!res.ok || !res.body) {
          const body = await res.json().catch(() => ({ error: "Something went wrong. Please try again." }));
          dropPending();
          setInput(message);
          if (res.status === 402) showBlocked(body);
          else setError(body.error);
          endConversation();
          return;
        }
        await readNdjson<ChatEvent>(res.body, (e) => {
          if (e.type === "start") {
            updateThread(m, (t) => ({ ...t, id: e.conversationId }));
            if (voice) {
              speaker.startStream(replyKey(e.conversationId, replyIndex));
              speaking = true;
            }
          } else if (e.type === "text") {
            raw += e.delta;
            const visible = stripNotes(raw);
            setReply(visible);
            // Speak each finished sentence or step while the rest of the reply is still being written.
            if (speaking) speakNew(visible, false);
          } else if (e.type === "status") {
            publishCredits(e.status);
          } else if (e.type === "done") {
            setReply(e.text);
            if (speaking) {
              speakNew(e.text, true);
              speaker.end();
            }
          } else if (e.type === "error") {
            speaker.stop();
            dropPending();
            setInput(message);
            setError(e.error);
            endConversation();
          }
        });
      } catch {
        speaker.stop();
        dropPending();
        setInput(message);
        setError("Connection lost. Please try again.");
        endConversation();
        return;
      } finally {
        setThinking(false);
      }

      // In a voice conversation, listen again once the tutor has finished speaking.
      if (conversationRef.current) {
        await speaker.whenIdle();
        if (conversationRef.current) void startListening();
      }
    },
    [thinking, mode, speakReplies, getPlayer, threads, updateThread, topicId, showBlocked, endConversation, startListening],
  );

  useEffect(() => {
    sendRef.current = send;
    endConversationRef.current = endConversation;
  });

  useEffect(
    () => () => {
      transcriber.current?.stop();
      player.current?.stop();
    },
    [],
  );

  /** Mic button: start a conversation, interrupt the tutor, or send what you've said so far. */
  /** A finished activity (quick check, ordering, gaps) goes to the tutor as the student's next message. */
  const sendActivity = (message: string) => {
    if (transcriber.current) {
      transcriber.current.stop();
      transcriber.current = null;
      setListening(false);
      setHeard("");
    }
    void send(message, { voice: conversationRef.current });
  };

  const onMic = () => {
    if (listening) {
      endConversation();
      if (heard.trim()) void send(heard, { voice: true });
      return;
    }
    if (!conversation) {
      conversationRef.current = true;
      setConversation(true);
    }
    void startListening();
  };

  const status = listening
    ? !micLive
      ? "Starting the microphone…"
      : heard
        ? "Listening… pause for a moment to send"
        : "Listening… start talking"
    : audible && conversation
      ? "Speaking… tap the mic to interrupt"
      : (thinking || playingKey) && conversation
        ? "Thinking…"
        : null;

  return (
    <div className="mt-4 flex flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Tutor mode" className="flex rounded-full border border-navy-100 bg-white p-1 shadow-sm">
          {MODES.map((m) => (
            <button
              key={m.id}
              role="tab"
              aria-selected={mode === m.id}
              disabled={thinking}
              onClick={() => {
                endConversation();
                getPlayer().stop();
                setError(null);
                setMode(m.id);
              }}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                mode === m.id ? "bg-navy text-white" : "text-navy hover:bg-paper"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted">
          <span>
            {setting.examBoard} · {setting.tier === "higher" ? "Higher" : "Foundation"}{" "}
            <Link href="/account#subjects" className="underline hover:text-navy">
              change
            </Link>
          </span>
          {messages.length > 0 && (
            <button
              onClick={() => {
                endConversation();
                getPlayer().stop();
                setThreads((all) => ({ ...all, [mode]: null }));
              }}
              disabled={thinking}
              className="rounded-full border border-navy-100 bg-white px-3 py-1 font-semibold text-navy hover:bg-paper"
            >
              New chat
            </button>
          )}
        </div>
      </div>

      {lesson && (
        <div className="sticky top-[65px] z-20 mt-3 bg-paper/95 pt-2 backdrop-blur">
          <LessonProgress index={lesson.index} />
        </div>
      )}

      <div className="mt-4 flex-1 space-y-4 pb-4" aria-live="polite">
        {messages.length === 0 && !listening ? (
          <div className="rounded-2xl border border-dashed border-navy-200 bg-white/60 p-6 text-center">
            <p className="font-display text-lg font-semibold text-navy">
              {modeInfo.label}: {topicTitle}
            </p>
            <p className="mt-1 text-sm text-muted">{modeInfo.blurb}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {modeInfo.starters.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  disabled={thinking}
                  className="rounded-full border border-navy-100 bg-white px-4 py-2 text-sm font-medium text-navy shadow-sm hover:border-gold"
                >
                  {s}
                </button>
              ))}
            </div>
            <p className="mt-4 text-xs text-muted">Or tap the microphone and just talk.</p>
          </div>
        ) : (
          messages.map((msg, i) => {
            const streaming = thinking && i === messages.length - 1;
            const key = thread ? replyKey(thread.id, i) : "";
            return msg.role === "user" ? (
              <div key={i} className="flex justify-end">
                <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-navy px-4 py-3 text-white">{msg.text}</p>
              </div>
            ) : (
              <div key={i} className="flex gap-3">
                <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold font-display text-sm font-bold text-navy">
                  V
                </span>
                <div className="min-w-0 max-w-[85%] rounded-2xl rounded-tl-md border border-navy-100 bg-white px-4 py-3 shadow-sm">
                  {msg.text ? (
                    <Markdown
                      streaming={streaming}
                      activeStep={speakingStep?.key === key ? speakingStep.step : null}
                      interactive={i === messages.length - 1 && !thinking}
                      onActivity={sendActivity}
                      topicId={topicId}
                    >
                      {msg.text}
                    </Markdown>
                  ) : (
                    <span className="inline-flex gap-1 py-2" aria-label="Tutor is thinking">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-navy-200" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-navy-200 [animation-delay:150ms]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-navy-200 [animation-delay:300ms]" />
                    </span>
                  )}
                  {msg.text && !streaming && thread?.id && (
                    <button
                      onClick={() => (playingKey === key ? getPlayer().stop() : getPlayer().play(key, msg.text))}
                      className="mt-2 text-xs font-semibold text-navy-400 hover:text-navy"
                    >
                      {playingKey === key ? "■ Stop" : "▶ Listen"}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
        {listening && heard && (
          <div className="flex justify-end">
            <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md border border-dashed border-navy-200 bg-white px-4 py-3 text-navy">
              {heard}
              <span className="ml-1 inline-block h-4 w-0.5 animate-pulse bg-navy align-middle" />
            </p>
          </div>
        )}
        <div ref={bottom} />
      </div>

      <div className="sticky bottom-0 -mx-4 border-t border-navy-100 bg-paper/95 px-4 pb-4 pt-3 backdrop-blur sm:mx-0 sm:rounded-t-2xl sm:border-x">
        {blocked && (
          <div role="alert" className="mb-3 rounded-2xl border border-gold bg-gold-50 p-4 text-sm text-navy">
            <p className="font-semibold">{blocked.error}</p>
            {blocked.resetsAt && <p className="mt-1">Your daily credits come back at {formatResetTime(blocked.resetsAt)}.</p>}
            <div className="mt-3 flex gap-2">
              <Link href="/account#credits" className="rounded-full bg-navy px-4 py-2 font-semibold text-white hover:bg-navy-600">
                Top up
              </Link>
              <button onClick={() => setBlocked(null)} className="rounded-full px-4 py-2 font-semibold text-navy hover:bg-white">
                OK
              </button>
            </div>
          </div>
        )}
        {error && (
          <p role="alert" className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}
        {status && (
          <div className="mb-2 flex items-center justify-between gap-3 text-sm font-medium text-navy">
            <span className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${listening ? "animate-pulse bg-red-600" : "bg-gold"}`} />
              {status}
            </span>
            <button
              onClick={() => {
                endConversation();
                getPlayer().stop();
              }}
              className="rounded-full px-3 py-1 text-xs font-semibold text-muted hover:bg-white hover:text-navy"
            >
              End voice chat
            </button>
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
          className="flex items-end gap-2"
        >
          <button
            type="button"
            onClick={onMic}
            disabled={thinking}
            aria-label={listening ? "Send what I've said" : audible && conversation ? "Interrupt and talk" : "Talk to your tutor"}
            title={listening ? "Send now" : "Talk to your tutor"}
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg shadow-sm transition disabled:opacity-50 ${
              listening ? "animate-pulse bg-red-600 text-white" : conversation ? "bg-gold text-navy" : "border border-navy-100 bg-white text-navy hover:border-gold"
            }`}
          >
            {listening ? "■" : "🎙"}
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            rows={1}
            maxLength={4000}
            placeholder={listening ? "Listening…" : `Ask about ${topicTitle}…`}
            disabled={listening}
            className="max-h-40 min-h-12 flex-1 resize-none rounded-2xl border border-navy-100 bg-white px-4 py-3 shadow-sm focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40"
          />
          <button
            type="submit"
            disabled={!input.trim() || thinking}
            className="h-12 shrink-0 rounded-full bg-navy px-5 font-semibold text-white hover:bg-navy-600 disabled:opacity-40"
          >
            Send
          </button>
        </form>
        <label className="mt-2 flex w-fit cursor-pointer items-center gap-2 text-xs text-muted">
          <input type="checkbox" checked={speakReplies} onChange={() => writeSpeak(!speakReplies)} className="accent-navy" />
          Read typed replies aloud
        </label>
        <p className="sr-only">
          GCSE {subjectName}: {topicTitle}
        </p>
      </div>
    </div>
  );
}
