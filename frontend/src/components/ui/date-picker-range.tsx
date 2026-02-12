import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";

import { cn } from "../../lib/utils";
import { Button } from "./button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Calendar } from "./calendar";

export type DatePickerRangeProps = {
  value?: DateRange;
  onChange: (range: DateRange | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

function rangeLabel(range: DateRange | undefined, placeholder: string): string {
  if (!range?.from) return placeholder;

  const from = format(range.from, "LLL dd, y");
  if (!range.to) return `${from} - ...`;

  return `${from} - ${format(range.to, "LLL dd, y")}`;
}

function DatePickerRange({
  value,
  onChange,
  placeholder = "Pick a date range",
  disabled,
  className,
}: DatePickerRangeProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = React.useCallback(
    (range: DateRange | undefined) => {
      onChange(range);
      if (range?.from && range?.to) setOpen(false);
    },
    [onChange],
  );

  const label = rangeLabel(value, placeholder);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-10 w-full justify-start text-left font-normal px-2.5",
            !value?.from && "text-slate-500",
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" aria-hidden="true" />
          {label}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          initialFocus
          mode="range"
          selected={value}
          onSelect={handleSelect}
          numberOfMonths={2}
          defaultMonth={value?.from}
        />
      </PopoverContent>
    </Popover>
  );
}

DatePickerRange.displayName = "DatePickerRange";

export { DatePickerRange };
export type { DateRange };
