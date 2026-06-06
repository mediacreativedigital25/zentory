import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import { User, CheckCircle2, Briefcase, Mail, Key, CreditCard, Bell, Link2, MoreVertical, Search, Check, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { auth } from '../lib/firebase';
import { updatePassword } from 'firebase/auth';

const Profile = () => {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  
  // Password change states
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters long');
      return;
    }

    if (!auth.currentUser) return;

    try {
      setIsChangingPassword(true);
      await updatePassword(auth.currentUser, newPassword);
      setPasswordSuccess('Password successfully updated');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('Update password error:', error);
      if (error.code === 'auth/requires-recent-login') {
        setPasswordError('Please log out and log back in to change your password for security reasons.');
      } else {
        setPasswordError(error.message || 'Failed to update password');
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: User },
    { id: 'security', label: 'Security', icon: Key },
  ];

  const getInitials = (name: string) => {
    if (!name) return 'U';
    return name.charAt(0).toUpperCase();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Column: User Profile Card */}
        <div className="w-full lg:w-1/3 xl:w-1/4 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6">
              <div className="flex flex-col items-center text-center">
                <div className="w-24 h-24 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center text-3xl font-bold mb-4 shadow-sm relative">
                  {getInitials(profile?.displayName || profile?.email || '')}
                  <div className="absolute -bottom-2 -right-2 bg-green-500 w-5 h-5 rounded-full border-4 border-white flex items-center justify-center">
                  </div>
                </div>
                <h2 className="text-xl font-bold text-gray-900">{profile?.displayName || profile?.email?.split('@')[0] || 'User'}</h2>
                <span className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 capitalize">
                  {profile?.role || 'Admin'}
                </span>
              </div>

              <div className="mt-8 border-t border-gray-100 pt-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wider">Details</h3>
                <div className="space-y-4">
                  <div className="flex">
                    <span className="w-24 text-sm font-semibold text-gray-900">Name:</span>
                    <span className="text-sm text-gray-600">{profile?.displayName || '-'}</span>
                  </div>
                  <div className="flex">
                    <span className="w-24 text-sm font-semibold text-gray-900">Email:</span>
                    <span className="text-sm text-gray-600">{profile?.email}</span>
                  </div>
                  <div className="flex">
                    <span className="w-24 text-sm font-semibold text-gray-900">Status:</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${profile?.isOnline ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {profile?.isOnline ? 'Online' : 'Offline'}
                    </span>
                  </div>
                  <div className="flex">
                    <span className="w-24 text-sm font-semibold text-gray-900">Role:</span>
                    <span className="text-sm text-gray-600 capitalize">{profile?.role || 'Admin'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Tabs and Content */}
        <div className="w-full lg:w-2/3 xl:w-3/4 space-y-6">
          {/* Tabs */}
          <div className="flex overflow-x-auto hide-scrollbar gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-600 hover:text-indigo-600 hover:bg-indigo-50'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Activity Timeline */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-6">Recent Activity</h3>
                
                <div className="relative pl-6 border-l-2 border-gray-100 space-y-8">
                  <div className="relative">
                    <span className="absolute -left-[31px] bg-white p-1 rounded-full">
                      <div className="w-3 h-3 bg-indigo-600 rounded-full"></div>
                    </span>
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="text-sm font-semibold text-gray-900">Current Session Active</h4>
                      <span className="text-xs text-gray-500">Just now</span>
                    </div>
                    <p className="text-sm text-gray-600">Logged in from IP: {profile?.ipAddress || '-'}</p>
                  </div>

                  <div className="relative">
                    <span className="absolute -left-[31px] bg-white p-1 rounded-full">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    </span>
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="text-sm font-semibold text-gray-900">Account Verified</h4>
                      <span className="text-xs text-gray-500">-</span>
                    </div>
                    <p className="text-sm text-gray-600">Account email belongs to {profile?.email}</p>
                  </div>
                  
                  <div className="relative">
                    <span className="absolute -left-[31px] bg-white p-1 rounded-full">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    </span>
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="text-sm font-semibold text-gray-900">Account Created</h4>
                      <span className="text-xs text-gray-500">-</span>
                    </div>
                    <p className="text-sm text-gray-600">Permissions established for role: {profile?.role}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
             <div className="space-y-6">
               <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                 <div className="p-6 border-b border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900">Change Password</h3>
                 </div>
                 <div className="p-6">
                    <div className="bg-orange-50/80 border border-orange-100 rounded-lg p-4 mb-6">
                       <h4 className="flex items-center gap-2 text-sm font-bold text-orange-800 mb-1">
                          Ensure that these requirements are met
                       </h4>
                       <p className="text-sm text-orange-600">Minimum 8 characters long, uppercase & symbol</p>
                    </div>

                    <form onSubmit={handlePasswordChange} className="space-y-6">
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-1.5">
                             <label className="text-sm font-medium text-gray-700">New Password</label>
                             <div className="relative">
                                <input
                                   type={showPassword ? "text" : "password"}
                                   value={newPassword}
                                   onChange={(e) => setNewPassword(e.target.value)}
                                   placeholder="············"
                                   className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none transition-all pr-10"
                                   required
                                />
                                <button
                                   type="button"
                                   onClick={() => setShowPassword(!showPassword)}
                                   className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                   {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                             </div>
                          </div>
                          
                          <div className="space-y-1.5">
                             <label className="text-sm font-medium text-gray-700">Confirm Password</label>
                             <div className="relative">
                                <input
                                   type={showConfirmPassword ? "text" : "password"}
                                   value={confirmPassword}
                                   onChange={(e) => setConfirmPassword(e.target.value)}
                                   placeholder="············"
                                   className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none transition-all pr-10"
                                   required
                                />
                                <button
                                   type="button"
                                   onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                   className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                   {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                             </div>
                          </div>
                       </div>

                       {passwordError && (
                          <div className="p-3 bg-red-50 text-red-600 text-sm font-medium rounded-lg border border-red-100 flex items-start gap-2">
                             <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                             <p>{passwordError}</p>
                          </div>
                       )}

                       {passwordSuccess && (
                          <div className="p-3 bg-green-50 text-green-600 text-sm font-medium rounded-lg border border-green-100 flex items-start gap-2">
                             <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                             <p>{passwordSuccess}</p>
                          </div>
                       )}

                       <div>
                          <button
                             type="submit"
                             disabled={isChangingPassword}
                             className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                          >
                             {isChangingPassword ? 'Changing...' : 'Change Password'}
                          </button>
                       </div>
                    </form>
                 </div>
               </div>

             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
