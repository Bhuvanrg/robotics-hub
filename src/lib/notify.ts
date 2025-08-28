import { toast } from 'sonner';

export interface NotifyOptions {
  success?: string;
  error?: string;
  loading?: string;
  finally?: () => void;
  silent?: boolean;
}

export async function withToast<T>(promise: Promise<T>, opts: NotifyOptions = {}): Promise<T> {
  const { loading, success, error, finally: fin, silent } = opts;
  let id: string | number | undefined;
  if (loading && !silent) {
    id = toast.loading(loading);
  }
  try {
    const result = await promise;
    if (success && !silent) {
      if (id) toast.success(success, { id });
      else toast.success(success);
    } else if (id) {
      toast.dismiss(id);
    }
    return result;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!silent) {
      if (id) toast.error(error || msg, { id });
      else toast.error(error || msg);
    }
    throw e;
  } finally {
    fin?.();
  }
}

export function notifyError(e: unknown, fallback = 'Something went wrong') {
  const msg = e instanceof Error ? e.message : String(e);
  toast.error(fallback + (msg ? `: ${msg}` : ''));
}

export function notifySuccess(message: string) {
  toast.success(message);
}
