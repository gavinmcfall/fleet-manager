import React from 'react'
import { Rocket, Heart, ExternalLink } from 'lucide-react'
import PageHeader from '../components/PageHeader'

const TEAM = [
  {
    name: 'Vengeance',
    role: 'Creator & Lead Developer',
    avatar: '/team/vengeance.webp',
    bio: 'Vengeance is the creator and lead developer of SC Bridge. A fleet enthusiast with 38 ships and counting \u2014 including his beloved Carrack Jean-Luc and the Idris-P James Holden \u2014 he built SC Bridge out of a need for better fleet management tooling that simply didn\u2019t exist yet. Based in New Zealand, he brings a background in QA engineering and infrastructure to the project, obsessing over reliability and accuracy. When he\u2019s not wrangling code or spreadsheets, you\u2019ll find him running cargo, flying combat ops, or naming yet another ship.',
  },
  {
    name: 'Mr_Xul',
    role: 'Ideas & Community',
    avatar: '/team/mr_xul.webp',
    bio: 'Mr_Xul is an idea generating machine who has focused his skills directly at SC Bridge. He has been around since day one of Star Citizen and has more than 16,000 hours in the game. Retired now, Mr_Xul owned his own high-end gaming computer company for a number of years and enjoys taking the time to help people and facilitate their enjoyment of video games. In Star Citizen you will find him leading his Org \u201CThe Exelus Corporation\u201D or broadcasting network \u201CPulseNet\u201D while traveling the \u2019Verse seeking the next adventure.',
  },
  {
    name: 'Mallachi',
    role: 'Business & Strategy',
    avatar: '/team/mallachi.webp',
    bio: 'Mallachi is a business enthusiast, not shying away from the opportunity to seek solutions where others might have given up. No matter the game, Mallachi focuses on finding pleasure in the industrial aspects of the game, and often finds himself staring down informational rabbitholes in search of ways to do things \u201Cthe different way\u201D. Otherwise a lover of good drinks, fine cigars, and great stories from the \u2019verse.',
  },
]

export default function About() {
  return (
    <div className="space-y-8 animate-fade-in-up">
      <PageHeader
        title="ABOUT SC BRIDGE"
        subtitle="Built by Star Citizen players, for Star Citizen players"
      />

      {/* Mission */}
      <div className="panel p-8 text-center bg-grid">
        <Rocket className="w-12 h-12 mx-auto mb-4 text-sc-accent/60" />
        <h2 className="font-display font-bold text-2xl text-white mb-3">The Mission</h2>
        <p className="text-gray-400 text-base max-w-2xl mx-auto leading-relaxed">
          SC Bridge exists to give Star Citizen players the fleet management and game data tools they deserve.
          Track your ships, insurance, and pledges. Explore loot, shops, missions, and mining locations.
          Get AI-powered fleet recommendations. All in one place, all free.
        </p>
      </div>

      {/* Team */}
      <div>
        <h3 className="font-display text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 px-1">The Team</h3>
        <div className="space-y-4">
          {TEAM.map((member) => (
            <div key={member.name} className="panel p-6 flex flex-col sm:flex-row gap-6 items-start">
              <div className="shrink-0">
                <img
                  src={member.avatar}
                  alt={member.name}
                  className="w-28 h-28 rounded-lg object-cover border-2 border-sc-border"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <h4 className="font-display font-bold text-lg text-white">{member.name}</h4>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-sc-accent bg-sc-accent/10 border border-sc-accent/20 px-2 py-0.5 rounded">
                    {member.role}
                  </span>
                </div>
                <p className="text-sm text-gray-400 leading-relaxed">{member.bio}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Support */}
      <div className="panel p-6 text-center">
        <Heart className="w-8 h-8 mx-auto mb-3 text-sc-accent/60" />
        <h3 className="font-display font-bold text-lg text-white mb-2">Support SC Bridge</h3>
        <p className="text-sm text-gray-400 mb-4 max-w-md mx-auto">
          SC Bridge is free to use and always will be. If you find it useful, consider supporting development.
        </p>
        <a
          href="https://ko-fi.com/scbridge"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary inline-flex items-center gap-2"
        >
          <Heart className="w-4 h-4" /> Support on Ko-fi
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Legal */}
      <div className="text-center space-y-2">
        <p className="text-xs text-gray-600">
          SC Bridge is a fan-made tool and is not affiliated with Cloud Imperium Games or Roberts Space Industries.
        </p>
        <a
          href="https://robertsspaceindustries.com/en/community/fan-kit-usage-policy"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block"
        >
          <img
            src="/made-by-community.png"
            alt="Made by the Community"
            className="w-10 mx-auto opacity-50 hover:opacity-80 transition-opacity"
            style={{ filter: 'invert(1) brightness(2)' }}
          />
        </a>
      </div>
    </div>
  )
}
