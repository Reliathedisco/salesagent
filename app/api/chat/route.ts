import Anthropic from '@anthropic-ai/sdk';
import { SALES_SYSTEM_PROMPT } from '@/lib/salesPrompt';
import { ChatMessage } from '@/lib/types';

const anthropic = new Anthropic();

export async function POST(request: Request) {
  try {
    const { messages, sessionId } = (await request.json()) as {
      messages: ChatMessage[];
      sessionId: string;
    };

    if (!messages || !sessionId) {
      return new Response('Missing messages or sessionId', { status: 400 });
    }

    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SALES_SYSTEM_PROMPT,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    const encoder = new TextEncoder();

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          stream.on('text', (text) => {
            const data = JSON.stringify({ text });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          });

          stream.on('error', (error) => {
            console.error('Stream error:', error);
            const data = JSON.stringify({
              error: 'An error occurred while generating a response.',
            });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          });

          stream.on('end', () => {
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          });

          // Wait for the stream to finish to keep the connection alive
          await stream.finalMessage();
        } catch (error) {
          console.error('Stream processing error:', error);
          try {
            const data = JSON.stringify({
              error: 'An error occurred while generating a response.',
            });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          } catch {
            // Controller may already be closed
          }
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}
