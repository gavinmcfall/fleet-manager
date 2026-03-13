import React from 'react'
import { User, Mail, AlertCircle, Check, Pencil, Upload, ImageOff } from 'lucide-react'
import PanelSection from '../../components/PanelSection'

export default function ProfileSection({
  user,
  name, setName,
  saving, saveMsg, error,
  newEmail, setNewEmail,
  emailMsg, emailError,
  showEmailEdit, setShowEmailEdit, setEmailError,
  avatarInfo, avatarMsg, avatarError,
  avatarUploading,
  showAvatarChoice, setShowAvatarChoice,
  onUpdateProfile,
  onRemoveAvatar,
  onSetAvatarSource,
  onGravatarOptOut,
  onAvatarUpload,
  avatarFileRef,
}) {
  return (
    <div id="section-profile" className="scroll-mt-16">
    <PanelSection title="Profile" icon={User}>
      <form onSubmit={onUpdateProfile} className="p-5 space-y-4 max-w-md">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-sc-danger/10 border border-sc-danger/30 rounded text-sc-danger text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {saveMsg && (
          <div className="flex items-center gap-2 p-3 bg-sc-success/10 border border-sc-success/30 rounded text-sc-success text-sm">
            <Check className="w-4 h-4 shrink-0" />
            <span>{saveMsg}</span>
          </div>
        )}

        {/* Avatar */}
        <div className="space-y-3">
          <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
            Avatar
          </label>

          {avatarError && (
            <div className="flex items-center gap-2 p-3 bg-sc-danger/10 border border-sc-danger/30 rounded text-sc-danger text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{avatarError}</span>
            </div>
          )}
          {avatarMsg && (
            <div className="flex items-center gap-2 p-3 bg-sc-success/10 border border-sc-success/30 rounded text-sc-success text-sm">
              <Check className="w-4 h-4 shrink-0" />
              <span>{avatarMsg}</span>
            </div>
          )}

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full border border-sc-border overflow-hidden bg-sc-darker flex items-center justify-center shrink-0">
              {avatarInfo?.userImage ? (
                <img
                  src={avatarInfo.userImage}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                  onError={(e) => { e.currentTarget.style.display = 'none' }}
                />
              ) : (
                <User className="w-5 h-5 text-gray-500" />
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {/* Default */}
              <button
                type="button"
                onClick={onRemoveAvatar}
                disabled={!avatarInfo?.userImage}
                className="px-2.5 py-1.5 text-xs border border-sc-border rounded text-gray-400 hover:text-white hover:border-gray-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Default
              </button>

              {/* Gravatar */}
              {avatarInfo?.gravatarUrl && !avatarInfo?.gravatarOptedOut && (
                <button
                  type="button"
                  onClick={() => onSetAvatarSource('gravatar')}
                  className="px-2.5 py-1.5 text-xs border border-sc-border rounded text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
                >
                  Gravatar
                </button>
              )}

              {/* RSI */}
              {avatarInfo?.rsiAvatarUrl && (
                <button
                  type="button"
                  onClick={() => onSetAvatarSource('rsi')}
                  className="px-2.5 py-1.5 text-xs border border-sc-border rounded text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
                >
                  RSI
                </button>
              )}

              {/* Upload */}
              <button
                type="button"
                onClick={() => avatarFileRef.current?.click()}
                disabled={avatarUploading}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-sc-border rounded text-gray-400 hover:text-white hover:border-gray-500 transition-colors disabled:opacity-50"
              >
                <Upload className="w-3 h-3" />
                {avatarUploading ? 'Uploading...' : 'Upload'}
              </button>
              <input
                ref={avatarFileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={onAvatarUpload}
              />
            </div>
          </div>

          {/* Gravatar opt-out toggle */}
          {avatarInfo?.gravatarUrl && (
            <button
              type="button"
              onClick={() => onGravatarOptOut(!avatarInfo?.gravatarOptedOut)}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              <ImageOff className="w-3 h-3" />
              {avatarInfo?.gravatarOptedOut ? 'Allow Gravatar detection' : 'Never use Gravatar'}
            </button>
          )}

          {/* Inline choice after RSI sync */}
          {showAvatarChoice && (
            <div className="p-3 bg-sc-darker border border-sc-border rounded space-y-3">
              <p className="text-sm text-gray-300">
                RSI avatar loaded. You also have a Gravatar — which would you like to use?
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onSetAvatarSource('rsi')}
                  className="btn-primary px-3 py-1.5 font-display tracking-wider uppercase text-xs"
                >
                  Use RSI Avatar
                </button>
                <button
                  type="button"
                  onClick={() => onSetAvatarSource('gravatar')}
                  className="px-3 py-1.5 text-xs border border-sc-border rounded text-gray-300 hover:text-white hover:border-gray-500 transition-colors"
                >
                  Use Gravatar
                </button>
                <button
                  type="button"
                  onClick={() => setShowAvatarChoice(null)}
                  className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  Skip
                </button>
              </div>
            </div>
          )}
        </div>

        <div>
          <label htmlFor="account-name" className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
            Display Name
          </label>
          <input
            id="account-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2.5 bg-sc-darker border border-sc-border rounded text-sm text-white placeholder-gray-600 focus:border-sc-accent focus:outline-none focus:ring-1 focus:ring-sc-accent/50"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
            Email
          </label>
          {emailError && (
            <div className="flex items-center gap-2 mb-2 p-3 bg-sc-danger/10 border border-sc-danger/30 rounded text-sc-danger text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{emailError}</span>
            </div>
          )}
          {emailMsg && (
            <div className="flex items-center gap-2 mb-2 p-3 bg-sc-success/10 border border-sc-success/30 rounded text-sc-success text-sm">
              <Check className="w-4 h-4 shrink-0" />
              <span>{emailMsg}</span>
            </div>
          )}
          {showEmailEdit ? (
            <div className="space-y-2">
              <input
                id="account-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full px-4 py-2.5 bg-sc-darker border border-sc-border rounded text-sm text-white placeholder-gray-600 focus:border-sc-accent focus:outline-none focus:ring-1 focus:ring-sc-accent/50"
                placeholder="New email address"
              />
              <button
                type="button"
                onClick={() => { setShowEmailEdit(false); setNewEmail(''); setEmailError(null) }}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 px-4 py-2.5 bg-sc-darker/50 border border-sc-border rounded text-sm text-gray-500">
                <Mail className="w-4 h-4" />
                {user.email}
              </div>
              <button
                type="button"
                onClick={() => { setShowEmailEdit(true); setNewEmail(user.email) }}
                className="p-2.5 border border-sc-border rounded text-gray-400 hover:text-white hover:border-sc-accent transition-colors"
                title="Change email"
              >
                <Pencil className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="btn-primary px-6 py-2 font-display tracking-wider uppercase text-sm disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </PanelSection>
    </div>
  )
}
