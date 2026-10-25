'use client';

import { useEffect } from 'react';
import type { Bay } from '@/lib/useBay';
import { isLandCruiserProfile, type Reading } from '@/lib/telemetry';

export function SensorModeSetting({ bay }: { bay: Bay }) {
  useEffect(() => { void bay.loadSensorConfig(); }, [bay.loadSensorConfig]);
  return <div className="sensor-setting">
    <label htmlFor="sensor-mode">Scan data source</label>
    <select id="sensor-mode" value={bay.sensorMode} disabled={bay.sensor.active} onChange={(event) => bay.setSensorMode(event.target.value as 'demo' | 'hardware')}>
      <option value="demo">Demo Mode · simulated OBD</option>
      <option value="hardware" disabled={!bay.sensorConfig.hardwareConfigured}>Hardware Mode · ESP32 Wi-Fi</option>
    </select>
    <p>{bay.sensorConfig.hardwareConfigured ? 'Hardware can send emulated OBD or attached-sensor measurements; each reading identifies its source.' : 'Demo Mode works without hardware. Configure the backend device token to enable Hardware Mode.'}</p>
  </div>;
}

type Metric = 'temperature' | 'rpm' | 'voltage' | 'vibration';
function Sparkline({ history, metric, title }: { history: Reading[]; metric: Metric; title: string }) {
  const values = history.slice(-60);
  const measured = values.map((r) => r[metric]).filter((value) => value != null);
  if (measured.length < 2) return <div className="sensor-chart-empty" aria-label={`${title}: waiting for samples`} />;
  const min = Math.min(...measured), max = Math.max(...measured), span = Math.max(max - min, metric === 'rpm' ? 100 : metric === 'temperature' ? 5 : 0.1);
  let segment = '';
  const paths: string[] = [];
  values.forEach((reading, index) => {
    const value = reading[metric];
    if (value == null) { if (segment) paths.push(segment); segment = ''; return; }
    const x = 2 + index / Math.max(1, values.length - 1) * 116, y = 31 - (value - min) / span * 24;
    segment += `${segment ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)} `;
  });
  if (segment) paths.push(segment);
  return <svg className="sensor-sparkline" viewBox="0 0 120 36" role="img" aria-label={`${title}: ${measured.length} recent samples, minimum ${min.toFixed(2)}, maximum ${max.toFixed(2)}`}><path d="M2 33H118" stroke="currentColor" opacity=".12" />{paths.map((d, i) => <path key={i} d={d} fill="none" stroke="currentColor" strokeWidth="1.7" />)}</svg>;
}

export default function SensorReadings({ bay, compact = false }: { bay: Bay; compact?: boolean }) {
  if (!isLandCruiserProfile(bay.customer)) return null;
  const sensor = bay.sensor, latest = sensor.latest;
  const simulated = sensor.mode === 'demo' || latest?.simulated === true;
  const provenance = simulated ? sensor.mode === 'hardware' ? 'ESP32 OBD emulator · SIMULATED' : 'OBD emulator · SIMULATED' : latest ? 'Attached sensors · MEASURED' : 'Hardware · awaiting readings';
  const metrics: [Metric, string, string, number][] = [
    ['temperature', simulated ? 'Coolant · PID 0105' : 'Attached temperature', '°C', 1],
    ['rpm', simulated ? 'Engine speed · PID 010C' : 'Attached rotation speed', 'RPM', 0],
    ['voltage', simulated ? 'Module voltage · PID 0142' : 'Attached voltage', 'V', 2],
    ['vibration', 'Vibration signal · extra sensor', 'V RMS', 3],
  ];
  return <section className={'sensor-readings card2' + (compact ? ' compact' : '')} aria-label="Land Cruiser scan readings">
    <header><h3>Scan readings</h3><span className={simulated ? 'sensor-origin simulated' : 'sensor-origin'}>{provenance}</span></header>
    <div className="sensor-connection" role="status"><i className={sensor.active ? sensor.connection : 'stopped'} /><span>{sensor.message}</span></div>
    <div className="sensor-metrics">{metrics.map(([key, title, unit, digits]) => <div className="tile sensor-metric" key={key}><span>{title}</span><b>{latest?.[key] == null ? '—' : latest[key].toFixed(digits)} <small>{unit}</small></b>{!compact && <Sparkline history={sensor.history} metric={key} title={title} />}</div>)}</div>
    <div className="sensor-meta"><span>{sensor.samples} samples · {sensor.rejected} rejected</span><span>Last: {latest ? new Date(latest.timestamp).toLocaleTimeString() : 'none'}</span></div>
    {sensor.scanId && <div className="sensor-session mono">Scan {sensor.scanId}</div>}
    {sensor.warnings.length > 0 && <div className="sensor-warnings" role="status"><b>{simulated ? 'Simulated rule triggers' : 'Configured sensor thresholds triggered'}</b><ul>{sensor.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div>}
    <p className="sensor-explanation">{simulated ? 'Synthetic OBD values for this demo profile. These do not diagnose a real vehicle fault.' : 'Readings describe the device’s attached sensors. No vehicle OBD/CAN interface is implemented.'}</p>
    {sensor.active && <button className="chip" onClick={bay.cancelScan}>Cancel vehicle scan</button>}
  </section>;
}
