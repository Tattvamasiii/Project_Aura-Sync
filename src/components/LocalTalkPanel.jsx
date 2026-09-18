import { useState, useRef, useEffect } from 'react'
import { Radio, Copy, Check, Mic, PhoneOff } from 'lucide-react'
import {
  createPeerConnection,
  getLocalAudioStream,
  createOfferCode,
  createAnswerCode,
  acceptAnswerCode,
} from '../lib/webrtc'

const STAGE = {
  IDLE: 'idle',
  HOSTING_WAITING_FOR_ANSWER: 'hosting_waiting_for_answer',
  JOINING_ENTER_OFFER: 'joining_enter_offer',
  JOINING_SHOW_ANSWER: 'joining_show_answer',
  CONNECTED: 'connected',
}

export default function LocalTalkPanel() {
  const [stage, setStage] = useState(STAGE.IDLE)
  const [myCode, setMyCode] = useState('')
  const [pastedCode, setPastedCode] = useState('')
  const [copied, setCopied] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)
  const [connectionState, setConnectionState] = useState('new')
  const [isTransmitting, setIsTransmitting] = useState(false)

  const pcRef = useRef(null)
  const localStreamRef = useRef(null)
  const remoteAudioRef = useRef(null)

  useEffect(() => {
    return () => cleanup()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cleanup = () => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop())
    pcRef.current?.close()
    pcRef.current = null
    localStreamRef.current = null
  }

  const setupTrackListener = (pc) => {
    pc.ontrack = (event) => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = event.streams[0]
      }
    }
    pc.onconnectionstatechange = () => {
      setConnectionState(pc.connectionState)
      if (pc.connectionState === 'connected') setStage(STAGE.CONNECTED)
      if (pc.connectionState === 'failed') {
        setErrorMsg(
          'Could not establish a direct connection. This usually means the WiFi network blocks devices from talking to each other ' +
          '("client isolation" / "AP isolation") — common on phone hotspots and public WiFi. Try a different hotspot/router, or a WiFi network you control.'
        )
      }
    }
  }

  const startHosting = async () => {
    setErrorMsg(null)
    try {
      const pc = createPeerConnection()
      pcRef.current = pc
      setupTrackListener(pc)

      const stream = await getLocalAudioStream()
      localStreamRef.current = stream
      // Muted by default — push-to-talk enables it only while held.
      stream.getAudioTracks().forEach((t) => (t.enabled = false))

      const code = await createOfferCode(pc, stream)
      setMyCode(code)
      setStage(STAGE.HOSTING_WAITING_FOR_ANSWER)
    } catch (err) {
      setErrorMsg(err.message || 'Could not start. Check microphone permission.')
    }
  }

  const startJoining = () => {
    setErrorMsg(null)
    setStage(STAGE.JOINING_ENTER_OFFER)
  }

  const submitOfferCode = async () => {
    setErrorMsg(null)
    try {
      const pc = createPeerConnection()
      pcRef.current = pc
      setupTrackListener(pc)

      const stream = await getLocalAudioStream()
      localStreamRef.current = stream
      stream.getAudioTracks().forEach((t) => (t.enabled = false))

      const answer = await createAnswerCode(pc, stream, pastedCode.trim())
      setMyCode(answer)
      setStage(STAGE.JOINING_SHOW_ANSWER)
    } catch (err) {
      setErrorMsg(`Could not read that code: ${err.message}. Make sure it was copied as one unbroken block, with no line breaks added.`)
    }
  }

  const submitAnswerCode = async () => {
    setErrorMsg(null)
    try {
      await acceptAnswerCode(pcRef.current, pastedCode.trim())
      // connectionstatechange listener will flip stage to CONNECTED
    } catch (err) {
      setErrorMsg(`Could not read that code: ${err.message}. Make sure it was copied as one unbroken block, with no line breaks added.`)
    }
  }

  const copyCode = () => {
    navigator.clipboard.writeText(myCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const endCall = () => {
    cleanup()
    setStage(STAGE.IDLE)
    setMyCode('')
    setPastedCode('')
    setConnectionState('new')
  }

  const startTransmit = () => {
    localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = true))
    setIsTransmitting(true)
  }

  const stopTransmit = () => {
    localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = false))
    setIsTransmitting(false)
  }

  return (
    <div className="flex flex-col items-center space-y-5 py-4">
      <audio ref={remoteAudioRef} autoPlay playsInline />

      <div className="text-center space-y-1 px-4">
        <h3 className="text-sm font-semibold text-white flex items-center justify-center gap-1.5">
          <Radio size={16} className="text-emerald-400" /> Live Local Talk
        </h3>
        <p className="text-[11px] text-slate-400">
          Direct phone-to-phone voice — same WiFi/hotspot, no internet needed
        </p>
      </div>

      {errorMsg && <p className="text-xs text-rose-400 px-4 text-center">{errorMsg}</p>}

      {stage === STAGE.IDLE && (
        <div className="flex gap-3 w-full max-w-md px-4">
          <button
            onClick={startHosting}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold py-3 rounded-lg"
          >
            Start Local Talk
          </button>
          <button
            onClick={startJoining}
            className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold py-3 rounded-lg border border-slate-700"
          >
            Join Local Talk
          </button>
        </div>
      )}

      {stage === STAGE.HOSTING_WAITING_FOR_ANSWER && (
        <div className="w-full max-w-md px-4 space-y-3">
          <p className="text-xs text-slate-300">1. Share this code with the other person:</p>
          <div className="relative">
            <textarea
              readOnly
              value={myCode}
              className="w-full h-24 bg-slate-800 border border-slate-700 rounded-lg p-2 text-[10px] font-mono text-slate-300 resize-none"
            />
            <button
              onClick={copyCode}
              className="absolute top-2 right-2 bg-slate-700 hover:bg-slate-600 p-1.5 rounded"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} className="text-slate-300" />}
            </button>
          </div>
          <p className="text-xs text-slate-300">2. Paste their reply code here:</p>
          <textarea
            value={pastedCode}
            onChange={(e) => setPastedCode(e.target.value)}
            placeholder="Paste reply code..."
            className="w-full h-24 bg-slate-800 border border-slate-700 rounded-lg p-2 text-[10px] font-mono text-slate-300 resize-none"
          />
          <button
            onClick={submitAnswerCode}
            disabled={!pastedCode.trim()}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-lg"
          >
            Connect
          </button>
        </div>
      )}

      {stage === STAGE.JOINING_ENTER_OFFER && (
        <div className="w-full max-w-md px-4 space-y-3">
          <p className="text-xs text-slate-300">Paste the code the other person shared:</p>
          <textarea
            value={pastedCode}
            onChange={(e) => setPastedCode(e.target.value)}
            placeholder="Paste their code..."
            className="w-full h-24 bg-slate-800 border border-slate-700 rounded-lg p-2 text-[10px] font-mono text-slate-300 resize-none"
          />
          <button
            onClick={submitOfferCode}
            disabled={!pastedCode.trim()}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-lg"
          >
            Generate Reply Code
          </button>
        </div>
      )}

      {stage === STAGE.JOINING_SHOW_ANSWER && (
        <div className="w-full max-w-md px-4 space-y-3">
          <p className="text-xs text-slate-300">Send this reply code back to them:</p>
          <div className="relative">
            <textarea
              readOnly
              value={myCode}
              className="w-full h-24 bg-slate-800 border border-slate-700 rounded-lg p-2 text-[10px] font-mono text-slate-300 resize-none"
            />
            <button
              onClick={copyCode}
              className="absolute top-2 right-2 bg-slate-700 hover:bg-slate-600 p-1.5 rounded"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} className="text-slate-300" />}
            </button>
          </div>
          <p className="text-[11px] text-slate-500">Waiting for them to connect…</p>
        </div>
      )}

      {stage === STAGE.CONNECTED && (
        <div className="flex flex-col items-center space-y-4 w-full max-w-md px-4">
          <p className="text-xs text-emerald-400 font-medium">● Connected — {connectionState}</p>

          <button
            onMouseDown={startTransmit}
            onMouseUp={stopTransmit}
            onTouchStart={startTransmit}
            onTouchEnd={stopTransmit}
            className={`w-40 h-40 rounded-full border-4 flex flex-col items-center justify-center select-none transition-all ${
              isTransmitting
                ? 'bg-rose-600 border-rose-400 scale-95 shadow-[0_0_35px_rgba(225,29,72,0.7)]'
                : 'bg-slate-800 border-emerald-500'
            }`}
          >
            <Mic size={40} className={isTransmitting ? 'text-white animate-pulse' : 'text-emerald-400'} />
            <span className="mt-2 text-xs font-semibold uppercase text-slate-100">
              {isTransmitting ? 'Transmitting' : 'Hold to Talk'}
            </span>
          </button>

          <button
            onClick={endCall}
            className="flex items-center gap-2 text-rose-400 text-xs font-medium bg-rose-950 border border-rose-800 px-4 py-2 rounded-lg hover:bg-rose-900"
          >
            <PhoneOff size={14} /> End Session
          </button>
        </div>
      )}
    </div>
  )
}