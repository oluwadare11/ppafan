/**
 * NumericInput — text input with live comma formatting for currency/amount fields.
 *
 * Features:
 * - Shows empty (not "0") when value is 0 — placeholder shown instead
 * - Inserts commas as you type:  1500000 → 1,500,000
 * - Supports optional decimals via `decimal` prop (formats integer part only)
 * - Passes a numeric value (number type) to onChange
 * - Mobile-friendly: inputMode="numeric"
 *
 * Usage:
 *   <NumericInput value={salary} onChange={setSalary} placeholder="e.g. 500,000" />
 *   <NumericInput value={price} onChange={setPrice} decimal className="w-28 pl-6 ..." />
 */
import { useState, useEffect, useRef } from 'react';

export default function NumericInput({
  value,
  onChange,
  placeholder = '',
  className,
  disabled = false,
  decimal = false,
  required = false,
}) {
  const inputRef = useRef(null);
  const [display, setDisplay] = useState('');

  // Format a raw digit string with comma thousand-separators (integer part only)
  const formatDigits = (digits) => {
    if (!digits) return '';
    if (decimal) {
      const dotIdx = digits.indexOf('.');
      if (dotIdx !== -1) {
        const intPart = digits.slice(0, dotIdx);
        const decPart = digits.slice(dotIdx); // includes the "."
        return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + decPart;
      }
    }
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  // Sync display when the external value changes (form reset, API load, etc.)
  useEffect(() => {
    if (inputRef.current && document.activeElement === inputRef.current) return;
    const num = Number(value) || 0;
    setDisplay(num ? formatDigits(decimal ? num.toString() : String(Math.round(num))) : '');
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (e) => {
    const raw = e.target.value;
    const cursorPos = e.target.selectionStart;

    // Strip anything that isn't a digit (or decimal point in decimal mode)
    const strip = decimal ? /[^0-9.]/g : /[^0-9]/g;
    let digits = raw.replace(strip, '');

    // Prevent multiple decimal points
    if (decimal) {
      const parts = digits.split('.');
      if (parts.length > 2) digits = `${parts[0]}.${parts.slice(1).join('')}`;
    }

    // Count how many digit chars were before the cursor in the unformatted input
    const digitsBeforeCursor = raw.slice(0, cursorPos).replace(strip, '').length;

    const formatted = formatDigits(digits);
    setDisplay(formatted);

    const num = decimal
      ? parseFloat(digits) || 0
      : parseInt(digits, 10) || 0;
    onChange(num);

    // Restore cursor position after React re-renders with the new formatted value
    requestAnimationFrame(() => {
      if (!inputRef.current) return;
      let found = 0;
      let newPos = formatted.length;
      for (let i = 0; i < formatted.length; i++) {
        if (/[0-9]/.test(formatted[i])) {
          found++;
          if (found === digitsBeforeCursor) {
            newPos = i + 1;
            break;
          }
        }
      }
      inputRef.current.setSelectionRange(newPos, newPos);
    });
  };

  const handleBlur = () => {
    const clean = display.replace(/,/g, '');
    const num = decimal
      ? parseFloat(clean) || 0
      : parseInt(clean, 10) || 0;
    setDisplay(num ? formatDigits(decimal ? num.toString() : String(Math.round(num))) : '');
    onChange(num);
  };

  const defaultClass =
    'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      value={display}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      className={className !== undefined ? className : defaultClass}
    />
  );
}
