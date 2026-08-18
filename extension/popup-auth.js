/**
 * Extension Authentication Logic
 * Handles sign-in, sign-up, and guest mode flows
 */

// API Configuration
const API_URL = "https://stackapply-ai.vercel.app";
// const API_URL = "http://localhost:3000"; // For local testing

// DOM Elements
const signinTab = document.getElementById('signin-tab');
const signupTab = document.getElementById('signup-tab');
const signinForm = document.getElementById('signin-form');
const signupForm = document.getElementById('signup-form');
const guestBtn = document.getElementById('guest-btn');
const forgotPasswordLink = document.getElementById('forgot-password');
const loadingState = document.getElementById('loading-state');
const loadingMessage = document.getElementById('loading-message');
const authFormContainer = document.getElementById('auth-form-container');
const errorMessage = document.getElementById('error-message');
const successMessage = document.getElementById('success-message');

// Tab Switching
signinTab.addEventListener('click', () => {
  signinTab.classList.add('active');
  signupTab.classList.remove('active');
  signinForm.classList.remove('hidden');
  signupForm.classList.add('hidden');
  hideMessages();
});

signupTab.addEventListener('click', () => {
  signupTab.classList.add('active');
  signinTab.classList.remove('active');
  signupForm.classList.remove('hidden');
  signinForm.classList.add('hidden');
  hideMessages();
});

// Sign In Form Handler
signinForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const email = document.getElementById('signin-email').value.trim();
  const password = document.getElementById('signin-password').value;

  // Basic validation
  if (!isValidEmail(email)) {
    showError('Please enter a valid email address');
    return;
  }

  if (!password) {
    showError('Please enter your password');
    return;
  }

  await handleSignIn(email, password);
});

// Sign Up Form Handler
signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;

  // Validate email
  if (!isValidEmail(email)) {
    showError('Please enter a valid email address');
    return;
  }

  // Validate password length
  if (password.length < 8) {
    showError('Password must be at least 8 characters');
    return;
  }

  await handleSignUp(email, password);
});

// Guest Mode Handler
guestBtn.addEventListener('click', async () => {
  await handleGuestMode();
});

// Forgot Password Handler
forgotPasswordLink.addEventListener('click', (e) => {
  e.preventDefault();
  // Open password reset page in new tab
  chrome.tabs.create({
    url: `${API_URL}/auth/reset-password`
  });
  showSuccess('Password reset page opened in new tab');
});

/**
 * Handle Sign In
 */
async function handleSignIn(email, password) {
  try {
    showLoading('Signing in...');
    
    const response = await fetch(`${API_URL}/api/auth/extension/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      // Save auth state
      await saveAuthState(data.token, data.user, calculateExpiresAt(), false);
      
      // Show success and redirect to main popup
      showSuccess('Signed in successfully!');
      setTimeout(() => {
        window.location.href = 'popup.html';
      }, 800);
    } else {
      hideLoading();
      showError(data.error || 'Sign in failed. Please try again.');
    }
  } catch (error) {
    hideLoading();
    console.error('Sign in error:', error);
    showError('Could not connect to StackApply API. Check your internet connection.');
  }
}

/**
 * Handle Sign Up
 */
async function handleSignUp(email, password) {
  try {
    showLoading('Creating account...');
    
    const response = await fetch(`${API_URL}/api/auth/extension/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      // Save auth state
      await saveAuthState(data.token, data.user, calculateExpiresAt(), false);
      
      // Show success and redirect to main popup
      showSuccess('Account created successfully!');
      setTimeout(() => {
        window.location.href = 'popup.html';
      }, 800);
    } else {
      hideLoading();
      if (response.status === 409 || data.error?.includes('already registered')) {
        showError('Email already registered. Please sign in.');
        // Switch to sign-in tab
        setTimeout(() => {
          signinTab.click();
        }, 2000);
      } else {
        showError(data.error || 'Sign up failed. Please try again.');
      }
    }
  } catch (error) {
    hideLoading();
    console.error('Sign up error:', error);
    showError('Could not connect to StackApply API. Check your internet connection.');
  }
}

/**
 * Handle Guest Mode
 */
async function handleGuestMode() {
  try {
    showLoading('Entering guest mode...');
    
    const response = await fetch(`${API_URL}/api/auth/extension/guest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      // Save guest auth state
      await saveAuthState(data.token, data.user, calculateExpiresAt(), true);
      
      // Show success and redirect to main popup
      showSuccess('Using guest mode');
      setTimeout(() => {
        window.location.href = 'popup.html';
      }, 800);
    } else {
      hideLoading();
      showError('Could not activate guest mode. Please try again.');
    }
  } catch (error) {
    hideLoading();
    console.error('Guest mode error:', error);
    showError('Could not connect to StackApply API.');
  }
}

/**
 * Email validation (RFC 5322 simplified)
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * UI Helper Functions
 */
function showLoading(message) {
  loadingMessage.textContent = message;
  authFormContainer.classList.add('hidden');
  loadingState.classList.remove('hidden');
  hideMessages();
}

function hideLoading() {
  loadingState.classList.add('hidden');
  authFormContainer.classList.remove('hidden');
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.remove('hidden');
  successMessage.classList.add('hidden');
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    errorMessage.classList.add('hidden');
  }, 5000);
}

function showSuccess(message) {
  successMessage.textContent = message;
  successMessage.classList.remove('hidden');
  errorMessage.classList.add('hidden');
}

function hideMessages() {
  errorMessage.classList.add('hidden');
  successMessage.classList.add('hidden');
}

// Check if user is already authenticated on load
document.addEventListener('DOMContentLoaded', async () => {
  const authState = await loadAuthState();
  if (authState && authState.token) {
    // User is already authenticated, redirect to main popup
    window.location.href = 'popup.html';
  }
});
