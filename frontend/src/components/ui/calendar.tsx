import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker, type ChevronProps } from 'react-day-picker';

import { cn } from '../../lib/utils';
import { buttonVariants } from './button-variants';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

// Renders the shared date picker calendar.
function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      classNames={{
        months: 'flex flex-col space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0',
        month: 'space-y-4',
        caption: 'flex justify-center pt-1 relative items-center',
        caption_label: 'text-sm font-medium',
        nav: 'space-x-1 flex items-center',
        nav_button: cn(
          buttonVariants({ variant: 'outline', size: 'icon' }),
          'h-7 w-7 bg-transparent p-0 opacity-70 hover:opacity-100'
        ),
        nav_button_previous: 'absolute left-1',
        nav_button_next: 'absolute right-1',
        table: 'w-full border-collapse space-y-1',
        head_row: 'flex',
        head_cell: 'rounded-md w-9 font-normal text-[0.8rem] text-slate-500',
        row: 'flex w-full mt-2',
        cell: 'h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-slate-100/60 [&:has([aria-selected])]:bg-slate-100 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20',
        day: cn(
          buttonVariants({ variant: 'ghost' }),
          'h-9 w-9 p-0 font-normal aria-selected:opacity-100'
        ),
        day_range_start: 'day-range-start',
        day_range_end: 'day-range-end',
        day_selected:
          'bg-slate-900 text-white hover:bg-slate-900 hover:text-white focus:bg-slate-900 focus:text-white',
        day_today: 'bg-slate-100 text-slate-900',
        day_outside: 'day-outside text-slate-400 opacity-60',
        day_disabled: 'text-slate-400 opacity-50',
        day_range_middle: 'aria-selected:bg-slate-100 aria-selected:text-slate-900',
        day_hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ className: iconClassName, orientation }: ChevronProps) =>
          orientation === 'left' ? (
            <ChevronLeft className={cn('h-4 w-4', iconClassName)} />
          ) : (
            <ChevronRight className={cn('h-4 w-4', iconClassName)} />
          ),
      }}
      {...props}
    />
  );
}

Calendar.displayName = 'Calendar';

export { Calendar };
