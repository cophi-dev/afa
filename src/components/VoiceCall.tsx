"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Phone, PhoneOff, Mic, MicOff, Volume2 } from "lucide-react";
import { GrokVoiceClient, ConnectionStatus } from "@/lib/voice/grok-voice-client";
import { BusinessConfig } from "@/lib/config/businesses";

interface Transcript {
  id: string;
  speaker: "user" | "assistant";
  text: string;
  timestamp: Date;
}

interface VoiceCallProps {
  business: BusinessConfig;
  onEnd: () => void;
}

export function VoiceCall({ business, onEnd }: VoiceCallProps) {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState<{
    speaker: "user" | "assistant";
    text: string;
  } | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  const clientRef = useRef<GrokVoiceClient | null>(null);
  const transcriptIdRef = useRef(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptsEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    transcriptsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [transcripts, currentTranscript, scrollToBottom]);

  const startCall = useCallback(async () => {
    setError(null);
    setStatus("connecting");

    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: business.id }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to start session");
      }

      const { token, business: businessData } = await response.json();

      const client = new GrokVoiceClient({
        token,
        voice: businessData.voice,
        systemPrompt: businessData.systemPrompt,
        onStatusChange: setStatus,
        onTranscript: (text, isFinal, speaker) => {
          if (isFinal) {
            setTranscripts((prev) => [
              ...prev,
              {
                id: `t-${++transcriptIdRef.current}`,
                speaker,
                text,
                timestamp: new Date(),
              },
            ]);
            setCurrentTranscript(null);
          } else {
            setCurrentTranscript((prev) => ({
              speaker,
              text: prev?.speaker === speaker ? prev.text + text : text,
            }));
          }
        },
        onError: (err) => {
          setError(err.message);
          setStatus("error");
        },
      });

      clientRef.current = client;
      await client.connect();

      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
      setStatus("error");
    }
  }, [business.id]);

  const endCall = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.disconnect();
      clientRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setStatus("disconnected");
    onEnd();
  }, [onEnd]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  useEffect(() => {
    let mounted = true;
    
    const initCall = async () => {
      if (mounted) {
        await startCall();
      }
    };
    
    initCall();
    
    return () => {
      mounted = false;
      if (clientRef.current) {
        clientRef.current.disconnect();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business.id]);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getStatusText = (): string => {
    switch (status) {
      case "connecting":
        return "Verbinde...";
      case "connected":
        return "Verbunden";
      case "listening":
        return "Höre zu...";
      case "speaking":
        return "Spricht...";
      case "error":
        return "Fehler";
      default:
        return "Getrennt";
    }
  };

  const getStatusColor = (): string => {
    switch (status) {
      case "listening":
        return "bg-green-500";
      case "speaking":
        return "bg-blue-500";
      case "connecting":
      case "connected":
        return "bg-yellow-500";
      case "error":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
        {/* Header */}
        <div
          className="p-6 text-center"
          style={{ backgroundColor: business.color }}
        >
          <div className="text-5xl mb-3">{business.icon}</div>
          <h2 className="text-xl font-bold text-white">{business.name}</h2>
          <div className="flex items-center justify-center gap-2 mt-2">
            <span
              className={`w-2 h-2 rounded-full ${getStatusColor()} animate-pulse`}
            />
            <span className="text-white/80 text-sm">{getStatusText()}</span>
          </div>
          <div className="text-white/60 text-lg mt-1 font-mono">
            {formatDuration(callDuration)}
          </div>
        </div>

        {/* Transcripts */}
        <div className="h-64 overflow-y-auto p-4 space-y-3 bg-gray-800">
          {transcripts.length === 0 && !currentTranscript && status === "listening" && (
            <div className="text-center text-gray-400 py-8">
              <Volume2 className="w-8 h-8 mx-auto mb-2 animate-pulse" />
              <p>Sagen Sie etwas...</p>
            </div>
          )}
          {transcripts.map((t) => (
            <div
              key={t.id}
              className={`flex ${t.speaker === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                  t.speaker === "user"
                    ? "bg-blue-600 text-white rounded-br-sm"
                    : "bg-gray-700 text-gray-100 rounded-bl-sm"
                }`}
              >
                <p className="text-sm">{t.text}</p>
              </div>
            </div>
          ))}
          {currentTranscript && (
            <div
              className={`flex ${currentTranscript.speaker === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                  currentTranscript.speaker === "user"
                    ? "bg-blue-600/70 text-white/80 rounded-br-sm"
                    : "bg-gray-700/70 text-gray-300 rounded-bl-sm"
                }`}
              >
                <p className="text-sm">{currentTranscript.text}</p>
              </div>
            </div>
          )}
          <div ref={transcriptsEndRef} />
        </div>

        {/* Error message */}
        {error && (
          <div className="px-4 py-2 bg-red-900/50 text-red-200 text-sm text-center">
            {error}
          </div>
        )}

        {/* Controls */}
        <div className="p-6 bg-gray-900 flex items-center justify-center gap-6">
          <button
            onClick={toggleMute}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
              isMuted
                ? "bg-red-500 hover:bg-red-600"
                : "bg-gray-700 hover:bg-gray-600"
            }`}
            aria-label={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? (
              <MicOff className="w-6 h-6 text-white" />
            ) : (
              <Mic className="w-6 h-6 text-white" />
            )}
          </button>

          <button
            onClick={endCall}
            className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition-colors shadow-lg"
            aria-label="End call"
          >
            <PhoneOff className="w-7 h-7 text-white" />
          </button>

          <div className="w-14 h-14 rounded-full bg-gray-700 flex items-center justify-center">
            <Phone className="w-6 h-6 text-green-400" />
          </div>
        </div>
      </div>
    </div>
  );
}
