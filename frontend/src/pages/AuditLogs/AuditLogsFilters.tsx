import { Button } from '../../components/ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '../../components/ui/drawer';
import { Input } from '../../components/ui/input';
import { Separator } from '../../components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Card, CardContent } from '../../components/ui/card';
import { DatePickerRange, type DateRange } from '../../components/ui/date-picker-range';
import { format } from 'date-fns';
import { useMemo } from 'react';

const ACTION_OPTIONS = [
  'ALL',
  'LOGIN_SUCCESS',
  'LOGIN_FAILURE',
  'USER_CREATED',
  'USER_UPDATED',
  'USER_DELETED',
  'USER_DEACTIVATED',
  'ROLE_CREATED',
  'ROLE_UPDATED',
  'ROLE_ASSIGNED',
  'ROLE_PERMISSION_UPDATED',
  'PROJECT_CREATED',
  'PROJECT_UPDATED',
  'PROJECT_ARCHIVED',
];

function parseDateOnly(value: string): Date | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const d = new Date(`${trimmed}T00:00:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

interface AuditLogsFiltersProps {
  loading: boolean;
  actionInput: string;
  setActionInput: (v: string) => void;
  actorEmailInput: string;
  setActorEmailInput: (v: string) => void;
  requestIdInput: string;
  setRequestIdInput: (v: string) => void;
  dateFromInput: string;
  setDateFromInput: (v: string) => void;
  dateToInput: string;
  setDateToInput: (v: string) => void;
  actorUserIdInput: string;
  setActorUserIdInput: (v: string) => void;
  entityTypeInput: string;
  setEntityTypeInput: (v: string) => void;
  entityIdInput: string;
  setEntityIdInput: (v: string) => void;
  advancedOpen: boolean;
  setAdvancedOpen: (v: boolean) => void;
  onApplyFilters: () => void;
  onResetFilters: () => void;
}

export function AuditLogsFilters({
  loading,
  actionInput,
  setActionInput,
  actorEmailInput,
  setActorEmailInput,
  requestIdInput,
  setRequestIdInput,
  dateFromInput,
  setDateFromInput,
  dateToInput,
  setDateToInput,
  actorUserIdInput,
  setActorUserIdInput,
  entityTypeInput,
  setEntityTypeInput,
  entityIdInput,
  setEntityIdInput,
  advancedOpen,
  setAdvancedOpen,
  onApplyFilters,
  onResetFilters,
}: AuditLogsFiltersProps) {
  const selectedRange = useMemo<DateRange | undefined>(() => {
    const from = parseDateOnly(dateFromInput);
    const to = parseDateOnly(dateToInput);
    if (!from && !to) return undefined;
    if (from && to && to < from) return { from: to, to: from };
    return { from, to };
  }, [dateFromInput, dateToInput]);

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:flex-1">
            <Select value={actionInput} onValueChange={setActionInput}>
              <SelectTrigger className="h-10 w-full" aria-label="Action">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTION_OPTIONS.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={actorEmailInput}
              onChange={(e) => setActorEmailInput(e.target.value)}
              placeholder="Actor email"
              aria-label="Actor email"
              type="text"
              className="h-10 w-full placeholder:text-slate-400"
            />
            <DatePickerRange
              value={selectedRange}
              onChange={(range) => {
                setDateFromInput(range?.from ? format(range.from, 'yyyy-MM-dd') : '');
                setDateToInput(range?.to ? format(range.to, 'yyyy-MM-dd') : '');
              }}
              placeholder="Pick a date range"
              className="w-full"
            />
            <Input
              value={requestIdInput}
              onChange={(e) => setRequestIdInput(e.target.value)}
              placeholder="Search request ID"
              aria-label="Search request ID"
              type="text"
              className="h-10 w-full placeholder:text-slate-400"
            />
          </div>

          <div className="flex w-full flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end lg:w-auto">
            <Button
              type="button"
              onClick={onApplyFilters}
              disabled={loading}
              className="h-10 w-full sm:w-auto"
            >
              Apply Filters
            </Button>
            <Button
              variant="outline"
              type="button"
              onClick={onResetFilters}
              disabled={loading}
              className="h-10 w-full sm:w-auto"
            >
              Reset Filters
            </Button>
            <Separator orientation="vertical" className="hidden h-10 sm:block" />

            <Drawer open={advancedOpen} onOpenChange={setAdvancedOpen} direction="right">
              <DrawerTrigger asChild>
                <Button type="button" className="h-10 w-full sm:w-auto">
                  Advanced Filters
                </Button>
              </DrawerTrigger>
              <DrawerContent className="inset-y-0 right-0 h-full w-3/4 border-l border-slate-200 sm:max-w-sm">
                <DrawerClose
                  className="absolute right-2 top-2 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                  aria-label="Close"
                >
                  <span className="text-lg leading-none">×</span>
                </DrawerClose>
                <div className="flex h-full flex-col px-6 pb-6 pt-4">
                  <DrawerHeader className="pr-10">
                    <DrawerTitle>Advanced Filters</DrawerTitle>
                    <DrawerDescription>
                      Refine audit logs using additional fields.
                    </DrawerDescription>
                  </DrawerHeader>
                  <div className="mt-4 flex-1 space-y-3 overflow-auto">
                    <Input
                      value={actorUserIdInput}
                      onChange={(e) => setActorUserIdInput(e.target.value)}
                      placeholder="Actor user ID"
                      aria-label="Actor user ID"
                      type="text"
                      className="h-10 w-full placeholder:text-slate-400"
                    />
                    <Input
                      value={entityTypeInput}
                      onChange={(e) => setEntityTypeInput(e.target.value)}
                      placeholder="Entity type"
                      aria-label="Entity type"
                      type="text"
                      className="h-10 w-full placeholder:text-slate-400"
                    />
                    <Input
                      value={entityIdInput}
                      onChange={(e) => setEntityIdInput(e.target.value)}
                      placeholder="Entity ID"
                      aria-label="Entity ID"
                      type="text"
                      className="h-10 w-full placeholder:text-slate-400"
                    />
                  </div>
                  <DrawerFooter className="border-t border-slate-200 pt-4">
                    <Button
                      variant="outline"
                      type="button"
                      onClick={onResetFilters}
                      className="h-10"
                    >
                      Reset
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        onApplyFilters();
                        setAdvancedOpen(false);
                      }}
                      className="h-10"
                    >
                      Apply Filters
                    </Button>
                  </DrawerFooter>
                </div>
              </DrawerContent>
            </Drawer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
