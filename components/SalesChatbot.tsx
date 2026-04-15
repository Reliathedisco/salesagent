'use client';

import { useState, useRef, useEffect, useCallback, FormEvent } from 'react';
import { ChatMessage as ChatMessageType, LeadInfo } from '@/lib/types';
import { QUICK_REPLIES } from '@/lib/salesPrompt';
import ChatMessage from './ChatMessage';
import CTABlock from './CTABlock';
import LeadCapture from './LeadCapture';

const STORAGE_KEY = 'sales-chat';
const SESSION_KEY = 'sales-chat-session';
const LEAD_KEY = 'sales-chat-lead';

const INITIAL_GREETING: ChatMessageType = {
  role: 'assistant',
  content:
    "Hi there! I'm here to help you find the right solution. What brings you here today?",
};

export default function SalesChatbot() {
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [lead, setLead] = useState<LeadInfo | null>(null);
  const [sessionId, setSessionId] = useState('');
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [mounted, setMounted] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  // Refs for smooth streaming without per-chunk re-renders
  const rafRef = useRef<number | null>(null);
  const streamContentRef = useRef('');
  const messageCountRef = useRef(0);

  // Initialize session and restore state from localStorage
  useEffect(() => {
    let sid = localStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = crypto.randomUUID();
      localStorage.setItem(SESSION_KEY, sid);
    }
    setSessionId(sid);

    const savedMessages = localStorage.getItem(STORAGE_KEY);
    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages) as ChatMessageType[];
        setMessages(parsed);
      } catch {
        setMessages([INITIAL_GREETING]);
        setShowQuickReplies(true);
      }
    } else {
      setMessages([INITIAL_GREETING]);
      setShowQuickReplies(true);
    }

    const savedLead = localStorage.getItem(LEAD_KEY);
    if (savedLead) {
      try {
        setLead(JSON.parse(savedLead));
      } catch {
        // ignore
      }
    }

    setMounted(true);

    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Persist messages to localStorage — skip during streaming to avoid per-chunk writes
  useEffect(() => {
    if (mounted && messages.length > 0 && !isStreaming) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    }
  }, [messages, mounted, isStreaming]);

  // Persist lead to localStorage
  useEffect(() => {
    if (mounted && lead) {
      localStorage.setItem(LEAD_KEY, JSON.stringify(lead));
    }
  }, [lead, mounted]);

  // Auto-scroll: smooth only when a new message is added, instant during streaming
  useEffect(() => {
    const newCount = messages.length;
    if (newCount !== messageCountRef.current) {
      messageCountRef.current = newCount;
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const qualifyLead = useCallback(
    async (msgs: ChatMessageType[], sid: string) => {
      try {
        const res = await fetch('/api/qualify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: msgs, sessionId: sid }),
        });
        if (res.ok) {
          const { lead: updatedLead } = await res.json();
          setLead(updatedLead);
        }
      } catch {
        // Non-critical — don't disrupt chat flow
      }
    },
    []
  );

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming || !sessionId) return;

      setShowQuickReplies(false);
      const userMessage: ChatMessageType = { role: 'user', content: text };
      const assistantMessage: ChatMessageType = {
        role: 'assistant',
        content: '',
      };

      const updatedMessages = [...messages, userMessage];
      setMessages([...updatedMessages, assistantMessage]);
      setInput('');
      setIsStreaming(true);

      abortControllerRef.current?.abort();
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: updatedMessages,
            sessionId,
          }),
          signal: abortController.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error('Failed to get response');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        streamContentRef.current = '';

        // Flush accumulated stream content to React state at ~60fps
        const scheduleFlush = () => {
          if (rafRef.current !== null) return;
          rafRef.current = requestAnimationFrame(() => {
            rafRef.current = null;
            const content = streamContentRef.current;
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = { role: 'assistant', content };
              return updated;
            });
            // Keep bottom visible without re-triggering smooth scroll
            messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
          });
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop()!;

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.error) {
                streamContentRef.current += parsed.error;
              } else if (parsed.text) {
                streamContentRef.current += parsed.text;
              }
              scheduleFlush();
            } catch {
              // Skip malformed JSON chunks
            }
          }
        }

        // Cancel any pending RAF and do a final flush
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        const fullResponse = streamContentRef.current;
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: fullResponse };
          return updated;
        });

        // Qualify lead after stream completes
        const finalMessages = [...updatedMessages, { role: 'assistant' as const, content: fullResponse }];
        qualifyLead(finalMessages, sessionId);
      } catch (error) {
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: 'assistant',
            content: 'Sorry, something went wrong. Please try again.',
          };
          return updated;
        });
      } finally {
        setIsStreaming(false);
      }
    },
    [isStreaming, messages, sessionId, qualifyLead]
  );

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  function handleEscalate() {
    setLead((prev) =>
      prev ? { ...prev, stage: 'escalated' } : null
    );
    sendMessage("I'd like to talk to a human, please.");
  }

  function handleCtaClick(action: string) {
    const actionMessages: Record<string, string> = {
      book_demo: "I'd like to book a demo.",
      start_trial: "I'd like to start a free trial.",
      talk_to_sales: "I'd like to talk to your sales team.",
    };
    sendMessage(actionMessages[action] ?? action);
  }

  function handleLeadSubmit(name: string, email: string) {
    setLead((prev) =>
      prev
        ? { ...prev, name: name || prev.name, email }
        : { name, email, useCase: null, teamSize: null, urgency: null, stage: 'warm' }
    );
    // Sync with server
    fetch('/api/qualify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          ...messages,
          {
            role: 'user',
            content: `My name is ${name} and my email is ${email}`,
          },
        ],
        sessionId,
      }),
    }).catch(() => {});
  }

  function handleClearChat() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEAD_KEY);
    setMessages([INITIAL_GREETING]);
    setLead(null);
    setShowQuickReplies(true);
  }

  // Don't render until client-side hydration is complete
  if (!mounted) {
    return (
      <div className="flex flex-col h-[600px] w-full max-w-md mx-auto border border-gray-200 rounded-2xl shadow-lg bg-white" />
    );
  }

  const showLeadCapture =
    lead &&
    !lead.email &&
    ['warm', 'hot', 'escalated'].includes(lead.stage);

  return (
    <div className="flex flex-col h-[600px] w-full max-w-md mx-auto border border-gray-200 rounded-2xl shadow-lg bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full" />
          <span className="text-sm font-semibold text-gray-800">
            Sales Assistant
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleEscalate}
            disabled={isStreaming}
            className="text-xs text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
          >
            Talk to a human
          </button>
          <button
            onClick={handleClearChat}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            title="Clear chat"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((msg, i) => (
          <ChatMessage
            key={i}
            message={msg}
            isStreaming={isStreaming && i === messages.length - 1}
          />
        ))}

        {lead?.stage === 'hot' && (
          <CTABlock stage={lead.stage} onCtaClick={handleCtaClick} />
        )}

        {showLeadCapture && (
          <LeadCapture visible={true} onSubmit={handleLeadSubmit} />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick replies */}
      {showQuickReplies && !isStreaming && (
        <div className="flex gap-2 px-4 pb-2 overflow-x-auto">
          {QUICK_REPLIES.map((chip) => (
            <button
              key={chip}
              onClick={() => sendMessage(chip)}
              className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-full hover:bg-blue-100 transition-colors border border-blue-100"
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 px-4 py-3 border-t border-gray-100"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isStreaming}
          placeholder={isStreaming ? 'Waiting for response...' : 'Type a message...'}
          className="flex-1 px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isStreaming || !input.trim()}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Send
        </button>
      </form>
    </div>
  );
}
