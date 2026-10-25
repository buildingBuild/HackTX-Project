import { createRoot } from 'react-dom/client';
import '@fontsource-variable/dm-sans';
import '@fontsource-variable/manrope';
import './style.css';
import './toyota-theme.css';
import RepairApp from './RepairApp';

createRoot(document.getElementById('root')!).render(<RepairApp />);
