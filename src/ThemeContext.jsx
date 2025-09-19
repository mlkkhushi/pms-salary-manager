// src/ThemeContext.jsx

import React, { createContext, useState, useContext } from 'react';

// 1. Context create karein
const ThemeContext = createContext();

// 2. Provider component banayein
export const ThemeProvider = ({ children }) => {
  // Initial theme state set karne ka function
  const getInitialTheme = () => {
    // Pehle localStorage mein check karein ke user ne pehle se koi theme chuna hai ya nahi
    const savedTheme = localStorage.getItem('themeMode');
    if (savedTheme) {
      return savedTheme;
    }

    // Agar localStorage mein kuch nahi hai, to system ki setting check karein
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }

    // Agar kuch na mile to default 'light' mode set karein
    return 'light';
  };

  const [themeMode, setThemeMode] = useState(getInitialTheme);

  // Theme badalne wala function
  const toggleTheme = () => {
    setThemeMode(prevMode => {
      const newMode = prevMode === 'light' ? 'dark' : 'light';
      // User ki pasand ko hamesha ke liye localStorage mein save karein
      localStorage.setItem('themeMode', newMode);
      return newMode;
    });
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