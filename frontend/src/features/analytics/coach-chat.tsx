import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, MessageSquare, RotateCcw, Send } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { useCoachChat } from '@/lib/hooks'
import type { InsightsSource } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTIONS = [
  'Which checklist rules should I cut or keep?',
  'What TP and BE fit my Max RR hit rates?',
  'Should I take a 2nd setup after a first win?',
  'How should I change my strategy this week?',
]

export function CoachChat({ source }: { source: InsightsSource }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const coach = useCoachChat()

  useEffect(() => {
    setMessages([])
    setDraft('')
  }, [source])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, coach.isPending])

  async function send(text: string) {
    const message = text.trim()
    if (!message || coach.isPending) return

    const history = messages
    setMessages((prev) => [...prev, { role: 'user', content: message }])
    setDraft('')

    try {
      const result = await coach.mutateAsync({
        message,
        source,
        history,
      })
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: result.reply },
      ])
    } catch (err) {
      setMessages((prev) => prev.slice(0, -1))
      setDraft(message)
      toast.error(
        err instanceof ApiError ? err.message : 'Coach could not reply'
      )
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    void send(draft)
  }

  return (
    <Card className="border-border/80">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageSquare className="h-4 w-4" />
            Strategy coach
          </CardTitle>
          <CardDescription>
            Ask follow-ups about TP/BE, checklist rules, times, and 2nd setups. Grounded in your
            current {source.replace('_', ' ')} analytics — not a signal feed.
          </CardDescription>
        </div>
        {messages.length > 0 ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setMessages([])}
            disabled={coach.isPending}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Clear
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex max-h-[420px] min-h-[200px] flex-col gap-3 overflow-y-auto rounded-lg border border-border/60 bg-muted/10 p-3">
          {messages.length === 0 ? (
            <div className="flex flex-1 flex-col justify-center gap-3 py-6">
              <p className="text-center text-sm text-muted-foreground">
                Start with a question, or try one of these:
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <Button
                    key={s}
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-auto max-w-full whitespace-normal px-3 py-1.5 text-left text-xs"
                    disabled={coach.isPending}
                    onClick={() => void send(s)}
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div
                key={`${m.role}-${i}`}
                className={cn(
                  'max-w-[92%] rounded-xl px-3 py-2 text-sm',
                  m.role === 'user'
                    ? 'ml-auto bg-primary text-primary-foreground'
                    : 'mr-auto border border-border/70 bg-card'
                )}
              >
                {m.role === 'assistant' ? (
                  <div
                    className={cn(
                      'text-sm leading-relaxed',
                      '[&_h1]:mb-2 [&_h1]:mt-3 [&_h1]:text-sm [&_h1]:font-semibold',
                      '[&_h2]:mb-2 [&_h2]:mt-3 [&_h2]:text-sm [&_h2]:font-semibold',
                      '[&_h3]:mb-1.5 [&_h3]:mt-2 [&_h3]:text-sm [&_h3]:font-semibold',
                      '[&_p]:mb-1.5 [&_p]:last:mb-0',
                      '[&_ul]:mb-2 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-4',
                      '[&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-4',
                      '[&_strong]:font-semibold'
                    )}
                  >
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{m.content}</p>
                )}
              </div>
            ))
          )}
          {coach.isPending ? (
            <div className="mr-auto flex items-center gap-2 rounded-xl border border-border/70 bg-card px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Thinking…
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="e.g. Should I remove the London open rule from my checklist?"
            className="min-h-[72px] flex-1 resize-none"
            disabled={coach.isPending}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void send(draft)
              }
            }}
          />
          <Button
            type="submit"
            disabled={coach.isPending || !draft.trim()}
            className="sm:self-stretch"
          >
            {coach.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Send
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
