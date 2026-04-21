import React from 'react'
import { Download, ChevronDown, ExternalLink } from 'lucide-react'

const RELEASE_BASE = 'https://github.com/SC-Bridge/sc-bridge-sync/releases/latest/download'

const ChromeLogo = () => (
  <svg className="w-6 h-6 shrink-0" viewBox="0 0 24 24" fill="#4285F4" xmlns="http://www.w3.org/2000/svg"><path d="M12 0C8.21 0 4.831 1.757 2.632 4.501l3.953 6.848A5.454 5.454 0 0 1 12 6.545h10.691A12 12 0 0 0 12 0zM1.931 5.47A11.943 11.943 0 0 0 0 12c0 6.012 4.42 10.991 10.189 11.864l3.953-6.847a5.45 5.45 0 0 1-6.865-2.29zm13.342 2.166a5.446 5.446 0 0 1 1.45 7.09l.002.001h-.002l-5.344 9.257c.206.01.413.016.621.016 6.627 0 12-5.373 12-12 0-1.54-.29-3.011-.818-4.364zM12 16.364a4.364 4.364 0 1 1 0-8.728 4.364 4.364 0 0 1 0 8.728Z"/></svg>
)

const FirefoxLogo = () => (
  <svg className="w-6 h-6 shrink-0" viewBox="0 0 24 24" fill="#FF7139" xmlns="http://www.w3.org/2000/svg"><path d="M20.452 3.445a11.002 11.002 0 00-2.482-1.908C16.944.997 15.098.093 12.477.032c-.734-.017-1.457.03-2.174.144-.72.114-1.398.292-2.118.56-1.017.377-1.996.975-2.574 1.554.583-.349 1.476-.733 2.55-.992a10.083 10.083 0 013.729-.167c2.341.34 4.178 1.381 5.48 2.625a8.066 8.066 0 011.298 1.587c1.468 2.382 1.33 5.376.184 7.142-.85 1.312-2.67 2.544-4.37 2.53-.583-.023-1.438-.152-2.25-.566-2.629-1.343-3.021-4.688-1.118-6.306-.632-.136-1.82.13-2.646 1.363-.742 1.107-.7 2.816-.242 4.028a6.473 6.473 0 01-.59-1.895 7.695 7.695 0 01.416-3.845A8.212 8.212 0 019.45 5.399c.896-1.069 1.908-1.72 2.75-2.005-.54-.471-1.411-.738-2.421-.767C8.31 2.583 6.327 3.061 4.7 4.41a8.148 8.148 0 00-1.976 2.414c-.455.836-.691 1.659-.697 1.678.122-1.445.704-2.994 1.248-4.055-.79.413-1.827 1.668-2.41 3.042C.095 9.37-.2 11.608.14 13.989c.966 5.668 5.9 9.982 11.843 9.982C18.62 23.971 24 18.591 24 11.956a11.93 11.93 0 00-3.548-8.511z"/></svg>
)

const EdgeLogo = () => (
  <svg className="w-6 h-6 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="edgeG1" x1="5.01" y1="7.71" x2="21.36" y2="7.71" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#0c59a4"/><stop offset="1" stopColor="#114a8b"/></linearGradient><linearGradient id="edgeG2" x1="15.83" y1="13.81" x2="2.21" y2="13.81" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#1b9de2"/><stop offset="0.16" stopColor="#1595df"/><stop offset="0.67" stopColor="#0680d7"/><stop offset="1" stopColor="#0078d4"/></linearGradient></defs><path fill="url(#edgeG1)" d="M21.63 19.74a8.87 8.87 0 01-1 .44 9.52 9.52 0 01-3.31.59c-4.36 0-8.16-3-8.16-6.85A2.9 2.9 0 0110.68 11.3c-4.16.17-5.22 4.5-5.22 7 0 7.17 6.61 7.89 8 7.89a11.7 11.7 0 003.21-.45l.22-.07a12 12 0 004.7-2.94.5.5 0 00-.07-.71z" transform="translate(-1.24 -3.96)"/><path fill="url(#edgeG2)" d="M11.15 22.61a7.4 7.4 0 01-2.12-2 7.5 7.5 0 012.75-11.14c.29-.14.78-.39 1.44-.38a3 3 0 012.35 1.18 2.9 2.9 0 01.58 1.71c0-.02-3.37-6.88-7.83-6.88A8.76 8.76 0 00.26 13.8v.22A9 9 0 003.79 21.1 8.78 8.78 0 0011.63 22.7c-.17 0-.32-.04-.48-.09z" transform="translate(-1.24 -3.96)"/><path fill="#50e6ff" d="M15.25 16.62c-.11.14-.45.34-.45.78 0 .36.23.71.65 1a4.1 4.1 0 002.75.66 5.88 5.88 0 003-.82A6.09 6.09 0 0024.26 13a7.54 7.54 0 00-2.29-5.4A8.67 8.67 0 0015.66 5a9 9 0 00-6.41 2.63A8.74 8.74 0 006.83 13a9.29 9.29 0 012.75-5.71 6.5 6.5 0 014.3-1.34 7 7 0 014.13 1.3 7.28 7.28 0 012.47 3.73 4.55 4.55 0 01-.43 4.71z" transform="translate(-1.24 -3.96)" opacity="0.5"/></svg>
)

