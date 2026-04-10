Faster-Whisper

High-performance local speech-to-text using faster-whisper.

Setup
1. Run Setup Script

Execute the setup script to create a virtual environment and install dependencies. It will automatically detect NVIDIA GPUs for CUDA acceleration.

./setup.sh


Requirements:

Python 3.10 or later
ffmpeg (installed on the system)
Usage

Use the transcription script to process audio files.

Basic Transcription
./scripts/transcribe audio.mp3

Advanced Options
Specific Model: ./scripts/transcribe audio.mp3 --model large-v3-turbo
Word Timestamps: ./scripts/transcribe audio.mp3 --word-timestamps
JSON Output: ./scripts/transcribe audio.mp3 --json
VAD (Silence Removal): ./scripts/transcribe audio.mp3 --vad
Available Models
distil-large-v3 (default): Best balance of speed and accuracy.
large-v3-turbo: Recommended for multilingual or highest accuracy tasks.
medium.en, small.en: Faster, English-only versions.
Troubleshooting
No GPU detected: Ensure NVIDIA drivers and CUDA are correctly installed. CPU transcription is significantly slower.
OOM Error: Use a smaller model (e.g., small or base) or use --compute-type int8.