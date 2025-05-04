import { useState, useEffect } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import axios from 'axios';

const FORMATS = ['ttf', 'woff2'];
const COUNTS = Array.from({ length: 10 }, (_, i) => (i + 1) * 10);
const WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];

function App() {
  const [format, setFormat] = useState('ttf');
  const [count, setCount] = useState(10);
  const [fontName, setFontName] = useState('');
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [selectedWeights, setSelectedWeights] = useState([...WEIGHTS]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const handleWeightChange = (weight) => {
    setSelectedWeights(prev =>
      prev.includes(weight)
        ? prev.filter(w => w !== weight)
        : [...prev, weight]
    );
  };

  const handleSelectAllWeights = () => setSelectedWeights([...WEIGHTS]);

  const handleDownload = async (url, filename) => {
    try {
      setLoading(true);
      const response = await axios.get(url, { responseType: 'blob' });

      if (!response || response.status !== 200) {
        throw new Error('Failed to download the font.');
      }

      const blob = new Blob([response.data], { type: response.headers['content-type'] });

      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Download started successfully!');
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Download failed.');
    } finally {
      setLoading(false);
    }
  };

  const downloadRandom = () => {
    const weightsParam = selectedWeights.join(',');
    const url = `http://localhost:3000/download-random?format=${format}&count=${count}&weights=${weightsParam}`;
    const filename = `fonts-${format}-${Date.now()}.zip`;
    handleDownload(url, filename);
  };

  const downloadByName = () => {
    if (!fontName.trim()) return toast.warn('Please enter a font name.');
    const weightsParam = selectedWeights.join(',');
    const url = `http://localhost:3000/download-by-name?format=${format}&name=${encodeURIComponent(
      fontName
    )}&weights=${weightsParam}`;
    const filename = `${fontName.replace(/\s+/g, '-')}-${format}-${Date.now()}.zip`;
    handleDownload(url, filename);
    setFontName('');
  };

  return (
    <div className={`min-h-screen px-4 py-10 ${darkMode ? 'bg-gray-900' : 'bg-gray-100'} flex items-center justify-center`}>
      <div className={`shadow-lg rounded-xl p-8 w-full max-w-md ${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`}>
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-indigo-500">Font Downloader</h1>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="text-sm px-3 py-1 rounded bg-indigo-500 text-white hover:bg-indigo-600 transition"
          >
            {darkMode ? '☀️' : '🌙'}
          </button>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium">Select Format</label>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            className="mt-1 block w-full p-2 border rounded-md bg-transparent border-gray-300 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
          >
            {FORMATS.map((fmt) => (
              <option key={fmt} value={fmt}>
                {fmt.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium">Select Count</label>
          <select
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="mt-1 block w-full p-2 border rounded-md bg-transparent border-gray-300 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
          >
            {COUNTS.map((num) => (
              <option key={num} value={num}>
                {num}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Select Weights</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {WEIGHTS.map(weight => (
              <label key={weight} className="flex items-center space-x-1">
                <input
                  type="checkbox"
                  checked={selectedWeights.includes(weight)}
                  onChange={() => handleWeightChange(weight)}
                  className="rounded border-gray-300 text-indigo-500 focus:ring-indigo-500"
                />
                <span>{weight}</span>
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={handleSelectAllWeights}
            className="text-xs text-indigo-500 hover:text-indigo-600 underline"
          >
            Select All Weights
          </button>
        </div>

        <button
          onClick={downloadRandom}
          disabled={loading}
          className="w-full mb-6 bg-indigo-500 hover:bg-indigo-600 text-white py-2 px-4 rounded-md transition"
        >
          {loading ? 'Downloading...' : `Download ${count} Random Fonts (${format.toUpperCase()})`}
        </button>

        <div className="mb-4">
          <label className="block text-sm font-medium">Download by Name</label>
          <input
            type="text"
            placeholder="e.g. Roboto, Open Sans"
            value={fontName}
            onChange={(e) => setFontName(e.target.value)}
            className="mt-1 block w-full p-2 border rounded-md bg-transparent border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
          />
        </div>

        <button
          onClick={downloadByName}
          disabled={loading}
          className="w-full bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-md transition"
        >
          {loading ? 'Downloading...' : `Download by Name (${format.toUpperCase()})`}
        </button>
      </div>
      <ToastContainer />
    </div>
  );
}

export default App;
