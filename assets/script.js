(function () {
  "use strict";

  const cfg = TICKET_PORTAL_CONFIG;

  const form = document.getElementById("ticket-form");
  const submitBtn = document.getElementById("submit-btn");
  const statusBox = document.getElementById("form-status");
  const categorySelect = document.getElementById("issue-category");
  const subcategorySelect = document.getElementById("issue-subcategory");
  const prioritySelect = document.getElementById("priority");
  const fileInput = document.getElementById("attachment");
  const fileHint = document.getElementById("attachment-hint");
  const numberRows = document.getElementById("number-rows");
  const addNumberBtn = document.getElementById("add-number-btn");
  const rowTemplate = document.getElementById("number-row-template");
  const scopeRadios = form.querySelectorAll('input[name="affected_scope"]');
  const scannerModal = document.getElementById("scanner-modal");
  const scannerVideo = document.getElementById("scanner-video");
  const scannerStatus = document.getElementById("scanner-status");
  const scannerCloseBtn = document.getElementById("scanner-close-btn");
  const scannerManualBtn = document.getElementById("scanner-manual-btn");

  const MAX_NUMBERS = cfg.MAX_AFFECTED_NUMBERS || 10;

  function normalizeIccid(raw) {
    const digits = (raw || "").replace(/\D+/g, "");
    if (digits.length === 10) {
      return (cfg.ICCID_PREFIX || "") + digits;
    }
    return digits;
  }

  function addNumberRow() {
    const row = rowTemplate.content.firstElementChild.cloneNode(true);
    row.querySelector(".remove-row-btn").addEventListener("click", () => {
      row.remove();
      refreshRowControls();
    });
    const iccidEl = row.querySelector(".number-iccid");
    iccidEl.addEventListener("focusout", () => {
      iccidEl.value = normalizeIccid(iccidEl.value);
    });
    row.querySelector(".scan-iccid-btn").addEventListener("click", () => {
      openScanner(iccidEl);
    });
    numberRows.appendChild(row);
    refreshRowControls();
    return row;
  }

  // ---------------------------------------------------------------------
  // Barcode scanning (ICCID). Loads ZXing from a CDN on first use only, so
  // pages that never touch "Scan" don't pay for the library at all.
  // ---------------------------------------------------------------------
  const ZXING_SRC = "https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js";
  const ZXING_INTEGRITY = "sha384-BzBxP10ZE72aitqj5UMmUsbKFliP/DZqA8Wq+BNNhlIJDGoEd1tpkMYXOg9+n6sB";

  let zxingLoadPromise = null;
  function loadZXing() {
    if (window.ZXing) return Promise.resolve(window.ZXing);
    if (!zxingLoadPromise) {
      zxingLoadPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = ZXING_SRC;
        script.integrity = ZXING_INTEGRITY;
        script.crossOrigin = "anonymous";
        script.onload = () => resolve(window.ZXing);
        script.onerror = () => reject(new Error("Could not load the barcode scanner library"));
        document.head.appendChild(script);
      });
    }
    return zxingLoadPromise;
  }

  let activeReader = null;
  let activeTargetInput = null;

  function stopScanner() {
    if (activeReader) {
      activeReader.reset();
      activeReader = null;
    }
    scannerModal.hidden = true;
    activeTargetInput = null;
  }

  async function openScanner(targetInput) {
    activeTargetInput = targetInput;
    scannerModal.hidden = false;
    scannerStatus.className = "scanner-status";
    scannerStatus.textContent = "Loading scanner...";

    try {
      const ZXing = await loadZXing();

      // ICCID barcodes are almost always Code 128, but SIM vendors vary -
      // covering the common 1D formats here while still excluding 2D ones
      // (QR/PDF417/etc.) keeps ZXing's per-frame search fast. TRY_HARDER
      // trades a bit of speed for a meaningfully better real-world hit rate.
      const hints = new Map();
      hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
        ZXing.BarcodeFormat.CODE_128,
        ZXing.BarcodeFormat.CODE_39,
        ZXing.BarcodeFormat.CODE_93,
        ZXing.BarcodeFormat.CODABAR,
        ZXing.BarcodeFormat.ITF,
        ZXing.BarcodeFormat.EAN_13,
      ]);
      hints.set(ZXing.DecodeHintType.TRY_HARDER, true);

      const reader = new ZXing.BrowserMultiFormatReader(hints);
      activeReader = reader;
      scannerStatus.textContent =
        "Line up the barcode inside the yellow box - move closer so it fills the box.";

      // decodeFromVideoDevice(undefined, ...) can land on the front/selfie
      // camera on phones, which has no autofocus and will never resolve a
      // close-up barcode. Ask explicitly for the rear camera at a resolution
      // high enough to actually resolve barcode bars.
      await reader.decodeFromConstraints(
        {
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        },
        scannerVideo,
        (result) => {
          if (!result || !activeTargetInput) return;
          activeTargetInput.value = normalizeIccid(result.getText());
          clearFieldError(activeTargetInput);
          stopScanner();
        }
      );
    } catch (err) {
      console.error(err);
      scannerStatus.className = "scanner-status error";
      scannerStatus.textContent =
        err.name === "NotAllowedError"
          ? "Camera access was denied. Please allow camera access, or enter the ICCID manually."
          : `Could not start the camera (${err.message}). Please enter the ICCID manually.`;
    }
  }

  scannerCloseBtn.addEventListener("click", stopScanner);
  scannerManualBtn.addEventListener("click", () => {
    const target = activeTargetInput;
    stopScanner();
    if (target) target.focus();
  });
  scannerModal.addEventListener("click", (e) => {
    if (e.target === scannerModal) stopScanner();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !scannerModal.hidden) stopScanner();
  });

  function refreshRowControls() {
    const rows = numberRows.querySelectorAll(".number-row");
    const scope = form.querySelector('input[name="affected_scope"]:checked').value;
    rows.forEach((row, i) => {
      const removeBtn = row.querySelector(".remove-row-btn");
      removeBtn.hidden = scope === "single" || rows.length <= 1;
    });
    addNumberBtn.hidden = scope === "single" || rows.length >= MAX_NUMBERS;
  }

  function setScope(scope) {
    const rows = numberRows.querySelectorAll(".number-row");
    if (scope === "single") {
      // Collapse down to exactly one row.
      rows.forEach((row, i) => {
        if (i > 0) row.remove();
      });
      if (rows.length === 0) addNumberRow();
    } else if (rows.length < 2) {
      // Give multiple-number submitters a second row straight away.
      addNumberRow();
    }
    refreshRowControls();
  }

  addNumberRow();
  scopeRadios.forEach((radio) => {
    radio.addEventListener("change", () => setScope(radio.value));
  });
  addNumberBtn.addEventListener("click", () => addNumberRow());

  // Populate dropdowns from config.
  cfg.ISSUE_CATEGORIES.forEach(({ category }) => {
    const opt = document.createElement("option");
    opt.value = category;
    opt.textContent = category;
    categorySelect.appendChild(opt);
  });
  cfg.PRIORITIES.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.zammadValue;
    opt.textContent = p.label;
    prioritySelect.appendChild(opt);
  });

  categorySelect.addEventListener("change", () => {
    const entry = cfg.ISSUE_CATEGORIES.find((c) => c.category === categorySelect.value);
    subcategorySelect.innerHTML = "";

    if (!entry) {
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.disabled = true;
      placeholder.selected = true;
      placeholder.textContent = "Select an issue type first...";
      subcategorySelect.appendChild(placeholder);
      subcategorySelect.disabled = true;
      return;
    }

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.disabled = true;
    placeholder.selected = true;
    placeholder.textContent = "Select an issue detail...";
    subcategorySelect.appendChild(placeholder);

    entry.subcategories.forEach((sub) => {
      const opt = document.createElement("option");
      opt.value = sub;
      opt.textContent = sub;
      subcategorySelect.appendChild(opt);
    });
    subcategorySelect.disabled = false;
    clearFieldError(subcategorySelect);
  });

  function setStatus(kind, message) {
    statusBox.className = "form-status " + kind;
    statusBox.textContent = message;
    statusBox.hidden = false;
  }

  function clearStatus() {
    statusBox.hidden = true;
    statusBox.textContent = "";
  }

  function isValidMsisdn(value) {
    // Accepts 0821234567 or +27821234567 style numbers, 9-13 digits.
    const digits = value.replace(/[^\d+]/g, "");
    return /^(\+?\d{9,13})$/.test(digits);
  }

  function isValidIccid(value) {
    const digits = value.replace(/\s+/g, "");
    return /^\d{18,22}$/.test(digits);
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function fieldError(el, message) {
    const wrapper = el.closest(".field");
    let err = wrapper.querySelector(".field-error");
    if (!err) {
      err = document.createElement("div");
      err.className = "field-error";
      wrapper.appendChild(err);
    }
    err.textContent = message;
    wrapper.classList.add("invalid");
  }

  function clearFieldError(el) {
    const wrapper = el.closest(".field");
    wrapper.classList.remove("invalid");
    const err = wrapper.querySelector(".field-error");
    if (err) err.remove();
  }

  function validate() {
    let ok = true;
    const fields = [
      {
        el: form.company,
        test: (v) => v.trim().length > 0,
        msg: "Company / client name is required.",
      },
      {
        el: form.contact_name,
        test: (v) => v.trim().length > 0,
        msg: "Your name is required.",
      },
      {
        el: form.email,
        test: isValidEmail,
        msg: "Enter a valid email address.",
      },
      {
        el: categorySelect,
        test: (v) => v.trim().length > 0,
        msg: "Select an issue type.",
      },
      {
        el: subcategorySelect,
        test: (v) => v.trim().length > 0,
        msg: "Select an issue detail.",
      },
      {
        el: form.description,
        test: (v) => v.trim().length >= 10,
        msg: "Please describe the issue in a bit more detail (10+ characters).",
      },
    ];

    fields.forEach(({ el, test, msg }) => {
      if (!test(el.value)) {
        fieldError(el, msg);
        ok = false;
      } else {
        clearFieldError(el);
      }
    });

    const rows = numberRows.querySelectorAll(".number-row");
    rows.forEach((row) => {
      const msisdnEl = row.querySelector(".number-msisdn");
      const iccidEl = row.querySelector(".number-iccid");
      // Defensive: normally applied on blur, but catch submits that never
      // blurred the field (e.g. pressing Enter straight after typing/scanning).
      iccidEl.value = normalizeIccid(iccidEl.value);

      const msisdnVal = msisdnEl.value.trim();
      const iccidVal = iccidEl.value.trim();

      // Only one of the two is required per number - not both.
      if (!msisdnVal && !iccidVal) {
        fieldError(msisdnEl, "Enter at least the MSISDN or the ICCID.");
        fieldError(iccidEl, "Enter at least the MSISDN or the ICCID.");
        ok = false;
        return;
      }

      if (msisdnVal && !isValidMsisdn(msisdnVal)) {
        fieldError(msisdnEl, "Enter a valid MSISDN, e.g. 0821234567 or +27821234567.");
        ok = false;
      } else {
        clearFieldError(msisdnEl);
      }

      if (iccidVal && !isValidIccid(iccidVal)) {
        fieldError(iccidEl, "Enter a valid ICCID (18-22 digits, found on the SIM card).");
        ok = false;
      } else {
        clearFieldError(iccidEl);
      }
    });

    if (fileInput.files.length > 0) {
      const file = fileInput.files[0];
      if (file.size > cfg.MAX_ATTACHMENT_BYTES) {
        fieldError(
          fileInput,
          `Attachment is too large (max ${Math.round(
            cfg.MAX_ATTACHMENT_BYTES / (1024 * 1024)
          )} MB).`
        );
        ok = false;
      } else {
        clearFieldError(fileInput);
      }
    }

    return ok;
  }

  // Zammad's form API ties a "fingerprint" string (any value >30 chars) to
  // the token it issues, and checks both match on submit — so the same
  // fingerprint must be reused between the config and submit calls. Persist
  // it per browser so repeat visits behave consistently.
  function getFingerprint() {
    const key = "zammad_form_fingerprint";
    let fp = sessionStorage.getItem(key);
    if (!fp || fp.length <= 30) {
      fp = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
      sessionStorage.setItem(key, fp);
    }
    return fp;
  }

  async function getFormConfig(fingerprint) {
    const res = await fetch(`${cfg.ZAMMAD_URL}/api/v1/form_config`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ fingerprint }),
    });
    if (res.status === 403) {
      throw new Error(
        "The ticket form is not enabled on the helpdesk yet (Channels > Form must be switched on)."
      );
    }
    if (!res.ok) {
      throw new Error(`Could not reach helpdesk (status ${res.status}).`);
    }
    const data = await res.json();
    if (!data.enabled) {
      throw new Error("The ticket form is currently disabled on the helpdesk.");
    }
    if (!data.token) {
      throw new Error("Helpdesk did not return a submission token.");
    }
    return data;
  }

  async function submitTicket(formData) {
    const res = await fetch(`${cfg.ZAMMAD_URL}/api/v1/form_submit`, {
      method: "POST",
      headers: { Accept: "application/json" },
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    if (data.errors && Object.keys(data.errors).length > 0) {
      if (data.errors.spam) {
        throw new Error(data.errors.spam);
      }
      throw new Error(
        `Helpdesk rejected: ${Object.entries(data.errors)
          .map(([k, v]) => `${k} ${v}`)
          .join(", ")}`
      );
    }
    if (!res.ok) {
      throw new Error(`Helpdesk rejected the ticket (status ${res.status}).`);
    }
    return data;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearStatus();

    if (!validate()) {
      setStatus("error", "Please fix the highlighted fields and try again.");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";

    try {
      const fingerprint = getFingerprint();
      const config = await getFormConfig(fingerprint);

      const priorityLabel =
        cfg.PRIORITIES.find((p) => p.zammadValue === prioritySelect.value)?.label ||
        prioritySelect.value;

      const scope = form.querySelector('input[name="affected_scope"]:checked').value;
      const numbers = Array.from(numberRows.querySelectorAll(".number-row")).map((row) => ({
        msisdn: row.querySelector(".number-msisdn").value.trim(),
        iccid: row.querySelector(".number-iccid").value.trim(),
      }));

      const bodyLines = [
        form.description.value.trim(),
        "",
        "-- Submitted via client ticket portal --",
        `Company: ${form.company.value.trim()}`,
        `Issue: ${categorySelect.value} — ${subcategorySelect.value}`,
        `Affected: ${scope === "multiple" ? `Multiple numbers (${numbers.length})` : "Single number"}`,
        ...numbers.map((n, i) => `  ${i + 1}. MSISDN: ${n.msisdn}  |  ICCID: ${n.iccid}`),
        `Priority requested: ${priorityLabel}`,
      ];

      const formData = new FormData();
      formData.append("fingerprint", fingerprint);
      formData.append("token", config.token);
      formData.append("name", form.contact_name.value.trim());
      formData.append("email", form.email.value.trim());
      formData.append(
        "title",
        `[${form.company.value.trim()}] ${categorySelect.value} — ${subcategorySelect.value}`
      );
      formData.append("body", bodyLines.join("\n"));
      // These only land on the ticket itself as real columns if the Zammad
      // admin has added them to the `form_allowed_params` setting (see
      // README) - they are always included in the body text above as a
      // fallback either way. Multiple numbers are comma-joined since the
      // underlying ticket attributes are plain text fields, not arrays.
      formData.append("issue", categorySelect.value);
      formData.append("issue_detail", subcategorySelect.value);
      formData.append("affected_scope", scope);
      formData.append("msisdn", numbers.map((n) => n.msisdn).join(", "));
      formData.append("iccid", numbers.map((n) => n.iccid).join(", "));

      if (fileInput.files.length > 0) {
        formData.append("file[]", fileInput.files[0]);
      }

      const result = await submitTicket(formData);
      const ticketNumber = result.ticket?.number || "";

      form.reset();
      fileHint.textContent = "";
      numberRows.innerHTML = "";
      addNumberRow();
      subcategorySelect.innerHTML =
        '<option value="" disabled selected>Select an issue type first...</option>';
      subcategorySelect.disabled = true;
      setStatus(
        "success",
        ticketNumber
          ? `Ticket #${ticketNumber} logged successfully. Our helpdesk will be in touch by email.`
          : "Ticket logged successfully. Our helpdesk will be in touch by email."
      );
    } catch (err) {
      console.error(err);
      setStatus(
        "error",
        `Something went wrong submitting your ticket: ${err.message}. Please try again or email support directly.`
      );
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit ticket";
    }
  });

  fileInput.addEventListener("change", () => {
    clearFieldError(fileInput);
    fileHint.textContent = fileInput.files.length
      ? fileInput.files[0].name
      : "";
  });
})();
