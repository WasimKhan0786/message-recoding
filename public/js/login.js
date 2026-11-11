/**
 * AudioFlow - Admin Login JavaScript
 * Handles password visibility, client validation, rate-limit awareness, and session login.
 */

document.addEventListener('DOMContentLoaded', () => {
  initSessionCheck();
  initPasswordToggle();
  initLoginForm();
});

/**
 * Check if the user is already authenticated.
 * If yes, redirect to /admin automatically.
 */
async function initSessionCheck() {
  try {
    const res = await fetch('/api/auth/session');
    if (res.ok) {
      const data = await res.json();
      if (data.authenticated) {
        const urlParams = new URLSearchParams(window.location.search);
        const redirectTarget = urlParams.get('redirect') || '/admin';
        window.location.replace(redirectTarget);
      }
    }
  } catch (err) {
    // Fail silently on network errors during passive session check
  }
}

/**
 * Password show/hide toggle behavior
 */
function initPasswordToggle() {
  const toggleBtn = document.getElementById('togglePassword');
  const passwordInput = document.getElementById('password');
  const eyeOpenIcon = document.getElementById('eyeOpenIcon');
  const eyeOffIcon = document.getElementById('eyeOffIcon');

  if (!toggleBtn || !passwordInput || !eyeOpenIcon || !eyeOffIcon) return;

  toggleBtn.addEventListener('click', () => {
    const isPassword = passwordInput.getAttribute('type') === 'password';

    if (isPassword) {
      passwordInput.setAttribute('type', 'text');
      eyeOpenIcon.classList.add('hidden');
      eyeOffIcon.classList.remove('hidden');
      toggleBtn.setAttribute('aria-label', 'Hide password');
      toggleBtn.setAttribute('title', 'Hide password');
    } else {
      passwordInput.setAttribute('type', 'password');
      eyeOpenIcon.classList.remove('hidden');
      eyeOffIcon.classList.add('hidden');
      toggleBtn.setAttribute('aria-label', 'Show password');
      toggleBtn.setAttribute('title', 'Show password');
    }
  });
}

/**
 * Login form submission, client validation, and API fetch
 */
function initLoginForm() {
  const form = document.getElementById('loginForm');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const emailError = document.getElementById('emailError');
  const passwordError = document.getElementById('passwordError');
  const alertBox = document.getElementById('alertBox');
  const alertMessage = document.getElementById('alertMessage');
  const submitBtn = document.getElementById('submitBtn');
  const btnText = document.getElementById('btnText');
  const btnSpinner = document.getElementById('btnSpinner');

  if (!form || !emailInput || !passwordInput) return;

  // Clear errors on typing
  emailInput.addEventListener('input', () => {
    emailInput.classList.remove('is-invalid');
    if (emailError) emailError.textContent = '';
    hideAlert();
  });

  passwordInput.addEventListener('input', () => {
    passwordInput.classList.remove('is-invalid');
    if (passwordError) passwordError.textContent = '';
    hideAlert();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    // Validate inputs
    let hasError = false;

    if (!email) {
      showFieldError(emailInput, emailError, 'Email address is required.');
      hasError = true;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showFieldError(emailInput, emailError, 'Please enter a valid email address.');
      hasError = true;
    }

    if (!password) {
      showFieldError(passwordInput, passwordError, 'Password is required.');
      hasError = true;
    }

    if (hasError) return;

    // Set loading state
    setLoadingState(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        showAlert('success', 'Authentication successful! Redirecting...');
        
        // Retrieve redirect param or default to /admin
        const urlParams = new URLSearchParams(window.location.search);
        const redirectTarget = urlParams.get('redirect') || '/admin';

        setTimeout(() => {
          window.location.replace(redirectTarget);
        }, 700);
      } else {
        const errorMsg = data.message || data.error || 'Invalid credentials.';
        showAlert('error', errorMsg);
        passwordInput.classList.add('is-invalid');
      }
    } catch (err) {
      console.error('Login error:', err);
      showAlert('error', 'Unable to reach the server. Please check your connection.');
    } finally {
      setLoadingState(false);
    }
  });

  function showFieldError(input, errorElement, msg) {
    input.classList.add('is-invalid');
    if (errorElement) errorElement.textContent = msg;
  }

  function showAlert(type, message) {
    if (!alertBox || !alertMessage) return;
    alertBox.className = `alert-box ${type}`;
    alertMessage.textContent = message;
  }

  function hideAlert() {
    if (!alertBox) return;
    alertBox.className = 'alert-box hidden';
    if (alertMessage) alertMessage.textContent = '';
  }

  function setLoadingState(isLoading) {
    if (!submitBtn || !btnText || !btnSpinner) return;
    if (isLoading) {
      submitBtn.disabled = true;
      btnText.textContent = 'Verifying credentials...';
      btnSpinner.classList.remove('hidden');
    } else {
      submitBtn.disabled = false;
      btnText.textContent = 'Sign In to Admin';
      btnSpinner.classList.add('hidden');
    }
  }
}

