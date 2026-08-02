// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

import Root from "./avatar.svelte";
import Image from "./avatar-image.svelte";
import Fallback from "./avatar-fallback.svelte";
import Badge from "./avatar-badge.svelte";
import Group from "./avatar-group.svelte";
import GroupCount from "./avatar-group-count.svelte";

export {
  Root,
  Image,
  Fallback,
  Badge,
  Group,
  GroupCount,
  //
  Root as Avatar,
  Image as AvatarImage,
  Fallback as AvatarFallback,
  Badge as AvatarBadge,
  Group as AvatarGroup,
  GroupCount as AvatarGroupCount,
};
