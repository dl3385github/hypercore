// Friends Page Functionality

// State variables
let activeFriendDid = null;
let friendsList = [];
let pendingFriendRequests = [];
let activeRequestId = null;

// Initialize friends page
function initializeFriendsPage() {
  console.log('Initializing friends page');
  loadFriends();
  loadPendingRequests();

  // DOM Elements
  const addFriendBtn = document.getElementById('add-friend-btn');
  const closeAddFriendModal = document.getElementById('close-add-friend-modal');
  const addFriendModal = document.getElementById('add-friend-modal');
  const friendDIDInput = document.getElementById('friend-did-input');
  const sendFriendRequestBtn = document.getElementById('send-friend-request-btn');
  const friendsListEl = document.getElementById('friends-list');
  const friendRequestModal = document.getElementById('friend-request-modal');
  const closeRequestModal = document.getElementById('close-friend-request-modal');
  const acceptRequestBtn = document.getElementById('accept-request-btn');
  const rejectRequestBtn = document.getElementById('reject-request-btn');
  const startVideoCallBtn = document.getElementById('start-video-call');
  const friendMessageInput = document.getElementById('friend-message-input');
  const friendSendBtn = document.getElementById('friend-send-btn');
  const searchFriendsInput = document.getElementById('search-friends');
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const myQRModal = document.getElementById('my-qr-modal');
  const closeMyQRModal = document.getElementById('close-my-qr-modal');
  const copyDIDBtn = document.getElementById('copy-did-btn');
  
  // Tab switching in the add friend modal
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.dataset.tab;
      
      // Update active button
      tabButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      
      // Show selected tab content
      tabContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === `${tabName}-tab`) {
          content.classList.add('active');
        }
      });
    });
  });
  
  // Event listeners
  addFriendBtn.addEventListener('click', () => {
    addFriendModal.classList.remove('hidden');
    
    // Display the user's own DID in the QR code tab
    if (window.currentUser && window.currentUser.did) {
      // In a real implementation, you would generate and display a QR code here
      console.log('Would display QR code for DID:', window.currentUser.did);
    }
  });
  
  closeAddFriendModal.addEventListener('click', () => {
    addFriendModal.classList.add('hidden');
    friendDIDInput.value = '';
  });
  
  closeRequestModal.addEventListener('click', () => {
    friendRequestModal.classList.add('hidden');
  });
  
  // Accept and reject friend request buttons in the modal
  acceptRequestBtn.addEventListener('click', () => {
    if (activeRequestId) {
      acceptFriendRequest(activeRequestId);
      friendRequestModal.classList.add('hidden');
    }
  });
  
  rejectRequestBtn.addEventListener('click', () => {
    if (activeRequestId) {
      rejectFriendRequest(activeRequestId);
      friendRequestModal.classList.add('hidden');
    }
  });
  
  sendFriendRequestBtn.addEventListener('click', sendFriendRequest);
  
  friendMessageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendFriendMessage();
    }
  });
  
  friendSendBtn.addEventListener('click', sendFriendMessage);
  
  searchFriendsInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    filterFriendsList(searchTerm);
  });
  
  // Listen for incoming friend requests
  window.electronAPI.onFriendRequestReceived((request) => {
    console.log('Friend request received:', request);
    
    // Display the request modal
    document.getElementById('request-did').textContent = `DID: ${request.from}`;
    activeRequestId = request.id;
    friendRequestModal.classList.remove('hidden');
  });
  
  // Listen for new friend messages
  window.electronAPI.onNewFriendMessage((data) => {
    console.log('New friend message received:', data);
    
    // If this is from the currently active friend, add it to the UI
    if (data.friendDid === activeFriendDid) {
      addFriendMessageToUI(data.message);
    }
  });
}

// Load and display pending friend requests
async function loadPendingRequests() {
  try {
    const result = await window.electronAPI.getPendingFriendRequests();
    
    const pendingRequestsContainer = document.getElementById('pending-friend-requests');
    
    // Check if container exists before manipulating it
    if (!pendingRequestsContainer) {
      console.warn('Pending requests container not found in the DOM');
      return;
    }
    
    pendingRequestsContainer.innerHTML = '';
    
    // Handle different response formats
    const pendingRequests = result.requests || result;
    
    if (!pendingRequests || pendingRequests.length === 0) {
      pendingRequestsContainer.innerHTML = '<p class="no-requests">No pending friend requests</p>';
      return;
    }
    
    // Filter for only pending requests
    const activePendingRequests = pendingRequests.filter(request => request.status === 'pending' || !request.status);
    
    if (activePendingRequests.length === 0) {
      pendingRequestsContainer.innerHTML = '<p class="no-requests">No pending friend requests</p>';
      return;
    }
    
    activePendingRequests.forEach(request => {
      const requestElement = document.createElement('div');
      requestElement.className = 'pending-request';
      requestElement.innerHTML = `
        <div class="request-info">
          <p class="request-sender">${request.from || request.senderDid}</p>
          <p class="request-time">Received: ${new Date(request.timestamp).toLocaleString()}</p>
        </div>
        <div class="request-actions">
          <button class="accept-request-btn" data-request-id="${request.id}">Accept</button>
          <button class="reject-request-btn" data-request-id="${request.id}">Reject</button>
        </div>
      `;
      pendingRequestsContainer.appendChild(requestElement);
      
      // Add event listeners for buttons
      requestElement.querySelector('.accept-request-btn').addEventListener('click', () => {
        acceptFriendRequest(request.id);
      });
      
      requestElement.querySelector('.reject-request-btn').addEventListener('click', () => {
        rejectFriendRequest(request.id);
      });
    });
  } catch (error) {
    console.error('Error loading pending requests:', error);
  }
}

