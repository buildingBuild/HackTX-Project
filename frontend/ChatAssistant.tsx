import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, ArrowUpRight, CarFront, ChevronDown, FileText, RotateCcw, Send, Sparkles, X } from 'lucide-react';
import type { Profile } from './demo/agent-backend/engine';
import type { AppPage, ChatContext, ChatReply } from './demo/agent-backend/chat';
import { streamChat } from './chat-stream';
import './chat.css';

type Message = {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  action?: ChatReply['action'];
  source?: ChatReply['source'];
};
type Props = { context: ChatContext; profile?: Profile; onNavigate: (page: AppPage) => void; hidden?: boolean };
const greeting = (): Message => ({
  id: 0, role: 'assistant',
  content: 'Hi! I’m your Heads Up guide. A little clarity for your next repair.\n\nI can explain your demo vehicle, payment illustrations, and Toyota protection information. Use your repair workspace to explore DIY guidance, agent assistance, and insurance cost planning.',
});
const starters = [
  { label: 'My vehicle', question: 'Tell me about my car' },
  { label: 'Payment illustrations', question: 'Compare my payment options' },
  { label: 'Toyota protection', question: 'What Toyota protection products are available?' },
  { label: 'What can you explain?', question: 'What can you help me with?' },
];

function SupportAvatar({ small = false }: { small?: boolean }) {
  return <span className={`chat-avatar${small ? ' chat-avatar-small' : ''}`} aria-hidden="true">
    <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 18v-3a8 8 0 0 1 16 0v3" />
      <path d="M14 16a6 6 0 0 1 12 0v4a6 6 0 0 1-12 0z" fill="currentColor" fillOpacity=".12" />
      <path d="M12 17h-1.2A1.8 1.8 0 0 0 9 18.8v3.4a1.8 1.8 0 0 0 1.8 1.8H13v-7zM28 17h1.2a1.8 1.8 0 0 1 1.8 1.8v3.4a1.8 1.8 0 0 1-1.8 1.8H27v-7z" />
      <path d="M29 24v2a3 3 0 0 1-3 3h-4M9 35a11 11 0 0 1 7-8M24 27a11 11 0 0 1 7 8" />
      <rect x="19" y="27.5" width="4.5" height="3" rx="1.5" fill="currentColor" stroke="none" />
      <path d="M17.5 21.5c1.5 1.3 3.5 1.3 5 0" />
    </svg>
  </span>;
}

