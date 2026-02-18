import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Sparkles, Send, Globe, WifiOff, Wifi, Cloud, CloudOff, Volume2, VolumeX } from 'lucide-react';

const WhisperApp = () => {
  const [userName, setUserName] = useState('');
  const [textInput, setTextInput] = useState('');
  const [language, setLanguage] = useState('auto');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [lastInsight, setLastInsight] = useState(null);
  const [error, setError] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingQueue, setPendingQueue] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [voiceActivationEnabled, setVoiceActivationEnabled] = useState(false);
  const [isListeningForWakeWord, setIsListeningForWakeWord] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');

  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const timerRef = useRef(null);
  const recognitionRef = useRef(null);
  const wakeWordRecognitionRef = useRef(null);
  const transcriptRef = useRef('');
  const isRecordingRef = useRef(false);

  // Audio feedback
  const playBeep = (frequency = 800, duration = 200) => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration / 1000);
    } catch (e) {
      console.error('Error playing beep:', e);
    }
  };

  // Load saved name and pending queue on mount
  useEffect(() => {
    const savedName = localStorage.getItem('whisperUserName');
    if (savedName) {
      setUserName(savedName);
    }

    const savedQueue = localStorage.getItem('whisperPendingQueue');
    if (savedQueue) {
      try {
        const queue = JSON.parse(savedQueue);
        setPendingQueue(queue);
      } catch (e) {
        console.error('Error loading pending queue:', e);
      }
    }

    const savedVoiceActivation = localStorage.getItem('voiceActivationEnabled');
    if (savedVoiceActivation === 'true') {
      setVoiceActivationEnabled(true);
    }

    // Initialize speech recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      
      // Main recognition for actual recording - IMPROVED SETTINGS
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.maxAlternatives = 3;
      
      recognitionRef.current.onresult = (event) => {
        let interimText = '';
        let finalText = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const transcript = result[0].transcript;
          
          const confidence = result[0].confidence;
          console.log('Confidence:', confidence, 'Text:', transcript);
          
          if (result.isFinal) {
            if (confidence > 0.5 || confidence === undefined) {
              finalText += transcript + ' ';
            }
          } else {
            interimText += transcript;
          }
        }

        transcriptRef.current += finalText;
        
        // Update live display
        setLiveTranscript(transcriptRef.current.trim());
        setInterimTranscript(interimText.trim());

        // Check for stop command in both final and interim text
        const lowerText = (finalText + interimText).toLowerCase();
        if (lowerText.includes('stop recording') || 
            lowerText.includes('stop') ||
            lowerText.includes('submit') ||
            lowerText.includes('done')) {
          if (isRecordingRef.current) {
            stopRecording();
          }
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'no-speech') {
          console.log('No speech detected, continuing...');
        } else if (event.error === 'audio-capture') {
          setError('Microphone error. Please check your microphone.');
        } else if (event.error === 'not-allowed') {
          setError('Microphone access denied. Please allow microphone access.');
        } else if (event.error === 'network') {
          setError('Network error. Speech recognition requires internet connection.');
        }
      };

      recognitionRef.current.onend = () => {
        if (isRecordingRef.current) {
          try {
            recognitionRef.current.start();
          } catch (e) {
            console.error('Error restarting recognition:', e);
          }
        }
      };

      // Wake word recognition
      wakeWordRecognitionRef.current = new SpeechRecognition();
      wakeWordRecognitionRef.current.continuous = true;
      wakeWordRecognitionRef.current.interimResults = false;
      
      wakeWordRecognitionRef.current.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase();
        
        if (transcript.includes('record insight') || 
            transcript.includes('magic moment') ||
            transcript.includes('record guest')) {
          console.log('Wake word detected:', transcript);
          playBeep(1000, 150);
          startRecording();
        }
      };

      wakeWordRecognitionRef.current.onerror = (event) => {
        if (event.error !== 'no-speech') {
          console.error('Wake word recognition error:', event.error);
        }
      };

      wakeWordRecognitionRef.current.onend = () => {
        if (voiceActivationEnabled && !isRecordingRef.current) {
          try {
            wakeWordRecognitionRef.current.start();
          } catch (e) {
            console.error('Error restarting wake word recognition:', e);
          }
        }
      };
    } else {
      setError('Speech recognition not supported in this browser. Please use Chrome or Safari.');
    }
  }, []);

  useEffect(() => {
    if (userName.trim()) {
      localStorage.setItem('whisperUserName', userName.trim());
    }
  }, [userName]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (pendingQueue.length > 0) {
        syncPendingInsights();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [pendingQueue]);

  useEffect(() => {
    localStorage.setItem('whisperPendingQueue', JSON.stringify(pendingQueue));
  }, [pendingQueue]);

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
      setRecordingTime(0);
    }
    return () => clearInterval(timerRef.current);
  }, [isRecording]);

  useEffect(() => {
    if (recognitionRef.current && language !== 'auto') {
      recognitionRef.current.lang = language;
    } else if (recognitionRef.current) {
      recognitionRef.current.lang = 'en-US';
    }

    if (wakeWordRecognitionRef.current) {
      wakeWordRecognitionRef.current.lang = 'en-US';
    }
  }, [language]);

  useEffect(() => {
    localStorage.setItem('voiceActivationEnabled', voiceActivationEnabled.toString());

    if (voiceActivationEnabled && wakeWordRecognitionRef.current && !isRecording) {
      try {
        wakeWordRecognitionRef.current.start();
        setIsListeningForWakeWord(true);
        playBeep(600, 100);
      } catch (e) {
        if (e.name !== 'InvalidStateError') {
          console.error('Error starting wake word recognition:', e);
        }
      }
    } else if (!voiceActivationEnabled && wakeWordRecognitionRef.current) {
      try {
        wakeWordRecognitionRef.current.stop();
        setIsListeningForWakeWord(false);
        playBeep(400, 100);
      } catch (e) {
        console.error('Error stopping wake word recognition:', e);
      }
    }

    return () => {
      if (wakeWordRecognitionRef.current) {
        try {
          wakeWordRecognitionRef.current.stop();
        } catch (e) {
          // Ignore
        }
      }
    };
  }, [voiceActivationEnabled, isRecording]);

  const syncPendingInsights = async () => {
    if (pendingQueue.length === 0 || isSyncing) return;

    setIsSyncing(true);
    const failedInsights = [];

    for (const insight of pendingQueue) {
      try {
        const response = await fetch('/api/submit-insight', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcription: insight.transcription,
            userName: insight.userName,
            timestamp: insight.timestamp
          })
        });

        if (!response.ok) {
          failedInsights.push(insight);
        }
      } catch (error) {
        console.error('Error syncing insight:', error);
        failedInsights.push(insight);
      }
    }

    setPendingQueue(failedInsights);
    setIsSyncing(false);

    if (failedInsights.length === 0) {
      setError(null);
      showSuccessMessage('All insights synced successfully!');
    } else {
      setError(`${failedInsights.length} insights failed to sync. Will retry when online.`);
    }
  };

  const showSuccessMessage = (message) => {
    const tempInsight = {
      transcription: message,
      detected: { insightType: 'Success' }
    };
    setLastInsight(tempInsight);
    setShowConfetti(true);
    setTimeout(() => {
      setShowConfetti(false);
      setLastInsight(null);
    }, 3000);
  };

  const startRecording = async () => {
    try {
      setError(null);
      transcriptRef.current = '';
      setLiveTranscript('');
      setInterimTranscript('');

      if (!recognitionRef.current) {
        setError('Speech recognition not supported in this browser.');
        return;
      }

      if (wakeWordRecognitionRef.current && voiceActivationEnabled) {
        try {
          wakeWordRecognitionRef.current.stop();
          setIsListeningForWakeWord(false);
        } catch (e) {
          console.error('Error stopping wake word recognition:', e);
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000
        }
      });
      
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 256;
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      
      visualize();

      try {
        recognitionRef.current.start();
        isRecordingRef.current = true;
        setIsRecording(true);
        playBeep(1000, 100);
      } catch (e) {
        console.error('Error starting recognition:', e);
        setError('Could not start speech recognition. Please try again.');
        stream.getTracks().forEach(track => track.stop());
        if (audioContext) audioContext.close();
        return;
      }

      mediaRecorderRef.current = { stream };

    } catch (err) {
      console.error('Error accessing microphone:', err);
      setError('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = async () => {
    if (!isRecordingRef.current) return;

    isRecordingRef.current = false;
    setIsRecording(false);
    setAudioLevel(0);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.error('Error stopping recognition:', e);
      }
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.stream) {
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    
    cancelAnimationFrame(animationFrameRef.current);

    playBeep(800, 100);

    if (voiceActivationEnabled && wakeWordRecognitionRef.current) {
      setTimeout(() => {
        try {
          wakeWordRecognitionRef.current.start();
          setIsListeningForWakeWord(true);
        } catch (e) {
          console.error('Error restarting wake word recognition:', e);
        }
      }, 500);
    }

    setTimeout(() => {
      const transcription = transcriptRef.current.trim();
      
      const cleanedTranscription = transcription
        .replace(/stop recording/gi, '')
        .replace(/\bsubmit\b/gi, '')
        .replace(/\bdone\b/gi, '')
        .replace(/\bstop\b/gi, '')
        .trim();

      if (cleanedTranscription) {
        submitInsight(cleanedTranscription);
      } else {
        setError('No speech detected. Please try again and speak clearly.');
      }
      
      setLiveTranscript('');
      setInterimTranscript('');
    }, 500);
  };

  const visualize = () => {
    if (!analyserRef.current) return;
    
    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);
      analyserRef.current.getByteFrequencyData(dataArray);
      
      const average = dataArray.reduce((a, b) => a + b) / bufferLength;
      setAudioLevel(Math.min(100, (average / 255) * 200));
    };
    
    draw();
  };

  const submitInsight = async (transcription) => {
    const insightData = {
      transcription,
      userName,
      timestamp: new Date().toISOString()
    };

    if (!isOnline) {
      setPendingQueue(prev => [...prev, insightData]);
      
      setLastInsight({
        transcription: transcription,
        detected: {
          guestName: "Unknown",
          roomNumber: null,
          insightType: "Saved Offline",
          suggestion: "Will sync when online"
        }
      });
      setShowConfetti(true);
      setError('Offline - Insight saved locally. Will sync when connected.');

      setTimeout(() => {
        setShowConfetti(false);
        setLastInsight(null);
      }, 3000);
      
      return;
    }

    try {
      const response = await fetch('/api/submit-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(insightData)
      });

      const data = await response.json();
      
      if (data.success) {
        setLastInsight(data.insight);
        setShowConfetti(true);
        setError(null);
        playBeep(1200, 200);

        setTimeout(() => {
          setShowConfetti(false);
          setLastInsight(null);
        }, 3000);
      } else if (data.error) {
        setError(data.error);
      }
    } catch (error) {
      console.error('Error submitting insight:', error);
      
      setPendingQueue(prev => [...prev, insightData]);
      setError('Failed to send. Saved locally - will retry when online.');
      
      setLastInsight({
        transcription: transcription,
        detected: {
          guestName: "Unknown",
          roomNumber: null,
          insightType: "Saved Offline",
          suggestion: "Will sync when online"
        }
      });
      setShowConfetti(true);

      setTimeout(() => {
        setShowConfetti(false);
        setLastInsight(null);
      }, 3000);
    }
  };

  const handleTextSubmit = async () => {
    if (!textInput.trim()) return;
    
    await submitInsight(textInput);
    setTextInput('');
  };

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ backgroundColor: '#f2ebe2' }}>
      {/* Confetti Effect */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="absolute"
              style={{
                left: `${Math.random() * 100}%`,
                top: '-10px',
                animation: `confetti ${2 + Math.random()}s linear forwards`,
                animationDelay: `${Math.random() * 0.5}s`
              }}
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{
                  backgroundColor: ['#FFD700', '#00b3c2', '#f2ebe2', '#FF69B4', '#98FB98'][Math.floor(Math.random() * 5)]
                }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b p-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="flex-1 flex justify-center">
              <img 
                src="/Boardwalk_Total.png" 
                alt="Boardwalk Boutique Hotel" 
                className="h-16 w-auto"
              />
            </div>
          
            <div className="flex items-center space-x-2">
              {isOnline ? (
                <div className="flex items-center space-x-1 text-green-600">
                  <Wifi className="w-4 h-4" />
                  <span className="text-xs font-medium">Online</span>
                </div>
              ) : (
                <div className="flex items-center space-x-1 text-orange-600">
                  <WifiOff className="w-4 h-4" />
                  <span className="text-xs font-medium">Offline</span>
                </div>
              )}
            </div>
          </div>

          {pendingQueue.length > 0 && (
            <div className="mt-2 bg-orange-50 border border-orange-200 rounded-lg p-2 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CloudOff className="w-4 h-4 text-orange-600" />
                <span className="text-xs text-orange-800">
                  {pendingQueue.length} insight{pendingQueue.length > 1 ? 's' : ''} waiting to sync
                </span>
              </div>
              {isOnline && !isSyncing && (
                <button
                  onClick={syncPendingInsights}
                  className="text-xs bg-orange-600 text-white px-2 py-1 rounded hover:bg-orange-700"
                >
                  Sync Now
                </button>
              )}
              {isSyncing && (
                <span className="text-xs text-orange-600">Syncing...</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Voice Activation Toggle */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-4 border-2 border-blue-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {voiceActivationEnabled ? (
                <Volume2 className="w-6 h-6 text-blue-600" />
              ) : (
                <VolumeX className="w-6 h-6 text-gray-400" />
              )}
              <div>
                <p className="font-semibold text-gray-900">Voice Activation</p>
                <p className="text-xs text-gray-600">
                  {voiceActivationEnabled 
                    ? isListeningForWakeWord 
                      ? 'Listening for "Record insight"...'
                      : 'Starting...'
                    : 'Say "Record insight" to start'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setVoiceActivationEnabled(!voiceActivationEnabled)}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                voiceActivationEnabled ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                  voiceActivationEnabled ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          {voiceActivationEnabled && (
            <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-xs text-blue-800 font-medium mb-1">Wake Words:</p>
              <p className="text-xs text-blue-700">
                • "Record insight"<br />
                • "Magic moment"<br />
                • "Record guest"
              </p>
              <p className="text-xs text-blue-600 mt-2">
                To stop: Say "Stop", "Done", "Stop recording", or "Submit"
              </p>
            </div>
          )}
        </div>

        {/* Success Message */}
        {lastInsight && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6" style={{ animation: 'slideUp 0.5s ease-out' }}>
            <div className="text-center mb-4">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-3">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Insight Captured!</h2>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-3">
              <p className="text-sm text-gray-600 mb-2">
                <strong>Transcribed:</strong>
              </p>
              <p className="text-sm text-gray-800 italic">"{lastInsight.transcription}"</p>
            </div>

            <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
              <p className="text-xs font-semibold text-blue-900 mb-2">AI Detected:</p>
              <div className="space-y-1 text-xs text-blue-800">
                {lastInsight.detected.guestName && (
                  <p>• Guest: <strong>{lastInsight.detected.guestName}</strong></p>
                )}
                {lastInsight.detected.roomNumber && (
                  <p>• Room: <strong>{lastInsight.detected.roomNumber}</strong></p>
                )}
                <p>• Type: <strong>{lastInsight.detected.insightType}</strong></p>
                <p>• Suggestion: <strong>{lastInsight.detected.suggestion}</strong></p>
              </div>
            </div>
          </div>
        )}

        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-serif font-bold text-gray-900 mb-2">Record Guest Insight</h1>
          <p className="text-gray-600">
            {voiceActivationEnabled 
              ? 'Just say "Record insight" to start'
              : 'Record name or room number of guest and guest information'}
          </p>
        </div>

        {/* Name Input */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
          <div className="flex items-center space-x-3">
            <div className="text-gray-400">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Your name"
              className="flex-1 text-lg border-none outline-none bg-transparent"
            />
          </div>
        </div>

        {/* Language Selector */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="flex items-center space-x-3">
            <Globe className="w-6 h-6 text-gray-400" />
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="flex-1 text-lg border-none outline-none bg-transparent cursor-pointer"
            >
              <option value="auto">Auto-detect language</option>
              <option value="en-US">English</option>
              <option value="es-ES">Spanish</option>
              <option value="nl-NL">Dutch</option>
              <option value="pt-PT">Portuguese</option>
            </select>
          </div>
        </div>

        {/* Recording Button */}
        <div className="text-center mb-6">
          {isRecording && (
            <div className="mb-4">
              {/* Live Transcription Display */}
              <div className="bg-white rounded-lg shadow-lg p-4 mb-4 min-h-24 border-2 border-blue-400">
                <p className="text-xs text-gray-500 mb-2 font-semibold">LIVE TRANSCRIPTION:</p>
                <p className="text-lg text-gray-900 font-medium leading-relaxed">
                  {liveTranscript || <span className="text-gray-400 italic">Listening...</span>}
                  {interimTranscript && (
                    <span className="text-gray-400 italic"> {interimTranscript}</span>
                  )}
                </p>
              </div>

              {/* Audio Visualization */}
              <div className="flex items-end justify-center space-x-1 h-16 mb-3">
                {[...Array(15)].map((_, i) => (
                  <div
                    key={i}
                    className="rounded-full w-2 transition-all duration-100"
                    style={{
                      backgroundColor: '#00b3c2',
                      height: `${Math.max(8, (audioLevel * Math.random() * (1 + Math.sin(Date.now() / 100 + i) * 0.5)))}px`
                    }}
                  />
                ))}
              </div>
              <div className="text-2xl font-bold text-gray-800 mb-2">
                {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
              </div>
              <p className="text-sm text-gray-600 font-medium">Say "Stop" or "Done" to finish</p>
            </div>
          )}

          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={showConfetti || (voiceActivationEnabled && !isRecording)}
            style={{ backgroundColor: isRecording ? '#ef4444' : '#00b3c2' }}
            className={`w-32 h-32 rounded-full flex items-center justify-center shadow-xl transition-all transform mx-auto hover:opacity-90 ${
              isRecording ? 'scale-110 animate-pulse' : 'hover:scale-105'
            } ${(showConfetti || (voiceActivationEnabled && !isRecording)) ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isRecording ? (
              <MicOff className="w-12 h-12 text-white" />
            ) : (
              <Mic className="w-12 h-12 text-white" />
            )}
          </button>

          <p className="text-gray-600 mt-4 font-medium">
            {voiceActivationEnabled && !isRecording 
              ? 'Voice activation enabled - just speak!'
              : isRecording 
                ? 'Tap to stop recording or say "Stop"' 
                : 'Tap to start recording'}
          </p>
        </div>

        {/* Divider */}
        <div className="flex items-center justify-center my-6">
          <div className="flex-1 border-t border-gray-300"></div>
          <span className="px-4 text-gray-500 text-sm">or type it out</span>
          <div className="flex-1 border-t border-gray-300"></div>
        </div>

        {/* Text Input */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
          <textarea
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Enter guest name, room number, and information..."
            className="w-full h-32 text-gray-700 border-none outline-none resize-none bg-transparent"
          />
        </div>

        {/* Submit Button */}
        <button
          onClick={handleTextSubmit}
          disabled={!textInput.trim() || showConfetti}
          style={{ backgroundColor: '#f4d775' }}
          className="w-full text-gray-800 py-4 rounded-xl font-semibold hover:opacity-90 disabled:bg-gray-300 disabled:cursor-not-allowed transition-opacity flex items-center justify-center space-x-2"
        >
          <Send className="w-5 h-5" />
          <span>Submit</span>
        </button>

        {/* Error/Status Message */}
        {error && (
          <div className={`mt-4 px-4 py-3 rounded-lg ${
            error.includes('Offline') || error.includes('saved locally') 
              ? 'bg-orange-100 border border-orange-400 text-orange-700' 
              : 'bg-red-100 border border-red-400 text-red-700'
          }`}>
            <p className="text-sm">{error}</p>
          </div>
        )}
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes confetti {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        
        @keyframes slideUp {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default WhisperApp;
