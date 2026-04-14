export type TeamSize = 'solo' | 'small' | 'mid' | 'enterprise' | null;
export type Urgency = 'just browsing' | 'evaluating' | 'ready to buy' | null;
export type LeadStage = 'cold' | 'warm' | 'hot' | 'escalated';

export interface LeadInfo {
  name: string | null;
  email: string | null;
  useCase: string | null;
  teamSize: TeamSize;
  urgency: Urgency;
  stage: LeadStage;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}
