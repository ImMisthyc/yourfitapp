import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, ChevronLeft, ChevronRight, Shirt, Home, PlusSquare, Settings, Sun, Moon, Palette, X, Trash2 } from "lucide-react";

// --- PWA SETUP ---
const useServiceWorker = () => {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
          .then(registration => {
            console.log('Service Worker registered: ', registration);
          })
          .catch(registrationError => {
            console.log('Service Worker registration failed: ', registrationError);
          });
      });
    }
  }, []);
};


// --- TYPES & CONSTANTS ---
const CATEGORIES = ["hat", "top", "bottom", "shoes"];
/**
 * @typedef {"hat" | "top" | "bottom" | "shoes"} Category
 */

/**
 * @typedef {Object} ClothingItem
 * @property {string} id
 * @property {string} image
 * @property {Category} type
 */

/**
 * @typedef {Object} Outfit
 * @property {string} id
 * @property {ClothingItem | undefined} hat
 * @property {ClothingItem} top
 * @property {ClothingItem} bottom
 * @property {ClothingItem | undefined} shoes
 */

/**
 * @typedef {'light' | 'dark'} Theme
 */
/**
 * @typedef {'blue' | 'pink' | 'green' | 'purple' | 'orange'} AccentColor
 */

const ACCENT_COLORS = {
  blue: 'hsl(221.2 83.2% 53.3%)',
  pink: 'hsl(346.8 77.2% 49.8%)',
  green: 'hsl(142.1 76.2% 36.3%)',
  purple: 'hsl(262.1 83.3% 57.8%)',
  orange: 'hsl(24.6 95% 53.1%)'
};

// --- HELPER FUNCTIONS ---

/**
 * @param {number} len
 * @param {number} current
 * @param {number} delta
 * @returns {number}
 */
const nextIndex = (len, current, delta) => {
  if (len <= 0) return 0;
  const safeCurrent = Number.isFinite(current) ? current : 0;
  return (safeCurrent + delta + len) % len;
};

// --- MAIN APP COMPONENT ---

