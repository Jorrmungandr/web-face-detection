/* eslint-disable react/prop-types */
import { useRef, useEffect } from 'react';
import { FaceMesh, FACEMESH_TESSELATION } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';
import { drawConnectors } from '@mediapipe/drawing_utils';

export const FaceMeshMirror = ({ windowWidth, windowHeight }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

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

      const containerWidth = windowWidth;
      const containerHeight = windowHeight;

      const scale = Math.min(containerWidth / videoWidth, containerHeight / videoHeight);
      const displayWidth = videoWidth * scale;
      const displayHeight = videoHeight * scale;

      const offsetX = (containerWidth - displayWidth) / 2;
      const offsetY = (containerHeight - displayHeight) / 2;

      const scaleFactorX = (videoWidth * scale) / containerWidth;
      const scaleFactorY = (videoHeight * scale) / containerHeight;

      canvasCtx.save();
      canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

      let faceDetected = false;
      let faceCentered = false;

      if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        faceDetected = true;
        const landmarks = results.multiFaceLandmarks[0];

        canvasCtx.save();
        canvasCtx.setTransform(
          scaleFactorX,
          0,
          0,
          scaleFactorY,
          offsetX,
          offsetY
        );

        drawConnectors(
          canvasCtx,
          landmarks,
          FACEMESH_TESSELATION,
          { color: '#F2D668', lineWidth: 1, fillColor: '#F2D668' }
        );
        canvasCtx.restore();

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        landmarks.forEach((landmark) => {
          if (landmark.x < minX) minX = landmark.x;
          if (landmark.y < minY) minY = landmark.y;
          if (landmark.x > maxX) maxX = landmark.x;
          if (landmark.y > maxY) maxY = landmark.y;
        });
        const faceCenterX = (minX + maxX) / 2;
        const faceCenterY = (minY + maxY) / 2;
        const threshold = 0.1;
        faceCentered =
          Math.abs(faceCenterX - 0.5) < threshold &&
          Math.abs(faceCenterY - 0.5) < threshold;
      }
      canvasCtx.restore();

      const offscreenCanvas = document.createElement('canvas');
      offscreenCanvas.width = videoWidth;
      offscreenCanvas.height = videoHeight;
      const offscreenCtx = offscreenCanvas.getContext('2d');
      offscreenCtx.drawImage(videoElement, 0, 0, videoWidth, videoHeight);

      const base64Image = offscreenCanvas.toDataURL('image/png');
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

      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(
            JSON.stringify({
                lighting: lightingGood,
                position: faceCentered,
                faceFound: faceDetected,
                image: `data:image/png;base64,${base64Image}`,
            })
        );
      }
    });

    const camera = new Camera(videoElement, {
      onFrame: async () => {
        await faceMesh.send({ image: videoElement });
      },
      // width: windowWidth,
      // height: windowHeight,
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
        backgroundColor: '#F2D668'
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
          objectFit: 'contain',
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
    </div>
  );
};
