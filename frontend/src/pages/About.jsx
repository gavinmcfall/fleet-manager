import React from 'react'
import { Rocket, Heart, ExternalLink, Shield, Dog, Users } from 'lucide-react'
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
    avatar: '/team/mr_xul.png',
    bio: 'Mr_Xul is an idea generating machine who has focused his skills directly at SC Bridge. He has been around since day one of Star Citizen and has more than 16,000 hours in the game. Retired now, Mr_Xul owned his own high-end gaming computer company for a number of years and enjoys taking the time to help people and facilitate their enjoyment of video games. In Star Citizen you will find him leading his Org \u201CThe Exelus Corporation\u201D or broadcasting network \u201CPulseNet\u201D while traveling the \u2019Verse seeking the next adventure.',
  },
  {
    name: 'Mallachi',
    role: 'Business & Strategy',
    avatar: '/team/mallachi.png',
    bio: 'Mallachi is a business enthusiast, not shying away from the opportunity to seek solutions where others might have given up. No matter the game, Mallachi focuses on finding pleasure in the industrial aspects of the game, and often finds himself staring down informational rabbitholes in search of ways to do things \u201Cthe different way\u201D. Otherwise a lover of good drinks, fine cigars, and great stories from the \u2019verse.',
  },
]

const COMPANIONS = [
  {
    name: 'Nova',
    title: 'Bridge Companion',
    role: 'Morale Officer',
    avatar: '/team/nova.png',
    icon: Heart,
    accentColor: 'text-pink-400',
    ringColor: 'ring-pink-400/30',
    badgeBg: 'bg-pink-400/10',
    badgeBorder: 'border-pink-400/20',
    badgeText: 'text-pink-400',
    bio: 'Nova serves as SC-Bridge\u2019s unofficial morale officer. A Miniature Schnauzer of refined composure, she approaches every situation \u2014 and every visitor \u2014 with calm confidence and unconditional affection. Her primary duty is ensuring crew wellbeing through mandatory nose licks. No exceptions. No escape.',
  },
  {
    name: 'Blaze',
    title: 'Bridge Companion',
    role: 'Chief Security Officer',
    avatar: '/team/blaze.png',
    icon: Shield,
    accentColor: 'text-amber-400',
    ringColor: 'ring-amber-400/30',
    badgeBg: 'bg-amber-400/10',
    badgeBorder: 'border-amber-400/20',
    badgeText: 'text-amber-400',
    bio: 'Blaze takes perimeter defence very seriously. As SC-Bridge\u2019s self-appointed Chief Security Officer, this Miniature Schnauzer maintains a zero-tolerance policy on suspicious noises, unexpected deliveries, unidentified debris drifting past the viewport, and quantum drive spoolups without prior authorisation. Ever vigilant. Ever loud.',
  },
]

function TeamCard({ member, index }) {
  return (
    <div
      className="panel-hover p-6 flex flex-col sm:flex-row gap-6 items-start"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="shrink-0">
        <img
          src={member.avatar}
          alt={member.name}
          className="w-32 h-32 rounded-lg object-cover ring-1 ring-sc-border"
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <h4 className="font-display font-bold text-lg text-white">{member.name}</h4>
          <span className="text-[10px] font-mono uppercase tracking-wider text-sc-accent bg-sc-accent/10 border border-sc-accent/20 px-2 py-0.5 rounded">
            {member.role}
          </span>
        </div>
        <p className="text-sm text-gray-400 leading-relaxed">{member.bio}</p>
      </div>
    </div>
  )
}

function CompanionCard({ companion, index }) {
  const Icon = companion.icon
  return (
    <div
      className="panel-hover p-6 flex flex-col items-center text-center"
      style={{ animationDelay: `${(TEAM.length + index) * 80 + 100}ms` }}
    >
      <div className={`relative mb-4`}>
        <div className={`w-36 h-36 rounded-full overflow-hidden ring-2 ${companion.ringColor} bg-sc-darker`}>
          <img
            src={companion.avatar}
            alt={companion.name}
            className="w-full h-full object-cover object-top scale-110"
          />
        </div>
        <div className={`absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-sc-panel border-2 border-sc-border flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${companion.accentColor}`} />
        </div>
      </div>
      <h4 className="font-display font-bold text-lg text-white mb-1">{companion.name}</h4>
      <div className="flex flex-wrap items-center justify-center gap-2 mb-3">
        <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500">
          {companion.title}
        </span>
        <span className={`text-[10px] font-mono uppercase tracking-wider ${companion.badgeText} ${companion.badgeBg} border ${companion.badgeBorder} px-2 py-0.5 rounded`}>
          {companion.role}
        </span>
      </div>
      <p className="text-sm text-gray-400 leading-relaxed max-w-sm">{companion.bio}</p>
    </div>
  )
}

export default function About() {
  return (
    <div className="space-y-8 animate-fade-in-up">
      <PageHeader
        title="ABOUT SC BRIDGE"
        subtitle="Built by players. Fueled by passion. Guarded by Schnauzers."
      />

      {/* Mission */}
      <div className="panel p-10 text-center bg-grid">
        <Rocket className="w-14 h-14 mx-auto mb-5 text-sc-accent/50" />
        <h2 className="font-display font-bold text-2xl text-white mb-4">The Mission</h2>
        <p className="text-gray-400 text-base max-w-2xl mx-auto leading-relaxed">
          SC Bridge exists to give Star Citizen players the fleet management and game data tools they deserve.
          Track your ships, insurance, and pledges. Explore loot, shops, missions, and mining locations.
          Get AI-powered fleet recommendations. All in one place, all free.
        </p>
      </div>

      {/* Team */}
      <section>
        <div className="flex items-center gap-3 mb-4 px-1">
          <Users className="w-4 h-4 text-sc-accent2/60" />
          <h3 className="font-display text-sm font-semibold text-gray-400 uppercase tracking-wider">The Team</h3>
        </div>
        <div className="space-y-4">
          {TEAM.map((member, i) => (
            <TeamCard key={member.name} member={member} index={i} />
          ))}
        </div>
      </section>

      {/* Bridge Companions */}
      <section>
        <div className="flex items-center gap-3 mb-4 px-1">
          <Dog className="w-4 h-4 text-sc-accent2/60" />
          <h3 className="font-display text-sm font-semibold text-gray-400 uppercase tracking-wider">Bridge Companions</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {COMPANIONS.map((companion, i) => (
            <CompanionCard key={companion.name} companion={companion} index={i} />
          ))}
        </div>
      </section>

      {/* Support */}
      <div className="panel p-8 text-center bg-grid">
        <Heart className="w-10 h-10 mx-auto mb-4 text-sc-accent/50" />
        <h3 className="font-display font-bold text-xl text-white mb-2">Support SC Bridge</h3>
        <p className="text-sm text-gray-400 mb-5 max-w-md mx-auto leading-relaxed">
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
