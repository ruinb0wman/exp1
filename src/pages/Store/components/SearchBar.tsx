import { Search } from "lucide-react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChange, placeholder = "Search for rewards" }: SearchBarProps) {
  return (
    <div className="flex items-center bg-surface rounded-xl px-4 h-12 border border-border">
      <Search className="w-5 h-5 text-text-muted" />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-transparent ml-2 text-text-primary placeholder:text-text-muted focus:outline-none"
      />
    </div>
  );
}
