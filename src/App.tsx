import { useState, useEffect } from 'react';
import Layout from './components/Layout';
import LoginForm from './components/LoginForm';
import AdminPanel from './components/AdminPanel';
import MemberPanel from './components/MemberPanel';
import { Complaint, UserProfile, ComplaintStatus } from './types';
import { firebaseService } from './lib/firebaseService';
import { googleSheetsService } from './services/googleSheetsService';
// In a real app, I'd import real services here, but for now I'll use a local state controller
// that can switch between mock and real when API_KEY is valid.

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-login logic and initial data fetch
  useEffect(() => {
    const init = async () => {
      const initialUsers = await firebaseService.getUsers();
      
      // Bootstrap first admin if no users exist
      if (initialUsers.length === 0) {
        const admin = await firebaseService.createUser('admin-id', 'admin', 'admin', 'admin');
        setUsers([admin]);
      } else {
        setUsers(initialUsers);
      }

      const initialComplaints = await firebaseService.getComplaints();
      setComplaints(initialComplaints);
    };
    init();
  }, []);

  const handleLogin = async (username: string, pass: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const foundUser = users.find(u => u.username === username);
      
      if (foundUser && foundUser.password === pass) {
        setUser(foundUser);
      } else {
        setError('Invalid username or password');
      }
    } catch (e) {
      setError('Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
  };

  const handleRegisterComplaint = async (data: any) => {
    if (!user) return;
    setIsLoading(true);
    try {
      const newComplaint = await firebaseService.createComplaint(data, user);
      setComplaints(prev => [newComplaint, ...prev]);
      
      // Auto-sync to Google Sheets if configured
      try {
        await googleSheetsService.appendComplaint(newComplaint);
      } catch (err) {
        console.error('Failed to sync with Google Sheets:', err);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteComplaint = async (id: string) => {
    try {
      await firebaseService.deleteComplaint(id);
      setComplaints(prev => prev.filter(c => c.id !== id));
      alert('Complaint deleted successfully!');
    } catch (e) {
      console.error(e);
      alert('Failed to delete complaint.');
    }
  };

  const handleUpdateComplaintStatus = async (id: string, status: ComplaintStatus) => {
    try {
      await firebaseService.updateComplaintStatus(id, status);
      setComplaints(prev => prev.map(c => c.id === id ? { ...c, status } : c));
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateUser = async (username: string, pass: string, role: 'admin' | 'member') => {
    const trimmedName = username.trim();
    if (!trimmedName || !pass.trim()) {
      alert('Username and password cannot be empty!');
      return;
    }

    if (users.some(u => u.username.toLowerCase() === trimmedName.toLowerCase())) {
      alert('Username already exists! Please choose a different name.');
      return;
    }
    
    if (trimmedName.toLowerCase() === pass.toLowerCase()) {
      alert('Password cannot be the same as username for security reasons.');
      return;
    }

    try {
      const uid = Math.random().toString(36).substr(2, 9);
      const newUser = await firebaseService.createUser(uid, trimmedName, pass, role);
      setUsers(prev => [...prev, newUser]);
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const handleDeleteUser = async (uid: string) => {
    try {
      await firebaseService.deleteUser(uid);
      setUsers(prev => prev.filter(u => u.uid !== uid));
    } catch (e) {
      console.error(e);
    }
  };

  const handleChangeAdminPass = async (newPass: string) => {
    if (!user) return;
    try {
      await firebaseService.updateUserPassword(user.uid, newPass);
      const updatedUsers = await firebaseService.getUsers();
      setUsers(updatedUsers);
      alert(`Admin password changed successfully!`);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <Layout user={user} onLogout={handleLogout}>
      {!user ? (
        <LoginForm onLogin={handleLogin} isLoading={isLoading} error={error} />
      ) : user.role === 'admin' ? (
        <AdminPanel
          complaints={complaints}
          users={users}
          currentUserId={user.uid}
          onDeleteComplaint={handleDeleteComplaint}
          onUpdateComplaintStatus={handleUpdateComplaintStatus}
          onCreateUser={handleCreateUser}
          onDeleteUser={handleDeleteUser}
          onChangeAdminPass={handleChangeAdminPass}
        />
      ) : (
        <MemberPanel
          complaints={complaints.filter(c => c.memberId === user.uid)}
          onRegisterComplaint={handleRegisterComplaint}
          isLoading={isLoading}
        />
      )}
    </Layout>
  );
}
