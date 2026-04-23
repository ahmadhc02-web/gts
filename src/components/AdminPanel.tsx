import React, { useState } from 'react';
import { motion } from 'motion/react';
import { UserPlus, Settings, Users, ClipboardList, Key, Shield, Trash2, FileSpreadsheet, ExternalLink, HardDriveDownload } from 'lucide-react';
import { Complaint, ComplaintStatus, UserProfile } from '../types';
import ComplaintList from './ComplaintList';
import { googleSheetsService } from '../services/googleSheetsService';
import { cn } from '../lib/utils';

interface AdminPanelProps {
  complaints: Complaint[];
  users: UserProfile[];
  currentUserId: string;
  onDeleteComplaint: (id: string) => Promise<void>;
  onUpdateComplaintStatus: (id: string, status: ComplaintStatus) => Promise<void>;
  onCreateUser: (username: string, pass: string, role: 'admin' | 'member') => Promise<void>;
  onDeleteUser: (uid: string) => Promise<void>;
  onChangeAdminPass: (newPass: string) => Promise<void>;
}

export default function AdminPanel({
  complaints,
  users,
  currentUserId,
  onDeleteComplaint,
  onUpdateComplaintStatus,
  onCreateUser,
  onDeleteUser,
  onChangeAdminPass
}: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<'complaints' | 'users' | 'settings' | 'integrations'>('complaints');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'member'>('member');
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [adminNewPass, setAdminNewPass] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Google Sheets state
  const [googleTokens, setGoogleTokens] = useState(googleSheetsService.getTokens());
  const [spreadsheetId, setSpreadsheetId] = useState(googleSheetsService.getSpreadsheetId() || '');
  const [isConnecting, setIsConnecting] = useState(false);

  const handleGoogleConnect = async () => {
    setIsConnecting(true);
    try {
      const tokens = await googleSheetsService.initiateAuth();
      setGoogleTokens(tokens);
    } catch (err) {
      console.error(err);
      alert('Failed to connect to Google Account.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSaveSpreadsheetId = () => {
    googleSheetsService.saveSpreadsheetId(spreadsheetId);
    alert('Spreadsheet ID saved successfully!');
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const trimmedName = newUsername.trim();
    if (!trimmedName || !newPassword.trim()) {
      setFormError('Username and password are required.');
      return;
    }

    if (users.some(u => u.username.toLowerCase() === trimmedName.toLowerCase())) {
      setFormError('This username is already taken.');
      return;
    }

    if (trimmedName.toLowerCase() === newPassword.toLowerCase()) {
      setFormError('Security Error: Password cannot match username.');
      return;
    }

    setIsCreating(true);
    try {
      await onCreateUser(trimmedName, newPassword, newUserRole);
      setFormSuccess(`${newUserRole.charAt(0).toUpperCase() + newUserRole.slice(1)} account "${trimmedName}" created!`);
      setNewUsername('');
      setNewPassword('');
      setNewUserRole('member');
      setTimeout(() => setFormSuccess(null), 5000); // Clear success after 5s
    } catch (err) {
      setFormError('Critical Error: Could not save account.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleResetAppData = () => {
    if (confirm('WARNING: This will delete ALL local accounts and complaints permanently. Are you absolutely sure?')) {
      localStorage.removeItem('gts_users');
      localStorage.removeItem('gts_complaints');
      window.location.reload();
    }
  };

  const handleChangeAdminPass = async (e: React.FormEvent) => {
    e.preventDefault();
    await onChangeAdminPass(adminNewPass);
    setAdminNewPass('');
  };

  return (
    <div className="space-y-8">
      {/* Stats Overview - Global for Admin */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass p-5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-xl">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-white/60 mb-1">Total Registry</p>
          <p className="text-3xl font-black text-blue-600 dark:text-blue-400">{complaints.length}</p>
        </div>
        <div className="glass p-5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-xl">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-white/60 mb-1">Pending</p>
          <p className="text-3xl font-black text-red-500">{complaints.filter(c => c.status === 'pending').length}</p>
        </div>
        <div className="glass p-5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-xl">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-white/60 mb-1">In Process</p>
          <p className="text-3xl font-black text-amber-500">{complaints.filter(c => c.status === 'in process').length}</p>
        </div>
        <div className="glass p-5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-xl">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-white/60 mb-1">Completed</p>
          <p className="text-3xl font-black text-emerald-500">{complaints.filter(c => c.status === 'complete').length}</p>
        </div>
      </div>

      {/* Admin Nav */}
      <div className="flex flex-wrap gap-2 p-1 bg-slate-200/50 dark:bg-black/20 backdrop-blur-lg rounded-2xl w-fit border border-slate-300/50 dark:border-white/5">
        <button
          onClick={() => setActiveTab('complaints')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all",
            activeTab === 'complaints' ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30" : "text-slate-500 dark:text-white/60 hover:text-slate-700 dark:hover:text-white"
          )}
        >
          <ClipboardList size={18} />
          Complaints
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all",
            activeTab === 'users' ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30" : "text-slate-500 dark:text-white/60 hover:text-slate-700 dark:hover:text-white"
          )}
        >
          <Users size={18} />
          Members Management
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all",
            activeTab === 'settings' ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30" : "text-slate-500 dark:text-white/60 hover:text-slate-700 dark:hover:text-white"
          )}
        >
          <Settings size={18} />
          Admin Settings
        </button>
        <button
          onClick={() => setActiveTab('integrations')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all",
            activeTab === 'integrations' ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30" : "text-slate-500 dark:text-white/60 hover:text-slate-700 dark:hover:text-white"
          )}
        >
          <FileSpreadsheet size={18} />
          Integrations
        </button>
      </div>

      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {activeTab === 'complaints' && (
          <ComplaintList
            complaints={complaints}
            onDelete={onDeleteComplaint}
            onStatusChange={onUpdateComplaintStatus}
            isAdmin={true}
          />
        )}

        {activeTab === 'users' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Create User Form */}
            <div className="lg:col-span-1 space-y-6">
              <div className="glass p-6 rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-slate-900 dark:text-white">
                  <UserPlus size={20} className="text-blue-500 dark:text-blue-400" />
                  Create New Account
                </h3>
                {formError && (
                  <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold animate-pulse">
                    {formError}
                  </div>
                )}
                {formSuccess && (
                  <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-bold">
                    {formSuccess}
                  </div>
                )}
                <form onSubmit={handleCreateUser} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-400 dark:text-white/50 mb-1 tracking-widest ml-1">Username</label>
                    <input
                      type="text"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      placeholder="account_name"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-400 dark:text-white/50 mb-1 tracking-widest ml-1">Initial Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-400 dark:text-white/50 mb-1 tracking-widest ml-1">Account Role</label>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <button
                        type="button"
                        onClick={() => setNewUserRole('member')}
                        className={cn(
                          "py-2 rounded-lg text-xs font-bold transition-all border",
                          newUserRole === 'member' 
                            ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/20" 
                            : "bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 dark:text-white/60 hover:border-blue-500/50"
                        )}
                      >
                        Member
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewUserRole('admin')}
                        className={cn(
                          "py-2 rounded-lg text-xs font-bold transition-all border",
                          newUserRole === 'admin' 
                            ? "bg-violet-600 border-violet-600 text-white shadow-md shadow-violet-500/20" 
                            : "bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 dark:text-white/60 hover:border-violet-500/50"
                        )}
                      >
                        Admin
                      </button>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="w-full py-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black transition-all shadow-lg hover:bg-black dark:hover:bg-slate-100 mt-2 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isCreating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        Registering...
                      </>
                    ) : (
                      'Register Account'
                    )}
                  </button>
                </form>
              </div>
            </div>

            {/* Users List */}
            <div className="lg:col-span-2">
              <div className="glass rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 dark:bg-white/5">
                    <tr className="border-b border-slate-200 dark:border-white/10">
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-white/60">Username</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-white/60">Role</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-white/60">Joined</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-white/60 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {users.map((user) => (
                      <tr key={user.uid} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                        <td className="px-6 py-4 font-bold text-slate-800 dark:text-white">{user.username}</td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border",
                            user.role === 'admin' ? "bg-violet-500/10 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 border-violet-500/20 dark:border-violet-500/30" : "bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/20 dark:border-blue-500/30"
                          )}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{new Date(user.createdAt).toLocaleDateString()}</td>
                        <td className="px-6 py-4 text-right">
                          {user.uid !== currentUserId ? (
                            <div className="flex justify-end gap-2">
                              {deletingId === user.uid ? (
                                <>
                                  <button
                                    onClick={async () => {
                                      try {
                                        await onDeleteUser(user.uid);
                                        setDeletingId(null);
                                      } catch (err) {
                                        alert('Failed to delete user account.');
                                      }
                                    }}
                                    className="px-3 py-1.5 text-[10px] font-black text-white bg-red-600 rounded-lg hover:bg-red-700 transition-all shadow-md shadow-red-500/20 uppercase"
                                  >
                                    Confirm?
                                  </button>
                                  <button
                                    onClick={() => setDeletingId(null)}
                                    className="px-3 py-1.5 text-[10px] font-black text-slate-500 dark:text-white/50 hover:text-slate-700 dark:hover:text-white uppercase"
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => setDeletingId(user.uid)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-500 hover:text-white bg-red-500/10 hover:bg-red-500 rounded-lg transition-all border border-red-500/20"
                                  title="Delete Account"
                                >
                                  <Trash2 size={14} />
                                  Delete
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 px-3">Current User</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-xl">
            <div className="glass p-8 rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 dark:text-amber-400">
                  <Shield size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">Security Settings</h3>
                  <p className="text-slate-500 dark:text-white/60 text-sm">Manage your administrative access</p>
                </div>
              </div>

              <form onSubmit={handleChangeAdminPass} className="space-y-6">
                <div>
                  <label className="block text-sm font-bold mb-2 text-slate-700 dark:text-white/80">Change Administrator Password</label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/40" size={18} />
                    <input
                      type="password"
                      value={adminNewPass}
                      onChange={(e) => setAdminNewPass(e.target.value)}
                      placeholder="Enter new admin password"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/20"
                      required
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="px-6 py-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold hover:bg-black dark:hover:bg-slate-100 transition-all shadow-lg"
                >
                  Update Admin Password
                </button>
              </form>
            </div>

            <div className="glass p-8 rounded-2xl border border-red-500/10 dark:border-red-500/20 shadow-2xl mt-8">
              <h3 className="text-xl font-bold text-red-500 mb-2">Danger Zone</h3>
              <p className="text-slate-500 dark:text-white/60 text-sm mb-6">Reset all application data (Accounts & Complaints)</p>
              <button
                onClick={handleResetAppData}
                className="px-6 py-3 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-600 hover:text-white border border-red-500/30 font-bold transition-all"
              >
                Reset App Data (Factory Reset)
              </button>
            </div>
          </div>
        )}

        {activeTab === 'integrations' && (
          <div className="max-w-2xl space-y-8">
            <div className="glass p-8 rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 dark:text-emerald-400">
                  <FileSpreadsheet size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">Google Sheets Integration</h3>
                  <p className="text-slate-500 dark:text-white/60 text-sm">Automatically log complaints to a spreadsheet</p>
                </div>
              </div>

              {!googleTokens ? (
                <div className="p-6 rounded-2xl bg-slate-100 dark:bg-white/5 border border-dashed border-slate-300 dark:border-white/10 text-center">
                  <p className="text-slate-600 dark:text-white/70 mb-4">You need to connect your Google account to enable Sheets integration.</p>
                  <button
                    onClick={handleGoogleConnect}
                    disabled={isConnecting}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50"
                  >
                    {isConnecting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <ExternalLink size={18} />
                        Connect Google Sheets
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold text-sm">Google Account Connected</span>
                    </div>
                    <button
                      onClick={() => {
                        googleSheetsService.clearAuth();
                        setGoogleTokens(null);
                      }}
                      className="text-xs text-red-500 hover:underline font-bold"
                    >
                      Disconnect
                    </button>
                  </div>

                  <div>
                    <label className="block text-sm font-bold mb-2 text-slate-700 dark:text-white/80">Google Spreadsheet ID</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={spreadsheetId}
                        onChange={(e) => setSpreadsheetId(e.target.value)}
                        placeholder="Enter the ID from your sheet's URL"
                        className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 text-slate-900 dark:text-white"
                      />
                      <button
                        onClick={handleSaveSpreadsheetId}
                        className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all shadow-lg shadow-emerald-500/20"
                      >
                        Save ID
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-slate-500 dark:text-white/40">
                      The ID is the long string in your browser's address bar: spreadshet/d/<span className="text-blue-500">SPREADSHEET_ID</span>/edit
                    </p>
                  </div>

                  <div className="pt-6 border-t border-slate-200 dark:border-white/10">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Export Status</h4>
                    <div className="flex items-center gap-4 text-xs">
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                        <HardDriveDownload size={14} />
                        Auto-sync enabled
                      </div>
                      <p className="text-slate-500 dark:text-white/40">
                        All new complaints will be added as new rows.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="glass p-8 rounded-2xl border border-blue-500/10 dark:border-blue-500/20 shadow-2xl">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Instructions</h3>
              <ul className="space-y-3 text-sm text-slate-600 dark:text-white/60">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px] font-bold">1</span>
                  Connect your Google account and grant spreadsheet permissions.
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px] font-bold">2</span>
                  Create a new Google Sheet (or use an existing one).
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px] font-bold">3</span>
                  Copy the ID from the URL and paste it above.
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px] font-bold">4</span>
                  Every new complaint will now be saved in "Sheet1" of your spreadsheet.
                </li>
              </ul>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
