/* ===================================================================
   validation.js — Reusable client-side validation helpers.
   Backend re-validates everything; this is UX-layer only.
=================================================================== */

const Validate = (() => {

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  // Indian mobile numbers: 10 digits, starting 6-9, optional +91 / 0 prefix
  const MOBILE_RE = /^(?:\+91[\-\s]?|0)?[6-9]\d{9}$/;
  const ALLOWED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  function required(value){
    return value !== undefined && value !== null && String(value).trim().length > 0;
  }
  function isEmail(value){
    return EMAIL_RE.test(String(value).trim());
  }
  function isIndianMobile(value){
    return MOBILE_RE.test(String(value).trim());
  }
  function withinLength(value, max){
    return String(value || '').length <= max;
  }
  function isValidFile(file){
    if (!file) return { valid: true };
    if (!ALLOWED_FILE_TYPES.includes(file.type)){
      return { valid: false, reason: 'File type not supported. Use PDF, JPG, PNG, DOC, or DOCX.' };
    }
    if (file.size > MAX_FILE_SIZE){
      return { valid: false, reason: 'File must be smaller than 5MB.' };
    }
    return { valid: true };
  }

  function showError(fieldWrapper, message){
    fieldWrapper.classList.add('error');
    const errEl = fieldWrapper.querySelector('.form-error');
    if (errEl) errEl.textContent = message;
  }
  function clearError(fieldWrapper){
    fieldWrapper.classList.remove('error');
    const errEl = fieldWrapper.querySelector('.form-error');
    if (errEl) errEl.textContent = '';
  }

  return { required, isEmail, isIndianMobile, withinLength, isValidFile, showError, clearError, MAX_FILE_SIZE, ALLOWED_FILE_TYPES };
})();