const OperaLogo = () => (
  <svg className="w-6 h-6 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="operaG1" x1="12" y1="0" x2="12" y2="24" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#ff1b2d"/><stop offset="0.44" stopColor="#ff1b2d"/><stop offset="0.72" stopColor="#ff1b2d"/><stop offset="1" stopColor="#a70014"/></linearGradient><linearGradient id="operaG2" x1="12" y1="4.3" x2="12" y2="19.7" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#9c0000"/><stop offset="0.7" stopColor="#ff4b4b"/></linearGradient></defs><circle cx="12" cy="12" r="12" fill="url(#operaG1)"/><ellipse cx="12" cy="12" rx="4.3" ry="7.7" fill="url(#operaG2)"/></svg>
)

const STORES = [
  {
    key: 'chrome',
    name: 'Chrome',
    subtitle: 'Chrome · Brave · Arc',
    logo: <ChromeLogo />,
    storeLabel: 'Chrome Web Store',
    storeUrl: 'https://chromewebstore.google.com/detail/sc-bridge-sync/gcokkoamjodagagbojhkimfbjjpdfefi',
    zipUrl: `${RELEASE_BASE}/sc-bridge-sync-chrome.zip`,
  },
  {
    key: 'firefox',
    name: 'Firefox',
    subtitle: 'Firefox',
    logo: <FirefoxLogo />,
    storeLabel: 'Firefox Add-ons',
    storeUrl: 'https://addons.mozilla.org/en-US/firefox/addon/sc-bridge-sync/',
    zipUrl: `${RELEASE_BASE}/sc-bridge-sync-firefox.zip`,
  },
  {
    key: 'edge',
    name: 'Edge',
    subtitle: 'Microsoft Edge',
    logo: <EdgeLogo />,
    storeLabel: 'Edge Add-ons',
    storeUrl: 'https://microsoftedge.microsoft.com/addons/detail/sc-bridge-sync/edndedmmbdbofdphimpcofdccbpbgjib',
    zipUrl: `${RELEASE_BASE}/sc-bridge-sync-edge.zip`,
  },
]

const OPERA = {
  key: 'opera',
  name: 'Opera',
  subtitle: 'Opera',
  logo: <OperaLogo />,
  zipUrl: `${RELEASE_BASE}/sc-bridge-sync-opera.zip`,
  steps: [
    'Unzip the downloaded file',
    'Open opera://extensions',
    'Enable Developer mode (top right)',
    'Click Load unpacked and select the unzipped folder',
  ],
  note: 'Opera doesn’t have an SC Bridge Sync store listing — manual sideload is the official path.',
}

function StoreCard({ browser }) {
  return (
    <div className="flex flex-col gap-2 p-3 rounded-lg border border-white/[0.06] bg-white/[0.02]">
      <div className="flex items-center gap-3">
        {browser.logo}
        <div className="flex-1 min-w-0">
          <div className="text-sm text-gray-200">{browser.name}</div>
          <div className="text-[11px] text-gray-500">{browser.subtitle}</div>
        </div>
      </div>
      <a
        href={browser.storeUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-between gap-2 px-3 py-2 rounded text-xs text-sc-accent bg-sc-accent/10 border border-sc-accent/20 hover:bg-sc-accent/20 transition-colors"
      >
        <span className="flex items-center gap-1.5"><ExternalLink className="w-3 h-3" /> {browser.storeLabel}</span>
      </a>
      <a
        href={browser.zipUrl}
        className="flex items-center justify-between gap-2 px-3 py-1.5 rounded text-[11px] text-gray-500 hover:text-gray-300 hover:bg-white/[0.04] transition-colors"
      >
        <span className="flex items-center gap-1.5"><Download className="w-3 h-3" /> Download ZIP</span>
        <span className="text-[10px] text-gray-600">manual install</span>
      </a>
    </div>
  )
}

function OperaCard() {
  return (
    <details className="group/opera rounded-lg border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <summary className="p-3 cursor-pointer select-none hover:bg-white/[0.02] transition-colors">
        <div className="flex items-center gap-3">
          {OPERA.logo}
          <div className="flex-1 min-w-0">
            <div className="text-sm text-gray-200">{OPERA.name}</div>
            <div className="text-[11px] text-gray-500">{OPERA.subtitle} · sideload only</div>
          </div>
          <ChevronDown className="w-4 h-4 text-gray-500 group-open/opera:rotate-180 transition-transform" />
        </div>
      </summary>
      <div className="px-3 pb-3 space-y-2 border-t border-white/[0.04]">
        <p className="text-[11px] text-gray-500 pt-2">{OPERA.note}</p>
        <a
          href={OPERA.zipUrl}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs text-sc-accent bg-sc-accent/10 border border-sc-accent/20 hover:bg-sc-accent/20 transition-colors"
        >
          <Download className="w-3 h-3" /> Download Opera ZIP
        </a>
        <ol className="space-y-1 text-xs text-gray-400 list-decimal list-inside">
          {OPERA.steps.map((step, i) => <li key={i}>{step}</li>)}
        </ol>
      </div>
    </details>
  )
}

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
          <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Install</h4>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {STORES.map((b) => <StoreCard key={b.key} browser={b} />)}
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Opera</h4>
          <OperaCard />
        </div>
      </div>
    </details>
  )
}
