let audioContext: AudioContext | undefined

function getAudioContext(): AudioContext | undefined {
  try {
    audioContext ??= new AudioContext()
    return audioContext
  } catch {
    return undefined
  }
}

export function playTimerBeep() {
  const ctx = getAudioContext()

  if (!ctx) {
    return
  }

  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()

  oscillator.type = 'sine'
  oscillator.frequency.value = 880
  gain.gain.value = 0.08

  oscillator.connect(gain)
  gain.connect(ctx.destination)

  oscillator.start()
  oscillator.stop(ctx.currentTime + 0.35)
}

export function playSchoolbell() {
  const ctx = getAudioContext()

  if (!ctx) {
    return
  }

  const rings = [
    { delay: 0, frequency: 784 },
    { delay: 0.45, frequency: 988 },
    { delay: 0.95, frequency: 1175 },
  ]

  for (const ring of rings) {
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    const start = ctx.currentTime + ring.delay

    oscillator.type = 'triangle'
    oscillator.frequency.value = ring.frequency
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(0.22, start + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.9)

    oscillator.connect(gain)
    gain.connect(ctx.destination)
    oscillator.start(start)
    oscillator.stop(start + 0.95)
  }
}
