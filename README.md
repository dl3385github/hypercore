# Hypercore P2P Chat with Video Calling and Transcription

A peer-to-peer chat application built with Electron, Hypercore, WebRTC, and OpenAI Whisper for real-time transcription.

## Features

- P2P text messaging using Hypercore
- WebRTC video and audio calling
- Real-time speech transcription with OpenAI Whisper
- Transcript saving for each participant
- Responsive UI with video controls
- Multiple peer support

## Setup

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Set up your OpenAI API key:

You need a valid OpenAI API key to use the transcription feature. You can set it as an environment variable:

```bash
export OPENAI_API_KEY=your_openai_api_key_here
```

Or create a `.env` file in the project root with:
```
OPENAI_API_KEY=your_openai_api_key_here
```

## Running the Application

Start the application:

```bash
npm start
```

Or with Electron directly:

```bash
npx electron .
```

## Using the Application

1. Enter your username and a room ID (or use the generated one)
2. Share the room ID with others to join the same chat
3. Grant camera and microphone permissions when prompted
4. Use the toggle buttons to control your video and audio
5. Chat messages appear in the right panel
6. Transcriptions appear below each participant's video
7. Click the "Save Transcript" button to download all transcriptions

## Troubleshooting WebRTC Issues

If you encounter issues with WebRTC connections:

1. Make sure you're using a modern browser
2. Check that your camera and microphone permissions are granted
3. Ensure all peers are using the same room ID
4. Try using a simpler room ID (e.g., a short alphanumeric string)
5. Check that you're not behind a restrictive NAT/firewall

## Troubleshooting Whisper Transcription

If transcription isn't working:

1. Verify your OpenAI API key is set correctly
2. Check that your microphone is working and enabled
3. Speak clearly and at a normal volume
4. Check the console for any error messages

## Known Issues

- Transcription may not work without a valid OpenAI API key
- ICE connection failures can occur on some network configurations
- Video quality degrades with many simultaneous connections 