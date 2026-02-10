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
      return res.status(500).json({ error: 'OpenAI API key not configured', success: false });
    }

    // Convert base64 to buffer
    const audioBuffer = Buffer.from(audio, 'base64');

    // Create multipart form data manually
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    
    const formDataParts = [];
    
    // Add file field
    formDataParts.push(`--${boundary}\r\n`);
    formDataParts.push(`Content-Disposition: form-data; name="file"; filename="recording.webm"\r\n`);
    formDataParts.push(`Content-Type: audio/webm\r\n\r\n`);
    
    // Add model field
    const fileAndModel = Buffer.concat([
      audioBuffer,
      Buffer.from(`\r\n--${boundary}\r\n`),
      Buffer.from(`Content-Disposition: form-data; name="model"\r\n\r\n`),
      Buffer.from(`whisper-1\r\n`)
    ]);
    
    // Add language if specified
    let finalBuffer;
    if (language && language !== 'auto' && language !== null) {
      finalBuffer = Buffer.concat([
        Buffer.from(formDataParts.join('')),
        fileAndModel,
        Buffer.from(`--${boundary}\r\n`),
        Buffer.from(`Content-Disposition: form-data; name="language"\r\n\r\n`),
        Buffer.from(`${language}\r\n`),
        Buffer.from(`--${boundary}--\r\n`)
      ]);
    } else {
      finalBuffer = Buffer.concat([
        Buffer.from(formDataParts.join('')),
        fileAndModel,
        Buffer.from(`--${boundary}--\r\n`)
      ]);
    }

    // Call OpenAI Whisper API
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body: finalBuffer
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      return res.status(500).json({ 
        error: 'Transcription service error', 
        success: false,
        details: errorText
      });
    }

    const data = await response.json();

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
