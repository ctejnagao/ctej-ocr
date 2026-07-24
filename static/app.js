// State Variables
let expectedItems = [];
let scannedBoxes = [];
let activeStep = 1;

// Web Audio API Synthesized Sound Effects
const playScanBeep = () => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1000, audioCtx.currentTime); // High pitch beep
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
  } catch (e) {
    console.error("Audio Context error:", e);
  }
};

const playSuccessChime = () => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const playTone = (freq, time, duration) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.setValueAtTime(freq, time);
      gain.gain.setValueAtTime(0.1, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + duration);
      osc.start(time);
      osc.stop(time + duration);
    };
    
    const now = audioCtx.currentTime;
    // C5 - E5 - G5 - C6 Major Arpeggio
    playTone(523.25, now, 0.15); 
    playTone(659.25, now + 0.1, 0.15); 
    playTone(783.99, now + 0.2, 0.15); 
    playTone(1046.50, now + 0.3, 0.4); 
  } catch (e) {
    console.error("Audio Context error:", e);
  }
};

const playErrorBuzz = () => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, audioCtx.currentTime); // Low buzz
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.35);
  } catch (e) {
    console.error("Audio Context error:", e);
  }
};

// Loading Indicator
const showLoading = (message) => {
  document.getElementById("loading-text").innerText = message;
  document.getElementById("loading-backdrop").classList.add("active");
};

const hideLoading = () => {
  document.getElementById("loading-backdrop").classList.remove("active");
};

// Compress image utility (Max long side 1200px)
const compressImage = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const max_size = 1200;
        let width = img.width;
        let height = img.height;
        
        if (width > height) {
          if (width > max_size) {
            height *= max_size / width;
            width = max_size;
          }
        } else {
          if (height > max_size) {
            width *= max_size / height;
            height = max_size;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Canvas conversion to blob failed"));
          }
        }, "image/jpeg", 0.85); // 85% compression
      };
      img.onerror = () => reject(new Error("Image load failed"));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error("File read failed"));
    reader.readAsDataURL(file);
  });
};

// Switch Panel Wizard
const setStep = (step) => {
  activeStep = step;
  
  // Update indicator active classes
  document.querySelectorAll(".step-indicator").forEach((el, index) => {
    if (index + 1 <= step) {
      el.classList.add("active");
    } else {
      el.classList.remove("active");
    }
  });
  
  // Lines
  const line1 = document.getElementById("step-line-1");
  const line2 = document.getElementById("step-line-2");
  if (step >= 2) line1.classList.add("active"); else line1.classList.remove("active");
  if (step >= 3) line2.classList.add("active"); else line2.classList.remove("active");
  
  // Panels
  document.querySelectorAll(".panel").forEach((panel, index) => {
    if (index + 1 === step) {
      panel.classList.add("active");
    } else {
      panel.classList.remove("active");
    }
  });
};

// ----------------------------------------
// WEBRTC CAMERA MANAGER
// ----------------------------------------
const CameraManager = {
  stream: null,
  videoEl: null,
  
  async start(videoId) {
    this.videoEl = document.getElementById(videoId);
    if (!this.videoEl) return;
    
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false
      });
      this.videoEl.srcObject = this.stream;
    } catch (err) {
      console.error("Camera access error:", err);
      alert("カメラへのアクセスが拒否されたか、デバイスが見つかりません。");
    }
  },
  
  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.videoEl) {
      this.videoEl.srcObject = null;
      this.videoEl = null;
    }
  },
  
  capture(canvasId) {
    if (!this.videoEl || !this.stream) return null;
    
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    
    canvas.width = this.videoEl.videoWidth;
    canvas.height = this.videoEl.videoHeight;
    
    const ctx = canvas.getContext("2d");
    ctx.drawImage(this.videoEl, 0, 0, canvas.width, canvas.height);
    
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob);
      }, "image/jpeg", 0.95);
    });
  }
};

