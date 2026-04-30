import { useEffect } from 'react';
import { useDashboardStore } from '@/store/dashboardStore';
import { dashboardApi } from '@/services/dashboardApi';

/**
 * Bootstraps dashboard data and keeps realtime freshness indicators updated.
 */
export function useDashboardSnapshot() {
  const snapshot = useDashboardStore((state) => state.snapshot);
  const setSnapshot = useDashboardStore((state) => state.setSnapshot);
  const updateSnapshot = useDashboardStore((state) => state.updateSnapshot);
  const hydratePrefs = useDashboardStore((state) => state.hydratePrefs);

  useEffect(() => {
    let disposed = false;
    let refreshTimer: number | null = null;
    let webcamSocket: WebSocket | null = null;
    let thermalSocket: WebSocket | null = null;
    let webcamReconnectTimer: number | null = null;
    let thermalReconnectTimer: number | null = null;

    const refreshSnapshot = async () => {
      if (disposed) return;
      const next = await dashboardApi.fetchSnapshot();
      if (!disposed) setSnapshot(next);
    };

    void (async () => {
      await hydratePrefs();
      await refreshSnapshot();
    })();

    const connectWebcamSocket = () => {
      if (disposed) return;
      webcamSocket = new WebSocket(dashboardApi.webcamSocketUrl());

      webcamSocket.onmessage = (event) => {
        if (disposed || typeof event.data !== 'string') return;
        const payload = dashboardApi.parseCameraWsPayload(event.data);
        if (!payload) return;
        updateSnapshot((current) => dashboardApi.applyFreshness(dashboardApi.applyWebcamWsFrame(current, payload)));
      };

      webcamSocket.onclose = () => {
        if (disposed) return;
        webcamReconnectTimer = window.setTimeout(connectWebcamSocket, 2000);
      };
    };

    const connectThermalSocket = () => {
      if (disposed) return;
      thermalSocket = new WebSocket(dashboardApi.thermalSocketUrl());

      thermalSocket.onmessage = (event) => {
        if (disposed || typeof event.data !== 'string') return;
        const payload = dashboardApi.parseCameraWsPayload(event.data);
        if (!payload) return;
        updateSnapshot((current) => dashboardApi.applyFreshness(dashboardApi.applyThermalWsFrame(current, payload)));
      };

      thermalSocket.onclose = () => {
        if (disposed) return;
        thermalReconnectTimer = window.setTimeout(connectThermalSocket, 2000);
      };
    };

    connectWebcamSocket();
    connectThermalSocket();

    refreshTimer = window.setInterval(() => {
      void refreshSnapshot();
    }, 2000);

    return () => {
      disposed = true;
      if (refreshTimer !== null) window.clearInterval(refreshTimer);
      if (webcamReconnectTimer !== null) window.clearTimeout(webcamReconnectTimer);
      if (thermalReconnectTimer !== null) window.clearTimeout(thermalReconnectTimer);
      if (webcamSocket && webcamSocket.readyState === WebSocket.OPEN) webcamSocket.close();
      if (thermalSocket && thermalSocket.readyState === WebSocket.OPEN) thermalSocket.close();
    };
  }, [hydratePrefs, setSnapshot, updateSnapshot]);

  return snapshot;
}
