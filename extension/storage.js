/**
 * Chrome Storage Utility Module
 * Manages authentication state in Chrome's local storage
 */

/**
 * Save authentication state to Chrome Storage
 * @param {string} token - JWT token
 * @param {Object} user - User object with id, email, fullName
 * @param {string} expiresAt - ISO 8601 timestamp
 * @param {boolean} isGuest - Whether this is a guest session
 */
async function saveAuthState(token, user, expiresAt, isGuest = false) {
  try {
    await chrome.storage.local.set({
      auth: {
        token,
        user,
        expiresAt,
        isGuest
      }
    });
    return true;
  } catch (error) {
    console.error('Failed to save auth state:', error);
    return false;
  }
}

/**
 * Load authentication state from Chrome Storage
 * @returns {Promise<Object|null>} Auth state or null if not found
 */
async function loadAuthState() {
  try {
    const result = await chrome.storage.local.get('auth');
    return result.auth || null;
  } catch (error) {
    console.error('Failed to load auth state:', error);
    return null;
  }
}

/**
 * Clear authentication state from Chrome Storage
 */
async function clearAuthState() {
  try {
    await chrome.storage.local.remove('auth');
    return true;
  } catch (error) {
    console.error('Failed to clear auth state:', error);
    return false;
  }
}

/**
 * Calculate expiration date (30 days from now)
 * @returns {string} ISO 8601 timestamp
 */
function calculateExpiresAt() {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));
  return expiresAt.toISOString();
}
