import React from 'react'
import { Download, ChevronDown, ExternalLink } from 'lucide-react'

const BROWSERS = [
  { name: 'Chrome / Brave / Arc', file: 'sc-bridge-sync-chrome.zip', icon: (
    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="#4285F4" xmlns="http://www.w3.org/2000/svg"><path d="M12 0C8.21 0 4.831 1.757 2.632 4.501l3.953 6.848A5.454 5.454 0 0 1 12 6.545h10.691A12 12 0 0 0 12 0zM1.931 5.47A11.943 11.943 0 0 0 0 12c0 6.012 4.42 10.991 10.189 11.864l3.953-6.847a5.45 5.45 0 0 1-6.865-2.29zm13.342 2.166a5.446 5.446 0 0 1 1.45 7.09l.002.001h-.002l-5.344 9.257c.206.01.413.016.621.016 6.627 0 12-5.373 12-12 0-1.54-.29-3.011-.818-4.364zM12 16.364a4.364 4.364 0 1 1 0-8.728 4.364 4.364 0 0 1 0 8.728Z"/></svg>
  ), steps: ['Unzip the downloaded file', 'Open chrome://extensions', 'Enable Developer mode (top right)', 'Click Load unpacked and select the unzipped folder'] },
  { name: 'Firefox', file: 'sc-bridge-sync-firefox.zip', icon: (
    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="#FF7139" xmlns="http://www.w3.org/2000/svg"><path d="M20.452 3.445a11.002 11.002 0 00-2.482-1.908C16.944.997 15.098.093 12.477.032c-.734-.017-1.457.03-2.174.144-.72.114-1.398.292-2.118.56-1.017.377-1.996.975-2.574 1.554.583-.349 1.476-.733 2.55-.992a10.083 10.083 0 013.729-.167c2.341.34 4.178 1.381 5.48 2.625a8.066 8.066 0 011.298 1.587c1.468 2.382 1.33 5.376.184 7.142-.85 1.312-2.67 2.544-4.37 2.53-.583-.023-1.438-.152-2.25-.566-2.629-1.343-3.021-4.688-1.118-6.306-.632-.136-1.82.13-2.646 1.363-.742 1.107-.7 2.816-.242 4.028a6.473 6.473 0 01-.59-1.895 7.695 7.695 0 01.416-3.845A8.212 8.212 0 019.45 5.399c.896-1.069 1.908-1.72 2.75-2.005-.54-.471-1.411-.738-2.421-.767C8.31 2.583 6.327 3.061 4.7 4.41a8.148 8.148 0 00-1.976 2.414c-.455.836-.691 1.659-.697 1.678.122-1.445.704-2.994 1.248-4.055-.79.413-1.827 1.668-2.41 3.042C.095 9.37-.2 11.608.14 13.989c.966 5.668 5.9 9.982 11.843 9.982C18.62 23.971 24 18.591 24 11.956a11.93 11.93 0 00-3.548-8.511z"/></svg>
  ), steps: ['Open about:debugging#/runtime/this-firefox', 'Click Load Temporary Add-on', 'Select the downloaded zip file (no need to unzip)'], note: 'Temporary add-ons are removed when Firefox closes.' },
  { name: 'Edge', file: 'sc-bridge-sync-edge.zip', icon: (
    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="#0078D4" xmlns="http://www.w3.org/2000/svg"><path d="M21.86 17.86q.14 0 .25.12.1.13.1.25t-.11.33l-.32.46-.43.53-.44.5q-.21.25-.38.42l-.22.23q-.58.53-1.34 1.04-.76.51-1.6.91-.86.4-1.74.64t-1.67.24q-.9 0-1.69-.28-.8-.28-1.48-.78-.68-.5-1.22-1.17-.53-.66-.92-1.44-.38-.77-.58-1.6-.2-.83-.2-1.67 0-1 .32-1.96.33-.97.87-1.8.14.95.55 1.77.41.82 1.02 1.5.6.68 1.38 1.21.78.54 1.64.9.86.36 1.77.56.92.2 1.8.2 1.12 0 2.18-.24 1.06-.23 2.06-.72l.2-.1.2-.05z"/></svg>
  ), steps: ['Unzip the downloaded file', 'Open edge://extensions', 'Enable Developer mode (bottom left)', 'Click Load unpacked and select the unzipped folder'] },
]

