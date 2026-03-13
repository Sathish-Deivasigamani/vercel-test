export const ApiConfig = {
  // Change this to your API server URL
  // BASE_URL: 'http://192.168.29.230:8000/api',
  // BASE_URL: 'http://127.0.0.1:8000/api',
  // BASE_URL: 'http://156.67.214.40:9101/api',
  // BASE_URL: 'https://lfl-backend-5t1t.onrender.com/api',
  BASE_URL: 'https://kong-2e35c2debain9rdse.kongcloud.dev/api',
  // Storage keys for device and tokens
  STORAGE_KEYS: {
    DEVICE_ID: 'lfl_device_id',
    ACCESS_TOKEN: 'lfl_access_token',
    REFRESH_TOKEN: 'lfl_refresh_token',
    // Stores a JSON string of user info returned by the backend (email, name, picture, etc.)
    USER: 'lfl_user',
  },
}