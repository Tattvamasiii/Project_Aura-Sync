import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Mic, Volume2, Play, Trash2 } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { saveVoiceNote, listVoiceNotes, deleteVoiceNote } from '../lib/voiceNotes'

export default function VoiceNotesPanel() {
  const { dbReady } = useApp()
  const [isRecording, setIsRecording] = useState(false)
  const [audioLogs, setAudioLogs] = useState([])
  const [playingId, setPlayingId] = useState(null)

  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const audioPlayerRef = useRef(null)
  const recordStartRef = useRef(null)

  const refreshLogs = useCallback(async () => {
    if (!dbReady) return
    const logs = await listVoiceNotes()
    setAudioLogs(logs)
  }, [dbReady])

  useEffect(() => {
    refreshLogs()
  }, [refreshLogs])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRecorderRef.current = new MediaRecorder(stream)
      audioChunksRef.current = []
      recordStartRef.current = Date.now()

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const durationMs = Date.now() - recordStartRef.current

        await saveVoiceNote({ blob: audioBlob, durationMs })
        await refreshLogs()

        stream.getTracks().forEach((track) => track.stop())
      }

      mediaRecorderRef.current.start()
      setIsRecording(true)
    } catch (err) {
      alert('Microphone access denied or not supported!')
      console.error(err)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const playAudio = (id, url) => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause()
    }
    audioPlayerRef.current = new Audio(url)
    setPlayingId(id)
    audioPlayerRef.current.play()
    audioPlayerRef.current.onended = () => setPlayingId(null)
  }

  const handleDelete = async (id) => {
    if (playingId === id) {
      audioPlayerRef.current?.pause()
      setPlayingId(null)
    }
    await deleteVoiceNote(id)
    await refreshLogs()
  }

  return (
    <div className="flex flex-col items-center justify-center space-y-6 py-6 px-4">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold text-white">Walkie-Talkie PTT</h2>
        <p className="text-xs text-slate-400">Hold button to capture real offline voice snippet</p>
      </div>

      <button
        onMouseDown={startRecording}
        onMouseUp={stopRecording}
        onTouchStart={startRecording}
        onTouchEnd={stopRecording}
        disabled={!dbReady}
        className={`w-44 h-44 rounded-full border-4 flex flex-col items-center justify-center transition-all duration-200 select-none cursor-pointer disabled:opacity-50 ${
          isRecording
            ? 'bg-rose-600 border-rose-400 scale-95 shadow-[0_0_35px_rgba(225,29,72,0.7)]'
            : 'bg-slate-800 border-emerald-500 shadow-lg hover:bg-slate-750'
        }`}
      >
        <Mic size={48} className={isRecording ? 'animate-pulse text-white' : 'text-emerald-400'} />
        <span className="mt-2 text-xs font-semibold tracking-wider uppercase text-slate-100">
          {isRecording ? 'Recording Voice...' : 'Hold to Speak'}
        </span>
      </button>

      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Cached Voice Feed ({audioLogs.length})
          </h3>
          <span className="text-[10px] text-emerald-400 font-mono">SQLite • Encrypted • Local</span>
        </div>

        {audioLogs.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-4">No voice recordings yet. Hold the button above to speak!</p>
        ) : (
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {audioLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between bg-slate-800 p-3 rounded-lg text-sm border border-slate-750">
                <div className="flex items-center space-x-3">
                  <Volume2 size={18} className="text-emerald-400 shrink-0" />
                  <div>
                    <p className="font-medium text-xs text-slate-200">Voice Note #{log.id}</p>
                    <p className="text-[10px] text-slate-400">
                      {new Date(log.createdAt).toLocaleTimeString()} • {(log.sizeBytes / 1024).toFixed(1)} KB
                      {!log.synced && <span className="text-amber-400"> • pending sync</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => playAudio(log.id, log.url)}
                    className="flex items-center space-x-1 text-xs bg-emerald-950 border border-emerald-800 hover:bg-emerald-900 px-3 py-1.5 rounded text-emerald-400 font-medium transition-colors"
                  >
                    <Play size={12} className="fill-current" />
                    <span>{playingId === log.id ? 'Playing...' : 'Play'}</span>
                  </button>
                  <button
                    onClick={() => handleDelete(log.id)}
                    aria-label="Delete voice note"
                    className="flex items-center justify-center bg-rose-950 border border-rose-800 hover:bg-rose-900 px-2.5 py-1.5 rounded text-rose-400 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
