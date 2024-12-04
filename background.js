// Initialize context menu items
chrome.runtime.onInstalled.addListener(() => {
  // Create context menu items
  chrome.contextMenus.create({
    id: 'rephrase',
    title: 'Smart Rephrase',
    contexts: ['selection']
  });

  const styles = [
    { id: 'formal', title: '✒️ Formal Style' },
    { id: 'casual', title: '💬 Casual Style' },
    { id: 'creative', title: '🎨 Creative Style' },
    { id: 'academic', title: '📚 Academic Style' }
  ];

  styles.forEach(style => {
    chrome.contextMenus.create({
      id: `rephrase-${style.id}`,
      title: style.title,
      parentId: 'rephrase',
      contexts: ['selection']
    });
  });

  // Inject content script into existing tabs
  chrome.tabs.query({ url: ['<all_urls>'] }, (tabs) => {
    tabs.forEach(tab => {
      if (tab.id) {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        }).catch(err => console.error('Script injection failed:', err));
        
        chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ['content.css']
        }).catch(err => console.error('CSS injection failed:', err));
      }
    });
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!info.menuItemId.startsWith('rephrase-')) return;
  
  const style = info.menuItemId.replace('rephrase-', '');
  
  if (tab.id) {
    chrome.tabs.sendMessage(tab.id, {
      action: 'rephrase',
      text: info.selectionText,
      style: style
    }).catch(err => {
      // If content script is not ready, reinject and retry
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      }).then(() => {
        chrome.tabs.sendMessage(tab.id, {
          action: 'rephrase',
          text: info.selectionText,
          style: style
        });
      });
    });
  }
});