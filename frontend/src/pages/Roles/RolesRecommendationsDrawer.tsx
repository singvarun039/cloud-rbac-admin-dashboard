import { Alert, AlertDescription } from '../../components/ui/alert';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '../../components/ui/drawer';
import { Skeleton } from '../../components/ui/skeleton';
import { SourcesBadges } from '../../components/common/SourcesBadges';
import type { RoleRecommendationsResponse } from '../../api/roleRecommendations';

interface RolesRecommendationsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recommendations: RoleRecommendationsResponse | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export function RolesRecommendationsDrawer({
  open,
  onOpenChange,
  recommendations,
  loading,
  error,
  onRefresh,
}: RolesRecommendationsDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="inset-y-0 right-0 left-auto h-full w-full max-w-[720px] border-l border-slate-200">
        <div className="flex h-full flex-col">
          <div className="border-b border-slate-200 px-6 py-5">
            <DrawerHeader className="space-y-2">
              <DrawerTitle>AI role recommendations</DrawerTitle>
              <DrawerDescription>
                Review overlap, broad roles, and least-privilege cleanup without taking over the
                main Roles page.
              </DrawerDescription>
            </DrawerHeader>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onRefresh}
                  disabled={loading}
                >
                  {loading ? 'Refreshing...' : 'Refresh recommendations'}
                </Button>
                {recommendations?.analytics.roleAuditVisible === false ? (
                  <span className="text-sm text-slate-500">
                    Audit-based grounding is limited for this user.
                  </span>
                ) : null}
              </div>

              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Distinct permissions
                  </div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">
                    {loading && !recommendations
                      ? '...'
                      : (recommendations?.analytics.totalDistinctPermissions ?? '—')}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Roles with no permissions
                  </div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">
                    {loading && !recommendations
                      ? '...'
                      : (recommendations?.analytics.rolesWithNoPermissions.length ?? '—')}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    High-overlap pairs
                  </div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">
                    {loading && !recommendations
                      ? '...'
                      : (recommendations?.analytics.overlapPairs.length ?? '—')}
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  AI summary
                </div>
                {loading && !recommendations ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-11/12" />
                    <Skeleton className="h-4 w-4/5" />
                  </div>
                ) : recommendations?.answer ? (
                  <div className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {recommendations.answer}
                  </div>
                ) : (
                  <div className="text-sm text-slate-500">No recommendation summary yet.</div>
                )}
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Data sources
                </div>
                <SourcesBadges sources={recommendations?.sources} />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Overlap pairs
                  </div>
                  {recommendations?.analytics.overlapPairs.length ? (
                    <div className="space-y-2">
                      {recommendations.analytics.overlapPairs.slice(0, 3).map((pair) => (
                        <div
                          key={`${pair.roleA}-${pair.roleB}`}
                          className="rounded-lg border border-slate-200 p-3"
                        >
                          <div className="text-sm font-medium text-slate-900">
                            {pair.roleA} x {pair.roleB}
                          </div>
                          <div className="mt-1 text-sm text-slate-600">
                            Shared permissions: {pair.overlapCount}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {pair.sharedPermissions.slice(0, 4).map((key) => (
                              <Badge key={key} variant="secondary">
                                {key}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500">No overlap analysis available yet.</div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Broadest roles
                  </div>
                  {recommendations?.analytics.broadestRoles.length ? (
                    <div className="space-y-2">
                      {recommendations.analytics.broadestRoles.slice(0, 4).map((item) => (
                        <div
                          key={item.role}
                          className="flex items-center justify-between rounded-lg border border-slate-200 p-3"
                        >
                          <span className="text-sm font-medium text-slate-900">{item.role}</span>
                          <Badge variant="secondary">{item.permissionCount} permissions</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500">No role breadth data available.</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 px-6 py-4">
            <DrawerFooter className="sm:justify-between">
              <div className="text-sm text-slate-500">
                AI recommendations stay out of the main table flow until needed.
              </div>
              <DrawerClose asChild>
                <Button type="button" variant="outline">
                  Close
                </Button>
              </DrawerClose>
            </DrawerFooter>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
