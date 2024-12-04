document.addEventListener('DOMContentLoaded', () => {
  // Load and display history
  loadHistory();

  // Handle style button clicks
  document.querySelectorAll('.style-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // Update active style
      document.querySelectorAll('.style-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Save style preference
      const style = btn.dataset.style;
      chrome.storage.sync.set({ rephraseStyle: style });
    });
  });

  // Handle clear history
  document.getElementById('clearHistory').addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all history?')) {
      chrome.storage.local.set({ history: [] }, () => {
        loadHistory();
      });
    }
  });

  // Load saved style preference
  chrome.storage.sync.get(['rephraseStyle'], (result) => {
    if (result.rephraseStyle) {
      const styleBtn = document.querySelector(`[data-style="${result.rephraseStyle}"]`);
      if (styleBtn) {
        styleBtn.classList.add('active');
      }
    }
  });
});

function formatTimeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60 * 1000) {
    return 'Just now';
  }
  
  if (diff < 60 * 60 * 1000) {
    const minutes = Math.floor(diff / (60 * 1000));
    return `${minutes}m ago`;
  }
  
  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diff / (60 * 60 * 1000));
    return `${hours}h ago`;
  }
  
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy:', err);
    return false;
  }
}

function deleteHistoryItem(index) {
  chrome.storage.local.get(['history'], (result) => {
    const history = result.history || [];
    history.splice(index, 1);
    chrome.storage.local.set({ history }, () => {
      loadHistory();
    });
  });
}

function loadHistory() {
  const historyContainer = document.getElementById('history');
  
  chrome.storage.local.get(['history'], (result) => {
    const history = result.history || [];
    
    if (history.length === 0) {
      historyContainer.innerHTML = `
        <div class="flex flex-col items-center justify-center py-6 text-gray-500">
          <svg class="w-12 h-12 mb-2 stroke-current opacity-50" viewBox="0 0 24 24" fill="none" stroke-width="1.5">
            <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <p class="text-sm">No history yet</p>
          <p class="text-xs mt-1">Your rephrased text will appear here</p>
        </div>
      `;
      return;
    }

    historyContainer.innerHTML = history.map((item, index) => `
      <div class="history-item group" data-index="${index}">
        <div class="history-item-header">
          <div class="flex items-center gap-2">
            <span class="history-item-style ${item.style}">
              ${item.customStyle ? '✨ Custom' : capitalizeFirst(item.style)}
            </span>
            <span class="text-gray-500 text-xs">${formatTimeAgo(item.timestamp)}</span>
          </div>
          <div class="history-item-actions opacity-0 group-hover:opacity-100 transition-opacity">
            <button class="history-copy-btn" title="Copy rephrased text">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M8 4v12a2 2 0 002 2h8a2 2 0 002-2V7.242a2 2 0 00-.602-1.43L16.083 2.57A2 2 0 0014.685 2H10a2 2 0 00-2 2z"/>
                <path d="M16 18v2a2 2 0 01-2 2H6a2 2 0 01-2-2V9a2 2 0 012-2h2"/>
              </svg>
            </button>
            <button class="history-delete-btn" title="Delete entry">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="history-item-content">
          <div class="history-item-original">${escapeHtml(item.original)}</div>
          <div class="history-item-rephrased">${escapeHtml(item.rephrased)}</div>
        </div>
      </div>
    `).join('');

    // Add event listeners for copy and delete buttons
    document.querySelectorAll('.history-copy-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const index = parseInt(btn.closest('.history-item').dataset.index);
        const text = history[index].rephrased;
        
        if (await copyToClipboard(text)) {
          const originalTitle = btn.title;
          btn.title = 'Copied!';
          btn.classList.add('text-green-600');
          setTimeout(() => {
            btn.title = originalTitle;
            btn.classList.remove('text-green-600');
          }, 2000);
        }
      });
    });

    document.querySelectorAll('.history-delete-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt(btn.closest('.history-item').dataset.index);
        if (confirm('Delete this history entry?')) {
          deleteHistoryItem(index);
        }
      });
    });

    // Add click-to-copy functionality for history items
    document.querySelectorAll('.history-item').forEach((item) => {
      item.addEventListener('click', async () => {
        const index = parseInt(item.dataset.index);
        const text = history[index].rephrased;
        
        if (await copyToClipboard(text)) {
          item.classList.add('bg-green-50');
          setTimeout(() => {
            item.classList.remove('bg-green-50');
          }, 1000);
        }
      });
    });
  });
}

function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}