export default function App() {
  useServiceWorker();

  // --- STATE MANAGEMENT ---
  const [clothes, setClothes] = useState(() => {
    try {
      const saved = localStorage.getItem('yourfit-clothes');
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error("Failed to parse clothes from localStorage", error);
      return [];
    }
  });

  const [savedOutfits, setSavedOutfits] = useState(() => {
    try {
      const saved = localStorage.getItem('yourfit-outfits');
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error("Failed to parse outfits from localStorage", error);
      return [];
    }
  });

  const [pendingFiles, setPendingFiles] = useState([]);
  const [currentView, setCurrentView] = useState('home');
  const [outfitIndex, setOutfitIndex] = useState(0);
  const [partIndexes, setPartIndexes] = useState({ hat: 0, top: 0, bottom: 0, shoes: 0 });
  const [animationDirection, setAnimationDirection] = useState(0);

  // Settings State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('yourfit-theme') || 'light');
  const [accentColor, setAccentColor] = useState(() => localStorage.getItem('yourfit-color') || 'blue');

  // --- PERSISTENCE & THEME ---
  useEffect(() => {
    localStorage.setItem('yourfit-clothes', JSON.stringify(clothes));
  }, [clothes]);

  useEffect(() => {
    localStorage.setItem('yourfit-outfits', JSON.stringify(savedOutfits));
  }, [savedOutfits]);
  
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('yourfit-theme', theme);
  }, [theme]);
  
  useEffect(() => {
    document.documentElement.style.setProperty('--accent-color', ACCENT_COLORS[accentColor]);
    localStorage.setItem('yourfit-color', accentColor);
  }, [accentColor]);

  // --- DERIVED STATE & MEMOIZED VALUES ---
  const categorizedClothes = useMemo(() => {
    const result = { hat: [], top: [], bottom: [], shoes: [] };
    clothes.forEach(item => {
      if (result[item.type]) {
        result[item.type].push(item);
      }
    });
    result.hat.unshift({ id: 'no-hat', image: '', type: 'hat' });
    return result;
  }, [clothes]);

  const canSaveOutfit = useMemo(() => {
    const hasTop = categorizedClothes.top.length > 0;
    const hasBottom = categorizedClothes.bottom.length > 0;
    const currentTop = categorizedClothes.top[partIndexes.top];
    const currentBottom = categorizedClothes.bottom[partIndexes.bottom];

    return hasTop && hasBottom && currentTop && currentBottom;
  }, [categorizedClothes, partIndexes]);

  // --- CORE LOGIC ---
  const handleFileUpload = (event) => {
    const files = event.target.files;
    if (!files) return;

    const newFiles = Array.from(files).map(file => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          resolve({ id: `pending-${Date.now()}-${Math.random()}`, image: e.target?.result });
        };
        reader.readAsDataURL(file);
      });
    });

    Promise.all(newFiles).then(processedFiles => {
      setPendingFiles(prev => [...prev, ...processedFiles]);
      setCurrentView('classifier');
    });
    event.target.value = "";
  };
  
  const classifyPendingFile = (category) => {
    if (pendingFiles.length === 0) return;
    const [first, ...rest] = pendingFiles;
    setClothes(prev => [...prev, { ...first, id: `cloth-${Date.now()}`, type: category }]);
    setPendingFiles(rest);
    if (rest.length === 0) {
      setCurrentView('wardrobe');
    }
  };

  const saveOutfit = () => {
    const newOutfit = { id: `outfit-${Date.now()}` };
    
    CATEGORIES.forEach(cat => {
      const items = categorizedClothes[cat];
      if (items.length > 0) {
        const currentIndex = partIndexes[cat];
        const selectedItem = items[currentIndex];
        if (cat === 'hat' && selectedItem.id === 'no-hat') return;
        newOutfit[cat] = selectedItem;
      }
    });

    if (newOutfit.top && newOutfit.bottom) {
      setSavedOutfits(prev => [...prev, newOutfit]);
      setPartIndexes({ hat: 0, top: 0, bottom: 0, shoes: 0 });
      setCurrentView('home');
      setOutfitIndex(savedOutfits.length);
    } else {
      console.warn("Cannot save outfit without a top and bottom.");
    }
  };
  
  const deleteClothingItem = (id) => {
    setClothes(prev => prev.filter(item => item.id !== id));
    setSavedOutfits(prev => prev.map(outfit => {
      const newOutfit = {...outfit};
      let changed = false;
      for (const key in newOutfit) {
        if (typeof newOutfit[key] === 'object' && newOutfit[key]?.id === id) {
          delete newOutfit[key];
          changed = true;
        }
      }
      return changed ? newOutfit : outfit;
    }).filter(o => o.top && o.bottom));
  }
  
  const deleteOutfit = (id) => {
      setSavedOutfits(prev => prev.filter(outfit => outfit.id !== id));
      if (outfitIndex >= savedOutfits.length - 1) {
          setOutfitIndex(Math.max(0, savedOutfits.length - 2));
      }
  }

  const changePart = (cat, delta) => {
    setAnimationDirection(delta);
    setPartIndexes(prev => ({
      ...prev,
      [cat]: nextIndex(categorizedClothes[cat].length, prev[cat], delta)
    }));
  };

  const changeOutfit = (delta) => {
    setAnimationDirection(delta);
    setOutfitIndex(prev => nextIndex(savedOutfits.length, prev, delta));
  };


  // --- UI COMPONENTS ---
  const slideVariants = {
    enter: (direction) => ({ x: direction > 0 ? '100%' : '-100%', opacity: 0, scale: 0.9 }),
    center: { x: 0, opacity: 1, scale: 1 },
    exit: (direction) => ({ x: direction < 0 ? '100%' : '-100%', opacity: 0, scale: 0.9 }),
  };

  const UploadButton = ({ isPrimary = false }) => (
    <label className={`
      relative flex items-center justify-center gap-2 cursor-pointer transition-all w-full
      rounded-xl text-sm font-semibold h-12
      ${isPrimary
        ? 'bg-accent text-white hover:opacity-90'
        : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
      }`}
    >
      <Upload size={18} /> Upload Clothes
      <input type="file" accept="image/*" multiple onChange={handleFileUpload} className="hidden" />
    </label>
  );

  const renderCurrentView = () => {
    if (clothes.length === 0 && pendingFiles.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', delay: 0.2 }}>
              <Shirt size={80} className="text-accent mb-4" strokeWidth={1.5} />
            </motion.div>
            <h2 className="text-2xl font-bold mb-2">Welcome to YourFit</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-sm">
                Start building your virtual wardrobe. Upload photos of your clothes to begin creating outfits.
            </p>
            <UploadButton isPrimary={true} />
        </div>
      );
    }
    
    switch(currentView) {
      case 'classifier':
        const currentFile = pendingFiles[0];
        if (!currentFile) return null;
        return (
          <ClassifierScreen key={currentFile.id} file={currentFile} onClassify={classifyPendingFile} remaining={pendingFiles.length - 1} />
        );
        
      case 'wardrobe':
        return (
          <WardrobeScreen
            clothes={clothes}
            onDeleteItem={deleteClothingItem}
            onCreateOutfit={() => setCurrentView('creator')}
            UploadButton={<UploadButton />}
          />
        );

      case 'creator':
        return (
          <OutfitCreator
            categorizedClothes={categorizedClothes}
            partIndexes={partIndexes}
            onChangePart={changePart}
            onSave={saveOutfit}
            canSave={canSaveOutfit}
            animationDirection={animationDirection}
            slideVariants={slideVariants}
          />
        );

      case 'home':
      default:
        return (
            <HomeScreen
              savedOutfits={savedOutfits}
              outfitIndex={outfitIndex}
              onChangeOutfit={changeOutfit}
              onCreateNew={() => setCurrentView('creator')}
              onDeleteOutfit={deleteOutfit}
              animationDirection={animationDirection}
              slideVariants={slideVariants}
            />
        );
    }
  };
  
  return (
    <div className="font-sans bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 h-screen w-full flex flex-col antialiased">
      <style>{`
        :root { --accent-color: ${ACCENT_COLORS[accentColor]}; }
        .text-accent { color: var(--accent-color); }
        .bg-accent { background-color: var(--accent-color); }
        .ring-current { --tw-ring-color: var(--accent-color); }
      `}</style>
      
      <header className="flex items-center justify-between px-4 py-2 w-full flex-shrink-0">
        <h1 className="text-xl font-bold tracking-tight flex items-center gap-1">
            <Shirt className="text-accent" /> Your<span className="font-light">Fit</span>
        </h1>
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => setIsSettingsOpen(true)} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-500 dark:text-gray-400">
            <Settings size={20} />
        </motion.button>
      </header>
        
      {/* SOLVED: Added min-h-0 to prevent flexbox from collapsing on mobile */}
      <main className="flex-1 p-1 pt-0 min-h-0">
        <div className="bg-white dark:bg-gray-800/50 w-full h-full rounded-3xl shadow-sm overflow-hidden relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="w-full h-full"
            >
              {renderCurrentView()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <nav className="flex-shrink-0 px-2 py-4 flex justify-around items-center w-full max-w-md mx-auto">
        {(['home', 'wardrobe', 'creator']).map((view) => {
            const isActive = currentView === view;
            const Icon = { home: Home, wardrobe: Shirt, creator: PlusSquare }[view];
            return (
                <button
                    key={view}
                    onClick={() => setCurrentView(view)}
                    className={`flex flex-col items-center gap-1 transition-colors p-1 rounded-lg ${isActive ? 'text-accent' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                >
                    <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                    <span className={`text-xs font-bold ${isActive ? 'text-accent' : 'text-gray-500'}`}>{view.charAt(0).toUpperCase() + view.slice(1)}</span>
                </button>
            )
        })}
      </nav>

      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        theme={theme}
        setTheme={setTheme}
        accentColor={accentColor}
        setAccentColor={setAccentColor}
      />
    </div>
  );
}


// --- VIEW COMPONENTS ---

const ClassifierScreen = ({ file, onClassify, remaining }) => {
    return (
        <motion.div
            className="flex flex-col items-center justify-center h-full w-full p-4"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring' }}
        >
          <div className="w-full max-w-sm text-center">
            <h2 className="text-2xl font-bold mb-1">Classify Your Item</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{remaining > 0 ? `${remaining} more to classify.` : 'This is the last one!'}</p>
            <img src={file.image} alt="Pending classification" className="w-48 h-48 object-contain rounded-2xl mx-auto mb-4 border-2 border-dashed dark:border-gray-600 p-2" />
            <div className="grid grid-cols-2 gap-3 w-full">
              {CATEGORIES.map((cat) => (
                <button key={cat} onClick={() => onClassify(cat)} className="w-full py-3 text-sm capitalize bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl font-semibold transition-colors">
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
    )
}

// SOLVED: Simplified by removing nested AnimatePresence and layout prop to prevent render bugs
const WardrobeScreen = ({ clothes, onDeleteItem, onCreateOutfit, UploadButton }) => {
    return (
        <div className="w-full h-full flex flex-col">
            <h2 className="text-xl font-bold p-4 pb-2 text-center flex-shrink-0">Your Wardrobe</h2>
            <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {clothes.map(item => (
                    <motion.div
                        key={item.id}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="flex flex-col items-center group relative"
                    >
                        <div className="w-full aspect-square bg-gray-100 dark:bg-gray-700/50 rounded-xl flex items-center justify-center overflow-hidden">
                            <img src={item.image} alt={item.type} className="w-full h-full object-contain" />
                        </div>
                        <button onClick={() => onDeleteItem(item.id)} className="absolute top-1 right-1 bg-red-500/80 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                            <Trash2 size={14} />
                        </button>
                    </motion.div>
                ))}
            </div>
            <div className="p-4 flex flex-col gap-2 border-t dark:border-gray-700 flex-shrink-0">
                <button onClick={onCreateOutfit} className="w-full h-12 bg-accent text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity">Create New Outfit</button>
                {UploadButton}
            </div>
        </div>
    )
}

const OutfitCreator = ({ categorizedClothes, partIndexes, onChangePart, onSave, canSave, animationDirection, slideVariants }) => (
  <div className="flex flex-col h-full w-full">
    <h2 className="text-xl font-bold p-4 pb-2 text-center flex-shrink-0">Create Outfit</h2>
    <div className="flex-1 flex flex-col items-center justify-around overflow-y-auto p-2">
      {CATEGORIES.map(cat => {
        const items = categorizedClothes[cat];
        if (!items || (items.length === 0)) return <div key={cat} className="h-full w-full flex items-center justify-center text-gray-400 capitalize">{cat}</div>;
        
        const currentIndex = partIndexes[cat];
        const currentItem = items[currentIndex];

        return (
          <div key={cat} className="flex items-center w-full max-w-xs justify-between">
            <button disabled={items.length <= 1} onClick={() => onChangePart(cat, -1)} className="p-2 rounded-full disabled:opacity-20 transition-opacity hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400">
              <ChevronLeft size={20} />
            </button>
            <div className="w-24 h-24 flex items-center justify-center relative overflow-hidden">
                <AnimatePresence initial={false} custom={animationDirection}>
                    <motion.div
                        key={`${cat}-${currentItem.id}`}
                        className="w-full h-full absolute flex items-center justify-center"
                        variants={slideVariants}
                        custom={animationDirection}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.25 }}
                    >
                        {currentItem.image ? (
                            <img src={currentItem.image} alt={currentItem.type} className="w-full h-full object-contain" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                                <p className="text-sm font-semibold">None</p>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
            <button disabled={items.length <= 1} onClick={() => onChangePart(cat, 1)} className="p-2 rounded-full disabled:opacity-20 transition-opacity hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400">
              <ChevronRight size={20} />
            </button>
          </div>
        );
      })}
    </div>
    <div className="p-4 border-t dark:border-gray-700 flex-shrink-0">
      <button onClick={onSave} disabled={!canSave} className="w-full h-12 bg-accent text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed">
        Save Outfit
      </button>
    </div>
  </div>
);

const HomeScreen = ({ savedOutfits, outfitIndex, onChangeOutfit, onCreateNew, onDeleteOutfit, animationDirection, slideVariants }) => {
    const currentOutfit = savedOutfits[outfitIndex];
    
    if (savedOutfits.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <h2 className="text-2xl font-bold mb-2">No Outfits Yet</h2>
                <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-sm">
                    You haven't saved any outfits. Head over to the creator to make your first one!
                </p>
                <button onClick={onCreateNew} className="h-12 px-8 bg-accent text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity">
                    Create Outfit
                </button>
            </div>
        );
    }
    
    return (
        <div className="w-full h-full flex flex-col">
            <div className="flex-1 flex items-center justify-between relative overflow-hidden p-2">
                <button onClick={() => onChangeOutfit(-1)} className="absolute left-2 top-1/2 -translate-y-1/2 z-20 p-1 rounded-full bg-white/50 dark:bg-black/50 backdrop-blur-sm hover:bg-white/80 dark:hover:bg-black/80 text-gray-500 dark:text-gray-400">
                    <ChevronLeft size={20} />
                </button>
                <AnimatePresence initial={false} custom={animationDirection}>
                    <motion.div
                        key={currentOutfit.id}
                        className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4"
                        variants={slideVariants}
                        custom={animationDirection}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.35, type: 'spring', bounce: 0.3 }}
                    >
                        {CATEGORIES.map(cat => {
                            const item = currentOutfit[cat];
                            if (!item) return <div key={cat} className="h-32 w-32" />;
                            return (
                                <div key={cat} className="flex flex-col items-center">
                                    <div className="h-32 w-32 flex items-center justify-center">
                                        <img src={item.image} alt={item.type} className="max-w-full max-h-full object-contain" />
                                    </div>
                                </div>
                            )
                        })}
                    </motion.div>
                </AnimatePresence>
                <button onClick={() => onChangeOutfit(1)} className="absolute right-2 top-1/2 -translate-y-1/2 z-20 p-1 rounded-full bg-white/50 dark:bg-black/50 backdrop-blur-sm hover:bg-white/80 dark:hover:bg-black/80 text-gray-500 dark:text-gray-400">
                    <ChevronRight size={20} />
                </button>
            </div>
            <div className="p-4 flex items-center justify-between border-t dark:border-gray-700">
                <p className="font-semibold">{`Outfit ${outfitIndex + 1} of ${savedOutfits.length}`}</p>
                <button onClick={() => onDeleteOutfit(currentOutfit.id)} className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full transition-colors">
                    <Trash2 size={20} />
                </button>
            </div>
        </div>
    );
}

const SettingsPanel = ({ isOpen, onClose, theme, setTheme, accentColor, setAccentColor }) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
                >
                    <motion.div
                        initial={{ y: '100%' }}
                        animate={{ y: '0%' }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 20, stiffness: 200 }}
                        onClick={(e) => e.stopPropagation()}
                        className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-800 p-6 rounded-t-3xl shadow-2xl"
                    >
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold">Settings</h2>
                            <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400">
                                <X />
                            </button>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <h3 className="font-semibold mb-2">Theme</h3>
                                <div className="flex items-center justify-between bg-gray-100 dark:bg-gray-700 p-2 rounded-xl">
                                    <button onClick={() => setTheme('light')} className={`w-1/2 flex items-center justify-center gap-2 p-2 rounded-lg transition-colors ${theme === 'light' ? 'bg-white dark:bg-gray-500 shadow-sm' : ''}`}>
                                        <Sun size={18}/> Light
                                    </button>
                                    <button onClick={() => setTheme('dark')} className={`w-1/2 flex items-center justify-center gap-2 p-2 rounded-lg transition-colors ${theme === 'dark' ? 'bg-black text-white shadow-sm' : ''}`}>
                                        <Moon size={18}/> Dark
                                    </button>
                                </div>
                            </div>
                            <div>
                                <h3 className="font-semibold mb-3 flex items-center gap-2 text-accent"><Palette size={18}/> Accent Color</h3>
                                <div className="flex justify-around">
                                    {Object.entries(ACCENT_COLORS).map(([name, color]) => (
                                        <button key={name} onClick={() => setAccentColor(name)} className={`w-10 h-10 rounded-full transition-transform transform hover:scale-110 ${accentColor === name ? 'ring-2 ring-offset-2 dark:ring-offset-gray-800 ring-current' : ''}`} style={{ backgroundColor: color }} />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};