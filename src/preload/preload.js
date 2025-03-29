// Get the current peer ID
ipcRenderer.invoke('get-peer-id')
  .then(id => {
    ownPeerId = id;
  })
  .catch(err => {
    console.error('Error getting own peer ID:', err);
  });

// Expose APIs to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Existing APIs...
  // ... other API methods
  
  // Get own peer ID
  getOwnId: async () => {
    try {
      return await ipcRenderer.invoke('get-peer-id');
    } catch (err) {
      console.error('Error getting own peer ID:', err);
      return null;
    }
  },
  
  // Generate a task from conversation
  generateTaskFromConversation: (prompt) => {
    return ipcRenderer.invoke('generate-task-from-conversation', prompt);
  }
}); 