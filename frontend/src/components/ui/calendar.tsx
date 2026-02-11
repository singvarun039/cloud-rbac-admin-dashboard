import * as React from "react";
import { format } from "date-fns";
import { DayPicker, type ChevronProps } from "react-day-picker";

import { cn } from "../../lib/utils";
import { Button } from "./button";
import { buttonVariants } from "./button-variants";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

export type CalendarProps = {
  value?: Date;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

function Calendar({
  value,
  onChange,
  placeholder = "Select date",
  disabled,
  className,
}: CalendarProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = React.useCallback(
    (date: Date | undefined) => {
      onChange(date);
      setOpen(false);
    },
    [onChange],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-10 w-full justify-start gap-2 px-3 text-left font-normal",
            !value && "text-muted-foreground",
            className,
          )}
        >
          {value ? format(value, "yyyy-MM-dd") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <DayPicker
          mode="single"
          selected={value}
          onSelect={handleSelect}
          showOutsideDays
          className="p-3"
          classNames={{
            months: "flex flex-col gap-4 sm:flex-row sm:gap-6",
            month: "space-y-4",
            caption: "flex justify-center pt-1 relative items-center",
            caption_label: "text-sm font-medium",
            nav: "space-x-1 flex items-center",
            nav_button: cn(
              buttonVariants({ variant: "outline", size: "icon" }),
              "h-7 w-7 bg-transparent p-0 opacity-70 hover:opacity-100",
            ),
            nav_button_previous: "absolute left-1",
            nav_button_next: "absolute right-1",
            table: "w-full border-collapse space-y-1",
            head_row: "flex",
            head_cell:
              "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
            row: "flex w-full mt-2",
            cell: "relative h-9 w-9 p-0 text-center text-sm focus-within:relative focus-within:z-20",
            day: cn(
              buttonVariants({ variant: "ghost" }),
              "h-9 w-9 p-0 font-normal aria-selected:opacity-100",
            ),
            day_selected:
              "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
            day_today: "bg-accent text-accent-foreground",
            day_outside: "text-muted-foreground opacity-60",
            day_disabled: "text-muted-foreground opacity-50",
            day_hidden: "invisible",
          }}
          components={{
            Chevron: ({
              className: iconClassName,
              orientation,
            }: ChevronProps) => (
              <span
                className={cn("text-xs leading-none", iconClassName)}
                aria-hidden="true"
              >
                {orientation === "left"
                  ? "<"
                  : orientation === "right"
                    ? ">"
                    : orientation === "up"
                      ? "^"
                      : "v"}
              </span>
            ),
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

Calendar.displayName = "Calendar";

export { Calendar };
