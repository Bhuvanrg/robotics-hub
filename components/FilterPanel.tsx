import React from 'react';
import { Card, CardContent, CardHeader } from './ui/card';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Separator } from './ui/separator';

interface FilterOption {
  id: string;
  label: string;
  count?: number;
}

interface FilterSection {
  id: string;
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  type: 'checkbox' | 'select' | 'date';
  options?: FilterOption[];
  value?: string | string[];
  placeholder?: string;
}

interface FilterPanelProps {
  sections: FilterSection[];
  onFilterChange: (sectionId: string, value: string | string[]) => void;
  onApplyFilters: () => void;
  onClearFilters: () => void;
  isVisible: boolean;
}

export function FilterPanel({
  sections,
  onFilterChange,
  onApplyFilters,
  onClearFilters,
  isVisible,
}: FilterPanelProps) {
  if (!isVisible) return null;

  const handleCheckboxChange = (sectionId: string, optionId: string, currentValue: string[]) => {
    const newValue = currentValue.includes(optionId)
      ? currentValue.filter((id) => id !== optionId)
      : [...currentValue, optionId];
    onFilterChange(sectionId, newValue);
  };

  return (
    <Card className="mb-4">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Filters</h3>
          <Button variant="ghost" size="sm" onClick={onClearFilters}>
            Clear All
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {sections.map((section, index) => {
          const Icon = section.icon;
          return (
            <div key={section.id}>
              <div className="flex items-center space-x-2 mb-3">
                {Icon && <Icon className="w-4 h-4 text-muted-foreground" />}
                <h4 className="font-medium text-sm">{section.title}</h4>
              </div>

              {section.type === 'checkbox' && (
                <div className="space-y-2">
                  {section.options?.map((option) => (
                    <div key={option.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`${section.id}-${option.id}`}
                        checked={((section.value as string[]) || []).includes(option.id)}
                        onCheckedChange={() =>
                          handleCheckboxChange(
                            section.id,
                            option.id,
                            (section.value as string[]) || []
                          )
                        }
                      />
                      <label
                        htmlFor={`${section.id}-${option.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex-1 cursor-pointer"
                      >
                        <div className="flex items-center justify-between">
                          <span>{option.label}</span>
                          {option.count !== undefined && (
                            <span className="text-xs text-muted-foreground">({option.count})</span>
                          )}
                        </div>
                      </label>
                    </div>
                  ))}
                </div>
              )}

              {section.type === 'select' && (
                <Select
                  value={(section.value as string) || ''}
                  onValueChange={(value) => onFilterChange(section.id, value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={section.placeholder || 'Select option'} />
                  </SelectTrigger>
                  <SelectContent>
                    {section.options?.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {index < sections.length - 1 && <Separator className="mt-4" />}
            </div>
          );
        })}

        <div className="flex space-x-2 pt-4">
          <Button
            onClick={onApplyFilters}
            className="flex-1 bg-teal-600 hover:bg-teal-700"
            size="sm"
          >
            Apply Filters
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
