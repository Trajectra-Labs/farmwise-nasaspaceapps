/**
 * Ask FarmWise drawer.
 *
 * A deterministic, context-aware helper: answers are built from the farmer's real profile, the
 * shared rotation evaluation, NASA snapshot context, soil reading, scenario sliders and last
 * Plant Check (see answers.ts). No AI model is called. Voice input is used when the browser
 * supports speech recognition; the text box always works.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';
import { useFarmWise } from '@/core/store';
import { useMoenData } from '@/features/rotation/moenStore';
import { Drawer, Button, SourceBadge, Icon, IconButton } from '@/ui/components';
import { answerQuestion, SUGGESTIONS, type AssistantContext } from './answers';
import './AssistantDrawer.css';

type Message = { role: 'user' | 'assistant'; text: string };
type VoiceState = 'idle' | 'listening' | 'unsupported' | 'denied' | 'error';

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function AssistantDrawer() {
  const { state } = useFarmWise();
  const data = useMoenData();
  const [open, setOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [conversation, setConversation] = useState<Message[]>([]);
  const [voice, setVoice] = useState<VoiceState>('idle');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const voiceSupported = useMemo(() => typeof window !== 'undefined' && getSpeechRecognition() !== null, []);

  useEffect(() => {
    const handler = () => setOpen(true);
    document.addEventListener('fw:open-assistant', handler);
    return () => document.removeEventListener('fw:open-assistant', handler);
  }, []);

  const ctx = useMemo<AssistantContext>(
    () => ({
      farm: state.farm,
      evaluation: data.evaluation,
      climate: data.climate,
      soil: data.soil,
      soilPreset: state.soilPreset,
      activePlanId: state.activePlanId,
      scenario: state.scenario,
      plantObservation: state.lastPlantObservation ?? null,
    }),
    [state.farm, data.evaluation, data.climate, data.soil, state.soilPreset, state.activePlanId, state.scenario, state.lastPlantObservation],
  );

  const ask = useCallback(
    (question: string) => {
      const q = question.trim();
      if (!q) return;
      setConversation((prev) => [...prev, { role: 'user', text: q }, { role: 'assistant', text: answerQuestion(q, ctx) }]);
    },
    [ctx],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    ask(inputText);
    setInputText('');
  };

  const stopVoice = useCallback(() => {
    recognitionRef.current?.stop();
    setVoice('idle');
  }, []);

  const startVoice = useCallback(() => {
    const SR = getSpeechRecognition();
    if (!SR) {
      setVoice('unsupported');
      return;
    }
    try {
      const rec = new SR();
      rec.lang = 'en-US';
      rec.continuous = false;
      rec.interimResults = false;
      rec.onresult = (e) => {
        const text = Array.from(e.results).map((r) => r[0]?.transcript ?? '').join(' ').trim();
        if (text) setInputText(text);
      };
      rec.onerror = (e) => setVoice(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'denied' : 'error');
      rec.onend = () => setVoice((v) => (v === 'listening' ? 'idle' : v));
      recognitionRef.current = rec;
      setVoice('listening');
      rec.start();
    } catch {
      setVoice('error');
    }
  }, []);

  useEffect(() => () => recognitionRef.current?.stop(), []);

  const voiceMessage =
    voice === 'listening' ? 'Listening. Speak your question, then press Ask.'
    : voice === 'denied' ? 'Microphone access was blocked. Type your question instead.'
    : voice === 'error' ? 'Voice input did not work. Type your question instead.'
    : voice === 'unsupported' ? 'This browser does not support voice input. Type your question instead.'
    : null;

  return (
    <Drawer open={open} onClose={() => { stopVoice(); setOpen(false); }} title="Ask FarmWise">
      <div className="assistant-body">
        <div className="assistant-disclaimer">
          <SourceBadge source="MODEL_ESTIMATE" />
          <p className="text-xs text-muted mt-1">
            Answers are written from your own farm profile, current plan, scenario settings, soil values and the NASA POWER
            snapshot. No AI model is called, so FarmWise cannot diagnose plants or forecast weather.
          </p>
        </div>

        {conversation.length > 0 && (
          <div className="assistant-conversation" aria-live="polite" data-testid="assistant-conversation">
            {conversation.map((msg, i) => (
              <div key={i} className={`assistant-message assistant-message--${msg.role}`}>
                <span className="assistant-message__role">{msg.role === 'user' ? 'You' : 'FarmWise'}</span>
                <p className="assistant-message__text">{msg.text}</p>
              </div>
            ))}
          </div>
        )}

        <div className="assistant-faqs">
          <span className="assistant-faqs__label">Suggested questions</span>
          {SUGGESTIONS.map((s) => (
            <button key={s.id} type="button" className="assistant-faq-btn" onClick={() => ask(s.question)}>
              {s.question}
            </button>
          ))}
        </div>

        <form className="assistant-input-row" onSubmit={handleSubmit}>
          <input
            type="text"
            className="fw-field__control assistant-input"
            placeholder="Type a question…"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            aria-label="Ask FarmWise a question"
          />
          {voiceSupported && (
            <IconButton
              label={voice === 'listening' ? 'Stop voice input' : 'Start voice input'}
              variant="secondary"
              onClick={voice === 'listening' ? stopVoice : startVoice}
              aria-pressed={voice === 'listening'}
            >
              <Icon icon={voice === 'listening' ? Square : Mic} />
            </IconButton>
          )}
          <Button type="submit" variant="primary" disabled={!inputText.trim()}>
            Ask
          </Button>
        </form>
        {!voiceSupported && (
          <p className="text-xs text-muted" role="note">Voice input is not available in this browser. Typing works everywhere.</p>
        )}
        {voiceMessage && <p className="text-xs text-muted" role="status">{voiceMessage}</p>}

        {conversation.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setConversation([])}>
            Clear conversation
          </Button>
        )}
      </div>
    </Drawer>
  );
}

export default AssistantDrawer;
