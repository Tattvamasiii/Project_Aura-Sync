/** Get a single current position as a Promise. */
export function getCurrentPosition(options = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported on this device/browser.'))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
      ...options,
    })
  })
}

/**
 * Start watching position changes. Returns a function to stop watching.
 * onUpdate receives a GeolocationPosition on every change.
 */
export function watchPosition(onUpdate, onError) {
  if (!navigator.geolocation) {
    onError?.(new Error('Geolocation is not supported on this device/browser.'))
    return () => {}
  }

  const watchId = navigator.geolocation.watchPosition(onUpdate, onError, {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 5000,
  })

  return () => navigator.geolocation.clearWatch(watchId)
}
