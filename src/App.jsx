import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Sparkles, Send, Globe } from 'lucide-react';

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

  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const timerRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Load saved name on mount
  useEffect(() => {
    const savedName = localStorage.getItem('whisperUserName');
    if (savedName) {
      setUserName(savedName);
    }
  }, []);

  // Save name when it changes
  useEffect(() => {
    if (userName.trim()) {
      localStorage.setItem('whisperUserName', userName.trim());
    }
  }, [userName]);

  // Recording timer
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

  const startRecording = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Setup audio visualization
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 256;
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      
      // Start visualization
      visualize();

      // Setup MediaRecorder
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processRecording(audioBlob);
        
        // Cleanup
        stream.getTracks().forEach(track => track.stop());
        if (audioContextRef.current) {
          audioContextRef.current.close();
        }
        cancelAnimationFrame(animationFrameRef.current);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setError('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setAudioLevel(0);
    }
  };

  const visualize = () => {
    if (!analyserRef.current) return;
    
    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);
      analyserRef.current.getByteFrequencyData(dataArray);
      
      // Calculate average audio level
      const average = dataArray.reduce((a, b) => a + b) / bufferLength;
      setAudioLevel(Math.min(100, (average / 255) * 200));
    };
    
    draw();
  };

  const processRecording = async (audioBlob) => {
    // Simulate AI processing
    const mockInsights = [
      {
        transcription: "Guest in room 305 mentioned they are celebrating their anniversary tomorrow",
        detected: {
          guestName: "John Smith",
          roomNumber: "305",
          insightType: "Magic Moment",
          suggestion: "Anniversary celebration"
        }
      },
      {
        transcription: "Guest at pool prefers herbal tea instead of coffee in the mornings",
        detected: {
          guestName: "Sarah Johnson",
          roomNumber: "412",
          insightType: "Preference",
          suggestion: "Morning beverage preference"
        }
      },
      {
        transcription: "Guest mentioned interest in local bird watching",
        detected: {
          guestName: "Unknown",
          roomNumber: null,
          insightType: "Interest",
          suggestion: "Bird watching opportunity"
        }
      }
    ];

    await new Promise(resolve => setTimeout(resolve, 1500));
    const insight = mockInsights[Math.floor(Math.random() * mockInsights.length)];
    
    setLastInsight(insight);
    setShowConfetti(true);

    setTimeout(() => {
      setShowConfetti(false);
      setLastInsight(null);
    }, 3000);
  };

  const handleTextSubmit = async () => {
    if (!textInput.trim()) return;

    // Simulate processing text input
    const insight = {
      transcription: textInput,
      detected: {
        guestName: textInput.match(/room (\d+)/i) ? "Guest" : "Unknown",
        roomNumber: textInput.match(/room (\d+)/i)?.[1] || null,
        insightType: "Preference",
        suggestion: "Guest observation"
      }
    };

    setLastInsight(insight);
    setShowConfetti(true);
    setTextInput('');

    setTimeout(() => {
      setShowConfetti(false);
      setLastInsight(null);
    }, 3000);
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

      {/* Header with Logo */}
      <div className="bg-white border-b p-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-2">
            <h1 className="text-2xl font-bold" style={{ color: '#00b3c2', fontFamily: 'cursive' }}>
              Boardwalk
            </h1>
            <p className="text-xs text-gray-500">BOUTIQUE HOTEL ARUBA</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto px-4 py-8">
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
          <p className="text-gray-600">Record name or room number of guest and guest information</p>
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
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="nl">Dutch</option>
              <option value="pt">Portuguese</option>
            </select>
          </div>
        </div>

        {/* Recording Button */}
        <div className="text-center mb-6">
          {isRecording && (
            <div className="mb-4">
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
            </div>
          )}

          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={showConfetti}
            style={{ backgroundColor: isRecording ? '#ef4444' : '#00b3c2' }}
            className={`w-32 h-32 rounded-full flex items-center justify-center shadow-xl transition-all transform mx-auto hover:opacity-90 ${
              isRecording ? 'scale-110 animate-pulse' : 'hover:scale-105'
            } ${showConfetti ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isRecording ? (
              <MicOff className="w-12 h-12 text-white" />
            ) : (
              <Mic className="w-12 h-12 text-white" />
            )}
          </button>

          <p className="text-gray-600 mt-4 font-medium">
            {isRecording ? 'Tap to stop recording' : 'Tap to start recording'}
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

        {/* Error Message */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mt-4">
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
