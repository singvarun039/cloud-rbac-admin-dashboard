import { Badge } from '../ui/badge';

type SourceItem = { key: string; label: string; description: string };

interface SourcesBadgesProps {
  sources?: SourceItem[];
  emptyText?: string;
}

export function SourcesBadges({ sources, emptyText = 'No source metadata.' }: SourcesBadgesProps) {
  if (!sources?.length) {
    return <div className="text-sm text-slate-500">{emptyText}</div>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {sources.map((source) => (
        <Badge key={source.key} variant="secondary" title={source.description}>
          {source.label}
        </Badge>
      ))}
    </div>
  );
}
