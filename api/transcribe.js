export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { audio, language } = req.body;

    if (!audio) {
      return res.status(400).json({ error: 'No audio provided' });
    }

    // Convert base64 to buffer
    const audioBuffer = Buffer.from(audio, 'base64');

    // Create FormData for OpenAI Whisper API
    const formData = new FormData();
    const audioBlob = new Blob([audioBuffer], { type: 'audio/webm' });
    formData.append('file', audioBlob, 'recording.webm');
    formData.append('model', 'whisper-1');
    
    if (language && language !== 'auto') {
      formData.append('language', language);
    }

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: formData
    });

    const data = await response.json();

    if (data.text) {
      return res.status(200).json({
        success: true,
        transcription: data.text
      });
    } else {
      return res.status(500).json({
        error: 'Transcription failed',
        success: false
      });
    }

  } catch (error) {
    console.error('Transcription error:', error);
    return res.status(500).json({ 
      error: error.message,
      success: false
    });
  }
}
