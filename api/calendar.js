// Petras League — family calendar feed
// Runs on Vercel (server-side), so there are no browser CORS problems.
// It reads the feed URL from an environment variable (ICAL_FEED_URL) so the
// private link never lives in the repo. Fetches Bobby's iCal, expands recurring
// events, and returns clean JSON the app reads at /api/calendar.
import ical from 'node-ical';

export default async function handler(req, res) {
  try {
    let url = process.env.ICAL_FEED_URL;
    if (!url) { res.status(200).json({ events: [] }); return; }            // not configured yet — app just shows challenge/league events
    if (url.startsWith('webcal://')) url = 'https://' + url.slice('webcal://'.length);

    // Fetch with a timeout so a slow feed can't hang the function.
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    let text;
    try {
      const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'PetrasLeague/1.0' } });
      if (!r.ok) { res.status(200).json({ events: [], error: 'feed_status_' + r.status }); return; }
      text = await r.text();
    } finally { clearTimeout(timer); }

    const data = await ical.async.parseICS(text);

    const now = new Date();
    const rangeStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);   // a month back
    const rangeEnd = new Date(now.getFullYear(), now.getMonth() + 4, 0);     // ~4 months ahead
    const TZ = 'America/New_York';
    const fmtDate = (d, allDay) => new Intl.DateTimeFormat('en-CA', { timeZone: allDay ? 'UTC' : TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
    const fmtTime = (d) => new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }).format(d).replace(' ', '').toLowerCase();

    const out = [];
    const push = (ev, start) => {
      const allDay = ev.datetype === 'date';
      const title = (ev.summary || 'Event').toString().trim().slice(0, 80);
      if (title) out.push({ date: fmtDate(start, allDay), time: allDay ? '' : fmtTime(start), title });
    };

    for (const k of Object.keys(data)) {
      const ev = data[k];
      if (!ev || ev.type !== 'VEVENT') continue;
      if (ev.rrule) {
        const occurrences = ev.rrule.between(rangeStart, rangeEnd, true);
        for (const date of occurrences) {
          const key = date.toISOString().slice(0, 10);
          if (ev.exdate && ev.exdate[key]) continue;                        // event was deleted on this date
          if (ev.recurrences && ev.recurrences[key]) {                      // event was moved/edited on this date
            const r = ev.recurrences[key];
            if (r.start >= rangeStart && r.start <= rangeEnd) push(r, r.start);
          } else {
            push(ev, date);
          }
        }
      } else if (ev.start && ev.start >= rangeStart && ev.start <= rangeEnd) {
        push(ev, ev.start);
      }
    }

    const seen = new Set();
    const events = out
      .filter((e) => { const id = e.date + '|' + e.time + '|' + e.title; if (seen.has(id)) return false; seen.add(id); return true; })
      .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));

    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600'); // cache 30 min at the edge so the feed isn't hammered
    res.status(200).json({ events });
  } catch (e) {
    res.status(200).json({ events: [], error: 'feed_unavailable' });         // never break the calendar — just return no family events
  }
}