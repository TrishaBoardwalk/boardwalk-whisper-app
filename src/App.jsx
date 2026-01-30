const processRecording = async (audioBlob) => {
    // In production, you'd send the audio to backend for transcription
    // For now, we'll use mock transcription but send to real API
    
    const mockTranscriptions = [
      "Guest in room 305 mentioned they are celebrating their anniversary tomorrow",
      "Guest at pool prefers herbal tea instead of coffee in the mornings",
      "Guest mentioned interest in local bird watching"
    ];
    
    const transcription = mockTranscriptions[Math.floor(Math.random() * mockTranscriptions.length)];

    try {
      // Send to API
      const response = await fetch('/api/submit-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcription,
          userName,
          timestamp: new Date().toISOString()
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setLastInsight(data.insight);
        setShowConfetti(true);

        setTimeout(() => {
          setShowConfetti(false);
          setLastInsight(null);
        }, 3000);
      }
    } catch (error) {
      console.error('Error submitting insight:', error);
      setError('Failed to submit insight. Please try again.');
    }
  };