async function acceptFriendRequest(requestId) {
  try {
    await window.electronAPI.acceptFriendRequest(requestId);
    loadPendingRequests(); // Refresh the pending requests list
    loadFriends(); // Refresh the friends list
  } catch (error) {
    console.error('Error accepting friend request:', error);
  }
}

async function rejectFriendRequest(requestId) {
  try {
    await window.electronAPI.rejectFriendRequest(requestId);
    loadPendingRequests(); // Refresh the pending requests list
  } catch (error) {
    console.error('Error rejecting friend request:', error);
  }
}

// Send a friend request to another user
async function sendFriendRequest() {
  try {
    const friendDIDInput = document.getElementById('friend-did-input');
    const targetDid = friendDIDInput.value.trim();
    
    if (!targetDid) {
      alert('Please enter a valid DID to send a friend request');
      return;
    }
    
    const result = await window.electronAPI.createFriendRequest(targetDid);
    
    if (result.success) {
      alert('Friend request sent successfully!');
      
      // Clear the input and close the modal
      friendDIDInput.value = '';
      const addFriendModal = document.getElementById('add-friend-modal');
      if (addFriendModal) {
        addFriendModal.classList.add('hidden');
      }
    } else {
      alert(`Failed to send friend request: ${result.error}`);
    }
  } catch (error) {
    console.error('Error sending friend request:', error);
    alert(`Error: ${error.message}`);
  }
}

// Load friends by calling the loadFriendsList function
async function loadFriends() {
  await loadFriendsList();
}

// Load the friends list
async function loadFriendsList() {
  try {
    const result = await window.electronAPI.getFriends();
    if (result.success) {
      friendsList = result.friends;
      renderFriendsList();
    } else {
      console.error('Failed to load friends list:', result.error);
    }
  } catch (error) {
    console.error('Error loading friends list:', error);
  }
}

// Render the friends list in the UI
function renderFriendsList() {
  const friendsListContainer = document.getElementById('friends-list');
  
  // Check if container exists
  if (!friendsListContainer) {
    console.warn('Friends list container not found in the DOM');
    return;
  }
  
  // Clear current list
  while (friendsListContainer.firstChild) {
    friendsListContainer.removeChild(friendsListContainer.firstChild);
  }
  
  if (friendsList.length === 0) {
    // Show "no friends" message
    const noFriendsMessage = document.createElement('div');
    noFriendsMessage.className = 'no-friends-message';
    noFriendsMessage.textContent = 'No friends added yet';
    friendsListContainer.appendChild(noFriendsMessage);
    return;
  }
  
  // Sort by most recently added
  const sortedFriends = [...friendsList].sort((a, b) => b.addedAt - a.addedAt);
  
  // Render each friend
  sortedFriends.forEach(friend => {
    const friendItem = createFriendElement(friend);
    friendsListContainer.appendChild(friendItem);
  });
}

// Create a friend list item
function createFriendElement(friend) {
  const friendItem = document.createElement('div');
  friendItem.className = 'friend-item';
  friendItem.dataset.did = friend.did;
  
  // Truncate DID for display
  const shortDid = `${friend.did.substring(0, 12)}...${friend.did.substring(friend.did.length - 6)}`;
  
  friendItem.innerHTML = `
    <div class="friend-avatar">👤</div>
    <div class="friend-info">
      <div class="friend-name">${friend.name || 'Friend'}</div>
      <div class="friend-did">${shortDid}</div>
    </div>
    <div class="friend-status ${friend.online ? 'online' : 'offline'}"></div>
  `;
  
  // Add click handler to open chat
  friendItem.addEventListener('click', () => {
    openFriendChat(friend.did);
    
    // Update active state
    document.querySelectorAll('.friend-item').forEach(item => {
      item.classList.remove('active');
    });
    friendItem.classList.add('active');
  });
  
  return friendItem;
}

// Filter the friends list by search term
function filterFriendsList(searchTerm) {
  const friendItems = document.querySelectorAll('.friend-item');
  
  friendItems.forEach(item => {
    const friendName = item.querySelector('.friend-name').textContent.toLowerCase();
    const friendDid = item.querySelector('.friend-did').textContent.toLowerCase();
    
    if (friendName.includes(searchTerm) || friendDid.includes(searchTerm)) {
      item.style.display = '';
    } else {
      item.style.display = 'none';
    }
  });
}

