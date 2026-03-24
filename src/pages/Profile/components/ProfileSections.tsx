import { Settings } from "lucide-react";

interface ProfileHeaderProps {
  onSettingsClick: () => void;
}

export function ProfileHeader({ onSettingsClick }: ProfileHeaderProps) {
  return (
    <header className="flex items-center p-4 pb-2 justify-between sticky top-0 bg-background z-10">
      <div className="w-12" />
      <h1 className="text-lg font-bold text-text-primary flex-1 text-center">
        My Profile
      </h1>
      <button
        onClick={onSettingsClick}
        className="w-12 flex justify-end text-text-secondary hover:text-primary transition-colors"
      >
        <Settings className="w-5 h-5" />
      </button>
    </header>
  );
}

interface UserInfoSectionProps {
  user: { name?: string } | null;
}

export function UserInfoSection({ user }: UserInfoSectionProps) {
  return (
    <div className="p-4">
      <div className="flex gap-4 items-center">
        <div className="w-20 h-20 rounded-xl bg-surface flex items-center justify-center text-text-primary text-2xl font-bold border border-border">
          {user?.name?.charAt(0).toUpperCase() ?? "U"}
        </div>
        <div className="flex flex-col justify-center">
          <p className="text-text-primary text-[22px] font-bold">
            {user?.name ?? "User"}
          </p>
          <p className="text-text-secondary text-base">
            @{user?.name?.toLowerCase().replace(/\s+/g, "_") ?? "user"}
          </p>
        </div>
      </div>
    </div>
  );
}

interface PointsCardProps {
  currentPoints: number;
}

export function PointsCard({ currentPoints }: PointsCardProps) {
  return (
    <div className="p-4">
      <div className="rounded-xl bg-primary p-6">
        <p className="text-white/80 text-sm font-normal">CURRENT EXP</p>
        <p className="text-white text-4xl font-bold mt-1">{currentPoints} exp</p>
        <p className="text-white/80 text-base mt-1">
          Well done! Keep up the great work.
        </p>
      </div>
    </div>
  );
}

interface QuickActionsProps {
  actions: Array<{
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    path: string;
  }>;
  onActionClick: (path: string) => void;
}

export function QuickActions({ actions, onActionClick }: QuickActionsProps) {
  return (
    <div className="grid grid-cols-3 gap-3 px-4 py-2">
      {actions.map((action) => (
        <button
          key={action.label}
          onClick={() => onActionClick(action.path)}
          className="flex flex-col items-center gap-3 rounded-xl bg-surface p-4 text-center border border-border hover:bg-surface-light transition-colors"
        >
          <action.icon className="w-6 h-6 text-primary" />
          <h2 className="text-text-primary text-sm font-bold">{action.label}</h2>
        </button>
      ))}
    </div>
  );
}
