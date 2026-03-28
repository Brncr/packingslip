import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Filter, X, Calendar, DollarSign, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";

export interface FilterValues {
  dateFrom?: Date;
  dateTo?: Date;
  minValue?: number;
  maxValue?: number;
  customer?: string;
}

interface AdvancedFiltersProps {
  filters: FilterValues;
  onFiltersChange: (filters: FilterValues) => void;
  activeFiltersCount: number;
}

export function AdvancedFilters({ filters, onFiltersChange, activeFiltersCount }: AdvancedFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dateFromOpen, setDateFromOpen] = useState(false);
  const [dateToOpen, setDateToOpen] = useState(false);

  const clearFilters = () => {
    onFiltersChange({});
  };

  const updateFilter = (key: keyof FilterValues, value: FilterValues[keyof FilterValues]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <div className="relative">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="w-4 h-4" />
            Filters
            {activeFiltersCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
            <ChevronDown className="w-3 h-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-4" align="start">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-foreground">Advanced Filters</h4>
              {activeFiltersCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs h-7">
                  Clear all
                </Button>
              )}
            </div>

            {/* Date Range */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Date Range</Label>
              <div className="flex gap-2">
                <Popover open={dateFromOpen} onOpenChange={setDateFromOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="flex-1 justify-start text-left font-normal">
                      <Calendar className="w-3 h-3 mr-2" />
                      {filters.dateFrom ? format(filters.dateFrom, 'MMM d') : 'From'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={filters.dateFrom}
                      onSelect={(date) => {
                        updateFilter('dateFrom', date);
                        setDateFromOpen(false);
                      }}
                    />
                  </PopoverContent>
                </Popover>
                <Popover open={dateToOpen} onOpenChange={setDateToOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="flex-1 justify-start text-left font-normal">
                      <Calendar className="w-3 h-3 mr-2" />
                      {filters.dateTo ? format(filters.dateTo, 'MMM d') : 'To'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={filters.dateTo}
                      onSelect={(date) => {
                        updateFilter('dateTo', date);
                        setDateToOpen(false);
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Value Range */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Order Value ($)</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                  <Input
                    type="number"
                    placeholder="Min"
                    value={filters.minValue || ''}
                    onChange={(e) => updateFilter('minValue', e.target.value ? Number(e.target.value) : undefined)}
                    className="pl-6 h-9"
                  />
                </div>
                <div className="relative flex-1">
                  <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                  <Input
                    type="number"
                    placeholder="Max"
                    value={filters.maxValue || ''}
                    onChange={(e) => updateFilter('maxValue', e.target.value ? Number(e.target.value) : undefined)}
                    className="pl-6 h-9"
                  />
                </div>
              </div>
            </div>

            {/* Customer Filter */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Customer Name</Label>
              <Input
                placeholder="Search by customer..."
                value={filters.customer || ''}
                onChange={(e) => updateFilter('customer', e.target.value || undefined)}
                className="h-9"
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Active Filters Tags */}
      <AnimatePresence>
        {activeFiltersCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-wrap gap-2 mt-2"
          >
            {filters.dateFrom && (
              <FilterTag
                label={`From: ${format(filters.dateFrom, 'MMM d')}`}
                onRemove={() => updateFilter('dateFrom', undefined)}
              />
            )}
            {filters.dateTo && (
              <FilterTag
                label={`To: ${format(filters.dateTo, 'MMM d')}`}
                onRemove={() => updateFilter('dateTo', undefined)}
              />
            )}
            {filters.minValue && (
              <FilterTag
                label={`Min: $${filters.minValue}`}
                onRemove={() => updateFilter('minValue', undefined)}
              />
            )}
            {filters.maxValue && (
              <FilterTag
                label={`Max: $${filters.maxValue}`}
                onRemove={() => updateFilter('maxValue', undefined)}
              />
            )}
            {filters.customer && (
              <FilterTag
                label={`Customer: ${filters.customer}`}
                onRemove={() => updateFilter('customer', undefined)}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FilterTag({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium"
    >
      {label}
      <button onClick={onRemove} className="hover:bg-primary/20 rounded-full p-0.5">
        <X className="w-3 h-3" />
      </button>
    </motion.span>
  );
}
