import { Star } from "lucide-react";

interface PointsCardProps {
  currentPoints: number;
}

export function PointsCard({ currentPoints }: PointsCardProps) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-surface p-4 border border-border">
      <div className="flex flex-col gap-1">
        <p className="text-text-secondary text-sm font-bold">
          Your Points
        </p>
        <p className="text-text-primary text-2xl font-bold">
          {currentPoints.toLocaleString()} PTS
        </p>
      </div>
      <div className="w-16 h-16 rounded-full bg-primary text-white flex items-center justify-center">
        <Star className="w-8 h-8 fill-current" />
      </div>
    </div>
  );
}
