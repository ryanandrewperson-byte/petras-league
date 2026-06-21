import { useEffect, useState, useRef, createContext, useContext, useCallback } from 'react';
import { Shield, Lock, LogOut, Check, Trophy, Crown, ListChecks, Users, Zap, Wallet, Paperclip, Eye, EyeOff, Pencil, Trash2, Plus, Calendar, ChevronRight, GripVertical, LayoutDashboard, HelpCircle, Activity, X, RefreshCw, ChevronDown, Flame, TrendingUp, Menu, Settings, Sparkles } from 'lucide-react';
import { supabase } from './lib/supabase';

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function phoneStatus(pts, max) {
  const pct = max > 0 ? (pts / max) * 100 : 0;
  if (pct >= 80) return { label: 'Unlimited phone', sub: 'after responsibilities', tone: 'good' };
  if (pct >= 60) return { label: '2 hours', sub: 'phone time', tone: 'ok' };
  if (pct >= 40) return { label: '1 hour', sub: 'phone time', tone: 'warn' };
  return { label: 'Phone parked', sub: 'until tomorrow', tone: 'bad' };
}
function toneColor(t) {
  return t === 'good' ? '#46E5A0' : t === 'ok' ? '#FFC23C' : t === 'warn' ? '#FF9F45' : '#FF4D5E';
}
function allowanceFromTiers(points, weeklyMax, tiers) {
  if (!weeklyMax || !tiers || !tiers.length) return 0;
  const pct = (points / weeklyMax) * 100;
  let amt = 0;
  for (const t of tiers) if (pct >= t.min_percent) amt = Math.max(amt, t.amount);
  return amt;
}
// The next reward tier above the kid's current points, and how many points to reach it.
function nextTier(points, weeklyMax, tiers) {
  if (!weeklyMax || !tiers || !tiers.length) return null;
  const sorted = [...tiers].sort((a, b) => a.min_percent - b.min_percent);
  for (const t of sorted) {
    const need = Math.ceil((t.min_percent / 100) * weeklyMax);
    if (need > points) return { amount: t.amount, ptsNeeded: need - points };
  }
  return null;
}
// Loads the challenge whose date range contains today (the "active" one), with its tasks + reward tiers.
function useActiveChallenge() {
  const [data, setData] = useState(null); // null = loading; { challenge, tasks, tiers }
  useEffect(() => {
    (async () => {
      const today = todayKey();
      const { data: chs } = await supabase.from('challenges').select('id, name, start_date, end_date')
        .lte('start_date', today).gte('end_date', today).order('start_date', { ascending: false }).limit(1);
      const ch = (chs && chs[0]) || null;
      if (!ch) { setData({ challenge: null, tasks: [], tiers: [] }); return; }
      const { data: tasks } = await supabase.from('challenge_tasks').select('id, task_key, label, category, sort_order').eq('challenge_id', ch.id).order('sort_order');
      const { data: tiers } = await supabase.from('challenge_reward_tiers').select('min_percent, amount').eq('challenge_id', ch.id).order('min_percent');
      setData({ challenge: ch, tasks: tasks || [], tiers: tiers || [] });
    })();
  }, []);
  return data;
}
// The seven dates of the current week, Monday → Sunday (matches get_leaderboard's reset).
function weekDates() {
  const d = new Date();
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(monday);
    dd.setDate(monday.getDate() + i);
    return `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, '0')}-${String(dd.getDate()).padStart(2, '0')}`;
  });
}
function weekLabel(ds) {
  const [y, m, d] = ds.split('-').map(Number);
  return 'Week of ' + new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
// Session-reveal signal: bumps on each new session (initial load = 1; pull-refresh increments).
let REVEAL_SESSION = 1;
let REVEAL_SHOWN = 0;

const ymdOf = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
function streakFromDates(dateSet) {
  if (!dateSet || !dateSet.size) return 0;
  const d = new Date();
  if (!dateSet.has(ymdOf(d))) d.setDate(d.getDate() - 1); // today not done yet doesn't break the streak
  let n = 0;
  while (dateSet.has(ymdOf(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

function dayName(ds) {
  const [y, m, d] = ds.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short' });
}
function dayLabelFull(ds) {
  const [y, m, d] = ds.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/* ---------- Celebration system (centered POW that pops big then settles) ---------- */
const CelebrationContext = createContext(() => {});
function useCelebrate() { return useContext(CelebrationContext); }

function CenterBurst({ word, color }) {
  const spikes = 14, outer = 122, inner = 88, cx = 130, cy = 130;
  let p = '';
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / spikes) * i - Math.PI / 2;
    p += `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)} `;
  }
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
      <div className="center-pow relative" style={{ width: 260, height: 260 }}>
        <svg viewBox="0 0 260 260" className="w-full h-full">
          <polygon points={p} fill={color} stroke="#0B0B0F" strokeWidth="4" strokeLinejoin="round" />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center font-display text-ink text-center"
          style={{ fontSize: 46, transform: 'rotate(-6deg)', letterSpacing: '0.02em' }}>{word}</span>
      </div>
    </div>
  );
}

function CelebrationProvider({ children }) {
  const [cele, setCele] = useState(null);
  const celebrate = useCallback((opts = {}) => {
    const key = Date.now() + Math.random();
    const word = opts.word || ACTION_WORDS[Math.floor(Math.random() * ACTION_WORDS.length)];
    setCele({ word, color: opts.color || '#FFC23C', key });
    setTimeout(() => setCele(c => (c && c.key === key ? null : c)), 1100);
  }, []);
  return (
    <CelebrationContext.Provider value={celebrate}>
      <style>{`
        @keyframes centerPow {
          0%{transform:scale(2.6) rotate(-12deg);opacity:0}
          9%{opacity:1}
          38%{transform:scale(0.86) rotate(-2deg)}
          56%{transform:scale(1.1) rotate(-7deg)}
          70%{transform:scale(1) rotate(-5deg);opacity:1}
          100%{transform:scale(1.05) rotate(-5deg);opacity:0}
        }
        .center-pow{animation:centerPow 1.05s cubic-bezier(.2,1.1,.3,1) both;transform-origin:center}
        @keyframes checkPop{0%{transform:scale(.5)}55%{transform:scale(1.25)}100%{transform:scale(1)}}
        .check-pop{animation:checkPop .32s cubic-bezier(.2,1.4,.3,1) both}
        @keyframes crownDrop{0%{transform:translateY(-14px) scale(.3) rotate(-18deg);opacity:0}55%{transform:translateY(2px) scale(1.18) rotate(6deg);opacity:1}75%{transform:translateY(0) scale(.94) rotate(-3deg)}100%{transform:translateY(0) scale(1) rotate(0);opacity:1}}
        .crown-drop{animation:crownDrop .6s cubic-bezier(.2,1.3,.4,1) both}
        @keyframes flameFlicker{0%,100%{transform:scale(1) rotate(-1.5deg)}50%{transform:scale(1.13) rotate(1.5deg)}}
        .flame-flicker{animation:flameFlicker 1.4s ease-in-out infinite;transform-origin:bottom center}
        @media (prefers-reduced-motion: reduce){.center-pow,.check-pop,.crown-drop,.flame-flicker{animation:none}}
      `}</style>
      {children}
      {cele && <CenterBurst word={cele.word} color={cele.color} />}
    </CelebrationContext.Provider>
  );
}

/* ---------- App shell (auth + routing) ---------- */
const DEV_EMAILS = ['ryanandrewperson@gmail.com'];

function DevViewAs({ members, viewAs, onPick, onReset, devView, setDevView, setShowUsage }) {
  const pill = (active, fill) => active
    ? { background: fill, color: '#0B0B0F', border: '1px solid rgba(0,0,0,0.20)', boxShadow: '0 1px 3px rgba(0,0,0,0.28)', fontWeight: 700 }
    : { background: '#FFFFFF', color: '#3A3A40', border: '1px solid rgba(0,0,0,0.14)', fontWeight: 500 };
  return (
    <div className="fixed top-0 inset-x-0 z-50" style={{ background: '#D5D5DB', borderBottom: '2px solid #FF3D7F', boxShadow: '0 2px 10px -3px rgba(0,0,0,0.45)' }}>
      <div className="max-w-5xl mx-auto px-3">
        <div className="flex items-center gap-2 py-1.5">
          <span className="font-display tracking-widest shrink-0" style={{ color: '#C2185B', fontSize: '11px' }}>DEV</span>
          <span className="font-sans shrink-0" style={{ fontSize: '10px', color: '#6E6E73' }}>as</span>
          <div className="flex items-center gap-1.5 overflow-x-auto flex-1 min-w-0" style={{ scrollbarWidth: 'none' }}>
            <button onClick={onReset} className="shrink-0 px-2.5 py-0.5 rounded-full font-sans text-xs" style={pill(!viewAs, '#FF3D7F')}>Me</button>
            {members.map(m => {
              const on = viewAs && viewAs.id === m.id;
              const mc = m.hero_color || '#FFC23C';
              return (
                <button key={m.id} onClick={() => onPick(m)} className="shrink-0 px-2.5 py-0.5 rounded-full font-sans text-xs flex items-center gap-1.5" style={pill(on, mc)}>
                  <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: mc, border: on ? '1px solid rgba(0,0,0,0.25)' : 'none' }} />
                  {m.full_name.split(' ')[0]}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-2 py-1.5 border-t" style={{ borderColor: 'rgba(0,0,0,0.12)' }}>
          <button onClick={() => setShowUsage(true)} title="Usage stats"
            className="shrink-0 flex items-center gap-1 px-2.5 py-0.5 rounded-full font-sans text-xs" style={pill(false, '#fff')}>
            <Activity size={13} /> Stats
          </button>
          <span className="flex-1" />
          <span className="font-sans shrink-0" style={{ fontSize: '10px', color: '#6E6E73' }}>view</span>
          <div className="flex items-center gap-1 shrink-0">
            {['auto', 'mobile', 'desktop'].map(v => (
              <button key={v} onClick={() => setDevView(v)} className="px-2.5 py-0.5 rounded-full font-sans text-xs capitalize" style={pill(devView === v, '#29E0FF')}>{v}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- DEV: Usage dashboard (owner-only) ---------- */
function UsageDashboard({ onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [d, setD] = useState(null);

  useEffect(() => {
    let active = true;
    const dkey = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    (async () => {
      try {
        const today = todayKey();
        // Window = current challenge if one is active, else trailing 30 days.
        const { data: chs } = await supabase.from('challenges').select('id, name, start_date, end_date')
          .lte('start_date', today).gte('end_date', today).order('start_date', { ascending: false }).limit(1);
        const ch = (chs && chs[0]) || null;
        let start = ch ? ch.start_date : null;
        if (!start) { const s = new Date(); s.setDate(s.getDate() - 29); start = dkey(s); }

        const [profRes, loginRes, entryRes] = await Promise.all([
          supabase.from('profiles').select('id, full_name, role, hero_color, codename, sport'),
          supabase.rpc('usage_logins'),
          supabase.from('daily_entries').select('id, kid_id, entry_date, status, approved_by').gte('entry_date', start),
        ]);
        const profs = profRes.data || [];
        const loginRows = loginRes.data || [];
        const entries = entryRes.data || [];

        const loginById = {};
        loginRows.forEach(l => { loginById[l.id] = l; });

        // Tasks completed per kid across the window.
        const tasksByKid = {};
        const entryIds = entries.map(e => e.id);
        if (entryIds.length) {
          const kidByEntry = {};
          entries.forEach(e => { kidByEntry[e.id] = e.kid_id; });
          const { data: et } = await supabase.from('entry_tasks').select('entry_id, completed').in('entry_id', entryIds);
          (et || []).forEach(t => { if (t.completed) { const k = kidByEntry[t.entry_id]; tasksByKid[k] = (tasksByKid[k] || 0) + 1; } });
        }

        // Check-in dates per kid.
        const datesByKid = {};
        entries.forEach(e => {
          (datesByKid[e.kid_id] = datesByKid[e.kid_id] || new Set()).add(e.entry_date);
        });
        const streakOf = (set) => {
          if (!set || !set.size) return 0;
          let n = 0; const dt = new Date();
          while (set.has(dkey(dt))) { n++; dt.setDate(dt.getDate() - 1); }
          return n;
        };

        // 14-day check-in sparkline (all athletes).
        const days = Array.from({ length: 14 }, (_, i) => { const x = new Date(); x.setDate(x.getDate() - (13 - i)); return dkey(x); });
        const perDay = days.map(day => entries.filter(e => e.entry_date === day).length);

        // Pulse.
        const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
        const everLoggedIn = loginRows.filter(l => l.last_sign_in_at).length;
        const active7 = loginRows.filter(l => l.last_sign_in_at && new Date(l.last_sign_in_at) >= weekAgo).length;

        if (active) {
          setD({
            challengeName: ch ? ch.name : null,
            kids: profs.filter(p => p.role !== 'parent'),
            parents: profs.filter(p => p.role === 'parent'),
            totalAccounts: profs.length, everLoggedIn, active7, totalCheckins: entries.length,
            loginById, datesByKid, tasksByKid, streakOf, days, perDay,
          });
          setLoading(false);
        }
      } catch (e) {
        if (active) { setError(e.message || 'Failed to load usage'); setLoading(false); }
      }
    })();
    return () => { active = false; };
  }, []);

  const ago = (ts) => {
    if (!ts) return 'never';
    const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
    if (s < 60) return 'just now';
    const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
    const dd = Math.floor(h / 24); if (dd < 30) return `${dd}d ago`;
    return `${Math.floor(dd / 30)}mo ago`;
  };
  const mdy = (ds) => { if (!ds) return '—'; const p = ds.split('-'); return `${p[1]}/${p[2]}`; };
  const lastCheckin = (set) => { if (!set || !set.size) return null; return Array.from(set).sort().slice(-1)[0]; };

  const gold = '#FFC23C';
  const Stat = ({ label, value, sub }) => (
    <div className="bg-raised rounded-2xl px-3 py-3 flex-1 min-w-0">
      <div className="font-display text-2xl leading-none text-ghost">{value}</div>
      <div className="font-sans text-[11px] uppercase tracking-wider text-muted mt-1 truncate">{label}</div>
      {sub && <div className="font-sans text-[11px] text-muted/70 mt-0.5 truncate">{sub}</div>}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-ink/95 backdrop-blur-sm">
      <div className="max-w-2xl mx-auto px-4 py-5 pb-16">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Activity size={20} style={{ color: '#FF3D7F' }} />
            <h1 className="font-display text-3xl tracking-wide text-ghost">USAGE</h1>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-raised flex items-center justify-center text-muted hover:text-ghost">
            <X size={18} />
          </button>
        </div>
        {d && <p className="font-sans text-xs text-muted mb-4">{d.challengeName ? `Challenge: ${d.challengeName}` : 'Trailing 30 days'} · live data</p>}

        {loading && <p className="font-sans text-muted text-sm mt-6">Loading usage…</p>}
        {error && <p className="font-sans text-sm mt-6" style={{ color: '#FF6B6B' }}>Couldn’t load: {error}</p>}

        {d && !loading && (
          <>
            <div className="flex gap-2 mb-5">
              <Stat label="Logged in" value={`${d.everLoggedIn}/${d.totalAccounts}`} sub="accounts ever" />
              <Stat label="Active" value={d.active7} sub="signed in ≤7d" />
              <Stat label="Check-ins" value={d.totalCheckins} sub="this window" />
            </div>

            <div className="bg-panel rounded-2xl px-4 py-3 mb-5">
              <div className="font-sans text-[11px] uppercase tracking-wider text-muted mb-2">Check-ins · last 14 days</div>
              <div className="flex items-end gap-1 h-16">
                {d.perDay.map((n, i) => {
                  const max = Math.max(1, ...d.perDay);
                  return <div key={i} className="flex-1 rounded-t" title={`${mdy(d.days[i])}: ${n}`}
                    style={{ height: `${Math.max(4, (n / max) * 100)}%`, background: n ? '#29E0FF' : '#20212B' }} />;
                })}
              </div>
            </div>

            <div className="font-display text-lg tracking-wide text-ghost mb-2">Athletes</div>
            <div className="space-y-2 mb-5">
              {d.kids.map(k => {
                const lg = d.loginById[k.id];
                const lc = lastCheckin(d.datesByKid[k.id]);
                const streak = d.streakOf(d.datesByKid[k.id]);
                return (
                  <div key={k.id} className="bg-panel rounded-2xl px-3 py-3 flex items-center gap-3">
                    <span className="w-9 h-9 rounded-xl flex items-center justify-center font-display text-ink shrink-0" style={{ background: k.hero_color }}>{k.full_name[0]}</span>
                    <div className="min-w-0 flex-1">
                      <div className="font-display text-base text-ghost leading-none truncate">{k.full_name}</div>
                      <div className="font-sans text-[11px] text-muted mt-1">
                        Last login {lg ? ago(lg.last_sign_in_at) : 'never'}
                        {lg && !lg.last_sign_in_at && ' · not yet'}
                      </div>
                    </div>
                    <div className="flex gap-3 shrink-0 text-center">
                      <div><div className="font-display text-lg text-ghost leading-none">{(d.datesByKid[k.id] || new Set()).size}</div><div className="font-sans text-[10px] text-muted uppercase">days</div></div>
                      <div><div className="font-display text-lg leading-none" style={{ color: streak ? '#29E0FF' : '#9A9CB0' }}>{streak}</div><div className="font-sans text-[10px] text-muted uppercase">streak</div></div>
                      <div><div className="font-display text-lg text-ghost leading-none">{d.tasksByKid[k.id] || 0}</div><div className="font-sans text-[10px] text-muted uppercase">tasks</div></div>
                      <div className="w-12"><div className="font-sans text-xs text-ghost leading-none mt-1">{mdy(lc)}</div><div className="font-sans text-[10px] text-muted uppercase mt-1">last</div></div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="font-display text-lg tracking-wide text-ghost mb-2">Commanders</div>
            <div className="space-y-2">
              {d.parents.map(p => {
                const lg = d.loginById[p.id];
                return (
                  <div key={p.id} className="bg-panel rounded-2xl px-3 py-3 flex items-center gap-3">
                    <span className="w-9 h-9 rounded-xl flex items-center justify-center font-display text-ink shrink-0" style={{ background: gold }}>{p.full_name[0]}</span>
                    <div className="min-w-0 flex-1">
                      <div className="font-display text-base text-ghost leading-none truncate">{p.full_name}</div>
                      <div className="font-sans text-[11px] text-muted mt-1">Last login {lg ? ago(lg.last_sign_in_at) : 'never'}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [members, setMembers] = useState([]);
  const [viewAs, setViewAs] = useState(null);
  const [devView, setDevView] = useState('auto');
  const [showUsage, setShowUsage] = useState(false);
  const [wide, setWide] = useState(typeof window !== 'undefined' && window.innerWidth >= 1024);
  useEffect(() => {
    const onResize = () => setWide(window.innerWidth >= 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setProfile(null); return; }
    let active = true;
    (async () => {
      const { data } = await supabase.from('profiles')
        .select('full_name, role, hero_color, codename, sport, must_change_password')
        .eq('id', session.user.id).single();
      if (active) setProfile(data);
    })();
    return () => { active = false; };
  }, [session]);

  const isDev = !!session && DEV_EMAILS.includes((session.user.email || '').toLowerCase());
  useEffect(() => {
    if (!isDev) { setMembers([]); return; }
    let active = true;
    (async () => {
      const { data } = await supabase.from('profiles').select('id, full_name, role, hero_color, codename, sport').order('role');
      if (active) setMembers((data || []).filter(m => m.id !== session.user.id));
    })();
    return () => { active = false; };
  }, [isDev, session]);

  if (loading) return <Centered>Loading…</Centered>;
  if (!session) return <Login />;
  if (!profile) return <Centered>Loading your profile…</Centered>;
  if (profile.must_change_password) return <SetPassword session={session} onDone={setProfile} />;

  const effProfile = viewAs || profile;
  const effId = viewAs ? viewAs.id : session.user.id;
  const isParent = effProfile.role === 'parent';
  const desktop = isParent && (devView === 'desktop' || (devView === 'auto' && wide));
  return (
    <CelebrationProvider>
      {isDev && <DevViewAs members={members} viewAs={viewAs} devView={devView} setDevView={setDevView} setShowUsage={setShowUsage}
        onPick={(m) => { setViewAs(m); setTab('main'); }}
        onReset={() => { setViewAs(null); setTab('main'); }} />}
      {isDev && showUsage && <UsageDashboard onClose={() => setShowUsage(false)} />}
      {desktop
        ? <DesktopShell key={effId} profile={effProfile} userId={effId} tab={tab} setTab={setTab} devOffset={isDev} />
        : <Shell key={effId} profile={effProfile} userId={effId} tab={tab} setTab={setTab} devOffset={isDev} />}
    </CelebrationProvider>
  );
}

/* ---------- Shell with tabs ---------- */
/* ---------- Family Hub nav (slide-out drawer) ---------- */
const HUB_PAGES = [
  { id: 'challenge', label: 'The Challenge', sub: 'Daily check-ins & league', Icon: Trophy },
  { id: 'whatsnew', label: "What's New", sub: 'Latest feature updates', Icon: Sparkles },
  { id: 'settings', label: 'Settings', sub: 'Preferences & accents', Icon: Settings },
];
const NAV_W = 'min(85vw, 300px)';

function HubNav({ open, onClose, page, setPage, accent }) {
  return (
    <>
      <div onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} />
      <aside
        className="fixed left-0 top-0 z-50 h-full bg-panel border-r border-white/10 transition-transform duration-300 ease-out"
        style={{ width: NAV_W, transform: open ? 'translateX(0)' : 'translateX(-100%)', paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="px-5 pt-6 pb-5 border-b border-white/10 flex items-start justify-between">
          <div>
            <p className="font-display text-2xl tracking-wide leading-none" style={{ color: accent }}>Petras</p>
            <p className="font-display text-xl tracking-wide leading-none text-ghost mt-1">Family Hub</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ghost p-1 -mr-1" aria-label="Close menu"><X size={22} /></button>
        </div>
        <nav className="p-3 flex flex-col gap-2">
          {HUB_PAGES.map(({ id, label, sub, Icon }) => {
            const active = page === id;
            return (
              <button key={id} onClick={() => { setPage(id); onClose(); }}
                className="flex items-center gap-3 rounded-2xl p-3 text-left transition-colors"
                style={{ background: active ? accent : '#20212B', border: active ? 'none' : '1px solid rgba(255,255,255,.06)' }}>
                <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: active ? 'rgba(0,0,0,.18)' : '#15151C' }}>
                  <Icon size={20} color={active ? '#0B0B0F' : accent} strokeWidth={2.2} />
                </span>
                <span className="min-w-0">
                  <span className="block font-display text-lg tracking-wide leading-none" style={{ color: active ? '#0B0B0F' : '#F4F5FA' }}>{label}</span>
                  <span className="block font-sans text-xs mt-1 leading-none" style={{ color: active ? 'rgba(0,0,0,.55)' : '#9A9CB0' }}>{sub}</span>
                </span>
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

/* ---------- Placeholder hub pages (built out in later chunks) ---------- */
function ComingSoon({ Icon, title, blurb, accent }) {
  return (
    <div className="flex flex-col items-center text-center py-16">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5" style={{ background: '#20212B', border: `1px solid ${accent}55` }}>
        <Icon size={30} color={accent} />
      </div>
      <h2 className="font-display text-3xl tracking-wide text-ghost">{title}</h2>
      <p className="font-sans text-muted text-sm mt-2 max-w-xs">{blurb}</p>
      <span className="mt-5 px-3 py-1 rounded-full font-sans text-xs font-bold" style={{ background: `${accent}22`, color: accent }}>Coming soon</span>
    </div>
  );
}
function SettingsPage({ accent }) {
  return <ComingSoon Icon={Settings} title="Settings" blurb="Preferences, notifications, and seasonal accents will live here. Building this next." accent={accent} />;
}
function WhatsNewPage({ accent }) {
  return <ComingSoon Icon={Sparkles} title="What's New" blurb="A running log of every new feature as it ships. Building this next." accent={accent} />;
}

function Shell({ profile, userId, tab, setTab, devOffset }) {
  const isParent = profile.role === 'parent';
  const accent = isParent ? '#FFC23C' : profile.hero_color;
  const [showProfile, setShowProfile] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [page, setPage] = useState('challenge');
  const [navOpen, setNavOpen] = useState(false);

  // ----- Pull-to-refresh (soft: remounts the current screen -> refetch) -----
  const [refreshKey, setRefreshKey] = useState(0);
  const [pull, setPull] = useState(0);          // px the screen is pulled down
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);                   // null = not tracking a pull
  const PULL_THRESHOLD = 70;                      // px past which a release triggers refresh
  const atTop = () => (window.scrollY || document.documentElement.scrollTop || 0) <= 0;

  const onTouchStart = (e) => {
    if (refreshing) return;
    startY.current = atTop() ? e.touches[0].clientY : null;
  };
  const onTouchMove = (e) => {
    if (startY.current == null || refreshing) return;
    const dy = e.touches[0].clientY - startY.current;
    // Only engage on a downward drag while still at the very top; otherwise let the page scroll normally.
    setPull(dy > 0 && atTop() ? Math.min(110, dy * 0.5) : 0);
  };
  const onTouchEnd = () => {
    if (startY.current == null) return;
    startY.current = null;
    if (pull >= PULL_THRESHOLD) {
      setRefreshing(true);
      setPull(PULL_THRESHOLD);
      REVEAL_SESSION += 1;                        // replay the parent session-reveal on pull-refresh
      setRefreshKey((k) => k + 1);               // remount -> each screen's loader runs again
      setTimeout(() => { setRefreshing(false); setPull(0); }, 750);
    } else {
      setPull(0);
    }
  };

  const tracking = startY.current != null;
  const snap = tracking ? 'none' : 'transform .25s ease, opacity .2s ease';

  // ----- Freshness clock + occasional stale-data nudge -----
  const STALE_MS = 60 * 60 * 1000;                 // freshness line turns amber once data is 1h+ old
  // Learning period: nudge people to pull-refresh whenever a screen's data is >1 min old (7s after landing).
  // Once everyone knows the gesture, bump NUDGE_AFTER_MS back up to STALE_MS so it only nags when truly stale.
  const NUDGE_AFTER_MS = 60 * 1000;
  const [refreshedAt, setRefreshedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [nudge, setNudge] = useState(false);

  // Stamp the load time whenever the visible screen refetches (tab change or pull-refresh).
  useEffect(() => { setRefreshedAt(Date.now()); }, [tab, refreshKey]);

  // Tick so the "Updated Xm ago" label stays current.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  // Nudge: 7s after landing/returning (and re-checked each minute), pulse only if data is stale.
  useEffect(() => {
    let dwell, recheck;
    const fire = () => {
      if (Date.now() - refreshedAt > NUDGE_AFTER_MS) {
        setNudge(true);
        setTimeout(() => setNudge(false), 3600);
      }
    };
    const startDwell = () => { clearTimeout(dwell); dwell = setTimeout(fire, 7000); };
    const onVis = () => { if (document.visibilityState === 'visible') startDwell(); };
    startDwell();
    recheck = setInterval(fire, 60000);
    document.addEventListener('visibilitychange', onVis);
    return () => { clearTimeout(dwell); clearInterval(recheck); document.removeEventListener('visibilitychange', onVis); };
  }, [tab, refreshKey, refreshedAt]);

  const age = now - refreshedAt;
  const stale = age > STALE_MS;
  const ageLabel = age < 60000 ? 'just now'
    : age < STALE_MS ? `${Math.floor(age / 60000)}m ago`
    : `${Math.floor(age / 3600000)}h ${Math.floor((age % 3600000) / 60000)}m ago`;

  // ----- "Needs your eyes" counts for the tab badges (parents only) -----
  const [attn, setAttn] = useState({ payouts: 0 });
  useEffect(() => {
    if (!isParent) return;
    let alive = true;
    const loadAttn = async () => {
      const po = await supabase.from('bonuses').select('id', { count: 'exact', head: true }).eq('status', 'claimed');
      if (alive) setAttn({ payouts: po.count || 0 });
    };
    loadAttn();
    const t = setInterval(loadAttn, 45000);
    return () => { alive = false; clearInterval(t); };
  }, [isParent, tab, refreshKey]);

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <HubNav open={navOpen} onClose={() => setNavOpen(false)} page={page} setPage={setPage} accent={accent} />
      <div className="transition-transform duration-300 ease-out"
        style={{ transform: navOpen ? `translateX(${NAV_W})` : 'translateX(0)' }}>
        <div className={`min-h-screen bg-ink text-ghost font-sans pb-24 overflow-x-hidden ${devOffset ? 'pt-16' : ''}`}
          onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>

          {/* Pull-to-refresh spinner */}
          <div className="pointer-events-none fixed left-0 right-0 flex justify-center z-40"
            style={{ top: devOffset ? 70 : 8, opacity: pull > 4 || refreshing ? 1 : 0,
              transform: `translateY(${pull}px)`, transition: snap }}>
            <div className="w-9 h-9 rounded-full bg-raised flex items-center justify-center"
              style={{ boxShadow: '0 6px 16px -6px rgba(0,0,0,0.7)' }}>
              <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''}
                style={{ color: accent, transform: refreshing ? 'none' : `rotate(${pull * 2.4}deg)` }} />
            </div>
          </div>

          {/* Occasional "pull to refresh" nudge — only when data is stale */}
          <div className="pointer-events-none fixed left-0 right-0 flex justify-center z-40"
            style={{ top: devOffset ? 74 : 12, opacity: nudge && pull === 0 && !refreshing && page === 'challenge' ? 1 : 0, transition: 'opacity .3s ease' }}>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-raised"
              style={{ boxShadow: '0 6px 16px -6px rgba(0,0,0,0.7)' }}>
              <ChevronDown size={14} className="animate-bounce" style={{ color: accent }} />
              <span className="font-sans" style={{ fontSize: '11px', color: accent, fontWeight: 600 }}>Pull to refresh</span>
            </div>
          </div>

          <div style={{ transform: `translateY(${pull}px)`, transition: snap }}>
            <div className="max-w-md mx-auto px-6 py-8">
              <TopBar name={profile.full_name}
                sub={isParent ? 'Commander' : `${profile.codename} · ${profile.sport}`}
                color={accent}
                onOpenNav={() => setNavOpen(true)}
                onOpenProfile={() => setShowProfile(true)}
                onOpenGuide={page === 'challenge' ? () => setShowGuide(true) : undefined} />
              {page === 'settings'
                ? <SettingsPage accent={accent} />
                : page === 'whatsnew'
                  ? <WhatsNewPage accent={accent} />
                  : <>
                      <div className="flex items-center gap-1.5 -mt-3 mb-4" style={{ color: stale ? '#E0A53C' : '#9A9CB0' }}>
                        <RefreshCw size={12} />
                        <span className="font-sans" style={{ fontSize: '11px' }}>Updated {ageLabel}</span>
                      </div>
                      <div key={refreshKey}>
                        {tab === 'league'
                          ? <LeaderBoard />
                          : tab === 'challenges' && isParent
                            ? <ChallengeManager userId={userId} />
                            : tab === 'bonus'
                              ? (isParent ? <ParentPayouts userId={userId} /> : <KidPowerUps profile={profile} userId={userId} />)
                              : (isParent ? <ParentAthletes userId={userId} /> : <KidAthletes profile={profile} userId={userId} />)}
                      </div>
                    </>}
            </div>
          </div>

          {page === 'challenge' &&
            <TabBar isParent={isParent} tab={tab} setTab={setTab} color={accent} attn={attn} />}
          {showProfile && <ProfileSheet profile={profile} userId={userId} isParent={isParent} onClose={() => setShowProfile(false)} />}
          {showGuide && <GuideSheet isParent={isParent} onClose={() => setShowGuide(false)} />}
        </div>
      </div>
    </div>
  );
}

/* ---------- Desktop command center (parents on wide screens) ---------- */
function DesktopShell({ profile, userId, tab, setTab, devOffset }) {
  const [showProfile, setShowProfile] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const gold = '#FFC23C';
  const nav = [
    { id: 'overview', label: 'Overview', Icon: LayoutDashboard },
    { id: 'main', label: 'Athletes', Icon: Users },
    { id: 'league', label: 'League', Icon: Trophy },
    { id: 'bonus', label: 'Payouts', Icon: Wallet },
    { id: 'challenges', label: 'Challenges', Icon: Calendar },
  ];
  const titles = { overview: 'Overview', main: 'Athletes', league: 'League', bonus: 'Payouts', challenges: 'Challenges' };
  const blurbs = {
    overview: 'Everything that needs your eyes, at a glance.',
    main: 'Review every athlete and drill into any day.',
    league: 'Weekly standings and the season championship.',
    bonus: 'Allowance is automatic — verify and pay out claimed power-ups.',
    challenges: 'Build and run the season: tasks, reward ladder, and power-ups.',
  };
  return (
    <div className={`min-h-screen bg-ink text-ghost font-sans ${devOffset ? 'pt-16' : ''}`}>
      <div className="flex min-h-screen">
        <aside className="w-64 shrink-0 border-r border-white/10 bg-panel flex flex-col">
          <button onClick={() => setShowProfile(true)} className="flex items-center gap-3 p-5 text-left border-b border-white/10 hover:bg-white/5 transition-colors">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center font-display text-ink text-xl shrink-0" style={{ background: gold }}>{profile.full_name[0]}</div>
            <div className="min-w-0">
              <div className="font-display text-xl tracking-wide text-ghost leading-none truncate">{profile.full_name}</div>
              <div className="font-sans text-muted text-[11px] uppercase tracking-wider mt-1">Commander · view card</div>
            </div>
          </button>
          <nav className="flex-1 p-3 flex flex-col gap-1">
            {nav.map(({ id, label, Icon }) => {
              const active = tab === id;
              return (
                <button key={id} onClick={() => setTab(id)} aria-current={active ? 'page' : undefined}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors"
                  style={{ background: active ? gold : 'transparent', color: active ? '#0B0B0F' : '#9A9CB0', fontWeight: active ? 700 : 500 }}>
                  <Icon size={18} strokeWidth={active ? 2.6 : 2} />
                  <span className="font-sans text-sm">{label}</span>
                </button>
              );
            })}
          </nav>
          <button onClick={() => setShowGuide(true)} className="flex items-center gap-2 mx-3 mb-1 px-3 py-2.5 rounded-xl text-muted hover:text-ghost hover:bg-white/5 transition-colors">
            <HelpCircle size={16} /><span className="font-sans text-sm">How it works</span>
          </button>
          <button onClick={() => supabase.auth.signOut()} className="flex items-center gap-2 mx-3 mb-3 px-3 py-2.5 rounded-xl text-muted hover:text-ghost border border-white/10 transition-colors">
            <LogOut size={16} /><span className="font-sans text-sm">Sign out</span>
          </button>
        </aside>
        <main className="flex-1 min-w-0 overflow-x-hidden">
          <div className={`mx-auto px-8 py-8 ${tab === 'main' || tab === 'overview' ? 'max-w-5xl' : 'max-w-2xl'}`}>
            <div className="mb-6">
              <h1 className="font-display text-3xl tracking-wide text-ghost leading-none">{titles[tab] || 'Athletes'}</h1>
              <p className="font-sans text-muted text-sm mt-1.5">{blurbs[tab] || ''}</p>
            </div>
            {tab === 'overview'
              ? <Overview userId={userId} setTab={setTab} />
              : tab === 'league'
                ? <LeaderBoard />
                : tab === 'challenges'
                  ? <ChallengeManager userId={userId} />
                  : tab === 'bonus'
                    ? <ParentPayouts userId={userId} />
                    : <ParentAthletes userId={userId} wide />}
          </div>
        </main>
      </div>
      {showProfile && <ProfileSheet profile={profile} userId={userId} isParent={true} onClose={() => setShowProfile(false)} />}
      {showGuide && <GuideSheet isParent={true} onClose={() => setShowGuide(false)} />}
    </div>
  );
}

/* ---------- Overview dashboard (desktop landing) ---------- */
function StatTile({ label, value, color, onClick }) {
  const Cmp = onClick ? 'button' : 'div';
  return (
    <Cmp onClick={onClick} className={`text-left bg-panel rounded-2xl p-4 w-full ${onClick ? 'hover:bg-white/5 transition-colors' : ''}`}>
      <div className="font-display text-3xl leading-none truncate" style={{ color }}>{value}</div>
      <div className="font-sans text-muted uppercase tracking-wider mt-1.5" style={{ fontSize: '10px' }}>{label}</div>
    </Cmp>
  );
}

function Overview({ userId, setTab }) {
  const active = useActiveChallenge();
  const [board, setBoard] = useState([]);
  const [claimed, setClaimed] = useState([]);
  const [kids, setKids] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data: ks } = await supabase.from('profiles').select('id, full_name, hero_color, codename, sport').eq('role', 'kid');
    setKids(ks || []);
    const { data: lb } = await supabase.rpc('get_leaderboard');
    setBoard(lb || []);
    let cq = supabase.from('bonuses').select('id, kid_id, label, amount, status').eq('status', 'claimed').order('amount', { ascending: false });
    if (active && active.challenge) cq = cq.eq('challenge_id', active.challenge.id);
    const { data: cb } = await cq;
    setClaimed(cb || []);
    setLoading(false);
  };
  useEffect(() => { if (active) load(); }, [active]);

  if (!active || loading) return <p className="font-sans text-muted text-sm">Loading overview…</p>;
  if (!active.challenge) return <ChallengeBreak isParent />;

  const dailyMax = active.tasks.length;
  const weeklyMax = dailyMax * 7;
  const kidById = (id) => kids.find(k => k.id === id) || {};
  const totalPayout = board.reduce((s, r) => s + Number(r.allowance || 0) + ((r.rank === 1 && r.week_points > 0) ? Number(r.champion_bonus || 0) : 0), 0);
  const champ = board.find(r => r.rank === 1 && r.week_points > 0);

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 mb-7">
        <StatTile label="Projected payout this week" value={`$${totalPayout}`} color="#FFC23C" />
        <StatTile label={`Power-up${claimed.length === 1 ? '' : 's'} to review`} value={claimed.length} color="#29E0FF" onClick={claimed.length ? () => setTab('bonus') : undefined} />
        <StatTile label="Week's champion" value={champ ? champ.full_name.split(' ')[0] : '—'} color="#46E5A0" />
      </div>

      <p className="font-sans text-xs font-bold uppercase tracking-widest mb-2 text-muted">Athletes</p>
      <div className="grid grid-cols-3 gap-3 mb-7">
        {board.map(r => {
          const k = kidById(r.kid_id);
          const color = r.hero_color || k.hero_color || '#FFC23C';
          const name = k.full_name || r.full_name || 'Athlete';
          const pct = weeklyMax ? Math.min(100, Math.round(r.week_points / weeklyMax * 100)) : 0;
          return (
            <button key={r.kid_id} onClick={() => setTab('main')} className="text-left bg-panel rounded-2xl p-4 hover:bg-white/5 transition-colors" style={{ borderLeft: `4px solid ${color}` }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center font-display text-ink text-lg shrink-0" style={{ background: color }}>{name[0]}</div>
                <div className="min-w-0">
                  <div className="font-display text-base tracking-wide leading-none truncate" style={{ color }}>{name}</div>
                  <div className="font-sans text-muted" style={{ fontSize: '10px' }}>Rank #{r.rank} · {r.week_points} pts</div>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-raised overflow-hidden mb-2"><div style={{ width: `${pct}%`, background: color, height: '100%' }} /></div>
              <div className="flex items-baseline justify-between">
                <span className="font-display text-xl" style={{ color }}>${r.allowance || 0}</span>
                <span className="font-sans text-muted" style={{ fontSize: '10px' }}>{pct}% of week</span>
              </div>
            </button>
          );
        })}
      </div>

      <p className="font-sans text-xs font-bold uppercase tracking-widest mb-2 text-muted">Needs your attention</p>
      {claimed.length === 0
        ? <div className="bg-panel rounded-2xl p-5 text-center"><p className="font-sans text-muted text-sm">All caught up — no power-ups waiting for review.</p></div>
        : <div className="bg-panel rounded-2xl p-2">
          {claimed.map(b => {
            const k = kidById(b.kid_id);
            const color = k.hero_color || '#FFC23C';
            return (
              <div key={b.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                <span className="font-sans text-sm text-ghost flex-1 min-w-0 truncate">{b.label} <span className="text-muted">· {(k.full_name || '').split(' ')[0]}</span></span>
                <span className="font-display text-base shrink-0" style={{ color }}>${b.amount}</span>
              </div>
            );
          })}
          <button onClick={() => setTab('bonus')} className="w-full mt-1 px-3 py-2.5 rounded-xl font-sans text-xs font-bold" style={{ background: '#29E0FF', color: '#0B0B0F' }}>Review in Payouts →</button>
        </div>}
    </div>
  );
}

function TabBar({ isParent, tab, setTab, color, attn = { payouts: 0 } }) {
  const tabs = isParent
    ? [{ id: 'main', label: 'Athletes', Icon: Users }, { id: 'league', label: 'League', Icon: Trophy }, { id: 'bonus', label: 'Payouts', Icon: Wallet }, { id: 'challenges', label: 'Challenges', Icon: Calendar }]
    : [{ id: 'main', label: 'My Day', Icon: ListChecks }, { id: 'league', label: 'League', Icon: Trophy }, { id: 'bonus', label: 'Power-Ups', Icon: Zap }];
  return (
    <div className="fixed bottom-0 inset-x-0 z-30 bg-panel border-t border-white/10"
      style={{ boxShadow: '0 -10px 30px -16px rgba(0,0,0,0.9)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="max-w-md mx-auto flex items-stretch px-2 pt-1.5 pb-1">
        {tabs.map(({ id, label, Icon }) => {
          const active = (tab === 'overview' ? 'main' : tab) === id;
          const badge = id === 'bonus' ? attn.payouts : 0;
          return (
            <button key={id} onClick={() => setTab(id)} aria-current={active ? 'page' : undefined}
              className="group flex-1 flex flex-col items-center gap-1 py-1.5 outline-none">
              <span className="relative flex items-center justify-center rounded-xl transition-colors duration-200"
                style={{
                  width: 46, height: 30,
                  background: active ? color : 'transparent',
                }}>
                <Icon size={active ? 21 : 20} strokeWidth={active ? 2.6 : 2}
                  color={active ? '#0B0B0F' : '#9A9CB0'} />
                {badge > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center"
                    style={{ background: '#FF3D7F', color: '#0B0B0F', fontSize: '10px', fontWeight: 700 }} aria-label={`${badge} need attention`}>
                    <span className="absolute inset-0 rounded-full animate-ping" style={{ background: '#FF3D7F', opacity: 0.45 }} />
                    <span className="relative">{badge}</span>
                  </span>
                )}
              </span>
              <span className="font-sans text-[11px] leading-none transition-colors duration-200"
                style={{ color: active ? color : '#9A9CB0', fontWeight: active ? 700 : 500 }}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Login ---------- */
/* ---------- Password field with show/hide ---------- */
function PasswordInput({ value, onChange, placeholder, onKeyDown, autoFocus }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative w-full mb-3">
      <input className="w-full px-4 py-3 pr-11 rounded-xl bg-panel text-ghost placeholder-muted outline-none border border-transparent focus:border-cyan"
        type={show ? 'text' : 'password'} placeholder={placeholder} value={value} onChange={onChange}
        onKeyDown={onKeyDown} autoFocus={autoFocus} autoCapitalize="off" autoCorrect="off" spellCheck={false} />
      <button type="button" tabIndex={-1} onClick={() => setShow(s => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ghost">
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

function Login() {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true); setErr('');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw });
    if (error) setErr(error.message);
    setBusy(false);
  };
  return (
    <Centered>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <Shield className="text-cyan mb-3" size={36} />
          <h1 className="font-display text-5xl tracking-wider text-cyan">Petras League</h1>
          <p className="font-sans text-muted text-sm mt-1">Sign in to your HQ</p>
        </div>
        <input className="w-full mb-3 px-4 py-3 rounded-xl bg-panel text-ghost placeholder-muted outline-none border border-transparent focus:border-cyan"
          type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
          autoCapitalize="none" autoCorrect="off" spellCheck={false} inputMode="email" />
        <PasswordInput placeholder="Password" value={pw} onChange={e => setPw(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()} />
        {err && <p className="text-magenta text-sm mb-3">{err}</p>}
        <button onClick={submit} disabled={busy} className="w-full py-3 rounded-xl bg-cyan text-ink font-sans font-bold disabled:opacity-50">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </div>
    </Centered>
  );
}

/* ---------- First-login password change ---------- */
function SetPassword({ session, onDone }) {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (pw.length < 6) { setErr('Use at least 6 characters.'); return; }
    if (pw !== pw2) { setErr('Passwords do not match.'); return; }
    setBusy(true); setErr('');
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) { setErr(error.message); setBusy(false); return; }
    await supabase.from('profiles').update({ must_change_password: false }).eq('id', session.user.id);
    const { data } = await supabase.from('profiles')
      .select('full_name, role, hero_color, codename, sport, must_change_password')
      .eq('id', session.user.id).single();
    setBusy(false); onDone(data);
  };
  return (
    <Centered>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <Lock className="text-cyan mb-3" size={32} />
          <h1 className="font-display text-4xl tracking-wider text-cyan text-center">Set your password</h1>
          <p className="font-sans text-muted text-sm mt-2 text-center">First time in — pick a password only you know.</p>
        </div>
        <PasswordInput placeholder="New password" value={pw} onChange={e => setPw(e.target.value)} />
        <PasswordInput placeholder="Confirm new password" value={pw2} onChange={e => setPw2(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()} />
        {err && <p className="text-magenta text-sm mb-3">{err}</p>}
        <button onClick={submit} disabled={busy} className="w-full py-3 rounded-xl bg-cyan text-ink font-sans font-bold disabled:opacity-50">
          {busy ? 'Saving…' : 'Save and enter'}
        </button>
      </div>
    </Centered>
  );
}

/* ---------- 7-day points strip (Athletes dashboard) ---------- */
function WeekStrip({ points, color, onSelectDay, selectedDate, dailyMax = 10, tiers, animateIn = false, startDelay = 0 }) {
  const dates = weekDates();
  const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const todayIdx = (new Date().getDay() + 6) % 7;
  const [grown, setGrown] = useState(!animateIn);
  useEffect(() => {
    if (!animateIn) { setGrown(true); return; }
    setGrown(false);
    const t = setTimeout(() => setGrown(true), startDelay + 30);
    return () => clearTimeout(t);
  }, [animateIn, startDelay]);
  const vals = dates.map(d => points[d] || 0);
  const total = vals.reduce((a, b) => a + b, 0);
  const weeklyMax = dailyMax * 7;
  const projected = Math.round((total / (todayIdx + 1)) * 7);
  const pace = allowanceFromTiers(projected, weeklyMax, tiers);
  const interactive = !!onSelectDay;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-sans text-xs text-muted">This week · <span className="text-ghost font-bold">{total}/{weeklyMax}</span></span>
        <span className="font-sans text-xs" style={{ color: pace > 0 ? color : '#9A9CB0' }}>
          {total === 0 ? 'No points yet' : pace > 0 ? 'On track' : 'Below pace'}
        </span>
      </div>
      <div className="flex items-end gap-1.5 h-10">
        {vals.map((v, i) => {
          const future = i > todayIdx;
          const isToday = i === todayIdx;
          const isSel = selectedDate === dates[i];
          const targetH = future ? 8 : Math.max(8, (v / Math.max(1, dailyMax)) * 100);
          const h = grown ? targetH : 0;
          const bar = (
            <div className="w-full rounded" style={{
              height: `${h}%`,
              background: future ? '#20212B' : color,
              opacity: future ? 1 : isToday ? 1 : 0.5,
              boxShadow: isSel ? `0 0 0 2px #F4F5FA` : isToday ? `0 0 0 1.5px ${color}` : 'none',
              transition: animateIn ? 'height .4s cubic-bezier(.2,.8,.2,1)' : 'none',
              transitionDelay: animateIn ? `${i * 70}ms` : '0ms',
            }} />
          );
          return interactive
            ? <button key={i} onClick={() => onSelectDay(dates[i])} disabled={future} className="flex-1 h-full flex items-end disabled:cursor-default">{bar}</button>
            : <div key={i} className="flex-1 h-full flex items-end">{bar}</div>;
        })}
      </div>
      <div className="flex gap-1.5 mt-1">
        {labels.map((l, i) => {
          const isSel = selectedDate === dates[i];
          const isToday = i === todayIdx;
          const future = i > todayIdx;
          return (
            <div key={i} className="flex-1 flex flex-col items-center leading-none">
              <span className="font-sans" style={{ fontSize: '10px', color: isSel ? '#F4F5FA' : isToday ? color : '#9A9CB0', fontWeight: isSel ? 700 : 400 }}>{l}</span>
              <span className="font-sans mt-0.5" style={{ fontSize: '9px', color: isSel ? '#F4F5FA' : '#6E7080', fontWeight: isSel ? 700 : 400,
                opacity: grown ? 1 : 0, transition: 'opacity .3s ease', transitionDelay: animateIn ? `${i * 70 + 120}ms` : '0ms' }}>
                {future ? '–' : `${vals[i]}/${dailyMax}`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- League / leaderboard ---------- */
function LeaderBoard() {
  const [view, setView] = useState('week');
  const [week, setWeek] = useState(null);
  const [summer, setSummer] = useState(null);

  useEffect(() => {
    (async () => {
      const { data: wk } = await supabase.rpc('get_leaderboard');
      setWeek(wk || []);
      const { data: sm } = await supabase.rpc('get_summer_standings');
      setSummer(sm || []);
    })();
  }, []);

  if (week === null) return <p className="font-sans text-muted text-sm">Loading the league…</p>;

  return (
    <div>
      <div className="flex gap-1 mb-4 p-1 bg-panel rounded-xl">
        {[['week', 'This week'], ['summer', 'Summer']].map(([id, label]) => (
          <button key={id} onClick={() => setView(id)} className="flex-1 py-2 rounded-lg font-sans text-sm font-bold transition"
            style={{ background: view === id ? '#29E0FF' : 'transparent', color: view === id ? '#0B0B0F' : '#9A9CB0' }}>
            {label}
          </button>
        ))}
      </div>
      {view === 'week' ? <WeekStandings rows={week} /> : <SummerStandings rows={summer} />}
    </div>
  );
}

function WeekStandings({ rows }) {
  if (!rows.length) return <p className="font-sans text-muted text-sm">No standings yet — check off some missions!</p>;
  return (
    <div>
      <h2 className="font-display text-2xl tracking-wide text-ghost mb-1">This week's standings</h2>
      <p className="font-sans text-muted text-xs mb-5">Most points wins · champion takes +$20</p>
      <div className="grid gap-3">
        {rows.map(r => {
          const champ = r.rank === 1 && r.week_points > 0;
          const pct = Math.min(100, (r.week_points / 70) * 100);
          const total = r.allowance + (champ ? r.champion_bonus : 0);
          return (
            <div key={r.kid_id} className="relative bg-panel rounded-2xl p-4 flex items-center gap-3"
              style={{ boxShadow: champ ? `0 0 0 1.5px ${r.hero_color}, 0 10px 34px -10px ${r.hero_color}` : 'none' }}>
              <div className="w-7 flex justify-center shrink-0">
                {champ ? <Crown size={22} className="crown-drop" style={{ color: '#FFC23C' }} /> : <span className="font-display text-2xl text-muted">{r.rank}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center font-display text-ink text-base shrink-0" style={{ background: r.hero_color }}>{r.full_name[0]}</div>
                  <p className="font-sans font-bold text-ghost truncate">{r.full_name}</p>
                  {champ && <span className="font-display text-xs px-2 py-0.5 rounded-full" style={{ background: '#FFC23C', color: '#0B0B0F' }}>Champ</span>}
                </div>
                <div className="h-2 rounded-full bg-raised overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: r.hero_color }} />
                </div>
                <p className="font-sans text-muted text-xs mt-1">{r.week_points} / 70 points{r.dad_bonus ? ` · +${r.dad_bonus} Dad` : ''}</p>
              </div>
              <div className="flex flex-col items-center shrink-0 w-14">
                <MoneyBag amount={total} max={70} color={r.hero_color} />
                <p className="font-display text-lg leading-none" style={{ color: r.hero_color }}>${total}</p>
                {champ && r.champion_bonus > 0 && <p className="font-sans text-muted" style={{ fontSize: '10px' }}>incl +${r.champion_bonus}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SummerStandings({ rows }) {
  if (rows === null) return <p className="font-sans text-muted text-sm">Loading summer…</p>;
  const maxTotal = Math.max(1, ...rows.map(r => r.total_points));
  return (
    <div>
      <h2 className="font-display text-2xl tracking-wide text-ghost mb-1">Summer championship</h2>
      <p className="font-sans text-muted text-xs mb-4">Season-long points · highest weekly average takes the crown</p>
      <div className="grid gap-3">
        {!rows.length
          ? <p className="font-sans text-muted text-sm">No season points yet.</p>
          : rows.map(r => {
              const champ = r.rank === 1 && r.total_points > 0;
              const pct = Math.min(100, (r.total_points / maxTotal) * 100);
              return (
                <div key={r.kid_id} className="relative bg-panel rounded-2xl p-4 flex items-center gap-3"
                  style={{ boxShadow: champ ? `0 0 0 1.5px ${r.hero_color}, 0 10px 34px -10px ${r.hero_color}` : 'none' }}>
                  <div className="w-7 flex justify-center shrink-0">
                    {champ ? <Crown size={22} className="crown-drop" style={{ color: '#FFC23C' }} /> : <span className="font-display text-2xl text-muted">{r.rank}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center font-display text-ink text-base shrink-0" style={{ background: r.hero_color }}>{r.full_name[0]}</div>
                      <p className="font-sans font-bold text-ghost truncate">{r.full_name}</p>
                      {champ && <span className="font-display text-xs px-2 py-0.5 rounded-full" style={{ background: '#FFC23C', color: '#0B0B0F' }}>Summer champ</span>}
                    </div>
                    <div className="h-2 rounded-full bg-raised overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: r.hero_color }} />
                    </div>
                    <p className="font-sans text-muted text-xs mt-1">{r.total_points} pts over {r.weeks_elapsed} wk{r.weeks_elapsed > 1 ? 's' : ''}</p>
                  </div>
                  <div className="flex flex-col items-center shrink-0 w-14">
                    <p className="font-display text-3xl leading-none" style={{ color: r.hero_color }}>{r.avg_points}</p>
                    <p className="font-sans text-muted" style={{ fontSize: '10px' }}>avg/wk</p>
                  </div>
                </div>
              );
            })}
      </div>
    </div>
  );
}

/* ---------- Kid power-ups (claim flow + two bags) ---------- */
function KidPowerUps({ profile, userId }) {
  const [bonuses, setBonuses] = useState(null);
  const [proofs, setProofs] = useState({});
  const [busy, setBusy] = useState(null);
  const active = useActiveChallenge();
  const celebrate = useCelebrate();
  const load = async () => {
    let bq = supabase.from('bonuses').select('id, label, amount, status').eq('kid_id', userId).order('amount');
    if (active && active.challenge) bq = bq.eq('challenge_id', active.challenge.id);
    const { data } = await bq;
    setBonuses(data || []);
    const { data: pr } = await supabase.from('proofs').select('ref_id, storage_path').eq('ref_type', 'bonus');
    const m = {}; (pr || []).forEach(r => { m[r.ref_id] = r.storage_path; });
    setProofs(m);
  };
  useEffect(() => { if (active) load(); }, [active]);

  const claim = async (b) => {
    if (b.status === 'verified' || b.status === 'paid') return;
    const next = b.status === 'claimed' ? 'locked' : 'claimed';
    if (next === 'claimed') celebrate({ color: profile.hero_color });
    setBonuses(bs => bs.map(x => x.id === b.id ? { ...x, status: next } : x));
    await supabase.from('bonuses').update({ status: next }).eq('id', b.id);
    await load();
  };

  const uploadProof = async (b, file) => {
    if (!file) return;
    setBusy(b.id);
    const existing = proofs[b.id];
    if (existing) {
      await supabase.storage.from('proofs').remove([existing]);
      await supabase.from('proofs').delete().eq('ref_type', 'bonus').eq('ref_id', b.id);
    }
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${userId}/bonus/${b.id}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('proofs').upload(path, file, { upsert: true, contentType: file.type });
    if (!error) {
      await supabase.from('proofs').insert({ kid_id: userId, ref_type: 'bonus', ref_id: b.id, storage_path: path });
    }
    await load();
    setBusy(null);
  };

  if (!active || bonuses === null) return <p className="font-sans text-muted text-sm">Loading your power-ups…</p>;
  if (!active.challenge) return <ChallengeBreak />;
  if (!bonuses.length) return <p className="font-sans text-muted text-sm">No power-ups set up yet.</p>;

  const possible = bonuses.reduce((s, b) => s + Number(b.amount), 0);
  const pending = bonuses.filter(b => b.status === 'claimed').reduce((s, b) => s + Number(b.amount), 0);
  const approved = bonuses.filter(b => b.status === 'verified' || b.status === 'paid').reduce((s, b) => s + Number(b.amount), 0);

  return (
    <div>
      <h2 className="font-display text-2xl tracking-wide text-ghost mb-1">Power-ups</h2>
      <p className="font-sans text-muted text-xs mb-4">Tap a goal when you hit it. Add a screenshot as proof. A parent confirms before it pays out.</p>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-panel rounded-2xl p-3 flex items-center gap-2">
          <MoneyBag amount={pending} max={Math.max(1, possible)} color={profile.hero_color} ghost />
          <div>
            <p className="font-display text-2xl leading-none text-muted">${pending}</p>
            <p className="font-sans text-muted" style={{ fontSize: '11px' }}>claimed · pending</p>
          </div>
        </div>
        <div className="bg-panel rounded-2xl p-3 flex items-center gap-2" style={{ borderLeft: `4px solid ${profile.hero_color}` }}>
          <MoneyBag amount={approved} max={Math.max(1, possible)} color={profile.hero_color} />
          <div>
            <p className="font-display text-2xl leading-none" style={{ color: profile.hero_color }}>${approved}</p>
            <p className="font-sans text-muted" style={{ fontSize: '11px' }}>approved</p>
          </div>
        </div>
      </div>
      <div className="grid gap-2">
        {bonuses.map(b => {
          const earned = b.status === 'verified' || b.status === 'paid';
          const claimed = b.status === 'claimed';
          const hasProof = !!proofs[b.id];
          return (
            <div key={b.id} className={`rounded-xl ${earned || claimed ? 'bg-raised' : 'bg-panel opacity-90'}`}
              style={{ boxShadow: earned ? `0 0 0 1px ${profile.hero_color}` : claimed ? '0 0 0 1px #FFC23C' : 'none' }}>
              <button onClick={() => claim(b)} disabled={earned} className="flex items-center gap-3 text-left p-3 w-full">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: earned ? profile.hero_color : 'transparent', border: claimed ? '2px dashed #FFC23C' : earned ? 'none' : '2px solid #3a3a46' }}>
                  {earned ? <Zap size={18} className="text-ink" /> : claimed ? <Check size={16} style={{ color: '#FFC23C' }} /> : <Lock size={15} className="text-muted" />}
                </div>
                <div className="flex-1">
                  <p className="font-sans text-sm text-ghost">{b.label}</p>
                  <p className="font-sans text-xs" style={{ color: earned ? profile.hero_color : claimed ? '#FFC23C' : '#9A9CB0' }}>
                    {b.status === 'paid' ? 'Paid out' : b.status === 'verified' ? 'Earned!' : claimed ? 'Claimed · waiting on a parent' : 'Tap when you hit this'}
                  </p>
                </div>
                <p className="font-display text-lg" style={{ color: earned ? profile.hero_color : claimed ? '#FFC23C' : '#9A9CB0' }}>${Number(b.amount)}</p>
              </button>
              <div className="px-3 pb-3 flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-panel text-xs font-sans cursor-pointer" style={{ color: profile.hero_color, border: `1px solid ${profile.hero_color}55` }}>
                  <Paperclip size={13} /> {busy === b.id ? 'Uploading…' : hasProof ? 'Replace proof' : 'Add proof'}
                  <input type="file" accept="image/*" className="hidden" disabled={busy === b.id} onChange={e => uploadProof(b, e.target.files && e.target.files[0])} />
                </label>
                {hasProof && <ProofThumb path={proofs[b.id]} />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Parent bonus verification ---------- */
function ParentPayouts({ userId }) {
  const [board, setBoard] = useState([]);
  const [bonuses, setBonuses] = useState([]);
  const [proofs, setProofs] = useState({});
  const [loading, setLoading] = useState(true);
  const [burst, setBurst] = useState(null);
  const celebrate = useCelebrate();
  const prevClaimedRef = useRef(0);
  useEffect(() => {
    const c = bonuses.filter(b => b.status === 'claimed').length;
    if (prevClaimedRef.current > 0 && c === 0) celebrate({ word: 'ALL CLEAR!', color: '#46E5A0' });
    prevClaimedRef.current = c;
  }, [bonuses]);
  const [managing, setManaging] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newTarget, setNewTarget] = useState('all');
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editLabel, setEditLabel] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [confirmId, setConfirmId] = useState(null);
  const active = useActiveChallenge();

  const load = async () => {
    const { data: lb } = await supabase.rpc('get_leaderboard');
    setBoard(lb || []);
    let bq = supabase.from('bonuses').select('id, kid_id, label, amount, status').order('amount');
    if (active && active.challenge) bq = bq.eq('challenge_id', active.challenge.id);
    const { data: bs } = await bq;
    setBonuses(bs || []);
    const { data: pr } = await supabase.from('proofs').select('ref_id, storage_path').eq('ref_type', 'bonus');
    const m = {}; (pr || []).forEach(r => { m[r.ref_id] = r.storage_path; });
    setProofs(m);
    setLoading(false);
  };
  useEffect(() => { if (active) load(); }, [active]);

  const addPowerUp = async () => {
    const label = newLabel.trim();
    const amount = Number(newAmount);
    if (!label || !amount || !active || !active.challenge) return;
    setAdding(true);
    const targets = newTarget === 'all' ? board.map(k => k.kid_id) : [newTarget];
    const rows = targets.map(kid_id => ({ kid_id, label, amount, status: 'locked', challenge_id: active.challenge.id }));
    await supabase.from('bonuses').insert(rows);
    setNewLabel(''); setNewAmount(''); setNewTarget('all');
    await load();
    setAdding(false);
  };

  const saveEdit = async (b) => {
    const label = editLabel.trim();
    const amount = Number(editAmount);
    if (!label || !amount) return;
    await supabase.from('bonuses').update({ label, amount }).eq('id', b.id);
    setEditId(null);
    await load();
  };

  const deletePowerUp = async (b) => {
    const path = proofs[b.id];
    if (path) await supabase.storage.from('proofs').remove([path]);
    await supabase.from('proofs').delete().eq('ref_type', 'bonus').eq('ref_id', b.id);
    await supabase.from('bonuses').delete().eq('id', b.id);
    setConfirmId(null);
    await load();
  };

  const setStatus = async (b, status) => {
    const stamp = (status === 'verified' || status === 'paid');
    await supabase.from('bonuses').update({
      status, verified_by: stamp ? userId : null, verified_at: stamp ? new Date().toISOString() : null,
    }).eq('id', b.id);
    if (status === 'paid') celebrate({ word: 'CHA-CHING!', color: '#FFC23C' });
    await load();
  };

  const fireBurst = (color) => {
    const word = ACTION_WORDS[Math.floor(Math.random() * ACTION_WORDS.length)];
    const key = Date.now() + Math.random();
    setBurst({ word, color, key });
    setTimeout(() => setBurst(cur => (cur && cur.key === key ? null : cur)), 850);
  };

  if (!active || loading) return <p className="font-sans text-muted text-sm">Loading payouts…</p>;
  if (!active.challenge) return <ChallengeBreak isParent />;
  const weeklyMax = active.tasks.length * 7;
  const claimedCount = bonuses.filter(b => b.status === 'claimed').length;

  return (
    <div>
      {burst && <ComicBurst keyId={burst.key} word={burst.word} color={burst.color} />}
      <p className="font-sans text-muted text-sm mb-1">Weekly allowance is automatic from approved points. Power-ups need your sign-off.</p>
      <p className="font-sans text-sm mb-5" style={{ color: claimedCount ? '#FFC23C' : '#9A9CB0' }}>
        {claimedCount ? `${claimedCount} power-up${claimedCount > 1 ? 's' : ''} claimed and waiting on you.` : 'No power-ups waiting for review.'}
      </p>
      {board.map(kid => {
        const champ = kid.rank === 1 && kid.week_points > 0 ? kid.champion_bonus : 0;
        const weekTotal = kid.allowance + champ;
        const list = bonuses.filter(b => b.kid_id === kid.kid_id && b.status !== 'locked');
        return (
          <div key={kid.kid_id} className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded flex items-center justify-center font-display text-ink text-sm" style={{ background: kid.hero_color }}>{kid.full_name[0]}</div>
              <p className="font-display text-lg tracking-wide" style={{ color: kid.hero_color }}>{kid.full_name}</p>
            </div>

            <div className="bg-panel rounded-2xl p-4 mb-2 flex items-center gap-3" style={{ borderLeft: `4px solid ${kid.hero_color}` }}>
              <MoneyBag amount={weekTotal} max={70} color={kid.hero_color} />
              <div className="flex-1">
                <p className="font-sans text-xs uppercase tracking-wider text-muted">This week's allowance</p>
                <p className="font-display text-2xl leading-none" style={{ color: kid.hero_color }}>${weekTotal}</p>
                <p className="font-sans text-muted text-xs">{kid.week_points}/{weeklyMax} points{champ > 0 ? ` · incl +$${champ} champion` : ''}</p>
              </div>
            </div>

            {list.length === 0 ? (
              <p className="font-sans text-muted text-xs px-1">No power-ups to review.</p>
            ) : (
              <div className="grid gap-2">
                {list.map(b => {
                  const claimed = b.status === 'claimed';
                  return (
                    <div key={b.id} className="bg-panel rounded-xl p-3" style={{ boxShadow: claimed ? '0 0 0 1.5px #FFC23C' : 'none' }}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex-1">
                          <p className="font-sans text-sm text-ghost">{b.label}</p>
                          <p className="font-sans text-xs flex items-center gap-1" style={{ color: (b.status === 'paid' || b.status === 'verified') ? '#46E5A0' : claimed ? '#FFC23C' : '#9A9CB0' }}>
                            {claimed && <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#FFC23C' }} />}
                            {b.status === 'paid' ? 'Paid' : b.status === 'verified' ? 'Verified · ready to pay' : 'Claimed — needs review'}
                          </p>
                        </div>
                        <p className="font-display text-base ml-2" style={{ color: kid.hero_color }}>${Number(b.amount)}</p>
                      </div>
                      {proofs[b.id]
                        ? <div className="mb-2"><ProofThumb path={proofs[b.id]} /></div>
                        : <p className="font-sans text-muted mb-2" style={{ fontSize: '11px' }}>No proof attached.</p>}
                      <div className="flex gap-2">
                        {claimed && (
                          <>
                            <button onClick={() => { fireBurst(kid.hero_color); setStatus(b, 'verified'); }} className="flex-1 py-1.5 rounded-lg font-sans text-xs font-bold" style={{ background: '#46E5A0', color: '#0B0B0F' }}>Verify</button>
                            <button onClick={() => setStatus(b, 'locked')} className="py-1.5 px-3 rounded-lg font-sans text-xs bg-raised text-muted">Send back</button>
                          </>
                        )}
                        {b.status === 'verified' && (
                          <>
                            <button onClick={() => setStatus(b, 'paid')} className="flex-1 py-1.5 rounded-lg font-sans text-xs font-bold bg-cyan text-ink">Mark paid</button>
                            <button onClick={() => setStatus(b, 'claimed')} className="py-1.5 px-3 rounded-lg font-sans text-xs bg-raised text-muted">Undo</button>
                          </>
                        )}
                        {b.status === 'paid' && (
                          <>
                            <span className="flex-1 py-1.5 rounded-lg font-sans text-xs font-bold text-center bg-raised" style={{ color: '#46E5A0' }}>Paid ✓</span>
                            <button onClick={() => setStatus(b, 'verified')} className="py-1.5 px-3 rounded-lg font-sans text-xs bg-raised text-muted">Undo</button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <div className="mt-2 border-t border-white/10 pt-4">
        <button onClick={() => setManaging(m => !m)} className="flex items-center justify-between w-full">
          <span className="font-display text-lg tracking-wide text-ghost">Manage power-ups</span>
          <span className="font-sans text-xs px-2 py-1 rounded-lg bg-raised text-muted">{managing ? 'Done' : 'Edit list'}</span>
        </button>

        {managing && (
          <div className="mt-3">
            <div className="bg-panel rounded-xl p-3 mb-4">
              <p className="font-sans text-xs uppercase tracking-wider text-muted mb-2 flex items-center gap-1"><Plus size={13} /> Add a power-up</p>
              <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="e.g. WHOOP recovery 70%+"
                className="w-full mb-2 rounded-lg bg-raised text-ghost text-sm p-2 outline-none border border-transparent focus:border-cyan placeholder-muted" />
              <div className="flex gap-2 mb-2">
                <div className="relative w-24">
                  <span className="absolute left-2.5 top-2 font-sans text-muted text-sm">$</span>
                  <input value={newAmount} onChange={e => setNewAmount(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" placeholder="5"
                    className="w-full rounded-lg bg-raised text-ghost text-sm p-2 pl-6 outline-none border border-transparent focus:border-cyan placeholder-muted" />
                </div>
                <select value={newTarget} onChange={e => setNewTarget(e.target.value)}
                  className="flex-1 rounded-lg bg-raised text-ghost text-sm p-2 outline-none border border-transparent focus:border-cyan">
                  <option value="all">All athletes</option>
                  {board.map(k => <option key={k.kid_id} value={k.kid_id}>{k.full_name}</option>)}
                </select>
              </div>
              <button onClick={addPowerUp} disabled={!newLabel.trim() || !newAmount || adding}
                className="w-full py-2 rounded-lg font-sans text-sm font-bold bg-cyan text-ink disabled:opacity-40">{adding ? 'Adding…' : 'Add power-up'}</button>
            </div>

            {board.map(kid => {
              const list = bonuses.filter(b => b.kid_id === kid.kid_id);
              return (
                <div key={kid.kid_id} className="mb-4">
                  <p className="font-display tracking-wide mb-2" style={{ color: kid.hero_color }}>{kid.full_name}</p>
                  {list.length === 0
                    ? <p className="font-sans text-muted text-xs">No power-ups yet.</p>
                    : <div className="grid gap-1.5">
                        {list.map(b => editId === b.id ? (
                          <div key={b.id} className="bg-panel rounded-lg p-2 flex items-center gap-2">
                            <input value={editLabel} onChange={e => setEditLabel(e.target.value)}
                              className="flex-1 min-w-0 rounded-md bg-raised text-ghost text-sm p-1.5 outline-none border border-transparent focus:border-cyan" />
                            <div className="relative w-16 shrink-0">
                              <span className="absolute left-1.5 top-1.5 font-sans text-muted text-xs">$</span>
                              <input value={editAmount} onChange={e => setEditAmount(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric"
                                className="w-full rounded-md bg-raised text-ghost text-sm p-1.5 pl-4 outline-none border border-transparent focus:border-cyan" />
                            </div>
                            <button onClick={() => saveEdit(b)} className="px-2 py-1 rounded-md font-sans text-xs font-bold bg-cyan text-ink shrink-0">Save</button>
                            <button onClick={() => setEditId(null)} className="px-1.5 text-muted shrink-0">✕</button>
                          </div>
                        ) : (
                          <div key={b.id} className="bg-panel rounded-lg px-2 py-1.5 flex items-center gap-2">
                            <span className="font-sans text-ghost text-sm flex-1 min-w-0 truncate">{b.label}</span>
                            {b.status !== 'locked' && <span className="font-sans" style={{ fontSize: '10px', color: '#9A9CB0' }}>{b.status}</span>}
                            <span className="font-display text-sm shrink-0" style={{ color: kid.hero_color }}>${Number(b.amount)}</span>
                            <button onClick={() => { setConfirmId(null); setEditId(b.id); setEditLabel(b.label); setEditAmount(String(b.amount)); }} className="text-muted shrink-0 p-1"><Pencil size={14} /></button>
                            {confirmId === b.id ? (
                              <span className="flex items-center gap-1.5 shrink-0">
                                <button onClick={() => deletePowerUp(b)} className="font-sans text-xs font-bold" style={{ color: '#FF4D5E' }}>Delete</button>
                                <button onClick={() => setConfirmId(null)} className="font-sans text-xs text-muted">No</button>
                              </span>
                            ) : (
                              <button onClick={() => setConfirmId(b.id)} className="text-muted shrink-0 p-1"><Trash2 size={14} /></button>
                            )}
                          </div>
                        ))}
                      </div>}
                </div>
              );
            })}
            <p className="font-sans text-muted" style={{ fontSize: '11px' }}>New power-ups start locked until a kid claims them. Editing the price of an already-earned power-up changes what it pays.</p>
          </div>
        )}
      </div>
    </div>
  );
}
/* ---------- Day drilldown (loads + edits one kid's one day) ---------- */
function DayPanel({ kidId, date, hero_color, role, userId, onChanged, tasks = [] }) {
  const [entry, setEntry] = useState(undefined); // undefined = loading, null = no entry
  const [done, setDone] = useState({});
  const [tproofs, setTproofs] = useState({});
  const [busyTask, setBusyTask] = useState(null);
  const isToday = date === todayKey();
  const celebrate = useCelebrate();

  const load = async () => {
    const { data: de } = await supabase.from('daily_entries').select('id, status').eq('kid_id', kidId).eq('entry_date', date).maybeSingle();
    if (de) {
      const { data: ets } = await supabase.from('entry_tasks').select('task_key, completed').eq('entry_id', de.id);
      const dmap = {}; (ets || []).forEach(r => { if (r.completed) dmap[r.task_key] = true; });
      const { data: pr } = await supabase.from('proofs').select('ref_id, storage_path').eq('ref_type', 'task');
      const pmap = {}; (pr || []).forEach(r => { pmap[r.ref_id] = r.storage_path; });
      setDone(dmap); setTproofs(pmap); setEntry(de);
    } else {
      setDone({}); setTproofs({}); setEntry(null);
    }
  };
  useEffect(() => { load(); }, [kidId, date]);

  const canEdit = role === 'parent' ? true : isToday;

  const toggleTask = async (key) => {
    if (!canEdit) return;
    const newVal = !done[key];
    const after = { ...done, [key]: newVal };
    setDone(after);
    if (role === 'kid' && newVal && tasks.length > 0 && tasks.every(t => after[t.task_key])) {
      celebrate({ word: 'POW!', color: hero_color });
    }
    let e = entry;
    if (!e) {
      const { data } = await supabase.from('daily_entries').upsert({ kid_id: kidId, entry_date: date }, { onConflict: 'kid_id,entry_date' }).select('id, status').single();
      e = data; setEntry(e);
    }
    await supabase.from('entry_tasks').upsert({ entry_id: e.id, task_key: key, completed: newVal }, { onConflict: 'entry_id,task_key' });
    onChanged && onChanged();
  };

  const uploadProofTask = async (key, file) => {
    if (!file || !entry) return;
    setBusyTask(key);
    const ref = `${entry.id}:${key}`;
    const existing = tproofs[ref];
    if (existing) {
      await supabase.storage.from('proofs').remove([existing]);
      await supabase.from('proofs').delete().eq('ref_type', 'task').eq('ref_id', ref);
    }
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${userId}/task/${entry.id}-${key}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('proofs').upload(path, file, { upsert: true, contentType: file.type });
    if (!error) await supabase.from('proofs').insert({ kid_id: userId, ref_type: 'task', ref_id: ref, storage_path: path });
    await load();
    setBusyTask(null);
  };

  if (entry === undefined) return <p className="font-sans text-muted text-xs mt-3 pt-3 border-t border-white/10">Loading {dayName(date)}…</p>;
  const pts = tasks.filter(t => done[t.task_key]).length;
  const phone = phoneStatus(pts, tasks.length);

  return (
    <div className="mt-3 pt-3 border-t border-white/10">
      <div className="flex items-center justify-between mb-2">
        <p className="font-sans text-xs uppercase tracking-wider text-muted">{dayLabelFull(date)} · {pts}/{tasks.length}</p>
        <span className="font-sans text-xs" style={{ color: toneColor(phone.tone) }}>{phone.label}</span>
      </div>
      {!entry && <p className="font-sans text-muted text-xs mb-2">No check-in for this day{canEdit ? ' yet.' : '.'}</p>}
      <div className="grid gap-1.5">
        {tasks.map(t => {
          const checked = !!done[t.task_key];
          const ref = entry ? `${entry.id}:${t.task_key}` : null;
          const hasProof = ref && !!tproofs[ref];
          const kidCanUpload = role === 'kid' && canEdit && checked;
          const showProofView = hasProof && (role !== 'kid' || !canEdit);
          return (
            <div key={t.task_key} className="rounded-lg bg-raised">
              <button onClick={() => toggleTask(t.task_key)} disabled={!canEdit} className="flex items-center gap-2 text-left px-2 py-1.5 w-full">
                <span key={checked ? 'on' : 'off'} className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${checked ? 'check-pop' : ''}`}
                  style={{ background: checked ? hero_color : 'transparent', border: `2px solid ${checked ? hero_color : '#3a3a46'}` }}>
                  {checked && <Check size={12} strokeWidth={4} className="text-ink" />}
                </span>
                <span className="font-sans text-ghost text-sm flex-1">{t.label}</span>
                {hasProof && <Paperclip size={12} style={{ color: hero_color }} />}
                <span className="font-sans text-muted text-xs">{t.category}</span>
              </button>
              {kidCanUpload && (
                <div className="px-2 pb-2 flex flex-wrap items-center gap-2">
                  <label className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-sans cursor-pointer" style={{ color: hero_color, border: `1px solid ${hero_color}55` }}>
                    <Paperclip size={12} /> {busyTask === t.task_key ? 'Uploading…' : hasProof ? 'Replace' : 'Add proof'}
                    <input type="file" accept="image/*" className="hidden" disabled={busyTask === t.task_key} onChange={e => uploadProofTask(t.task_key, e.target.files && e.target.files[0])} />
                  </label>
                  {hasProof && <ProofThumb path={tproofs[ref]} />}
                </div>
              )}
              {showProofView && <div className="px-2 pb-2"><ProofThumb path={tproofs[ref]} /></div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Parent Athletes: merged per-kid hub ---------- */
function ParentAthletes({ userId, wide }) {
  const [kids, setKids] = useState([]);
  const [board, setBoard] = useState([]);
  const [weekPts, setWeekPts] = useState({});
  const [bonuses, setBonuses] = useState([]);
  const [bonusProofs, setBonusProofs] = useState({});
  const [notes, setNotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [reveal, setReveal] = useState(false);
  const [streaks, setStreaks] = useState({});
  const weekStart = weekDates()[0];
  const active = useActiveChallenge();

  const load = async () => {
    const { data: ks } = await supabase.from('profiles').select('id, full_name, hero_color, sport, codename').eq('role', 'kid');
    setKids(ks || []);
    const since = ymdOf((() => { const d = new Date(); d.setDate(d.getDate() - 34); return d; })());
    const { data: sdes } = await supabase.from('daily_entries').select('kid_id, entry_date').gte('entry_date', since);
    const setsByKid = {};
    (sdes || []).forEach(e => { (setsByKid[e.kid_id] = setsByKid[e.kid_id] || new Set()).add(e.entry_date); });
    const sk = {}; (ks || []).forEach(k => { sk[k.id] = streakFromDates(setsByKid[k.id]); });
    setStreaks(sk);
    const { data: lb } = await supabase.rpc('get_leaderboard');
    setBoard(lb || []);
    const wk = weekDates();
    let wq = supabase.from('daily_entries').select('id, kid_id, entry_date, status').gte('entry_date', wk[0]);
    if (active && active.challenge) wq = wq.eq('challenge_id', active.challenge.id);
    const { data: wdes } = await wq;
    const ids = (wdes || []).map(e => e.id);
    const cByEntry = {};
    if (ids.length) {
      const { data: wets } = await supabase.from('entry_tasks').select('entry_id, completed').in('entry_id', ids);
      (wets || []).forEach(r => { if (r.completed) cByEntry[r.entry_id] = (cByEntry[r.entry_id] || 0) + 1; });
    }
    const wp = {}; (wdes || []).forEach(e => { (wp[e.kid_id] = wp[e.kid_id] || {})[e.entry_date] = cByEntry[e.id] || 0; });
    setWeekPts(wp);
    let bq = supabase.from('bonuses').select('id, kid_id, label, amount, status, verified_at').order('amount');
    if (active && active.challenge) bq = bq.eq('challenge_id', active.challenge.id);
    const { data: bs } = await bq;
    setBonuses(bs || []);
    const { data: bpr } = await supabase.from('proofs').select('ref_id, storage_path').eq('ref_type', 'bonus');
    const bpmap = {}; (bpr || []).forEach(r => { bpmap[r.ref_id] = r.storage_path; });
    setBonusProofs(bpmap);
    const { data: wr } = await supabase.from('weekly_reports').select('kid_id, parent_note').eq('week_start', weekStart);
    const nmap = {}; (wr || []).forEach(r => { nmap[r.kid_id] = r.parent_note; });
    setNotes(nmap);
    setLoading(false);
  };
  useEffect(() => { if (active) load(); }, [active]);
  useEffect(() => {
    if (!loading && active && active.challenge && REVEAL_SESSION !== REVEAL_SHOWN) {
      REVEAL_SHOWN = REVEAL_SESSION;
      setReveal(true);
      const t = setTimeout(() => setReveal(false), 4000);
      return () => clearTimeout(t);
    }
  }, [loading]);

  const saveNote = async (kid, text, boardRow) => {
    await supabase.from('weekly_reports').upsert({
      kid_id: kid.id, week_start: weekStart, parent_note: text,
      total_points: boardRow ? boardRow.week_points : 0,
      allowance: boardRow ? boardRow.allowance : 0,
      champion_rank: boardRow ? boardRow.rank : null,
      champion_bonus: (boardRow && boardRow.rank === 1 && boardRow.week_points > 0) ? boardRow.champion_bonus : 0,
    }, { onConflict: 'kid_id,week_start' });
    await load();
  };

  if (!active || loading) return <p className="font-sans text-muted text-sm">Loading athletes…</p>;
  if (!active.challenge) return <ChallengeBreak isParent />;
  const renderCard = (row) => {
    const kid = kids.find(k => k.id === row.kid_id) || { id: row.kid_id, full_name: row.full_name, hero_color: row.hero_color };
    const gi = board.indexOf(row);
    return <ParentAthleteCard key={row.kid_id} kid={kid} board={row} weekPts={weekPts[row.kid_id] || {}}
      bonuses={bonuses.filter(b => b.kid_id === row.kid_id)} bonusProofs={bonusProofs}
      note={notes[row.kid_id] || ''} userId={userId} tasks={active.tasks} tiers={active.tiers}
      revealDelay={reveal ? gi * 650 : null}
      streak={streaks[row.kid_id] || 0}
      onSaveNote={(text) => saveNote(kid, text, row)} onChanged={load} />;
  };
  let body;
  if (wide) {
    // distribute into two independently-flowing columns, balanced by estimated height,
    // so uneven power-up counts don't leave grid row-alignment gaps
    const cols = [[], []]; const h = [0, 0];
    board.forEach(row => {
      const est = 1 + bonuses.filter(b => b.kid_id === row.kid_id).length * 0.22;
      const c = h[0] <= h[1] ? 0 : 1; cols[c].push(row); h[c] += est;
    });
    body = (
      <div className="grid grid-cols-2 gap-x-4 items-start">
        {cols.map((colRows, i) => <div key={i}>{colRows.map(renderCard)}</div>)}
      </div>
    );
  } else {
    body = board.map(renderCard);
  }
  return (
    <div>
      <div className="mb-4">
        <p className="font-display text-lg tracking-wide" style={{ color: '#FFC23C' }}>{active.challenge.name}</p>
        <p className="font-sans text-muted text-xs">Tap any day in a strip to review or fix a check-in.</p>
      </div>
      {body}
    </div>
  );
}

function ChallengeBreak({ isParent }) {
  return (
    <div className="bg-panel rounded-2xl p-6 text-center" style={{ borderLeft: '4px solid #FFC23C' }}>
      <p className="font-display text-xl tracking-wide text-ghost mb-1">On a break</p>
      <p className="font-sans text-muted text-sm">{isParent ? 'No challenge is running right now. Create one in the manager to start scoring days again.' : 'No challenge is running right now — enjoy the time off! Check back when the next one starts.'}</p>
    </div>
  );
}

function StreakFlame({ streak }) {
  if (!streak || streak < 3) return null;
  const t = streak >= 30 ? { c: '#7CC5FF', s: 16 } : streak >= 14 ? { c: '#FF3D3D', s: 15 } : streak >= 7 ? { c: '#FF7A1A', s: 14 } : { c: '#FFA53C', s: 13 };
  return (
    <span className="flame-flicker inline-flex items-center gap-0.5 shrink-0" title={`${streak}-day check-in streak`}>
      <Flame size={t.s} style={{ color: t.c }} />
      <span className="font-display" style={{ color: t.c, fontSize: '12px' }}>{streak}</span>
    </span>
  );
}

function ParentAthleteCard({ kid, board, weekPts, bonuses, bonusProofs, note, userId, onSaveNote, onChanged, tasks = [], tiers, revealDelay = null, streak = 0 }) {
  const [selDay, setSelDay] = useState(null);
  const [draft, setDraft] = useState(note || '');
  const [saving, setSaving] = useState(false);
  useEffect(() => { setDraft(note || ''); }, [note]);
  const weekStart = weekDates()[0];
  const today = todayKey();
  const dailyMax = tasks.length;
  const todayPts = weekPts[today] || 0;
  const phone = phoneStatus(todayPts, dailyMax);

  const champ = board && board.rank === 1 && board.week_points > 0;
  const allowance = board ? board.allowance : 0;
  const champBonus = champ ? board.champion_bonus : 0;
  const weekEarned = (bonuses || []).filter(b => (b.status === 'verified' || b.status === 'paid') && b.verified_at && b.verified_at.slice(0, 10) >= weekStart);
  const powerTotal = weekEarned.reduce((s, b) => s + Number(b.amount), 0);
  const grand = allowance + champBonus + powerTotal;

  const paceVals = weekDates().map(d => weekPts[d] || 0);
  const paceTotal = paceVals.reduce((a, b) => a + b, 0);
  const paceTodayIdx = (new Date().getDay() + 6) % 7;
  const paceProjected = Math.round((paceTotal / (paceTodayIdx + 1)) * 7);
  const pace = allowanceFromTiers(paceProjected, dailyMax * 7, tiers);
  const nt = pace > 0 ? null : nextTier(paceTotal, dailyMax * 7, tiers);

  const animating = revealDelay != null;
  const [prog, setProg] = useState(animating ? 0 : 1);
  useEffect(() => {
    if (!animating) { setProg(1); return; }
    let raf, t0;
    const tick = (ts) => { if (!t0) t0 = ts; const p = Math.min(1, (ts - t0) / 700); setProg(p); if (p < 1) raf = requestAnimationFrame(tick); };
    const to = setTimeout(() => { raf = requestAnimationFrame(tick); }, revealDelay);
    return () => { clearTimeout(to); if (raf) cancelAnimationFrame(raf); };
  }, [revealDelay]);
  const shownGrand = Math.round(grand * prog);

  const save = async () => { setSaving(true); await onSaveNote(draft); setSaving(false); };

  return (
    <div className="bg-panel rounded-2xl p-4 mb-4" style={{ borderLeft: `4px solid ${kid.hero_color}` }}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center font-display text-ink text-lg" style={{ background: kid.hero_color }}>{kid.full_name[0]}</div>
        <div className="flex-1">
          <p className="font-display text-lg tracking-wide leading-none" style={{ color: kid.hero_color }}>{kid.full_name}</p>
          <p className="font-sans" style={{ fontSize: '11px', color: toneColor(phone.tone) }}>{phone.label} · today {todayPts}/{dailyMax}</p>
        </div>
        <StreakFlame streak={streak} />
        {champ && <span className="crown-drop font-display text-xs px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: '#FFC23C', color: '#0B0B0F' }}><Crown size={12} /> Champ</span>}
      </div>

      <div className="flex items-center gap-3 mb-3 bg-raised rounded-xl p-3">
        <MoneyBag amount={shownGrand} max={Math.max(70, grand)} color={kid.hero_color} />
        <div className="flex-1">
          <p className="font-display text-3xl leading-none" style={{ color: kid.hero_color }}>${shownGrand}</p>
          <p className="font-sans text-muted" style={{ fontSize: '11px' }}>allowance ${allowance}{champBonus ? ` · champ +$${champBonus}` : ''}{powerTotal ? ` · power-ups +$${powerTotal}` : ''}</p>
          {pace > 0 && (
            <p className="font-sans flex items-center gap-1 mt-0.5" style={{ fontSize: '11px', fontWeight: 600, color: kid.hero_color }}>
              <TrendingUp size={11} /> On pace for ${pace} this week
            </p>
          )}
          {pace === 0 && nt && (
            <p className="font-sans flex items-center gap-1 mt-0.5" style={{ fontSize: '11px', fontWeight: 600, color: kid.hero_color }}>
              <TrendingUp size={11} /> {nt.ptsNeeded} pts to unlock ${nt.amount}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="font-sans text-muted" style={{ fontSize: '10px' }}>Rank</p>
          <p className="font-display text-xl leading-none" style={{ color: kid.hero_color }}>#{board ? board.rank : '—'}</p>
        </div>
      </div>

      <WeekStrip points={weekPts} color={kid.hero_color} dailyMax={dailyMax} tiers={tiers} animateIn={animating} startDelay={revealDelay || 0} onSelectDay={(d) => setSelDay(s => s === d ? null : d)} selectedDate={selDay} />
      <p className="font-sans text-muted mt-1.5" style={{ fontSize: '10px' }}>{selDay ? 'Tap the day again to close.' : 'Tap a day to review or fix that check-in.'}</p>

      {selDay && <DayPanel kidId={kid.id} date={selDay} hero_color={kid.hero_color} role="parent" userId={userId} onChanged={onChanged} tasks={tasks} />}

      {bonuses.length > 0 && (
        <div className="mt-4">
          <p className="font-sans text-xs font-bold uppercase tracking-widest mb-2 text-muted">Power-ups</p>
          <div className="grid gap-1.5">
            {bonuses.map(b => {
              const earned = b.status === 'verified' || b.status === 'paid';
              const claimed = b.status === 'claimed';
              const bpath = bonusProofs[b.id];
              return (
                <div key={b.id} className="rounded-lg bg-raised px-2 py-1.5">
                  <div className="flex items-center gap-2">
                    <Zap size={13} style={{ color: earned ? kid.hero_color : claimed ? '#FFC23C' : '#9A9CB0' }} />
                    <span className="font-sans text-ghost text-sm flex-1">{b.label}</span>
                    <span className="font-sans text-xs" style={{ color: earned ? '#46E5A0' : claimed ? '#FFC23C' : '#9A9CB0' }}>{b.status === 'paid' ? 'Paid' : b.status === 'verified' ? 'Verified' : claimed ? 'Claimed' : 'Locked'}</span>
                    <span className="font-display text-sm" style={{ color: kid.hero_color }}>${Number(b.amount)}</span>
                  </div>
                  {bpath
                    ? <div className="mt-1.5"><ProofThumb path={bpath} /></div>
                    : b.status !== 'locked' && <p className="font-sans text-muted mt-1.5" style={{ fontSize: '11px' }}>No proof attached.</p>}
                </div>
              );
            })}
          </div>
          <p className="font-sans text-muted mt-2" style={{ fontSize: '11px' }}>Verify and pay these in the Payouts tab.</p>
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-white/10">
        <p className="font-sans text-xs uppercase tracking-wider text-muted mb-1">Coach's note</p>
        <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={2} placeholder="A word for this week…"
          className="w-full rounded-lg bg-raised text-ghost text-sm p-2 outline-none border border-transparent focus:border-cyan placeholder-muted resize-none" />
        <button onClick={save} disabled={saving || draft === (note || '')} className="mt-2 px-3 py-1.5 rounded-lg font-sans text-xs font-bold bg-cyan text-ink disabled:opacity-40">{saving ? 'Saving…' : 'Save note'}</button>
      </div>
    </div>
  );
}

/* ---------- Kid Athletes: own merged card ---------- */
function KidAthletes({ profile, userId }) {
  const [board, setBoard] = useState(null);
  const [weekPts, setWeekPts] = useState({});
  const [bonuses, setBonuses] = useState([]);
  const [bonusProofs, setBonusProofs] = useState({});
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  const weekStart = weekDates()[0];
  const active = useActiveChallenge();

  const load = async () => {
    const { data: lb } = await supabase.rpc('get_leaderboard');
    setBoard((lb || []).find(r => r.kid_id === userId) || null);
    const since = ymdOf((() => { const d = new Date(); d.setDate(d.getDate() - 34); return d; })());
    const { data: sdes } = await supabase.from('daily_entries').select('entry_date').eq('kid_id', userId).gte('entry_date', since);
    setStreak(streakFromDates(new Set((sdes || []).map(e => e.entry_date))));
    const wk = weekDates();
    let wq = supabase.from('daily_entries').select('id, entry_date').eq('kid_id', userId).gte('entry_date', wk[0]);
    if (active && active.challenge) wq = wq.eq('challenge_id', active.challenge.id);
    const { data: wdes } = await wq;
    const ids = (wdes || []).map(e => e.id);
    const cByEntry = {};
    if (ids.length) {
      const { data: wets } = await supabase.from('entry_tasks').select('entry_id, completed').in('entry_id', ids);
      (wets || []).forEach(r => { if (r.completed) cByEntry[r.entry_id] = (cByEntry[r.entry_id] || 0) + 1; });
    }
    const wp = {}; (wdes || []).forEach(e => { wp[e.entry_date] = cByEntry[e.id] || 0; });
    setWeekPts(wp);
    let bq = supabase.from('bonuses').select('id, label, amount, status, verified_at').eq('kid_id', userId).order('amount');
    if (active && active.challenge) bq = bq.eq('challenge_id', active.challenge.id);
    const { data: bs } = await bq;
    setBonuses(bs || []);
    const { data: bpr } = await supabase.from('proofs').select('ref_id, storage_path').eq('ref_type', 'bonus');
    const bpmap = {}; (bpr || []).forEach(r => { bpmap[r.ref_id] = r.storage_path; });
    setBonusProofs(bpmap);
    const { data: wr } = await supabase.from('weekly_reports').select('parent_note').eq('kid_id', userId).eq('week_start', weekStart).maybeSingle();
    setNote(wr?.parent_note || '');
    setLoading(false);
  };
  useEffect(() => { if (active) load(); }, [active]);

  if (!active || loading) return <p className="font-sans text-muted text-sm">Loading your card…</p>;
  if (!active.challenge) return <ChallengeBreak />;
  return <KidAthleteCard profile={profile} board={board} weekPts={weekPts} bonuses={bonuses} bonusProofs={bonusProofs} note={note} userId={userId} tasks={active.tasks} tiers={active.tiers} streak={streak} onChanged={load} />;
}

function KidAthleteCard({ profile, board, weekPts, bonuses, bonusProofs, note, userId, onChanged, tasks = [], tiers, streak = 0 }) {
  const today = todayKey();
  const [selDay, setSelDay] = useState(today);
  const weekStart = weekDates()[0];
  const dailyMax = tasks.length;
  const todayPts = weekPts[today] || 0;
  const phone = phoneStatus(todayPts, dailyMax);
  const champ = board && board.rank === 1 && board.week_points > 0;
  const allowance = board ? board.allowance : 0;
  const champBonus = champ ? board.champion_bonus : 0;
  const weekEarned = (bonuses || []).filter(b => (b.status === 'verified' || b.status === 'paid') && b.verified_at && b.verified_at.slice(0, 10) >= weekStart);
  const powerTotal = weekEarned.reduce((s, b) => s + Number(b.amount), 0);
  const grand = allowance + champBonus + powerTotal;

  const paceVals = weekDates().map(d => weekPts[d] || 0);
  const paceTotal = paceVals.reduce((a, b) => a + b, 0);
  const paceTodayIdx = (new Date().getDay() + 6) % 7;
  const paceProjected = Math.round((paceTotal / (paceTodayIdx + 1)) * 7);
  const pace = allowanceFromTiers(paceProjected, dailyMax * 7, tiers);
  const nt = pace > 0 ? null : nextTier(paceTotal, dailyMax * 7, tiers);

  return (
    <div className="relative bg-panel rounded-2xl p-4 mb-4" style={{ borderLeft: `4px solid ${profile.hero_color}` }}>
      {dailyMax > 0 && todayPts === dailyMax && <div className="absolute -top-3 -right-2 z-10"><Burst color={profile.hero_color} label="POW!" /></div>}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center font-display text-ink text-lg" style={{ background: profile.hero_color }}>{profile.full_name[0]}</div>
        <div className="flex-1 min-w-0">
          <p className="font-display text-lg tracking-wide leading-none flex items-center gap-1.5" style={{ color: profile.hero_color }}>
            <span className="truncate">{profile.full_name}</span>
            {champ && <Crown size={15} className="crown-drop shrink-0" style={{ color: '#FFC23C' }} />}
            <StreakFlame streak={streak} />
          </p>
          <p className="font-sans" style={{ fontSize: '11px', color: toneColor(phone.tone) }}>{phone.label} · today {todayPts}/{dailyMax}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-3 bg-raised rounded-xl p-3">
        <MoneyBag amount={grand} max={Math.max(70, grand)} color={profile.hero_color} />
        <div className="flex-1">
          <p className="font-display text-3xl leading-none" style={{ color: profile.hero_color }}>${grand}</p>
          <p className="font-sans text-muted" style={{ fontSize: '11px' }}>allowance ${allowance}{champBonus ? ` · champ +$${champBonus}` : ''}{powerTotal ? ` · power-ups +$${powerTotal}` : ''}</p>
          {pace > 0 && (
            <p className="font-sans flex items-center gap-1 mt-0.5" style={{ fontSize: '11px', fontWeight: 600, color: profile.hero_color }}>
              <TrendingUp size={11} /> On pace for ${pace} this week
            </p>
          )}
          {pace === 0 && nt && (
            <p className="font-sans flex items-center gap-1 mt-0.5" style={{ fontSize: '11px', fontWeight: 600, color: profile.hero_color }}>
              <TrendingUp size={11} /> {nt.ptsNeeded} pts to unlock ${nt.amount}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="font-sans text-muted" style={{ fontSize: '10px' }}>Rank</p>
          <p className="font-display text-xl leading-none" style={{ color: profile.hero_color }}>#{board ? board.rank : '—'}</p>
        </div>
      </div>

      <WeekStrip points={weekPts} color={profile.hero_color} dailyMax={dailyMax} tiers={tiers} onSelectDay={(d) => setSelDay(s => s === d ? null : d)} selectedDate={selDay} />
      <p className="font-sans text-muted mt-1.5" style={{ fontSize: '10px' }}>{selDay === today ? 'Check off today below. Saves automatically.' : selDay ? 'Tap the day again to close.' : 'Tap a day to see that check-in.'}</p>

      {selDay && <DayPanel kidId={userId} date={selDay} hero_color={profile.hero_color} role="kid" userId={userId} onChanged={onChanged} tasks={tasks} />}

      {bonuses.length > 0 && (
        <div className="mt-4">
          <p className="font-sans text-xs font-bold uppercase tracking-widest mb-2 text-muted">Power-ups</p>
          <div className="grid gap-1.5">
            {bonuses.map(b => {
              const earned = b.status === 'verified' || b.status === 'paid';
              const claimed = b.status === 'claimed';
              const bpath = bonusProofs[b.id];
              return (
                <div key={b.id} className="rounded-lg bg-raised px-2 py-1.5">
                  <div className="flex items-center gap-2">
                    <Zap size={13} style={{ color: earned ? profile.hero_color : claimed ? '#FFC23C' : '#9A9CB0' }} />
                    <span className="font-sans text-ghost text-sm flex-1">{b.label}</span>
                    <span className="font-sans text-xs" style={{ color: earned ? '#46E5A0' : claimed ? '#FFC23C' : '#9A9CB0' }}>{b.status === 'paid' ? 'Paid' : b.status === 'verified' ? 'Earned!' : claimed ? 'Claimed' : 'Locked'}</span>
                    <span className="font-display text-sm" style={{ color: profile.hero_color }}>${Number(b.amount)}</span>
                  </div>
                  {bpath && <div className="mt-1.5"><ProofThumb path={bpath} /></div>}
                </div>
              );
            })}
          </div>
          <p className="font-sans text-muted mt-2" style={{ fontSize: '11px' }}>Claim these and add proof in the Power-Ups tab.</p>
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-white/10">
        <p className="font-sans text-xs uppercase tracking-wider text-muted mb-1">Coach's note</p>
        <p className="font-sans text-sm" style={{ color: note ? '#F4F5FA' : '#9A9CB0' }}>{note || 'No note yet.'}</p>
      </div>
    </div>
  );
}

/* ---------- Challenge manager (parent) ---------- */
const CAT_OPTIONS = ['Nutrition', 'Recovery', 'Performance', 'Responsibility'];

function ChallengeManager({ userId }) {
  const [familyId, setFamilyId] = useState(null);
  const [challenges, setChallenges] = useState([]);
  const [tasksByCh, setTasksByCh] = useState({});
  const [tiersByCh, setTiersByCh] = useState({});
  const [bonusByCh, setBonusByCh] = useState({});
  const [kids, setKids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [nName, setNName] = useState('');
  const [nStart, setNStart] = useState('');
  const [nEnd, setNEnd] = useState('');
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState('');
  const today = todayKey();

  const load = async () => {
    const { data: prof } = await supabase.from('profiles').select('family_id').eq('id', userId).maybeSingle();
    setFamilyId(prof?.family_id || null);
    const { data: ks } = await supabase.from('profiles').select('id, full_name, hero_color').eq('role', 'kid');
    setKids(ks || []);
    const { data: chs } = await supabase.from('challenges').select('id, name, start_date, end_date').order('start_date');
    setChallenges(chs || []);
    const ids = (chs || []).map(c => c.id);
    const tmap = {}, rmap = {}, bmap = {};
    if (ids.length) {
      const { data: ts } = await supabase.from('challenge_tasks').select('id, challenge_id, task_key, label, category, sort_order').in('challenge_id', ids).order('sort_order');
      (ts || []).forEach(t => { (tmap[t.challenge_id] = tmap[t.challenge_id] || []).push(t); });
      const { data: rt } = await supabase.from('challenge_reward_tiers').select('id, challenge_id, min_percent, amount').in('challenge_id', ids).order('min_percent');
      (rt || []).forEach(r => { (rmap[r.challenge_id] = rmap[r.challenge_id] || []).push(r); });
      const { data: bs } = await supabase.from('bonuses').select('id, challenge_id, kid_id, label, amount, status').in('challenge_id', ids).order('amount');
      (bs || []).forEach(b => { (bmap[b.challenge_id] = bmap[b.challenge_id] || []).push(b); });
    }
    setTasksByCh(tmap); setTiersByCh(rmap); setBonusByCh(bmap);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const statusOf = (c) => today < c.start_date ? { label: 'Upcoming', color: '#29E0FF' }
    : today > c.end_date ? { label: 'Past', color: '#9A9CB0' }
      : { label: 'Active', color: '#46E5A0' };

  const overlaps = (s, e, ignoreId) => challenges.some(c => c.id !== ignoreId && s <= c.end_date && e >= c.start_date);

  const createChallenge = async () => {
    setErr('');
    const name = nName.trim();
    if (!name || !nStart || !nEnd) return;
    if (nEnd < nStart) { setErr('End date must be on or after the start date.'); return; }
    if (overlaps(nStart, nEnd, null)) { setErr('Those dates overlap another challenge. Leave a gap between them.'); return; }
    setCreating(true);
    const { data: ch, error } = await supabase.from('challenges').insert({ family_id: familyId, name, start_date: nStart, end_date: nEnd }).select('id').single();
    if (!error && ch) {
      await supabase.from('challenge_reward_tiers').insert([[70, 10], [80, 20], [85, 30], [90, 40], [100, 50]].map(([min_percent, amount]) => ({ challenge_id: ch.id, min_percent, amount })));
    }
    setNName(''); setNStart(''); setNEnd(''); setShowNew(false); setCreating(false);
    await load();
    if (ch) setExpanded(ch.id);
  };

  if (loading) return <p className="font-sans text-muted text-sm">Loading challenges…</p>;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-display text-2xl tracking-wide text-ghost">Challenges</h2>
        <button onClick={() => { setShowNew(s => !s); setErr(''); }} className="flex items-center gap-1 px-3 py-1.5 rounded-lg font-sans text-sm font-bold" style={{ background: '#29E0FF', color: '#0B0B0F' }}><Plus size={15} /> New</button>
      </div>
      <p className="font-sans text-muted text-xs mb-4">One challenge runs at a time, picked by today's date. Gaps between them are breaks.</p>

      {showNew && (
        <div className="bg-panel rounded-xl p-3 mb-4">
          <p className="font-sans text-xs uppercase tracking-wider text-muted mb-2">New challenge</p>
          <input value={nName} onChange={e => setNName(e.target.value)} placeholder="e.g. Fall Semester" className="w-full mb-2 rounded-lg bg-raised text-ghost text-sm p-2 outline-none border border-transparent focus:border-cyan placeholder-muted" />
          <div className="flex gap-2 mb-2">
            <label className="flex-1 font-sans text-xs text-muted">Start<input type="date" value={nStart} onChange={e => setNStart(e.target.value)} className="w-full mt-1 rounded-lg bg-raised text-ghost text-sm p-2 outline-none border border-transparent focus:border-cyan" /></label>
            <label className="flex-1 font-sans text-xs text-muted">End<input type="date" value={nEnd} onChange={e => setNEnd(e.target.value)} className="w-full mt-1 rounded-lg bg-raised text-ghost text-sm p-2 outline-none border border-transparent focus:border-cyan" /></label>
          </div>
          {err && <p className="font-sans text-xs mb-2" style={{ color: '#FF4D5E' }}>{err}</p>}
          <button onClick={createChallenge} disabled={!nName.trim() || !nStart || !nEnd || creating} className="w-full py-2 rounded-lg font-sans text-sm font-bold disabled:opacity-40" style={{ background: '#29E0FF', color: '#0B0B0F' }}>{creating ? 'Creating…' : 'Create challenge'}</button>
          <p className="font-sans text-muted mt-2" style={{ fontSize: '11px' }}>Starts with the default reward ladder and no tasks — add them below once it's created.</p>
        </div>
      )}

      <div className="grid gap-3">
        {challenges.map(c => {
          const st = statusOf(c);
          const open = expanded === c.id;
          const started = today >= c.start_date;
          return (
            <div key={c.id} className="bg-panel rounded-xl overflow-hidden">
              <button onClick={() => setExpanded(open ? null : c.id)} className="w-full flex items-center gap-3 p-3 text-left">
                <div className="flex-1 min-w-0">
                  <p className="font-display text-lg tracking-wide text-ghost truncate">{c.name}</p>
                  <p className="font-sans text-muted text-xs">{c.start_date} → {c.end_date} · {(tasksByCh[c.id] || []).length} tasks</p>
                </div>
                <span className="font-sans text-xs px-2 py-0.5 rounded-full shrink-0" style={{ background: st.color + '22', color: st.color }}>{st.label}</span>
              </button>
              {open && <ChallengeEditor c={c} started={started}
                tasks={tasksByCh[c.id] || []} tiers={tiersByCh[c.id] || []}
                bonuses={bonusByCh[c.id] || []} kids={kids}
                onChanged={load} overlaps={overlaps} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChallengeEditor({ c, started, tasks, tiers, bonuses, kids, onChanged, overlaps }) {
  const [name, setName] = useState(c.name);
  const [start, setStart] = useState(c.start_date);
  const [end, setEnd] = useState(c.end_date);
  const [savingMeta, setSavingMeta] = useState(false);
  const [metaErr, setMetaErr] = useState('');
  const [tLabel, setTLabel] = useState(''); const [tCat, setTCat] = useState('Nutrition'); const [addingTask, setAddingTask] = useState(false);
  const [editTaskId, setEditTaskId] = useState(null); const [etLabel, setEtLabel] = useState(''); const [etCat, setEtCat] = useState('Nutrition');
  const [delTask, setDelTask] = useState(null);
  const [tierPct, setTierPct] = useState(''); const [tierAmt, setTierAmt] = useState('');
  const [editTierId, setEditTierId] = useState(null); const [etPct, setEtPct] = useState(''); const [etAmt, setEtAmt] = useState('');
  const [puLabel, setPuLabel] = useState(''); const [puAmt, setPuAmt] = useState(''); const [puTarget, setPuTarget] = useState('all'); const [addingPu, setAddingPu] = useState(false);
  const [editPuId, setEditPuId] = useState(null); const [epLabel, setEpLabel] = useState(''); const [epAmt, setEpAmt] = useState('');
  const [delPu, setDelPu] = useState(null);
  const [confirmDelCh, setConfirmDelCh] = useState(false); const [chErr, setChErr] = useState('');

  const genKey = () => 't' + Date.now().toString(36) + Math.floor(Math.random() * 900 + 100);
  const kidName = (id) => (kids.find(k => k.id === id) || {}).full_name || 'Athlete';

  const saveMeta = async () => {
    setMetaErr('');
    if (end < start) { setMetaErr('End must be on or after start.'); return; }
    if (overlaps(start, end, c.id)) { setMetaErr('These dates overlap another challenge.'); return; }
    setSavingMeta(true);
    await supabase.from('challenges').update({ name: name.trim(), start_date: start, end_date: end }).eq('id', c.id);
    setSavingMeta(false);
    await onChanged();
  };

  const addTask = async () => {
    if (!tLabel.trim()) return;
    setAddingTask(true);
    const sort = tasks.reduce((m, t) => Math.max(m, t.sort_order), 0) + 1;
    await supabase.from('challenge_tasks').insert({ challenge_id: c.id, task_key: genKey(), label: tLabel.trim(), category: tCat, sort_order: sort });
    setTLabel(''); setAddingTask(false);
    await onChanged();
  };
  const saveTask = async (t) => { await supabase.from('challenge_tasks').update({ label: etLabel.trim(), category: etCat }).eq('id', t.id); setEditTaskId(null); await onChanged(); };
  const deleteTask = async (t) => { await supabase.from('challenge_tasks').delete().eq('id', t.id); setDelTask(null); await onChanged(); };

  // ----- drag-to-reorder tasks (display order only; safe even after a challenge starts) -----
  const [localTasks, setLocalTasks] = useState(tasks);
  useEffect(() => { setLocalTasks(tasks); }, [tasks]);
  const [dragId, setDragId] = useState(null);
  const tasksRef = useRef(tasks); tasksRef.current = localTasks;
  const rowRefs = useRef({});
  const reorderTo = (clientY) => {
    const list = tasksRef.current;
    let overId = null;
    for (const t of list) {
      const el = rowRefs.current[t.id];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (clientY >= r.top && clientY <= r.bottom) { overId = t.id; break; }
    }
    if (!overId || overId === dragId) return;
    setLocalTasks(prev => {
      const from = prev.findIndex(t => t.id === dragId);
      const to = prev.findIndex(t => t.id === overId);
      if (from < 0 || to < 0 || from === to) return prev;
      const next = prev.slice();
      const [m] = next.splice(from, 1);
      next.splice(to, 0, m);
      return next;
    });
  };
  useEffect(() => {
    if (!dragId) return;
    const move = (e) => { e.preventDefault(); reorderTo(e.clientY); };
    const up = async () => {
      setDragId(null);
      const ordered = tasksRef.current;
      const changed = ordered
        .map((t, i) => ({ id: t.id, sort_order: i }))
        .filter(u => { const o = tasks.find(t => t.id === u.id); return o && o.sort_order !== u.sort_order; });
      for (const u of changed) await supabase.from('challenge_tasks').update({ sort_order: u.sort_order }).eq('id', u.id);
      if (changed.length) await onChanged();
    };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up, { once: true });
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, [dragId]); // eslint-disable-line react-hooks/exhaustive-deps

  const addTier = async () => {
    const p = Number(tierPct), a = Number(tierAmt);
    if (!p || tierAmt === '' || isNaN(a)) return;
    await supabase.from('challenge_reward_tiers').upsert({ challenge_id: c.id, min_percent: p, amount: a }, { onConflict: 'challenge_id,min_percent' });
    setTierPct(''); setTierAmt(''); await onChanged();
  };
  const saveTier = async (r) => { await supabase.from('challenge_reward_tiers').update({ min_percent: Number(etPct), amount: Number(etAmt) }).eq('id', r.id); setEditTierId(null); await onChanged(); };
  const deleteTier = async (r) => { await supabase.from('challenge_reward_tiers').delete().eq('id', r.id); await onChanged(); };

  const addPowerUp = async () => {
    const label = puLabel.trim(); const amount = Number(puAmt);
    if (!label || !amount) return;
    setAddingPu(true);
    const targets = puTarget === 'all' ? kids.map(k => k.id) : [puTarget];
    await supabase.from('bonuses').insert(targets.map(kid_id => ({ kid_id, label, amount, status: 'locked', challenge_id: c.id })));
    setPuLabel(''); setPuAmt(''); setPuTarget('all'); setAddingPu(false);
    await onChanged();
  };
  const savePowerUp = async (b) => {
    const label = epLabel.trim(); const amount = Number(epAmt);
    if (!label || !amount) return;
    await supabase.from('bonuses').update({ label, amount }).eq('id', b.id);
    setEditPuId(null); await onChanged();
  };
  const deletePowerUp = async (b) => {
    const { data: pr } = await supabase.from('proofs').select('storage_path').eq('ref_type', 'bonus').eq('ref_id', b.id);
    const paths = (pr || []).map(p => p.storage_path).filter(Boolean);
    if (paths.length) await supabase.storage.from('proofs').remove(paths);
    await supabase.from('proofs').delete().eq('ref_type', 'bonus').eq('ref_id', b.id);
    await supabase.from('bonuses').delete().eq('id', b.id);
    setDelPu(null); await onChanged();
  };

  const deleteChallenge = async () => {
    setChErr('');
    const { error } = await supabase.from('challenges').delete().eq('id', c.id);
    if (error) { setChErr('Can\u2019t delete — this challenge already has check-ins or power-ups tied to it.'); setConfirmDelCh(false); return; }
    await onChanged();
  };

  const metaChanged = name !== c.name || start !== c.start_date || end !== c.end_date;

  return (
    <div className="px-3 pb-4 border-t border-white/10 pt-3">
      <div className="mb-4">
        <input value={name} onChange={e => setName(e.target.value)} className="w-full mb-2 rounded-lg bg-raised text-ghost text-sm p-2 outline-none border border-transparent focus:border-cyan" />
        <div className="flex gap-2 mb-2">
          <input type="date" value={start} onChange={e => setStart(e.target.value)} className="flex-1 min-w-0 rounded-lg bg-raised text-ghost text-sm p-2 outline-none border border-transparent focus:border-cyan" />
          <input type="date" value={end} onChange={e => setEnd(e.target.value)} className="flex-1 min-w-0 rounded-lg bg-raised text-ghost text-sm p-2 outline-none border border-transparent focus:border-cyan" />
        </div>
        {metaErr && <p className="font-sans text-xs mb-2" style={{ color: '#FF4D5E' }}>{metaErr}</p>}
        <button onClick={saveMeta} disabled={savingMeta || !metaChanged} className="px-3 py-1.5 rounded-lg font-sans text-xs font-bold disabled:opacity-40" style={{ background: '#29E0FF', color: '#0B0B0F' }}>{savingMeta ? 'Saving…' : 'Save details'}</button>
      </div>

      <p className="font-sans text-xs font-bold uppercase tracking-widest mb-2 text-muted">Tasks · {tasks.length} pts/day</p>
      {tasks.length > 1 && <p className="font-sans text-muted mb-2" style={{ fontSize: '10.5px' }}>Drag the handle to reorder how tasks appear on the checklist.</p>}
      <div className="grid gap-1.5 mb-2" style={{ userSelect: dragId ? 'none' : 'auto' }}>
        {localTasks.map(t => editTaskId === t.id ? (
          <div key={t.id} className="bg-raised rounded-lg p-2 flex items-center gap-2">
            <input value={etLabel} onChange={e => setEtLabel(e.target.value)} className="flex-1 min-w-0 rounded-md bg-panel text-ghost text-sm p-1.5 outline-none" />
            <select value={etCat} onChange={e => setEtCat(e.target.value)} className="rounded-md bg-panel text-ghost text-xs p-1.5 outline-none">{CAT_OPTIONS.map(o => <option key={o}>{o}</option>)}</select>
            <button onClick={() => saveTask(t)} className="px-2 py-1 rounded-md text-xs font-bold shrink-0" style={{ background: '#29E0FF', color: '#0B0B0F' }}>Save</button>
            <button onClick={() => setEditTaskId(null)} className="px-1 text-muted shrink-0">✕</button>
          </div>
        ) : (
          <div key={t.id}
            ref={el => { rowRefs.current[t.id] = el; }}
            className="bg-raised rounded-lg px-2 py-1.5 flex items-center gap-2 transition-shadow"
            style={dragId === t.id ? { boxShadow: '0 10px 22px -8px rgba(0,0,0,0.85)', outline: '1.5px solid #29E0FF', position: 'relative', zIndex: 10 } : undefined}>
            <button onPointerDown={e => { e.preventDefault(); setDragId(t.id); }}
              className="text-muted hover:text-ghost p-1 -ml-1 shrink-0 cursor-grab active:cursor-grabbing"
              style={{ touchAction: 'none' }} aria-label="Drag to reorder"><GripVertical size={15} /></button>
            <span className="font-sans text-ghost text-sm flex-1 min-w-0 truncate">{t.label}</span>
            <span className="font-sans text-muted text-xs shrink-0">{t.category}</span>
            <button onClick={() => { setEditTaskId(t.id); setEtLabel(t.label); setEtCat(t.category); }} className="text-muted p-1 shrink-0"><Pencil size={13} /></button>
            {!started && (delTask === t.id
              ? <span className="flex items-center gap-1 shrink-0"><button onClick={() => deleteTask(t)} className="text-xs font-bold" style={{ color: '#FF4D5E' }}>Del</button><button onClick={() => setDelTask(null)} className="text-xs text-muted">No</button></span>
              : <button onClick={() => setDelTask(t.id)} className="text-muted p-1 shrink-0"><Trash2 size={13} /></button>)}
          </div>
        ))}
        {tasks.length === 0 && <p className="font-sans text-muted text-xs">No tasks yet.</p>}
      </div>
      {started
        ? <p className="font-sans text-muted mb-4" style={{ fontSize: '11px' }}>This challenge has started — you can rename tasks, but adding or removing them is locked so scores stay fair.</p>
        : <div className="flex gap-2 mb-4">
          <input value={tLabel} onChange={e => setTLabel(e.target.value)} placeholder="New task" className="flex-1 min-w-0 rounded-lg bg-raised text-ghost text-sm p-2 outline-none border border-transparent focus:border-cyan placeholder-muted" />
          <select value={tCat} onChange={e => setTCat(e.target.value)} className="rounded-lg bg-raised text-ghost text-xs p-2 outline-none shrink-0">{CAT_OPTIONS.map(o => <option key={o}>{o}</option>)}</select>
          <button onClick={addTask} disabled={!tLabel.trim() || addingTask} className="px-3 rounded-lg font-sans text-sm font-bold disabled:opacity-40 shrink-0" style={{ background: '#29E0FF', color: '#0B0B0F' }}>Add</button>
        </div>}

      <p className="font-sans text-xs font-bold uppercase tracking-widest mb-2 text-muted">Reward ladder</p>
      <div className="grid gap-1.5 mb-2">
        {tiers.map(r => editTierId === r.id ? (
          <div key={r.id} className="bg-raised rounded-lg p-2 flex items-center gap-2">
            <input value={etPct} onChange={e => setEtPct(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" className="w-14 rounded-md bg-panel text-ghost text-sm p-1.5 outline-none" /><span className="text-muted text-xs">%</span>
            <span className="text-muted">→</span>
            <span className="text-muted text-xs">$</span><input value={etAmt} onChange={e => setEtAmt(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" className="w-14 rounded-md bg-panel text-ghost text-sm p-1.5 outline-none" />
            <button onClick={() => saveTier(r)} className="px-2 py-1 rounded-md text-xs font-bold ml-auto shrink-0" style={{ background: '#29E0FF', color: '#0B0B0F' }}>Save</button>
            <button onClick={() => setEditTierId(null)} className="px-1 text-muted shrink-0">✕</button>
          </div>
        ) : (
          <div key={r.id} className="bg-raised rounded-lg px-2 py-1.5 flex items-center gap-2">
            <span className="font-sans text-ghost text-sm">{r.min_percent}% of the week</span>
            <span className="text-muted">→</span>
            <span className="font-display text-sm" style={{ color: '#29E0FF' }}>${r.amount}</span>
            <button onClick={() => { setEditTierId(r.id); setEtPct(String(r.min_percent)); setEtAmt(String(r.amount)); }} className="text-muted p-1 ml-auto shrink-0"><Pencil size={13} /></button>
            <button onClick={() => deleteTier(r)} className="text-muted p-1 shrink-0"><Trash2 size={13} /></button>
          </div>
        ))}
        {tiers.length === 0 && <p className="font-sans text-muted text-xs">No reward tiers — kids earn $0 until you add some.</p>}
      </div>
      <div className="flex gap-2 mb-4">
        <input value={tierPct} onChange={e => setTierPct(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" placeholder="%" className="w-16 rounded-lg bg-raised text-ghost text-sm p-2 outline-none border border-transparent focus:border-cyan placeholder-muted" />
        <span className="text-muted text-sm self-center">$</span>
        <input value={tierAmt} onChange={e => setTierAmt(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" placeholder="amount" className="flex-1 min-w-0 rounded-lg bg-raised text-ghost text-sm p-2 outline-none border border-transparent focus:border-cyan placeholder-muted" />
        <button onClick={addTier} disabled={!tierPct || tierAmt === ''} className="px-3 rounded-lg font-sans text-sm font-bold disabled:opacity-40 shrink-0" style={{ background: '#29E0FF', color: '#0B0B0F' }}>Add</button>
      </div>

      <p className="font-sans text-xs font-bold uppercase tracking-widest mb-2 text-muted">Power-ups</p>
      <div className="grid gap-1.5 mb-2">
        {bonuses.map(b => editPuId === b.id ? (
          <div key={b.id} className="bg-raised rounded-lg p-2 flex items-center gap-2">
            <input value={epLabel} onChange={e => setEpLabel(e.target.value)} className="flex-1 min-w-0 rounded-md bg-panel text-ghost text-sm p-1.5 outline-none" />
            <span className="text-muted text-xs">$</span><input value={epAmt} onChange={e => setEpAmt(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" className="w-14 rounded-md bg-panel text-ghost text-sm p-1.5 outline-none" />
            <button onClick={() => savePowerUp(b)} className="px-2 py-1 rounded-md text-xs font-bold shrink-0" style={{ background: '#29E0FF', color: '#0B0B0F' }}>Save</button>
            <button onClick={() => setEditPuId(null)} className="px-1 text-muted shrink-0">✕</button>
          </div>
        ) : (
          <div key={b.id} className="bg-raised rounded-lg px-2 py-1.5 flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-sans text-ghost text-sm truncate">{b.label}</p>
              <p className="font-sans text-muted" style={{ fontSize: '10px' }}>{kidName(b.kid_id)}{b.status !== 'locked' ? ` · ${b.status}` : ''}</p>
            </div>
            <span className="font-display text-sm shrink-0" style={{ color: '#FFC23C' }}>${b.amount}</span>
            <button onClick={() => { setEditPuId(b.id); setEpLabel(b.label); setEpAmt(String(b.amount)); }} className="text-muted p-1 shrink-0"><Pencil size={13} /></button>
            {delPu === b.id
              ? <span className="flex items-center gap-1 shrink-0"><button onClick={() => deletePowerUp(b)} className="text-xs font-bold" style={{ color: '#FF4D5E' }}>Del</button><button onClick={() => setDelPu(null)} className="text-xs text-muted">No</button></span>
              : <button onClick={() => setDelPu(b.id)} className="text-muted p-1 shrink-0"><Trash2 size={13} /></button>}
          </div>
        ))}
        {bonuses.length === 0 && <p className="font-sans text-muted text-xs">No power-ups for this challenge yet.</p>}
      </div>
      <div className="bg-raised rounded-lg p-2 mb-4">
        <input value={puLabel} onChange={e => setPuLabel(e.target.value)} placeholder="Power-up (e.g. Hit 3 home runs)" className="w-full mb-2 rounded-md bg-panel text-ghost text-sm p-1.5 outline-none placeholder-muted" />
        <div className="flex gap-2">
          <div className="flex items-center gap-1"><span className="text-muted text-sm">$</span><input value={puAmt} onChange={e => setPuAmt(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" placeholder="amt" className="w-16 rounded-md bg-panel text-ghost text-sm p-1.5 outline-none placeholder-muted" /></div>
          <select value={puTarget} onChange={e => setPuTarget(e.target.value)} className="flex-1 min-w-0 rounded-md bg-panel text-ghost text-xs p-1.5 outline-none">
            <option value="all">All athletes</option>
            {kids.map(k => <option key={k.id} value={k.id}>{k.full_name}</option>)}
          </select>
          <button onClick={addPowerUp} disabled={!puLabel.trim() || !puAmt || addingPu} className="px-3 rounded-md font-sans text-sm font-bold disabled:opacity-40 shrink-0" style={{ background: '#29E0FF', color: '#0B0B0F' }}>Add</button>
        </div>
      </div>

      <div className="border-t border-white/10 pt-3">
        {chErr && <p className="font-sans text-xs mb-2" style={{ color: '#FF4D5E' }}>{chErr}</p>}
        {confirmDelCh
          ? <div className="flex items-center gap-2"><span className="font-sans text-xs text-muted flex-1">Delete this challenge for good?</span><button onClick={deleteChallenge} className="px-3 py-1.5 rounded-lg text-xs font-bold shrink-0" style={{ background: '#FF4D5E', color: '#0B0B0F' }}>Delete</button><button onClick={() => setConfirmDelCh(false)} className="px-3 py-1.5 rounded-lg text-xs bg-raised text-muted shrink-0">Cancel</button></div>
          : <button onClick={() => { setChErr(''); setConfirmDelCh(true); }} className="font-sans text-xs" style={{ color: '#FF4D5E' }}>Delete challenge</button>}
      </div>
    </div>
  );
}

/* ---------- Proof image viewer (signed URL, lazy) ---------- */
function ProofThumb({ path }) {
  const [url, setUrl] = useState(null);
  const [open, setOpen] = useState(false);
  const toggle = async () => {
    if (!url) {
      const { data } = await supabase.storage.from('proofs').createSignedUrl(path, 120);
      if (data?.signedUrl) setUrl(data.signedUrl);
    }
    setOpen(o => !o);
  };
  return (
    <>
      <button onClick={toggle} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-raised text-xs font-sans text-ghost">
        <Eye size={13} /> {open ? 'Hide proof' : 'View proof'}
      </button>
      {open && url && <img src={url} alt="proof" className="w-full max-h-72 object-contain rounded-lg mt-2 bg-raised" />}
    </>
  );
}

/* ---------- Comic flourishes ---------- */
const ACTION_WORDS = ['POW!', 'BAM!', 'KAPOW!', 'BOOM!', 'ZAP!', 'WHAM!', 'BIFF!'];

function ComicBurst({ word, color, keyId }) {
  const spikes = 12, outer = 46, inner = 30, cx = 50, cy = 50;
  let p = '';
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / spikes) * i - Math.PI / 2;
    p += `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)} `;
  }
  return (
    <div key={keyId} className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <style>{`
        @keyframes comicFlash {
          0%{transform:scale(3) rotate(-18deg);opacity:0}
          12%{opacity:1}
          30%{transform:scale(.82) rotate(-4deg)}
          46%{transform:scale(1.1) rotate(-9deg)}
          62%{transform:scale(1) rotate(-6deg);opacity:1}
          82%{transform:scale(1) rotate(-6deg);opacity:1}
          100%{transform:scale(1.18) rotate(-6deg);opacity:0}
        }
        .comic-flash{animation:comicFlash .85s cubic-bezier(.2,1.2,.3,1) both;transform-origin:center}
        @media (prefers-reduced-motion: reduce){ .comic-flash{animation:none;opacity:0} }
      `}</style>
      <div className="comic-flash relative w-44 h-44 flex items-center justify-center">
        <svg viewBox="0 0 100 100" className="w-44 h-44 absolute inset-0">
          <polygon points={p.trim()} fill={color} stroke="#0B0B0F" strokeWidth="2.5" strokeLinejoin="round" />
        </svg>
        <span className="relative font-display text-ink" style={{ fontSize: '40px', letterSpacing: '1px' }}>{word}</span>
      </div>
    </div>
  );
}

function MoneyBag({ amount, max = 70, color, ghost = false }) {
  const [shake, setShake] = useState(false);
  const prev = useRef(amount);
  useEffect(() => {
    if (amount > prev.current) {
      setShake(true);
      const id = setTimeout(() => setShake(false), 650);
      prev.current = amount;
      return () => clearTimeout(id);
    }
    prev.current = amount;
  }, [amount]);
  const pct = Math.max(0, Math.min(1, max ? amount / max : 0));
  const cid = 'bag' + String(color).replace('#', '') + (ghost ? 'g' : '');
  const bag = 'M17 15 Q15 11 18.5 9 L29.5 9 Q33 11 31 15 Q43 23 39 36 Q37 43 24 43 Q11 43 9 36 Q5 23 17 15 Z';
  return (
    <div className={`inline-block ${shake ? 'bag-shake' : ''}`}>
      <style>{`
        @keyframes bagShake {
          0%{transform:rotate(0) scale(1)} 15%{transform:rotate(-9deg) scale(1.1)}
          30%{transform:rotate(8deg) scale(1.07)} 45%{transform:rotate(-6deg) scale(1.05)}
          60%{transform:rotate(4deg) scale(1.03)} 80%{transform:rotate(-2deg) scale(1.01)}
          100%{transform:rotate(0) scale(1)}
        }
        .bag-shake{animation:bagShake .6s cubic-bezier(.36,.07,.19,.97) both}
        @keyframes bagFill{from{transform:scaleY(0)}to{transform:scaleY(1)}}
        .bag-fill{animation:bagFill .55s ease-out both;transform-box:fill-box;transform-origin:50% 100%}
        @media (prefers-reduced-motion: reduce){ .bag-shake,.bag-fill{animation:none} }
      `}</style>
      <svg viewBox="0 0 48 48" className="w-11 h-11">
        <defs><clipPath id={cid}><path d={bag} /></clipPath></defs>
        <path d={bag} fill="#20212B" />
        <rect key={shake ? 'rise' : 'static'} className={shake ? 'bag-fill' : ''} x="0" y={48 - 48 * pct} width="48" height={48 * pct} fill={color} opacity={ghost ? 0.35 : 0.9} clipPath={`url(#${cid})`} />
        <path d={bag} fill="none" stroke={color} strokeWidth="1.6" strokeDasharray={ghost ? '3 3' : '0'} opacity={ghost ? 0.6 : 1} />
        <text x="24" y="32" textAnchor="middle" fontFamily="Bangers, cursive" fontSize="15" fill="#F4F5FA" opacity={ghost ? 0.5 : 0.95}>$</text>
      </svg>
    </div>
  );
}

function Burst({ color = '#FFC23C', label = 'POW!' }) {
  const spikes = 11, outer = 22, inner = 15, cx = 24, cy = 24;
  let p = '';
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / spikes) * i - Math.PI / 2;
    p += `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)} `;
  }
  return (
    <div className="pow-pop relative inline-flex items-center justify-center w-16 h-16">
      <style>{`
        @keyframes powPop {
          0%{transform:scale(3.4) rotate(-16deg);opacity:0} 25%{opacity:1}
          55%{transform:scale(0.78) rotate(-3deg)} 78%{transform:scale(1.14) rotate(-8deg)}
          100%{transform:scale(1) rotate(-6deg);opacity:1}
        }
        .pow-pop{animation:powPop .62s cubic-bezier(.2,1.25,.3,1) both;transform-origin:center}
        @media (prefers-reduced-motion: reduce){ .pow-pop{animation:none} }
      `}</style>
      <svg viewBox="0 0 48 48" className="w-16 h-16"><polygon points={p.trim()} fill={color} /></svg>
      <span className="absolute font-display text-ink" style={{ fontSize: '15px' }}>{label}</span>
    </div>
  );
}

/* ---------- Shared pieces ---------- */
function Centered({ children }) {
  return <div className="min-h-screen bg-ink text-ghost flex items-center justify-center px-6 font-sans">{children}</div>;
}
function TopBar({ name, sub, color, onOpenNav, onOpenProfile, onOpenGuide }) {
  return (
    <div className="flex items-center gap-2 mb-6 pb-5 border-b border-white/10">
      {onOpenNav && (
        <button onClick={onOpenNav} aria-label="Open menu" className="relative text-ghost hover:text-white p-2 -ml-2 shrink-0">
          <Menu size={22} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full" style={{ background: color }} />
        </button>
      )}
      <button onClick={onOpenProfile} className="flex items-center gap-3 flex-1 min-w-0 text-left">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center font-display text-ink text-xl shrink-0" style={{ background: color }}>{name[0]}</div>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-2xl tracking-wide text-ghost leading-none truncate">{name}</h1>
          <p className="font-sans text-muted text-xs uppercase tracking-wider mt-1 truncate">{sub}</p>
        </div>
        <ChevronRight size={18} className="text-muted shrink-0" />
      </button>
      {onOpenGuide && <button onClick={onOpenGuide} className="text-muted hover:text-ghost p-2 shrink-0" aria-label="How it works"><HelpCircle size={18} /></button>}
      <button onClick={() => supabase.auth.signOut()} className="text-muted hover:text-ghost p-2 shrink-0"><LogOut size={18} /></button>
    </div>
  );
}

/* ---------- Hero-card profiles ---------- */
function StarMono({ letter, color, size = 56 }) {
  const spikes = 12, outer = size * 0.46, inner = size * 0.34, cx = size / 2, cy = size / 2;
  let p = '';
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / spikes) * i - Math.PI / 2;
    p += `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)} `;
  }
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size }}><polygon points={p} fill={color} /></svg>
      <span className="absolute inset-0 flex items-center justify-center font-display text-ink" style={{ fontSize: size * 0.4 }}>{letter}</span>
    </div>
  );
}

function Stat({ label, value, sub, color }) {
  return (
    <div className="bg-raised rounded-lg p-2 text-center">
      <p className="font-display text-xl leading-none" style={{ color }}>{value}</p>
      {sub && <p className="font-sans leading-none mt-0.5" style={{ fontSize: '10px', color }}>{sub}</p>}
      <p className="font-sans text-muted mt-1" style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
    </div>
  );
}

function HeroCard({ hero, weeklyMax, big }) {
  const c = hero.hero_color;
  const avg = Number(hero.avg) || 0;
  const powerPct = Math.max(4, Math.min(100, Math.round((avg / (weeklyMax || 70)) * 100)));
  const champ = hero.weekRank === 1 && hero.weekPts > 0;
  return (
    <div className="relative rounded-2xl overflow-hidden" style={{ border: `2px solid ${c}`, background: 'linear-gradient(160deg, #17171F 0%, #0B0B0F 100%)' }}>
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: `radial-gradient(${c}22 1px, transparent 1px)`, backgroundSize: '8px 8px', opacity: 0.5 }} />
      <div className="absolute top-0 right-0" style={{ width: 0, height: 0, borderTop: `70px solid ${c}`, borderLeft: '70px solid transparent', opacity: 0.16 }} />
      <div className="relative p-4">
        <div className="flex items-center gap-3 mb-3">
          <StarMono letter={(hero.codename || hero.full_name)[0]} color={c} size={big ? 64 : 54} />
          <div className="flex-1 min-w-0">
            <p className="font-display tracking-wide leading-none truncate" style={{ color: c, fontSize: big ? '30px' : '23px' }}>{hero.codename || hero.full_name}</p>
            <p className="font-sans text-ghost text-sm truncate">{hero.full_name}</p>
            <p className="font-sans text-muted uppercase tracking-wider" style={{ fontSize: '11px' }}>{hero.sport}</p>
          </div>
          {hero.seasonRank && (
            <div className="text-center shrink-0">
              <div className="font-display text-2xl leading-none flex items-center gap-0.5" style={{ color: c }}>{champ && <Crown size={15} />}#{hero.seasonRank}</div>
              <p className="font-sans text-muted" style={{ fontSize: '9px' }}>SEASON</p>
            </div>
          )}
        </div>
        <div className="mb-3">
          <div className="flex justify-between mb-1">
            <span className="font-sans text-muted" style={{ fontSize: '10px', letterSpacing: '0.05em' }}>POWER LEVEL</span>
            <span className="font-sans" style={{ fontSize: '10px', color: c }}>{avg.toFixed(1)} pts/wk</span>
          </div>
          <div className="h-2 rounded-full bg-raised overflow-hidden"><div className="h-full rounded-full" style={{ width: `${powerPct}%`, background: c }} /></div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Season pts" value={hero.seasonPts} color={c} />
          <Stat label="This week" value={hero.weekPts} sub={`$${hero.allowance + hero.champ}`} color={c} />
          <Stat label="Power-ups" value={`$${hero.powerUps}`} color={c} />
        </div>
      </div>
    </div>
  );
}

function CommanderCard({ name, heroes }) {
  const gold = '#FFC23C';
  const weekPool = heroes.reduce((s, h) => s + h.allowance + h.champ + h.powerUps, 0);
  return (
    <div className="relative rounded-2xl overflow-hidden" style={{ border: `2px solid ${gold}`, background: 'linear-gradient(160deg, #1d1a12 0%, #0B0B0F 100%)' }}>
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: `radial-gradient(${gold}22 1px, transparent 1px)`, backgroundSize: '8px 8px', opacity: 0.5 }} />
      <div className="relative p-4 flex items-center gap-3">
        <StarMono letter={name[0]} color={gold} size={54} />
        <div className="flex-1 min-w-0">
          <p className="font-display text-2xl tracking-wide leading-none truncate" style={{ color: gold }}>{name}</p>
          <p className="font-sans text-muted uppercase tracking-wider" style={{ fontSize: '11px' }}>Commander · Petras League</p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-display text-2xl leading-none" style={{ color: gold }}>${weekPool}</p>
          <p className="font-sans text-muted" style={{ fontSize: '9px' }}>WEEK POOL</p>
        </div>
      </div>
    </div>
  );
}

function ProfileSheet({ profile, userId, isParent, onClose }) {
  const [data, setData] = useState(null);
  const active = useActiveChallenge();
  useEffect(() => {
    (async () => {
      const { data: lb } = await supabase.rpc('get_leaderboard');
      const { data: sm } = await supabase.rpc('get_summer_standings');
      const { data: ks } = await supabase.from('profiles').select('id, full_name, codename, sport, hero_color').eq('role', 'kid');
      const { data: bs } = await supabase.from('bonuses').select('kid_id, amount, status');
      const pu = {}; (bs || []).forEach(b => { if (b.status === 'verified' || b.status === 'paid') pu[b.kid_id] = (pu[b.kid_id] || 0) + Number(b.amount); });
      const lbById = {}; (lb || []).forEach(r => { lbById[r.kid_id] = r; });
      const smById = {}; (sm || []).forEach(r => { smById[r.kid_id] = r; });
      const heroes = (ks || []).map(k => {
        const l = lbById[k.id] || {}, s = smById[k.id] || {};
        return {
          id: k.id, full_name: k.full_name, codename: k.codename, sport: k.sport, hero_color: k.hero_color,
          weekPts: l.week_points || 0, allowance: l.allowance || 0, weekRank: l.rank || null,
          champ: (l.rank === 1 && l.week_points > 0) ? (l.champion_bonus || 0) : 0,
          seasonPts: s.total_points || 0, seasonRank: s.rank || null, avg: s.avg_points || 0,
          powerUps: pu[k.id] || 0,
        };
      }).sort((a, b) => (a.seasonRank || 99) - (b.seasonRank || 99));
      setData({ heroes });
    })();
  }, []);
  const weeklyMax = active && active.challenge ? active.tasks.length * 7 : 70;
  const mine = data ? data.heroes.find(h => h.id === userId) : null;

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto" style={{ background: 'rgba(5,5,8,0.88)', backdropFilter: 'blur(2px)' }}>
      <div className="max-w-md mx-auto px-5 py-6 min-h-full">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl tracking-wide text-ghost">{isParent ? 'Team Roster' : 'My Hero Card'}</h2>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-raised flex items-center justify-center text-muted text-lg leading-none">✕</button>
        </div>
        {!data ? <p className="font-sans text-muted text-sm">Loading…</p>
          : isParent
            ? <div className="grid gap-4"><CommanderCard name={profile.full_name} heroes={data.heroes} />{data.heroes.map(h => <HeroCard key={h.id} hero={h} weeklyMax={weeklyMax} />)}</div>
            : mine ? <HeroCard hero={mine} weeklyMax={weeklyMax} big /> : <p className="font-sans text-muted text-sm">No card yet — check in to start building your stats.</p>}
      </div>
    </div>
  );
}

/* ---------- In-app user guide ---------- */
function GuideSection({ n, title, color, children }) {
  return (
    <div className="bg-panel rounded-2xl p-4 mb-3" style={{ borderLeft: `4px solid ${color}` }}>
      <div className="flex items-baseline gap-2 mb-1.5">
        {n != null && <span className="font-display text-lg leading-none" style={{ color }}>{n}</span>}
        <h3 className="font-display text-lg tracking-wide text-ghost leading-none">{title}</h3>
      </div>
      <div className="font-sans text-sm leading-relaxed" style={{ color: '#D9DAE6' }}>{children}</div>
    </div>
  );
}

function KidGuide() {
  const c = '#29E0FF';
  return (
    <>
      <GuideSection n="1" title="Check in every day" color={c}>
        Open <b>My Day</b> and tap each task as you finish it. Snap a <b>photo</b> as proof when you can. Doing this every day is the whole game.
      </GuideSection>
      <GuideSection n="2" title="Points unlock phone time" color={c}>
        Every task you finish is a point. The more of <b>today's</b> tasks you complete, the more <b>phone time</b> you unlock for the day — your card shows where you stand.
      </GuideSection>
      <GuideSection n="3" title="Your week earns allowance" color={c}>
        Your points across the whole week set your <b>allowance</b>. The closer you get to finishing everything, the bigger the payout — miss days and it drops.
      </GuideSection>
      <GuideSection n="4" title="Be the champion" color={c}>
        Whoever scores the most points in a week is crowned <b>champion</b> and earns a bonus on top. Tap <b>League</b> to see where you rank.
      </GuideSection>
      <GuideSection n="5" title="Claim power-ups" color={c}>
        <b>Power-Ups</b> are special bounties your parents set for big goals. When you hit one, tap to <b>claim</b> it and add proof — they'll verify it and pay out.
      </GuideSection>
      <GuideSection title="How to win" color="#46E5A0">
        Check in <b>every single day</b>, aim to finish <b>all</b> your tasks, and don't skip. Small daily wins stack up fast — consistency beats cramming.
      </GuideSection>
    </>
  );
}

function ParentGuide() {
  const g = '#FFC23C';
  return (
    <>
      <GuideSection n="1" title="Review & approve each day" color={g}>
        In <b>Athletes</b>, tap any day in a kid's week to see their check-ins and proof photos. Fix anything that's off, then <b>approve &amp; lock</b> the day so it counts.
      </GuideSection>
      <GuideSection n="2" title="Pay out" color={g}>
        <b>Allowance</b> is calculated automatically from approved points, plus the champion bonus. In <b>Payouts</b>, claimed <b>power-ups</b> wait for you to <b>verify</b> (with proof) and mark <b>paid</b>.
      </GuideSection>
      <GuideSection n="3" title="Run the season" color={g}>
        In <b>Challenges</b>, build and edit each season — its tasks, the reward ladder, and power-ups. One challenge is active at a time, set by its dates; gaps between them are a "break."
      </GuideSection>
      <GuideSection title="The system (to explain to the kids)" color="#29E0FF">
        One finished task = one point. <b>Daily</b> points unlock that day's phone time, the <b>week's</b> points set allowance, the top scorer wins the <b>champion</b> bonus, and <b>power-ups</b> are extra bounties you set for big goals.
      </GuideSection>
      <GuideSection title="On a computer" color={g}>
        Open the app on a laptop or desktop for the wide <b>command center</b> — an overview dashboard, every athlete side by side, and the same payout and challenge tools. On a phone you get the streamlined app.
      </GuideSection>
    </>
  );
}

function GuideSheet({ isParent, onClose }) {
  return (
    <div className="fixed inset-0 z-40 overflow-y-auto" style={{ background: 'rgba(5,5,8,0.92)', backdropFilter: 'blur(2px)' }}>
      <div className="max-w-md mx-auto px-5 py-6 min-h-full">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display text-2xl tracking-wide text-ghost">How it works</h2>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-raised flex items-center justify-center text-muted text-lg leading-none">✕</button>
        </div>
        <p className="font-sans text-muted text-xs mb-5">{isParent ? 'Your guide to running the Petras League.' : 'Your guide to winning the Petras League.'}</p>
        {isParent ? <ParentGuide /> : <KidGuide />}
        <GuideSection title="Add it to your phone" color="#FF3D7F">
          Keep Petras League one tap away, like a real app:
          <div className="mt-2 grid gap-1.5">
            <div><b>iPhone (Safari):</b> tap <b>Share</b>, then <b>Add to Home Screen</b>.</div>
            <div><b>Android (Chrome):</b> tap the <b>⋮</b> menu, then <b>Add to Home screen</b>.</div>
          </div>
        </GuideSection>
        <p className="font-sans text-muted text-center mt-5 mb-2" style={{ fontSize: '11px' }}>This guide updates as the app improves.</p>
      </div>
    </div>
  );
}
