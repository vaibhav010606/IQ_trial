import React, { useEffect } from 'react';
import { setPortal } from '../utils/initials';
import { Outlet } from 'react-router-dom';

const LockedLayout = () => {
  useEffect(() => { setPortal('student'); }, []);
  return (
    <div className="locked-layout">
      <Outlet />
    </div>
  );
};

export default LockedLayout;
