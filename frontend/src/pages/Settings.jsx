import React, { useState, useEffect } from 'react'
import { useLLMConfig, setLLMConfig, testLLMConnection } from '../hooks/useAPI'
import { Settings as SettingsIcon, Key, CheckCircle, XCircle, Loader, Trash2, Eye, EyeOff } from 'lucide-react'

export default function Settings() {
  const { data: config, refetch } = useLLMConfig()
  const [provider, setProvider] = useState('')
  const [apiKey, setAPIKey] = useState('')
  const [model, setModel] = useState('')
  const [models, setModels] = useState([])
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)

  useEffect(() => {
    if (config) {
      setProvider(config.provider || '')
      setModel(config.model || '')
    }
  }, [config])

  const handleTestConnection = async () => {
    if (!provider || !apiKey) return

    setTesting(true)
    setTestResult(null)
    setModels([])

    try {
      const result = await testLLMConnection(provider, apiKey)
      const modelsList = result.models || []
      setModels(modelsList)
      setTestResult({ success: true, modelCount: modelsList.length })

      // Auto-select first model if none selected
      if (modelsList.length > 0 && !model) {
        setModel(modelsList[0].id)
      }
    } catch (err) {
      setTestResult({ success: false, error: err.message })
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await setLLMConfig({ provider, api_key: apiKey, model })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      refetch()
      setAPIKey('') // Clear API key input after save
    } catch (err) {
      alert('Failed to save: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleClear = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to remove your LLM configuration?\n\n' +
      'This will delete your encrypted API key and model settings. ' +
      'You will need to re-configure to use AI fleet analysis.'
    )
    if (!confirmed) return

    try {
      await setLLMConfig({ provider: '', api_key: '', model: '' })
      setProvider('')
      setAPIKey('')
      setModel('')
      setModels([])
      setTestResult(null)
      await refetch() // Wait for config to reload from server
      alert('LLM configuration cleared successfully')
    } catch (err) {
      alert('Failed to clear configuration: ' + err.message)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display font-bold text-2xl tracking-wider text-white">SETTINGS</h2>
        <p className="text-xs font-mono text-gray-500 mt-1">
          Configure LLM provider for AI fleet analysis
        </p>
      </div>

      <div className="glow-line" />

      {/* Provider Selection */}
      <div className="panel">
        <div className="panel-header flex items-center gap-2">
          <SettingsIcon className="w-3.5 h-3.5" />
          LLM Provider
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-400">
            Choose your AI provider. You'll need to provide your own API key.
          </p>

          <div className="space-y-2">
            {[
              { value: 'openai', label: 'OpenAI (ChatGPT)', desc: 'GPT-4, GPT-3.5-turbo models' },
              { value: 'anthropic', label: 'Anthropic (Claude)', desc: 'Claude Opus, Sonnet, Haiku' },
              { value: 'google', label: 'Google (Gemini)', desc: 'Gemini Pro, Gemini Flash' },
            ].map((p) => (
              <label
                key={p.value}
                className={`block p-4 rounded border-2 cursor-pointer transition-colors ${
                  provider === p.value
                    ? 'border-sc-accent bg-sc-accent/10'
                    : 'border-sc-border hover:border-sc-border/50'
                }`}
              >
                <input
                  type="radio"
                  name="provider"
                  value={p.value}
                  checked={provider === p.value}
                  onChange={(e) => setProvider(e.target.value)}
                  className="mr-3"
                />
                <span className="text-white font-medium">{p.label}</span>
                <span className="text-xs text-gray-500 ml-2">{p.desc}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* API Key Input */}
      {provider && (
        <div className="panel">
          <div className="panel-header flex items-center gap-2">
            <Key className="w-3.5 h-3.5" />
            API Key
          </div>
          <div className="p-5 space-y-4">
            <p className="text-sm text-gray-400">
              Your API key is encrypted and stored securely. It never leaves your server.
            </p>

            {config?.api_key_set && (
              <div className="p-3 rounded bg-sc-accent/10 border border-sc-accent/20 text-xs text-sc-accent">
                Current key: <span className="font-mono">{config.api_key_mask}</span>
              </div>
            )}

            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setAPIKey(e.target.value)}
                placeholder="Enter your API key"
                className="w-full bg-sc-darker border border-sc-border rounded px-3 py-2 pr-10 text-sm font-mono text-gray-300 placeholder:text-gray-600 focus:outline-none focus:border-sc-accent/50"
              />
              {apiKey && (
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              )}
            </div>

            <button
              onClick={handleTestConnection}
              disabled={!apiKey || testing}
              className="btn-primary flex items-center gap-2"
            >
              {testing ? (
                <>
                  <Loader className="w-3.5 h-3.5 animate-spin" />
                  Testing Connection...
                </>
              ) : (
                'Test Connection'
              )}
            </button>

            {testResult && (
              <div
                className={`p-3 rounded flex items-center gap-2 ${
                  testResult.success
                    ? 'bg-sc-success/10 border border-sc-success/20 text-sc-success'
                    : 'bg-sc-danger/10 border border-sc-danger/20 text-sc-danger'
                }`}
              >
                {testResult.success ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Connection successful! Found {testResult.modelCount} model{testResult.modelCount !== 1 ? 's' : ''}.
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4" />
                    {testResult.error}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Model Selection */}
      {models.length > 0 && (
        <div className="panel">
          <div className="panel-header">Select Model</div>
          <div className="p-5">
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full bg-sc-darker border border-sc-border rounded px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-sc-accent/50"
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Save Button */}
      {provider && apiKey && model && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          {saved ? (
            <>
              <CheckCircle className="w-4 h-4" />
              Saved!
            </>
          ) : saving ? (
            <>
              <Loader className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Configuration'
          )}
        </button>
      )}

      {/* Clear Configuration Button */}
      {config?.api_key_set && (
        <button
          onClick={handleClear}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded border-2 border-sc-danger/30 text-sc-danger hover:bg-sc-danger/10 transition-colors text-sm font-medium"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Clear Configuration
        </button>
      )}
    </div>
  )
}
