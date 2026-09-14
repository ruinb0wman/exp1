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
  Medal,
  Flame,
  Target,
  Rocket,
  Award,
  Shield,
  Swords,
  Gem,
  Compass,
  Timer,
  CalendarCheck,
  TrendingUp,
  Sparkles,
} from 'lucide-react';
import type { RewardIconName, RewardIconColor, AchievementIconName } from '@/db/types';

/** 奖励图标 ∪ 成就图标的合并注册表 */
const iconMap: Record<string, React.ComponentType<LucideProps>> = {
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
  Medal,
  Flame,
  Target,
  Rocket,
  Award,
  Shield,
  Swords,
  Gem,
  Compass,
  Timer,
  CalendarCheck,
  TrendingUp,
  Sparkles,
};

export type DynamicIconName = RewardIconName | AchievementIconName | (string & {});

interface DynamicIconProps extends Omit<LucideProps, 'color'> {
  name: DynamicIconName;
  color?: RewardIconColor | string;
}

export function DynamicIcon({ name, color, ...props }: DynamicIconProps) {
  const IconComponent = iconMap[name];

  if (!IconComponent) {
    // 如果找不到图标，返回默认的 Trophy 图标
    return <Trophy color={color} {...props} />;
  }

  return <IconComponent color={color} {...props} />;
}
