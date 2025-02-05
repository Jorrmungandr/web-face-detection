import { useRef, useEffect, useState } from 'react';
import { FaceMesh, FACEMESH_TESSELATION } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';
import { drawConnectors } from '@mediapipe/drawing_utils';

const App = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [status, setStatus] = useState({
    faceDetected: false,
    faceCentered: false,
    lightingGood: false,
  });

  useEffect(() => {
    if (!videoRef.current) return;
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
      canvasCtx.save();
      canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

      let faceDetected = false;
      let faceCentered = false;

      if (
        results.multiFaceLandmarks &&
        results.multiFaceLandmarks.length > 0
      ) {
        faceDetected = true;
        const landmarks = results.multiFaceLandmarks[0];

        drawConnectors(
          canvasCtx,
          landmarks,
          FACEMESH_TESSELATION,
          { color: '#000000', lineWidth: 1, fillColor: '#000000' }
        );

        let minX = Infinity,
          minY = Infinity,
          maxX = -Infinity,
          maxY = -Infinity;
        landmarks.forEach((landmark) => {
          const x = landmark.x * canvasElement.width;
          const y = landmark.y * canvasElement.height;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        });

        const faceCenterX = (minX + maxX) / 2;
        const faceCenterY = (minY + maxY) / 2;

        const frameCenterX = canvasElement.width / 2;
        const frameCenterY = canvasElement.height / 2;

        const thresholdX = canvasElement.width * 0.1;
        const thresholdY = canvasElement.height * 0.1;

        if (
          Math.abs(faceCenterX - frameCenterX) < thresholdX &&
          Math.abs(faceCenterY - frameCenterY) < thresholdY
        ) {
          faceCentered = true;
        }
      }

      canvasCtx.restore();

      const offscreenCanvas = document.createElement('canvas');
      offscreenCanvas.width = videoElement.videoWidth;
      offscreenCanvas.height = videoElement.videoHeight;
      const offscreenCtx = offscreenCanvas.getContext('2d');
      offscreenCtx.drawImage(
        videoElement,
        0,
        0,
        offscreenCanvas.width,
        offscreenCanvas.height
      );

      const imageData = offscreenCtx.getImageData(
        0,
        0,
        offscreenCanvas.width,
        offscreenCanvas.height
      );
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
      width: 640,
      height: 480,
    });
    camera.start();

    return () => {
      camera.stop();
    };
  }, []);

  return (
    <div style={{ position: 'relative', width: 640, height: 480 }}>
      <video
        ref={videoRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: 640,
          height: 480,
          objectFit: 'cover',
        }}
        autoPlay
        playsInline
      ></video>
      <canvas
        ref={canvasRef}
        width={640}
        height={480}
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
          <strong>Face Detected:</strong>{' '}
          {status.faceDetected ? 'Yes' : 'No'}
        </p>
        <p>
          <strong>Face Centered:</strong>{' '}
          {status.faceCentered ? 'Yes' : 'No'}
        </p>
        <p>
          <strong>Good Lighting:</strong>{' '}
          {status.lightingGood ? 'Yes' : 'No'}
        </p>
      </div>
    </div>
  );
};

export default App;