// ----------------------------------------
// STEP 1: INSTRUCTION SCANNERS
// ----------------------------------------

// Add row manually to expected table
const addExpectedRow = (itemName = "", quantity = 1) => {
  const tbody = document.querySelector("#table-expected-items tbody");
  const tr = document.createElement("tr");
  
  tr.innerHTML = `
    <td>
      <input type="text" class="table-input expected-name" value="${itemName}" placeholder="品番または商品名">
    </td>
    <td>
      <input type="number" class="table-input expected-qty" value="${quantity}" min="1" placeholder="数量">
    </td>
    <td>
      <button class="btn-delete-row">🗑️</button>
    </td>
  `;
  
  // Delete row handler
  tr.querySelector(".btn-delete-row").addEventListener("click", () => {
    tr.remove();
  });
  
  tbody.appendChild(tr);
};

// Instruction Camera Handlers
document.getElementById("btn-start-instruction-camera").addEventListener("click", async () => {
  document.getElementById("instruction-preview-container").style.display = "block";
  await CameraManager.start("video-instruction");
});

document.getElementById("btn-close-instruction-camera").addEventListener("click", () => {
  CameraManager.stop();
  document.getElementById("instruction-preview-container").style.display = "none";
});

document.getElementById("btn-capture-instruction").addEventListener("click", async () => {
  const blob = await CameraManager.capture("canvas-instruction");
  if (!blob) return;
  
  CameraManager.stop();
  document.getElementById("instruction-preview-container").style.display = "none";
  
  showLoading("画像を最適化中...");
  try {
    const compressedBlob = await compressImage(blob);
    const formData = new FormData();
    formData.append("file", compressedBlob, "instruction_scan.jpg");
    
    const scanType = document.querySelector('input[name="instruction_type"]:checked').value;
    const endpoint = scanType === "handwritten" ? "/api/scan/instruction" : "/api/scan/shipping-notice";
    
    showLoading("AIがテキストを解析中...");
    const res = await fetch(endpoint, {
      method: "POST",
      body: formData
    });
    
    if (!res.ok) throw new Error("Scanned API returned error status");
    const data = await res.json();
    
    const tbody = document.querySelector("#table-expected-items tbody");
    tbody.innerHTML = "";
    
    if (data.items && data.items.length > 0) {
      data.items.forEach(item => {
        addExpectedRow(item.item_name, item.quantity);
      });
      playScanBeep();
    } else {
      alert("テキストを検出できませんでした。手動で行を追加してください。");
      addExpectedRow();
    }
    
    document.getElementById("expected-items-container").classList.remove("hidden");
  } catch (err) {
    console.error(err);
    alert("エラーが発生しました: " + err.message);
    playErrorBuzz();
  } finally {
    hideLoading();
  }
});

// Add manual row button click
document.getElementById("btn-add-expected-row").addEventListener("click", () => {
  addExpectedRow();
});

// Confirm Expected list and move to Step 2
document.getElementById("btn-confirm-expected").addEventListener("click", () => {
  expectedItems = [];
  const rows = document.querySelectorAll("#table-expected-items tbody tr");
  
  rows.forEach(row => {
    const name = row.querySelector(".expected-name").value.trim();
    const qty = parseInt(row.querySelector(".expected-qty").value) || 0;
    
    if (name && qty > 0) {
      expectedItems.push({ item_name: name, quantity: qty });
    }
  });
  
  if (expectedItems.length === 0) {
    alert("少なくとも1つ以上のアイテムを登録してください。");
    return;
  }
  
  // Set initial checklist display on Step 2
  updateChecklistProgress([]);
  
  setStep(2);
});


// ----------------------------------------
// STEP 2: PHYSICAL INSPECTION CARDBOARD
// ----------------------------------------

// Cardboard Camera Handlers
document.getElementById("btn-start-cardboard-camera").addEventListener("click", async () => {
  document.getElementById("cardboard-preview-container").style.display = "block";
  await CameraManager.start("video-cardboard");
});

