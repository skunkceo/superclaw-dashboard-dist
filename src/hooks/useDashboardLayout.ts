'use client';
import { useState, useEffect, useCallback } from 'react';
import { WidgetLayout, loadLayout, saveLayout, resetLayout, WIDGET_REGISTRY } from '@/lib/dashboard-layout';
import { arrayMove } from '@dnd-kit/sortable';

export function useDashboardLayout() {
  const [layout, setLayout] = useState<WidgetLayout[]>(() =>
    WIDGET_REGISTRY.map(w => ({ id: w.id, enabled: w.defaultEnabled, order: w.defaultOrder, size: w.defaultSize }))
  );
  const [mounted, setMounted] = useState(false);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    setLayout(loadLayout());
    setMounted(true);
  }, []);

  const updateLayout = useCallback((newLayout: WidgetLayout[]) => {
    setLayout(newLayout);
    saveLayout(newLayout);
  }, []);

  const reorderWidgets = useCallback((activeId: string, overId: string) => {
    setLayout(prev => {
      const enabled = prev.filter(w => w.enabled).sort((a, b) => a.order - b.order);
      const oldIdx = enabled.findIndex(w => w.id === activeId);
      const newIdx = enabled.findIndex(w => w.id === overId);
      if (oldIdx === -1 || newIdx === -1) return prev;
      const reordered = arrayMove(enabled, oldIdx, newIdx).map((w, i) => ({ ...w, order: i }));
      const updated = prev.map(w => reordered.find(r => r.id === w.id) ?? w);
      saveLayout(updated);
      return updated;
    });
  }, []);

  const toggleWidget = useCallback((id: string, enabled: boolean) => {
    setLayout(prev => {
      const updated = prev.map(w => w.id === id ? { ...w, enabled } : w);
      saveLayout(updated);
      return updated;
    });
  }, []);

  const reset = useCallback(() => {
    const defaults = resetLayout();
    setLayout(defaults);
  }, []);

  return { layout, mounted, editMode, setEditMode, reorderWidgets, toggleWidget, reset };
}
