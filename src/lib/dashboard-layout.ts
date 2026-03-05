export type WidgetSize = 'full' | 'half';

export interface WidgetDefinition {
  id: string;
  name: string;
  description: string;
  defaultEnabled: boolean;
  defaultOrder: number;
  defaultSize: WidgetSize;
}

export interface WidgetLayout {
  id: string;
  enabled: boolean;
  order: number;
  size: WidgetSize;
}

export const WIDGET_REGISTRY: WidgetDefinition[] = [
  { id: 'health',               name: 'Status Bar',           description: 'Gateway health and model info',           defaultEnabled: true,  defaultOrder: 0,  defaultSize: 'full' },
  { id: 'files',                name: 'File Shortcuts',       description: 'Quick links to key workspace files',      defaultEnabled: true,  defaultOrder: 1,  defaultSize: 'full' },
  { id: 'agent-command-center', name: 'Agent Command Center', description: 'Real-time agents + activity in one view (SSE-powered)', defaultEnabled: true, defaultOrder: 2,  defaultSize: 'full' },
  { id: 'proactivity',          name: 'Bridge',               description: 'Strategic intelligence hub',               defaultEnabled: true,  defaultOrder: 4,  defaultSize: 'half' },
  { id: 'token-usage',          name: 'Token Usage',          description: 'API usage and cost tracking',              defaultEnabled: true,  defaultOrder: 6,  defaultSize: 'half' },
  { id: 'work-log',             name: 'Work Log',             description: 'Recent agent activity log',                defaultEnabled: false, defaultOrder: 7,  defaultSize: 'half' },
  { id: 'skills',               name: 'Skills',               description: 'Enabled capabilities',                     defaultEnabled: true,  defaultOrder: 8,  defaultSize: 'half' },
  { id: 'linear-issues',        name: 'Linear Issues',        description: 'Active AI team issues and count',          defaultEnabled: false, defaultOrder: 9,  defaultSize: 'half' },
  { id: 'cron-jobs',            name: 'Cron Jobs',            description: 'Next scheduled runs',                      defaultEnabled: false, defaultOrder: 10, defaultSize: 'half' },
  { id: 'recent-reports',       name: 'Recent Reports',       description: 'Latest overnight reports',                 defaultEnabled: false, defaultOrder: 11, defaultSize: 'full' },
  { id: 'site-health',          name: 'Site Health',          description: 'HTTP status for all Skunk sites',          defaultEnabled: false, defaultOrder: 12, defaultSize: 'half' },
  { id: 'github-activity',      name: 'GitHub Activity',      description: 'Recent PRs and commits across Skunk repos', defaultEnabled: false, defaultOrder: 13, defaultSize: 'half' },
  { id: 'intel-feed',           name: 'Intel Feed',           description: 'Market signals and competitor monitoring', defaultEnabled: false, defaultOrder: 14, defaultSize: 'half' },
  { id: 'github-commits',       name: 'GitHub Commits',       description: 'Commit activity across all Skunk repos',   defaultEnabled: true,  defaultOrder: 5,  defaultSize: 'full' },
];

const STORAGE_KEY = 'superclaw-dashboard-layout';

export function loadLayout(): WidgetLayout[] {
  const defaults = WIDGET_REGISTRY.map(w => ({ id: w.id, enabled: w.defaultEnabled, order: w.defaultOrder, size: w.defaultSize }));
  if (typeof window === 'undefined') return defaults;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as WidgetLayout[];
      // Merge: add any new widgets from registry that aren't stored yet
      const merged = defaults.map(d => parsed.find(p => p.id === d.id) ?? d);
      return merged;
    }
  } catch {}
  return defaults;
}

export function saveLayout(layout: WidgetLayout[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {}
}

export function resetLayout(): WidgetLayout[] {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
  return WIDGET_REGISTRY.map(w => ({ id: w.id, enabled: w.defaultEnabled, order: w.defaultOrder, size: w.defaultSize }));
}
