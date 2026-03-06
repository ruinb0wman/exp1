import { Star } from "lucide-react";
import type { User } from "@/db/types";

interface UserHeaderProps {
  user: User | null;
}

export function HomeHeader({ user }: UserHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-surface flex items-center justify-center text-text-primary font-bold border border-border">
          {user?.name?.[0]?.toUpperCase() ?? "U"}
        </div>
        <div className="flex flex-col">
          <p className="text-text-secondary text-sm font-normal">
            Good Morning!
          </p>
          <h1 className="text-text-primary text-xl font-bold tracking-tight">
            {user?.name ?? "User"}
          </h1>
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 border border-border">
        <Star className="w-4 h-4 text-primary fill-primary" />
        <p className="text-text-primary text-sm font-bold">
          {user?.currentPoints ?? 0} exp
        </p>
      </div>
    </div>
  );
}