// Open chat with a friend
async function openFriendChat(friendDid) {
  try {
    console.log(`Opening chat with friend: ${friendDid}`);
    
    // Set as active friend
    activeFriendDid = friendDid;
    
    // Check if necessary elements exist
    const noChatSelected = document.getElementById('no-chat-selected');
    const friendChat = document.getElementById('friend-chat');
    const chatFriendName = document.getElementById('chat-friend-name');
    const chatFriendDid = document.getElementById('chat-friend-did');
    const friendMessageInput = document.getElementById('friend-message-input');
    
    if (!noChatSelected || !friendChat) {
      console.error('Chat UI elements not found');
      return;
    }
    
    // Show chat view, hide empty state
    noChatSelected.classList.add('hidden');
    friendChat.classList.remove('hidden');
    
    // Set friend info in the header
    const friendData = friendsList.find(f => f.did === friendDid);
    const shortDid = `${friendDid.substring(0, 12)}...${friendDid.substring(friendDid.length - 6)}`;
    
    if (chatFriendName) {
      chatFriendName.textContent = friendData?.name || 'Friend';
    }
    
    if (chatFriendDid) {
      chatFriendDid.textContent = shortDid;
    }
    
    // Load chat messages
    const messagesResult = await window.electronAPI.getFriendChatMessages(friendDid);
    if (messagesResult.success) {
      renderFriendChatMessages(messagesResult.messages);
    } else {
      console.error('Failed to load chat messages:', messagesResult.error);
    }
    
    // Focus message input
    if (friendMessageInput) {
      friendMessageInput.focus();
    }
  } catch (error) {
    console.error('Error opening friend chat:', error);
  }
}

// Render chat messages
function renderFriendChatMessages(messages) {
  const messagesContainer = document.getElementById('friend-messages');
  
  // Check if container exists
  if (!messagesContainer) {
    console.error('Friend messages container not found');
    return;
  }
  
  // Clear current messages
  messagesContainer.innerHTML = '';
  
  if (!messages || messages.length === 0) {
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'empty-chat-message';
    emptyMessage.textContent = 'No messages yet. Say hello!';
    messagesContainer.appendChild(emptyMessage);
    return;
  }
  
  // Sort by timestamp
  const sortedMessages = [...messages].sort((a, b) => a.timestamp - b.timestamp);
  
  // Group messages by date
  let currentDate = null;
  
  sortedMessages.forEach(message => {
    const messageDate = new Date(message.timestamp).toLocaleDateString();
    
    // Add date separator if needed
    if (messageDate !== currentDate) {
      currentDate = messageDate;
      const dateSeparator = document.createElement('div');
      dateSeparator.className = 'date-separator';
      dateSeparator.textContent = messageDate;
      dateSeparator.setAttribute('data-date', messageDate);
      messagesContainer.appendChild(dateSeparator);
    }
    
    // Add message to UI
    addFriendMessageToUI(message, false);
  });
  
  // Scroll to bottom
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Modify the function that adds messages to the UI
function addFriendMessageToUI(message, skipScroll = false) {
  const messagesContainer = document.getElementById('friend-messages');
  if (!messagesContainer) {
    console.error('Messages container not found');
    return;
  }
  
  const messageElement = document.createElement('div');
  const isFromCurrentUser = message.fromCurrentUser;
  
  // Apply different classes based on who sent the message
  messageElement.className = isFromCurrentUser ? 'chat-message user-message' : 'chat-message friend-message';
  
  messageElement.innerHTML = `
    <div class="message-content">
      <div class="message-text">${message.content}</div>
      <div class="message-time">${new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
    </div>
  `;
  
  messagesContainer.appendChild(messageElement);
  
  // Scroll to bottom if not skipped
  if (!skipScroll) {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
}

// Send a message to the active friend
async function sendFriendMessage() {
  try {
    const messageInput = document.getElementById('friend-message-input');
    
    if (!messageInput) {
      console.error('Message input element not found');
      return;
    }
    
    const text = messageInput.value.trim();
    
    if (!text || !activeFriendDid) return;
    
    // Clear input
    messageInput.value = '';
    
    // Send message
    const result = await window.electronAPI.sendFriendMessage(activeFriendDid, text);
    
    if (result.success) {
      // Create a UI message from the server response
      const uiMessage = {
        content: text,
        timestamp: Date.now(),
        fromCurrentUser: true
      };
      
      // Add to UI immediately
      addFriendMessageToUI(uiMessage);
    } else {
      console.error('Failed to send message:', result.error);
      alert(`Failed to send message: ${result.error}`);
    }
  } catch (error) {
    console.error('Error sending message:', error);
    alert(`Error: ${error.message}`);
  }
}

// Make function available globally instead of using ES modules
window.FriendsPage = { initializeFriendsPage: initializeFriendsPage };