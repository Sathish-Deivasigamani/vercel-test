import { ApiConfig } from './ApiConfig'

class DeviceManager {
  getDeviceId() {
    return localStorage.getItem(ApiConfig.STORAGE_KEYS.DEVICE_ID)
  }

  getAccessToken() {
    const token = localStorage.getItem(ApiConfig.STORAGE_KEYS.ACCESS_TOKEN)
    if (!token) {
      console.warn('No access token found in storage')
      return null
    }
    return token
  }

  getRefreshToken() {
    const token = localStorage.getItem(ApiConfig.STORAGE_KEYS.REFRESH_TOKEN)
    if (!token) {
      console.warn('No refresh token found in storage')
      return null
    }
    return token
  }

  setTokens(accessToken, refreshToken) {
    if (accessToken) {
      localStorage.setItem(ApiConfig.STORAGE_KEYS.ACCESS_TOKEN, accessToken)
      console.log('Access token stored')
    }
    if (refreshToken) {
      localStorage.setItem(ApiConfig.STORAGE_KEYS.REFRESH_TOKEN, refreshToken)
      console.log('Refresh token stored')
    }
  }

  clearTokens() {
    localStorage.removeItem(ApiConfig.STORAGE_KEYS.ACCESS_TOKEN)
    localStorage.removeItem(ApiConfig.STORAGE_KEYS.REFRESH_TOKEN)
    console.log('Tokens cleared from storage')
    // Also clear cached user info when tokens are removed
    try {
      this.clearUser()
    } catch {
      // ignore
    }
    // Notify app that user has been logged out so UI can update
    try {
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new Event('userLoggedOut'))
      }
    } catch {
      // ignore
    }
  }

  // User info helpers
  setUser(userObj) {
    try {
      if (!userObj) return
      localStorage.setItem(ApiConfig.STORAGE_KEYS.USER, JSON.stringify(userObj))
      console.log('User info stored')
    } catch (err) {
      console.error('Failed to store user info:', err)
    }
  }

  getUser() {
    try {
      const raw = localStorage.getItem(ApiConfig.STORAGE_KEYS.USER)
      if (!raw) return null
      return JSON.parse(raw)
    } catch (err) {
      console.error('Failed to parse stored user info:', err)
      return null
    }
  }

  clearUser() {
    localStorage.removeItem(ApiConfig.STORAGE_KEYS.USER)
    console.log('User info cleared from storage')
  }

  // Clear tokens, user, and app-level persisted data (history, selected, settings, mode)
  clearAllData() {
    // clear tokens and user
    this.clearTokens()

    // Remove other app-specific localStorage keys used by the UI
    try {
      localStorage.removeItem('lfl_history_v1')
      localStorage.removeItem('lfl_selected_v1')
      localStorage.removeItem('lfl_mode_v1')
      localStorage.removeItem('lfl_settings_v1')
      console.log('Cleared app localStorage (history/selected/mode/settings)')
    } catch {
      // ignore
    }

    // Notify app that all data was cleared
    try {
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new Event('userLoggedOut'))
        window.dispatchEvent(new Event('allDataCleared'))
      }
    } catch {
      // ignore
    }
  }


  async loginWithGoogle(googleCredential) {
    try {
      const response = await fetch(`${ApiConfig.BASE_URL}/auth/google`, {
        method: 'POST',
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          credential: googleCredential
        })
      });

      const data = await response.json();
      console.log("Google login response:", data);

      if (!response.ok) {
        console.error("Google login failed:", data);
        return null;
      }

      await this.handleTokenResponse(data);
      return data;
    } catch (err) {
      console.error("Error calling Google login:", err);
      return null;
    }
  }


  async getPublicIp() {
    try {
      const res = await fetch('https://api.ipify.org?format=json')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      console.log('Fetched public IP:', data.ip)
      return data.ip
    } catch (err) {
      console.error('Failed to fetch public IP:', err)
      return null
    }
  }

  async getOrCreateDeviceId() {
    let deviceId = this.getDeviceId()

    if (!deviceId) {
      // Try to use the public IP as the device ID
      const ip = await this.getPublicIp()

      if (ip) {
        deviceId = ip
        console.log('Using public IP as device ID:', deviceId)
      } else {
        // Fallback to random web-based ID
        deviceId = 'web_' + Date.now().toString(36) + Math.random().toString(36).substring(2)
        console.log('Generated fallback device ID:', deviceId)
      }

      localStorage.setItem(ApiConfig.STORAGE_KEYS.DEVICE_ID, deviceId)

      // Register the device with the server using the chosen ID
      await this.registerDeviceWithServer(deviceId)
    } else {
      console.log('Using existing device ID:', deviceId)
      // Check if we have valid tokens
      const accessToken = this.getAccessToken()
      const refreshToken = this.getRefreshToken()
      console.log('Existing tokens ->', { accessToken: !!accessToken, refreshToken: !!refreshToken })
    }

    return deviceId
  }

  async registerDeviceWithServer(deviceId) {
    try {
      console.log('Registering device with payload:', { device_id: deviceId })

      const response = await fetch(`${ApiConfig.BASE_URL}/auth/device`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ device_id: deviceId }),
      })

      // Log the full response for debugging
      console.log('Registration response status:', response.status)
      const responseText = await response.text()
      console.log('Registration response body:', responseText)

      let jsonResponse;
      try {
        jsonResponse = JSON.parse(responseText);
      } catch {
        console.error('Failed to parse response:', responseText);
        return;
      }

      if (response.ok) {
        await this.handleTokenResponse(jsonResponse)
      } else {
        // Use parsed jsonResponse for error handling
        const errorData = jsonResponse || {}

        const isAlreadyRegistered =
          (errorData.detail && String(errorData.detail).toLowerCase().includes('already registered')) ||
          (errorData.message && String(errorData.message).toLowerCase().includes('device_already_registered')) ||
          errorData.error_code === 'DEVICE_ALREADY_REGISTERED'

        if (isAlreadyRegistered) {
          console.log('Device already registered, calling /auth/reinit...')
          await this.callReinitEndpoint(deviceId)
        } else {
          console.error('Server error:', response.status, errorData)
        }
      }
    } catch (error) {
      console.error('Error registering device:', error)
    }
  }

  async callReinitEndpoint(deviceId) {
    try {
      const response = await fetch(`${ApiConfig.BASE_URL}/auth/reinit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          device_id: deviceId,
          device_type: 'web',
          platform: 'browser'
        }),
      })

      if (response.ok) {
        await this.handleTokenResponse(await response.json())
      } else {
        console.error('Failed to reinit device:', response.status)
      }
    } catch (error) {
      console.error('Error calling reinit:', error)
    }
  }

  async refreshTokenAndGetNew(refreshToken = null) {
    const tokenToUse = refreshToken || this.getRefreshToken()
    if (!tokenToUse) return null

    console.log('Using refresh token:', tokenToUse)

    try {
      const response = await fetch(`${ApiConfig.BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ refresh_token: tokenToUse }),
      })

      if (response.ok) {
        await this.handleTokenResponse(await response.json())
        return this.getAccessToken()
      }

      console.error('Failed to refresh token:', response.status)
      return null
    } catch (error) {
      console.error('Error refreshing token:', error)
      return null
    }
  }

  async handleTokenResponse(jsonResponse) {
    console.log('Processing token response:', jsonResponse)

    // Try different common JWT response formats
    const tokens = jsonResponse.data || jsonResponse || {};
    const access_token = tokens.access_token || tokens.accessToken || tokens.token;
    const refresh_token = tokens.refresh_token || tokens.refreshToken;

    // Store both tokens at once
    this.setTokens(access_token, refresh_token)

    // Also persist basic user information if returned by the backend
    const userInfo = {}
    if (tokens.email) userInfo.email = tokens.email
    if (tokens.name) userInfo.name = tokens.name
    if (tokens.picture) userInfo.picture = tokens.picture
    if (tokens.user_id) userInfo.user_id = tokens.user_id
    if (Object.keys(userInfo).length > 0) {
      this.setUser(userInfo)
    }

    if (!access_token) {
      console.error('No access token in response:', jsonResponse)
    }
    if (!refresh_token) {
      console.warn('No refresh token in response - this might be expected')
    }
  }

}

export const deviceManager = new DeviceManager()