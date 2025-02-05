/* eslint-disable react/prop-types */
import { useRef, useEffect, useState } from 'react';
import { FaceMesh, FACEMESH_TESSELATION } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';
import { drawConnectors } from '@mediapipe/drawing_utils';

export const FaceMeshMirror = ({ windowWidth, windowHeight }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [status, setStatus] = useState({
    faceDetected: false,
    faceCentered: false,
    lightingGood: false,
  });

  useEffect(() => {
    const videoElement = videoRef.current;
    const canvasElement = canvasRef.current;
    const canvasCtx = canvasElement.getContext('2d');

    const faceMesh = new FaceMesh({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });

    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    faceMesh.onResults((results) => {
      if (!videoElement.videoWidth || !videoElement.videoHeight) return;
      const videoWidth = videoElement.videoWidth;
      const videoHeight = videoElement.videoHeight;
      // The container dimensions come from the mobile screen.
      const containerWidth = windowWidth;
      const containerHeight = windowHeight;

      // For objectFit "cover": use Math.max so that the video fills the container.
      const scale = Math.max(containerWidth / videoWidth, containerHeight / videoHeight);
      const displayWidth = videoWidth * scale;
      const displayHeight = videoHeight * scale;
      // Compute offsets: these are the negative gaps (if any) where the video is cropped.
      const offsetX = (containerWidth - displayWidth) / 2;
      const offsetY = (containerHeight - displayHeight) / 2;
      // Compute scale factors for mapping drawing coordinates.
      // MediaPipe drawing utilities assume normalized coords multiplied by the canvas size.
      // We want to map that to the visible (cropped) video region.
      const scaleFactorX = (videoWidth * scale) / containerWidth;
      const scaleFactorY = (videoHeight * scale) / containerHeight;

      canvasCtx.save();
      canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

      let faceDetected = false;
      let faceCentered = false;

      if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        faceDetected = true;
        const landmarks = results.multiFaceLandmarks[0];

        // Set a transform so the facemesh drawing aligns with the visible part of the video.
        canvasCtx.save();
        canvasCtx.setTransform(
          scaleFactorX, // horizontal scaling
          0,            // horizontal skewing
          0,            // vertical skewing
          scaleFactorY, // vertical scaling
          offsetX,      // horizontal translation
          offsetY       // vertical translation
        );

        drawConnectors(
          canvasCtx,
          landmarks,
          FACEMESH_TESSELATION,
          { color: '#000000', lineWidth: 1, fillColor: '#000000' }
        );
        canvasCtx.restore();

        // Compute face centering in normalized [0,1] space.
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        landmarks.forEach((landmark) => {
          if (landmark.x < minX) minX = landmark.x;
          if (landmark.y < minY) minY = landmark.y;
          if (landmark.x > maxX) maxX = landmark.x;
          if (landmark.y > maxY) maxY = landmark.y;
        });
        const faceCenterX = (minX + maxX) / 2;
        const faceCenterY = (minY + maxY) / 2;
        const threshold = 0.1; // Allow a 10% deviation in normalized space.
        faceCentered =
          Math.abs(faceCenterX - 0.5) < threshold &&
          Math.abs(faceCenterY - 0.5) < threshold;
      }
      canvasCtx.restore();

      // Compute average brightness from the camera feed (using an offscreen canvas at native resolution)
      const offscreenCanvas = document.createElement('canvas');
      offscreenCanvas.width = videoWidth;
      offscreenCanvas.height = videoHeight;
      const offscreenCtx = offscreenCanvas.getContext('2d');
      offscreenCtx.drawImage(videoElement, 0, 0, videoWidth, videoHeight);
      const imageData = offscreenCtx.getImageData(0, 0, videoWidth, videoHeight);
      const data = imageData.data;
      let totalBrightness = 0;
      const numPixels = data.length / 4;
      for (let i = 0; i < data.length; i += 4) {
        const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
        totalBrightness += brightness;
      }
      const avgBrightness = totalBrightness / numPixels;
      const lightingGood = avgBrightness > 100;

      setStatus({
        faceDetected,
        faceCentered,
        lightingGood,
      });
    });

    const camera = new Camera(videoElement, {
      onFrame: async () => {
        await faceMesh.send({ image: videoElement });
      },
      // Request a resolution matching the container. However, note that the actual camera resolution might differ.
      width: windowWidth,
      height: windowHeight,
    });
    camera.start();

    return () => {
      camera.stop();
    };
  }, [windowWidth, windowHeight]);

  return (
    <div
      style={{
        position: 'relative',
        width: windowWidth,
        height: windowHeight,
      }}
    >
      <video
        ref={videoRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover', // This ensures the camera fills the container.
        }}
        autoPlay
        playsInline
      ></video>
      <canvas
        ref={canvasRef}
        width={windowWidth}
        height={windowHeight}
        style={{ position: 'absolute', top: 0, left: 0 }}
      ></canvas>
      <div
        style={{
          position: 'absolute',
          bottom: 10,
          left: 10,
          background: 'rgba(0,0,0,0.5)',
          color: 'white',
          padding: '5px',
          borderRadius: '4px',
        }}
      >
        <p>
          <strong>Face Detected:</strong> {status.faceDetected ? 'Yes' : 'No'}
        </p>
        <p>
          <strong>Face Centered:</strong> {status.faceCentered ? 'Yes' : 'No'}
        </p>
        <p>
          <strong>Good Lighting:</strong> {status.lightingGood ? 'Yes' : 'No'}
        </p>
      </div>
    </div>
  );
};
