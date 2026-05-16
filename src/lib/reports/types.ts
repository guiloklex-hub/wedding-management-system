export type Severity = "red" | "amber" | "green";

export type RiskAlert = {
  id: string;
  severity: Severity;
  title: string;
  body: string;
  href: string;
  value?: number;
  finance?: boolean;
};

export type ChartPoint = {
  x: string;
  y: number;
};

export type ChartSeries = {
  name: string;
  color: string;
  points: ChartPoint[];
};

export type KPIFormat = "currency" | "count" | "percent" | "days";

export type KPICard = {
  id: string;
  label: string;
  value: number;
  format: KPIFormat;
  trend?: ChartPoint[];
  finance: boolean;
  accent?: "default" | "rose" | "emerald" | "amber" | "violet";
  hint?: string;
};
