import React from 'react'
import { Link } from 'react-router-dom'
import { Rocket, Shield, ExternalLink } from 'lucide-react'

export default function CodeSigning() {
  return (
    <div className="min-h-screen bg-sc-darker py-12 px-6">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <Link to="/" className="inline-flex items-center gap-2 mb-4">
            <Rocket className="w-6 h-6 text-sc-accent" />
            <span className="font-display font-bold text-lg tracking-wider text-sc-accent">SC BRIDGE</span>
          </Link>
          <h1 className="font-display font-bold text-2xl text-white tracking-wider">Code Signing Policy</h1>
          <p className="text-sm text-gray-500 mt-2 font-mono">SC Bridge Companion App</p>
        </div>

        <div className="panel p-8 space-y-8 text-sm text-gray-300 leading-relaxed">
          <section>
            <h2 className="font-display text-base font-bold text-white mb-3 uppercase tracking-wider">Code Signing</h2>
            <p className="mb-3">
              SC Bridge Companion Windows binaries (.exe and .msi) are digitally signed using Authenticode code signing.
            </p>
            <p>
              Free code signing provided by{' '}
              <a href="https://signpath.io" target="_blank" rel="noopener noreferrer" className="text-sc-accent hover:underline">
                SignPath.io
              </a>
              , certificate by{' '}
              <a href="https://signpath.org" target="_blank" rel="noopener noreferrer" className="text-sc-accent hover:underline">
                SignPath Foundation
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="font-display text-base font-bold text-white mb-3 uppercase tracking-wider">Build Process</h2>
            <p className="mb-3">All release binaries are built and signed through the following process:</p>
            <ol className="list-decimal list-inside space-y-2 text-gray-400">
              <li>Source code is committed to the public GitHub repository</li>
              <li>A version tag triggers the GitHub Actions build workflow</li>
              <li>The workflow runs on <strong className="text-gray-300">GitHub-hosted runners</strong> (not self-hosted)</li>
              <li>Wails CLI compiles the Go backend and React frontend into a Windows executable</li>
              <li>WiX Toolset builds the MSI installer</li>
              <li>Unsigned artifacts are submitted to SignPath for signing</li>
              <li>A designated approver manually reviews and approves the signing request</li>
              <li>Signed binaries are published to GitHub Releases</li>
            </ol>
          </section>

          <section>
            <h2 className="font-display text-base font-bold text-white mb-3 uppercase tracking-wider">Team & Roles</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="py-2 pr-4 text-gray-400 font-mono text-xs uppercase">Name</th>
                    <th className="py-2 pr-4 text-gray-400 font-mono text-xs uppercase">GitHub</th>
                    <th className="py-2 text-gray-400 font-mono text-xs uppercase">Roles</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-white/5">
                    <td className="py-2 pr-4 text-gray-300">Gavin</td>
                    <td className="py-2 pr-4">
                      <a href="https://github.com/gavtastic" target="_blank" rel="noopener noreferrer" className="text-sc-accent hover:underline font-mono text-xs">
                        @gavtastic
                      </a>
                    </td>
                    <td className="py-2 text-gray-400">Author, Reviewer, Approver</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="font-display text-base font-bold text-white mb-3 uppercase tracking-wider">Privacy</h2>
            <p className="mb-3">
              The SC Bridge Companion app will not transfer any information to other networked systems unless
              specifically requested by the user or explicitly stated in the documentation.
            </p>
            <p>
              When the user connects the companion app to their SC Bridge account, game events are synced to
              scbridge.app over HTTPS. No telemetry, analytics, or crash reporting data is collected or transmitted.
            </p>
            <p className="mt-3">
              See our full{' '}
              <Link to="/privacy" className="text-sc-accent hover:underline">Privacy Policy</Link>
              {' '}for details.
            </p>
          </section>

          <section>
            <h2 className="font-display text-base font-bold text-white mb-3 uppercase tracking-wider">Verification</h2>
            <p className="mb-3">To verify a signed binary:</p>
            <ol className="list-decimal list-inside space-y-2 text-gray-400">
              <li>Right-click the .exe or .msi file in Windows Explorer</li>
              <li>Select <strong className="text-gray-300">Properties</strong> → <strong className="text-gray-300">Digital Signatures</strong> tab</li>
              <li>The signer should be <strong className="text-gray-300">SignPath Foundation</strong></li>
              <li>Click <strong className="text-gray-300">Details</strong> → <strong className="text-gray-300">View Certificate</strong> to inspect the certificate chain</li>
            </ol>
          </section>

          <section>
            <h2 className="font-display text-base font-bold text-white mb-3 uppercase tracking-wider">Source Code & Downloads</h2>
            <div className="flex flex-col gap-2">
              <a href="https://github.com/SC-Bridge/sc-companion" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sc-accent hover:underline">
                <ExternalLink size={14} /> Source code on GitHub
              </a>
              <a href="https://github.com/SC-Bridge/sc-companion/releases" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sc-accent hover:underline">
                <ExternalLink size={14} /> Download signed releases
              </a>
            </div>
          </section>
        </div>

        <div className="text-center mt-8 text-xs text-gray-600">
          <Link to="/" className="hover:text-gray-400 transition-colors">Back to SC Bridge</Link>
        </div>
      </div>
    </div>
  )
}
