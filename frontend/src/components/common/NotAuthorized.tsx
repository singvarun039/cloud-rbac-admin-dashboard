import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface NotAuthorizedProps {
  resource?: string;
}

export function NotAuthorized({ resource = 'this page' }: NotAuthorizedProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Forbidden (403)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600">You don't have permission to view {resource}.</p>
        </CardContent>
      </Card>
    </div>
  );
}
