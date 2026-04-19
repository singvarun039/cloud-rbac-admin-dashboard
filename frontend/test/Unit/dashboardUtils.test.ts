import { describe, expect, it } from 'vitest';
import { parseInsightText } from '../../src/pages/Dashboard/dashboardUtils';

describe('parseInsightText', () => {
  it('returns an empty shape for blank input', () => {
    expect(parseInsightText(undefined)).toEqual({
      summary: null,
      anomalies: [],
      recommendations: [],
    });
  });

  it('parses summary, anomalies, and recommendations blocks', () => {
    const parsed = parseInsightText(`
      Summary: Elevated access churn this week
      Anomalies:
      - Privileged role grants spiked on Monday
      Recommendations:
      - Review emergency role assignments
      - Tighten approver policy
    `);

    expect(parsed).toEqual({
      summary: 'Elevated access churn this week',
      anomalies: ['Privileged role grants spiked on Monday'],
      recommendations: ['Review emergency role assignments', 'Tighten approver policy'],
    });
  });
});
