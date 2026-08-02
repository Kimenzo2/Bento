**⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.**

# Genesis Desktop Auth Flow

```mermaid
flowchart TD
  A[App starts] --> B[Rust checks OS keychain for stored tokens]
  B --> C{Tokens found and valid?}
  C -->|Yes| D[Full shell, skip login]
  C -->|Expired| E[Rust silently refreshes via Supabase refresh endpoint]
  E --> D
  C -->|No| F[Login window]

  F --> G[User clicks Sign in with Google]
  G --> H[Rust spawns temporary localhost HTTP server on random port]
  H --> I[Rust builds Google OAuth URL with PKCE challenge and localhost redirect]
  I --> J[Rust opens system browser to Google OAuth URL]

  J --> K[Browser shows Google sign-in page]
  K --> L[User authenticates with Google account]
  L --> M[Google redirects to localhost callback]

  M --> N[Rust localhost server catches callback]
  N --> O[Rust verifies CSRF state token]
  O --> P[Rust exchanges authorization code for tokens via Supabase]
  P --> Q[Rust stores access token and refresh token in OS keychain]
  Q --> R[Rust closes localhost server]
  R --> S[Rust emits auth:success event to Svelte frontend]
  S --> T[Login window transitions to full shell]
```

## Notes

- Full shell is the default post-auth state.
- The login window is minimal and only exists until auth succeeds.
- The browser used for Google auth is the system default browser.
- Rust owns token storage, callback capture, and the security checks.
