import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Mic, MicOff, Send, Sprout, Store, Sun, Cloud, Droplets, Camera, Upload, Leaf, MapPin, Image as ImageIcon, UserPlus, Phone, Mail } from 'lucide-react';
import 'regenerator-runtime/runtime';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import axios from 'axios';
import Webcam from 'react-webcam';

interface WeatherData {
  temperature: number;
  humidity: number;
  rainfall: number;
  isLoading: boolean;
  error: string | null;
}

interface Location {
  latitude: number;
  longitude: number;
  city: string;
}

interface Supplier {
  name: string;
  distance: string;
  rating: number;
  address: string;
  phone?: string;
  email?: string;
  description?: string;
}

const mockSuppliers: Supplier[] = [
  { name: "Krishna Agro Center", distance: "1.2 km", rating: 4.5, address: "123 Main Market, Delhi" },
  { name: "Farmers Choice", distance: "2.5 km", rating: 4.2, address: "45 Agriculture Zone, Delhi" },
  { name: "Green Solutions", distance: "3.1 km", rating: 4.8, address: "78 Rural Complex, Delhi" }
];

const mockResponses = {
  en: {
    default: "I'm here to help with your farming questions. Could you please be more specific?",
    keywords: {
      pest: "For pest control, I recommend these organic solutions:\n1. Neem oil spray\n2. Companion planting\n3. Natural predators like ladybugs\n4. Organic pest traps",
      water: "For optimal water management:\n1. Use drip irrigation\n2. Water early morning or evening\n3. Mulch to retain moisture\n4. Monitor soil moisture regularly",
      soil: "To improve soil health:\n1. Add organic compost\n2. Practice crop rotation\n3. Use green manure\n4. Maintain proper pH levels",
      crop: "For better crop yield:\n1. Choose season-appropriate crops\n2. Maintain proper spacing\n3. Regular weeding\n4. Balanced nutrition",
      organic: "Organic farming best practices:\n1. Use natural fertilizers\n2. Practice crop rotation\n3. Implement biological pest control\n4. Maintain soil health naturally"
    }
  },
  hi: {
    default: "मैं आपके कृषि प्रश्नों में मदद करने के लिए यहां हूं। कृपया अधिक विशिष्ट हों?",
    keywords: {
      pest: "कीट नियंत्रण के लिए, मैं इन जैविक समाधानों की सलाह देता हूं:\n1. नीम तेल स्प्रे\n2. सहयोगी खेती\n3. लेडीबग जैसे प्राकृतिक शिकारी\n4. जैविक कीट जाल",
      water: "पानी के उचित प्रबंधन के लिए:\n1. ड्रिप सिंचाई का उपयोग करें\n2. सुबह या शाम को पानी दें\n3. नमी बनाए रखने के लिए मल्च का उपयोग करें\n4. मिट्टी की नमी की नियमित जांच करें",
      soil: "मिट्टी की गुणवत्ता सुधारने के लिए:\n1. जैविक खाद डालें\n2. फसल चक्र अपनाएं\n3. हरी खाद का उपयोग करें\n4. उचित पीएच स्तर बनाए रखें",
      crop: "बेहतर फसल उपज के लिए:\n1. मौसम के अनुसार फसल चुनें\n2. उचित दूरी बनाए रखें\n3. नियमित निराई करें\n4. संतुलित पोषण",
      organic: "जैविक खेती के सर्वोत्तम तरीके:\n1. प्राकृतिक उर्वरक का उपयोग करें\n2. फसल चक्र अपनाएं\n3. जैविक कीट नियंत्रण\n4. मिट्टी की प्राकृतिक स्वास्थ्य बनाए रखें"
    }
  }
};

const cropCategories = [
  { icon: "🍎", name: "Fruits", nameHi: "फल" },
  { icon: "🌿", name: "Vegetables", nameHi: "सब्जियां" },
  { icon: "🌾", name: "Cereals", nameHi: "अनाज" },
  { icon: "🌻", name: "Oilseeds", nameHi: "तिलहन" },
  { icon: "🌱", name: "Pulses", nameHi: "दालें" }
];

interface Message {
  text: string;
  isUser: boolean;
  isLoading?: boolean;
}

interface SupplierForm {
  name: string;
  address: string;
  phone: string;
  email: string;
  description: string;
}

