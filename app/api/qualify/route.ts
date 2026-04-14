import Anthropic from '@anthropic-ai/sdk';
import { QUALIFY_SYSTEM_PROMPT } from '@/lib/salesPrompt';
import { ChatMessage, LeadInfo } from '@/lib/types';
import { updateLead } from '@/lib/leadStore';

const anthropic = new Anthropic();

export async function POST(request: Request) {
  try {
    const { messages, sessionId } = (await request.json()) as {
      messages: ChatMessage[];
      sessionId: string;
    };

    if (!messages || !sessionId) {
      return Response.json({ error: 'Missing messages or sessionId' }, { status: 400 });
    }

    const conversationText = messages
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      system: QUALIFY_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Analyze this conversation and extract lead qualification data as JSON.\n\nConversation:\n${conversationText}`,
        },
      ],
    });

    const textContent = response.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return Response.json({ lead: updateLead(sessionId, {}) });
    }

    try {
      const extracted = JSON.parse(textContent.text) as Partial<LeadInfo>;
      const lead = updateLead(sessionId, extracted);
      return Response.json({ lead });
    } catch {
      // JSON parse failed — return existing lead state unchanged
      const lead = updateLead(sessionId, {});
      return Response.json({ lead });
    }
  } catch (error) {
    console.error('Qualify API error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
