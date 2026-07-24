<script lang="ts">
  import CalendarArrowUpIcon from "@lucide/svelte/icons/calendar-arrow-up";
  import { cn } from "$lib/utils.js";
  import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card/index.js";
  import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
  } from "$lib/components/ui/tooltip/index.js";

  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const timeSlots = [
    { label: "00-03", name: "Night" },
    { label: "03-06", name: "Early" },
    { label: "06-09", name: "Morning" },
    { label: "09-12", name: "Late Morn" },
    { label: "12-15", name: "Afternoon" },
    { label: "15-18", name: "Late Aft" },
    { label: "18-21", name: "Evening" },
    { label: "21-24", name: "Late Night" },
  ];

  interface TrafficRow {
    day: string;
    slots: number[];
  }

  // All zero until real backend data is wired
  const data: TrafficRow[] = days.map((day) => ({
    day,
    slots: timeSlots.map(() => 0),
  }));

  function getColorClass(value: number) {
    if (value === 0) return "bg-primary/10 hover:bg-primary/30";
    if (value < 30) return "bg-primary/30 hover:bg-primary/50";
    if (value < 50) return "bg-primary/50 hover:bg-primary/70";
    if (value < 70) return "bg-primary/70 hover:bg-primary/90";
    return "bg-primary";
  }
</script>

<TooltipProvider delayDuration={0}>
  <Card class="flex size-full flex-col gap-5 py-4 border-[var(--focus-border)]" data-slot="traffic-logs">
    <CardHeader class="flex flex-row items-center justify-between gap-2 px-4">
      <div class="flex items-center gap-2">
        <CalendarArrowUpIcon class="size-[18px]" />
        <CardTitle>Weekly Traffic</CardTitle>
      </div>
      <div class="flex items-center justify-end gap-2">
        <span class="text-muted-foreground text-sm">
          L<span class="max-sm:hidden">ow</span>
        </span>
        <div class="flex gap-1">
          <div class="size-[10px] rounded-sm bg-primary/20"></div>
          <div class="size-[10px] rounded-sm bg-primary/40"></div>
          <div class="size-[10px] rounded-sm bg-primary/60"></div>
          <div class="size-[10px] rounded-sm bg-primary/80"></div>
          <div class="size-[10px] rounded-sm bg-primary"></div>
        </div>
        <span class="text-muted-foreground text-sm">
          H<span class="max-sm:hidden">igh</span>
        </span>
      </div>
    </CardHeader>

    <CardContent class="flex min-h-0 w-full grow flex-col gap-2 px-4">
      <!-- Time slot header row -->
      <div class="flex gap-2">
        <div class="w-8 shrink-0"></div>
        <div class="grid grow grid-cols-8 gap-1 text-center">
          {#each timeSlots as slot}
            <span class="text-muted-foreground truncate px-0.5 text-[9px] leading-none">
              {slot.label}
            </span>
          {/each}
        </div>
      </div>

      <!-- Chart grid -->
      <div class="flex min-h-0 grow gap-2">
        <!-- Day labels -->
        <div class="flex w-8 shrink-0 flex-col justify-between gap-1">
          {#each days as day}
            <span class="text-muted-foreground flex h-full items-center text-xs/none">
              {day}
            </span>
          {/each}
        </div>

        <!-- Data cells -->
        <div class="flex h-full w-full grow flex-col gap-1" role="img" aria-label="Weekly traffic heatmap: {data.map(r => `${r.day} ${r.slots.join(',')}`).join('; ')}">
          {#each data as row}
            <div class="grid grow grid-cols-8 gap-1">
              {#each row.slots as val, i}
                <Tooltip>
                  <TooltipTrigger>
                    <div
                      class={cn(
                        "h-full min-h-6 w-full cursor-pointer rounded-sm transition-colors",
                        getColorClass(val),
                      )}
                      role="meter"
                      aria-label="{row.day} {timeSlots[i].name}: {val} requests"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={val}
                    ></div>
                  </TooltipTrigger>
                  <TooltipContent class="text-xs" side="top">
                    <div class="font-semibold">{row.day} • {timeSlots[i].name}</div>
                    <div>{val} requests</div>
                  </TooltipContent>
                </Tooltip>
              {/each}
            </div>
          {/each}
        </div>
      </div>

      <!-- Screen reader table -->
      <table class="sr-only">
        <caption>Weekly traffic by day and time slot</caption>
        <thead>
          <tr><th>Day</th>{#each timeSlots as slot}<th>{slot.name}</th>{/each}</tr>
        </thead>
        <tbody>
          {#each data as row}
            <tr><td>{row.day}</td>{#each row.slots as val}<td>{val}</td>{/each}</tr>
          {/each}
        </tbody>
      </table>
    </CardContent>
  </Card>
</TooltipProvider>
