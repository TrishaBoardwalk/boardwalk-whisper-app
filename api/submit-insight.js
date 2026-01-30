import { put, list } from '@vercel/blob';

export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const body = await req.json();
    const { transcription, userName, timestamp } = body;

    // Simple AI detection
    const aiDetection = analyzeTranscription(transcription);

    // Create insight object
    const insight = {
      id: Date.now().toString(),
      transcription,
      recordedBy: userName,
      timestamp: timestamp || new Date().toISOString(),
      aiSuggestion: aiDetection.suggestion,
      suggestedCategory: aiDetection.category,
      priority: aiDetection.priority,
      guestName: aiDetection.guestName,
      roomNumber: aiDetection.roomNumber,
      processed: false
    };

    // Store in Blob
    const filename = `insights/${insight.id}.json`;
    await put(filename, JSON.stringify(insight), {
      access: 'public',
    });

    return new Response(JSON.stringify({
      success: true,
      insight: {
        transcription: insight.transcription,
        detected: {
          guestName: insight.guestName,
          roomNumber: insight.roomNumber,
          insightType: aiDetection.type,
          suggestion: aiDetection.suggestion
        }
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

function analyzeTranscription(text) {
  const lowerText = text.toLowerCase();
  
  // Extract room number
  const roomMatch = text.match(/room\s+(\d+)/i);
  const roomNumber = roomMatch ? roomMatch[1] : null;
  
  // Extract guest name
  const nameMatch = text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
  const guestName = nameMatch ? nameMatch[1] : roomNumber ? `Guest in Room ${roomNumber}` : 'Unknown';
  
  // Detect priority
  let priority = 'standard';
  if (lowerText.includes('anniversary') || lowerText.includes('birthday') || lowerText.includes('celebration')) {
    priority = 'urgent';
  } else if (lowerText.includes('prefers') || lowerText.includes('likes') || lowerText.includes('loves')) {
    priority = 'high';
  }
  
  // Detect type
  let type = 'Preference';
  let category = 'General';
  let suggestion = text;
  
  if (lowerText.includes('anniversary') || lowerText.includes('birthday') || lowerText.includes('honeymoon')) {
    type = 'Magic Moment';
    category = 'Gifts';
    suggestion = `Special occasion detected`;
  } else if (lowerText.includes('food') || lowerText.includes('drink') || lowerText.includes('coffee') || lowerText.includes('tea')) {
    category = 'Food and beverage';
    suggestion = 'Dining preference noted';
  } else if (lowerText.includes('room') || lowerText.includes('pillow') || lowerText.includes('towel')) {
    category = 'Housekeeping';
    suggestion = 'Room preference noted';
  }
  
  return { priority, type, category, suggestion, guestName, roomNumber };
}
