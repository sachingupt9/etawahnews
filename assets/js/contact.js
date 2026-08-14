/* ===================================================================
   contact.js — Wires the Contact Us form to the backend API.
   Real submission only: POSTs to /api/contact/submit and displays
   the returned Query ID. No localStorage simulation.
=================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('#contact-form');
  if (!form) return;

  const fields = {
    fullName: form.querySelector('#fullName'),
    email: form.querySelector('#email'),
    mobile: form.querySelector('#mobile'),
    subject: form.querySelector('#subject'),
    queryType: form.querySelector('#queryType'),
    message: form.querySelector('#message'),
    attachment: form.querySelector('#attachment'),
    consent: form.querySelector('#consent')
  };
  const submitBtn = form.querySelector('#contact-submit-btn');
  const formCard = document.querySelector('#form-card-body');
  const successPanel = document.querySelector('#success-panel');

  // Character counter for message
  const MAX_MESSAGE = 1000;
  const counterEl = document.querySelector('#message-char-count');
  fields.message.addEventListener('input', () => {
    const len = fields.message.value.length;
    if (counterEl) counterEl.textContent = `${len} / ${MAX_MESSAGE}`;
  });

  function wrapperOf(field){ return field.closest('.form-group'); }

  function validateForm(){
    let valid = true;

    const checks = [
      [fields.fullName, Validate.required(fields.fullName.value), 'Full name is required.'],
      [fields.email, Validate.required(fields.email.value) && Validate.isEmail(fields.email.value), 'Enter a valid email address.'],
      [fields.mobile, Validate.required(fields.mobile.value) && Validate.isIndianMobile(fields.mobile.value), 'Enter a valid 10-digit Indian mobile number.'],
      [fields.subject, Validate.required(fields.subject.value) && Validate.withinLength(fields.subject.value, 150), 'Subject is required (max 150 characters).'],
      [fields.queryType, Validate.required(fields.queryType.value), 'Please select a query type.'],
      [fields.message, Validate.required(fields.message.value) && Validate.withinLength(fields.message.value, MAX_MESSAGE), `Message is required (max ${MAX_MESSAGE} characters).`],
    ];

    checks.forEach(([field, ok, msg]) => {
      const wrapper = wrapperOf(field);
      if (!ok){ Validate.showError(wrapper, msg); valid = false; }
      else Validate.clearError(wrapper);
    });

    // File
    const file = fields.attachment.files[0];
    const fileCheck = Validate.isValidFile(file);
    const fileWrapper = wrapperOf(fields.attachment);
    if (!fileCheck.valid){ Validate.showError(fileWrapper, fileCheck.reason); valid = false; }
    else Validate.clearError(fileWrapper);

    // Consent
    const consentWrapper = wrapperOf(fields.consent);
    if (!fields.consent.checked){ Validate.showError(consentWrapper, 'You must consent before submitting.'); valid = false; }
    else Validate.clearError(consentWrapper);

    return valid;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateForm()){
      PV.toast('Please fix the highlighted fields.', 'error');
      return;
    }

    submitBtn.disabled = true;
    const originalLabel = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="spinner"></span> Submitting...';

    try{
      const formData = new FormData();
      formData.append('fullName', fields.fullName.value.trim());
      formData.append('email', fields.email.value.trim());
      formData.append('mobile', fields.mobile.value.trim());
      formData.append('subject', fields.subject.value.trim());
      formData.append('queryType', fields.queryType.value);
      formData.append('message', fields.message.value.trim());
      if (fields.attachment.files[0]) formData.append('attachment', fields.attachment.files[0]);

      const res = await fetch(`${PV.API_BASE}/contact/submit`, {
        method: 'POST',
        body: formData
      });

      const data = await res.json();

      if (!res.ok || !data.success){
        throw new Error(data.message || 'Submission failed. Please try again.');
      }

      // Success UI
      if (formCard) formCard.style.display = 'none';
      if (successPanel){
        successPanel.style.display = 'block';
        successPanel.querySelector('#query-id-output').textContent = data.queryId;
      }
      PV.toast('Your query has been successfully registered.', 'success');
      form.reset();

    }catch(err){
      console.error(err);
      PV.toast(err.message || 'Could not reach the server. Is the backend running on port 4000?', 'error', 6000);
    }finally{
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalLabel;
    }
  });
});
