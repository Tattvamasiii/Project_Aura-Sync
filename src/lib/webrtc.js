/**
 * Local, offline peer-to-peer voice using WebRTC.
 *
 * No signaling server is used or needed — both devices must be on the same
 * local network (same WiFi, or one phone's hotspot). Connection details
 * (SDP) are exchanged manually as a text code between the two people,
 * since there's no internet available to relay that handshake
 * automatically.
 */

function waitForIceGatheringComplete(pc) {
  if (pc.iceGatheringState === 'complete') return Promise.resolve()
  return new Promise((resolve) => {
    const check = () => {
      if (pc.iceGatheringState === 'complete') {
        pc.removeEventListener('icegatheringstatechange', check)
        resolve()
      }
    }
    pc.addEventListener('icegatheringstatechange', check)
    // Safety timeout in case gathering stalls — 3s is plenty on a LAN.
    setTimeout(resolve, 3000)
  })
}

/**
 * Create a fresh RTCPeerConnection. A public STUN server is included as a
 * best-effort aid for NAT traversal — many phone hotspots apply their own
 * NAT even to devices joined to them, which can prevent a direct connection
 * using host candidates alone. If there's no internet at all, this server
 * is simply unreachable and gathering proceeds with host candidates only,
 * exactly as before — it never blocks the fully-offline case.
 */
export function createPeerConnection() {
  return new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  })
}

export async function getLocalAudioStream() {
  return navigator.mediaDevices.getUserMedia({ audio: true })
}

/** Strip whitespace/newlines that copy-paste through messaging apps often introduces. */
function sanitizeCode(code) {
  return code.replace(/\s+/g, '')
}

/** Host side: create an offer code to share with the other person. */
export async function createOfferCode(pc, stream) {
  stream.getTracks().forEach((track) => pc.addTrack(track, stream))
  const offer = await pc.createOffer()
  await pc.setLocalDescription(offer)
  await waitForIceGatheringComplete(pc)
  return btoa(JSON.stringify(pc.localDescription))
}

/** Joiner side: consume the host's offer code, produce an answer code to send back. */
export async function createAnswerCode(pc, stream, offerCode) {
  const offer = JSON.parse(atob(sanitizeCode(offerCode)))
  await pc.setRemoteDescription(offer)
  stream.getTracks().forEach((track) => pc.addTrack(track, stream))
  const answer = await pc.createAnswer()
  await pc.setLocalDescription(answer)
  await waitForIceGatheringComplete(pc)
  return btoa(JSON.stringify(pc.localDescription))
}

/** Host side: finish the handshake once the joiner's answer code is pasted back in. */
export async function acceptAnswerCode(pc, answerCode) {
  const answer = JSON.parse(atob(sanitizeCode(answerCode)))
  await pc.setRemoteDescription(answer)
}