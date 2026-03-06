import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router";

interface HeaderProps {
  title: string;
  back?: boolean;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  onBack?: () => void;
}

export function Header({
  title,
  back = false,
  leftSlot,
  rightSlot,
  onBack,
}: HeaderProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  return (
    <header className="flex items-center bg-background p-4 pb-2 justify-between sticky top-0 z-10 border-b border-border">
      {/* Left Section */}
      <div className="flex size-12 shrink-0 items-center justify-start">
        {back ? (
          <button
            onClick={handleBack}
            className="flex items-center justify-center text-text-primary hover:text-primary transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        ) : (
          leftSlot
        )}
      </div>

      {/* Center Title */}
      <h2 className="text-text-primary text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">
        {title}
      </h2>

      {/* Right Section */}
      <div className="flex size-12 shrink-0 items-center justify-end">
        {rightSlot}
      </div>
    </header>
  );
}
