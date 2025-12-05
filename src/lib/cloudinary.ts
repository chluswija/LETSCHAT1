// ============================================
// LETSCHAT - Cloudinary Media Integration
// ============================================

const CLOUD_NAME = 'dqjhjeqrj';
const UPLOAD_PRESET = 'LETSCHAT';

export interface UploadResult {
  url: string;
  publicId: string;
  format: string;
  resourceType: string;
  bytes: number;
  width?: number;
  height?: number;
  duration?: number;
  thumbnail?: string;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

// Determine resource type from file
const getResourceType = (file: File): 'image' | 'video' | 'raw' | 'auto' => {
  const type = file.type.split('/')[0];
  if (type === 'image') return 'image';
  if (type === 'video') return 'video';
  if (type === 'audio') return 'video'; // Cloudinary handles audio as video
  return 'raw'; // documents, etc.
};

// Upload file to Cloudinary with progress tracking
export const uploadToCloudinary = async (
  file: File,
  options?: {
    folder?: string;
    onProgress?: (progress: UploadProgress) => void;
    transformation?: string;
  }
): Promise<UploadResult> => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);
    
    if (options?.folder) {
      formData.append('folder', `letschat/${options.folder}`);
    }
    
    // Add eager transformation for video thumbnails
    const resourceType = getResourceType(file);
    if (resourceType === 'video') {
      formData.append('eager', 'c_fill,w_300,h_300');
    }

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && options?.onProgress) {
        options.onProgress({
          loaded: event.loaded,
          total: event.total,
          percent: Math.round((event.loaded / event.total) * 100),
        });
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const response = JSON.parse(xhr.responseText);
        resolve({
          url: response.secure_url,
          publicId: response.public_id,
          format: response.format,
          resourceType: response.resource_type,
          bytes: response.bytes,
          width: response.width,
          height: response.height,
          duration: response.duration,
          thumbnail: response.eager?.[0]?.secure_url,
        });
      } else {
        reject(new Error(`Upload failed: ${xhr.statusText}`));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Upload failed'));
    });

    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`);
    xhr.send(formData);
  });
};

// Upload multiple files
export const uploadMultipleToCloudinary = async (
  files: File[],
  options?: {
    folder?: string;
    onProgress?: (index: number, progress: UploadProgress) => void;
  }
): Promise<UploadResult[]> => {
  const results: UploadResult[] = [];
  
  for (let i = 0; i < files.length; i++) {
    const result = await uploadToCloudinary(files[i], {
      folder: options?.folder,
      onProgress: (progress) => options?.onProgress?.(i, progress),
    });
    results.push(result);
  }
  
  return results;
};

// Generate optimized Cloudinary URL with transformations
export const getCloudinaryUrl = (
  publicId: string, 
  options?: {
    width?: number;
    height?: number;
    crop?: 'fill' | 'fit' | 'scale' | 'thumb' | 'crop';
    quality?: 'auto' | 'auto:low' | 'auto:eco' | 'auto:good' | 'auto:best' | number;
    format?: 'auto' | 'webp' | 'avif' | 'jpg' | 'png';
    blur?: number;
    resourceType?: 'image' | 'video' | 'raw';
  }
): string => {
  const transformations: string[] = [];
  
  if (options?.width) transformations.push(`w_${options.width}`);
  if (options?.height) transformations.push(`h_${options.height}`);
  if (options?.crop) transformations.push(`c_${options.crop}`);
  if (options?.quality) transformations.push(`q_${options.quality}`);
  if (options?.format) transformations.push(`f_${options.format}`);
  if (options?.blur) transformations.push(`e_blur:${options.blur}`);
  
  const transformString = transformations.length > 0 
    ? transformations.join(',') + '/' 
    : '';
  
  const resourceType = options?.resourceType || 'image';
  
  return `https://res.cloudinary.com/${CLOUD_NAME}/${resourceType}/upload/${transformString}${publicId}`;
};

// Get video thumbnail URL
export const getVideoThumbnail = (
  publicId: string,
  options?: { width?: number; height?: number; time?: number }
): string => {
  const transformations = [
    options?.width ? `w_${options.width}` : 'w_400',
    options?.height ? `h_${options.height}` : 'h_300',
    'c_fill',
    options?.time ? `so_${options.time}` : 'so_0',
  ];
  
  return `https://res.cloudinary.com/${CLOUD_NAME}/video/upload/${transformations.join(',')}/f_jpg/${publicId}`;
};

// Get audio waveform visualization
export const getAudioWaveform = (publicId: string): string => {
  return `https://res.cloudinary.com/${CLOUD_NAME}/video/upload/fl_waveform,co_rgb:00D26A,b_rgb:1a1a1a/${publicId}.png`;
};

// Image optimization presets
export const imagePresets = {
  thumbnail: { width: 100, height: 100, crop: 'fill' as const, quality: 'auto:eco' as const },
  chatImage: { width: 400, quality: 'auto:good' as const, format: 'auto' as const },
  profilePhoto: { width: 200, height: 200, crop: 'fill' as const, quality: 'auto' as const },
  statusImage: { width: 600, quality: 'auto' as const },
  fullImage: { quality: 'auto:best' as const, format: 'auto' as const },
};

// Validate file before upload
export const validateFile = (
  file: File,
  options?: {
    maxSizeMB?: number;
    allowedTypes?: string[];
  }
): { valid: boolean; error?: string } => {
  const maxSize = (options?.maxSizeMB || 16) * 1024 * 1024; // Default 16MB
  
  if (file.size > maxSize) {
    return { 
      valid: false, 
      error: `File too large. Maximum size is ${options?.maxSizeMB || 16}MB` 
    };
  }
  
  if (options?.allowedTypes && options.allowedTypes.length > 0) {
    const fileType = file.type.split('/')[0];
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    const isAllowed = options.allowedTypes.some(
      type => type === fileType || type === extension || type === file.type
    );
    
    if (!isAllowed) {
      return { 
        valid: false, 
        error: `File type not allowed. Allowed: ${options.allowedTypes.join(', ')}` 
      };
    }
  }
  
  return { valid: true };
};

// File type constraints
export const allowedMediaTypes = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  video: ['video/mp4', 'video/quicktime', 'video/webm'],
  audio: ['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm'],
  document: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
  ],
};

export const maxFileSizes = {
  image: 16, // MB
  video: 64,
  audio: 16,
  document: 100,
};

