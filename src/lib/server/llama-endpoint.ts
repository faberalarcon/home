const DEFAULT_LLAMA_BASE_URL = 'http://192.168.1.215:8080';
const DEFAULT_WHISPER_BASE_URL = 'http://192.168.1.215:8081';

export function llamaBaseUrl(): string {
  return (process.env.LLAMA_BASE_URL ?? DEFAULT_LLAMA_BASE_URL).replace(/\/+$/, '');
}

export function whisperBaseUrl(): string {
  return (process.env.WHISPER_BASE_URL ?? DEFAULT_WHISPER_BASE_URL).replace(/\/+$/, '');
}
