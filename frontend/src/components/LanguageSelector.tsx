'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { Language } from '@/locales';
import { Globe, Check, ChevronDown } from 'lucide-react';

interface LanguageSelectorProps {
  variant?: 'header' | 'sidebar' | 'login' | 'inline';
  className?: string;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  variant = 'header',
  className = '',
}) => {
  const { language, setLanguage, languages } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeOption = languages.find((l) => l.code === language) || languages[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (langCode: Language) => {
    setLanguage(langCode);
    setIsOpen(false);
  };

  const getShortLabel = (code: string) => {
    switch (code) {
      case 'am': return 'አማ';
      case 'om': return 'OM';
      default: return 'EN';
    }
  };

  if (variant === 'sidebar') {
    return (
      <div className={`relative ${className}`} ref={dropdownRef}>
        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-[#CBB29F] tracking-wider mb-1.5 px-1">
          <Globe className="w-3.5 h-3.5 text-[#E87A18]" />
          <span>ቋንቋ / Language</span>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold bg-[#3D2314] hover:bg-[#5A3A23] text-white border border-[#5A3A23] transition-all cursor-pointer shadow-xs"
          aria-haspopup="true"
          aria-expanded={isOpen}
        >
          <span className="truncate">{activeOption.nativeName}</span>
          <ChevronDown className={`w-3.5 h-3.5 text-[#CBB29F] transition-transform duration-200 shrink-0 ml-1.5 ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div
            className="absolute bottom-full left-0 right-0 mb-2 rounded-2xl bg-[#3D2314] shadow-2xl border border-[#5A3A23] py-1.5 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150"
            role="menu"
          >
            {languages.map((item) => {
              const isSelected = item.code === language;
              return (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => handleSelect(item.code)}
                  className={`w-full text-left px-3 py-2 flex items-center justify-between text-xs font-bold transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#E87A18] text-white'
                      : 'text-[#E2C7B4] hover:bg-[#5A3A23] hover:text-white'
                  }`}
                  role="menuitem"
                >
                  <span className="truncate">{item.nativeName}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-white shrink-0 ml-1.5 stroke-[2.5]" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Header, Login, and Default Dropdown: clean dropdown trigger and menu - strictly NO flags
  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-1 xs:gap-1.5 sm:gap-2 px-2 xs:px-2.5 sm:px-3 py-1 xs:py-1.5 rounded-lg xs:rounded-xl text-xs sm:text-sm font-extrabold bg-[#FAF7EE] hover:bg-[#F4ECE1] text-[#2C1B10] border border-[#EDE4D5] transition-all shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#E87A18]/40 cursor-pointer"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <Globe className="w-3 h-3 xs:w-3.5 xs:h-3.5 sm:w-4 sm:h-4 text-[#E87A18] shrink-0" />
        <span className="hidden md:inline font-bold tracking-tight">{activeOption.nativeName}</span>
        <span className="md:hidden font-extrabold tracking-tight">{getShortLabel(activeOption.code)}</span>
        <ChevronDown className={`w-3 h-3 xs:w-3.5 xs:h-3.5 text-[#8C7361] transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-48 rounded-2xl bg-white shadow-xl border border-[#EDE4D5] py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
          role="menu"
        >
          <div className="px-3.5 py-1 text-[10px] font-black text-[#8C7361] uppercase tracking-wider border-b border-[#F4ECE1] mb-1 flex items-center justify-between">
            <span>ቋንቋ / Language</span>
          </div>
          <div className="py-0.5">
            {languages.map((item) => {
              const isSelected = item.code === language;
              return (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => handleSelect(item.code)}
                  className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#FAF7EE] text-[#E87A18]'
                      : 'text-[#2C1B10] hover:bg-[#FAF7EE]/70 hover:text-[#E87A18]'
                  }`}
                  role="menuitem"
                >
                  <div>
                    <div className="leading-tight">{item.nativeName}</div>
                    <div className="text-[10px] text-[#8C7361] font-medium leading-tight mt-0.5">{item.label}</div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-[#E87A18] stroke-[2.5] shrink-0 ml-2" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default LanguageSelector;