document.getElementById("btn-close-cardboard-camera").addEventListener("click", () => {
  CameraManager.stop();
  document.getElementById("cardboard-preview-container").style.display = "none";
});

document.getElementById("btn-capture-cardboard").addEventListener("click", async () => {
  const blob = await CameraManager.capture("canvas-cardboard");
  if (!blob) return;
  
  CameraManager.stop();
  document.getElementById("cardboard-preview-container").style.display = "none";
  
  showLoading("画像を圧縮中...");
  try {
    const compressedBlob = await compressImage(blob);
    const formData = new FormData();
    formData.append("file", compressedBlob, "cardboard_scan.jpg");
    
    showLoading("マーカー領域を検出 ＆ OCR処理中...");
    const res = await fetch("/api/scan/cardboard", {
      method: "POST",
      body: formData
    });
    
    if (!res.ok) throw new Error("Cardboard scan failed");
    const data = await res.json();
    
    if (data.items && data.items.length > 0) {
      data.items.forEach(box => {
        // Generate a temporary unique ID
        box.id = Math.random().toString(36).substr(2, 9);
        scannedBoxes.push(box);
      });
      playScanBeep();
      
      // Update Scanned Cardboard List and Match status
      renderScannedBoxes();
      runReconciliation();
    } else {
      alert("ラベルの文字を検出できませんでした。再撮影してください。");
      playErrorBuzz();
    }
  } catch (err) {
    console.error(err);
    alert("エラーが発生しました: " + err.message);
    playErrorBuzz();
  } finally {
    hideLoading();
  }
});

// Barcode Camera Scanner logic
let html5QrCode = null;

const startBarcodeScanner = () => {
  const container = document.getElementById("barcode-scanner-container");
  container.style.display = "block";
  
  if (!html5QrCode) {
    html5QrCode = new Html5Qrcode("barcode-reader");
  }
  
  const config = { 
    fps: 10, 
    qrbox: { width: 300, height: 150 },
    formatsToSupport: [
      Html5QrcodeSupportedFormats.CODE_128,
      Html5QrcodeSupportedFormats.CODE_39,
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.UPC_A,
      Html5QrcodeSupportedFormats.UPC_E,
      Html5QrcodeSupportedFormats.ITF
    ]
  };
  
  html5QrCode.start(
    { facingMode: "environment" }, 
    config,
    (decodedText, decodedResult) => {
      // on success
      stopBarcodeScanner();
      const inputEl = document.getElementById("input-barcode-scanner");
      inputEl.value = decodedText;
      handleBarcodeScan();
    },
    (errorMessage) => {
      // parse error, ignore
    }
  ).catch((err) => {
    console.error("Camera start error", err);
    alert("カメラの起動に失敗しました。権限を確認してください。");
    container.style.display = "none";
  });
};

const stopBarcodeScanner = () => {
  const container = document.getElementById("barcode-scanner-container");
  if (html5QrCode && html5QrCode.isScanning) {
    html5QrCode.stop().then(() => {
      html5QrCode.clear();
      container.style.display = "none";
    }).catch(err => {
      console.error("Stop failed", err);
      container.style.display = "none";
    });
  } else {
    container.style.display = "none";
  }
};

document.getElementById("btn-close-barcode-scanner").addEventListener("click", () => {
  stopBarcodeScanner();
});

