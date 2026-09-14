import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, CheckCircle2, KeyRound, Loader2, Plug } from 'lucide-react';
import { getLlmSettings, setLlmSettings, testLlmConnection } from '@/services/llmService';

type TestState = { status: 'idle' } | { status: 'loading' } | { status: 'ok'; message: string } | { status: 'error'; message: string };

/**
 * 设置页「AI 成就」分组
 * API Key 由 Rust 侧持久化，前端不保存、不导出
 */
export function AiSettingsSection() {
  const { t } = useTranslation();

  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [testState, setTestState] = useState<TestState>({ status: 'idle' });

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const settings = await getLlmSettings();
      setBaseUrl(settings.baseUrl);
      setModel(settings.model);
      setHasApiKey(settings.hasApiKey);
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : t('common.error'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = useCallback(
    async (clearApiKey = false) => {
      setIsSaving(true);
      setSaveMessage(null);
      setTestState({ status: 'idle' });
      try {
        await setLlmSettings({
          baseUrl,
          model,
          apiKey: clearApiKey ? undefined : apiKey,
          clearApiKey,
        });
        setApiKey('');
        await load();
        setSaveMessage(t('settings.ai.saved'));
      } catch (error) {
        setSaveMessage(error instanceof Error ? error.message : t('common.error'));
      } finally {
        setIsSaving(false);
      }
    },
    [baseUrl, model, apiKey, load, t]
  );

  const handleTest = useCallback(async () => {
    setTestState({ status: 'loading' });
    try {
      const result = await testLlmConnection();
      setTestState({
        status: 'ok',
        message: result.model ? `${t('settings.ai.testOk')} · ${result.model}` : t('settings.ai.testOk'),
      });
    } catch (error) {
      setTestState({
        status: 'error',
        message: error instanceof Error ? error.message : t('common.error'),
      });
    }
  }, [t]);

  return (
    <div className="mb-6">
      <h2 className="text-text-secondary text-sm font-medium px-2 mb-3">
        {t('settings.ai.title')}
      </h2>

      <div className="rounded-xl bg-surface border border-border p-4">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Bot className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-text-primary font-medium">{t('settings.ai.title')}</p>
            <p className="text-text-secondary text-sm">{t('settings.ai.description')}</p>
          </div>
        </div>

        <label className="block text-text-secondary text-xs mb-1.5">
          {t('settings.ai.baseUrl')}
        </label>
        <input
          value={baseUrl}
          onChange={(event) => setBaseUrl(event.target.value)}
          placeholder="https://api.openai.com/v1"
          disabled={isLoading || isSaving}
          className="w-full rounded-lg bg-surface-light border border-border px-3 py-2.5 text-text-primary text-sm focus:outline-none focus:border-primary mb-3 disabled:opacity-50"
        />

        <label className="block text-text-secondary text-xs mb-1.5">
          {t('settings.ai.model')}
        </label>
        <input
          value={model}
          onChange={(event) => setModel(event.target.value)}
          placeholder="gpt-4o-mini"
          disabled={isLoading || isSaving}
          className="w-full rounded-lg bg-surface-light border border-border px-3 py-2.5 text-text-primary text-sm focus:outline-none focus:border-primary mb-3 disabled:opacity-50"
        />

        <label className="block text-text-secondary text-xs mb-1.5">
          {t('settings.ai.apiKey')}
        </label>
        <div className="relative mb-3">
          <KeyRound className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder={hasApiKey ? t('settings.ai.apiKeySaved') : 'sk-...'}
            disabled={isLoading || isSaving}
            className="w-full rounded-lg bg-surface-light border border-border pl-9 pr-3 py-2.5 text-text-primary text-sm focus:outline-none focus:border-primary disabled:opacity-50"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => void handleSave(false)}
            disabled={isLoading || isSaving}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors disabled:opacity-50"
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            {t('common.save')}
          </button>
          <button
            onClick={() => void handleTest()}
            disabled={isLoading || isSaving || testState.status === 'loading'}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-surface-light border border-border text-text-primary text-sm font-medium hover:bg-border transition-colors disabled:opacity-50"
          >
            {testState.status === 'loading' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plug className="w-4 h-4" />
            )}
            {t('settings.ai.test')}
          </button>
        </div>

        {hasApiKey && (
          <button
            onClick={() => void handleSave(true)}
            disabled={isLoading || isSaving}
            className="w-full mt-2 py-2 rounded-lg text-text-secondary text-xs hover:text-primary transition-colors disabled:opacity-50"
          >
            {t('settings.ai.clearKey')}
          </button>
        )}

        {saveMessage && (
          <p className="text-text-secondary text-xs mt-3">{saveMessage}</p>
        )}

        {testState.status === 'ok' && (
          <p className="flex items-center gap-1.5 text-green-500 text-xs mt-3">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {testState.message}
          </p>
        )}
        {testState.status === 'error' && (
          <p className="text-primary text-xs mt-3">{testState.message}</p>
        )}
      </div>
    </div>
  );
}
