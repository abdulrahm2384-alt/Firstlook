import { useState, useRef, ChangeEvent, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Image as ImageIcon, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  ChevronLeft, 
  Upload, 
  Pin, 
  Edit3, 
  Save,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { persistenceService } from '../services/persistenceService';

interface SetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
  pinnedText: string | null;
  onPinChange: (text: string | null) => void;
  onSave?: () => void;
}

type Grade = 'A+' | 'B' | 'C';

interface SetupData {
  id?: string;
  grade: Grade;
  image_url: string | null;
  confluences: string[];
}

export function SetupModal({ isOpen, onClose, userId, pinnedText, onPinChange, onSave }: SetupModalProps) {
  const [step, setStep] = useState<'GRADE' | 'DETAILS'>('GRADE');
  const [selectedGrade, setSelectedGrade] = useState<Grade | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  
  const [image, setImage] = useState<string | null>(null);
  const [confluences, setConfluences] = useState<string[]>([]);
  const [newConfluence, setNewConfluence] = useState('');
  const [savedSetups, setSavedSetups] = useState<Record<Grade, SetupData | null>>({
    'A+': null,
    'B': null,
    'C': null
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && userId) {
      fetchSetups();
    }
  }, [isOpen, userId]);

  const fetchSetups = async () => {
    if (!userId) return;
    setFetching(true);
    try {
      const data = await persistenceService.getSetups(userId);
      const setupMap: Record<Grade, SetupData | null> = { 'A+': null, 'B': null, 'C': null };
      data?.forEach((s: any) => {
        setupMap[s.grade as Grade] = {
          id: s.id,
          grade: s.grade,
          image_url: s.image_url,
          confluences: s.confluences || []
        };
      });
      setSavedSetups(setupMap);
    } catch (err) {
      console.error('Error fetching setups:', err);
    } finally {
      setFetching(false);
    }
  };

  const handleGradeSelect = (grade: Grade) => {
    setSelectedGrade(grade);
    const existing = savedSetups[grade];
    if (existing) {
      setImage(existing.image_url);
      setConfluences(existing.confluences);
      setIsEditing(false);
    } else {
      setImage(null);
      setConfluences([]);
      setIsEditing(true);
    }
    setStep('DETAILS');
  };

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId || !selectedGrade) return;

    setLoading(true);
    try {
      const url = await persistenceService.uploadSetupImage(userId, selectedGrade, file);
      if (url) {
        setImage(url);
      } else {
        // Fallback or handle error
        const reader = new FileReader();
        reader.onloadend = () => setImage(reader.result as string);
        reader.readAsDataURL(file);
      }
    } catch (err) {
      console.error('Error uploading image:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveSetup = async () => {
    if (!userId || !selectedGrade) return;

    setLoading(true);
    try {
      await persistenceService.saveSetup(userId, selectedGrade, image, confluences);
      await fetchSetups();
      if (onSave) onSave();
      setIsEditing(false);
    } catch (err) {
      console.error('Error saving setup:', err);
    } finally {
      setLoading(false);
    }
  };

  const addConfluence = () => {
    if (newConfluence.trim() && isEditing) {
      setConfluences([...confluences, newConfluence.trim()]);
      setNewConfluence('');
    }
  };

  const removeConfluence = (index: number) => {
    if (isEditing) {
      setConfluences(confluences.filter((_, i) => i !== index));
    }
  };

  const toggleSetupPin = () => {
    const listText = confluences.join('\n');
    if (pinnedText === listText) {
      onPinChange(null);
    } else {
      onPinChange(listText);
    }
  };

  const isCurrentSetupPinned = confluences.length > 0 && pinnedText === confluences.join('\n');

  const grades: { id: Grade, label: string, color: string, description: string }[] = [
    { id: 'A+', label: 'A+', color: 'emerald', description: 'Highest probability setup. All criteria met.' },
    { id: 'B', label: 'B', color: 'blue', description: 'Strong setup with minor missing confluences.' },
    { id: 'C', label: 'C', color: 'orange', description: 'Lower probability. Aggressive entry signal.' },
  ];

  const handleClose = () => {
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200]"
          />

          <motion.div 
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 lg:top-1/2 lg:left-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 lg:bottom-auto lg:w-[480px] bg-white lg:rounded-[2.5rem] shadow-[-20px_0_50px_rgba(0,0,0,0.1)] z-[201] flex flex-col rounded-t-[2.5rem] overflow-hidden max-h-[85vh] lg:max-h-[80vh]"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-10">
              <div className="flex items-center gap-3">
                {step === 'DETAILS' && (
                  <button 
                    onClick={() => {
                      setStep('GRADE');
                      setIsEditing(false);
                    }}
                    className="w-10 h-10 rounded-xl hover:bg-slate-50 text-slate-400 flex items-center justify-center transition-all active:scale-95"
                  >
                    <ChevronLeft size={18} />
                  </button>
                )}
                <div className="flex flex-col">
                  <h2 className="text-[13px] font-black tracking-widest text-slate-900 uppercase">
                    {step === 'GRADE' ? 'Strategic Atlas' : `Profile: Grade ${selectedGrade}`}
                  </h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                      {step === 'GRADE' ? 'Model Selection' : isEditing ? 'Modification Engine' : 'Protocol Review'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {step === 'DETAILS' && !isEditing && (
                  <button 
                    id="setup-edit-toggle"
                    onClick={() => setIsEditing(true)}
                    className="w-8 h-8 flex items-center justify-center bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-100 transition-all active:scale-90"
                  >
                    <Edit3 size={14} />
                  </button>
                )}
                <button 
                  id="setup-modal-close"
                  onClick={handleClose}
                  className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-50 transition-colors group"
                >
                  <X size={20} className="text-slate-300 group-hover:text-slate-600" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-0 scrollbar-hide">
              {fetching ? (
                <div className="h-64 flex flex-col items-center justify-center gap-4 text-slate-300">
                   <Loader2 size={24} className="animate-spin" />
                   <span className="text-[9px] font-black uppercase tracking-widest">Compiling Protocols...</span>
                </div>
              ) : step === 'GRADE' ? (
                <div className="p-6 space-y-6">
                  <div className="px-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">
                      Define your operational frameworks
                    </p>
                  </div>
                  <div className="grid gap-4">
                    {grades.map((g) => {
                      const setup = savedSetups[g.id];
                      const hasData = !!setup;
                      return (
                        <button
                          key={g.id}
                          onClick={() => handleGradeSelect(g.id)}
                          className={`group flex items-stretch gap-0 p-0 rounded-[2rem] border transition-all text-left bg-white overflow-hidden
                            ${hasData ? 'border-slate-100 shadow-sm hover:border-indigo-200' : 'border-dashed border-slate-200 opacity-60 hover:opacity-100'}`}
                        >
                          <div className={`w-20 shrink-0 flex items-center justify-center text-xl font-black 
                            ${g.id === 'A+' ? 'bg-emerald-50 text-emerald-600' : 
                              g.id === 'B' ? 'bg-indigo-50 text-indigo-600' : 
                              'bg-amber-50 text-amber-600'} transition-all`}
                          >
                            {g.id}
                          </div>
                          <div className="flex-1 p-5 border-l border-slate-50 flex flex-col justify-between">
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <div className="text-[11px] font-black uppercase tracking-widest text-slate-900">Grade {g.label}</div>
                                {hasData && <CheckCircle2 size={12} className="text-emerald-500" />}
                              </div>
                              <p className="text-[10px] text-slate-400 font-medium leading-relaxed">{g.description}</p>
                            </div>
                            {hasData && (
                              <div className="mt-3 flex items-center gap-2">
                                <span className="text-[8px] font-black text-indigo-600/50 uppercase tracking-tighter">
                                  {setup?.confluences?.length || 0} CONFLUENCES
                                </span>
                                {setup?.image_url && (
                                   <div className="w-1 h-1 rounded-full bg-slate-200" />
                                )}
                                {setup?.image_url && (
                                  <span className="text-[8px] font-black text-slate-300 uppercase tracking-tighter">
                                    VISUAL ATTACHED
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col">
                  {!isEditing && savedSetups[selectedGrade!] ? (
                    <div className="flex flex-col">
                      {image && (
                        <div className="relative group cursor-pointer" onClick={() => setIsEditing(true)}>
                          <img src={image} className="w-full aspect-video object-cover" />
                          <div className="absolute inset-0 bg-black/10 transition-colors group-hover:bg-black/20" />
                        </div>
                      )}
                      
                      <div className="p-8 space-y-8">
                        <div>
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-1 h-4 bg-slate-900 rounded-full" />
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Core Protocol</h3>
                          </div>
                          <div className="space-y-3">
                            {confluences.length > 0 ? (
                              confluences.map((c, i) => (
                                <div key={i} className="flex items-start gap-4 p-4 bg-slate-50/50 rounded-2xl border border-slate-100/50">
                                  <span className="text-[10px] font-black text-slate-300 mt-0.5">{String(i+1).padStart(2, '0')}</span>
                                  <p className="text-xs font-bold text-slate-700 leading-relaxed">{c}</p>
                                </div>
                              ))
                            ) : (
                              <div className="p-8 border border-dashed border-slate-100 rounded-[2rem] flex flex-col items-center justify-center gap-3 text-slate-300">
                                <AlertCircle size={20} />
                                <span className="text-[9px] font-black uppercase tracking-widest text-center">No protocol items registered</span>
                                <button onClick={() => setIsEditing(true)} className="mt-2 text-[9px] font-black text-indigo-600 uppercase tracking-widest border-b border-indigo-200 pb-0.5">Initialize Setup</button>
                              </div>
                            )}
                          </div>
                        </div>

                        {!image && (
                           <div className="p-8 border border-dashed border-slate-100 rounded-[2rem] flex flex-col items-center justify-center gap-3 text-slate-300">
                              <ImageIcon size={20} />
                              <span className="text-[9px] font-black uppercase tracking-widest">No visual model</span>
                              <button onClick={() => setIsEditing(true)} className="text-[9px] font-black text-indigo-600 uppercase tracking-widest border-b border-indigo-200 pb-0.5">Attach Image</button>
                           </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 space-y-8 pb-10">
                      {/* Edit Mode Content */}
                      <section>
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 px-1 flex items-center justify-between">
                           <div className="flex items-center gap-2"><ImageIcon size={12} /> Blueprint</div>
                           {image && <button onClick={() => setImage(null)} className="text-red-500 hover:text-red-700 transition-colors"><Trash2 size={12} /></button>}
                        </h3>
                        
                        <div 
                          onClick={() => fileInputRef.current?.click()}
                          className={`relative aspect-video rounded-[2rem] border-2 transition-all overflow-hidden flex flex-col items-center justify-center gap-3 cursor-pointer
                            ${image ? 'border-transparent shadow-xl' : 'border-dashed border-slate-200 hover:border-indigo-500 hover:bg-slate-50'}`}
                        >
                          {image ? (
                            <>
                              <img src={image} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity">
                                <div className="px-4 py-2 bg-white rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-900 border border-slate-100">
                                  Replace Surface
                                </div>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300">
                                 <Upload size={18} />
                              </div>
                              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Capture visual example</span>
                            </>
                          )}
                          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                        </div>
                      </section>

                      <section>
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 px-1 flex items-center gap-2">
                          <CheckCircle2 size={12} /> Criteria Engine
                        </h3>

                        <div className="space-y-4">
                          <div className="relative">
                            <input 
                              type="text"
                              placeholder="Define a confluence..."
                              value={newConfluence}
                              onChange={(e) => setNewConfluence(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && addConfluence()}
                              className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-5 pr-12 text-sm font-bold text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-600/5 transition-all"
                            />
                            <button 
                              onClick={addConfluence}
                              disabled={!newConfluence.trim()}
                              className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-lg active:scale-90 transition-all disabled:opacity-30 disabled:grayscale"
                            >
                              <Plus size={18} />
                            </button>
                          </div>

                          <div className="space-y-2">
                            {confluences.map((c, i) => (
                              <motion.div 
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                key={i}
                                className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl group shadow-sm"
                              >
                                <span className="text-xs font-bold text-slate-700 truncate pr-4">{c}</span>
                                <button onClick={() => removeConfluence(i)} className="text-slate-300 hover:text-red-500 transition-colors">
                                  <Trash2 size={14} />
                                </button>
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      </section>

                      <div className="pt-4 flex flex-col gap-3">
                        <button 
                          onClick={saveSetup}
                          disabled={loading}
                          className="w-full py-5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-slate-900/10 hover:bg-slate-800 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                        >
                          {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                          Seal Protocol
                        </button>
                        <button 
                          onClick={() => {
                            const existing = savedSetups[selectedGrade!];
                            if (existing) {
                              setImage(existing.image_url);
                              setConfluences(existing.confluences);
                              setIsEditing(false);
                            } else {
                              setStep('GRADE');
                            }
                          }}
                          className="w-full py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
                        >
                          Discard Changes
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
