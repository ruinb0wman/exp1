import { useEffect } from "react";
import { useUserStore, useTaskStore } from "@/store";
import { useExpiredTaskChecker } from "@/hooks/useExpiredTaskChecker";
import { useGlobalPomoTimer } from "@/hooks/useGlobalPomoTimer";

export function useAppBootstrap() {
  const { user, initUser } = useUserStore();

  const { checkExpiredTasks } = useExpiredTaskChecker({
    userId: user?.id,
  });

  useGlobalPomoTimer();

  useEffect(() => {
    if (!user) {
      initUser();
    }
  }, [user, initUser]);

  useEffect(() => {
    if (user?.id) {
      checkExpiredTasks();
    }
  }, [user?.id, checkExpiredTasks]);

  useEffect(() => {
    if (user?.id) {
      const { subscribeToTodayTasks, subscribeToNoDateTasks } = useTaskStore.getState();
      subscribeToTodayTasks(user.id);
      subscribeToNoDateTasks(user.id);
    }
  }, [user?.id]);
}
