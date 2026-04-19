export type SourceMeta = { key: string; label: string; description: string };

export interface InsightBlock {
  summary: string | null;
  anomalies: string[];
  recommendations: string[];
}

export function parseInsightText(value: string | undefined): InsightBlock {
  if (!value?.trim()) return { summary: null, anomalies: [], recommendations: [] };
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  let currentSection: 'summary' | 'anomalies' | 'recommendations' | null = null;
  const summary: string[] = [],
    anomalies: string[] = [],
    recommendations: string[] = [];

  for (const line of lines) {
    const normalized = line.toLowerCase();
    if (normalized.startsWith('summary:')) {
      currentSection = 'summary';
      const next = line.slice('summary:'.length).trim();
      if (next) summary.push(next);
      continue;
    }
    if (normalized.startsWith('anomalies:')) {
      currentSection = 'anomalies';
      const next = line.slice('anomalies:'.length).trim();
      if (next) anomalies.push(next.replace(/^[-*]\s*/, ''));
      continue;
    }
    if (normalized.startsWith('recommendations:')) {
      currentSection = 'recommendations';
      const next = line.slice('recommendations:'.length).trim();
      if (next) recommendations.push(next.replace(/^[-*]\s*/, ''));
      continue;
    }
    if (currentSection === 'summary') {
      summary.push(line);
      continue;
    }
    if (currentSection === 'anomalies') {
      anomalies.push(line.replace(/^[-*]\s*/, ''));
      continue;
    }
    if (currentSection === 'recommendations') {
      recommendations.push(line.replace(/^[-*]\s*/, ''));
    }
  }

  return { summary: summary.join(' ').trim() || null, anomalies, recommendations };
}
