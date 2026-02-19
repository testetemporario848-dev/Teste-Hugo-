import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { GoogleGenAI } from '@google/genai';
import { ClipLoader } from 'react-spinners';
import { Image as ImageIcon, Wand2, RefreshCw, XCircle } from 'lucide-react';

// Assume window.aistudio is available in the environment
declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export default function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [editedImageUrl, setEditedImageUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>('');
  const [sliderPosition, setSliderPosition] = useState<number>(50); // 0-100 for slider position
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKeySelected, setApiKeySelected] = useState<boolean>(false);

  useEffect(() => {
    const checkApiKey = async () => {
      if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setApiKeySelected(hasKey);
      } else {
        // Fallback for environments where window.aistudio is not available
        setApiKeySelected(true); // Assume key is handled externally
      }
    };
    checkApiKey();
  }, []);

  const onDrop = useCallback((acceptedFiles: File[], fileRejections: any) => {
    const file = acceptedFiles[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setEditedImageUrl(null);
      setError(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.png', '.gif', '.webp'],
    } as Record<string, string[]>,
    multiple: false,
    onDragEnter: () => {},
    onDragOver: () => {},
    onDragLeave: () => {},
  });

  const handleEditImage = async () => {
    if (!selectedFile) {
      setError('Please upload an image first.');
      return;
    }
    if (!prompt.trim()) {
      setError('Please enter a prompt for editing.');
      return;
    }
    if (!apiKeySelected) {
      setError('Please select your Gemini API key to use AI features.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(selectedFile);
      reader.onloadend = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        const mimeType = selectedFile.type;

        const response = await fetch('/api/edit-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ prompt, imageData: base64Data, mimeType }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to edit image.');
        }

        if (data.image) {
          setEditedImageUrl(`data:${data.mimeType};base64,${data.image}`);
        } else {
          setError('AI did not return an image.');
        }
      };
    } catch (err: any) {
      console.error('Frontend image edit error:', err);
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveImage = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setEditedImageUrl(null);
    setPrompt('');
    setError(null);
  };

  const handleSelectApiKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      // Assume key selection was successful and proceed
      setApiKeySelected(true);
      setError(null);
    } else {
      setError('API Key selection not available in this environment.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-gray-800 p-4 shadow-lg flex items-center justify-between">
        <h1 className="text-3xl font-bold text-emerald-400 flex items-center gap-2">
          <Wand2 className="w-8 h-8" /> Mandrax IA Studio
        </h1>
        {!apiKeySelected && (
          <button
            onClick={handleSelectApiKey}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors duration-200"
          >
            Select API Key
          </button>
        )}
      </header>

      <main className="flex-1 flex flex-col lg:flex-row p-4 gap-4">
        {/* Sidebar for controls */}
        <aside className="lg:w-1/4 bg-gray-800 p-6 rounded-2xl shadow-xl flex flex-col gap-6">
          <h2 className="text-xl font-semibold text-gray-200">Image Editor</h2>

          {/* Image Upload */}
          {!selectedFile ? (
            <div
              {...getRootProps()}
              className={`border-2 border-dashed ${isDragActive ? 'border-emerald-500 bg-gray-700' : 'border-gray-600 bg-gray-800'} rounded-xl p-6 text-center cursor-pointer transition-all duration-200`}
            >
              <input {...getInputProps()} />
              <ImageIcon className="mx-auto h-12 w-12 text-gray-400 mb-3" />
              <p className="text-gray-300">
                Drag 'n' drop an image here, or click to select one
              </p>
              <p className="text-sm text-gray-500 mt-1">PNG, JPG, GIF, WEBP</p>
            </div>
          ) : (
            <div className="relative">
              <img
                src={previewUrl!}
                alt="Uploaded Preview"
                className="max-w-full h-auto rounded-lg object-contain"
                referrerPolicy="no-referrer"
              />
              <button
                onClick={handleRemoveImage}
                className="absolute top-2 right-2 p-1 bg-red-600 rounded-full text-white hover:bg-red-700 transition-colors duration-200"
                aria-label="Remove image"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Prompt Input */}
          <div className="flex flex-col gap-2">
            <label htmlFor="prompt" className="text-gray-300 font-medium">Edit Prompt:</label>
            <textarea
              id="prompt"
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-400 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors duration-200"
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ex: Adicionar uma corrente de 25 quilowatts estilizada, aplicar efeito estilo Juliette, limpar espelho..."
            ></textarea>
          </div>

          {/* Apply Button */}
          <button
            onClick={handleEditImage}
            className="w-full px-6 py-3 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-colors duration-200 flex items-center justify-center gap-2"
            disabled={!selectedFile || isLoading}
          >
            {isLoading ? (
              <ClipLoader size={20} color="#fff" />
            ) : (
              <Wand2 className="w-5 h-5" />
            )}
            {isLoading ? 'Applying...' : 'Apply Edit'}
          </button>

          {/* Error Display */}
          {error && (
            <div className="bg-red-800 text-red-200 p-3 rounded-lg flex items-center gap-2">
              <XCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          )}
        </aside>

        {/* Image Preview Area */}
        <section className="flex-1 bg-gray-800 p-6 rounded-2xl shadow-xl flex flex-col items-center justify-center gap-4">
          <h2 className="text-xl font-semibold text-gray-200">Preview</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-4xl">
            {/* Before */} 
            <div className="flex flex-col items-center">
              <h3 className="text-lg font-medium text-gray-300 mb-2">Original</h3>
              <div className="w-full h-80 bg-gray-700 rounded-lg flex items-center justify-center overflow-hidden">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Original Image"
                    className="max-w-full max-h-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="text-gray-500">Upload an image</span>
                )}
              </div>
            </div>

            {/* Image Comparison Slider */}
            {(previewUrl && editedImageUrl) && (
              <div className="relative w-full max-w-4xl h-80 rounded-lg overflow-hidden shadow-lg">
                <img
                  src={previewUrl}
                  alt="Original Image"
                  className="absolute inset-0 w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
                <img
                  src={editedImageUrl}
                  alt="Edited Image"
                  className="absolute inset-0 w-full h-full object-contain"
                  style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
                  referrerPolicy="no-referrer"
                />
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={sliderPosition}
                  onChange={(e) => setSliderPosition(Number(e.target.value))}
                  className="absolute inset-y-0 left-0 w-full h-full opacity-0 cursor-ew-resize z-10"
                  aria-label="Image comparison slider"
                />
                <div
                  className="absolute inset-y-0 bg-emerald-500 w-1 pointer-events-none z-20"
                  style={{ left: `${sliderPosition}%` }}
                ></div>
                <div
                  className="absolute top-1/2 -translate-y-1/2 bg-white border-2 border-emerald-500 rounded-full w-6 h-6 flex items-center justify-center pointer-events-none z-20"
                  style={{ left: `${sliderPosition}%`, transform: 'translateX(-50%)' }}
                >
                  <Wand2 className="w-4 h-4 text-emerald-700" />
                </div>
              </div>
            )}

            {/* Before (standalone if no edited image) */}
            {previewUrl && !editedImageUrl && (
              <div className="flex flex-col items-center col-span-full">
                <h3 className="text-lg font-medium text-gray-300 mb-2">Original</h3>
                <div className="w-full h-80 bg-gray-700 rounded-lg flex items-center justify-center overflow-hidden">
                  <img
                    src={previewUrl}
                    alt="Original Image"
                    className="max-w-full max-h-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>
            )}

            {/* Placeholder if no images */}
            {!previewUrl && (
              <div className="flex flex-col items-center col-span-full">
                <span className="text-gray-500">Upload an image to start editing</span>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
