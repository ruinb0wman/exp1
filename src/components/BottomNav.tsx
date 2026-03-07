import { Home, Store, BarChart3, User, Timer } from "lucide-react";
import { NavLink } from "react-router";

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  activeIcon: React.ReactNode;
  label: string;
}

function NavItem({ to, icon, activeIcon, label }: NavItemProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex flex-col items-center gap-1 w-16 transition-colors ${
          isActive
            ? "text-primary"
            : "text-text-secondary hover:text-text-primary"
        }`
      }
    >
      {({ isActive }) => (
        <>
          <div className="w-6 h-6">
            {isActive ? activeIcon : icon}
          </div>
          <span className="text-xs font-medium font-display">{label}</span>
        </>
      )}
    </NavLink>
  );
}

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 h-20 pb-safe bg-background/80 backdrop-blur-lg border-t border-border flex items-start justify-around px-4 pt-2 z-50">
      <NavItem
        to="/"
        icon={<Home strokeWidth={1.5} />}
        activeIcon={<Home strokeWidth={1.5} fill="currentColor" />}
        label="Home"
      />
      <NavItem
        to="/pomo"
        icon={<Timer strokeWidth={1.5} />}
        activeIcon={<Timer strokeWidth={1.5} fill="currentColor" />}
        label="Pomo"
      />
      <NavItem
        to="/store"
        icon={<Store strokeWidth={1.5} />}
        activeIcon={<Store strokeWidth={1.5} fill="currentColor" />}
        label="Store"
      />
      <NavItem
        to="/stats"
        icon={<BarChart3 strokeWidth={1.5} />}
        activeIcon={<BarChart3 strokeWidth={1.5} fill="currentColor" />}
        label="Stats"
      />
      <NavItem
        to="/profile"
        icon={<User strokeWidth={1.5} />}
        activeIcon={<User strokeWidth={1.5} fill="currentColor" />}
        label="Profile"
      />
    </nav>
  );
}
