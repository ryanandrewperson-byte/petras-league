import { useEffect, useState } from 'react';
import { Shield } from 'lucide-react';
import { supabase } from './lib/supabase';

export default function App() {
  const [status, setStatus] = useState('checking');
  useEffect(() => {
    supabase.auth.getSession()
      .then(() => setStatus('connected'))
      .catch(() => setStatus('error'));
  }, []);

  return (
    <div className="min-h-screen bg-ink text-ghost flex flex-col items-center justify-center px-6">
      <Shield className="text-cyan mb-4" size={40} />
      <h1 className="font-display text-6xl tracking-wider text-cyan">Petras League</h1>
      <p className="font-sans text-muted mt-2">Phase 0 — shell online</p>
      <span className={`font-sans mt-6 px-4 py-1 rounded-full text-sm ${
        status === 'connected' ? 'bg-bianca/20 text-bianca' :
        status === 'error' ? 'bg-magenta/20 text-magenta' : 'bg-raised text-muted'}`}>
        {status === 'connected' ? 'Connected to Supabase' :
         status === 'error' ? 'Check your .env.local' : 'Connecting…'}
      </span>
    </div>
  );
}