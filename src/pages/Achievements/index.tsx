import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { liveQuery } from 'dexie';
import { Loader2, Sparkles, Trophy } from 'lucide-react';
import { getDB } from '@/db';
import {
  abandonAchievement,
  acceptAchievement,
  deleteAchievement,
  deleteProposals,
  evaluateAll,
  type AcceptAchievementOverrides,
} from '@/db/services';
import type { Achievement } from '@/db/types';
import { useConfirm } from '@/hooks/useConfirm';
import { useUserStore } from '@/store';
import { useAchievementStore } from '@/store/achievementStore';
import { Header } from '@/components/Header';
import { FilterTabs } from '@/components/FilterTabs';
import { EmptyState } from '@/components/EmptyState';
import { Popup } from '@/components/Popup';
import { generateAchievements, generatePresetAchievements } from '@/services/achievementGenerator';
import { isLlmConfigured } from '@/services/llmService';
import { AchievementCard } from './components/AchievementCard';
import { AchievementProposalCard } from './components/AchievementProposalCard';
import { AchievementAcceptDialog } from './components/AchievementAcceptDialog';
import {
  ACHIEVEMENT_EMPTY_TEXT,
  ACHIEVEMENT_TABS,
  ACHIEVEMENT_TAB_LABEL,
  resolveTemplateTitle,
  type AchievementTab,
} from './lib';

