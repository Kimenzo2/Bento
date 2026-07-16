import { writable } from "svelte/store";
import { sanitizeError } from "$lib/utils/logger";

const AUTH_LOGIN_TIMEOUT_MS = 2 * 60 * 1000;
const AUTH_LOGIN_TIMEOUT_MESSAGE = "Sign-in timed out after 2 minutes. Please try again.";

let authLoginTimeout: ReturnType<typeof setTimeout> | null = null;

function clearAuthLoginTimeout() {
  if (authLoginTimeout) {
    clearTimeout(authLoginTimeout);
    authLoginTimeout = null;
  }
}

function armAuthLoginTimeout() {
  clearAuthLoginTimeout();
  authLoginTimeout = setTimeout(() => {
    authLoginTimeout = null;
    authStore.update((state) => ({
      ...state,
      status: state.status === "restored" ? "restored" : "error",
      message: AUTH_LOGIN_TIMEOUT_MESSAGE,
      loginLoading: false,
    }));
  }, AUTH_LOGIN_TIMEOUT_MS);
}

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
};

export type AuthBootstrapState =
  | {
      status: "loginRequired";
    }
  | {
      status: "restored";
      user: AuthUser;
    };

export type AuthSuccessPayload = {
  user: AuthUser;
};

export type AuthErrorPayload = {
  message: string;
};

export type AuthUiState = {
  status: "booting" | "loginRequired" | "restored" | "sessionExpired" | "error";
  user: AuthUser | null;
  message: string | null;
  loginLoading: boolean;
  loginUrl: string | null;
};

export const authStore = writable<AuthUiState>({
  status: "booting",
  user: null,
  message: null,
  loginLoading: false,
  loginUrl: null,
});

export function setAuthBootstrap(state: AuthBootstrapState) {
  clearAuthLoginTimeout();
  authStore.set(
    state.status === "restored"
      ? {
          status: "restored",
          user: state.user,
          message: null,
          loginLoading: false,
          loginUrl: null,
        }
      : {
          status: "loginRequired",
          user: null,
          message: null,
          loginLoading: false,
          loginUrl: null,
        },
  );
}

export function setAuthRestored(user: AuthUser) {
  clearAuthLoginTimeout();
  authStore.set({
    status: "restored",
    user,
    message: null,
    loginLoading: false,
    loginUrl: null,
  });
}

export function setAuthLoginRequired() {
  clearAuthLoginTimeout();
  authStore.set({
    status: "loginRequired",
    user: null,
    message: null,
    loginLoading: false,
    loginUrl: null,
  });
}

export function setAuthSessionExpired(message: string) {
  clearAuthLoginTimeout();
  authStore.update((state) => ({
    ...state,
    status: "sessionExpired",
    message,
    loginLoading: false,
  }));
}

export function setLoginUrl(url: string | null) {
  authStore.update((state) => ({
    ...state,
    loginUrl: url,
  }));
}

export function setAuthError(message: string | null) {
  clearAuthLoginTimeout();
  const sanitized = message ? sanitizeError(message) : null;
  authStore.update((state) => ({
    ...state,
    status: sanitized ? "error" : state.status === "booting" ? "booting" : state.status,
    message: sanitized,
    loginLoading: false,
  }));
}

export function setAuthLoginLoading(loginLoading: boolean) {
  if (loginLoading) {
    armAuthLoginTimeout();
  } else {
    clearAuthLoginTimeout();
  }
  authStore.update((state) => ({
    ...state,
    loginLoading,
    message: loginLoading ? null : state.message,
  }));
}