function App() {
  const [language, setLanguage] = useState<'en' | 'hi'>('en');
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [weather, setWeather] = useState<WeatherData>({
    temperature: 0,
    humidity: 0,
    rainfall: 0,
    isLoading: true,
    error: null
  });
  const [showCamera, setShowCamera] = useState(false);
  const [showImageOptions, setShowImageOptions] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [location, setLocation] = useState<Location | null>(null);
  const [showLocationPrompt, setShowLocationPrompt] = useState(true);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [supplierForm, setSupplierForm] = useState<SupplierForm>({
    name: '',
    address: '',
    phone: '',
    email: '',
    description: ''
  });
  
  const webcamRef = useRef<Webcam>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition
  } = useSpeechRecognition();

  useEffect(() => {
    if (transcript) {
      setQuery(transcript);
    }
  }, [transcript]);

  const getLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const response = await axios.get(
              `https://api.openweathermap.org/geo/1.0/reverse?lat=${position.coords.latitude}&lon=${position.coords.longitude}&limit=1&appid=${import.meta.env.VITE_OPENWEATHER_API_KEY}`
            );
            
            setLocation({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              city: response.data[0].name
            });
            
            setShowLocationPrompt(false);
            fetchWeather(position.coords.latitude, position.coords.longitude);
            setSuppliers(mockSuppliers);
          } catch (error) {
            console.error('Error getting location:', error);
          }
        },
        (error) => {
          console.error('Error getting location:', error);
          setShowLocationPrompt(false);
        }
      );
    }
  };

  const fetchWeather = async (lat: number, lon: number) => {
    try {
      setWeather(prev => ({ ...prev, isLoading: true, error: null }));
      
      const response = await axios.get(
        `${import.meta.env.VITE_OPENWEATHER_API_URL}&lat=${lat}&lon=${lon}&appid=${import.meta.env.VITE_OPENWEATHER_API_KEY}`
      );
      
      setWeather({
        temperature: Math.round(response.data.main.temp),
        humidity: response.data.main.humidity,
        rainfall: response.data.rain?.['1h'] || 0,
        isLoading: false,
        error: null
      });
    } catch (error) {
      console.error('Error fetching weather:', error);
      setWeather(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to fetch weather data'
      }));
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCapturedImage(reader.result as string);
        setShowImageOptions(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSupplierSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Here you would typically send the data to your backend
    const newSupplier: Supplier = {
      ...supplierForm,
      distance: "New",
      rating: 0
    };
    setSuppliers(prev => [...prev, newSupplier]);
    setShowSupplierForm(false);
    setSupplierForm({
      name: '',
      address: '',
      phone: '',
      email: '',
      description: ''
    });
  };

  const getMockResponse = (userQuery: string) => {
    const responses = mockResponses[language];
    const query = userQuery.toLowerCase();
    
    for (const [key, response] of Object.entries(responses.keywords)) {
      if (query.includes(key)) {
        return response;
      }
    }
    
    return responses.default;
  };

  const handleSend = async () => {
    if (!query.trim()) return;

    const userMessage = query;
    setQuery('');
    resetTranscript();
    setMessages(prev => [...prev, { text: userMessage, isUser: true }]);
    setMessages(prev => [...prev, { text: "...", isUser: false, isLoading: true }]);
    setIsLoading(true);

    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const response = getMockResponse(userMessage);
    setMessages(prev => prev.slice(0, -1).concat({ text: response, isUser: false }));
    setIsLoading(false);
  };

  const toggleMic = () => {
    if (listening) {
      SpeechRecognition.stopListening();
    } else {
      SpeechRecognition.startListening({ continuous: true, language: language === 'en' ? 'en-IN' : 'hi-IN' });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const capture = useCallback(() => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      setCapturedImage(imageSrc);
      setShowCamera(false);
      setShowImageOptions(false);
    }
  }, [webcamRef]);

  const toggleCamera = () => {
    setFacingMode(prev => prev === "user" ? "environment" : "user");
  };

  const analyzeCrop = async () => {
    if (!capturedImage) return;
    
    setAnalyzing(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setMessages(prev => [...prev, {
      text: language === 'en' 
        ? "Based on the image analysis, your crop appears to have Leaf Blight. Recommended treatment:\n1. Remove infected leaves\n2. Apply copper-based fungicide\n3. Improve air circulation\n4. Avoid overhead watering"
        : "छवि विश्लेषण के आधार पर, आपकी फसल में पत्ती झुलसा दिख रहा है। अनुशंसित उपचार:\n1. संक्रमित पत्तियों को हटाएं\n2. कॉपर-आधारित फफूंदनाशक लगाएं\n3. हवा का संचार सुधारें\n4. ऊपर से पानी देने से बचें",
      isUser: false
    }]);
    
    setAnalyzing(false);
    setCapturedImage(null);
  };

  return (
    <div className="min-h-screen bg-[url('https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?auto=format&fit=crop&q=80')] bg-cover bg-fixed">
      <div className="min-h-screen backdrop-blur-sm bg-sky-50/80">
        <header className="bg-gradient-to-r from-sky-600 to-sky-500 text-white p-4 sticky top-0 z-50 shadow-lg">
          <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-white p-2 rounded-full shadow-lg">
                <Sprout size={28} className="text-sky-600" />
              </div>
              <h1 className="text-2xl font-bold">{language === 'en' ? 'CropCure AI' : 'क्रॉपक्योर एआई'}</h1>
            </div>
            <select
              className="bg-white/20 text-white px-4 py-2 rounded-full backdrop-blur-sm border border-white/30 hover:bg-white/30 transition-colors"
              value={language}
              onChange={(e) => setLanguage(e.target.value as 'en' | 'hi')}
            >
              <option value="en">English</option>
              <option value="hi">हिंदी</option>
            </select>
          </div>
        </header>

        <main className="container mx-auto px-4 py-6 max-w-4xl">
          {showLocationPrompt && (
            <div className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center p-6 text-center">
              <MapPin size={64} className="text-sky-600 mb-4" />
              <h2 className="text-2xl font-bold mb-4">
                {language === 'en' ? 'Access to device location' : 'डिवाइस लोकेशन एक्सेस'}
              </h2>
              <p className="text-gray-600 mb-8">
                {language === 'en'
                  ? 'To provide you with localized weather updates and find nearby pesticide suppliers, we need access to your location.'
                  : 'स्थानीय मौसम अपडेट और नजदीकी कीटनाशक आपूर्तिकर्ताओं को खोजने के लिए, हमें आपके स्थान तक पहुंच की आवश्यकता है।'}
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setShowLocationPrompt(false)}
                  className="px-6 py-2 text-gray-600 rounded-full border border-gray-300 hover:bg-gray-50"
                >
                  {language === 'en' ? 'Skip' : 'स्किप'}
                </button>
                <button
                  onClick={getLocation}
                  className="px-6 py-2 bg-sky-600 text-white rounded-full hover:bg-sky-700 flex items-center gap-2"
                >
                  <MapPin size={20} />
                  {language === 'en' ? 'Allow' : 'अनुमति दें'}
                </button>
              </div>
            </div>
          )}

          {showSupplierForm && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl p-6 w-full max-w-md">
                <h2 className="text-2xl font-bold mb-4">Register as Supplier</h2>
                <form onSubmit={handleSupplierSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Business Name</label>
                    <input
                      type="text"
                      value={supplierForm.name}
                      onChange={(e) => setSupplierForm(prev => ({ ...prev, name: e.target.value }))}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Address</label>
                    <input
                      type="text"
                      value={supplierForm.address}
                      onChange={(e) => setSupplierForm(prev => ({ ...prev, address: e.target.value }))}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Phone</label>
                    <input
                      type="tel"
                      value={supplierForm.phone}
                      onChange={(e) => setSupplierForm(prev => ({ ...prev, phone: e.target.value }))}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <input
                      type="email"
                      value={supplierForm.email}
                      onChange={(e) => setSupplierForm(prev => ({ ...prev, email: e.target.value }))}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Business Description</label>
                    <textarea
                      value={supplierForm.description}
                      onChange={(e) => setSupplierForm(prev => ({ ...prev, description: e.target.value }))}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                      rows={3}
                      required
                    />
                  </div>
                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => setShowSupplierForm(false)}
                      className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-full hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2 bg-sky-600 text-white rounded-full hover:bg-sky-700"
                    >
                      Register
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <div className="flex gap-4 overflow-x-auto pb-4 mb-6">
            {cropCategories.map((category, index) => (
              <button
                key={index}
                className="flex-shrink-0 bg-white rounded-full p-4 shadow-lg hover:bg-sky-50 transition-colors"
              >
                <div className="flex flex-col items-center gap-2">
                  <span className="text-2xl">{category.icon}</span>
                  <span className="text-sm whitespace-nowrap">
                    {language === 'en' ? category.name : category.nameHi}
                  </span>
                </div>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {weather.error ? (
              <div className="col-span-full bg-red-50 text-red-600 p-4 rounded-lg text-center">
                {weather.error}
              </div>
            ) : (
              <>
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-lg flex items-center gap-3">
                  <Sun className="text-yellow-500 flex-shrink-0" size={24} />
                  <div className="flex-1">
                    <p className="text-sm text-gray-600">
                      {language === 'en' ? 'Temperature' : 'तापमान'}
                    </p>
                    <p className="font-bold">
                      {weather.isLoading ? (
                        <span className="animate-pulse">Loading...</span>
                      ) : (
                        `${weather.temperature}°C`
                      )}
                    </p>
                  </div>
                </div>
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-lg flex items-center gap-3">
                  <Cloud className="text-gray-500 flex-shrink-0" size={24} />
                  <div className="flex-1">
                    <p className="text-sm text-gray-600">
                      {language === 'en' ? 'Humidity' : 'नमी'}
                    </p>
                    <p className="font-bold">
                      {weather.isLoading ? (
                        <span className="animate-pulse">Loading...</span>
                      ) : (
                        `${weather.humidity}%`
                      )}
                    </p>
                  </div>
                </div>
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-lg flex items-center gap-3">
                  <Droplets className="text-sky-500 flex-shrink-0" size={24} />
                  <div className="flex-1">
                    <p className="text-sm text-gray-600">
                      {language === 'en' ? 'Rainfall' : 'वर्षा'}
                    </p>
                    <p className="font-bold">
                      {weather.isLoading ? (
                        <span className="animate-pulse">Loading...</span>
                      ) : (
                        `${weather.rainfall}mm`
                      )}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-4 mb-6">
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold text-sky-800 mb-2">
                {language === 'en' ? 'Heal your crop' : 'अपनी फसल को स्वस्थ करें'}
              </h2>
              <div className="flex justify-center items-center gap-8">
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 bg-sky-100 rounded-full flex items-center justify-center mb-2">
                    <Camera size={32} className="text-sky-600" />
                  </div>
                  <p className="text-sm text-gray-600">
                    {language === 'en' ? 'Take picture' : 'तस्वीर लें'}
                  </p>
                </div>
                <div className="text-sky-600">→</div>
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 bg-sky-100 rounded-full flex items-center justify-center mb-2">
                    <Leaf size={32} className="text-sky-600" />
                  </div>
                  <p className="text-sm text-gray-600">
                    {language === 'en' ? 'Get diagnosis' : 'निदान प्राप्त करें'}
                  </p>
                </div>
              </div>
            </div>

            {showCamera ? (
              <div className="relative">
                <Webcam
                  ref={webcamRef}
                  screenshotFormat="image/jpeg"
                  className="w-full rounded-lg"
                  facingMode={facingMode}
                />
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-4">
                  <button
                    onClick={toggleCamera}
                    className="bg-white text-sky-600 px-4 py-2 rounded-full shadow-lg hover:bg-gray-50 transition-colors"
                  >
                    {language === 'en' ? 'Switch Camera' : 'कैमरा बदलें'}
                  </button>
                  <button
                    onClick={capture}
                    className="bg-sky-600 text-white px-6 py-2 rounded-full shadow-lg hover:bg-sky-700 transition-colors"
                  >
                    {language === 'en' ? 'Capture' : 'कैप्चर'}
                  </button>
                </div>
              </div>
            ) : capturedImage ? (
              <div className="relative">
                <img src={capturedImage} alt="Captured" className="w-full rounded-lg" />
                <div className="flex justify-center gap-4 mt-4">
                  <button
                    onClick={() => setCapturedImage(null)}
                    className="bg-gray-200 text-gray-800 px-6 py-2 rounded-full hover:bg-gray-300 transition-colors"
                  >
                    {language === 'en' ? 'Retake' : 'पुनः लें'}
                  </button>
                  <button
                    onClick={analyzeCrop}
                    className="bg-sky-600 text-white px-6 py-2 rounded-full hover:bg-sky-700 transition-colors flex items-center gap-2"
                    disabled={analyzing}
                  >
                    {analyzing ? (
                      <span className="animate-pulse">
                        {language === 'en' ? 'Analyzing...' : 'विश्लेषण हो रहा है...'}
                      </span>
                    ) : (
                      <>
                        <Upload size={20} />
                        {language === 'en' ? 'Analyze' : 'विश्लेषण करें'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : showImageOptions ? (
              <div className="flex flex-col gap-4">
                <button
                  onClick={() => setShowCamera(true)}
                  className="bg-sky-600 text-white py-3 rounded-full hover:bg-sky-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Camera size={24} />
                  {language === 'en' ? 'Open Camera' : 'कैमरा खोलें'}
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-sky-600 text-white py-3 rounded-full hover:bg-sky-700 transition-colors flex items-center justify-center gap-2"
                >
                  <ImageIcon size={24} />
                  {language === 'en' ? 'Upload from Gallery' : 'गैलरी से अपलोड करें'}
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            ) : (
              <button
                onClick={() => setShowImageOptions(true)}
                className="w-full bg-sky-600 text-white py-3 rounded-full hover:bg-sky-700 transition-colors flex items-center justify-center gap-2"
              >
                <Camera size={24} />
                {language === 'en' ? 'Take a picture' : 'तस्वीर लें'}
              </button>
            )}
          </div>

          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-4 mb-6">
            <h2 className="text-xl font-semibold mb-4 text-sky-800">
              {language === 'en' 
                ? 'Ask your farming questions'
                : 'अपने कृषि संबंधी प्रश्न पूछें'}
            </h2>
            
            <div className="bg-gradient-to-b from-sky-50 to-white rounded-xl p-4 h-[50vh] mb-6 overflow-y-auto shadow-inner">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`${
                    message.isUser
                      ? 'bg-sky-600 text-white ml-auto'
                      : 'bg-sky-100 text-sky-800'
                  } rounded-lg p-3 max-w-[85%] sm:max-w-[75%] mb-4 ${
                    message.isUser ? 'ml-auto' : 'mr-auto'
                  } whitespace-pre-wrap shadow-sm`}
                >
                  {message.isLoading ? (
                    <div className="flex gap-2">
                      <div className="w-2 h-2 bg-sky-600 rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-sky-600 rounded-full animate-bounce delay-100" />
                      <div className="w-2 h-2 bg-sky-600 rounded-full animate-bounce delay-200" />
                    </div>
                  ) : (
                    <p>{message.text}</p>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-2 flex-col sm:flex-row">
              {browserSupportsSpeechRecognition && (
                <button
                  onClick={toggleMic}
                  className={`p-3 rounded-full shadow-lg transition-all hover:scale-105 ${
                    listening 
                      ? 'bg-red-500 text-white ring-4 ring-red-200' 
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {listening ? <MicOff size={24} /> : <Mic size={24} />}
                </button>
              )}
              <div className="flex-1 flex gap-2">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={language === 'en' ? 'Type your question...' : 'अपना प्रश्न लिखें...'}
                  className="flex-1 border-2 border-sky-100 rounded-full px-4 py-3 shadow-inner focus:outline-none focus:border-sky-300 transition-colors"
                  disabled={isLoading}
                />
                <button
                  onClick={handleSend}
                  disabled={!query.trim() || isLoading}
                  className="bg-sky-600 text-white p-3 rounded-full shadow-lg hover:bg-sky-700 transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 disabled:hover:bg-sky-600"
                >
                  <Send size={24} />
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-4 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-sky-800 flex items-center gap-2">
                <Store size={24} />
                {language === 'en' ? 'Pesticide Suppliers' : 'कीटनाशक आपूर्तिकर्ता'}
              </h2>
              <button
                onClick={() => setShowSupplierForm(true)}
                className="bg-sky-600 text-white px-4 py-2 rounded-full hover:bg-sky-700 transition-colors flex items-center gap-2"
              >
                <UserPlus size={20} />
                {language === 'en' ? 'Register as Supplier' : 'आपूर्तिकर्ता के रूप में पंजीकरण करें'}
              </button>
            </div>
            <div className="grid gap-4">
              {suppliers.map((supplier, index) => (
                <div key={index} className="bg-white rounded-lg p-4 shadow hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-lg">{supplier.name}</h3>
                      <p className="text-gray-600 text-sm">{supplier.address}</p>
                      {supplier.phone && (
                        <p className="text-sky-600 flex items-center gap-1 mt-1">
                          <Phone size={16} />
                          {supplier.phone}
                        </p>
                      )}
                      {supplier.email && (
                        <p className="text-sky-600 flex items-center gap-1">
                          <Mail size={16} />
                          {supplier.email}
                        </p>
                      )}
                      {supplier.description && (
                        <p className="text-gray-600 mt-2 text-sm">{supplier.description}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-sky-600 font-semibold">{supplier.distance}</span>
                      {supplier.rating > 0 && (
                        <div className="flex items-center mt-1">
                          <span className="text-yellow-400">★</span>
                          <span className="ml-1 text-sm">{supplier.rating}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;