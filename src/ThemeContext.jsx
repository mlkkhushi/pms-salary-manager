// src/ThemeContext.jsx  <-- File ka naam .jsx hona chahiye

import React, { createContext, useState, useContext, useEffect } from 'react';

// 1. Context create karein
const ThemeContext = createContext();

// 2. Provider component banayein
export const ThemeProvider = ({ children }) => {
  // Theme state, default 'light' hai. Hum localStorage se check karenge.
  const [themeMode, setThemeMode] = useState(localStorage.getItem('themeMode') || 'light');

  // Jab bhi themeMode badle, usko localStorage mein save karein
  useEffect(() => {
    localStorage.setItem('themeMode', themeMode);
  }, [themeMode]);

  // Theme badalne wala function
  const toggleTheme = () => {
    setThemeMode(prevMode => (prevMode === 'light' ? 'dark' : 'light'));
  };

  // Value jo poori app ko provide ki jayegi
  const value = {
    themeMode,
    toggleTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

// 3. Ek custom hook banayein taake context ko asani se istemal kar sakein
export const useTheme = () => {
  return useContext(ThemeContext);
};