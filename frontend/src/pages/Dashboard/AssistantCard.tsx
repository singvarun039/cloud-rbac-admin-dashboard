import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { Separator } from '../../components/ui/separator';
import { Skeleton } from '../../components/ui/skeleton';
import { Textarea } from '../../components/ui/textarea';
import { SourcesBadges } from '../../components/common/SourcesBadges';

type SourceMeta = { key: string; label: string; description: string };

interface AssistantCardProps {
  assistantPrompt: string;
  setAssistantPrompt: (v: string) => void;
  assistantAnswer: string;
  assistantSources: SourceMeta[];
  assistantError: string | null;
  assistantLoading: boolean;
  onSubmit: (prompt: string) => void;
  onClear: () => void;
  suggestedPrompts: string[];
}

export function AssistantCard({
  assistantPrompt,
  setAssistantPrompt,
  assistantAnswer,
  assistantSources,
  assistantError,
  assistantLoading,
  onSubmit,
  onClear,
  suggestedPrompts,
}: AssistantCardProps) {
  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg text-slate-950">RBAC AI Assistant</CardTitle>
        <CardDescription>
          Ask grounded questions about access health, risks, and next steps.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap gap-2">
          {suggestedPrompts.map((prompt) => (
            <Button
              key={prompt}
              type="button"
              variant="outline"
              size="sm"
              className="h-auto whitespace-normal text-left"
              onClick={() => {
                setAssistantPrompt(prompt);
                onSubmit(prompt);
              }}
              disabled={assistantLoading}
            >
              {prompt}
            </Button>
          ))}
        </div>

        <div className="space-y-3">
          <div className="text-sm font-medium text-slate-700">Your question</div>
          <Textarea
            id="assistant-prompt"
            className="min-h-[144px]"
            placeholder="Example: Explain whether our current roles look too broad for a production admin dashboard."
            value={assistantPrompt}
            onChange={(e) => setAssistantPrompt(e.target.value)}
            disabled={assistantLoading}
          />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={() => onSubmit(assistantPrompt)}
              disabled={assistantLoading}
            >
              {assistantLoading ? 'Thinking...' : 'Ask assistant'}
            </Button>
            <Button type="button" variant="ghost" onClick={onClear} disabled={assistantLoading}>
              Clear
            </Button>
          </div>
        </div>

        {assistantError ? (
          <Alert variant="destructive">
            <AlertTitle>Assistant unavailable</AlertTitle>
            <AlertDescription>{assistantError}</AlertDescription>
          </Alert>
        ) : null}

        <Separator />

        <div className="space-y-3">
          <div className="section-label">Latest answer</div>
          <div className="content-box">
            {assistantLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-11/12" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            ) : assistantAnswer ? (
              <div className="whitespace-pre-wrap">{assistantAnswer}</div>
            ) : (
              'No answer yet. Try a starter prompt or ask a custom question.'
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="section-label">Data sources</div>
          <SourcesBadges sources={assistantSources} />
        </div>
      </CardContent>
    </Card>
  );
}
