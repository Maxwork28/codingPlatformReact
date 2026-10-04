import React, { useRef, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { logout, setProfilePicture } from '../components/redux/authSlice';
import ThemeToggle from './ThemeToggle';
import HeaderNavigationMenu from './HeaderNavigationMenu';
import { uploadProfilePicture } from '../services/api';
import { API_BASE_URL } from '../constants';
import BrandLogo from './BrandLogo';
import { shell } from '../ui/format';
import { useToast } from '../ui/Toast';

const DefaultAvatarIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
  </svg>
);

const Navbar = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const toast = useToast();
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
      toast('Please select an image file', 'warning');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast('Image must be under 2MB', 'warning');
      return;
    }

    try {
      setUploading(true);
      const response = await uploadProfilePicture(file);
      dispatch(setProfilePicture(response.data.profilePicture));
      toast('Profile picture updated', 'success');
    } catch (err) {
      toast(typeof err === 'string' ? err : 'Failed to update profile picture', 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <nav className={shell.navbar}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleAvatarChange}
      />
      <div className="h-full w-full px-3 sm:px-4 flex items-center gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <span className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 shadow-lg shadow-accent/20 flex items-center justify-center overflow-hidden shrink-0">
            <BrandLogo className="h-7 w-auto max-w-[2rem]" />
          </span>
          <span className="hidden xl:block text-sm font-bold text-fg tracking-tight">AlgoSutra</span>
        </div>

        <HeaderNavigationMenu />

        <div className="flex items-center gap-2 shrink-0">
          <ThemeToggle />
          <button
            type="button"
            onClick={handleAvatarClick}
            disabled={role !== 'student' || uploading}
            className={`w-8 h-8 rounded-lg object-cover border border-line flex items-center justify-center overflow-hidden bg-surface text-body ${
              role === 'student' ? 'cursor-pointer hover:border-line-strong' : 'cursor-default'
            }`}
            title={role === 'student' ? (uploading ? 'Uploading…' : 'Update profile picture') : user?.name}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt={user?.name || 'Profile'} className="w-full h-full object-cover" />
            ) : (
              <DefaultAvatarIcon />
            )}
          </button>
          <div className="hidden xl:block min-w-0 max-w-[9rem]">
            <p className="text-xs font-semibold text-fg truncate">{user?.name || 'User'}</p>
            <p className="text-[11px] text-muted truncate">{user?.email || ''}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="p-1.5 text-muted hover:text-fg rounded-lg hover:bg-hover"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
