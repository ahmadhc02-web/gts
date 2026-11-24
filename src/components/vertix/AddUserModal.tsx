import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  User as UserIcon,
  X,
  Eye,
  EyeOff,
  AlertCircle,
  Check,
  Shield,
  Layers,
  Sparkles,
  Lock,
  Phone,
  MapPin,
  CreditCard,
  FileText,
} from 'lucide-react';
import { useRadiusStore, RadiusUser } from './radiusStore';
import { formatRadiusError } from './radiusApi';

export interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode?: boolean;
  onSuccess?: (newUser: RadiusUser) => void;
  addToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export default function AddUserModal({
  isOpen,
  onClose,
  isDarkMode = false,
  onSuccess,
  addToast,
}: AddUserModalProps) {
  const store = useRadiusStore();

  // Basic Information States (all blank by default - strictly no demo values)
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [serviceProfile, setServiceProfile] = useState('');
  const [parent, setParent] = useState('gnmain');
  const [macLock, setMacLock] = useState(false);

  // Personal Information States (all blank by default)
  const [firstName, setFirstName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [notes, setNotes] = useState('');
  const [autoRenew, setAutoRenew] = useState(false);

  // Form submission and error states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Reset or initialize form whenever modal opens (clean empty state)
  useEffect(() => {
    if (isOpen) {
      setUsername('');
      setPassword('');
      setConfirmPassword('');
      setShowPassword(false);
      setShowConfirmPassword(false);
      setServiceProfile(store.packages[0]?.name || '');
      setParent('gnmain');
      setMacLock(false);

      setFirstName('');
      setPhone('');
      setCity('');
      setAddress('');
      setNationalId('');
      setNotes('');
      setAutoRenew(false);
      setErrorMessage('');
      setIsSubmitting(false);
    }
  }, [isOpen, store.packages]);

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Strictly enforce lowercase on username input regardless of Caps Lock or mobile keyboards
  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Convert to lowercase and strip whitespace
    const lower = e.target.value.toLowerCase().replace(/\s+/g, '');
    setUsername(lower);
  };

  // Strictly enforce 11 digits numeric only for Phone
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const onlyNums = e.target.value.replace(/\D/g, '').slice(0, 11);
    setPhone(onlyNums);
  };

  // Strictly enforce 13 digits numeric only for National ID
  const handleNationalIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const onlyNums = e.target.value.replace(/\D/g, '').slice(0, 13);
    setNationalId(onlyNums);
  };

  // Real-time unique username check (strictly no duplicate usernames)
  const cleanUsername = username.trim().toLowerCase();
  const isUsernameTaken =
    cleanUsername.length > 0 &&
    (store.users || []).some(
      u => u && u.username && u.username.trim().toLowerCase() === cleanUsername
    );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMessage('');

    // Required fields validation
    if (!cleanUsername) {
      setErrorMessage('Username is required.');
      return;
    }
    if (cleanUsername.length < 4) {
      setErrorMessage('Username must be at least 4 characters long.');
      return;
    }

    // Strictly check if username already exists
    if (isUsernameTaken) {
      const err = `Username "${cleanUsername}" is already created! Duplicate usernames are strictly not allowed.`;
      setErrorMessage(err);
      addToast?.(err, 'error');
      return;
    }

    if (!password) {
      setErrorMessage('Password is required.');
      return;
    }
    if (password.length < 4) {
      setErrorMessage('Password must be at least 4 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Password and Confirm Password do not match.');
      return;
    }
    if (!serviceProfile) {
      setErrorMessage('Please select a Service Profile.');
      return;
    }
    if (!parent) {
      setErrorMessage('Please select a Parent account.');
      return;
    }
    if (!firstName.trim()) {
      setErrorMessage('Full Name is required.');
      return;
    }
    if (!phone.trim()) {
      setErrorMessage('Phone number is required.');
      return;
    }
    if (phone.length !== 11) {
      setErrorMessage('Phone number must be exactly 11 digits (numbers only).');
      return;
    }
    if (!address.trim()) {
      setErrorMessage('Address is required.');
      return;
    }
    if (!nationalId.trim()) {
      setErrorMessage('National ID is required.');
      return;
    }
    if (nationalId.length !== 13) {
      setErrorMessage('National ID must be exactly 13 digits (numbers only).');
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedPkg = store.packages.find(p => p.name === serviceProfile);
      const newUser = await store.addUser({
        username: cleanUsername,
        name: firstName.trim(),
        mobile: phone.trim(),
        package: serviceProfile,
        packageId: selectedPkg?.id,
        months: 1,
        password,
        owner: parent,
        status: 'Pre-Active',
        city: city.trim(),
        address: address.trim(),
        nationalId: nationalId.trim(),
        notes: notes.trim(),
        autoRenew,
        macLock,
      });

      addToast?.(`User ${newUser.username} registered with Pre-Active status. Click "Active" to recharge & activate service!`, 'success');
      onSuccess?.(newUser);
      onClose();
    } catch (err: any) {
      setErrorMessage(formatRadiusError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-5 overflow-y-auto vertix-dashboard-scroll">
          {/* Backdrop with smooth blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/75"
          />

          {/* Modal Container */}
          <motion.div
            data-font-lexend="true"
            style={{ fontFamily: "'Lexend', 'Plus Jakarta Sans', sans-serif" }}
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className={`relative w-full max-w-5xl my-auto rounded-2xl border shadow-2xl overflow-hidden font-lexend transition-colors ${
              isDarkMode
                ? 'bg-[#0f172a] border-slate-800 text-white shadow-black/80'
                : 'bg-white border-slate-200 text-slate-900 shadow-slate-900/15'
            }`}
          >
            {/* Header: Dark header bar matching original form */}
            <div
              className={`px-5 sm:px-6 py-3.5 border-b flex items-center justify-between gap-4 ${
                isDarkMode
                  ? 'bg-[#1e293b] border-slate-700/80 text-white'
                  : 'bg-[#2b3542] border-slate-700 text-white shadow-xs'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-white/10 text-white flex items-center justify-center border border-white/15">
                  <UserIcon className="w-4 h-4" />
                </div>
                <h2 className="text-sm sm:text-base font-bold tracking-wide text-white">
                  User Form
                </h2>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Dismiss (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* FORM BODY */}
            <form onSubmit={handleSubmit} style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y' }} className="p-4 sm:p-7 space-y-6 max-h-[82dvh] overflow-y-auto vertix-dashboard-scroll">
              {/* Error banner if validation fails */}
              {errorMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2.5"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </motion.div>
              )}

              {/* SECTION 1: BASIC INFORMATION */}
              <div className="space-y-4">
                <div className="border-b pb-2 border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 tracking-tight flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Basic Information
                  </h3>
                  <span className="text-[11px] text-slate-400 font-medium">Authentication & Network Access</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-xs sm:text-sm">
                  {/* Left Col: Username (Strictly Lowercase, no Caps Lock allowed, Unique check) */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <label className="sm:w-36 font-semibold text-slate-600 dark:text-slate-300 shrink-0 sm:pt-2">
                      Username <span className="text-red-500 font-bold">*</span>
                    </label>
                    <div className="flex-1 w-full relative">
                      <input
                        type="text"
                        required
                        minLength={4}
                        value={username}
                        onChange={handleUsernameChange}
                        onInput={(e: React.FormEvent<HTMLInputElement>) => {
                          // Double guarantee against Caps Lock / mobile autocorrect
                          const target = e.currentTarget;
                          target.value = target.value.toLowerCase().replace(/\s+/g, '');
                        }}
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        placeholder="Enter username (min 4 characters)"
                        className={`w-full px-3 py-2 rounded-lg border outline-none font-medium lowercase transition-colors ${
                          isUsernameTaken
                            ? 'bg-rose-50/70 border-rose-500 text-rose-700 dark:bg-rose-950/40 dark:border-rose-500 dark:text-rose-200 focus:border-rose-600 focus:ring-1 focus:ring-rose-500'
                            : isDarkMode
                            ? 'bg-slate-900 border-slate-700 text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
                            : 'bg-[#f0f5ff] border-slate-300 text-slate-900 focus:border-emerald-500 focus:bg-white focus:ring-1 focus:ring-emerald-500 shadow-2xs'
                        }`}
                      />
                      {isUsernameTaken && (
                        <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>Username already created! Already exists.</span>
                        </p>
                      )}
                      {!isUsernameTaken && cleanUsername.length > 0 && cleanUsername.length < 4 && (
                        <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>Minimum 4 characters required ({cleanUsername.length}/4)</span>
                        </p>
                      )}
                      {!isUsernameTaken && cleanUsername.length >= 4 && (
                        <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5 shrink-0" />
                          <span>Username available</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right Col: * Service Profile */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="sm:w-36 font-semibold text-slate-700 dark:text-slate-200 shrink-0">
                      <span className="text-red-500 font-bold mr-0.5">*</span> Service Profile
                    </label>
                    <select
                      value={serviceProfile}
                      onChange={e => setServiceProfile(e.target.value)}
                      required
                      className={`flex-1 w-full px-3 py-2 rounded-lg border outline-none font-semibold transition-colors cursor-pointer ${
                        isDarkMode
                          ? 'bg-slate-900 border-slate-700 text-white focus:border-emerald-500'
                          : 'bg-white border-slate-300 text-slate-900 focus:border-emerald-500 shadow-2xs'
                      }`}
                    >
                      <option value="" disabled>select profile</option>
                      {store.packages.map(p => (
                        <option key={p.id} value={p.name}>
                          {p.name} ({p.speed}) — Rs. {p.pricePerMonth.toLocaleString()}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Left Col: Password (Empty by default) */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <label className="sm:w-36 font-semibold text-slate-600 dark:text-slate-300 shrink-0 sm:pt-2">
                      Password <span className="text-red-500 font-bold">*</span>
                    </label>
                    <div className="flex-1 w-full">
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          minLength={4}
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          placeholder="Enter password (min 4 characters)"
                          className={`w-full px-3 py-2 pr-9 rounded-lg border outline-none font-medium transition-colors ${
                            isDarkMode
                              ? 'bg-slate-900 border-slate-700 text-white focus:border-emerald-500'
                              : 'bg-[#f0f5ff] border-slate-300 text-slate-900 focus:border-emerald-500 focus:bg-white shadow-2xs'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {password.length > 0 && password.length < 4 && (
                        <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>Minimum 4 characters required ({password.length}/4)</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right Col: Confirm Password (Empty by default) */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="sm:w-36 font-semibold text-slate-600 dark:text-slate-300 shrink-0">
                      Confirm Password <span className="text-red-500 font-bold">*</span>
                    </label>
                    <div className="relative flex-1 w-full">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        minLength={4}
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="Confirm password"
                        className={`w-full px-3 py-2 pr-9 rounded-lg border outline-none font-medium transition-colors ${
                          isDarkMode
                            ? 'bg-slate-900 border-slate-700 text-white focus:border-emerald-500'
                            : 'bg-white border-slate-300 text-slate-900 focus:border-emerald-500 shadow-2xs'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Left Col: * Parent */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="sm:w-36 font-semibold text-slate-700 dark:text-slate-200 shrink-0">
                      <span className="text-red-500 font-bold mr-0.5">*</span> Parent
                    </label>
                    <select
                      value={parent}
                      onChange={e => setParent(e.target.value)}
                      required
                      className={`flex-1 w-full px-3 py-2 rounded-lg border outline-none font-semibold transition-colors cursor-pointer ${
                        isDarkMode
                          ? 'bg-slate-900 border-slate-700 text-white focus:border-emerald-500'
                          : 'bg-white border-slate-300 text-slate-900 focus:border-emerald-500 shadow-2xs'
                      }`}
                    >
                      <option value="gnmain">gnmain</option>
                      <option value="Admin (SuperAdmin)">Admin (SuperAdmin)</option>
                      {store.managers.map(m => (
                        <option key={m.id} value={m.name}>
                          {m.name} ({m.role})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Right Col: MAC Lock */}
                  <div className="flex items-center justify-between gap-2">
                    <label className="font-semibold text-slate-600 dark:text-slate-300">
                      MAC Lock
                    </label>
                    <button
                      type="button"
                      onClick={() => setMacLock(!macLock)}
                      className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors cursor-pointer ${
                        macLock ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                      role="switch"
                      aria-checked={macLock}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${
                          macLock ? 'translate-x-7' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* SECTION 2: PERSONAL INFORMATION */}
              <div className="space-y-4 pt-3 border-t border-slate-200 dark:border-slate-800">
                <div className="border-b pb-2 border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 tracking-tight flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-500" />
                    Personal Information
                  </h3>
                  <span className="text-[11px] text-slate-400 font-medium">Customer Profile & Verification</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-xs sm:text-sm">
                  {/* Left Col: * Full Name */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="sm:w-36 font-semibold text-slate-700 dark:text-slate-200 shrink-0">
                      <span className="text-red-500 font-bold mr-0.5">*</span> Full Name
                    </label>
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={e => setFirstName(e.target.value)}
                      placeholder="e.g. Muhammad Ahmad"
                      className={`flex-1 w-full px-3 py-2 rounded-lg border outline-none font-medium transition-colors ${
                        isDarkMode
                          ? 'bg-slate-900 border-slate-700 text-white focus:border-emerald-500'
                          : 'bg-white border-slate-300 text-slate-900 focus:border-emerald-500 shadow-2xs'
                      }`}
                    />
                  </div>

                  {/* Right Col: * Phone (Exactly 11 digits, numbers only) */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="sm:w-36 font-semibold text-slate-700 dark:text-slate-200 shrink-0">
                      <span className="text-red-500 font-bold mr-0.5">*</span> Phone
                    </label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={handlePhoneChange}
                      onInput={(e: React.FormEvent<HTMLInputElement>) => {
                        const target = e.currentTarget;
                        target.value = target.value.replace(/\D/g, '').slice(0, 11);
                      }}
                      maxLength={11}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="0300xxxxxxx"
                      className={`flex-1 w-full px-3 py-2 rounded-lg border outline-none font-medium font-mono transition-colors ${
                        isDarkMode
                          ? 'bg-slate-900 border-slate-700 text-white focus:border-emerald-500'
                          : 'bg-white border-slate-300 text-slate-900 focus:border-emerald-500 shadow-2xs'
                      }`}
                    />
                  </div>

                  {/* Left Col: City */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="sm:w-36 font-semibold text-slate-600 dark:text-slate-300 shrink-0">
                      City
                    </label>
                    <input
                      type="text"
                      value={city}
                      onChange={e => setCity(e.target.value)}
                      placeholder="e.g. Sadiqabad, Rahim yar khan, Bhawalpure"
                      className={`flex-1 w-full px-3 py-2 rounded-lg border outline-none font-medium transition-colors ${
                        isDarkMode
                          ? 'bg-slate-900 border-slate-700 text-white focus:border-emerald-500'
                          : 'bg-white border-slate-300 text-slate-900 focus:border-emerald-500 shadow-2xs'
                      }`}
                    />
                  </div>

                  {/* Right Col: * Address */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="sm:w-36 font-semibold text-slate-700 dark:text-slate-200 shrink-0">
                      <span className="text-red-500 font-bold mr-0.5">*</span> Address
                    </label>
                    <input
                      type="text"
                      required
                      value={address}
                      onChange={e => setAddress(e.target.value)}
                      placeholder="House #, Street, Block, Area"
                      className={`flex-1 w-full px-3 py-2 rounded-lg border outline-none font-medium transition-colors ${
                        isDarkMode
                          ? 'bg-slate-900 border-slate-700 text-white focus:border-emerald-500'
                          : 'bg-white border-slate-300 text-slate-900 focus:border-emerald-500 shadow-2xs'
                      }`}
                    />
                  </div>

                  {/* Left Col: * National ID (Exactly 13 digits, numbers only) */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="sm:w-36 font-semibold text-slate-700 dark:text-slate-200 shrink-0">
                      <span className="text-red-500 font-bold mr-0.5">*</span> National ID
                    </label>
                    <input
                      type="text"
                      required
                      value={nationalId}
                      onChange={handleNationalIdChange}
                      onInput={(e: React.FormEvent<HTMLInputElement>) => {
                        const target = e.currentTarget;
                        target.value = target.value.replace(/\D/g, '').slice(0, 13);
                      }}
                      maxLength={13}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder=""
                      className={`flex-1 w-full px-3 py-2 rounded-lg border outline-none font-medium font-mono transition-colors ${
                        isDarkMode
                          ? 'bg-slate-900 border-slate-700 text-white focus:border-emerald-500'
                          : 'bg-white border-slate-300 text-slate-900 focus:border-emerald-500 shadow-2xs'
                      }`}
                    />
                  </div>

                  {/* Right Col: Auto Renew */}
                  <div className="flex items-center justify-between gap-2">
                    <label className="font-semibold text-slate-600 dark:text-slate-300">
                      Auto Renew
                    </label>
                    <button
                      type="button"
                      onClick={() => setAutoRenew(!autoRenew)}
                      className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors cursor-pointer ${
                        autoRenew ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                      role="switch"
                      aria-checked={autoRenew}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${
                          autoRenew ? 'translate-x-7' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Full Row: Notes */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 md:col-span-2">
                    <label className="sm:w-36 font-semibold text-slate-600 dark:text-slate-300 shrink-0 pt-1.5">
                      Notes
                    </label>
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Additional instructions, ONU fiber port details, drop cable ID..."
                      className={`flex-1 w-full px-3 py-2 rounded-lg border outline-none font-medium transition-colors resize-y ${
                        isDarkMode
                          ? 'bg-slate-900 border-slate-700 text-white focus:border-emerald-500'
                          : 'bg-white border-slate-300 text-slate-900 focus:border-emerald-500 shadow-2xs'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* FOOTER ACTIONS: Dismiss & Submit */}
              <div
                className={`pt-5 border-t flex items-center justify-end gap-3 ${
                  isDarkMode ? 'border-slate-800' : 'border-slate-200'
                }`}
              >
                <button
                  type="button"
                  onClick={onClose}
                  className={`px-5 py-2.5 text-xs sm:text-sm font-semibold rounded-lg border transition-colors cursor-pointer ${
                    isDarkMode
                      ? 'border-slate-700 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 shadow-xs'
                  }`}
                >
                  Dismiss
                </button>

                <motion.button
                  whileHover={!isUsernameTaken && !isSubmitting ? { scale: 1.01 } : undefined}
                  whileTap={!isUsernameTaken && !isSubmitting ? { scale: 0.98 } : undefined}
                  type="submit"
                  disabled={isSubmitting || isUsernameTaken}
                  title={isUsernameTaken ? 'Username is already created. Please choose another username.' : ''}
                  className="px-8 py-2.5 text-xs sm:text-sm font-bold rounded-lg bg-[#0098ca] hover:bg-[#0087b3] text-white shadow-md hover:shadow-cyan-500/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <span>Submit</span>
                  )}
                </motion.button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
