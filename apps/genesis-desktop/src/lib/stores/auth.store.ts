import { writable } from "svelte/store";

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
};

export const authStore = writable<AuthUiState>({
  status: "booting",
  user: null,
  message: null,
  loginLoading: false,
});

export function setAuthBootstrap(state: AuthBootstrapState) {
  authStore.set(
    state.status === "restored"
      ? {
          status: "restored",
          user: state.user,
          message: null,
          loginLoading: false,
        }
      : {
          status: "loginRequired",
          user: null,
          message: null,
          loginLoading: false,
        }
  );
}

export function setAuthRestored(user: AuthUser) {
  authStore.set({
    status: "restored",
    user,
    message: null,
    loginLoading: false,
  });
}

export function setAuthLoginRequired() {
  authStore.set({
    status: "loginRequired",
    user: null,
    message: null,
    loginLoading: false,
  });
}

export function setAuthSessionExpired(message: string) {
  authStore.update((state) => ({
    ...state,
    status: "sessionExpired",
    message,
    loginLoading: false,
  }));
}

export function setAuthError(message: string | null) {
  authStore.update((state) => ({
    ...state,
    status: message ? "error" : state.status === "booting" ? "booting" : state.status,
    message,
    loginLoading: false,
  }));
}

export function setAuthLoginLoading(loginLoading: boolean) {
  authStore.update((state) => ({
    ...state,
    loginLoading,
    message: loginLoading ? null : state.message,
  }));
}
