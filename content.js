// Initialize popup only once
let rephraserPopup = null;
let currentSelection = null;
let selectionRange = null;
let isInitialized = false;
let aiSession = null;

const STYLES = [
  { id: 'formal', label: '✒️ Formal Style', description: 'Professional and polished' },
  { id: 'casual', label: '💬 Casual Style', description: 'Relaxed and friendly' },
  { id: 'creative', label: '🎨 Creative Style', description: 'Imaginative and unique' },
  { id: 'academic', label: '📚 Academic Style', description: 'Scholarly and precise' },
  { id: 'custom', label: '✨ Custom Style', description: 'Your own style' }
];

// Initialize AI session
async function initAISession(style, customPrompt = '') {
  try {
     const systemPrompt = `You are an AI text rewriter. Your task is to rewrite the provided text in ${style} format. IMPORTANT: Return ONLY the rewritten text without any explanations, comments, or analysis. Maintain the original meaning and preserve basic line breaks for readability. Do not add or omit any information. ${customPrompt ? `Custom instructions: ${customPrompt}` : ''}`;

    aiSession = await ai.languageModel.create({ systemPrompt });
    return true;
  } catch (error) {
    console.error('AI Session initialization error:', error);
    return false;
  }
}

// API call function
async function rephraseText(text, style, customPrompt = '') {
  try {
    if (!aiSession) {
      const initialized = await initAISession(style, customPrompt);
      if (!initialized) {
        throw new Error('Failed to initialize AI session');
      }
    }

    const response = await aiSession.prompt(`Rewrite this text: ${text}`);
    return response;
  } catch (error) {
    console.error('Rephrasing error:', error);
    throw new Error('Failed to rephrase text. Please try again.');
  }
}

