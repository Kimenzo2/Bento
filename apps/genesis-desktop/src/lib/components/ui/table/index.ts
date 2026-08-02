// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

import Table from "./table.svelte";
import TableHeader from "./table-header.svelte";
import TableBody from "./table-body.svelte";
import TableFooter from "./table-footer.svelte";
import TableRow from "./table-row.svelte";
import TableHead from "./table-head.svelte";
import TableCell from "./table-cell.svelte";
import TableCaption from "./table-caption.svelte";

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
  //
  Table as Root,
  TableHeader as Header,
  TableBody as Body,
  TableFooter as Footer,
  TableRow as Row,
  TableHead as Head,
  TableCell as Cell,
  TableCaption as Caption,
};
