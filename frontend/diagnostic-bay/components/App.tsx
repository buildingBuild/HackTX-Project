'use client';
import { useBay } from '@/lib/useBay';
import { SelectScreen, WaitScreen } from './Screens';
import Workspace from './Workspace';

export default function App() {
  const bay = useBay();
  return (
    <div id="app">
      {bay.screen === 'select' && <SelectScreen bay={bay} />}
      {bay.screen === 'wait' && bay.customer && <WaitScreen bay={bay} />}
      {bay.screen === 'work' && bay.customer && <Workspace bay={bay} />}
    </div>
  );
}
