import axios from 'axios'
import { ApiConfig } from './ApiConfig'
import { deviceManager } from './deviceManager'

// Create axios instance with default config
const api = axios.create({
  baseURL: ApiConfig.BASE_URL,
  timeout: 30000,
})

// Add request interceptor to add auth header
api.interceptors.request.use(async (config) => {
  const token = deviceManager.getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Add response interceptor to handle 401s
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // If error is 401 and we haven't retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      try {
        // Try to refresh token
        const newToken = await deviceManager.refreshTokenAndGetNew()
        if (!newToken) {
          throw new Error('Failed to refresh token')
        }
        // Update header with new token
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        // Retry with new token
        return api(originalRequest)
      } catch (refreshError) {
        console.error('Failed to refresh token:', refreshError)
        return Promise.reject(error)
      }
    }
    return Promise.reject(error)
  }
)

class ApiClient {
  async sendPrompt(prompt, abortSignal = null) {
    try {
      // Ensure we have a token
      let token = deviceManager.getAccessToken()
      if (!token) {
        await deviceManager.getOrCreateDeviceId()
        token = deviceManager.getAccessToken()
      }

      // Send request
      const response = await api.post('/api/text/segment', 
        { text: prompt },
        { 
          signal: abortSignal,
          headers: { 'Content-Type': 'application/json' }
        }
      )

      // Handle different response shapes
      const data = response.data
      return data?.text || data?.data?.text || data?.result || JSON.stringify(data)
    } catch (error) {
      if (error.name === 'AbortError' || error.code === 'ECONNABORTED') {
        return 'Request cancelled'
      }
      console.error('Error sending prompt:', error)
      return null
    }
  }

  // Additional API methods
  async getData(signal = null) {
    try {
      const response = await api.get('/data', { signal })
      return response.data
    } catch (error) {
      console.error('Error fetching data:', error)
      throw error // Let caller handle the error
    }
  }
}

export const apiClient = new ApiClient()