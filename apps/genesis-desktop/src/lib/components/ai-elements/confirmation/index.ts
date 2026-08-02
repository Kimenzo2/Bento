// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

export {
  Confirmation,
  ConfirmationTitle,
  ConfirmationRequest,
  ConfirmationAccepted,
  ConfirmationRejected,
  ConfirmationActions,
  ConfirmationAction,
  Root,
  Title,
  Request,
  Accepted,
  Rejected,
  Actions,
  Action,
} from "$lib/components/agent/confirmation/index.js";

export type {
  ConfirmationProps,
  ConfirmationTitleProps,
  ConfirmationRequestProps,
  ConfirmationAcceptedProps,
  ConfirmationRejectedProps,
  ConfirmationActionsProps,
  ConfirmationActionProps,
  ToolUIPartApproval,
  ToolUIPartState,
  ConfirmationContextValue,
} from "$lib/components/agent/confirmation/index.js";
