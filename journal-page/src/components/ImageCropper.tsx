import React, { useState, useRef } from 'react';
import ReactCrop, { type Crop, centerCrop, makeAspectCrop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

interface ImageCropperProps {
  image: string;
  onCropComplete: (croppedImage: string) => void;
  onCancel: () => void;
}

export default function ImageCropper({ image, onCropComplete, onCancel }: ImageCropperProps) {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget;
    // Initial crop: 90% of the image
    const initialCrop = centerCrop(
      makeAspectCrop(
        {
          unit: '%',
          width: 90,
        },
        undefined, // No fixed aspect ratio
        width,
        height
      ),
      width,
      height
    );
    setCrop(initialCrop);
  }

  const getCroppedImg = async (image: HTMLImageElement, crop: PixelCrop): Promise<string> => {
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    canvas.width = crop.width;
    canvas.height = crop.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('No 2d context');
    }

    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      crop.width,
      crop.height
    );

    return canvas.toDataURL('image/jpeg');
  };

  const handleSave = async () => {
    if (imgRef.current && completedCrop) {
      try {
        const croppedImage = await getCroppedImg(imgRef.current, completedCrop);
        onCropComplete(croppedImage);
      } catch (e) {
        console.error(e);
      }
    } else {
      // If no crop was made, just use the full image
      onCropComplete(image);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/95 flex flex-col font-serif overflow-hidden">
      <div className="flex-1 relative flex items-center justify-center p-8 overflow-auto">
        <div className="max-w-full max-h-full">
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            onComplete={(c) => setCompletedCrop(c)}
            className="shadow-2xl border border-white/20"
          >
            <img
              ref={imgRef}
              src={image}
              alt="Crop me"
              onLoad={onImageLoad}
              className="max-w-full max-h-[75vh] block"
            />
          </ReactCrop>
        </div>
      </div>
      
      <div className="bg-white p-6 space-y-4 border-t border-black">
        <div className="space-y-1">
          <h3 className="text-sm font-bold uppercase">Manual Area Selection</h3>
          <p className="text-[9px] opacity-50 uppercase">Drag the corners to select exactly what you want to keep</p>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={onCancel}
            className="flex-1 border border-black px-4 py-2 text-[10px] uppercase hover:bg-[#efefef] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 border border-black bg-black text-white px-4 py-2 text-[10px] uppercase hover:bg-black/80 transition-colors"
          >
            Save Selection
          </button>
        </div>
      </div>
    </div>
  );
}
