import { toast } from "sonner";

import { getClientErrorMessage } from "@/lib/api";

export function showSuccess(message: string) {
  toast.success(message);
}

export function showError(error: unknown, fallback = "Something went wrong. Please try again.") {
  toast.error(getClientErrorMessage(error, fallback));
}

export function showInfo(message: string) {
  toast.info(message);
}

export function showWarning(message: string) {
  toast.warning(message);
}

export function showPromise<T>(
  promise: Promise<T>,
  messages: {
    loading: string;
    success: string | ((data: T) => string);
    error?: string | ((error: unknown) => string);
  }
): Promise<T> {
  void toast.promise(promise, {
    loading: messages.loading,
    success: messages.success,
    error: (error) =>
      typeof messages.error === "function"
        ? messages.error(error)
        : messages.error ?? getClientErrorMessage(error)
  });
  return promise;
}
