import React, { useState, useMemo, useRef, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select } from '@/components/ui/select';
import { UploadButton } from '@/components/ui/upload';

const FStopVisualization = () => {
  // Common f-stop values for snapping
  const commonFStops = [0.95, 1.2, 1.4, 1.8, 2.0, 2.8, 3.5, 4.0, 5.6, 8.0, 11.0, 16.0, 22.0];
  
  // Fixed f-stops for the graph
  const graphFStops = commonFStops;
  
  // Crop factors and their common names
  const cropFactors = [
    { value: 1, label: 'Full Frame' },
    { value: 1.5, label: 'Nikon DX / Sony APS-C' },
    { value: 1.6, label: 'Canon APS-C' },
    { value: 2, label: 'M4/3' }
  ];

  // State
  const [normalizedFStop, setNormalizedFStop] = useState(2.8);
  const [showCropEffect, setShowCropEffect] = useState(false);
  const [cropFactor, setCropFactor] = useState(1.5);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  // Convert f-stop to slider value (logarithmic scale)
  const fStopToSlider = (fStop) => Math.log2(fStop) * 100;
  
  // Convert slider value to f-stop
  const sliderToFStop = (value) => Math.pow(2, value / 100);
  
  // Find nearest common f-stop for snapping
  const findNearestCommonFStop = (value) => {
    const fStop = sliderToFStop(value);
    return commonFStops.reduce((prev, curr) => 
      Math.abs(curr - fStop) < Math.abs(prev - fStop) ? curr : prev
    );
  };

  // Handle slider change with snapping behavior
  const handleSliderChange = (values) => {
    const value = values[0];
    const exactFStop = sliderToFStop(value);
    const nearestCommon = findNearestCommonFStop(value);
    
    // Snap if within 2% of a common value
    const snapThreshold = 0.02;
    const percentDiff = Math.abs(exactFStop - nearestCommon) / nearestCommon;
    
    setNormalizedFStop(
      percentDiff < snapThreshold ? nearestCommon : Number(exactFStop.toFixed(2))
    );
  };

  // Calculate brightness values and determine y-axis domain
  const { data, yDomain } = useMemo(() => {
    const normalizationBrightness = (1 / normalizedFStop) ** 2;
    
    const calculatedData = graphFStops.map(fStop => {
      const brightness = (1 / fStop) ** 2;
      const normalizedBrightness = brightness / normalizationBrightness;
      const effectiveFStop = showCropEffect ? fStop * cropFactor : fStop;
      const effectiveBrightness = showCropEffect ? normalizedBrightness / (cropFactor ** 2) : normalizedBrightness;
      return {
        fStop: `f/${fStop}`,
        effectiveFStop: `f/${effectiveFStop.toFixed(1)}`,
        brightness: Number(normalizedBrightness.toFixed(3)),
        effectiveBrightness: Number(effectiveBrightness.toFixed(3))
      };
    });

    const maxBrightness = Math.max(...calculatedData.map(d => d.brightness));
    const minBrightness = Math.min(...calculatedData.map(d => d.brightness));
    const padding = (maxBrightness - minBrightness) * 0.1;
    
    return {
      data: calculatedData,
      yDomain: [Math.max(0, minBrightness - padding), maxBrightness + padding]
    };
  }, [normalizedFStop, showCropEffect, cropFactor]);

  // Calculate slider range based on min/max f-stops
  const sliderRange = {
    min: fStopToSlider(Math.min(...commonFStops)),
    max: fStopToSlider(Math.max(...commonFStops))
  };

  const formatYAxis = (value) => Number(value).toFixed(2);

  // Handle image upload
  const imageRef = useRef(null);
  const [imageEV, setImageEV] = useState(0);

  useEffect(() => {
    if (uploadedImage) {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = uploadedImage.width;
      canvas.height = uploadedImage.height;
      ctx.drawImage(uploadedImage, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = imageData.data;

      // Calculate average brightness
      let totalBrightness = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        totalBrightness += (r + g + b) / 3;
      }
      const averageBrightness = totalBrightness / (pixels.length / 4);

      // Set image preview and initial exposure value
      setImagePreview(canvas.toDataURL());
      setImageEV(Math.log2(255 / averageBrightness));
    } else {
      setImagePreview(null);
      setImageEV(0);
    }
  }, [uploadedImage]);

  // Handle exposure changes
  const handleExposureChange = (value) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = uploadedImage.width;
    canvas.height = uploadedImage.height;
    ctx.drawImage(uploadedImage, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;

    for (let i = 0; i < pixels.length; i += 4) {
      const r = Math.max(0, Math.min(255, pixels[i] * Math.pow(2, value)));
      const g = Math.max(0, Math.min(255, pixels[i + 1] * Math.pow(2, value)));
      const b = Math.max(0, Math.min(255, pixels[i + 2] * Math.pow(2, value)));
      pixels[i] = r;
      pixels[i + 1] = g;
      pixels[i + 2] = b;
    }

    ctx.putImageData(imageData, 0, 0);
    setImagePreview(canvas.toDataURL());
    setImageEV(value);
  };

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle>Relative Brightness vs. f-stop</CardTitle>
        <div className="text-sm text-gray-500">
          Normalized to f/{normalizedFStop}
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-8 space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">
              Normalize to f-stop: f/{normalizedFStop}
            </label>
            <div className="px-2">
              <Slider
                defaultValue={[fStopToSlider(normalizedFStop)]}
                min={sliderRange.min}
                max={sliderRange.max}
                step={0.1}
                onValueChange={handleSliderChange}
                className="w-full max-w-xs"
              />
            </div>
            <div className="mt-2 text-xs text-gray-500">
              Common f-stops: {commonFStops.map(f => `f/${f}`).join(', ')}
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Switch
                checked={showCropEffect}
                onCheckedChange={setShowCropEffect}
                id="crop-mode"
              />
              <label htmlFor="crop-mode" className="text-sm font-medium">
                Show Crop Sensor Effect
              </label>
            </div>

            {showCropEffect && (
              <select
                value={cropFactor}
                onChange={(e) => setCropFactor(Number(e.target.value))}
                className="p-2 border rounded text-sm"
              >
                {cropFactors.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label} ({value}x)
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-center space-x-4">
            <UploadButton
              onFileSelected={(file) => {
                const img = new Image();
                img.src = URL.createObjectURL(file);
                img.onload = () => {
                  setUploadedImage(img);
                };
              }}
            >
              Upload RAW Image
            </UploadButton>
            {uploadedImage && (
              <div className="flex items-center space-x-4">
                <img src={imagePreview} alt="Uploaded" className="max-h-24" />
                <Slider
                  defaultValue={[imageEV]}
                  min={-5}
                  max={5}
                  step={0.1}
                  onValueChange={handleExposureChange}
                  className="w-full max-w-xs"
                />
                <div>{`Exposure Value: ${imageEV.toFixed(1)}`}</div>
              </div>
            )}
          </div>
        </div>
        
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart 
              data={data}
              margin={{ top: 10, right: 30, left: 60, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="fStop"
                reversed
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis 
                domain={yDomain}
                tickFormatter={formatYAxis}
                label={{ 
                  value: 'Relative Brightness', 
                  angle: -90, 
                  position: 'insideLeft',
                  style: { textAnchor: 'middle' }
                }}
              />
              <Tooltip 
                formatter={(value, name, props) => {
                  if (showCropEffect) {
                    return [
                      Number(props.payload.effectiveBrightness).toFixed(3),
                      `Relative Brightness (${props.payload.fStop} → ${props.payload.effectiveFStop}, ${(1 / (cropFactor ** 2)).toFixed(2)}x brightness)`
                    ];
                  }
                  return [Number(value).toFixed(3), "Relative Brightness"];
                }}
                labelFormatter={(label) => `F-stop: ${label}`}
              />
              <Line
                type="monotone"
                dataKey="brightness"
                stroke="#2563eb"
                strokeWidth={2}
                dot={{
                  stroke: '#2563eb',
                  strokeWidth: 2,
                  r: 4,
                  fill: 'white'
                }}
                activeDot={{
                  stroke: '#2563eb',
                  strokeWidth: 2,
                  r: 6,
                  fill: '#2563eb'
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default FStopVisualization;
