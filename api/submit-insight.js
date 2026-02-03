import { put } from '@vercel/blob';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body;
    const { transcription, userName, timestamp } = body;

    // Use Claude AI for intelligent detection
    const aiDetection = await analyzeWithClaude(transcription);

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

    return res.status(200).json({
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
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}

async function analyzeWithClaude(text) {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: `You are analyzing guest insights for a boutique hotel in Aruba. Analyze this observation and extract structured information.

Observation: "${text}"

Respond ONLY with valid JSON in this exact format (no markdown, no extra text):
{
  "guestName": "extracted guest name or 'Unknown'",
  "roomNumber": "room number if mentioned or null",
  "category": "one of: Food and beverage, Housekeeping, Front office, General, Gifts, Previous stay, Reservations, Maintenance",
  "type": "either 'Magic Moment' or 'Preference'",
  "priority": "urgent (for celebrations/special occasions), high (for strong preferences), or standard (general notes)",
  "suggestion": "brief actionable suggestion (max 100 chars)"
}

Guidelines:
- Magic Moment: birthdays, anniversaries, honeymoons, celebrations, special requests requiring action
- Preference: food/drink likes, room preferences, amenities, general habits
- Priority "urgent" only for time-sensitive celebrations happening during current stay
- Be smart about extracting names (e.g., "John in room 305" → guestName: "John", roomNumber: "305")
- If room mentioned without name, guestName can be "Guest in Room X"
- Category should match the type of observation (food → Food and beverage, pillows → Housekeeping, etc.)`
        }]
      })
    });

    const data = await response.json();
    
    if (data.content && data.content[0] && data.content[0].text) {
      // Parse Claude's JSON response
      const cleanText = data.content[0].text.trim();
      const parsed = JSON.parse(cleanText);
      
      return {
        guestName: parsed.guestName || 'Unknown',
        roomNumber: parsed.roomNumber || null,
        category: parsed.category || 'General',
        type: parsed.type || 'Preference',
        priority: parsed.priority || 'standard',
        suggestion: parsed.suggestion || text.substring(0, 100)
      };
    } else {
      // Fallback if Claude API fails
      return fallbackAnalysis(text);
    }
  } catch (error) {
    console.error('Claude API error:', error);
    // Fallback to basic analysis if Claude fails
    return fallbackAnalysis(text);
  }
}

function fallbackAnalysis(text) {
  // Simple fallback in case Claude API is unavailable
  const lowerText = text.toLowerCase();
  
  const roomMatch = text.match(/room\s+(\d+)/i);
  const roomNumber = roomMatch ? roomMatch[1] : null;
  
  const nameMatch = text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
  const guestName = nameMatch ? nameMatch[1] : roomNumber ? `Guest in Room ${roomNumber}` : 'Unknown';
  
  let priority = 'standard';
  if (lowerText.includes('anniversary') || lowerText.includes('birthday')) {
    priority = 'urgent';
  } else if (lowerText.includes('prefers') || lowerText.includes('likes')) {
    priority = 'high';
  }
  
  let type = 'Preference';
  let category = 'General';
  let suggestion = text;
  
  if (lowerText.includes('anniversary') || lowerText.includes('birthday') || lowerText.includes('honeymoon')) {
    type = 'Magic Moment';
    category = 'Gifts';
    suggestion = 'Special occasion detected';
  } else if (lowerText.includes('food') || lowerText.includes('drink') || lowerText.includes('coffee') || lowerText.includes('tea')) {
    category = 'Food and beverage';
    suggestion = 'Dining preference noted';
  } else if (lowerText.includes('room') || lowerText.includes('pillow') || lowerText.includes('towel')) {
    category = 'Housekeeping';
    suggestion = 'Room preference noted';
  }
  
  return { priority, type, category, suggestion, guestName, roomNumber };
}
