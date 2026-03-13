import React, { useState } from "react";
import { CalendarIcon, ChevronDown } from "lucide-react";
import { addDays, format } from "date-fns";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";

/**
 * Date Range Picker - shadcn-style design with Popover + Calendar
 * 
 * @param {Object} props
 * @param {Object} props.date - { from: Date, to?: Date } or undefined
 * @param {Function} props.onSelect - (dateRange) => void
 * @param {string} props.label - Label text (default: "Select dates")
 * @param {string} props.placeholder - Placeholder when empty (default: "Pick a range")
 * @param {string} props.className - Additional classes
 * @param {number} props.defaultDays - Default range in days when from is today (default: 7)
 */
const DateRangePicker = ({
  date,
  onSelect,
  label = "Select dates",
  placeholder = "Pick a range",
  className = "",
  defaultDays = 7,
}) => {
  const [open, setOpen] = useState(false);
  const [internalDate, setInternalDate] = useState(
    date ?? { from: new Date(), to: addDays(new Date(), defaultDays) },
  );
  const displayDate = date ?? internalDate;

  const handleSelect = (range) => {
    if (!date) setInternalDate(range);
    onSelect?.(range);
    if (range?.from && range?.to) {
      setOpen(false);
    }
  };

  return (
    <div className={cn("grid gap-3", className)}>
      {label && (
        <Label htmlFor="date-range" className="text-sm font-medium px-1">
          {label}
        </Label>
      )}
      <div className={cn("grid gap-2")}>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              id="date-range"
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal h-11 transition-all hover:bg-muted/50 focus:ring-2 focus:ring-primary/20 cursor-pointer",
                !displayDate && "text-muted-foreground",
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4 opacity-70" />
              {displayDate?.from ? (
                displayDate?.to ? (
                  <>
                    {format(displayDate.from, "LLL dd, y")} -{" "}
                    {format(displayDate.to, "LLL dd, y")}
                  </>
                ) : (
                  format(displayDate.from, "LLL dd, y")
                )
              ) : (
                <span>{placeholder}</span>
              )}
              <ChevronDown className="ml-auto h-4 w-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-auto p-0 border-muted/20 shadow-xl"
            align="start"
          >
            <Calendar
              mode="range"
              defaultMonth={displayDate?.from}
              selected={displayDate}
              onSelect={handleSelect}
              numberOfMonths={2}
              className="p-3"
            />
          </PopoverContent>
        </Popover>
      </div>
      {displayDate?.from && displayDate?.to && (
        <p className="text-xs text-muted-foreground px-1">
          Duration: {Math.round((displayDate.to.getTime() - displayDate.from.getTime()) / (1000 * 60 * 60 * 24))} days
        </p>
      )}
    </div>
  );
};

export default DateRangePicker;
