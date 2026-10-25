'use client';
import { useSyncExternalStore } from 'react';
import { logStore } from '@/lib/api';

const EMPTY: any[] = [];

export default function ApiLog() {
  const log = useSyncExternalStore(logStore.subscribe, logStore.get, () => EMPTY);
  return (
    <div className="logpop">
      <h4>API requests</h4>
      {log.length === 0 && <p className="note">No requests yet.</p>}
      {log.map((e, i) => (
        <div className="logrow" key={i}>
          <span>{e.method}</span>
          <span style={{ overflowWrap: 'anywhere' }}>{e.path}</span>
          <span className={e.status === 200 ? 'ok' : e.status === '…' ? 'pend' : 'bad'}>{e.status} {e.status === '…' ? '' : (e.ms / 1000).toFixed(1) + 's'}</span>
        </div>
      ))}
    </div>
  );
}
