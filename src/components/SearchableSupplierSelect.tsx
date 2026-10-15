import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X, Building2 } from 'lucide-react';

export interface SupplierOption {
  name: string;
  count?: number;
}

interface SearchableSupplierSelectProps {
  options: SupplierOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
  placeholder?: string;
  className?: string;
  allLabel?: string;
}

export const SearchableSupplierSelect: React.FC<SearchableSupplierSelectProps> = ({
  options,
  selectedValue,
  onSelect,
  placeholder = 'Pilih Suplier...',
  className = '',
  allLabel = 'Semua Suplier',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus input when popover opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  const filteredOptions = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return options;
    return options.filter((opt) => opt.name.toLowerCase().includes(q));
  }, [options, searchQuery]);

  const selectedDisplay = useMemo(() => {
    if (!selectedValue || selectedValue === 'ALL') {
      return allLabel;
    }
    return selectedValue;
  }, [selectedValue, allLabel]);

  const isSelectedAll = !selectedValue || selectedValue === 'ALL';

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-3 py-2 text-xs border rounded-xl bg-white flex items-center justify-between gap-2 transition-all cursor-pointer text-left shadow-2xs ${
          isOpen
            ? 'border-neutral-900 ring-1 ring-neutral-900'
            : !isSelectedAll
            ? 'border-neutral-900 bg-neutral-50/70 text-neutral-900 font-semibold'
            : 'border-neutral-300 hover:border-neutral-400 text-neutral-700'
        }`}
      >
        <div className="flex items-center gap-2 truncate">
          <Building2
            className={`w-3.5 h-3.5 shrink-0 ${
              !isSelectedAll ? 'text-neutral-900' : 'text-neutral-400'
            }`}
          />
          <span className="truncate">
            {!isSelectedAll ? selectedDisplay : placeholder}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {!isSelectedAll && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onSelect('ALL');
              }}
              className="p-0.5 hover:bg-neutral-200 rounded text-neutral-400 hover:text-neutral-700 transition-colors"
              title="Reset ke Semua Suplier"
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 text-neutral-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-neutral-800' : ''
            }`}
          />
        </div>
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white rounded-xl border border-neutral-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 min-w-[240px]">
          {/* Search box inside dropdown */}
          <div className="p-2 border-b border-neutral-100 bg-neutral-50/80">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ketik nama suplier..."
                className="w-full pl-8 pr-7 py-1.5 text-xs border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* List options */}
          <div className="max-h-56 overflow-y-auto p-1 divide-y divide-neutral-50 text-xs">
            {/* Option: Semua Suplier */}
            <button
              type="button"
              onClick={() => {
                onSelect('ALL');
                setIsOpen(false);
              }}
              className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-left transition-colors cursor-pointer ${
                isSelectedAll
                  ? 'bg-neutral-900 text-white font-semibold'
                  : 'hover:bg-neutral-100 text-neutral-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <span>{allLabel}</span>
              </div>
              {isSelectedAll && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
            </button>

            {/* Filtered supplier list */}
            {filteredOptions.length === 0 ? (
              <div className="py-4 text-center text-xs text-neutral-400">
                Suplier "{searchQuery}" tidak ditemukan
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = selectedValue === opt.name;
                return (
                  <button
                    key={opt.name}
                    type="button"
                    onClick={() => {
                      onSelect(opt.name);
                      setIsOpen(false);
                    }}
                    className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-neutral-900 text-white font-semibold'
                        : 'hover:bg-neutral-100 text-neutral-700'
                    }`}
                  >
                    <span className="truncate pr-2">{opt.name}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {opt.count !== undefined && (
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                            isSelected
                              ? 'bg-white/20 text-white font-bold'
                              : 'bg-neutral-100 text-neutral-600'
                          }`}
                        >
                          {opt.count}
                        </span>
                      )}
                      {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