// Barcode Scanning / Manual Entry Handler
const handleBarcodeScan = async () => {
  const inputEl = document.getElementById("input-barcode-scanner");
  const qtyEl = document.getElementById("input-barcode-qty");
  
  const barcode = inputEl.value.trim();
  const addQty = parseInt(qtyEl.value, 10) || 1;
  
  if (!barcode) return;
  
  showLoading("商品情報を確認中...");
  try {
    const res = await fetch(`/api/v1/items/${barcode}`);
    if (!res.ok) {
      if (res.status === 404) throw new Error("商品が見つかりません。");
      throw new Error("APIエラーが発生しました。");
    }
    const data = await res.json();
    
    const newItemCode = data.item_name || barcode;
    
    // Check if we already scanned this item_code via barcode
    const existing = scannedBoxes.find(b => b.item_code === newItemCode && b.color === "none");
    if (existing) {
      existing.quantity += addQty;
    } else {
      const newItem = {
        id: Math.random().toString(36).substr(2, 9),
        item_code: newItemCode,
        quantity: addQty,
        color: "none"
      };
      scannedBoxes.push(newItem);
    }
    
    playScanBeep();
    renderScannedBoxes();
    runReconciliation();
    
  } catch(err) {
    console.error(err);
    alert(err.message);
    playErrorBuzz();
  } finally {
    hideLoading();
    inputEl.value = "";
    qtyEl.value = "1"; // Reset quantity to 1
    inputEl.focus();
  }
};

document.getElementById("btn-add-barcode").addEventListener("click", handleBarcodeScan);
document.getElementById("input-barcode-scanner").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    handleBarcodeScan();
  }
});
document.getElementById("input-barcode-scanner").addEventListener("focus", () => {
  startBarcodeScanner();
});

// Render scanned box cards
const renderScannedBoxes = () => {
  const container = document.getElementById("scanned-boxes-list");
  container.innerHTML = "";
  
  if (scannedBoxes.length === 0) {
    container.innerHTML = `<div class="empty-state">段ボールがスキャンされていません。カメラで読み取ってください。</div>`;
    return;
  }
  
  scannedBoxes.forEach(box => {
    const card = document.createElement("div");
    card.className = "scanned-box-card";
    
    const colorTagClass = box.color === "green" ? "tag-green" : (box.color === "red" ? "tag-red" : "tag-none");
    const colorLabel = box.color === "green" ? "緑マーカー" : (box.color === "red" ? "赤マーカー" : "マーカーなし");
    
    card.innerHTML = `
      <div class="box-card-details">
        <span class="box-code">${box.item_code || "不明"}</span>
        <span class="box-qty">数量: ${box.quantity || 0} 個</span>
        <div>
          <span class="box-marker-tag ${colorTagClass}">${colorLabel}</span>
        </div>
      </div>
      <button class="btn-delete-row" data-id="${box.id}">🗑️</button>
    `;
    
    // Wire delete button
    card.querySelector(".btn-delete-row").addEventListener("click", () => {
      scannedBoxes = scannedBoxes.filter(b => b.id !== box.id);
      renderScannedBoxes();
      runReconciliation();
    });
    
    container.appendChild(card);
  });
};

// Run backend Match check and update visual status
const runReconciliation = async () => {
  try {
    const res = await fetch("/api/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expected: expectedItems,
        scanned: scannedBoxes
      })
    });
    
    if (!res.ok) throw new Error("Match call failed");
    const result = await res.json();
    
    updateChecklistProgress(result.matches);
    
    // Update Match Status bar
    const statusBar = document.getElementById("matching-status-panel");
    const statusTitle = document.getElementById("status-title");
    const statusDesc = document.getElementById("status-desc");
    const statusIcon = document.getElementById("status-badge-icon");
    const btnProceed = document.getElementById("btn-proceed-to-export");
    
    if (result.status === "OK") {
      statusBar.className = "matching-status-bar glass-card ok-status";
      statusTitle.innerText = "検品一致！";
      statusDesc.innerText = "指示書のデータと完全に一致しました。CSVを出力できます。";
      statusIcon.innerText = "💚";
      btnProceed.classList.remove("hidden");
      
      // Trigger full screen celebration chime and popup overlay
      playSuccessChime();
      document.getElementById("success-overlay").classList.add("active");
    } else {
      statusBar.className = "matching-status-bar glass-card ng-status";
      statusTitle.innerText = "検品不一致 (照合中)";
      statusDesc.innerText = "指示書とスキャンされた段ボールの内容に過不足があります。";
      statusIcon.innerText = "⏳";
      btnProceed.classList.add("hidden");
    }
  } catch (err) {
    console.error("Match error:", err);
  }
};

