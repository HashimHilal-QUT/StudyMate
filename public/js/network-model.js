/* Explainable local clustering: no external AI service or inferred personal data. */
(function (root) {
  const normalize = value => String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-AU');
  function sharedSignals(profiles) {
    const counts = new Map();
    profiles.forEach(p => {
      const signals = [
        ...(p.subjects || []).map(label => ({ type: 'subject', label })),
        ...(p.studyStyle ? [{ type: 'style', label: p.studyStyle }] : []),
        ...(p.availability ? [{ type: 'availability', label: p.availability }] : []),
      ];
      const seen = new Set();
      signals.forEach(({ type, label }) => {
        const key = `${type}:${normalize(label)}`;
        if (!normalize(label) || seen.has(key)) return;
        seen.add(key);
        const entry = counts.get(key) || { type, label: String(label).trim(), count: 0, key };
        entry.count++;
        counts.set(key, entry);
      });
    });
    return [...counts.values()].filter(s => s.count > 1)
      .sort((a, b) => b.count - a.count || ['subject', 'style', 'availability'].indexOf(a.type) - ['subject', 'style', 'availability'].indexOf(b.type) || a.key.localeCompare(b.key));
  }
  function clusters(profiles, dimension) {
    const field = dimension === 'university' ? 'university' : 'city';
    const groups = new Map();
    profiles.forEach(p => {
      const label = String(p[field] || '').trim().replace(/\s+/g, ' ') || `${field === 'city' ? 'City' : 'University'} not shared`;
      const key = normalize(label);
      if (!groups.has(key)) groups.set(key, { key, label, profiles: [] });
      groups.get(key).profiles.push(p);
    });
    return [...groups.values()].map(g => ({ ...g,
      profiles: g.profiles.sort((a, b) => a.firstName.localeCompare(b.firstName) || a.id.localeCompare(b.id)),
      signals: sharedSignals(g.profiles),
    })).sort((a, b) => b.profiles.length - a.profiles.length || a.label.localeCompare(b.label));
  }
  function commonSubjects(a, b) {
    const other = new Set((b.subjects || []).map(normalize));
    return [...new Set((a.subjects || []).map(normalize))].filter(s => s && other.has(s));
  }
  const api = { normalize, clusters, sharedSignals, commonSubjects };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.StudyNetwork = api;
})(typeof window !== 'undefined' ? window : globalThis);