export default function ExtensionSection() {
  return (
    <details className="group relative bg-white/[0.03] backdrop-blur-md border border-white/[0.06] rounded-xl shadow-lg shadow-black/20 animate-stagger-fade-up" style={{ animationDelay: '300ms' }}>
      <summary className="p-5 cursor-pointer select-none hover:text-gray-300 transition-colors flex items-center gap-2">
        <Download className="w-4 h-4 text-gray-500" />
        <span className="text-xs font-semibold uppercase tracking-[0.15em] text-gray-400">Get the Extension</span>
      </summary>
      <div className="px-5 pb-5 space-y-4">
        <p className="text-sm text-gray-500">
          The SC Bridge Sync extension connects to your RSI account and sends hangar data to SC Bridge.
        </p>

        <div className="space-y-2">
          <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Install from your browser store</h4>
          <div className="grid sm:grid-cols-2 gap-2">
            <a
              href="https://chromewebstore.google.com/detail/sc-bridge-sync/gcokkoamjodagagbojhkimfbjjpdfefi"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-lg border border-white/[0.06] hover:border-sc-accent/40 hover:bg-white/[0.02] transition-colors"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="#4285F4" xmlns="http://www.w3.org/2000/svg"><path d="M12 0C8.21 0 4.831 1.757 2.632 4.501l3.953 6.848A5.454 5.454 0 0 1 12 6.545h10.691A12 12 0 0 0 12 0zM1.931 5.47A11.943 11.943 0 0 0 0 12c0 6.012 4.42 10.991 10.189 11.864l3.953-6.847a5.45 5.45 0 0 1-6.865-2.29zm13.342 2.166a5.446 5.446 0 0 1 1.45 7.09l.002.001h-.002l-5.344 9.257c.206.01.413.016.621.016 6.627 0 12-5.373 12-12 0-1.54-.29-3.011-.818-4.364zM12 16.364a4.364 4.364 0 1 1 0-8.728 4.364 4.364 0 0 1 0 8.728Z"/></svg>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-200">Chrome Web Store</div>
                <div className="text-[11px] text-gray-500">Chrome · Brave · Arc</div>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-gray-500 shrink-0" />
            </a>
            <a
              href="https://addons.mozilla.org/en-US/firefox/addon/sc-bridge-sync/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-lg border border-white/[0.06] hover:border-sc-accent/40 hover:bg-white/[0.02] transition-colors"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="#FF7139" xmlns="http://www.w3.org/2000/svg"><path d="M20.452 3.445a11.002 11.002 0 00-2.482-1.908C16.944.997 15.098.093 12.477.032c-.734-.017-1.457.03-2.174.144-.72.114-1.398.292-2.118.56-1.017.377-1.996.975-2.574 1.554.583-.349 1.476-.733 2.55-.992a10.083 10.083 0 013.729-.167c2.341.34 4.178 1.381 5.48 2.625a8.066 8.066 0 011.298 1.587c1.468 2.382 1.33 5.376.184 7.142-.85 1.312-2.67 2.544-4.37 2.53-.583-.023-1.438-.152-2.25-.566-2.629-1.343-3.021-4.688-1.118-6.306-.632-.136-1.82.13-2.646 1.363-.742 1.107-.7 2.816-.242 4.028a6.473 6.473 0 01-.59-1.895 7.695 7.695 0 01.416-3.845A8.212 8.212 0 019.45 5.399c.896-1.069 1.908-1.72 2.75-2.005-.54-.471-1.411-.738-2.421-.767C8.31 2.583 6.327 3.061 4.7 4.41a8.148 8.148 0 00-1.976 2.414c-.455.836-.691 1.659-.697 1.678.122-1.445.704-2.994 1.248-4.055-.79.413-1.827 1.668-2.41 3.042C.095 9.37-.2 11.608.14 13.989c.966 5.668 5.9 9.982 11.843 9.982C18.62 23.971 24 18.591 24 11.956a11.93 11.93 0 00-3.548-8.511z"/></svg>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-200">Firefox Add-ons</div>
                <div className="text-[11px] text-gray-500">Firefox</div>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-gray-500 shrink-0" />
            </a>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Or install manually</h4>
          <div className="space-y-2">
            {BROWSERS.map((b) => (
              <details key={b.name} className="group/browser">
                <summary className="flex items-center justify-between p-3 rounded-lg border border-white/[0.06] hover:border-sc-accent/20 transition-colors cursor-pointer select-none">
                  <div className="flex items-center gap-3">
                    {b.icon}
                    <span className="text-sm text-gray-300 group-open/browser:text-white transition-colors">{b.name}</span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-500 group-open/browser:rotate-180 transition-transform" />
                </summary>
                <div className="px-3 pb-3 pt-2 space-y-2">
                  <a
                    href={`https://github.com/SC-Bridge/sc-bridge-sync/releases/latest/download/${b.file}`}
                    className="btn-secondary inline-flex items-center gap-2 text-xs"
                  >
                    <Download className="w-3.5 h-3.5" /> Download {b.name.split(' ')[0]} ZIP
                  </a>
                  <ol className="space-y-1 text-xs text-gray-400 list-decimal list-inside">
                    {b.steps.map((step, i) => <li key={i}>{step}</li>)}
                  </ol>
                  {b.note && <p className="text-[10px] text-gray-600">{b.note}</p>}
                </div>
              </details>
            ))}
          </div>
        </div>
      </div>
    </details>
  )
}
