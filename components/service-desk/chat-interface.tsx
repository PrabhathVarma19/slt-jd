'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw, Search, Key, Unlock, Ticket } from 'lucide-react';
import Button from '@/components/ui/button';
import Textarea from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Spinner } from '@/components/ui/spinner';
import { ErrorBar } from '@/components/ui/error-bar';

type ChatRole = 'user' | 'assistant';

interface ChatMessage {
  role: ChatRole;
  content: string;
  createdAt: string;
  actionType?: 'password_reset' | 'account_unlock' | 'ticket_status' | 'kb_search' | 'create_request' | null;
  actionData?: any;
}

interface ServiceDeskChatResponse {
  message: string;
  actionType?: 'password_reset' | 'account_unlock' | 'ticket_status' | 'kb_search' | 'create_request' | null;
  actionData?: any;
  requiresConfirmation?: boolean;
  extractedData?: {
    requestType?: string;
    system?: string;
    impact?: string;
    reason?: string;
    projectCode?: string;
  };
  error?: string;
}

const QUICK_ACTIONS = [
  'I need VPN access',
  'Reset my password',
  'My account is locked',
  'Check ticket status',
  'I need a laptop',
  'Install software',
];

export function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentQuestions, setRecentQuestions] = useState<string[]>([]);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLElement | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [hasUnread, setHasUnread] = useState(false);

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return '';
      return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const scrollToBottom = (behavior: 'smooth' | 'auto' = 'auto') => {
    if (messagesRef.current?.parentElement) {
      const viewport = messagesRef.current.parentElement;
      viewport.scrollTo({
        top: viewport.scrollHeight,
        behavior,
      });
    }
  };

  useEffect(() => {
    scrollToBottom('auto');
  }, [messages]);

  useEffect(() => {
    const handleScroll = () => {
      if (messagesRef.current?.parentElement) {
        const viewport = messagesRef.current.parentElement;
        const { scrollTop, scrollHeight, clientHeight } = viewport;
        const atBottom = scrollHeight - scrollTop - clientHeight < 100;
        setIsAtBottom(atBottom);
        if (!atBottom && messages.length > 0) {
          setHasUnread(true);
        }
      }
    };

    const viewport = messagesRef.current?.parentElement;
    if (viewport) {
      viewport.addEventListener('scroll', handleScroll);
      return () => viewport.removeEventListener('scroll', handleScroll);
    }
  }, [messages]);

  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(t);
    }
  }, [error]);

  const handleSend = async (messageOverride?: string) => {
    const raw = messageOverride ?? input;
    const trimmed = raw.trim();
    if (!trimmed) {
      setError('Please enter a message.');
      return;
    }

    const now = new Date().toISOString();
    const userMessage: ChatMessage = {
      role: 'user',
      content: trimmed,
      createdAt: now,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);
    setRecentQuestions((prev) => {
      const withoutDup = prev.filter((q) => q !== trimmed);
      return [trimmed, ...withoutDup].slice(0, 5);
    });

    try {
      const res = await fetch('/api/service-desk/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data: ServiceDeskChatResponse & { error?: string } = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to get response');
      }

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.message,
        createdAt: new Date().toISOString(),
        actionType: data.actionType || null,
        actionData: data.actionData,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Auto-scroll if at bottom
      if (isAtBottom) {
        setTimeout(() => scrollToBottom('smooth'), 100);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send message');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading) {
        handleSend();
      }
    }
  };

  const handleReset = () => {
    setMessages([]);
    setError(null);
    setIsLoading(false);
  };

  const handleSelfService = async (action: 'password_reset' | 'account_unlock', ticketNumber?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const endpoint = action === 'password_reset' 
        ? '/api/service-desk/self-service/password-reset'
        : action === 'account_unlock'
        ? '/api/service-desk/self-service/unlock'
        : `/api/service-desk/self-service/ticket-status?ticketNumber=${ticketNumber}`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ticketNumber ? { ticketNumber } : {}),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to perform action');
      }

      const successMessage: ChatMessage = {
        role: 'assistant',
        content: data.message || 'Action completed successfully.',
        createdAt: new Date().toISOString(),
        actionType: action,
        actionData: data,
      };

      setMessages((prev) => [...prev, successMessage]);
    } catch (err: any) {
      setError(err.message || 'Failed to perform action');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-card rounded-3xl shadow-sm p-4 sm:p-6 flex flex-col gap-4 h-[75vh] min-h-[620px] md:h-full md:min-h-0">
      {/* Chat surface */}
      <div className="flex flex-col flex-1 min-h-0 rounded-2xl bg-muted p-3">
        {messages.length === 0 && (
          <p className="text-xs text-slate-600 mb-2">
            Tell me what you need help with, or pick a quick action below.
          </p>
        )}
        <div className="relative flex-1 min-h-0">
          <ScrollArea className="h-full chat-scroll">
            <div ref={messagesRef} className="space-y-3">
              {messages.length === 0 && (
                <div className="flex justify-start">
                  <div className="inline-flex max-w-md flex-col gap-1 rounded-2xl bg-card px-3 py-2 text-sm text-slate-700 shadow-sm">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-blue-600">
                      Beacon
                    </span>
                    <p>
                      I can help you with IT requests, password resets, account unlocks, ticket status, and more.
                      Just tell me what you need!
                    </p>
                  </div>
                </div>
              )}

              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`inline-flex max-w-md flex-col gap-1 rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap shadow-sm ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-card text-slate-900'
                    }`}
                  >
                    <span className="text-[11px] font-medium uppercase tracking-wide opacity-70">
                      {msg.role === 'user' ? 'You' : 'Beacon'}
                    </span>
                    <p>{msg.content}</p>
                    {msg.createdAt && (
                      <span className="text-[10px] text-slate-400 self-end">
                        {formatTime(msg.createdAt)}
                      </span>
                    )}
                    {msg.actionType === 'password_reset' && msg.actionData?.requiresConfirmation && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="mt-2"
                        onClick={() => handleSelfService('password_reset')}
                      >
                        <Key className="h-3 w-3 mr-1" />
                        Reset Password
                      </Button>
                    )}
                    {msg.actionType === 'account_unlock' && msg.actionData?.requiresConfirmation && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="mt-2"
                        onClick={() => handleSelfService('account_unlock')}
                      >
                        <Unlock className="h-3 w-3 mr-1" />
                        Unlock Account
                      </Button>
                    )}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="inline-flex items-center gap-1 rounded-2xl bg-slate-100 px-3 py-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-500 animate-bounce [animation-delay:-0.2s]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" />
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-300 animate-bounce [animation-delay:0.2s]" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {hasUnread && !isAtBottom && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="absolute bottom-3 right-3 rounded-full shadow-sm"
              onClick={() => {
                scrollToBottom('smooth');
                setHasUnread(false);
              }}
            >
              Jump to latest
            </Button>
          )}
        </div>

        {error && <ErrorBar message={error} className="mt-3" />}

        <div className="mt-3 space-y-2">
          <div className="flex items-end gap-3">
            <Textarea
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g., I need VPN access, Reset my password, Check ticket IT-000123"
              className="flex-1 resize-none rounded-2xl bg-card"
            />

            <div className="flex flex-col items-center gap-2">
              {messages.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleReset}
                  disabled={isLoading}
                  className="h-8 w-8 rounded-full border border-blue-200 text-blue-700 hover:bg-blue-50"
                  aria-label="New conversation"
                  title="New conversation"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                </Button>
              )}

              <Button
                className="rounded-full px-5"
                onClick={() => handleSend()}
                disabled={isLoading || !input.trim()}
              >
                {isLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <Spinner />
                    Sending...
                  </span>
                ) : (
                  'Send'
                )}
              </Button>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Press Enter to send. Shift+Enter for a new line.
          </p>
        </div>
      </div>

      {/* Quick Actions Sidebar */}
      <div className="bg-card rounded-3xl shadow-sm p-4 space-y-3 max-h-[200px] overflow-y-auto">
        <h2 className="text-sm font-semibold text-slate-900">Quick Actions</h2>
        <div className="flex flex-wrap gap-2">
          {QUICK_ACTIONS.map((action) => (
            <Button
              key={action}
              type="button"
              size="sm"
              variant="secondary"
              className="whitespace-nowrap text-xs rounded-full"
              onClick={() => handleSend(action)}
              disabled={isLoading}
            >
              {action}
            </Button>
          ))}
        </div>
        {recentQuestions.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Recent
            </p>
            <div className="flex flex-wrap gap-2">
              {recentQuestions.map((q) => (
                <Button
                  key={q}
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="whitespace-nowrap text-xs rounded-full"
                  onClick={() => handleSend(q)}
                  disabled={isLoading}
                >
                  {q}
                </Button>
              ))}
            </div>
          </div>
        )}
        <div className="pt-2 border-t border-gray-200">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full text-xs"
            disabled
          >
            <Search className="h-3 w-3 mr-1" />
            Search Knowledge Base (Coming Soon)
          </Button>
        </div>
      </div>
    </div>
  );
}