function createRephraserPopup() {
  const popup = document.createElement('div');
  popup.id = 'rephraser-popup';
  popup.className = 'rephraser-popup hidden';
  popup.innerHTML = `
    <div class="rephraser-content">
      <div class="rephraser-header">
        <div class="header-title">
          <span class="spark-icon">✨</span>
          <h3>TextFlow Dev</h3>
        </div>
        <button class="close-btn" aria-label="Close">×</button>
      </div>
      <div class="rephraser-body">
        <div class="original-text"></div>
        <div class="style-selector">
          <select class="style-select">
            <option value="" disabled selected>Select Style</option>
            ${STYLES.map(style => `
              <option value="${style.id}">${style.label}</option>
            `).join('')}
          </select>
          <input type="text" class="custom-style-input hidden" placeholder="Describe your custom style...">
        </div>
        <div class="rephrased-container">
          <div class="rephrased-text"></div>
          <button class="copy-btn" title="Copy to clipboard">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M8 4v12a2 2 0 002 2h8a2 2 0 002-2V7.242a2 2 0 00-.602-1.43L16.083 2.57A2 2 0 0014.685 2H10a2 2 0 00-2 2z"/>
              <path d="M16 18v2a2 2 0 01-2 2H6a2 2 0 01-2-2V9a2 2 0 012-2h2"/>
            </svg>
          </button>
        </div>
        <div class="error-message hidden"></div>
      </div>
      <div class="rephraser-footer">
        <button class="action-btn" disabled>Generate</button>
      </div>
    </div>
  `;

  document.body.appendChild(popup);

  // Improved drag functionality
  let isDragging = false;
  let currentX;
  let currentY;
  let initialX;
  let initialY;

  const header = popup.querySelector('.rephraser-header');
  const customStyleInput = popup.querySelector('.custom-style-input');
  const styleSelect = popup.querySelector('.style-select');

  function handleDragStart(e) {
    if (e.target.closest('.close-btn, .style-select, .copy-btn, .action-btn, .custom-style-input')) {
      return;
    }

    isDragging = true;
    header.classList.add('dragging');

    const rect = popup.getBoundingClientRect();
    initialX = e.clientX - rect.left;
    initialY = e.clientY - rect.top;

    e.preventDefault();
  }

  function handleDrag(e) {
    if (!isDragging) return;

    e.preventDefault();

    currentX = e.clientX - initialX;
    currentY = e.clientY - initialY;

    // Keep popup within viewport
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const popupRect = popup.getBoundingClientRect();

    currentX = Math.max(0, Math.min(currentX, viewportWidth - popupRect.width));
    currentY = Math.max(0, Math.min(currentY, viewportHeight - popupRect.height));

    popup.style.left = `${currentX}px`;
    popup.style.top = `${currentY}px`;
  }

  function handleDragEnd() {
    isDragging = false;
    header.classList.remove('dragging');
  }

  header.addEventListener('mousedown', handleDragStart);
  document.addEventListener('mousemove', handleDrag);
  document.addEventListener('mouseup', handleDragEnd);

  // Style selection handling
  styleSelect.addEventListener('change', (e) => {
    e.stopPropagation(); // Prevent event bubbling
    const selectedStyle = styleSelect.value;
    customStyleInput.classList.toggle('hidden', selectedStyle !== 'custom');
    
    const actionBtn = popup.querySelector('.action-btn');
    actionBtn.disabled = selectedStyle === 'custom' ? !customStyleInput.value : !selectedStyle;

    // Save style preference
    chrome.storage.sync.set({ rephraseStyle: selectedStyle });
  });

  customStyleInput.addEventListener('input', (e) => {
    e.stopPropagation(); // Prevent event bubbling
    const actionBtn = popup.querySelector('.action-btn');
    actionBtn.disabled = !customStyleInput.value;
  });

  // Copy button
  const copyBtn = popup.querySelector('.copy-btn');
  copyBtn.addEventListener('click', async (e) => {
    e.stopPropagation(); // Prevent event bubbling
    const rephrasedText = popup.querySelector('.rephrased-text').textContent;
    try {
      await navigator.clipboard.writeText(rephrasedText);
      copyBtn.classList.add('copied');
      setTimeout(() => copyBtn.classList.remove('copied'), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  });

  // Close button
  const closeBtn = popup.querySelector('.close-btn');
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    popup.classList.add('hidden');
    resetPopupState(popup);
    clearSelection();
  });

  // Action button (Generate/Replace)
  const actionBtn = popup.querySelector('.action-btn');
  actionBtn.addEventListener('click', async () => {
    const selectedStyle = styleSelect.value;
    const customStyle = selectedStyle === 'custom' ? customStyleInput.value : '';
    if (!selectedStyle) return;

    const originalText = popup.querySelector('.original-text').textContent;
    const rephrasedElement = popup.querySelector('.rephrased-text');

    if (!actionBtn.classList.contains('replace')) {
      try {
        actionBtn.disabled = true;
        actionBtn.classList.add('processing');
        
        rephrasedElement.textContent = '';
        rephrasedElement.classList.add('loading');
        hideError(popup);

        const rephrasedText = await rephraseText(originalText, selectedStyle, customStyle);
        
        actionBtn.classList.remove('processing');
        rephrasedElement.textContent = rephrasedText;
        rephrasedElement.classList.remove('loading');
        rephrasedElement.classList.add('show');
        popup.querySelector('.copy-btn').style.display = 'flex';

        actionBtn.textContent = 'Replace';
        actionBtn.classList.add('replace');
        actionBtn.disabled = false;

        // Save to history
        chrome.storage.local.get(['history'], (result) => {
          const history = result.history || [];
          history.unshift({
            original: originalText,
            rephrased: rephrasedText,
            timestamp: new Date().toISOString(),
            style: selectedStyle,
            customStyle: customStyle
          });
          
          if (history.length > 10) history.pop();
          chrome.storage.local.set({ history });
        });
      } catch (error) {
        showError(popup, error.message);
        actionBtn.classList.remove('processing');
        actionBtn.textContent = 'Generate';
        actionBtn.disabled = false;
      }
    } else {
      try {
        const rephrasedText = rephrasedElement.textContent;
        
        if (!selectionRange) {
          throw new Error('Lost text selection. Please try again.');
        }

        const container = selectionRange.commonAncestorContainer;
        const isEditable = container.isContentEditable || 
                         container.parentElement?.isContentEditable ||
                         container.tagName === 'INPUT' ||
                         container.tagName === 'TEXTAREA';

        if (isEditable) {
          if (container.tagName === 'INPUT' || container.tagName === 'TEXTAREA') {
            const element = container;
            const start = element.selectionStart;
            const end = element.selectionEnd;
            const currentValue = element.value;
            element.value = currentValue.substring(0, start) + 
                           rephrasedText + 
                           currentValue.substring(end);
            
            element.selectionStart = start;
            element.selectionEnd = start + rephrasedText.length;
            element.focus();
          } else {
            selectionRange.deleteContents();
            selectionRange.insertNode(document.createTextNode(rephrasedText));
          }
        } else {
          selectionRange.deleteContents();
          selectionRange.insertNode(document.createTextNode(rephrasedText));
        }

        popup.classList.add('hidden');
        resetPopupState(popup);
        clearSelection();
      } catch (error) {
        showError(popup, error.message);
      }
    }
  });

  return popup;
}

