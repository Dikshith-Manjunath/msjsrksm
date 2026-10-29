import * as React from 'react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';
import { cn } from '@/lib/utils';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <div className={cn('wind-calendar-wrapper', className)}>
      <DayPicker
        showOutsideDays={showOutsideDays}
        classNames={{
          root: 'wind-calendar-root',
          months: 'wind-calendar-months',
          month: 'wind-calendar-month',
          caption: 'wind-calendar-caption',
          caption_label: 'wind-calendar-caption-label',
          nav: 'wind-calendar-nav',
          nav_button: 'wind-calendar-nav-btn',
          table: 'wind-calendar-table',
          head_row: 'wind-calendar-head-row',
          head_cell: 'wind-calendar-head-cell',
          row: 'wind-calendar-row',
          cell: 'wind-calendar-cell',
          day: 'wind-calendar-day',
          day_button: 'wind-calendar-day-btn',
          selected: 'wind-calendar-selected',
          today: 'wind-calendar-today',
          outside: 'wind-calendar-outside',
          disabled: 'wind-calendar-disabled',
          ...classNames,
        }}
        {...props}
      />
    </div>
  );
}
