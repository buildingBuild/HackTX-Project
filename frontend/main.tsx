import {createRoot} from 'react-dom/client';
import '@fontsource-variable/dm-sans';
import '@fontsource-variable/manrope';
import DiagnosticsApp from './DiagnosticsApp';

createRoot(document.getElementById('root')!).render(<DiagnosticsApp/>);
