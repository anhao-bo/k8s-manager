import { NextRequest, NextResponse } from 'next/server';

// Terminal session storage (in-memory for simplicity)
const sessions = new Map<string, {
  inputBuffer: string[];
  outputBuffer: string[];
  lastActivity: number;
}>();

// Cleanup old sessions every minute
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.lastActivity > 5 * 60 * 1000) { // 5 minutes timeout
      sessions.delete(id);
    }
  }
}, 60000);

// POST - send input to terminal
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, input, type } = body;

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    // Get or create session
    let session = sessions.get(sessionId);
    if (!session) {
      session = { inputBuffer: [], outputBuffer: [], lastActivity: Date.now() };
      sessions.set(sessionId, session);
    }

    if (type === 'input' && input) {
      // Forward input to backend via WebSocket
      const wsUrl = `ws://localhost:8080/api/ws/exec?${new URLSearchParams({
        namespace: body.namespace || 'default',
        pod: body.pod || '',
        shell: body.shell || '/bin/sh',
      }).toString()}`;
      
      // For now, just acknowledge the input
      session.lastActivity = Date.now();
      return NextResponse.json({ success: true });
    }

    if (type === 'resize') {
      // Handle resize
      session.lastActivity = Date.now();
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid request type' }, { status: 400 });
  } catch (error) {
    console.error('Terminal POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET - poll for output (SSE-like)
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
  }

  const session = sessions.get(sessionId);
  if (!session) {
    return NextResponse.json({ output: '', error: 'Session not found' });
  }

  // Return any pending output
  const output = session.outputBuffer.join('');
  session.outputBuffer = [];
  session.lastActivity = Date.now();

  return NextResponse.json({ output });
}
