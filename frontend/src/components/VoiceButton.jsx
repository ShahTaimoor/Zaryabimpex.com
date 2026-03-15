import React, { useState, useEffect } from 'react';
import { Mic, MicOff, X } from 'lucide-react';
import { useVoiceRecognition } from '../hooks/useVoiceRecognition';
import { useVoiceSettings } from '../hooks/useVoiceSettings';
import voiceCommandService from '../services/voiceCommandService';
import { showSuccessToast, showErrorToast } from '../utils/errorHandler';
import { useNavigate } from 'react-router-dom';

/**
 * Voice Button Component
 * Provides voice input functionality with visual feedback
 */
const VoiceButton = ({
  onTranscript = null,
  onCommand = null,
  onSearch = null,
  continuous = null, // null means use settings
  showTranscript = null, // null means use settings
  className = '',
  size = 'md',
  variant = 'default' // 'default', 'floating', 'inline'
}) => {
  const navigate = useNavigate();
  const voiceSettings = useVoiceSettings();
  const [showFeedback, setShowFeedback] = useState(false);
  const [lastCommand, setLastCommand] = useState(null);

  // Use settings if props are null, otherwise use props (allows override)
  const effectiveContinuous = continuous !== null ? continuous : voiceSettings.continuous;
  const effectiveShowTranscript = showTranscript !== null ? showTranscript : voiceSettings.showTranscript;

  const {
    isListening,
    transcript,
    isSupported,
    error,
    startListening,
    stopListening,
    toggleListening
  } = useVoiceRecognition({
    onResult: (finalTranscript) => {
      handleVoiceResult(finalTranscript);
    },
    onError: (errorType, errorMessage) => {
      if (errorType !== 'aborted') {
        showErrorToast({ message: errorMessage });
      }
    },
    continuous: effectiveContinuous,
    language: voiceSettings.language
  });

  // Clean voice input - remove trailing punctuation and extra whitespace
  const cleanVoiceInput = (text) => {
    if (!text) return '';
    // Only clean if autoCleanPunctuation is enabled in settings
    if (!voiceSettings.autoCleanPunctuation) {
      return text.trim();
    }
    // Remove trailing punctuation (periods, commas, question marks, exclamation marks)
    let cleaned = text.trim().replace(/[.,!?;:]+$/, '');
    // Remove extra whitespace
    cleaned = cleaned.trim();
    return cleaned;
  };

  // Handle voice recognition result
  const handleVoiceResult = (finalTranscript) => {
    if (!finalTranscript) return;

    // Clean the transcript to remove trailing punctuation
    const cleanedTranscript = cleanVoiceInput(finalTranscript);

    // Call onTranscript callback if provided
    if (onTranscript) {
      onTranscript(cleanedTranscript);
    }

    // Parse and execute command (use cleaned transcript)
    const commandResult = voiceCommandService.execute(cleanedTranscript, {
      currentPath: window.location.pathname
    });

    if (commandResult.success) {
      setLastCommand(commandResult);
      setShowFeedback(true);

      // Handle different command types
      const { result } = commandResult;

      switch (result.type) {
        case 'navigation':
          if (result.route) {
            showSuccessToast({ message: result.message });
            setTimeout(() => {
              navigate(result.route);
            }, 500);
          } else {
            showErrorToast({ message: result.message });
          }
          break;

        case 'search':
          if (onSearch) {
            // Clean the search query before passing it
            const cleanedQuery = cleanVoiceInput(result.query);
            onSearch(cleanedQuery);
          } else {
            showSuccessToast({ message: result.message });
          }
          break;

        case 'add_product':
        case 'add_customer':
          if (onCommand) {
            onCommand(result);
          } else {
            showSuccessToast({ message: result.message });
          }
          break;

        case 'action':
          if (onCommand) {
            onCommand(result);
          } else {
            showSuccessToast({ message: result.message });
          }
          break;

        case 'set_quantity':
        case 'set_amount':
        case 'set_price':
          if (onCommand) {
            onCommand(result);
          } else {
            showSuccessToast({ message: result.message });
          }
          break;

        default:
          // Default: treat as search (use cleaned transcript)
          if (onSearch) {
            onSearch(cleanedTranscript);
          }
      }

      // Call onCommand callback if provided
      if (onCommand) {
        onCommand(commandResult);
      }
    } else {
      // If command parsing failed, treat as search (use cleaned transcript)
      if (onSearch) {
        onSearch(cleanedTranscript);
      } else if (onTranscript) {
        // Fallback to transcript callback
        onTranscript(cleanedTranscript);
      }
    }

    // Hide feedback after 3 seconds
    setTimeout(() => {
      setShowFeedback(false);
    }, 3000);
  };

  // Show error toast when error occurs
  useEffect(() => {
    if (error && error !== 'aborted') {
      showErrorToast({ message: error });
    }
  }, [error]);

  // Size classes
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12'
  };

  // Variant styles
  const variantStyles = {
    default: isListening
      ? 'bg-red-500 hover:bg-red-600 text-white'
      : 'bg-primary-600 hover:bg-primary-700 text-white',
    floating: isListening
      ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg'
      : 'bg-primary-600 hover:bg-primary-700 text-white shadow-md',
    inline: isListening
      ? 'bg-red-100 hover:bg-red-200 text-red-700 border-red-300'
      : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-300'
  };

  if (!isSupported) {
    return null; // Don't show button if not supported
  }

  const buttonClasses = `
    ${sizeClasses[size]}
    ${variantStyles[variant]}
    rounded-full
    flex items-center justify-center
    transition-all duration-200
    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500
    ${isListening ? 'animate-pulse' : ''}
    ${className}
  `;

  if (variant === 'floating') {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={toggleListening}
          className={buttonClasses}
          title={isListening ? 'Stop listening' : 'Start voice input'}
          aria-label={isListening ? 'Stop listening' : 'Start voice input'}
        >
          {isListening ? (
            <MicOff className="h-5 w-5" />
          ) : (
            <Mic className="h-5 w-5" />
          )}
        </button>

        {/* Feedback overlay */}
        {showFeedback && lastCommand && (
          <div className="absolute bottom-16 right-0 bg-white rounded-lg shadow-xl p-4 min-w-[200px] max-w-[300px] border border-gray-200">
            <div className="flex items-start justify-between mb-2">
              <span className="text-sm font-medium text-gray-900">Voice Command</span>
              <button
                onClick={() => setShowFeedback(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {showTranscript && transcript && (
              <p className="text-xs text-gray-600 mb-2">"{transcript}"</p>
            )}
            <p className="text-sm text-gray-700">{lastCommand.result?.message || 'Command executed'}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={toggleListening}
        className={buttonClasses}
        title={isListening ? 'Stop listening' : 'Start voice input'}
        aria-label={isListening ? 'Stop listening' : 'Start voice input'}
      >
        {isListening ? (
          <MicOff className={`${size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-6 w-6' : 'h-5 w-5'}`} />
        ) : (
          <Mic className={`${size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-6 w-6' : 'h-5 w-5'}`} />
        )}
      </button>

      {/* Transcript display */}
      {showTranscript && transcript && isListening && (
        <div className="absolute top-full mt-2 left-0 bg-white rounded-lg shadow-lg p-3 min-w-[200px] max-w-[300px] border border-gray-200 z-10">
          <p className="text-sm text-gray-700">
            <span className="font-medium">Listening:</span> {transcript}
          </p>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="absolute top-full mt-2 left-0 bg-red-50 rounded-lg shadow-lg p-3 min-w-[200px] max-w-[300px] border border-red-200 z-10">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
    </div>
  );
};

export default VoiceButton;

