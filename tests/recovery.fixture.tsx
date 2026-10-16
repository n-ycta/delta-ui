import {createRoot} from 'react-dom/client';import {RecoverySecret} from '../src/ui/RecoverySecret';import '../src/styles/tokens.css';import '../src/styles/base.css';import '../src/styles/components.css';
createRoot(document.getElementById('root')!).render(<main className="auth-page"><div className="auth-card"><RecoverySecret value="fixture private words"/></div></main>);
