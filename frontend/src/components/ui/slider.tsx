import * as React from 'react';
import { Slider as SliderPrimitive } from '@base-ui/react/slider';
import { cn } from '@/lib/utils';

export interface SliderProps extends Omit<SliderPrimitive.Root.Props<number>, 'value' | 'defaultValue' | 'onValueChange'> {
  value?: number | number[];
  defaultValue?: number | number[];
  onValueChange?: (value: number | number[]) => void;
  className?: string;
  min?: number;
  max?: number;
  step?: number;
}

export const Slider = React.forwardRef<HTMLDivElement, SliderProps>(
  ({ className, value, defaultValue, min = 0, max = 100, step = 1, onValueChange, disabled, ...props }, ref) => {
    // Determine the active value(s)
    const isArrayValue = Array.isArray(value);
    const isArrayDefault = Array.isArray(defaultValue);
    const rawValue = value !== undefined ? (isArrayValue ? (value as number[])[0] : (value as number)) : undefined;
    const rawDefault = defaultValue !== undefined ? (isArrayDefault ? (defaultValue as number[])[0] : (defaultValue as number)) : min;

    const handleValueChange = (newVal: number) => {
      if (onValueChange) {
        if (isArrayValue || isArrayDefault) {
          onValueChange([newVal]);
        } else {
          onValueChange(newVal);
        }
      }
    };

    return (
      <SliderPrimitive.Root
        ref={ref}
        value={rawValue}
        defaultValue={rawDefault}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onValueChange={handleValueChange}
        className={cn('base-slider-root', className)}
        {...props}
      >
        <SliderPrimitive.Control className="base-slider-control">
          <SliderPrimitive.Track className="base-slider-track">
            <SliderPrimitive.Indicator className="base-slider-indicator" />
            <SliderPrimitive.Thumb className="base-slider-thumb" aria-label="Slider thumb" />
          </SliderPrimitive.Track>
        </SliderPrimitive.Control>
      </SliderPrimitive.Root>
    );
  }
);

Slider.displayName = 'Slider';
