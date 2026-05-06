import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserPlus, Search, Trash2, MapPin, Phone, User, Smartphone, Hash, Terminal, Edit3, X, Check, Package, MapPinned, Info, ChevronLeft, ChevronRight, Layers } from 'lucide-react';
import { Client } from '../types';
import { firebaseService } from '../lib/firebaseService';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { AppConfig } from '../constants';

interface ClientManagementProps {
  appConfig: AppConfig;
  isAdmin: boolean;
  currentUserId: string;
  currentUserName: string;
}

export default function ClientManagement({ appConfig, isAdmin, currentUserId, currentUserName }: ClientManagementProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArea, setSelectedArea] = useState<string>('all');
  
  // View/Detail state
  const [viewingClient, setViewingClient] = useState<Client | null>(null);
  
  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [number, setNumber] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [seriesNumber, setSeriesNumber] = useState('');
  const [pkgDetails, setPkgDetails] = useState('');
  const [userNearby, setUserNearby] = useState('');
  const [panelDetails, setPanelDetails] = useState('');
  const [area, setArea] = useState(appConfig.zones[0] || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  const playPopupSound = () => {
    try {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
      audio.volume = 0.4;
      audio.play().catch(e => console.log('Audio play blocked:', e));
    } catch (e) {
      console.log('Audio error:', e);
    }
  };

  useEffect(() => {
    if (viewingClient) {
      playPopupSound();
    }
  }, [viewingClient]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedArea]);

  useEffect(() => {
    // Show all clients to everyone
    const unsubscribe = firebaseService.subscribeClients((data) => {
      setClients(data);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setUsername('');
    setNumber('');
    setMobileNumber('');
    setSeriesNumber('');
    setPkgDetails('');
    setUserNearby('');
    setPanelDetails('');
    setArea(appConfig.zones[0] || '');
  };

  const handleEdit = (client: Client) => {
    setEditingId(client.id);
    setName(client.name);
    setUsername(client.username);
    setNumber(client.number);
    setMobileNumber(client.mobileNumber);
    setSeriesNumber(client.seriesNumber);
    setPkgDetails(client.pkgDetails || '');
    setUserNearby(client.userNearby || '');
    setPanelDetails(client.panelDetails || '');
    setArea(client.area);
    
    // Scroll to form if on mobile
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !name.trim()) {
      toast.error('Client Identity (Name/Username) required');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingId) {
        await firebaseService.updateClient(editingId, {
          name: name.trim(),
          username: username.trim(),
          number: number.trim(),
          mobileNumber: mobileNumber.trim(),
          seriesNumber: seriesNumber.trim(),
          pkgDetails: pkgDetails.trim(),
          userNearby: userNearby.trim(),
          panelDetails: panelDetails.trim(),
          area: area,
        }, name.trim(), currentUserName);
        toast.success('Client record updated');
      } else {
        await firebaseService.createClient({
          name: name.trim(),
          username: username.trim(),
          number: number.trim(),
          mobileNumber: mobileNumber.trim(),
          seriesNumber: seriesNumber.trim(),
          pkgDetails: pkgDetails.trim(),
          userNearby: userNearby.trim(),
          panelDetails: panelDetails.trim(),
          area: area,
          createdBy: currentUserId
        }, currentUserName);
        toast.success('Client record successfully registered');
      }
      resetForm();
    } catch (error) {
      toast.error('Operation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, clientName: string) => {
    if (confirm(`Permanently remove client record for ${clientName}?`)) {
      try {
        await firebaseService.deleteClient(id, clientName, currentUserName);
        toast.success('Record purged from primary database');
      } catch (error) {
        toast.error('Purge operation failed');
      }
    }
  };

  const filteredClients = clients.filter(c => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = 
      c.name.toLowerCase().includes(query) ||
      c.username.toLowerCase().includes(query) ||
      (c.mobileNumber && c.mobileNumber.toLowerCase().includes(query)) ||
      (c.number && c.number.toLowerCase().includes(query)) ||
      (c.seriesNumber && c.seriesNumber.toLowerCase().includes(query));
      
    const matchesArea = selectedArea === 'all' || c.area === selectedArea;
    
    return matchesSearch && matchesArea;
  });

  // Pagination Logic
  const totalPages = Math.ceil(filteredClients.length / itemsPerPage);
  const paginatedClients = filteredClients.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const inputClasses = "w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-slate-950 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-accent/30 focus:border-brand-accent/50 focus:bg-white dark:focus:bg-slate-900 transition-all font-medium placeholder:text-slate-400 dark:placeholder:text-slate-600";
  const labelClasses = "block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.15em] ml-1 mb-1.5";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Form Section - ONLY FOR ADMINS */}
      {isAdmin && (
        <div className="lg:col-span-1">
          <div className="business-card p-8 bg-white dark:bg-slate-950 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none transition-transform group-hover:scale-110">
              {editingId ? <Edit3 size={120} /> : <Terminal size={120} />}
            </div>
            
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
                <div className={cn(
                  "p-2.5 rounded-xl ring-1",
                  editingId 
                    ? "bg-amber-500/10 text-amber-500 ring-amber-500/20" 
                    : "bg-brand-accent/10 text-brand-accent ring-brand-accent/20"
                )}>
                  {editingId ? <Edit3 size={20} /> : <UserPlus size={20} />}
                </div>
                {editingId ? 'Modify Record' : 'Registry Entry'}
              </h3>
              {editingId && (
                <button 
                  onClick={resetForm}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                  <X size={20} />
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1">
                <label className={labelClasses}>Full Identity (Name)</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: John Doe"
                    className={inputClasses}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className={labelClasses}>Access Username</label>
                <div className="relative">
                  <Terminal className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="johndoe_id"
                    className={inputClasses}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className={labelClasses}>Landline</label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="tel"
                      value={number}
                      onChange={(e) => setNumber(e.target.value)}
                      placeholder="+92 XXX"
                      className={inputClasses}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className={labelClasses}>Mobile</label>
                  <div className="relative">
                    <Smartphone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="tel"
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value)}
                      placeholder="+92 3XX"
                      className={inputClasses}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className={labelClasses}>Package Details</label>
                <div className="relative">
                  <Package className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    value={pkgDetails}
                    onChange={(e) => setPkgDetails(e.target.value)}
                    placeholder="Ex: 50Mbps Fiber"
                    className={inputClasses}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className={labelClasses}>User Nearby / Landmark</label>
                <div className="relative">
                  <MapPinned className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    value={userNearby}
                    onChange={(e) => setUserNearby(e.target.value)}
                    placeholder="Ex: Near City Garden Gate"
                    className={inputClasses}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className={labelClasses}>Pannal Details</label>
                <div className="relative">
                  <Layers className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    value={panelDetails}
                    onChange={(e) => setPanelDetails(e.target.value)}
                    placeholder="Ex: DP-04 / Box-02 / Port-08"
                    className={inputClasses}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className={labelClasses}>Series No.</label>
                  <div className="relative">
                    <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="text"
                      value={seriesNumber}
                      onChange={(e) => setSeriesNumber(e.target.value)}
                      placeholder="S-000"
                      className={inputClasses}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className={labelClasses}>Deployment Zone</label>
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <select
                      value={area}
                      onChange={(e) => setArea(e.target.value)}
                      className={cn(inputClasses, "appearance-none bg-no-repeat")}
                      style={{ 
                        backgroundPosition: 'right 1rem center', 
                        backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%2364748b\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'/%3E%3C/svg%3E")', 
                        backgroundSize: '1rem' 
                      }}
                    >
                      {appConfig.zones.map(zone => (
                        <option key={zone} value={zone}>{zone}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className={cn(
                  "w-full py-4 rounded-2xl text-white font-black uppercase tracking-[.25em] text-[10px] shadow-lg transition-all active:scale-[0.98] disabled:opacity-50",
                  editingId 
                    ? "bg-amber-500 shadow-amber-500/20 hover:bg-amber-600" 
                    : "bg-slate-950 dark:bg-brand-accent shadow-brand-accent/20 hover:scale-[1.02]"
                )}
              >
                {isSubmitting ? 'Processing...' : editingId ? 'Update Matrix Record' : 'Register User Profile'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Directory Section */}
      <div className={cn("lg:col-span-2", (!isAdmin && !editingId) && "lg:col-span-3")}>
        <div className="business-card bg-white dark:bg-slate-950 relative overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                Client Infrastructure Directory
              </h4>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {isAdmin ? 'Global Administrator View' : 'Personnel View Port'} • Operational Matrix Active
                </p>
                <div className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700 mx-1" />
                <span className="text-[10px] font-black text-brand-accent uppercase">{clients.length} Registered</span>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <select
                  value={selectedArea}
                  onChange={(e) => setSelectedArea(e.target.value)}
                  className="pl-9 pr-8 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-brand-accent/20 appearance-none"
                >
                  <option value="all">Global Zones</option>
                  {appConfig.zones.map(zone => (
                    <option key={zone} value={zone}>{zone}</option>
                  ))}
                </select>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ID / Name / Mobile..."
                  className="pl-9 pr-4 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-brand-accent/20 w-48 sm:w-64"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50/50 dark:bg-slate-900/50">
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Identity</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Contacts</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Package Details</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Details Pannal</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Navigation / Nearby</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">S/N</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Operations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50 text-[11px]">
                {isLoading ? (
                  Array(5).fill(0).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={7} className="px-6 py-6 h-12 bg-slate-50/50 dark:bg-slate-900/10"></td>
                    </tr>
                  ))
                ) : paginatedClients.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-bold uppercase tracking-widest">No client records found matching search parameters</td>
                  </tr>
                ) : paginatedClients.map((client) => (
                  <tr key={client.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-extrabold text-slate-900 dark:text-white uppercase tracking-tight">{client.name}</span>
                        <span className="text-[10px] font-black text-brand-accent/70 uppercase">@{client.username}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="flex items-center gap-1.5 font-bold text-slate-600 dark:text-slate-400">
                          <Smartphone size={10} className="text-sky-500" />
                          {client.mobileNumber || '---'}
                        </span>
                        <span className="flex items-center gap-1.5 font-bold text-slate-600 dark:text-slate-400">
                          <Phone size={10} className="text-indigo-500" />
                          {client.number || '---'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-fit">
                        <span className="text-[10px] font-black text-brand-accent uppercase tracking-tighter flex items-center gap-1.5">
                           <Package size={10} />
                           {client.pkgDetails || '---'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                        <Layers size={10} className="text-brand-accent/60" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">{client.panelDetails || '---'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-black text-slate-700 dark:text-slate-300 w-fit">{client.area}</span>
                        {client.userNearby && (
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                            <MapPinned size={8} className="text-rose-500" /> {client.userNearby}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                       <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 tracking-[0.2em]">{client.seriesNumber || '---'}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setViewingClient(client)}
                          className="p-2 text-slate-400 hover:text-brand-accent hover:bg-brand-accent/5 rounded-lg transition-all"
                          title="View Intelligence Detail"
                        >
                          <Info size={16} />
                        </button>
                        {(isAdmin || client.createdBy === currentUserId) && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleEdit(client)}
                              className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-lg transition-all"
                              title="Edit Record"
                            >
                              <Edit3 size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(client.id, client.name)}
                              className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-all"
                              title="Purge Record"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                        {!isAdmin && client.createdBy === currentUserId && (
                          <div className="hidden sm:flex p-1 px-2.5 rounded-full bg-emerald-500/10 text-emerald-500 items-center gap-1">
                            <Check size={10} />
                            <span className="text-[9px] font-black uppercase">Your Entry</span>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredClients.length > 0 && (
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Display Limit:</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md px-2 py-1 text-[10px] font-black text-slate-600 dark:text-slate-300 outline-none focus:ring-1 focus:ring-brand-accent transition-all"
                  >
                    <option value={20}>20 UNITS</option>
                    <option value={50}>50 UNITS</option>
                    <option value={100}>100 UNITS</option>
                    <option value={500}>500 UNITS</option>
                  </select>
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Matrix Status: <span className="text-slate-900 dark:text-white">{(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredClients.length)}</span> of <span className="text-brand-accent">{filteredClients.length}</span>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-400 hover:text-brand-accent disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft size={16} />
                </button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }

                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={cn(
                          "w-8 h-8 rounded-lg text-[10px] font-black uppercase transition-all",
                          currentPage === pageNum 
                            ? "bg-slate-900 dark:bg-brand-accent text-white shadow-lg" 
                            : "bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-500 hover:border-brand-accent hover:text-brand-accent"
                        )}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-400 hover:text-brand-accent disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Structured Client Details Modal */}
      <AnimatePresence>
        {viewingClient && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewingClient(null)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white dark:bg-slate-950 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden"
            >
            <div className="h-32 bg-slate-950 dark:bg-brand-accent relative overflow-hidden">
               <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,white_0%,transparent_100%)]" />
               <div className="absolute -bottom-8 -right-8 p-4 text-white opacity-10 rotate-12">
                  <User size={160} />
               </div>
               <button 
                onClick={() => setViewingClient(null)}
                className="absolute top-6 right-6 p-2 rounded-full bg-black/20 text-white hover:bg-black/40 transition-all z-10"
               >
                <X size={20} />
               </button>
            </div>

            <div className="px-8 pb-8">
               <div className="relative -mt-12 mb-6 inline-flex">
                 <div className="w-24 h-24 rounded-3xl bg-white dark:bg-slate-900 border-4 border-white dark:border-slate-950 shadow-xl flex items-center justify-center text-brand-accent">
                    <User size={40} />
                 </div>
                 <div className="absolute -bottom-1 -right-1 bg-emerald-500 w-6 h-6 rounded-full border-4 border-white dark:border-slate-950" />
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* section 1: Identity */}
                  <div className="space-y-6">
                    <div>
                      <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-accent mb-2">Core Identity</h5>
                      <p className="text-2xl font-black text-slate-900 dark:text-white leading-tight uppercase">{viewingClient.name}</p>
                      <p className="text-xs font-bold text-slate-500 tracking-widest mt-1">LINK ACCESS TAG: <span className="text-brand-accent">@{viewingClient.username}</span></p>
                    </div>

                    <div className="space-y-4 pt-2">
                       <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-slate-400">
                             <MapPin size={18} />
                          </div>
                          <div>
                            <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Deployment Zone</p>
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-tight">{viewingClient.area}</p>
                          </div>
                       </div>
                       
                       <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-slate-400">
                             <Package size={18} />
                          </div>
                          <div>
                            <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Service Matrix</p>
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-tight">{viewingClient.pkgDetails || 'No Active Package'}</p>
                          </div>
                       </div>

                       <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-slate-400">
                             <Hash size={18} />
                          </div>
                          <div>
                            <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Serial Inventory</p>
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-200 tracking-widest">{viewingClient.seriesNumber || 'UNASSIGNED'}</p>
                          </div>
                       </div>
                    </div>
                  </div>

                  {/* Section 2: Contacts & landmarks */}
                  <div className="space-y-6">
                    <div>
                      <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-accent mb-2">Connectivity & Navigation</h5>
                    </div>

                    <div className="space-y-4">
                       <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                          <div className="flex items-center gap-3 mb-3">
                             <Smartphone size={14} className="text-sky-500" />
                             <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mobile Terminal</span>
                          </div>
                          <p className="text-lg font-black text-slate-900 dark:text-white tracking-widest">{viewingClient.mobileNumber || 'Protocol Link Unknown'}</p>
                       </div>

                       <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                          <div className="flex items-center gap-3 mb-3">
                             <Phone size={14} className="text-indigo-500" />
                             <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fixed Line Archive</span>
                          </div>
                          <p className="text-lg font-black text-slate-900 dark:text-white tracking-widest">{viewingClient.number || 'Protocol Link Unknown'}</p>
                       </div>

                       <div className="flex gap-3">
                          <div className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
                             <MapPinned size={14} className="text-rose-500" />
                          </div>
                          <div className="flex-1">
                            <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">Landmark Intel</p>
                            <p className="text-xs font-bold text-slate-600 dark:text-slate-300 leading-relaxed uppercase">{viewingClient.userNearby || 'No geo-landmarks registered'}</p>
                          </div>
                       </div>

                       <div className="flex gap-3">
                          <div className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
                             <Layers size={14} className="text-brand-accent/60" />
                          </div>
                          <div className="flex-1">
                            <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">Pannal Intel</p>
                            <p className="text-xs font-bold text-slate-600 dark:text-slate-300 leading-relaxed uppercase">{viewingClient.panelDetails || 'No panel details registered'}</p>
                          </div>
                       </div>
                    </div>
                  </div>
               </div>

               <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Validated Registry Entry</span>
                  </div>
                  
                  <div className="flex gap-3">
                    {(isAdmin || viewingClient.createdBy === currentUserId) && (
                      <button 
                        onClick={() => {
                          handleEdit(viewingClient);
                          setViewingClient(null);
                        }}
                        className="px-6 py-3 rounded-xl bg-slate-950 dark:bg-brand-accent text-white text-[10px] font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95"
                      >
                        Modify Identity
                      </button>
                    )}
                  </div>
               </div>
            </div>
          </motion.div>
        </div>
      )}
      </AnimatePresence>
    </div>
  );
}