export default function ChatAssistant({ context, profile, onNavigate, hidden }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([greeting()]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [streamingId, setStreamingId] = useState<number | null>(null);
  const [failedQuestion, setFailedQuestion] = useState('');
  const [error, setError] = useState('');
  const launcher = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const thread = useRef<HTMLDivElement>(null);
  const request = useRef<AbortController | null>(null);
  const messageId = useRef(1);

  useEffect(() => {
    request.current?.abort();
    request.current = null;
    setMessages([greeting()]);
    setDraft(''); setError(''); setFailedQuestion(''); setBusy(false); setStreamingId(null);
  }, [context.id]);
  useEffect(() => () => { request.current?.abort(); request.current = null; }, []);
  useEffect(() => {
    if (!open || hidden) return;
    const frame = requestAnimationFrame(() => input.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open, hidden]);
  useEffect(() => {
    if (thread.current) thread.current.scrollTop = thread.current.scrollHeight;
  }, [messages, busy, open, error]);

  function close() { setOpen(false); requestAnimationFrame(() => launcher.current?.focus()); }
  function reset() {
    request.current?.abort(); request.current = null;
    setMessages([greeting()]); setDraft(''); setError(''); setFailedQuestion(''); setBusy(false); setStreamingId(null);
    input.current?.focus();
  }

  async function send(question: string, retry = false) {
    const content = question.trim();
    if (!content || request.current || !profile || content.length > 600) return;
    const controller = new AbortController();
    request.current = controller;
    if (!retry) {
      const id = messageId.current++;
      setMessages(current => [...current, { id, role: 'user', content }]);
    }
    const replyId = messageId.current++;
    setDraft(''); setError(''); setFailedQuestion(''); setBusy(true); setStreamingId(null);
    try {
      const url = new URL('/api/chat/ws', window.location.href);
      url.protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const reply = await streamChat(url, {
        message: content, context,
        history: messages.filter((message): message is Message & { role: 'user' } => message.role === 'user').slice(-6).map(({ role, content }) => ({ role, content })),
      }, controller.signal, text => {
        if (request.current !== controller) return;
        setStreamingId(replyId);
        setMessages(current => current.some(message => message.id === replyId)
          ? current.map(message => message.id === replyId ? { ...message, content: text } : message)
          : [...current, { id: replyId, role: 'assistant', content: text }]);
      });
      if (request.current !== controller) return;
      const completed: Message = { id: replyId, role: 'assistant', content: reply.message, action: reply.action, source: reply.source };
      setMessages(current => current.some(message => message.id === replyId)
        ? current.map(message => message.id === replyId ? completed : message)
        : [...current, completed]);
    } catch (cause) {
      if (request.current !== controller) return;
      setMessages(current => current.filter(message => message.id !== replyId));
      setError(cause instanceof Error ? cause.message : 'Chat is unavailable. Please try again.');
      setFailedQuestion(content);
    } finally {
      if (request.current === controller) { request.current = null; setBusy(false); setStreamingId(null); input.current?.focus(); }
    }
  }

  function submit(event: FormEvent) { event.preventDefault(); void send(draft); }

  return <div className="chat-widget" hidden={hidden}>
    {open && <section id="heads-up-chat" className="chat-panel" role="dialog" aria-modal="false" aria-labelledby="chat-title"
      onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); close(); } }}>
      <div className="chat-panel-header">
        <SupportAvatar />
        <div className="chat-heading"><h2 id="chat-title">Heads Up assistant<span>.</span></h2><p>Your guide for the road ahead</p></div>
        <button className="chat-icon-button" type="button" aria-label="Start a new chat" onClick={reset}><RotateCcw size={17} /></button>
        <button className="chat-icon-button" type="button" aria-label="Minimize chat" onClick={close}><ChevronDown size={22} /></button>
      </div>

      <div className="chat-vehicle-context"><CarFront size={18} /><span>{profile ? `${profile.vehicle} · ${context.mileage.toLocaleString()} mi` : 'Loading your vehicle…'}</span><span className="chat-demo-label">Demo guide</span></div>

      <div ref={thread} className="chat-thread" role="log" aria-label="Chat conversation" aria-live="polite" aria-relevant="additions text" aria-busy={busy} tabIndex={0}>
        <div className="chat-conversation-label">A LITTLE HELP, RIGHT HERE</div>
        {messages.map(message => <div className={`chat-message chat-message-${message.role}`} key={message.id}>
          {message.role === 'assistant' && <SupportAvatar small />}
          <div className="chat-message-body"><span className="chat-sr-only">{message.role === 'assistant' ? 'Heads Up assistant' : 'You'}: </span>
            <div className={`chat-bubble${message.id === streamingId ? ' chat-bubble-streaming' : ''}`}>{message.content.split('\n\n').map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
            {message.action && <button className="chat-answer-action" type="button" onClick={() => { onNavigate(message.action!.page); close(); }}>{message.action.label}<ArrowUpRight size={15} /></button>}
            {message.source && <a className="chat-source" href={message.source.href} target="_blank" rel="noreferrer"><FileText size={14} />{message.source.label}<ArrowUpRight size={13} /></a>}
          </div>
        </div>)}
        {messages.length === 1 && <div className="chat-starters"><span>A good place to start</span><div>{starters.map(starter => <button type="button" key={starter.label} disabled={busy || !profile} onClick={() => void send(starter.question)}>{starter.label}<ArrowRight size={14} /></button>)}</div></div>}
        {busy && streamingId === null && <div className="chat-typing"><SupportAvatar small /><span><i /><i /><i /></span><span className="chat-thinking-label">Thinking…</span></div>}
        {error && <div className="chat-error" role="alert"><p>{error}</p><button type="button" onClick={() => void send(failedQuestion, true)} disabled={busy}>Try again<RotateCcw size={13} /></button></div>}
      </div>

      <div className="chat-composer-area">
        <span className="chat-sr-only" role="status">{busy ? streamingId === null ? 'Heads Up is thinking.' : 'Heads Up is writing a reply.' : ''}</span>
        <form className="chat-composer" onSubmit={submit}>
          <label className="chat-sr-only" htmlFor="chat-question">Message the Heads Up assistant</label>
          <input ref={input} id="chat-question" value={draft} onChange={event => setDraft(event.target.value)} maxLength={600} placeholder="Ask anything about Heads Up…" autoComplete="off" disabled={!profile} onKeyDown={event => { if (event.key === 'Enter' && event.nativeEvent.isComposing) event.preventDefault(); }} />
          <button type="submit" aria-label="Send message" disabled={busy || !draft.trim() || !profile}><Send size={18} /></button>
        </form>
        <p className="chat-disclosure"><Sparkles size={12} />Answers from app demo data · No live agent</p>
      </div>
    </section>}

    <button ref={launcher} className={`chat-launcher${open ? ' chat-launcher-open' : ''}`} type="button" aria-label={open ? 'Close Heads Up chat' : 'Open Heads Up chat'} aria-expanded={open} aria-controls="heads-up-chat" aria-haspopup="dialog" onClick={() => open ? close() : setOpen(true)}>
      {open ? <X size={23} /> : <><SupportAvatar /><span>Ask Heads Up<small>A little help for your next mile</small></span><span className="chat-launcher-arrow"><ArrowUpRight size={19} /></span></>}
    </button>
  </div>;
}
