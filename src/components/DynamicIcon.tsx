import type { LucideProps } from 'lucide-react';
import {
  Gift,
  Coffee,
  Beer,
  Cigarette,
  Gamepad2,
  ShoppingBag,
  BookOpen,
  Dumbbell,
  Pizza,
  IceCream,
  Cookie,
  CakeSlice,
  Film,
  Music,
  Ticket,
  Tv,
  ShoppingCart,
  Package,
  Bike,
  Plane,
  Mountain,
  GraduationCap,
  Lightbulb,
  Heart,
  Star,
  Zap,
  Trophy,
  Crown,
} from 'lucide-react';
import type { RewardIconName, RewardIconColor } from '@/db/types';

const iconMap: Record<RewardIconName, React.ComponentType<LucideProps>> = {
  Gift,
  Coffee,
  Beer,
  Cigarette,
  Gamepad2,
  ShoppingBag,
  BookOpen,
  Dumbbell,
  Pizza,
  IceCream,
  Cookie,
  CakeSlice,
  Film,
  Music,
  Ticket,
  Tv,
  ShoppingCart,
  Package,
  Bike,
  Plane,
  Mountain,
  GraduationCap,
  Lightbulb,
  Heart,
  Star,
  Zap,
  Trophy,
  Crown,
};

interface DynamicIconProps extends Omit<LucideProps, 'color'> {
  name: RewardIconName;
  color?: RewardIconColor | string;
}

export function DynamicIcon({ name, color, ...props }: DynamicIconProps) {
  const IconComponent = iconMap[name];
  
  if (!IconComponent) {
    // 如果找不到图标，返回默认的 Gift 图标
    return <Gift color={color} {...props} />;
  }
  
  return <IconComponent color={color} {...props} />;
}