export function Achievements() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { user } = useUserStore();
  const userId = user?.id ?? null;

  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [templateTitles, setTemplateTitles] = useState<Map<string, string>>(new Map());
  const [tab, setTab] = useState<AchievementTab>('proposed');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastModel, setLastModel] = useState<string | undefined>();
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const [showFallback, setShowFallback] = useState(false);
  const [acceptTarget, setAcceptTarget] = useState<Achievement | null>(null);

  // 订阅成就与模板列表
  useEffect(() => {
    if (!userId) return;
    const observable = liveQuery(async () => {
      const db = getDB();
      const [list, templates] = await Promise.all([
        db.achievements.where('userId').equals(userId).toArray(),
        db.taskTemplates.where('userId').equals(userId).toArray(),
      ]);
      return { list, templates };
    });

    const subscription = observable.subscribe({
      next: ({ list, templates }) => {
        setAchievements(list);
        setTemplateTitles(new Map(templates.map((item) => [item.id, item.title])));
      },
      error: (subscriptionError) => {
        console.error('[Achievements] liveQuery error:', subscriptionError);
      },
    });

    return () => subscription.unsubscribe();
  }, [userId]);

  // 检查 LLM 配置
  useEffect(() => {
    let mounted = true;
    isLlmConfigured()
      .then((value) => {
        if (mounted) setIsConfigured(value);
      })
      .catch(() => {
        if (mounted) setIsConfigured(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // 进入页面立即判定一次
  useEffect(() => {
    if (!userId) return;
    evaluateAll(userId)
      .then((unlocked) => {
        if (unlocked.length > 0) {
          useAchievementStore.getState().pushUnlocks(unlocked);
        }
      })
      .catch((evaluateError) => {
        console.error('[Achievements] evaluate failed:', evaluateError);
      });
  }, [userId]);

  const counts: Record<AchievementTab, number> = {
    proposed: achievements.filter((item) => item.status === 'proposed').length,
    active: achievements.filter((item) => item.status === 'active').length,
    unlocked: achievements.filter((item) => item.status === 'unlocked').length,
  };

  const visible = achievements
    .filter((item) => item.status === tab)
    .sort((a, b) => {
      if (tab === 'unlocked') {
        return (b.unlockedAt ?? '').localeCompare(a.unlockedAt ?? '');
      }
      if (tab === 'active') {
        return (b.acceptedAt ?? '').localeCompare(a.acceptedAt ?? '');
      }
      return b.createdAt.localeCompare(a.createdAt);
    });

  const handleGenerateLlm = useCallback(async () => {
    if (!userId) return;
    setIsGenerating(true);
    setError(null);
    try {
      const result = await generateAchievements(userId);
      setLastModel(result.model);
      setTab('proposed');
    } catch (generateError) {
      const message =
        generateError instanceof Error ? generateError.message : "Error";
      setError(message);
      setShowFallback(true);
    } finally {
      setIsGenerating(false);
    }
  }, [userId]);

  const handleGenerate = useCallback(() => {
    if (isConfigured === false) {
      setShowFallback(true);
      return;
    }
    void handleGenerateLlm();
  }, [isConfigured, handleGenerateLlm]);

  const handleUsePresets = useCallback(async () => {
    if (!userId) return;
    setIsGenerating(true);
    setError(null);
    try {
      await generatePresetAchievements(userId);
      setLastModel(undefined);
      setShowFallback(false);
      setTab('proposed');
    } catch (presetError) {
      setError(presetError instanceof Error ? presetError.message : "Error");
    } finally {
      setIsGenerating(false);
    }
  }, [userId]);

  const handleAccept = useCallback(
    async (overrides: AcceptAchievementOverrides) => {
      if (!acceptTarget || !userId) return;
      await acceptAchievement(acceptTarget.id, overrides);
      setTab('active');
      const unlocked = await evaluateAll(userId);
      if (unlocked.length > 0) {
        useAchievementStore.getState().pushUnlocks(unlocked);
      }
    },
    [acceptTarget, userId]
  );

  const handleDismiss = useCallback(async (id: string) => {
    await deleteAchievement(id);
  }, []);

  const handleDismissAll = useCallback(async () => {
    if (!userId) return;
    const ok = await confirm({
      title: "Dismiss All",
      message: "Dismiss all pending achievement proposals?",
      variant: 'warning',
    });
    if (!ok) return;
    await deleteProposals(userId);
  }, [userId, confirm]);

  const handleAbandon = useCallback(
    async (achievement: Achievement) => {
      const ok = await confirm({
        title: "Abandon",
        message: `Abandon “${achievement.title}”? Progress will not be kept.`,
        variant: 'danger',
      });
      if (!ok) return;
      await abandonAchievement(achievement.id);
    },
    [confirm]
  );

  const titleOf = useCallback(
    (item: Achievement) => resolveTemplateTitle(item, templateTitles),
    [templateTitles]
  );

  const renderList = () => {
    if (visible.length === 0) {
      return (
        <EmptyState
          icon={<Trophy className="w-8 h-8" />}
          title={ACHIEVEMENT_EMPTY_TEXT[tab]}
          description={tab === 'proposed' ? "Tap the button above to let AI craft challenges from your tasks" : undefined}
        />
      );
    }

    if (tab === 'proposed') {
      return visible.map((item) => (
        <AchievementProposalCard
          key={item.id}
          achievement={item}
          templateTitle={titleOf(item)}
          onAccept={() => setAcceptTarget(item)}
          onDismiss={() => handleDismiss(item.id)}
        />
      ));
    }

    return visible.map((item) => (
      <AchievementCard
        key={item.id}
        achievement={item}
        templateTitle={titleOf(item)}
        onAbandon={tab === 'active' ? () => handleAbandon(item) : undefined}
      />
    ));
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header
        title="Achievements"
        back
        rightSlot={
          counts.unlocked > 0 ? (
            <span className="flex items-center gap-1 text-primary text-sm font-medium">
              <Trophy className="w-4 h-4" />
              {counts.unlocked}
            </span>
          ) : undefined
        }
      />

      <div className="px-4 py-3">
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-white font-medium hover:bg-primary-dark transition-colors disabled:opacity-50"
        >
          {isGenerating ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Sparkles className="w-5 h-5" />
          )}
          {isGenerating ? "Generating…" : "Generate Achievements"}
        </button>

        {lastModel && !isGenerating && (
          <p className="text-text-muted text-xs text-center mt-2">
            {`Generated by ${lastModel} — progress starts from zero once accepted`}
          </p>
        )}

        {error && (
          <p className="text-primary text-xs text-center mt-2">{error}</p>
        )}
      </div>

      <div className="px-4">
        <FilterTabs
          options={ACHIEVEMENT_TABS}
          activeFilter={tab}
          onFilterChange={setTab}
          renderLabel={(option) => `${ACHIEVEMENT_TAB_LABEL[option]} (${counts[option]})`}
        />

        {tab === 'proposed' && counts.proposed > 1 && (
          <div className="flex justify-end mb-2">
            <button
              onClick={handleDismissAll}
              className="text-text-muted text-xs hover:text-primary transition-colors"
            >
              Dismiss All
            </button>
          </div>
        )}
      </div>

      <div className="px-4">{renderList()}</div>

      <AchievementAcceptDialog
        isOpen={acceptTarget !== null}
        achievement={acceptTarget}
        templateTitle={acceptTarget ? titleOf(acceptTarget) : undefined}
        onClose={() => setAcceptTarget(null)}
        onConfirm={handleAccept}
      />

      <Popup
        isOpen={showFallback}
        onClose={() => setShowFallback(false)}
        position="center"
        title="Generate Achievements"
      >
        <div className="p-4">
          <p className="text-text-secondary text-sm mb-4">
            {isConfigured === false
              ? "No AI service configured yet. Fill in Base URL, model and API Key in Settings, or use the built-in suggestions."
              : "Generation failed. Check your AI settings, or use the built-in suggestions."}
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => {
                setShowFallback(false);
                navigate('/settings');
              }}
              className="w-full py-3 rounded-xl bg-primary text-white font-medium hover:bg-primary-dark transition-colors"
            >
              Open Settings
            </button>
            <button
              onClick={() => void handleUsePresets()}
              className="w-full py-3 rounded-xl bg-surface border border-border text-text-primary font-medium hover:bg-surface-light transition-colors"
            >
              Use Suggestions
            </button>
          </div>
        </div>
      </Popup>
    </div>
  );
}
