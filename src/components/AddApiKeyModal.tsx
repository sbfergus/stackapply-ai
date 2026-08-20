'use client';

import { useState } from 'react';
import { X, Key, AlertCircle, ExternalLink, Eye, EyeOff } from 'lucide-react';

interface AddApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddApiKeyModal({ isOpen, onClose, onSuccess }: AddApiKeyModalProps) {
  const [provider, setProvider] = useState<'ANTHROPIC' | 'OPENAI'>('ANTHROPIC');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsValidating(true);

    try {
      const res = await fetch('/api/user/api-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey }),
      });

      const data = await res.json();

      if (data.success) {
        onSuccess();
        setApiKey('');
        onClose();
      } else {
        setError(data.error || 'Failed to save API key');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleClose = () => {
    setApiKey('');
    setShowApiKey(false);
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <Key className="w-5 h-5 text-indigo-400" />
            </div>
            <h3 className="text-xl font-semibold text-white">Add API Key</h3>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Provider Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              AI Provider
            </label>
            <div className="relative">
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as 'ANTHROPIC' | 'OPENAI')}
                className="w-full px-4 py-2.5 pr-10 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-indigo-500 focus:outline-none transition cursor-pointer [&::-webkit-appearance]:none [&::-moz-appearance]:none appearance-none"
                style={{ backgroundImage: 'none' }}
              >
                <option value="ANTHROPIC">Anthropic (Claude)</option>
                <option value="OPENAI">OpenAI (GPT)</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* API Key Input */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              API Key
            </label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={provider === 'ANTHROPIC' ? 'sk-ant-...' : 'sk-proj-...'}
                className="w-full px-4 py-2.5 pr-12 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none font-mono text-sm transition"
                required
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300 transition"
              >
                {showApiKey ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
              {provider === 'ANTHROPIC' ? (
                <>
                  Get yours at{' '}
                  <a
                    href="https://console.anthropic.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1"
                  >
                    console.anthropic.com
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </>
              ) : (
                <>
                  Get yours at{' '}
                  <a
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1"
                  >
                    platform.openai.com
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </>
              )}
            </p>
          </div>

          {/* Info Box */}
          <div className="p-3 bg-indigo-950/30 border border-indigo-900/50 rounded-lg">
            <p className="text-xs text-indigo-300">
              <strong>Why add your own key?</strong> Get unlimited AI job analyses without hitting the 5-per-account free tier limit. Your key is encrypted and never shared.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-950/30 border border-red-900/50 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isValidating || !apiKey}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
            >
              {isValidating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Validating...
                </>
              ) : (
                'Test & Save'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
