export interface WebSocketMessage {
  type: 'feedback' | 'analysis' | 'error';
  data: any;
  timestamp: number;
}

export interface FeedbackMessage {
  type: 'feedback';
  data: {
    analysis: string;
    feedback: string;
    frameNumber: number;
  };
  timestamp: number;
}

export class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private listeners: Map<string, ((message: WebSocketMessage) => void)[]> = new Map();

  constructor(url: string) {
    this.url = url;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            console.log('Raw WebSocket message length:', event.data.length);
            
            // Check if it's a camera frame (base64 image data) - these are very long
            if (event.data.length > 1000 || event.data.startsWith('data:image/jpeg;base64,')) {
              console.log('Received camera frame, ignoring for TTS');
              return;
            }
            
            const message: WebSocketMessage = JSON.parse(event.data);
            console.log('📨 Parsed WebSocket message:', message);
            console.log('📨 Message type:', message.type);
            console.log('📨 Notifying listeners for type:', message.type);
            this.notifyListeners(message.type, message);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
            console.error('Raw data length:', event.data.length);
            console.error('Raw data preview:', event.data.substring(0, 100));
          }
        };

        this.ws.onclose = (event) => {
          console.log('WebSocket closed:', event.code, event.reason);
          this.ws = null;
          
          // Attempt to reconnect if not a normal closure
          if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      if (this.reconnectAttempts <= this.maxReconnectAttempts) {
        this.connect().catch(console.error);
      }
    }, delay);
  }

  addListener(type: string, callback: (message: WebSocketMessage) => void): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(callback);
  }

  removeListener(type: string, callback: (message: WebSocketMessage) => void): void {
    const callbacks = this.listeners.get(type);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  private notifyListeners(type: string, message: WebSocketMessage): void {
    const callbacks = this.listeners.get(type);
    console.log(`📢 Notifying ${callbacks ? callbacks.length : 0} listeners for type: ${type}`);
    if (callbacks) {
      callbacks.forEach((callback, index) => {
        console.log(`📢 Calling callback ${index} for type: ${type}`);
        callback(message);
      });
    } else {
      console.log(`📢 No listeners found for type: ${type}`);
    }
  }

  send(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected');
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this.listeners.clear();
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}
