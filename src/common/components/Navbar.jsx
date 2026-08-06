import React, { useRef, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { logout, setProfilePicture } from '../components/redux/authSlice';
import ThemeToggle from './ThemeToggle';
import HeaderNavigationMenu from './HeaderNavigationMenu';
import { uploadProfilePicture } from '../services/api';
import { API_BASE_URL } from '../constants';

const DefaultAvatarIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
  </svg>
);

const Navbar = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, role } = useSelector((state) => state.auth);
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  const avatarUrl = user?.profilePicture
    ? (user.profilePicture.startsWith('http')
        ? user.profilePicture
        : `${API_BASE_URL}${user.profilePicture}`)
    : null;

  const handleAvatarClick = () => {
    if (role === 'student' && !uploading) {
      fileInputRef.current?.click();
    }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be under 2MB');
      return;
    }

    try {
      setUploading(true);
      const response = await uploadProfilePicture(file);
      dispatch(setProfilePicture(response.data.profilePicture));
    } catch (err) {
      alert(typeof err === 'string' ? err : 'Failed to update profile picture');
    } finally {
      setUploading(false);
    }
  };

  const Avatar = () => (
    <button
      type="button"
      onClick={handleAvatarClick}
      disabled={role !== 'student' || uploading}
      className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center overflow-hidden border border-white/20 ${
        role === 'student' ? 'cursor-pointer hover:opacity-90' : 'cursor-default'
      }`}
      style={{ backgroundColor: 'var(--background-light)', color: 'var(--text-primary)' }}
      title={role === 'student' ? (uploading ? 'Uploading…' : 'Update profile picture') : undefined}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt={user?.name || 'Profile'} className="w-full h-full object-cover" />
      ) : (
        <DefaultAvatarIcon />
      )}
    </button>
  );

  const ProfileBlock = () => (
    <div className="flex items-center gap-3">
      <Avatar />
      <div className="text-center hidden sm:block">
        <p className="text-sm font-medium text-white">{user?.name || 'User'}</p>
        <p className="text-xs text-white text-opacity-80">{user?.email || ''}</p>
      </div>
      <button
        onClick={handleLogout}
        className="p-2 rounded-lg text-white hover:bg-white hover:bg-opacity-10 transition-all duration-300"
        title="Logout"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
      </button>
    </div>
  );

  return (
    <nav
      className="shadow-sm border-b sticky top-0 z-50 transition-all duration-300"
      style={{
        backgroundColor: 'var(--primary-navy)',
        borderColor: 'var(--card-border)',
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleAvatarChange}
      />
      <div className="max-w-7xl mx-auto pl-0 pr-4 sm:pr-6 lg:pr-8">
        <div className="flex items-center justify-between h-16 w-full">
          <div className="flex items-center gap-3 pl-4">
            <img src="/AlgoSutra Header.png" alt="AlgoSutra Logo" className="h-10 w-auto" />
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <HeaderNavigationMenu />
            <ThemeToggle />
            <ProfileBlock />
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
