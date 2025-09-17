import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { db } from '../db';
import { message } from 'antd';

const SyncContext = createContext();

export const useSync = () => useContext(SyncContext);

export const SyncProvider = ({ children }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const syncData = useCallback(async () => {
    if (isSyncing || !isOnline) return;

    const pendingOperations = await db.sync_queue.orderBy('timestamp').toArray();
    if (pendingOperations.length === 0) {
      return;
    }

    setIsSyncing(true);
    message.info('Uploading offline changes...');

    for (const op of pendingOperations) {
      try {
        if (op.type === 'create_daily_entry') {
          const { entry, earnings } = op.data;
          
          // Pehle purani entry delete karein
          await supabase.from('daily_entries').delete().match({ user_id: entry.user_id, entry_date: entry.entry_date });
          
          // --- YEH HAI ASAL AUR AAKHRI FIX ---
          // Ab 'wagons' ki value bhi Supabase par bhejein
          const { data: newEntry, error: entryError } = await supabase.from('daily_entries').insert({ 
            user_id: entry.user_id, 
            entry_date: entry.entry_date, 
            day_type: entry.day_type, 
            tonnage: entry.tonnage,
            wagons: entry.wagons // Yahan 'wagons' ko shamil kar diya gaya hai
          }).select('id').single();

          if (entryError) throw entryError;
          
          const earningsToInsert = earnings.map(e => ({ ...e, entry_id: newEntry.id }));
          const { error: earningsError } = await supabase.from('daily_earnings').insert(earningsToInsert);
          if (earningsError) throw earningsError;
          
          const entryToUpdate = await db.daily_entries.where({ user_id: entry.user_id, entry_date: entry.entry_date }).first();
          if (entryToUpdate) {
            await db.daily_entries.update(entryToUpdate.local_id, { synced: true });
          }
          await db.sync_queue.delete(op.id);
          message.success(`Entry for ${entry.entry_date} uploaded successfully!`);
        }
      } catch (error) {
        console.error(`Operation ${op.id} sync nahi ho saka:`, error.message);
        message.error(`Failed to upload entry for ${op.data.entry.entry_date}.`);
        break; 
      }
    }

    setIsSyncing(false);
    setLastSyncTime(new Date()); 
  }, [isOnline, isSyncing]);

  useEffect(() => {
    if (isOnline) {
      const timer = setTimeout(() => syncData(), 1000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, syncData]);

  const value = { isOnline, isSyncing, triggerSync: syncData, lastSyncTime };

  return (
    <SyncContext.Provider value={value}>
      {children}
    </SyncContext.Provider>
  );
};