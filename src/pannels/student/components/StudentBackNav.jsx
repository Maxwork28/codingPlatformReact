import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../../../common/ui/primitives';

const StudentBackNav = ({ fallbackTo = '/student', label = 'Back', className = '', onClick }) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (typeof onClick === 'function') {
      onClick();
      return;
    }
    if (typeof window !== 'undefined' && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(fallbackTo);
  };

  return (
    <Button variant="ghost" icon={ArrowLeft} className={className} onClick={handleBack} aria-label={label}>
      {label}
    </Button>
  );
};

export default StudentBackNav;