// Update Step 2 expected progress items
const updateChecklistProgress = (matches) => {
  const container = document.getElementById("checklist-progress-container");
  container.innerHTML = "";
  
  if (matches.length === 0) {
    // If no match result yet, populate directly from expected list
    expectedItems.forEach(item => {
      const el = document.createElement("div");
      el.className = "progress-item";
      el.innerHTML = `
        <div class="progress-header">
          <span class="progress-name">${item.item_name}</span>
          <span class="progress-values">0 / ${item.quantity} 個</span>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width: 0%"></div>
        </div>
      `;
      container.appendChild(el);
    });
    return;
  }
  
  matches.forEach(m => {
    // Determine fill percent
    const expected = m.expected_qty || 0;
    const scanned = m.scanned_qty || 0;
    let pct = expected > 0 ? (scanned / expected) * 100 : 100;
    if (pct > 100) pct = 100; // Cap visual bar
    
    // Status colors classes for fill bar
    let statusClass = "";
    if (m.status === "MATCHED") {
      statusClass = "complete";
    } else if (m.status === "MISMATCHED" && scanned > expected) {
      statusClass = "over";
    }
    
    const labelText = m.expected_name || `${m.scanned_code} (未予定)`;
    const valuesText = expected > 0 ? `${scanned} / ${expected} 個` : `${scanned} 個 (未予定)`;
    
    const el = document.createElement("div");
    el.className = "progress-item";
    el.innerHTML = `
      <div class="progress-header">
        <span class="progress-name">${labelText}</span>
        <span class="progress-values">${valuesText}</span>
      </div>
      <div class="progress-bar-bg">
        <div class="progress-bar-fill ${statusClass}" style="width: ${pct}%"></div>
      </div>
    `;
    container.appendChild(el);
  });
};

// Close Overlay click
document.getElementById("btn-overlay-close").addEventListener("click", () => {
  document.getElementById("success-overlay").classList.remove("active");
  setStep(3);
});


// ----------------------------------------
// STEP 3: EXPORT AND RESET
// ----------------------------------------

// Proceed to export manually from Step 2 status bar button
document.getElementById("btn-proceed-to-export").addEventListener("click", () => {
  setStep(3);
});

// CSV Export Trigger
document.getElementById("btn-export-csv").addEventListener("click", async () => {
  const customerCode = document.getElementById("customer-code-input").value.trim() || "9999";
  showLoading("CSVをエクスポート中...");
  
  try {
    // Get confirmed matches from last state
    const matchRes = await fetch("/api/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expected: expectedItems,
        scanned: scannedBoxes
      })
    });
    const result = await matchRes.json();
    
    // Post to export endpoint
    const res = await fetch("/api/export/csv", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: result.matches,
        customer_code: customerCode
      })
    });
    
    if (!res.ok) throw new Error("CSV Export Failed");
    
    // Retrieve Blob and trigger download
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    a.download = `akinai_import_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
    
  } catch (err) {
    console.error(err);
    alert("CSVエクスポートに失敗しました: " + err.message);
    playErrorBuzz();
  } finally {
    hideLoading();
  }
});

// Reset App state
document.getElementById("btn-reset-app").addEventListener("click", () => {
  if (confirm("すべてのスキャン内容をリセットして、最初からやり直しますか？")) {
    expectedItems = [];
    scannedBoxes = [];
    document.querySelector("#table-expected-items tbody").innerHTML = "";
    document.getElementById("expected-items-container").classList.add("hidden");
    document.getElementById("scanned-boxes-list").innerHTML = `<div class="empty-state">段ボールがスキャンされていません。カメラで読み取ってください。</div>`;
    
    // Reset wizard
    setStep(1);
  }
});
