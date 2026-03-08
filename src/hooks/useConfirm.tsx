import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type ConfirmVariant = "danger" | "warning" | "info";

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | null>(null);

interface ConfirmProviderProps {
  children: ReactNode;
}

interface ConfirmState {
  isOpen: boolean;
  options: ConfirmOptions | null;
  resolve: ((value: boolean) => void) | null;
}

export function ConfirmProvider({ children }: ConfirmProviderProps) {
  const [state, setState] = useState<ConfirmState>({
    isOpen: false,
    options: null,
    resolve: null,
  });

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({
        isOpen: true,
        options,
        resolve,
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (state.resolve) {
      state.resolve(true);
    }
    setState({ isOpen: false, options: null, resolve: null });
  }, [state.resolve]);

  const handleCancel = useCallback(() => {
    if (state.resolve) {
      state.resolve(false);
    }
    setState({ isOpen: false, options: null, resolve: null });
  }, [state.resolve]);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state.options && (
        <ConfirmDialog
          isOpen={state.isOpen}
          title={state.options.title}
          message={state.options.message}
          confirmLabel={state.options.confirmLabel}
          cancelLabel={state.options.cancelLabel}
          variant={state.options.variant}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): (options: ConfirmOptions) => Promise<boolean> {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error("useConfirm must be used within a ConfirmProvider");
  }
  return context.confirm;
}