function showError(popup, message) {
  const errorElement = popup.querySelector('.error-message');
  errorElement.textContent = message;
  errorElement.classList.remove('hidden');
  popup.querySelector('.rephrased-text').classList.remove('show');
  popup.querySelector('.copy-btn').style.display = 'none';
}

function hideError(popup) {
  const errorElement = popup.querySelector('.error-message');
  errorElement.classList.add('hidden');
}

function clearSelection() {
  currentSelection = null;
  selectionRange = null;
  aiSession = null;
}

function resetPopupState(popup) {
  const actionBtn = popup.querySelector('.action-btn');
  actionBtn.textContent = 'Generate';
  actionBtn.classList.remove('replace', 'processing');
  actionBtn.disabled = true;
  
  const styleSelect = popup.querySelector('.style-select');
  styleSelect.value = '';
  
  const customStyleInput = popup.querySelector('.custom-style-input');
  customStyleInput.value = '';
  customStyleInput.classList.add('hidden');
  
  popup.querySelector('.rephrased-text').classList.remove('show');
  popup.querySelector('.copy-btn').style.display = 'none';
  hideError(popup);
}

function initializeContentScript() {
  if (isInitialized) return;
  isInitialized = true;

  // Handle text selection
  document.addEventListener('mouseup', async (e) => {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    if (selectedText && selectedText.length > 0 && !e.target.closest('#rephraser-popup')) {
      if (!rephraserPopup) {
        rephraserPopup = createRephraserPopup();
      }

      currentSelection = selection;
      selectionRange = selection.getRangeAt(0).cloneRange();

      const rect = selectionRange.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const popupWidth = 320;
      
      let left = window.scrollX + rect.left;
      let top = window.scrollY + rect.bottom + 10;
      
      if (left + popupWidth > viewportWidth) {
        left = viewportWidth - popupWidth - 20;
      }
      
      if (top + 200 > window.scrollY + viewportHeight) {
        top = window.scrollY + rect.top - 220;
      }
      
      // Reset popup state
      resetPopupState(rephraserPopup);

      rephraserPopup.style.transform = '';
      rephraserPopup.style.left = `${Math.max(10, left)}px`;
      rephraserPopup.style.top = `${Math.max(10, top)}px`;
      rephraserPopup.classList.remove('hidden');
      rephraserPopup.querySelector('.original-text').textContent = selectedText;

      // Load saved style preference
      chrome.storage.sync.get(['rephraseStyle'], (result) => {
        if (result.rephraseStyle) {
          const styleSelect = rephraserPopup.querySelector('.style-select');
          styleSelect.value = result.rephraseStyle;
          styleSelect.dispatchEvent(new Event('change'));
        }
      });
    }
  });

  // Handle context menu rephrasing
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'rephrase' && request.text) {
      const mouseEvent = new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true,
        view: window
      });
      document.dispatchEvent(mouseEvent);
    }
  });

  // Close popup when clicking outside
  document.addEventListener('mousedown', (e) => {
    if (rephraserPopup && !rephraserPopup.contains(e.target)) {
      rephraserPopup.classList.add('hidden');
      resetPopupState(rephraserPopup);
      clearSelection();
    }
  });
}

// Initialize the content script
initializeContentScript();

// Re-initialize on dynamic page updates
const observer = new MutationObserver(() => {
  if (!document.getElementById('rephraser-popup')) {
    initializeContentScript();
  }
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true
});