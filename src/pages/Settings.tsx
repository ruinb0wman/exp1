import { useNavigate } from "react-router";
import { ChevronLeft, Download, Info } from "lucide-react";

const settingsMenu = [
  {
    icon: Download,
    label: "数据导入导出",
    description: "备份或恢复您的任务和奖励数据",
    path: "/data-import-export",
  },
];

export function Settings() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="flex items-center p-4 pb-2 sticky top-0 bg-background z-10">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 flex items-center justify-center -ml-2 text-text-primary hover:text-primary transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-bold text-text-primary flex-1 text-center mr-8">
          设置
        </h1>
      </header>

      {/* Settings Menu */}
      <div className="p-4 pt-6">
        <div className="flex flex-col gap-3">
          {settingsMenu.map((item) => (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className="flex items-center gap-4 rounded-xl bg-surface p-4 border border-border hover:bg-surface-light transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <item.icon className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-text-primary font-medium">{item.label}</p>
                <p className="text-text-secondary text-sm truncate">
                  {item.description}
                </p>
              </div>
              <ChevronLeft className="w-5 h-5 text-text-secondary rotate-180 shrink-0" />
            </button>
          ))}
        </div>

        {/* About Section */}
        <div className="mt-8">
          <h2 className="text-text-secondary text-sm font-medium px-2 mb-3">
            关于
          </h2>
          <div className="flex items-center gap-4 rounded-xl bg-surface p-4 border border-border">
            <div className="w-10 h-10 rounded-lg bg-surface-light flex items-center justify-center shrink-0">
              <Info className="w-5 h-5 text-text-secondary" />
            </div>
            <div className="flex-1">
              <p className="text-text-primary font-medium">版本信息</p>
              <p className="text-text-secondary text-sm">v0.1.0</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
