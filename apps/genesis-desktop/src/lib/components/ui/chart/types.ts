// Chart system types — shared across all chart variants

export type ChartConfigItem = {
  label?: string;
  color?: string;
  icon?: unknown;
};

export type ChartConfig = Record<string, ChartConfigItem>;
