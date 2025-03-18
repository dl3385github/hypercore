# Hypercore P2P Application

A P2P messaging and video calling application built with Electron, using the Hypercore Protocol for peer-to-peer communication and the AT Protocol for account management.

## Features

- **Secure Authentication**: Sign up and sign in using AT Protocol (Bluesky ecosystem)
- **P2P Video Calls**: Make video calls directly to other users without a central server
- **Live Transcription**: All speech is transcribed in real-time using OpenAI's Whisper API
- **P2P Chat**: Send text messages directly to other users
- **Call Summaries**: Generate AI summaries of calls for later reference

## Technologies

- **Electron**: Cross-platform desktop application framework
- **Hypercore Protocol**: Peer-to-peer data network
- **AT Protocol**: Decentralized social networking protocol
- **WebRTC**: Real-time communication for voice and video
- **OpenAI Whisper**: Speech-to-text transcription

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm (v7 or higher)

### Installation

1. Clone the repository
```
git clone https://github.com/yourusername/hypercore-p2p.git
cd hypercore-p2p
```

2. Install dependencies
```
npm install
```

3. Create a `.env` file in the root directory with your OpenAI API key:
```
OPENAI_API_KEY=your_openai_api_key_here
PDS_URL=https://pds.hapa.ai
PDS_INVITE_CODE=your_invite_code_here
```

4. Start the application
```
npm start
```

## Usage

1. Sign up for an account or sign in with your existing AT Protocol credentials
2. Join a room using a room ID or create a new one
3. Share the room ID with people you want to connect with
4. Start video calling and chatting in real-time
5. View live transcriptions during the call
6. Generate a summary of the call when finished

## Configuration

You can customize the application by modifying the following settings in the Settings page:

- **OpenAI API Key**: Update your API key for transcription
- **Audio Detection Threshold**: Adjust sensitivity for speech detection
- **Audio/Video Devices**: Select your preferred input and output devices

## License

This project is licensed under the MIT License - see the LICENSE file for details.