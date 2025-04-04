const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const atProtocol = require('./atProtocol');

// Generate a task from conversation using GPT
ipcMain.handle('generate-task-from-conversation', async (event, prompt) => {
  try {
    console.log('Generating task from conversation...');

    if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API key not found in environment variables');
      return { success: false, error: 'OpenAI API key not configured' };
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { 
          role: 'system', 
          content: 'You are an AI assistant that summarizes conversations and creates actionable tasks. Keep tasks concise, specific, and under 150 characters when possible.'
        },
        { role: 'user', content: prompt }
      ]
    });

    const taskText = completion.choices[0].message.content.trim();
    
    return { 
      success: true, 
      task: taskText 
    };
  } catch (error) {
    console.error('Error generating task:', error);
    return { 
      success: false, 
      error: error.message || 'Unknown error generating task' 
    };
  }
});

// AT Protocol Handlers
ipcMain.handle('auth-sign-in', async (event, identifier, password) => {
  return await atProtocol.login(identifier, password);
});

ipcMain.handle('auth-sign-out', async () => {
  return await atProtocol.logout();
});

ipcMain.handle('getPosts', async () => {
  return await atProtocol.getPosts();
});

ipcMain.handle('createPost', async (event, content) => {
  return await atProtocol.createPost(content);
});

ipcMain.handle('createComment', async (event, postUri, content) => {
  return await atProtocol.createComment(postUri, content);
});

ipcMain.handle('performPostAction', async (event, postUri, action) => {
  return await atProtocol.performPostAction(postUri, action);
});

ipcMain.handle('getPostDetail', async (event, postUri) => {
  return await atProtocol.getPostDetail(postUri);
}); 