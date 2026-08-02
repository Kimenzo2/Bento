// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

import Root from "./select.svelte";
import Group from "./select-group.svelte";
import Label from "./select-label.svelte";
import Item from "./select-item.svelte";
import Content from "./select-content.svelte";
import Trigger from "./select-trigger.svelte";
import Separator from "./select-separator.svelte";
import ScrollDownButton from "./select-scroll-down-button.svelte";
import ScrollUpButton from "./select-scroll-up-button.svelte";
import GroupHeading from "./select-group-heading.svelte";
import Portal from "./select-portal.svelte";

export {
  Root,
  Group,
  Label,
  Item,
  Content,
  Trigger,
  Separator,
  ScrollDownButton,
  ScrollUpButton,
  GroupHeading,
  Portal,
  //
  Root as Select,
  Group as SelectGroup,
  Label as SelectLabel,
  Item as SelectItem,
  Content as SelectContent,
  Trigger as SelectTrigger,
  Separator as SelectSeparator,
  ScrollDownButton as SelectScrollDownButton,
  ScrollUpButton as SelectScrollUpButton,
  GroupHeading as SelectGroupHeading,
  Portal as SelectPortal,
};
