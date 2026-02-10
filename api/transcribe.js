export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { audio, language } = req.body;

    if (!audio) {
      return res.status(400).json({ error: 'No audio provided', success: false });
    }

    if (!process.env.OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY not found in environment variables');
      return res.status(500).json({ error: 'OpenAI API key not configured', success: false });
    }

    console.log('Starting transcription...');

    // Convert base64 to blob
    const audioBuffer = Buffer.from(audio, 'base64');
    const audioBlob = new Blob([audioBuffer], { type: 'audio/webm' });

    // Use native FormData (available in Node 18+)
    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.webm');
    formData.append('model', 'whisper-1');
    
    if (language && language !== 'auto') {
      formData.append('language', language);
    }

    console.log('Calling OpenAI Whisper API...');

    // Call OpenAI Whisper API
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: formData
    });

    console.log('OpenAI response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      return res.status(500).json({ 
        error: 'Transcription service error', 
        success: false,
        statusCode: response.status,
        details: errorText.substring(0, 200)
      });
    }

    const data = await response.json();
    console.log('Transcription successful');

    if (data.text) {
      return res.status(200).json({
        success: true,
        transcription: data.text
      });
    } else {
      return res.status(500).json({
        error: 'No transcription returned',
        success: false
      });
    }

  } catch (error) {
    console.error('Transcription error:', error);
    return res.status(500).json({ 
      error: 'Failed to transcribe audio',
      success: false,
      details: error.message
    });
  }
}
