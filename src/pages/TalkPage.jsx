import { useState } from 'react'
import { Mic, Radio } from 'lucide-react'
import VoiceNotesPanel from '../components/VoiceNotesPanel'
import LocalTalkPanel from '../components/LocalTalkPanel'

const TABS = [
  { id: 'notes', label: 'Voice Notes', icon: Mic },
  { id: 'live', label: 'Live Local Talk', icon: Radio },
]

export default function TalkPage() {
  const [tab, setTab] = useState('notes')

  return (
    <div className="flex flex-col">
      <div className="flex mx-4 mt-4 bg-slate-900 border border-slate-800 rounded-lg p-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-md transition-colors ${
              tab === id ? 'bg-emerald-600 text-white' : 'text-slate-400'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'notes' ? <VoiceNotesPanel /> : <LocalTalkPanel />}
    </div>
  )
}
