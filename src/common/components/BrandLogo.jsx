import React from 'react';
import algoSutraLogo from '../../assets/algosutra-header.png';

const BrandLogo = ({ className = 'h-10 w-auto' }) => (
  <img
    src={algoSutraLogo}
    alt="AlgoSutra"
    className={`object-contain ${className}`}
  />
);

export default BrandLogo;
