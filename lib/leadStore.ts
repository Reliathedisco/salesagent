import { LeadInfo } from './types';

const DEFAULT_LEAD: LeadInfo = {
  name: null,
  email: null,
  useCase: null,
  teamSize: null,
  urgency: null,
  stage: 'cold',
};

// In-memory store — replace with a database in production
const store = new Map<string, LeadInfo>();

export function getLead(sessionId: string): LeadInfo | undefined {
  return store.get(sessionId);
}

export function updateLead(
  sessionId: string,
  partial: Partial<LeadInfo>
): LeadInfo {
  const existing = store.get(sessionId) ?? { ...DEFAULT_LEAD };
  const updated: LeadInfo = {
    ...existing,
    ...Object.fromEntries(
      Object.entries(partial).filter(([, v]) => v !== null && v !== undefined)
    ),
  } as LeadInfo;
  // Always allow stage updates even if null-ish
  if (partial.stage) {
    updated.stage = partial.stage;
  }
  store.set(sessionId, updated);
  return updated;
}

export function clearLead(sessionId: string): void {
  store.delete(sessionId);
}
