// WebRTC utilities for voice and video calls
import { db } from './firebase';
import { doc, setDoc, getDoc, onSnapshot, updateDoc, deleteDoc, collection, addDoc } from 'firebase/firestore';

// STUN servers for NAT traversal
const configuration: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export interface CallData {
  callerId: string;
  receiverId: string;
  callerName: string;
  callerPhoto?: string;
  type: 'voice' | 'video';
  status: 'ringing' | 'connected' | 'ended' | 'rejected' | 'missed';
  startedAt: Date;
  endedAt?: Date;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
}

export class WebRTCCall {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private callId: string;
  private callType: 'voice' | 'video';
  private currentUserId: string;
  private otherUserId: string;
  private unsubscribe: (() => void) | null = null;

  constructor(callId: string, callType: 'voice' | 'video', currentUserId: string, otherUserId: string) {
    this.callId = callId;
    this.callType = callType;
    this.currentUserId = currentUserId;
    this.otherUserId = otherUserId;
  }

  // Initialize local media stream
  async initializeLocalStream(): Promise<MediaStream> {
    try {
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: this.callType === 'video' ? { width: 1280, height: 720 } : false,
      };

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      return this.localStream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      throw new Error('Could not access camera/microphone');
    }
  }

  // Create peer connection
  private createPeerConnection(onRemoteStream: (stream: MediaStream) => void): RTCPeerConnection {
    const pc = new RTCPeerConnection(configuration);

    // Add local stream tracks to peer connection
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream!);
      });
    }

    // Handle remote stream
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
        onRemoteStream(this.remoteStream);
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        // Send ICE candidate to Firestore
        const candidateRef = collection(db, 'calls', this.callId, 'candidates');
        await addDoc(candidateRef, {
          candidate: event.candidate.toJSON(),
          from: this.currentUserId,
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', pc.iceConnectionState);
    };

    this.peerConnection = pc;
    return pc;
  }

  // Start a call (caller side)
  async startCall(
    callerName: string,
    callerPhoto: string | undefined,
    onRemoteStream: (stream: MediaStream) => void
  ): Promise<void> {
    try {
      // Initialize local stream
      await this.initializeLocalStream();

      // Create peer connection
      const pc = this.createPeerConnection(onRemoteStream);

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Save call data to Firestore
      const callRef = doc(db, 'calls', this.callId);
      await setDoc(callRef, {
        callerId: this.currentUserId,
        receiverId: this.otherUserId,
        callerName,
        callerPhoto: callerPhoto || null,
        type: this.callType,
        status: 'ringing',
        offer: {
          type: offer.type,
          sdp: offer.sdp,
        },
        startedAt: new Date(),
        createdAt: new Date(),
      });

      // Listen for answer
      this.listenForAnswer();

      // Listen for ICE candidates from receiver
      this.listenForRemoteCandidates();
    } catch (error) {
      console.error('Error starting call:', error);
      throw error;
    }
  }

  // Answer a call (receiver side)
  async answerCall(onRemoteStream: (stream: MediaStream) => void): Promise<void> {
    try {
      // Initialize local stream
      await this.initializeLocalStream();

      // Get call data
      const callRef = doc(db, 'calls', this.callId);
      const callSnap = await getDoc(callRef);
      
      if (!callSnap.exists()) {
        throw new Error('Call not found');
      }

      const callData = callSnap.data();

      // Create peer connection
      const pc = this.createPeerConnection(onRemoteStream);

      // Set remote description (offer)
      await pc.setRemoteDescription(new RTCSessionDescription(callData.offer));

      // Create answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Update call with answer
      await updateDoc(callRef, {
        answer: {
          type: answer.type,
          sdp: answer.sdp,
        },
        status: 'connected',
      });

      // Listen for ICE candidates from caller
      this.listenForRemoteCandidates();
    } catch (error) {
      console.error('Error answering call:', error);
      throw error;
    }
  }

  // Listen for answer (caller side)
  private listenForAnswer(): void {
    const callRef = doc(db, 'calls', this.callId);
    
    this.unsubscribe = onSnapshot(callRef, async (snapshot) => {
      const data = snapshot.data();
      
      if (data?.answer && this.peerConnection) {
        const answer = new RTCSessionDescription(data.answer);
        
        if (this.peerConnection.signalingState === 'have-local-offer') {
          await this.peerConnection.setRemoteDescription(answer);
        }
      }

      if (data?.status === 'ended' || data?.status === 'rejected') {
        this.endCall();
      }
    });
  }

  // Listen for remote ICE candidates
  private listenForRemoteCandidates(): void {
    const candidatesRef = collection(db, 'calls', this.callId, 'candidates');
    
    onSnapshot(candidatesRef, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          
          // Only process candidates from the other user
          if (data.from !== this.currentUserId && this.peerConnection) {
            try {
              const candidate = new RTCIceCandidate(data.candidate);
              await this.peerConnection.addIceCandidate(candidate);
            } catch (error) {
              console.error('Error adding ICE candidate:', error);
            }
          }
        }
      });
    });
  }

  // End the call
  async endCall(): Promise<void> {
    try {
      // Stop all local tracks
      if (this.localStream) {
        this.localStream.getTracks().forEach((track) => track.stop());
        this.localStream = null;
      }

      // Close peer connection
      if (this.peerConnection) {
        this.peerConnection.close();
        this.peerConnection = null;
      }

      // Unsubscribe from listeners
      if (this.unsubscribe) {
        this.unsubscribe();
        this.unsubscribe = null;
      }

      // Update call status in Firestore
      const callRef = doc(db, 'calls', this.callId);
      const callSnap = await getDoc(callRef);
      
      if (callSnap.exists()) {
        await updateDoc(callRef, {
          status: 'ended',
          endedAt: new Date(),
        });
      }
    } catch (error) {
      console.error('Error ending call:', error);
    }
  }

  // Reject the call
  async rejectCall(): Promise<void> {
    try {
      const callRef = doc(db, 'calls', this.callId);
      await updateDoc(callRef, {
        status: 'rejected',
        endedAt: new Date(),
      });
      
      await this.endCall();
    } catch (error) {
      console.error('Error rejecting call:', error);
    }
  }

  // Toggle audio
  toggleAudio(enabled: boolean): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  }

  // Toggle video
  toggleVideo(enabled: boolean): void {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  }

  // Get local stream
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  // Get remote stream
  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }
}

// Helper function to generate call ID
export const generateCallId = (userId1: string, userId2: string): string => {
  const sorted = [userId1, userId2].sort();
  return `call_${sorted[0]}_${sorted[1]}_${Date.now()}`;
};
